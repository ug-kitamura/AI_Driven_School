# DX Training Studio

DX ツールトレーニングのコンテンツ計画・作成・編集・デプロイを支援する 4 ペイン統合スタジオ。  
シリーズ → コース → レッスンの階層構造でコンテンツを管理し、マークダウン編集・画像アセット管理・進捗トラッキングを一画面で行える。

## ツール画面

<img width="1571" height="741" alt="image" src="https://github.com/user-attachments/assets/1c7b1e26-e08d-42c6-9af0-8b87a84ef369" />

## 起動する

```bash
cd dx-training-studio
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開く。

Windows では `start.bat` を推奨（Playwright Chromium の確認後に `npm run dev` を実行）。

AI タブで Tailwind 図解を生成する場合は、初回のみ `npx playwright install chromium` が必要です（`start.bat` に含まれます）。

## 4ペイン構成

| ペイン | 役割 |
|---|---|
| **Pane 1** | シリーズ・コース一覧（折りたたみ / DnD 並び替え / 進捗バー） |
| **Pane 2** | コースメタ情報（受講対象・前後コース・Mermaid フロー図）＋ レッスン一覧 |
| **Pane 3** | マークダウンエディタ（編集 / プレビュー / Git 差分の 3 モード） |
| **Pane 4** | 画像アセットマネージャー（Used / Upload / AI / Web タブ） |

GlobalHeader に **DXトレーニング曼陀羅** と **設定（歯車）** がある。設定では AI API キー、Pixabay API キー、**画像の管理（ローカル / ストレージ）**、**社内コンテキストの管理（ローカル / データベース）**、テーマ（ライト／ダーク／システム）、ペイン既定幅を変更できる。

### API キー（`.env.local`）

```bash
cp .env.example .env.local
# AI_API_KEY / PIXABAY_API_KEY / BLOB_READ_WRITE_TOKEN（ストレージモード時）を設定
```

**設定ダイアログにキーがある場合はダイアログを優先**します。ダイアログ未入力のときのみ `.env.local` の `AI_API_KEY` / `PIXABAY_API_KEY` を参照します。画像ストレージのトークンは **常に `.env.local` の `BLOB_READ_WRITE_TOKEN`** のみです。

### 画像ストレージ（⚙ 画像の管理）

| モード | 正本の保存先 | git |
|--------|-------------|-----|
| **ストレージ**（既定） | Vercel Blob（Private） | 正本は Blob 上（`images/` は git 除外） |
| **ローカル** | `images/<filename>` | 正本を fs に保存（`images/*` は git 除外のまま） |

- staging（`images/{uploaded,ai,web}/`）は **常にローカル**
- ストレージモードでトークン未設定のときは「ストレージに接続できません」と表示
- 既存のローカル正本を Blob へ上げる: `npm run upload-images-to-blob`（`--dry-run` 可）

### 社内コンテキスト（⚙ 社内コンテキストの管理）

| モード | 保存先 | git |
|--------|--------|-----|
| **データベース**（既定） | Vercel Neon `context_items` | DB 上（`DATABASE_URL` 要） |
| **ローカル** | `local-db/context-items.json` | `local-db/*` は git 除外（`.gitkeep` のみ追跡） |

- 1 ファイルに `{ "nextId": number, "items": ContextItem[] }` 形式で保存（Ctrl+F 検索しやすい）
- 初回アクセス時に空 store を自動作成
- データベースモード保存時のみ Neon 接続を検証（`DATABASE_URL` 未設定時は保存不可）
- **Neon ↔ local の同期は行わない**（画像の管理と同様、モード切替は保存先の切替のみ）
- ローカルモードでは JSON をエディタで直接編集可能（100 件未満想定）

### Pane 3 のモード

| モード | 内容 |
|---|---|
| 編集 | CodeMirror による Markdown 編集（フロントマター折りたたみ・シンタックスハイライト） |
| プレビュー | `react-markdown` によるレンダリング |
| 差分 | Git HEAD と現在の content を unified diff 表示（`LessonDiffView`） |

### Pane 4 の画像管理

- **Used**: promote 済み正本一覧 + 参照中だがファイル欠落の行。シリーズ／コース／レッスンでフィルタ可能（フィルタ ON 時は未使用を非表示）
- **Upload**: ドラッグ＆ドロップ / ペースト → `images/uploaded/`（staging）→ 挿入で `images/<filename>` へ promote
- **AI**: プロンプト入力 → Claude + Playwright で PNG 生成 → `images/ai/`（staging）→ 挿入で promote（要 `AI_API_KEY`）。`<!-- -->` 内カーソルでプロンプト自動同期。**自動入力**ボタンは常に Claude でプロンプトを再構成
- **Web**: 説明文プロンプト → Claude + Pixabay で最大 3 枚取得 → `images/web/`（staging）→ 挿入で promote（要 `AI_API_KEY` + `PIXABAY_API_KEY`）。同期・自動入力の挙動は AI タブと同様

削除は staging を `images/trash/` へ move（ローカル）。**ローカルモード**の正本削除も trash へ move。**ストレージモード**の正本削除は Blob から物理削除。

Markdown の画像パスは正本形式 `images/<filename>` のみ。staging は `images/{uploaded|ai|web}/` に保存する。詳細は [`contracts/image-slot-contract.md`](contracts/image-slot-contract.md)。

## 技術スタック

- **Next.js 16** / **React 19** / **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**（base-nova）
- **CodeMirror 6**（Markdown エディタ）
- **react-markdown** + **remark-gfm** + **rehype-highlight**（プレビュー）
- **Mermaid**（フロー図・曼陀羅）
- **@dnd-kit**（ドラッグ＆ドロップ）
- **Zod**（スキーマ検証）

## ディレクトリ構成

```
app/
  page.tsx                 content.json / workspace.json 読み込み・検証
  layout.tsx               レイアウト・TooltipProvider
  globals.css              カラートークン定義
  api/
    lesson-diff/           レッスン content の HEAD vs 現在 diff
    images/
      upload/              ステージングへアップロード
      promote/             ステージング → 本番パスへ昇格
      list/                画像一覧
      file/                画像ファイル配信
      generate/            AI 画像生成（Claude + Playwright）
      search/              Web 画像検索（Claude + Pixabay）
      suggest-web-prompt/  Web 検索条件の自動入力
components/
  workspace/               4 ペイン UI（Workspace.tsx が状態 SSoT）
  ui/                      shadcn 部品（components.json で管理）
data/
  content.json             シリーズ / コース / レッスン
  workspace.json           ワークスペース名・アイコン
images/
  <file>.png               正本（git 追跡）
  uploaded/ ai/ web/       staging（git 除外）
  trash/                   削除退避（git 除外）
scripts/
  render-diagram.mjs       Playwright HTML→PNG
lib/
  schema.ts                Zod スキーマ
  utils.ts                 cn() / computeStatus
  lesson-*.ts              フロントマター・エディタ・差分など
  image-*.ts               画像パス解決・ストア・参照抽出
docs/
  grill-me.md              仕様検討の記録
  development-plan.md      実装プランと実装済み内容
  dx-training-studio.html    図解
```

AI 向けの編集ルールは [`CLAUDE.md`](CLAUDE.md) を参照。

## 開発コマンド

| コマンド | 役割 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm run start` | 本番サーバー起動 |
| `npm run lint` | ESLint |
| `npm run test` | Vitest |
| `npm run test:watch` | Vitest（ウォッチ） |
| `npm run format` | Prettier（整形） |
| `npm run format:check` | Prettier（チェックのみ） |

shadcn 部品の追加: `npx shadcn@latest add <name> --diff`（設定は `components.json`）

## Vercel にデプロイ（デモ）

リポジトリ [`AI_Driven_School`](https://github.com/ug-kitamura/AI_Driven_School) のサブディレクトリとして Vercel に公開する。デモ URL: [https://ai-driven-school.vercel.app](https://ai-driven-school.vercel.app)

### プロジェクト設定

Vercel ダッシュボード → **Settings** → **Build and Deployment**

| 項目 | 値 |
|---|---|
| Root Directory | `dx-training-studio` |
| Framework Preset | Next.js |
| Build Command | `npm run build` |
| Output Directory | デフォルト（Override しない） |
| Install Command | `npm install` |
| **Include files outside the root directory in the Build Step** | **Disabled** |

**Include files outside… を Enabled にすると**、monorepo 全体がビルドに含まれ post-build で ENOENT になることがある。**必ず Disabled** にする。

### 環境変数（任意）

デモで UI と既存コンテンツの閲覧だけなら未設定でよい。AI / Web タブも試す場合は `AI_API_KEY` / `PIXABAY_API_KEY` を Vercel の Environment Variables に追加する（設定ダイアログの値が優先）。

### Vercel 上の制限

デモ・プレビュー用途を想定。以下はローカルと異なる。

| 機能 | Vercel |
|---|---|
| 4ペイン UI・プレビュー・既存 `images/` | 動作 |
| マークダウン編集 | セッション内のみ（リロードで初期値に戻る） |
| Git 差分モード | 不可（`.git` がデプロイに含まれない） |
| AI 画像生成（Playwright） | 不可 |
| アップロード・編集の永続化 | 不可 |

`main` への push で Production デプロイが走る。設定変更後は **Deployments → Redeploy**（Build Cache OFF 推奨）。

## データ構造

```
Series（シリーズ）
  └─ Course（コース）
       ├─ target_audience   受講対象者
       ├─ prerequisites      別シリーズの前提コース ID
       ├─ next_courses       別シリーズの次コース ID
       └─ Lesson（レッスン）
            ├─ status        open / in_progress / done
            ├─ content       マークダウン本文（YAML フロントマター可）
            └─ ...
```

ステータスは下位から自動集計される（`computeStatus`）。

- すべて `open` → `open`
- すべて `done` → `done`
- それ以外 → `in_progress`

編集内容は現状セッション内 state で保持される（ページリロードで `data/*.json` の初期値に戻る）。

## 仕様・設計の詳細

- 仕様検討の記録 → [`docs/grill-me.md`](docs/grill-me.md)
- 実装プラン・実装済み内容 → [`docs/development-plan.md`](docs/development-plan.md)
