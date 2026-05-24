"""Fetch GitHub issue data and save as JSON."""

import os
import sys
import json
import time
import argparse
import requests
from pathlib import Path
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()


class GitHubClient:
	"""GitHub REST API client for fetching issue and milestone data."""

	def __init__(self, token: str, org: str, repo: str) -> None:
		self.org  = org
		self.repo = repo
		self._headers = {
			"Authorization"       : f"Bearer {token}",
			"Accept"              : "application/vnd.github.v3+json",
			"X-GitHub-Api-Version": "2022-11-28",
		}

	def _get(
		self,
		url        : str,
		params     : dict | None = None,
		max_retries: int = 3,
		timeout    : int = 30,
	) -> requests.Response:
		"""GET request with exponential-backoff retry."""
		for attempt in range(1, max_retries + 1):
			try:
				resp = requests.get(url, headers=self._headers, params=params, timeout=timeout)
				resp.raise_for_status()
				return resp
			except requests.RequestException as e:
				if attempt == max_retries:
					raise
				wait = 2 ** (attempt - 1)
				print(f"  Retry {attempt}/{max_retries} (after {wait}s): {e}", file=sys.stderr)
				time.sleep(wait)
		raise RuntimeError("unreachable")

	def _paginate(self, url: str, params: dict | None = None) -> list[dict]:
		"""Fetch all pages of a REST endpoint and return a flat list."""
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

	def get_open_issues(self) -> tuple[int, list[dict]]:
		"""Return (count, list) of currently open issues, excluding pull requests."""
		url = f"https://api.github.com/repos/{self.org}/{self.repo}/issues"
		raw_list = self._paginate(url, {"state": "open", "sort": "updated", "direction": "desc"})
		open_issues = []
		for issue in raw_list:
			if issue.get("pull_request"):
				continue
			open_issues.append({
				"number"    : issue["number"],
				"title"     : issue["title"],
				"body"      : issue.get("body") or "",
				"created_by": (issue.get("user") or {}).get("login", ""),
				"created_at": issue["created_at"],
				"updated_at": issue["updated_at"],
				"url"       : issue["html_url"],
				"milestone" : (issue.get("milestone") or {}).get("title", ""),
				"assignees" : [a["login"] for a in issue.get("assignees", [])],
				"labels"    : [l["name"]  for l in issue.get("labels",    [])],
			})
		return len(open_issues), open_issues

	def get_closed_issues(self) -> tuple[int, list[dict]]:
		"""Return (count, list) of all closed issues, excluding pull requests."""
		url = f"https://api.github.com/repos/{self.org}/{self.repo}/issues"
		raw_list = self._paginate(url, {"state": "closed", "sort": "updated", "direction": "desc"})
		closed = [
			{
				"number"    : issue["number"],
				"title"     : issue["title"],
				"body"      : issue.get("body") or "",
				"created_by": (issue.get("user") or {}).get("login", ""),
				"created_at": issue["created_at"],
				"closed_by" : (issue.get("closed_by") or {}).get("login", None),
				"closed_at" : issue["closed_at"],
				"url"       : issue["html_url"],
				"milestone" : (issue.get("milestone") or {}).get("title", ""),
				"assignees" : [a["login"] for a in issue.get("assignees", [])],
				"labels"    : [l["name"]  for l in issue.get("labels",    [])],
			}
			for issue in raw_list
			if not issue.get("pull_request")
			and issue.get("closed_at")
		]
		return len(closed), closed


def _print_section(label: str) -> None:
	"""Print a section header to stderr."""
	print(f"\n{'-' * 50}", file=sys.stderr)
	print(label, file=sys.stderr)
	print(f"{'-' * 50}", file=sys.stderr)


def build_parser() -> argparse.ArgumentParser:
	"""Build and return the CLI argument parser."""
	parser = argparse.ArgumentParser(
		description="Fetch GitHub issue data and save as issue_data.json",
		formatter_class=argparse.RawDescriptionHelpFormatter,
	)
	parser.add_argument("--org",   required=True, help="GitHub org name")
	parser.add_argument("--repo",  required=True, help="Repository name")
	parser.add_argument(
		"--token",
		default=None,
		help="GitHub API token (defaults to GITHUB_TOKEN env var)",
	)
	return parser


def main() -> None:
	args  = build_parser().parse_args()
	token = args.token or os.environ.get("GITHUB_TOKEN")
	if not token:
		sys.exit("Error: provide a token via --token or the GITHUB_TOKEN environment variable")

	client = GitHubClient(token, args.org, args.repo)

	# build metadata
	_print_section("Metadata")
	metadata = {
		"repository"  : f"{args.org}/{args.repo}",
		"generated_at": datetime.now().strftime("%Y/%m/%d %H:%M"),
	}
	print(f"Repository: {metadata['repository']}", file=sys.stderr)

	# fetch open issues
	_print_section("Fetch open issues")
	open_count, open_issues = client.get_open_issues()
	print(f"Open issues: {open_count}", file=sys.stderr)

	"""
	# fetch closed issues
	_print_section("Fetch closed issues")
	closed_count, closed_issues = client.get_closed_issues()
	print(f"Closed issues: {closed_count}", file=sys.stderr)
	"""

	# save to JSON in the current working directory
	output = Path("issue_data.json")
	issue_data = {
		"metadata"     : metadata,
		"open_count"   : open_count,
		"open_issues"  : open_issues,
#		"closed_count" : closed_count,
#		"closed_issues": closed_issues,
	}
	with open(output, "w", encoding="utf-8") as f:
		json.dump(issue_data, f, ensure_ascii=False, indent=2)
	_print_section("Save to JSON")
	print(output.resolve(), file=sys.stderr)


if __name__ == "__main__":
	main()

