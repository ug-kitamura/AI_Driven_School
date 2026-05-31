# dx-training-editor

DX ツールトレーニング用の **4ペイン Next.js 16 × shadcn/ui ワークスペース**。
起動方法・画面構成は README を参照。

## アーキテクチャ

- **状態の SSoT**: `components/workspace/Workspace.tsx`
- **Pane 1–4**: `SeriesCoursePane`, `LessonListPane`, `MarkdownEditorPane`, `ImageManagerPane`
- **データ**: `data/content.json`（シリーズ/コース/レッスン）, `data/workspace.json`（UI 状態）
- **スキーマ**: `lib/schema.ts`（Zod）

## UI 編集方針

- **メタ編集**は `metaDialogLayout.tsx` の `MetaDialogField` / `META_DIALOG_*` と shadcn の `Label` + `Input` / `Select` を組み合わせる（`LessonMetaPanel`, `LessonListPane` を参照）
- **業務 Dialog**（追加・削除・プレビュー・曼陀羅など）は既存コンポーネントのパターンを踏襲する
- **shadcn 部品の追加**は `npx shadcn@latest add <name> --diff`。設定は `components.json`
- **`--overwrite` は明示許可なしに使わない**（独自 variant が消える）

## コード生成ルール

`components/` を編集するときは以下を守る。

- 子要素の間隔は親で管理（`flex flex-col gap-*`。`space-y-*` は使わない）
- shadcn 部品の見た目を呼び出し側で打ち消さない（色・サイズの `className` 上書きは避け、必要なら部品側に variant を足す）
- 色は役割付きトークン（`bg-primary` 等）。`bg-blue-500` のような色番号は使わない
- 正方形は `size-N`（`w-N h-N` ではない）
- shadcn **base** 版: トリガーの合成は `asChild` ではなく `render`
- shadcn で足りるなら自前の `div` で代替しない
- 派生 state を Effect で複製しない。props 追従の Effect+setState より `key` でリマウント。ユーザー操作の副作用はイベントハンドラに置く

## 技術スタック

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS v4
- shadcn（base-nova）
- lucide-react
- zod
- CodeMirror
- Mermaid

## コマンド

```bash
npm run dev           # 開発サーバー
npm run build         # 本番ビルド
npm run lint          # ESLint
npm run test          # Vitest
npm run format        # Prettier（整形）
npm run format:check  # Prettier（チェックのみ）
```
