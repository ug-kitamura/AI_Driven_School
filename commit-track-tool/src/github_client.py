"""
github_client.py - GitHub API 通信クライアント

REST / GraphQL API への低レベルリクエストと各エンドポイントの呼び出しを担う。
データの集約・集計は comitora_data_collector.py が行う。

公開メソッド一覧:
	get_gitignore_spec()                       .gitignore を取得して pathspec を返す
	get_branches()                             全ブランチと最終コミット日を取得
	filter_active_branches(...)                アクティブブランチに絞り込む
	get_branch_commits(branch, since, until)   ブランチのコミット一覧を取得
	get_commit_files(sha)                      コミットの変更ファイル一覧を取得
	get_merged_prs(since, until, active_since) マージ済み PR を取得
	get_open_prs()                             オープン PR をレビュー状態付きで取得
	get_reviews(pr_numbers, since, until)      PR のレビュー実績を集計
	get_open_issues()                          オープン Issue を取得
	get_closed_issues(since, until)            クローズした Issue を取得
	get_milestones()                           オープンなマイルストーン一覧を取得
"""

import sys
import time
import json
import base64
import hashlib
import requests
from typing import Any
from datetime import datetime, timedelta, timezone

try:
	import pathspec
	HAS_PATHSPEC = True
except ImportError:
	HAS_PATHSPEC = False


