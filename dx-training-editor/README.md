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

## 4ペイン構成

| ペイン | 役割 |
|---|---|
| **Pane 1** | シリーズ・コース一覧（折りたたみ / DnD 並び替え / 進捗バー） |
| **Pane 2** | コースメタ情報（受講対象・前後コース・Mermaid フロー図）＋ レッスン一覧 |
| **Pane 3** | マークダウンエディタ（プレビュー / 生 Markdown / Git 差分の 3 モード） |
| **Pane 4** | 画像アセットマネージャー（ドラッグ＆ドロップ / ペースト / 履歴） |

GlobalHeader に **DXトレーニング曼陀羅ボタン** があり、全コースの依存グラフをフルスクリーンで表示。ノードをクリックすると対象コースに移動できる。

<img width="1406" height="715" alt="image" src="https://github.com/user-attachments/assets/d481fa5d-c094-4b51-8d54-81d586da04de" />

## 技術スタック

- **Next.js** / **React** / **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**
- **Mermaid**（フロー図描画）
- **@dnd-kit**（ドラッグ＆ドロップ）
- **Zod**（スキーマ検証）
- **Monaco Editor**（Git 差分表示）

## ディレクトリ構成

```
app/
  page.tsx              JSON 読み込み・Zod 検証・Workspace に渡す
  layout.tsx            タイトル / favicon
  globals.css           カラートークン定義
  api/lesson-diff/      レッスン content の HEAD vs 現在 diff API
components/workspace/
  Workspace.tsx         中央状態管理（SSoT）
  SeriesCoursePane.tsx  Pane 1
  LessonListPane.tsx    Pane 2
  MarkdownEditorPane.tsx Pane 3
  ImageManagerPane.tsx  Pane 4
  GlobalHeader.tsx      パンくず + 曼陀羅ボタン
data/
  content.json          シリーズ/コース/レッスンのサンプルデータ
  images.json           画像履歴サンプル
docs/
  grill-me.md           仕様検討の記録
  development-plan.md   実装プランと実装済み内容の記録
lib/
  schema.ts             Zod スキーマ（Series / Course / Lesson）
  utils.ts              computeStatus ヘルパー
```

## 開発コマンド

| コマンド | 役割 |
|---|---|
| `npm run dev` | 開発サーバー起動 |
| `npm run build` | 本番ビルド |
| `npm run lint` | ESLint チェック |

## データ構造

```
Series（シリーズ）
  └─ Course（コース）
       ├─ target_audience   受講対象者
       ├─ prerequisites      前提コース ID リスト
       ├─ next_courses       次のコース ID リスト
       └─ Lesson（レッスン）
            ├─ status        draft / in_progress / done
            ├─ content       マークダウン本文
            └─ ...
```

ステータスは下位から自動集計される（`computeStatus`）。
すべて完了 → `done`、1つでも着手 → `in_progress`、すべて未着手 → `draft`。

## 仕様・設計の詳細

- 仕様検討の記録 → [`docs/grill-me.md`](docs/grill-me.md)
- 実装プラン・実装済み内容 → [`docs/development-plan.md`](docs/development-plan.md)
