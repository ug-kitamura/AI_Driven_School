"""
github_client.py - GitHub API クライアント

GitHubClient クラスにコミット・PR・Issue・Milestone 取得ロジックを集約する。
get_commits.py / get_report_data.py はこのクラスを呼び出す薄い CLI ラッパーになる。
"""

import base64
import hashlib
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

try:
	import pathspec
	HAS_PATHSPEC = True
except ImportError:
	HAS_PATHSPEC = False

JST = timezone(timedelta(hours=9))

EXCLUDED_BRANCH_PREFIXES = ("dependabot/", "renovate/")

# PR レビューステータス
REVIEW_STATUS_AWAITING  = "awaiting_review"
REVIEW_STATUS_FEEDBACK  = "feedback_in_progress"
REVIEW_STATUS_APPROVED  = "approved"
REVIEW_STATUS_DRAFT     = "draft"

_GRAPHQL_BRANCHES = """
query($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
	defaultBranchRef { name }
	refs(refPrefix: "refs/heads/", first: 100, after: $cursor) {
	  nodes {
		name
		target { ... on Commit { committedDate } }
	  }
	  pageInfo { hasNextPage endCursor }
	}
  }
}
"""

_GRAPHQL_OPEN_PRS = """
query($owner: String!, $repo: String!, $cursor: String) {
  repository(owner: $owner, name: $repo) {
	pullRequests(states: OPEN, first: 50, after: $cursor,
				 orderBy: {field: UPDATED_AT, direction: DESC}) {
	  nodes {
		number
		title
		isDraft
		url
		createdAt
		updatedAt
		author { login avatarUrl }
		headRefName
		reviewRequests(first: 10) {
		  totalCount
		  nodes {
			requestedReviewer { ... on User { login } }
		  }
		}
		reviews(states: [CHANGES_REQUESTED], last: 1) { totalCount }
		latestOpinionatedReviews(first: 10) {
		  nodes { state author { login } }
		}
	  }
	  pageInfo { hasNextPage endCursor }
	}
  }
}
"""


# ---------------------------------------------------------------------------
# モジュールレベルのユーティリティ
# ---------------------------------------------------------------------------

def parse_date_range(days: int) -> tuple[datetime, datetime, str]:
	"""現在時刻から days 日前 〜 現在時刻の UTC datetime と表示ラベルを返す。"""
	now_jst = datetime.now(JST)
	end_utc = now_jst.astimezone(timezone.utc)
	start_utc = end_utc - timedelta(days=days)
	label = (
		f"直近{days}日間"
		f" ({start_utc.strftime('%Y-%m-%d')} ～ {end_utc.strftime('%Y-%m-%d')} UTC)"
	)
	return start_utc, end_utc, label


def parse_dt(dt_str: str) -> datetime:
	"""GitHub API の ISO 8601 文字列を aware datetime に変換する。"""
	return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))


# ---------------------------------------------------------------------------
# GitHubClient
# ---------------------------------------------------------------------------