EXCLUDED_BRANCH_PREFIXES = ("dependabot/", "renovate/")
REVIEW_STATUS_AWAITING = "awaiting_review"
REVIEW_STATUS_FEEDBACK = "feedback_in_progress"
REVIEW_STATUS_APPROVED = "approved"
REVIEW_STATUS_DRAFT    = "draft"

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
		pullRequests(
			states : OPEN,
			first  : 50,
			after  : $cursor,
			orderBy: {field: UPDATED_AT, direction: DESC}
		) {
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


class GitHubClient:
	"""GitHub REST / GraphQL API クライアント。"""

	def __init__(self, token: str, owner: str, repo: str) -> None:
		self.owner    = owner
		self.repo     = repo
		self._headers = {
			"Authorization"       : f"Bearer {token}",
			"Accept"              : "application/vnd.github.v3+json",
			"X-GitHub-Api-Version": "2022-11-28",
		}

	# ------------------------------------------------------------------
	# Core HTTP（プライベート）
	# ------------------------------------------------------------------

	def _get(
		self,
		url        : str,
		params     : dict | None = None,
		max_retries: int = 3,
		timeout    : int = 30,
	) -> requests.Response:
		"""リトライ付き GET リクエスト。"""
		for attempt in range(1, max_retries + 1):
			try:
				resp = requests.get(url, headers=self._headers, params=params, timeout=timeout)
				resp.raise_for_status()
				return resp
			except requests.RequestException as e:
				if attempt == max_retries:
					raise
				wait = 2 ** (attempt - 1)
				print(f"  リトライ {attempt}/{max_retries} ({wait}s後): {e}", file=sys.stderr)
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
	# .gitignore
	# ------------------------------------------------------------------

	def get_gitignore_spec(self) -> Any | None:
		"""リポジトリの .gitignore を取得して pathspec オブジェクトを返す。"""
		if not HAS_PATHSPEC:
			print("[警告] pathspec 未インストールのため .gitignore フィルタを無効化します", file=sys.stderr)
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
		lines   = [ln for ln in content.splitlines() if ln.strip() and not ln.startswith("#")]
		print(f"[.gitignore] {len(lines)} パターンを読み込みました", file=sys.stderr)
		return pathspec.PathSpec.from_lines("gitwildmatch", lines)

	# ------------------------------------------------------------------
	# ブランチ
	# ------------------------------------------------------------------

	def get_branches(self) -> tuple[list[dict], str]:
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
					"name"            : name,
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

	def filter_active_branches(
		self, branches: list[dict], active_days: int, end_utc: datetime
	) -> list[dict]:
		"""active_days 以内に更新されたブランチに絞る。デフォルトブランチは常に含む。"""
		cutoff = end_utc - timedelta(days=active_days)
		return [
			b for b in branches
			if b["is_default"]
			or (b["last_commit_date"] and self._parse_dt(b["last_commit_date"]) >= cutoff)
		]

	# ------------------------------------------------------------------
	# コミット
	# ------------------------------------------------------------------

	def get_branch_commits(
		self, branch: str, since: datetime, until: datetime
	) -> list[dict]:
		"""指定ブランチの期間内コミットを取得する（ページネーション付き）。"""
		url    = f"https://api.github.com/repos/{self.owner}/{self.repo}/commits"
		params: dict[str, Any] = {
			"sha"  : branch,
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
				"sha"    : raw["sha"],
				"message": raw["commit"]["message"],
				"date"   : raw["commit"]["author"]["date"],
				"author" : self._normalize_author(raw),
				"url"    : raw["html_url"],
				"branch" : branch,
				"files"  : [],
			}
			for raw in raw_list
		]

	# ------------------------------------------------------------------
	# ファイル
	# ------------------------------------------------------------------

	def get_commit_files(self, sha: str) -> list[dict]:
		"""コミットの変更ファイル一覧（path + status）を取得する。"""
		url = f"https://api.github.com/repos/{self.owner}/{self.repo}/commits/{sha}"
		try:
			data = self._get(url, timeout=15).json()
			return [{"path": f["filename"], "status": f["status"]} for f in data.get("files", [])]
		except requests.RequestException as e:
			print(f"  [{sha[:7]}] ファイル取得エラー: {e}", file=sys.stderr)
			return []

	# ------------------------------------------------------------------
	# PR
	# ------------------------------------------------------------------

	def get_merged_prs(
		self, since: datetime, until: datetime, active_since: datetime
	) -> tuple[list[dict], dict]:
		"""
		期間内にマージされた PR を取得する。
		updated_at が active_since より古くなった時点でページネーションを打ち切る。
		"""
		url    = f"https://api.github.com/repos/{self.owner}/{self.repo}/pulls"
		params = {"state": "closed", "sort": "updated", "direction": "desc", "per_page": 100}
		merged:   list[dict]      = []
		activity: dict[str, dict] = {}
		page = 1

		while True:
			batch = self._get(url, params={**params, "page": page}).json()
			if not batch:
				break

			stop = False
			for pr in batch:
				updated_at_str = pr.get("updated_at", "")
				if updated_at_str and self._parse_dt(updated_at_str) < active_since:
					stop = True
					break

				merged_at_str = pr.get("merged_at")
				if not merged_at_str:
					continue
				merged_at = self._parse_dt(merged_at_str)
				if not (since <= merged_at <= until):
					continue

				login  = pr["user"]["login"] if pr.get("user") else "unknown"
				avatar = pr["user"]["avatar_url"] if pr.get("user") else ""
				merged.append({
					"number"   : pr["number"],
					"title"    : pr["title"],
					"author"   : {"login": login, "avatar_url": avatar},
					"merged_at": merged_at_str,
					"branch"   : pr["head"]["ref"],
					"url"      : pr["html_url"],
				})
				self._ensure_contributor(activity, login, avatar)
				activity[login]["prs_created"] += 1
				activity[login]["prs_merged"]  += 1

			if stop or len(batch) < 100:
				break
			page += 1

		return merged, activity

	def get_open_prs(self) -> tuple[list[dict], dict]:
		"""オープン PR をレビューステータス付きで取得する。"""
		open_prs: list[dict]      = []
		activity: dict[str, dict] = {}
		cursor = None

		while True:
			data     = self._graphql(_GRAPHQL_OPEN_PRS, {"owner": self.owner, "repo": self.repo, "cursor": cursor})
			pr_nodes = data["repository"]["pullRequests"]

			for node in pr_nodes["nodes"]:
				login  = node["author"]["login"]    if node.get("author") else "unknown"
				avatar = node["author"]["avatarUrl"] if node.get("author") else ""
				reviewers = [
					r["requestedReviewer"]["login"]
					for r in node["reviewRequests"]["nodes"]
					if r.get("requestedReviewer") and r["requestedReviewer"].get("login")
				]
				open_prs.append({
					"number"             : node["number"],
					"title"              : node["title"],
					"author"             : {"login": login, "avatar_url": avatar},
					"created_at"         : node["createdAt"],
					"updated_at"         : node["updatedAt"],
					"url"                : node["url"],
					"branch"             : node["headRefName"],
					"draft"              : node["isDraft"],
					"review_status"      : self._classify_open_pr(node),
					"requested_reviewers": reviewers,
				})
				self._ensure_contributor(activity, login, avatar)
				activity[login]["prs_created"] += 1

			if not pr_nodes["pageInfo"]["hasNextPage"]:
				break
			cursor = pr_nodes["pageInfo"]["endCursor"]

		return open_prs, activity

	# ------------------------------------------------------------------
	# レビュー
	# ------------------------------------------------------------------

	def get_reviews(
		self, pr_numbers: list[int], since: datetime, until: datetime
	) -> dict:
		"""期間内のレビュー実績を PR ごとに集計して返す。"""
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
				submitted_at = self._parse_dt(submitted_at_str)
				if not (since <= submitted_at <= until):
					continue
				login  = review["user"]["login"]      if review.get("user") else "unknown"
				avatar = review["user"]["avatar_url"]  if review.get("user") else ""
				self._ensure_contributor(activity, login, avatar)
				activity[login]["reviews_submitted"] += 1
			time.sleep(0.05)
		return activity

	# ------------------------------------------------------------------
	# Issue / Milestone
	# ------------------------------------------------------------------

	def get_open_issues(self) -> tuple[int, list[dict]]:
		"""現在オープンな Issue（PR 除く）を取得する。"""
		url      = f"https://api.github.com/repos/{self.owner}/{self.repo}/issues"
		raw_list = self._paginate(url, {"state": "open", "sort": "updated", "direction": "desc"})
		open_issues = [
			{
				"number"    : issue["number"],
				"title"     : issue["title"],
				"created_at": issue["created_at"],
				"updated_at": issue["updated_at"],
				"url"       : issue["html_url"],
				"milestone" : (issue.get("milestone") or {}).get("title", ""),
			}
			for issue in raw_list
			if not issue.get("pull_request")
		]
		return len(open_issues), open_issues

	def get_closed_issues(
		self, since: datetime, until: datetime
	) -> tuple[int, list[dict]]:
		"""期間内にクローズされた Issue（PR 除く）を取得する。"""
		url      = f"https://api.github.com/repos/{self.owner}/{self.repo}/issues"
		raw_list = self._paginate(
			url,
			{"state": "closed", "sort": "updated", "direction": "desc", "since": since.isoformat()},
		)
		closed = [
			{
				"number"    : issue["number"],
				"title"     : issue["title"],
				"closed_at" : issue["closed_at"],
				"url"       : issue["html_url"],
				"closed_by" : (
					issue["closed_by"]["login"]
					if issue.get("closed_by") and issue["closed_by"]
					else None
				),
				"closed_by_avatar": (
					issue["closed_by"]["avatar_url"]
					if issue.get("closed_by") and issue["closed_by"]
					else ""
				),
			}
			for issue in raw_list
			if not issue.get("pull_request")
			and issue.get("closed_at")
			and since <= self._parse_dt(issue["closed_at"]) <= until
		]
		return len(closed), closed

	def get_milestones(self) -> list[dict]:
		"""オープンなマイルストーン一覧を取得する。"""
		url      = f"https://api.github.com/repos/{self.owner}/{self.repo}/milestones"
		raw_list = self._paginate(url, {"state": "open", "sort": "due_on"})
		milestones = []
		for ms in raw_list:
			total = ms["open_issues"] + ms["closed_issues"]
			milestones.append({
				"title"        : ms["title"],
				"due_on"       : ms.get("due_on"),
				"open_issues"  : ms["open_issues"],
				"closed_issues": ms["closed_issues"],
				"total_issues" : total,
				"progress_pct" : round(ms["closed_issues"] / total * 100) if total > 0 else 0,
				"url"          : ms["html_url"],
			})
		return milestones

	# ------------------------------------------------------------------
	# プライベートヘルパー
	# ------------------------------------------------------------------

	@staticmethod
	def _parse_dt(dt_str: str) -> datetime:
		"""GitHub API の ISO 8601 文字列を aware datetime に変換する。"""
		return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))

	@staticmethod
	def _normalize_author(raw_commit: dict) -> dict:
		"""コミットの author を {login, avatar_url} に正規化する（Gravatar フォールバック付き）。"""
		if raw_commit.get("author") and raw_commit["author"].get("login"):
			return {
				"login"     : raw_commit["author"]["login"],
				"avatar_url": raw_commit["author"]["avatar_url"],
			}
		email = raw_commit.get("commit", {}).get("author", {}).get("email", "")
		name  = raw_commit.get("commit", {}).get("author", {}).get("name", "Unknown")
		md5   = hashlib.md5(email.lower().strip().encode()).hexdigest() if email else "0" * 32
		return {
			"login"     : name,
			"avatar_url": f"https://www.gravatar.com/avatar/{md5}?d=identicon&s=80",
		}

	@staticmethod
	def _ensure_contributor(activity: dict, login: str, avatar_url: str) -> None:
		"""activity dict に login が存在しなければ初期化する。"""
		if login not in activity:
			activity[login] = {
				"login"            : login,
				"avatar_url"       : avatar_url,
				"prs_created"      : 0,
				"prs_merged"       : 0,
				"reviews_submitted": 0,
			}

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

