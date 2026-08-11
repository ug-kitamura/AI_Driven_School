# 引き継ぎ: EBEX agent 移植のフォローアップ（→ contents-write-gate → connection-profiles）

**やること**: UI 崩れの修正と `workspace/` の廃止は完了済み。次は `contents/` 書込ゲート（`contents-write-gate`）、最後に接続プロファイル（`connection-profiles`）へ進む。

本文書は `handoff-dx-training-create.md`（dx-training-create スキルの初回実行）とは別系統の引き継ぎ。**同スキルの初回実行を塞いでいた前提（置き場の移設）は解消済みなので、そちらは本文書の完了を待たずに着手できる。** 合流点は `contents-write-gate` のツール解禁（→ §3）。

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

[済] retire-workspace-folder    実装完了（2026-08-11）
       `workspace/` とその周辺コードを全削除。セッションは contents/ 配下の
       スコープ別 session.json へ。選択モデルにシリーズを追加し、書込境界を
       contents-plan/ + contents/ の 2 ルートへ。ペイン4 のフォルダ選択 UI を撤去。
       テスト 737 green / build green / ブラウザ実機確認済み。詳細は §6

[後] contents-write-gate       contents/ 書込ゲート（Zod 検査・構造分類 A/B/C）+ ツール解禁
[後] connection-profiles       接続プロファイル（独立。会社持ち込みの直前で可）
```

**当初の「change 3: スキル適合 + workspace 運用」は分割された。** 探索の結果、
作業ファイルの置き場は `workspace/` ではなく `contents-plan/` に一本化する方針となり、
上記 3 本に分けた。決定の経緯は `adopt-contents-plan-layout` の `design.md`、
スキル側の影響は `handoff-dx-training-create.md` §1.1 を参照。

### 次のアクション

1. **コミットする。** `retire-workspace-folder` の成果物 **89 パスが未コミット**（変更 55 / 削除 19 / 追加 3 / リネーム 1 / ステージ済み 8 / 未追跡 3）。Git 操作は別ツールで実施。`git log` の先頭は `b210b7b` のままで、実装セッション中に勝手なコミットは発生していない
2. `contents-write-gate` に着手する（→ §3）。差し込み点は用意済み
3. `handoff-dx-training-create.md` の初回実行は**本文書と独立に着手できる**（前提の移設は完了済み）

### リポジトリの状態

ブランチ `dx-training-studio2`。`adopt-contents-plan-layout` までの成果物はコミット済み（`retire-workspace-folder` のグループ2 の 4 ファイルだけ自動コミット `b210b7b` に混入している）。残りは全て未コミット。

⚠ **`openspec/changes/` は `.gitignore:31` で追跡外。** アーカイブした change artifacts（判断メモを書き込んだ `tasks.md` を含む）は**このマシンにしか存在しない**。他環境へ渡すなら git 以外の手段が要る。**コミットされる設計の記録は `openspec/specs/` だけ。**

### 参照すべき正本

| 何 | どこ |
|---|---|
| 移植の決定ロック・実装状況 | メモリ `project-dx-agent-port`（Claude のセッション間メモリ） |
| UI 崩れの機構・復旧手順 | メモリ `project-tailwind-gitignore-trap`（Claude のセッション間メモリ） |
| 移植の change artifacts | `openspec/changes/archive/2026-08-10-port-ebex-agent-core/` |
| 置き場再設計の change artifacts | `openspec/changes/archive/2026-08-11-adopt-contents-plan-layout/` |
| workspace 廃止の change artifacts | `openspec/changes/archive/2026-08-11-retire-workspace-folder/` |
| dx 化の差分台帳（EBEX から意図的に変えた 8 点） | 移植 change の `design.md` D1 の表 |
| agent の書込制約の正本 | `contracts/agent-write-contract.md` |
| 要件の正本（唯一コミットされる） | `openspec/specs/`（2026-08-11 時点で 54 capability） |

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

## 3. 【完了】置き場の一本化と workspace 廃止 → 次は contents-write-gate

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

### `retire-workspace-folder`（完了 2026-08-11・詳細は §6）

`workspace/` と周辺コードを全削除し、書込境界を契約に一致させた。相対パスの基準は
**フォーカス中のコンテンツフォルダ**（EBEX 移植前の dx の挙動へ回帰）。
設計の根拠は change の `design.md` D4b / D4c。

### 次: `contents-write-gate`

**差し込み点はすでに用意されている。** `checkContentsWriteShape`（`lib/agent/tools/fs-guard.ts`）が
`writePathOptions(context)` の `forWrite: true` 経由で全書込サイトから呼ばれている。
今は構造の防御だけなので、**同じ関数の隣にスキーマ検査と構造分類を足す**形になる。

- Zod スキーマ + ファイル名規約の検査を書込ツールに差し込み、不合格は recoverable エラー + guidance で自己修正させる。構造分類も同じ差し込み点で: **A**=同名レッスン既存→上書き確認（confirm-gate がそのまま働く）/ **B**=既存シリーズ・コースへの追加→非ブロックのワーニング / **C**=新シリーズ発生→ワーニング + 既存 slug との近似照合（タイプミス由来の意図せぬ新規作成をモデルに自己修正させる）
- ツール解禁は frontmatter `tools:` の宣言制（実装は全部入っている。宣言 1 行で解禁）

**この change で一緒に片付けるとよいもの:**

- **到達不能になった確認 kind の掃除。** `outside-project-read` / `outside-project-write` は 2 ルート化で
  死んだ（→ §6）。`confirm-kind.ts` / `ToolConfirmInlineCard.tsx` / `OutsideProjectPathDialog.tsx` が
  対象。確認 kind を触るこの change で落とすのが自然
- ⚠ **ツール解禁と `dx-training-create` の衝突を先に確認すること。** 同スキルは
  `contents/<シリーズ>/<コース>/<レッスン>/` を**ディレクトリごと作る**が、`checkContentsWriteShape` は
  新シリーズ・新コースになるディレクトリ作成を拒否する。現状は同スキルが `tools:` 未宣言で
  ペイン4 から書けないため衝突していないだけ。**解禁する前に、新シリーズ・新コースの作成経路を
  どう通すか（構造分類 C の警告で通すのか、ペイン1 の UI 操作に委ねるのか）を決める。**
  詳細は `handoff-dx-training-create.md` §1.2

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

- ⚠ `handoff-dx-training-create.md` にある「勝手にコミットが生まれる」事象（2026-08-06）に引き続き注意。作業前後に `git log` を確認。**2026-08-11 に 2 回再発**（`c17ce74`=handoff の編集、`b210b7b`=retire-workspace-folder のグループ2 の 4 ファイル）。**作業途中でも勝手にコミットされうる前提で、区切りごとに `git log` を見ること**
- dev サーバーは同一プロジェクトで 1 台まで（Next 16）。検証用サーバーを立てたら**必ず止める**（前セッションで放置→ EBUSY ロック→起動不能の事故があった。孤児 postcss ワーカーが `.next` を掴む）。既に 1 台動いている場合は起動せず、その URL に接続して検証する
- `workspace/` は削除済み（2026-08-11）。`.gitignore` の該当3行も落とし、`.next` も削除済み
- `contents-plan/runs/` と `openspec/changes/` は git 追跡外。`.gitignore` のパターンは**必ず anchored**（`/contents-plan/runs/`）。変更したら `.next` を削除する（Turbopack は `.gitignore` の変更を検知しない）
- **CRLF + BOM のファイルがある**（`__tests__/hooks/*.test.ts` 等）。LF 前提の文字列置換が黙って空振りするので、複数行の編集は Edit ツールを使う

---

## 6. 【2026-08-11】retire-workspace-folder の実施記録

**57/57 タスク完了。** change artifacts は
`openspec/changes/archive/2026-08-11-retire-workspace-folder/`（proposal / design / specs 7本 / tasks）。
タスクごとの判断メモは `tasks.md` に残してある（**追跡外なのでこのマシンのみ**）。
本体 spec への同期は 7 capability 分を手作業で実施済み（MODIFIED 9 / RENAMED 2 / ADDED 1）。

```
着手前:  717 passed （97 files）
完了時:  737 passed / 6 skipped （97 files）
         削除したテスト 17 本を差し引いた 700 相当に対し +37
型:      tsc --noEmit のアプリ側エラーはゼロ
build:   green / ブラウザ実機確認済み
```

### 何が変わったか

| 層 | before | after |
|---|---|---|
| セッションの保存先 | `workspace/.meta/sessions/<ino>.json` | `contents/<フォーカス階層>/session.json` |
| 選択モデル | `{courseId, lessonId}` | `{seriesId, courseId, lessonId}`（判別フィールドは持たない） |
| 相対パスの基準 | 案件フォルダ `workspace/<案件>/` | フォーカス中のコンテンツフォルダ |
| 書込ルート | `workspace/` + `contents/` | `contents-plan/` + `contents/` |
| ペイン4 | フォルダ選択ツリー + 作成ダイアログ | 撤去（スコープはペイン1〜3 のフォーカスが決める） |
| 添付候補 | 案件フォルダ内の全ファイル | レッスン本文 + `contents-plan/plans/` + 最新 3 run |

### 実装で確定したこと（再検討不要）

- **作業フォルダ = フォーカス中のコンテンツフォルダ。** 相対パスの基準もセッションの
  保存先も同じスコープ。ペイン4 にスコープが 2 つ並ばない
- `contents-plan/` は書込許可ルートだが**相対パスの基準ではない**。明示プレフィックスで書く
- `projectFolderId` → `workScopeKey` に改名済み
- 構造の防御は `checkContentsWriteShape`。**幻のシリーズ・幻のコースになる 2 箇所だけ**を拒否。
  「contents/ に置いてよいのはレッスン本文だけ」という方針は `contents-write-gate` の担当
- **`outside-project-read` / `outside-project-write` の確認 kind は到達不能になった。**
  2 ルート化により、ルート外のパスは確認ではなくパスガードのエラーで止まる。
  防御として分岐は残してあるが、`ToolConfirmInlineCard` の該当ケースは死んでいる。
  `contents-write-gate` で確認 kind を整理するときに落とすとよい

### テスト付け替えで見つかった実装の穴（3 件、修正済み）

旧世界を前提にした期待値を直す過程で、**テストが赤いままだったら気づかなかった実バグ**が出た。

1. `projectDirAbsolute`（スクリプトサンドボックスの cwd）が `workspace/<案件>` のままで、
   存在しない cwd により **run_script が全滅**していた（「不明なエラー」で失敗）
2. サンドボックスの書込許可が 1 ルートだけで、`writes` に宣言できる `contents-plan/` へ
   **実際には書けなかった** → `extraWriteDirsAbsolute` で 2 ルートへ
3. 発見ツール（glob / search）の照合基準が `contents/` ルートになっており、
   モデルが書く作業フォルダ相対のパターン（`output/*.html`）が**外れていた**

### 削除したもの

`lib/workspace-{meta,paths,path-utils,loader,mutations,constants,folder-text-excerpts,favorites,favorites-io,tree}.ts`
/ `lib/rename-diagnostics.ts` / `lib/agent/{project-folder-guard,active-project-folders,generate-folder-name,workspace-file-attachments}.ts`
/ `app/api/agent/workspace-folders/` / `workspace/` ディレクトリ / `.gitignore` の該当 3 行。

**残した `workspace-*` は UI・設定系**（`workspace-file-icon` / `workspace-selection` /
`workspace-settings` / `workspace-tree-path` / `workspace-unique-name`）。名前ではなく参照で判定した。

### 踏んだ事故（同じ手順を繰り返さない）

- `git checkout -- __tests__/lib/agent/tools/` を広く当て、書き直し済みの
  fs-guard 2 ファイルを巻き戻した。**テストの一括復元は範囲を絞ること**
- import 挿入の正規表現が既存の複数行 import 群を食い、13 ファイルが収集エラーになった。
  `describe is not defined` が出たら import 位置を疑う
- node のワンライナーでテンプレートリテラルを含む置換をするとクォートが壊れる。
  複数行・バッククォートを含む編集は Edit ツールを使う。
  **CRLF + BOM のファイル（`__tests__/hooks/*.test.ts` 等）は LF 前提の文字列置換が
  黙って空振りする**
- `.next` を消すと、動いている dev サーバーの HMR が中途半端な DOM を返す
  （ペイン1 が丸ごと消えて見えた）。**ハードリロードで直る。サーバーの再起動は不要**

### アーカイブ手順の注意

**`openspec archive` は使えない。** delta を spec へ再適用しようとするため、タスク 10.2 で
手作業同期した本 change では RENAMED の元見出しが見つからず中断する
（`agent-chat-history RENAMED failed ... source not found` → `Aborted. No files were changed.`）。
`adopt-contents-plan-layout` と同じく**ディレクトリ移動でアーカイブした**。
手作業同期を伴う change では今後もこの手順になる。

### 未実施として残したこと

- **コースを持たないシリーズの空状態文言**は実機で見ていない。`contents/` に該当する
  シリーズが無く、検証のためだけに正本ツリーへシリーズを作るのは避けた。
  文言分岐は `!course` / `!lesson` の単純条件
- **テスト側の型エラーが 8 件残っている**が、**すべて本 change 以前からのもの**
  （`estimatedMinutes` の綴り違い・`use-image-lists` の型・invoke route test の implicit any 等）。
  `npm run test` は 737 green、`tsc --noEmit` のアプリ側はゼロ。直すなら独立した掃除として