class GitHubClient:
	"""GitHub REST / GraphQL API クライアント。"""

	def __init__(self, token: str, owner: str, repo: str) -> None:
		self.owner = owner
		self.repo = repo
		self._headers = {
			"Authorization": f"Bearer {token}",
			"Accept": "application/vnd.github.v3+json",
			"X-GitHub-Api-Version": "2022-11-28",
		}

	# ------------------------------------------------------------------
	# Core HTTP
	# ------------------------------------------------------------------

	def _get(
		self,
		url: str,
		params: dict | None = None,
		max_retries: int = 3,
		timeout: int = 30,
	) -> requests.Response:
		"""リトライ付き GET リクエスト。"""
		for attempt in range(1, max_retries + 1):
			try:
				resp = requests.get(
					url, headers=self._headers, params=params, timeout=timeout
				)
				resp.raise_for_status()
				return resp
			except requests.RequestException as e:
				if attempt == max_retries:
					raise
				wait = 2 ** (attempt - 1)
				print(
					f"  リトライ {attempt}/{max_retries} ({wait}s後): {e}",
					file=sys.stderr,
				)
				time.sleep(wait)
		raise RuntimeError("unreachable")

	def _graphql(self, query: str, variables: dict | None = None) -> dict:
		"""GitHub GraphQL API を呼び出して data フィールドを返す。エラー時は終了。"""
		resp = requests.post(
			"https://api.github.com/graphql",
			headers={**self._headers, "Content-Type": "application/json"},
			json={"query": query, "variables": variables or {}},
			timeout=30,
		)
		resp.raise_for_status()
		body = resp.json()
		if "errors" in body:
			print(f"[GraphQLエラー] {body['errors']}", file=sys.stderr)
			sys.exit(1)
		return body["data"]

	def _paginate(self, url: str, params: dict | None = None) -> list[dict]:
		"""REST API のページネーションを処理して全件返す（リトライ付き）。"""
		results: list[dict] = []
		p = dict(params or {})
		p["per_page"] = 100
		page = 1
		while True:
			p["page"] = page
			batch = self._get(url, params=p).json()
			if not batch:
				break
			results.extend(batch)
			if len(batch) < 100:
				break
			page += 1
		return results

	# ------------------------------------------------------------------
	# コミット取得
	# ------------------------------------------------------------------

	def _fetch_gitignore_spec(self) -> Any | None:
		"""リポジトリの .gitignore を取得して pathspec オブジェクトを返す。"""
		if not HAS_PATHSPEC:
			print(
				"[警告] pathspec 未インストールのため .gitignore フィルタを無効化します",
				file=sys.stderr,
			)
			return None
		url = f"https://api.github.com/repos/{self.owner}/{self.repo}/contents/.gitignore"
		try:
			resp = self._get(url, max_retries=1, timeout=10)
		except requests.HTTPError as e:
			if e.response is not None and e.response.status_code == 404:
				print("[.gitignore] 見つかりませんでした（フィルタなし）", file=sys.stderr)
				return None
			raise
		content = base64.b64decode(resp.json()["content"]).decode("utf-8")
		lines = [ln for ln in content.splitlines() if ln.strip() and not ln.startswith("#")]
		print(f"[.gitignore] {len(lines)} パターンを読み込みました", file=sys.stderr)
		return pathspec.PathSpec.from_lines("gitwildmatch", lines)

	def _get_all_branches(self) -> tuple[list[dict], str]:
		"""GraphQL で全ブランチと最終コミット日を取得する。"""
		branches: list[dict] = []
		default_branch = "main"
		cursor = None

		while True:
			data = self._graphql(
				_GRAPHQL_BRANCHES,
				{"owner": self.owner, "repo": self.repo, "cursor": cursor},
			)
			repo = data["repository"]
			if repo["defaultBranchRef"]:
				default_branch = repo["defaultBranchRef"]["name"]

			for node in repo["refs"]["nodes"]:
				name = node["name"]
				if any(name.startswith(p) for p in EXCLUDED_BRANCH_PREFIXES):
					continue
				branches.append({
					"name": name,
					"last_commit_date": (
						node["target"].get("committedDate") if node["target"] else None
					),
					"is_default": name == default_branch,
				})

			page_info = repo["refs"]["pageInfo"]
			if not page_info["hasNextPage"]:
				break
			cursor = page_info["endCursor"]

		return branches, default_branch

	def _filter_active_branches(
		self, branches: list[dict], active_days: int, end_utc: datetime
	) -> list[dict]:
		"""active_days 以内に更新されたブランチに絞る。デフォルトブランチは常に含む。"""
		cutoff = end_utc - timedelta(days=active_days)
		return [
			b for b in branches
			if b["is_default"]
			or (b["last_commit_date"] and parse_dt(b["last_commit_date"]) >= cutoff)
		]

	def _get_branch_commits(
		self, branch: str, since: datetime, until: datetime
	) -> list[dict]:
		"""指定ブランチの期間内コミットを取得する（ページネーション付き）。"""
		url = f"https://api.github.com/repos/{self.owner}/{self.repo}/commits"
		params: dict[str, Any] = {
			"sha": branch,
			"since": since.isoformat(),
			"until": until.isoformat(),
		}
		try:
			raw_list = self._paginate(url, params)
		except requests.RequestException as e:
			print(f"  [{branch}] ⚠️ 取得失敗: {e}", file=sys.stderr)
			return []

		return [
			{
				"sha": raw["sha"],
				"message": raw["commit"]["message"],
				"date": raw["commit"]["author"]["date"],
				"author": self._normalize_author(raw),
				"url": raw["html_url"],
				"branch": branch,
				"files": [],
			}
			for raw in raw_list
		]

	def _get_commit_files(self, sha: str) -> list[dict]:
		"""コミットの変更ファイル一覧（path + status）を取得する。"""
		url = f"https://api.github.com/repos/{self.owner}/{self.repo}/commits/{sha}"
		try:
			data = self._get(url, timeout=15).json()
			return [{"path": f["filename"], "status": f["status"]} for f in data.get("files", [])]
		except requests.RequestException as e:
			print(f"  [{sha[:7]}] ファイル取得エラー: {e}", file=sys.stderr)
			return []

	def fetch_commits(
		self,
		days: int = 7,
		active_days: int = 30,
		concurrency: int = 5,
		use_gitignore: bool = True,
	) -> dict:
		"""
		週次コミットデータを取得して返す。

		Returns:
			{"metadata": {...}, "commits": [...]}
		"""
		start_utc, end_utc, period_label = parse_date_range(days)

		print("=== コミット取得開始 ===", file=sys.stderr)
		print(f"対象期間   : {period_label}", file=sys.stderr)
		print(f"リポジトリ : {self.owner}/{self.repo}", file=sys.stderr)

		spec = self._fetch_gitignore_spec() if use_gitignore else None

		print("\n[Step 1] ブランチ一覧を取得中...", file=sys.stderr)
		all_branches, default_branch = self._get_all_branches()
		active_branches = self._filter_active_branches(all_branches, active_days, end_utc)
		print(f"  総ブランチ数     : {len(all_branches)}", file=sys.stderr)
		print(f"  アクティブブランチ: {len(active_branches)}", file=sys.stderr)

		print("\n[Step 2] コミットを取得中...", file=sys.stderr)
		all_commits: list[dict] = []
		seen: set[str] = set()
		for i, branch in enumerate(active_branches, 1):
			print(f"  [{i}/{len(active_branches)}] {branch['name']} ...", file=sys.stderr)
			for c in self._get_branch_commits(branch["name"], start_utc, end_utc):
				if c["sha"] not in seen:
					seen.add(c["sha"])
					all_commits.append(c)

		print(f"\n  総コミット数（重複排除）: {len(all_commits)}", file=sys.stderr)

		if all_commits:
			print(f"\n[Step 3] 変更ファイルを取得中（並列数: {concurrency}）...", file=sys.stderr)

			def _fetch_files(commit: dict) -> None:
				files = self._get_commit_files(commit["sha"])
				if spec:
					files = [f for f in files if not spec.match_file(f["path"])]
				commit["files"] = files

			done = 0
			with ThreadPoolExecutor(max_workers=concurrency) as ex:
				futures = {ex.submit(_fetch_files, c): c["sha"] for c in all_commits}
				for fut in as_completed(futures):
					fut.result()
					done += 1
					if done % 10 == 0 or done == len(all_commits):
						print(f"  進捗: {done} / {len(all_commits)}", file=sys.stderr)

		print("\n=== コミット取得完了 ===", file=sys.stderr)
		return {
			"metadata": {
				"period": period_label,
				"days": days,
				"start_utc": start_utc.isoformat(),
				"end_utc": end_utc.isoformat(),
				"repository": f"{self.owner}/{self.repo}",
				"default_branch": default_branch,
				"total_branches": len(all_branches),
				"active_branches_checked": len(active_branches),
				"total_commits": len(all_commits),
				"gitignore_filter_applied": spec is not None,
			},
			"commits": all_commits,
		}

	# ------------------------------------------------------------------
	# PR 取得
	# ------------------------------------------------------------------

	def _classify_open_pr(self, node: dict) -> str:
		"""GraphQL ノードからレビューステータスを分類する。"""
		if node.get("isDraft"):
			return REVIEW_STATUS_DRAFT
		states = {
			r["state"]
			for r in node.get("latestOpinionatedReviews", {}).get("nodes", [])
		}
		if "CHANGES_REQUESTED" in states:
			return REVIEW_STATUS_FEEDBACK
		if states and all(s == "APPROVED" for s in states):
			return REVIEW_STATUS_APPROVED
		return REVIEW_STATUS_AWAITING

	def _fetch_merged_prs(
		self, since: datetime, until: datetime, active_since: datetime
	) -> tuple[list[dict], dict]:
		"""
		期間内にマージされたPRを取得する。
		updated_at が active_since より古くなった時点でページネーションを打ち切る。
		"""
		url = f"https://api.github.com/repos/{self.owner}/{self.repo}/pulls"
		params = {"state": "closed", "sort": "updated", "direction": "desc", "per_page": 100}
		merged: list[dict] = []
		activity: dict[str, dict] = {}
		page = 1

		while True:
			batch = self._get(url, params={**params, "page": page}).json()
			if not batch:
				break

			stop = False
			for pr in batch:
				# updated_at が active_since より古ければ以降のページも不要
				updated_at_str = pr.get("updated_at", "")
				if updated_at_str and parse_dt(updated_at_str) < active_since:
					stop = True
					break

				merged_at_str = pr.get("merged_at")
				if not merged_at_str:
					continue
				merged_at = parse_dt(merged_at_str)
				if not (since <= merged_at <= until):
					continue

				login = pr["user"]["login"] if pr.get("user") else "unknown"
				avatar = pr["user"]["avatar_url"] if pr.get("user") else ""
				merged.append({
					"number": pr["number"],
					"title": pr["title"],
					"author": {"login": login, "avatar_url": avatar},
					"merged_at": merged_at_str,
					"branch": pr["head"]["ref"],
					"url": pr["html_url"],
				})
				self._ensure_contributor(activity, login, avatar)
				activity[login]["prs_created"] += 1
				activity[login]["prs_merged"] += 1

			if stop or len(batch) < 100:
				break
			page += 1

		return merged, activity

	def _fetch_open_prs(self) -> tuple[list[dict], dict]:
		open_prs: list[dict] = []
		activity: dict[str, dict] = {}
		cursor = None

		while True:
			data = self._graphql(
				_GRAPHQL_OPEN_PRS,
				{"owner": self.owner, "repo": self.repo, "cursor": cursor},
			)
			pr_nodes = data["repository"]["pullRequests"]

			for node in pr_nodes["nodes"]:
				login = node["author"]["login"] if node.get("author") else "unknown"
				avatar = node["author"]["avatarUrl"] if node.get("author") else ""
				reviewers = [
					r["requestedReviewer"]["login"]
					for r in node["reviewRequests"]["nodes"]
					if r.get("requestedReviewer") and r["requestedReviewer"].get("login")
				]
				open_prs.append({
					"number": node["number"],
					"title": node["title"],
					"author": {"login": login, "avatar_url": avatar},
					"created_at": node["createdAt"],
					"updated_at": node["updatedAt"],
					"url": node["url"],
					"branch": node["headRefName"],
					"draft": node["isDraft"],
					"review_status": self._classify_open_pr(node),
					"requested_reviewers": reviewers,
				})
				self._ensure_contributor(activity, login, avatar)
				activity[login]["prs_created"] += 1

			if not pr_nodes["pageInfo"]["hasNextPage"]:
				break
			cursor = pr_nodes["pageInfo"]["endCursor"]

		return open_prs, activity

	def _fetch_reviews(
		self, pr_numbers: list[int], since: datetime, until: datetime
	) -> dict:
		activity: dict[str, dict] = {}
		for i, number in enumerate(pr_numbers, 1):
			if i % 10 == 0:
				print(f"  レビュー取得: {i}/{len(pr_numbers)}", file=sys.stderr)
			url = f"https://api.github.com/repos/{self.owner}/{self.repo}/pulls/{number}/reviews"
			try:
				reviews = self._get(url, timeout=15).json()
			except requests.RequestException as e:
				print(f"  [PR#{number}] レビュー取得エラー: {e}", file=sys.stderr)
				continue
			for review in reviews:
				submitted_at_str = review.get("submitted_at")
				if not submitted_at_str:
					continue
				submitted_at = parse_dt(submitted_at_str)
				if not (since <= submitted_at <= until):
					continue
				login = review["user"]["login"] if review.get("user") else "unknown"
				avatar = review["user"]["avatar_url"] if review.get("user") else ""
				self._ensure_contributor(activity, login, avatar)
				activity[login]["reviews_submitted"] += 1
			time.sleep(0.05)
		return activity

	# ------------------------------------------------------------------
	# Issue / Milestone
	# ------------------------------------------------------------------

	def _fetch_closed_issues(
		self, since: datetime, until: datetime
	) -> tuple[int, list[dict]]:
		url = f"https://api.github.com/repos/{self.owner}/{self.repo}/issues"
		raw_list = self._paginate(
			url,
			{"state": "closed", "sort": "updated", "direction": "desc", "since": since.isoformat()},
		)
		closed = [
			{
				"number": issue["number"],
				"title": issue["title"],
				"closed_at": issue["closed_at"],
				"url": issue["html_url"],
			}
			for issue in raw_list
			if not issue.get("pull_request")
			and issue.get("closed_at")
			and since <= parse_dt(issue["closed_at"]) <= until
		]
		return len(closed), closed

	def _fetch_milestones(self) -> list[dict]:
		url = f"https://api.github.com/repos/{self.owner}/{self.repo}/milestones"
		raw_list = self._paginate(url, {"state": "open", "sort": "due_on"})
		milestones = []
		for ms in raw_list:
			total = ms["open_issues"] + ms["closed_issues"]
			milestones.append({
				"title": ms["title"],
				"due_on": ms.get("due_on"),
				"open_issues": ms["open_issues"],
				"closed_issues": ms["closed_issues"],
				"total_issues": total,
				"progress_pct": round(ms["closed_issues"] / total * 100) if total > 0 else 0,
				"url": ms["html_url"],
			})
		return milestones

	def fetch_report_data(self, days: int = 7, active_days: int = 30) -> dict:
		"""
		PR・Issue・Milestone・貢献度データを取得して返す。

		Args:
			days:        レポート対象期間（日）
			active_days: PR取得の打ち切り基準（日）。ブランチと同じ基準で古いPRを除外する。

		Returns:
			{"metadata": {...}, "prs": {...}, "issues": {...},
			 "milestones": [...], "contributor_activity": {...}}
		"""
		start_utc, end_utc, period_label = parse_date_range(days)
		active_since = end_utc - timedelta(days=active_days)

		print("=== レポートデータ取得開始 ===", file=sys.stderr)
		print(f"対象期間         : {period_label}", file=sys.stderr)
		print(f"PR取得打ち切り基準: 直近 {active_days} 日以内", file=sys.stderr)
		print(f"リポジトリ       : {self.owner}/{self.repo}", file=sys.stderr)

		print("\n[Step 1] マージ済みPRを取得中...", file=sys.stderr)
		merged_prs, merged_activity = self._fetch_merged_prs(start_utc, end_utc, active_since)
		print(f"  マージ済みPR: {len(merged_prs)} 件", file=sys.stderr)

		print("\n[Step 2] オープンPRをレビュー状態付きで取得中...", file=sys.stderr)
		open_prs, open_activity = self._fetch_open_prs()
		awaiting = sum(1 for p in open_prs if p["review_status"] == REVIEW_STATUS_AWAITING)
		feedback = sum(1 for p in open_prs if p["review_status"] == REVIEW_STATUS_FEEDBACK)
		approved = sum(1 for p in open_prs if p["review_status"] == REVIEW_STATUS_APPROVED)
		draft    = sum(1 for p in open_prs if p["review_status"] == REVIEW_STATUS_DRAFT)
		print(f"  オープンPR: {len(open_prs)} 件 "
			  f"(レビュー待ち:{awaiting} / フィードバック対応中:{feedback} / 承認済み:{approved} / ドラフト:{draft})",
			  file=sys.stderr)

		print("\n[Step 3] レビュー実績を集計中...", file=sys.stderr)
		all_pr_numbers = [p["number"] for p in merged_prs] + [p["number"] for p in open_prs]
		review_activity = self._fetch_reviews(all_pr_numbers, start_utc, end_utc)
		print(f"  期間内レビュー数: {sum(a['reviews_submitted'] for a in review_activity.values())} 件",
			  file=sys.stderr)

		print("\n[Step 4] クローズしたIssueを取得中...", file=sys.stderr)
		closed_count, closed_issues = self._fetch_closed_issues(start_utc, end_utc)
		print(f"  クローズしたIssue: {closed_count} 件", file=sys.stderr)

		print("\n[Step 5] マイルストーンを取得中（参考用）...", file=sys.stderr)
		milestones = self._fetch_milestones()
		print(f"  アクティブなマイルストーン: {len(milestones)} 件", file=sys.stderr)

		contributor_activity = self._merge_contributor_activity(
			merged_activity, open_activity, review_activity
		)

		print("\n=== レポートデータ取得完了 ===", file=sys.stderr)
		return {
			"metadata": {
				"period": period_label,
				"days": days,
				"start_utc": start_utc.isoformat(),
				"end_utc": end_utc.isoformat(),
				"repository": f"{self.owner}/{self.repo}",
			},
			"prs": {
				"merged": merged_prs,
				"open": open_prs,
				"summary": {
					"merged_count": len(merged_prs),
					"open_count": len(open_prs),
					"awaiting_review_count": awaiting,
					"feedback_in_progress_count": feedback,
					"approved_count": approved,
					"draft_count": draft,
				},
			},
			"issues": {"closed_count": closed_count, "closed": closed_issues},
			"milestones": milestones,
			"contributor_activity": contributor_activity,
		}

	# ------------------------------------------------------------------
	# Static helpers
	# ------------------------------------------------------------------

	@staticmethod
	def _normalize_author(raw_commit: dict) -> dict:
		"""コミットの author を {login, avatar_url} に正規化する（Gravatar フォールバック付き）。"""
		if raw_commit.get("author") and raw_commit["author"].get("login"):
			return {
				"login": raw_commit["author"]["login"],
				"avatar_url": raw_commit["author"]["avatar_url"],
			}
		email = raw_commit.get("commit", {}).get("author", {}).get("email", "")
		name  = raw_commit.get("commit", {}).get("author", {}).get("name", "Unknown")
		md5   = hashlib.md5(email.lower().strip().encode()).hexdigest() if email else "0" * 32
		return {
			"login": name,
			"avatar_url": f"https://www.gravatar.com/avatar/{md5}?d=identicon&s=80",
		}

	@staticmethod
	def _ensure_contributor(activity: dict, login: str, avatar_url: str) -> None:
		"""activity dict に login が存在しなければ初期化する。"""
		if login not in activity:
			activity[login] = {
				"login": login,
				"avatar_url": avatar_url,
				"prs_created": 0,
				"prs_merged": 0,
				"reviews_submitted": 0,
			}

	@staticmethod
	def _merge_contributor_activity(*dicts: dict) -> dict:
		"""複数の contributor_activity を統合する。"""
		merged: dict[str, dict] = {}
		for activity in dicts:
			for login, data in activity.items():
				if login not in merged:
					merged[login] = dict(data)
				else:
					merged[login]["prs_created"]      += data.get("prs_created", 0)
					merged[login]["prs_merged"]       += data.get("prs_merged", 0)
					merged[login]["reviews_submitted"] += data.get("reviews_submitted", 0)
		return merged

