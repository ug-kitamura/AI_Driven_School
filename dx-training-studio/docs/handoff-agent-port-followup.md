# 引き継ぎ: EBEX agent 移植のフォローアップ（UI 崩れ修正済み → change 3 → change 2）

**やること**: UI 崩れの修正は完了済み。次はスキル適合（change 3）、最後に接続プロファイル（change 2）へ進む。

本文書は `handoff-dx-training-create.md`（dx-training-create スキルの初回実行）とは別系統の引き継ぎ。同スキルの模範解答づくりは change 3 の後に合流する。

---

## 1. 現在地

```
[済] port-ebex-agent-core          実装完了・アーカイブ済み・コミット済み
       EBEX の agent スタック（ループ・16 ツール・確認ゲート・
       サンドボックス・フォルダ単位セッション）を lib/agent へ逐語移植。
       テスト 717 green / build green / dev サーバー実機確認済み
       移植元: ebex@0aca84a（proposal 末尾に記録）
       archive: openspec/changes/archive/2026-08-10-port-ebex-agent-core/
       本体 spec へ同期済み（+25 要件 / ~4 修正。agent-* 新 capability 11 本）

[済] UI 崩れの修正（2026-08-10 解決）
       真因は .gitignore の非 anchored `workspace/` パターンが
       `components/workspace/` を Tailwind のソース走査から丸ごと除外
       していたこと（詳細は §2）

[次] change 3: スキル適合 + workspace 運用（propose から）             ← ここ
[後] change 2: 接続プロファイル（会社持ち込みの直前で可）
```

### リポジトリの状態

ブランチ `dx-training-studio2`。移植の成果物・UI 崩れ修正ともコミット済み（Git 操作は別ツールで実施）。作業ツリーはクリーン。

### 参照すべき正本

| 何 | どこ |
|---|---|
| 移植の決定ロック・実装状況 | メモリ `project-dx-agent-port`（Claude のセッション間メモリ） |
| UI 崩れの機構・復旧手順 | メモリ `project-tailwind-gitignore-trap`（Claude のセッション間メモリ） |
| change artifacts（proposal / design / specs / tasks） | `openspec/changes/port-ebex-agent-core/` |
| dx 化の差分台帳（EBEX から意図的に変えた 8 点） | 同 `design.md` D1 の表 |
| agent の書込制約の正本 | `contracts/agent-write-contract.md` |

---

## 2. 【解決済み】課題1だったもの: UI 崩れの修正

### 症状（ユーザー報告）

1. アイコンが大きくなる箇所がある
2. ペインの横幅が調整できない

### 真因

`.gitignore` の `images/` `local-db/`（先頭スラッシュ無し）が、git のパターン規則により**任意の深さの同名ディレクトリ**にマッチしていた。特に旧 `workspace/` 行（後述の対応で anchored 化済み）が `components/workspace/` を巻き込み、Tailwind v4 のソース走査が `.gitignore` を尊重する（追跡状態は見ない）ため、dx の UI 実装がほぼ全てそこにある `components/workspace/**` が丸ごと走査対象外になっていた。EBEX コンポーネントの className や CSS トークン不足は無関係だった（`app/globals.css` は移植前とバイト単位で同一だった）。

症状は歯抜けで出る（`size-4` は残るが `size-3` `size-3.5` は消える、`cursor-col-resize` だけ効かない等）。明示 `@source` でも `.gitignore` の除外は上書きできず、**Turbopack は `.gitignore` の変更を検知しないため `.gitignore` を直しても `.next` を消さないと直らない**。詳細はメモリ `project-tailwind-gitignore-trap` 参照。

### 実施した修正

