# DX Training Editor

DX ツールトレーニングのコンテンツ作成を補助する 4 ペイン UI ツール。  
シリーズ → コース → レッスンの階層構造でコンテンツを管理し、マークダウン編集・画像アセット管理・進捗トラッキングを一画面で行える。

## 起動する

```bash
cd dx-training-editor
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

GlobalHeader に **DXトレーニング曼陀羅** と **設定（歯車）** がある。設定では Anthropic API キー、Pixabay API キー、テーマ（ライト／ダーク／システム）、ペイン既定幅を変更できる。

<img width="1411" height="732" alt="image" src="https://github.com/user-attachments/assets/4ed6a5e6-a5a1-4f7b-99c6-d406ecf462f7" />

### Pane 3 のモード

| モード | 内容 |
|---|---|
| 編集 | CodeMirror による Markdown 編集（フロントマター折りたたみ・シンタックスハイライト） |
| プレビュー | `react-markdown` によるレンダリング |
| 差分 | Git HEAD と現在の content を unified diff 表示（`LessonDiffView`） |

### Pane 4 の画像管理

- **Used**: レッスン本文から参照されている画像一覧（正本 `images/<filename>`）
- **Upload**: ドラッグ＆ドロップ / ペースト → `images/uploaded/`（staging）→ 挿入で `images/<filename>` へ promote
- **AI**: プロンプト入力 → Claude + Playwright で PNG 生成 → `images/ai/`（staging）→ 挿入で promote（要 API キー）。`<!-- -->` 内カーソルでプロンプト自動同期
- **Web**: 説明文プロンプト → Claude + Pixabay で最大 3 枚取得 → `images/web/`（staging）→ 挿入で promote（要 Anthropic + Pixabay API キー）。`<!-- -->` 内カーソルでプロンプト自動同期

Markdown の画像パスは正本形式 `images/<filename>` のみ。staging は `images/{uploaded|ai|web}/` に保存する。詳細は [`docs/image-slot-contract.md`](docs/image-slot-contract.md)。

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
  dx-training-editor.html    図解
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
