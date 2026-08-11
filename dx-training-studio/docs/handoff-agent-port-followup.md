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

[済] adopt-contents-plan-layout（2026-08-11）
       作業ファイルの置き場を contents-plan/ に新設（plans/ は追跡、runs/ は追跡外）。
       既存計画書2本を docs/training-plan/ から移設。
       スキル2本と agent 書込契約を追従。build green / ブラウザ実機確認済み

[次] retire-workspace-folder                                           ← ここ
       workspace/ と周辺コード（ino 台帳・folder-guard・favorites・
       workspace-folders API）を削除。ペイン4 のフォルダ選択 UI を撤去し、
       添付を「選択レッスンの contents.md + plans/ + 最新3 run」へ。
       書込境界から workspace/ を外す。session.json は現状維持

[後] contents-write-gate       contents/ 書込ゲート（Zod 検査・構造分類 A/B/C）+ ツール解禁
[後] connection-profiles       接続プロファイル（独立。会社持ち込みの直前で可）
```

**当初の「change 3: スキル適合 + workspace 運用」は分割された。** 探索の結果、
作業ファイルの置き場は `workspace/` ではなく `contents-plan/` に一本化する方針となり、
上記 3 本に分けた。決定の経緯は `adopt-contents-plan-layout` の `design.md`、
スキル側の影響は `handoff-dx-training-create.md` §1.1 を参照。

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

## 3. 課題 1【2026-08-11 更新】: 置き場の一本化と workspace 廃止

**当初案は破棄した。** 案件フォルダ（`workspace/<案件>/`）を作業ファイルの置き場にする計画だったが、
探索の結果**計画書の置き場は最初から `docs/training-plan/` に存在して動いていた**ことが判明し、
`workspace/` は不要と判断した。`workspace/` が `contents/` と別名前空間になることで
「ワークフォルダが二重」という問題そのものを生んでいた点も却下理由。

### 決定した配置

```
contents-plan/
├─ plans/<yyyymmdd>-<slug>.md          ← 計画書。git 追跡
└─ runs/<yyyymmdd>-<slug>/             ← create 1 実行分。git 追跡外
    ├─ design-note.md
    ├─ review-<レッスン名>.md
    └─ mandala.md
```

識別子は**フォルダ名が持ち、ファイル名は役割だけを表す**。この帰結として範囲別ファイル名と
同日再実行の連番規則が廃止された。セッション（`session.json`）は各フォルダのまま変更しない。

### 残っている作業

**`retire-workspace-folder`**（次）
- `workspace/` と周辺コード（`workspace-meta.ts` の ino 台帳・`project-folder-guard.ts`・
  `workspace-favorites*.ts`・`workspace-folders` API）を削除
- ペイン4 のフォルダ選択 UI を撤去。ファイル添付は残し、既定を
  「選択レッスンの `contents.md` + `contents-plan/plans/` + 最新 3 run」へ
- 書込境界から `workspace/` を外す（契約に暫定ルートとして明記済み）
- ⚠ **書込境界の実装が契約に追いついていない。** `adopt-contents-plan-layout` は
  ドキュメントとスキルのみを変更し、アプリコードに触っていない。そのため
  `contracts/agent-write-contract.md` は `contents-plan/` への書込を許可しているが、
  実装（`agent-file-tools` の解決ロジック・`project-folder-guard.ts`）はまだ
  `workspace/` + `contents/` のままで、**ペイン4 から `contents-plan/` へは書けない**。
  現時点で実害は無い（両スキルはペイン4 では動かさない前提）が、
  この change で実装を合わせること。関連 spec も `案件フォルダ` の用語を引きずっている:
  `agent-file-tools` / `agent-invoke-api` / `agent-chat-history` / `agent-tool-loop`

**`contents-write-gate`**（後）
- Zod スキーマ+ファイル名規約の検査を書込ツールに差し込み、不合格は recoverable エラー+guidance で自己修正させる。構造分類も同じ差し込み点で: A=同名レッスン既存→上書き確認（confirm-gate がそのまま働く）/ B=既存シリーズ・コースへの追加→非ブロックのワーニング / C=新シリーズ発生→ワーニング+既存 slug との近似照合（タイプミス由来の意図せぬ新規作成をモデルに自己修正させる）
- ツール解禁は frontmatter `tools:` の宣言制（実装は全部入っている。宣言 1 行で解禁）

スキル編集は `creating-skills` スキルの SSoT 作法で。制約の正本は `contracts/agent-write-contract.md` を参照させ再掲しない。

---

## 4. 課題 2: change 2「接続プロファイル」（会社持ち込み直前で可）

決定済みの骨子:

- 3 プロファイル: **private**（家・Anthropic 直・sonnet/opus）/ **development**（会社無償・gpt-5-nano 等・月 6M ゲートウェイ縛り）/ **enterprise**（会社有償・上位モデル・日次上限）
- 1 接続先 = 1 ファイル（`profiles/`）。モデル別 route・providerParams・モデルプロファイル値を同居。env 1 本で選択。**会社リポに private を置かない**
- ループ上限はモデル別のまま（プロファイル別に締めない。軽量モデルの途中停止対策で意図的に緩い）。予算はゲートウェイ任せで、アプリ内の累計トークン会計は実装しない
- LLM SDK は見合わせ。再訪トリガー: (a) 会社 PC で社内ルートのワイヤ形式を Azure OpenAI 純正と照合したとき (b) Gemini 対応で 3 つ目のワイヤ形式を書く前

---

## 5. 注意

- ⚠ `handoff-dx-training-create.md` にある「勝手にコミットが生まれる」事象（2026-08-06）に引き続き注意。作業前後に `git log` を確認。**2026-08-11 にも再発**（handoff の編集が `c17ce74` として自動コミットされた）
- dev サーバーは同一プロジェクトで 1 台まで（Next 16）。検証用サーバーを立てたら**必ず止める**（前セッションで放置→ EBUSY ロック→起動不能の事故があった。孤児 postcss ワーカーが `.next` を掴む）。既に 1 台動いている場合は起動せず、その URL に接続して検証する
- `workspace/` は git 追跡外。`workspace/.meta/`（meta.json / sessions / diagnostics.log）はランタイムが自動生成する。**`retire-workspace-folder` で丸ごと削除される**
- `contents-plan/runs/` は git 追跡外。`.gitignore` のパターンは**必ず anchored**（`/contents-plan/runs/`）。変更したら `.next` を削除する（Turbopack は `.gitignore` の変更を検知しない）
