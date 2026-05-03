# Commit & Track tool（コミとら）

![コミとら](comitora.png)

GitHubのコミット履歴をAIで分析し、週次レポートをSlackに自動投稿するツール。

---

## セットアップ

### 1. uv をインストール

```powershell
# Windows (PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

インストール後、ターミナルを再起動してください。

### 2. Python 環境を構築

```powershell
cd commit-track-tool
uv sync
```

`uv.lock` の内容通りに依存パッケージがインストールされ、`.venv/` が作成されます。

### 3. 環境変数を設定

`.env.template` をコピーして `.env` を作成し、APIキーを記入します。

```powershell
copy .env.template .env
```

```
GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 実行

```powershell
uv run python src/main.py --owner your-org --repo your-repo
```

### オプション

| オプション | デフォルト | 説明 |
|---|---|---|
| `--owner` | 必須 | GitHub オーナー名 |
| `--repo` | 必須 | リポジトリ名 |
| `--days` | 7 | 直近何日分を対象とするか |
| `--active-days` | 30 | アクティブブランチ判定日数 |
| `--concurrency` | 5 | ファイル取得の並列リクエスト数 |
| `--skip-claude` | - | Claude API をスキップ（データ取得のみ確認） |
| `--slack-webhook` | - | Slack Incoming Webhook URL |

---

## パッケージの追加・削除

```powershell
# 追加
uv add パッケージ名

# 削除
uv remove パッケージ名
```

`pyproject.toml` と `uv.lock` が自動で更新されます。
