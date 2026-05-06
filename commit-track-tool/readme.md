# Commit & Track tool（コミとら）

![コミとら](assets/comitora.png)

GitHubのコミット履歴をAIで分析し、レポートをSlackに自動投稿するツール。

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
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxxxxxxxxxxxxx
SLACK_CHANNEL_ID=C0123456789
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
| `--llm` | claude-sonnet-4-6 | 使用する Claude モデル ID |
| `--skip-claude` | - | Claude API をスキップ（データ取得のみ確認） |
| `--skip-review` | - | レポートレビュー工程をスキップ |
| `--skip-validation` | - | HTML バリデーション工程をスキップ |
| `--slack-bot-token` | 環境変数参照 | Slack Bot Token（`SLACK_BOT_TOKEN`） |
| `--slack-channel-id` | 環境変数参照 | Slack Channel ID（`SLACK_CHANNEL_ID`） |
| `--include-page-url` | - | Slack 通知に GitHub Pages URL を含める |
| `--skip-slack` | - | Slack 通知を無効化（環境変数が設定済みでも投稿しない） |

---

## パッケージの追加・削除

```powershell
# 追加
uv add パッケージ名

# 削除
uv remove パッケージ名
```

`pyproject.toml` と `uv.lock` が自動で更新されます。

---

## 補足ドキュメント

- 初期計画: `docs/planning/comitora-plan.md`
- 初期モック: `docs/mockups/comitora-mockup1.html`, `docs/mockups/comitora-mockup2.html`

---

## プロジェクト健全度とヒーロー選定

レポート用データは `comitora_data_collector` が `output/report_data.json` に書き出す。
以下はその算出ロジックの要点です（詳細は `src/comitora_data_collector.py` の `_flow_health_raw` と `_aggregate`）。

### プロジェクト健全度（`aggregate.health.pct`）

プロジェクト全体の「フロー」の良さを **0〜100** で表す指標です。
リポジトリの状態（マージ済み・オープンの PR、滞留、Issue、ブランチ）と、対象期間内のコミット数・クローズした Issue 数・レビュー付き PR の件数を組み合わせて計算します。

1. **raw スコア**を次のように求める（各項目にはコード上で上限がある）。
   - **加点**
     - **PR フロー**: マージ済み PR 数 ÷（マージ済み + オープン PR）× **40**。対象 PR が 0 件の場合は中立として **20** 点。
     - **コミット活動**: 対象期間内のコミット数 ÷ 4、最大 **10**。
     - **Issue クローズ**: 対象期間内にクローズした Issue 数 × 5、最大 **15**。
     - **レビュー活発度**: 対象期間内に **レビュー投稿が 1 件以上**ある PR の件数 × 5、最大 **15**。
   - **減点**
     - **滞留**: オープン PR のうちレビュー待ち × 4 + フィードバック対応中 × 5、合計最大 **20**。
     - **オープン Issue**: 現在オープンの Issue 数 × 0.5、最大 **15**。
     - **アクティブブランチ**: max(0, アクティブブランチ数 − 3) × 2、最大 **10**（既定の `--active-days` に基づく「アクティブ」のみカウント）。
2. **健全度（パーセント）**は
   `raw` を **raw × 100 ÷ 80** し、**0〜100 の範囲に収めた値**を整数に丸めたものです。  
   内訳は `aggregate.health.breakdown`（例: `raw_score`, `pr_merge_ratio_pct`, 各加点・減点）に保存されます。

### ヒーロー選定（`aggregate.hero`）

「今回のヒーロー」は **貢献スコアが最も高いユーザー**です（同点のときは内部的な並び順で先頭になります）。

対象期間における **ユーザーごとの貢献スコア**は次式です。

| 要素 | 係数 |
|---|---|
| 対象期間内のコミット数（作者ベース） | × 1 |
| 対象期間内にマージされた PR のうち、**自分が PR 作者としてカウントされる件数** | × 3 |
| 対象期間内に **そのユーザーが投稿した** PR レビュー数（REST の reviews を期間でフィルタ） | × 2 |
| 対象期間内にクローズした Issue 数（GitHub が記録するクローズ操作ユーザー） | × 1 |

マージ PR・オープン PR・レビュー・Issue は収集時にユーザー別実績へ集約され、最終的に上式でスコア化されます。
オープン PR のみ作成した場合は、`prs_merged` が増えないためマージ済み PR の係数は効きません。
コミットのみ・レビューのみ・Issue クローズのみの参加者もスコアの対象になり得ます。
該当ユーザーが一人もいない場合はヒーローは設定されません。