| ファイル | 変更 |
|---|---|
| `.gitignore` | `images/` `local-db/` → `/images/` `/local-db/`（anchored 化。`app/api/images/` 配下 10 ファイルが誤って追跡外になっていた実害も解消） |
| `app/globals.css` | `@theme inline` に `--color-status-done` / `-wip` / `-draft` を配線（dx の `--status-*` を Tailwind ユーティリティ化） |
| `components/workspace/LessonMetaPanel.tsx` | v3 記法 `text-[--status-*]`（無効化していた）→ `text-status-*`、`h-3.5 w-3.5` → `size-3.5` |
| `components/workspace/AgentChatPane.tsx` | EBEX 由来 `text-success`（dx に無いトークン）→ dx の `text-status-done`（同色 `#00884A`）。EBEX の広ペイン前提だった `px-12` → dx のペインリズムに合わせ `px-3` |
| `tmp-tailwind-test.css` | 削除（追跡済みだった 160KB のビルド残骸、参照ゼロ） |

`violet-*` の色番号直書き（`AgentChatInput.tsx` 等、EBEX 由来のスキルアクセント色）は指示によりそのまま維持。

### 検証済み

- `npm run test`: **717 passed**
- `npm run lint`: 16 errors（既存の `setState-in-effect`、新規ゼロ）
- ブラウザ実機で `text-status-done/wip/draft` の計算色、リサイズハンドルの `cursor: col-resize` / `z-index: 30` を確認

---

## 3. 課題 1: change 3「スキル適合 + workspace 運用」（次はここから）

`/opsx:propose` から。決定済みの内容（詳細はメモリ project-dx-agent-port）:

- **dx-training-plan**: 案件フォルダの新規作成（自動命名 `{yyyymmdd}-{テーマslug}`、EBEX の `generate-folder-name` を流用）+ 出力を `workspace/<案件>/training-plan.md` へ
- **dx-training-create**: 案件フォルダ選択で入力（training-plan.md）を解決。レッスン草稿は `contents/` へ直接着地（ユーザーがペイン3 で作り込む）、メモ・レビュー等の付随文書は案件フォルダへ
- **contents/ 書込ゲート**: Zod スキーマ+ファイル名規約の検査を書込ツールに差し込み、不合格は recoverable エラー+guidance で自己修正させる。構造分類も同じ差し込み点で: A=同名レッスン既存→上書き確認（confirm-gate がそのまま働く）/ B=既存シリーズ・コースへの追加→非ブロックのワーニング / C=新シリーズ発生→ワーニング+既存 slug との近似照合（タイプミス由来の意図せぬ新規作成をモデルに自己修正させる）
- スキル編集は `creating-skills` スキルの SSoT 作法で。制約の正本は `contracts/agent-write-contract.md` を参照させ再掲しない
- ツール解禁は frontmatter `tools:` の宣言制（実装は全部入っている。宣言 1 行で解禁）

---

## 4. 課題 2: change 2「接続プロファイル」（会社持ち込み直前で可）

決定済みの骨子:

- 3 プロファイル: **private**（家・Anthropic 直・sonnet/opus）/ **development**（会社無償・gpt-5-nano 等・月 6M ゲートウェイ縛り）/ **enterprise**（会社有償・上位モデル・日次上限）
- 1 接続先 = 1 ファイル（`profiles/`）。モデル別 route・providerParams・モデルプロファイル値を同居。env 1 本で選択。**会社リポに private を置かない**
- ループ上限はモデル別のまま（プロファイル別に締めない。軽量モデルの途中停止対策で意図的に緩い）。予算はゲートウェイ任せで、アプリ内の累計トークン会計は実装しない
- LLM SDK は見合わせ。再訪トリガー: (a) 会社 PC で社内ルートのワイヤ形式を Azure OpenAI 純正と照合したとき (b) Gemini 対応で 3 つ目のワイヤ形式を書く前

---

## 5. 注意

- ⚠ `handoff-dx-training-create.md` にある「勝手にコミットが生まれる」事象（2026-08-06）に引き続き注意。作業前後に `git log` を確認
- dev サーバーは同一プロジェクトで 1 台まで（Next 16）。検証用サーバーを立てたら**必ず止める**（前セッションで放置→ EBUSY ロック→起動不能の事故があった。孤児 postcss ワーカーが `.next` を掴む）
- `workspace/` は git 追跡外。`workspace/.meta/`（meta.json / sessions / diagnostics.log）はランタイムが自動生成する
