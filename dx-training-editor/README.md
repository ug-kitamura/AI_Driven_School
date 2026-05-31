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

Windows では `start.bat` でも起動できる（ブラウザを開いて `npm run dev` を実行）。

## 4ペイン構成

| ペイン | 役割 |
|---|---|
| **Pane 1** | シリーズ・コース一覧（折りたたみ / DnD 並び替え / 進捗バー） |
| **Pane 2** | コースメタ情報（受講対象・前後コース・Mermaid フロー図）＋ レッスン一覧 |
| **Pane 3** | マークダウンエディタ（編集 / プレビュー / Git 差分の 3 モード） |
| **Pane 4** | 画像アセットマネージャー（Used / Upload / AI / Web タブ） |

GlobalHeader に **DXトレーニング曼陀羅ボタン** があり、全コースの依存グラフをフルスクリーンで表示。ノードをクリックすると対象コースに移動できる。

<img width="1406" height="715" alt="image" src="https://github.com/user-attachments/assets/d481fa5d-c094-4b51-8d54-81d586da04de" />

### Pane 3 のモード

| モード | 内容 |
|---|---|
| 編集 | CodeMirror による Markdown 編集（フロントマター折りたたみ・シンタックスハイライト） |
| プレビュー | `react-markdown` によるレンダリング |
| 差分 | Git HEAD と現在の content を unified diff 表示（`LessonDiffView`） |

### Pane 4 の画像管理

- **Used**: レッスン本文から参照されている画像一覧
- **Upload**: ドラッグ＆ドロップ / ペーストで `_staging` にアップロード → promote で本番パスへ
- **AI / Web**: UI のみ（将来拡張用）

画像ファイルは `images/{uploaded,ai,web}/` に保存し、API 経由で配信する。

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
components/
  workspace/               4 ペイン UI（Workspace.tsx が状態 SSoT）
  ui/                      shadcn 部品（components.json で管理）
data/
  content.json             シリーズ / コース / レッスン
  workspace.json           ワークスペース名・アイコン
images/
  uploaded/ ai/ web/       画像ストア（各 _staging/ は git 除外）
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
