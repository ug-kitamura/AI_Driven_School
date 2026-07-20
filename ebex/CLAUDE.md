# EBEX

**EBEX**（Editor + Browser + EXecution）は、プロジェクトフォルダ内のファイルを入力に AI スキルを発火し、出力を同フォルダに置くための **3 ペイン Next.js ワークスペース**。起動方法・画面構成・データ正本は [`readme.md`](readme.md) を参照。

## アーキテクチャ

- **状態の SSoT**: `components/workspace/Workspace.tsx`
- **Pane 1–3**: `FileTreePane`（ツリー CRUD・検索・DnD）, `EditorPane`（編集/プレビュー）, `AgentPane` / `AgentChatPane`（Agent チャット、フォルダ単位セッション）
- **Agent スタック**: `lib/agent/`
  - `agent-loop.ts`（turn ループ・ツール逐次実行・自動継続）
  - `tools/`（`registry.ts` / `fs-guard.ts` / `script-sandbox.ts` / `confirm-gate.ts` / `generate-write.ts` / `search-provider.ts`）
  - `llm/`（プロバイダ解決）
- **データ**: `workspace/<project>/`（ユーザーコンテンツ）, `workspace/.meta/`（`meta.json` / `sessions/` / `favorites.json` / `diagnostics.log`）
- **契約**: `contracts/`（`*-contract.md`）。スキル作者向けの制約と誓約は `contracts/ebex-skill-contract.md`
- **スキル**: 複ルートカタログ（ebex ルート＋ホストルートの `.claude/skills` 等）を和集合で解決。同 id はホスト優先

## 制約と誓約（EBEX 専用）

EBEX は軽量モデル＋作業フォルダ内に閉じた実行環境のため、通常のエージェント機能の一部を意図的に制限する。扱い方は block / fallback / gate / warn / cap / document のいずれかに統一する。**スキルを書く／直すときの正本は [`contracts/ebex-skill-contract.md`](contracts/ebex-skill-contract.md)**。スキルへ触れる編集は `creating-skills` スキルの作法（SSoT 監査・膨張禁止）で行い、制約の内容は再掲せず正本を参照させる。

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
npm run dev           # 開発サーバー（port 3001）
npm run build         # 本番ビルド
npm run lint          # ESLint
npm run test          # Vitest
npm run format        # Prettier（整形）
npm run format:check  # Prettier（チェックのみ）
```
