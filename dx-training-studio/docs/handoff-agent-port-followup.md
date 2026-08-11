# 引き継ぎ: EBEX agent 移植のフォローアップ（→ connection-profiles）

**やること**: UI 崩れの修正・`workspace/` の廃止・`contents/` 書込ゲートはすべて完了済み。**この系統に残っているのは接続プロファイル（`connection-profiles`）だけ**で、会社持ち込みの直前でよい。

本文書は `handoff-dx-training-create.md`（dx-training-create スキルの初回実行）とは別系統の引き継ぎ。**次の主線はそちら。** 本文書側で残る接点は、初回実行を観測したあとのツール解禁（frontmatter に `tools:` を 1 行）だけ（→ §7）。

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

[済] contents-write-gate       実装完了（2026-08-11）
       contents/ の書込を「予約名だけ拒否」に整理し、シリーズ・コース・
       レッスンのフォルダ作成に確認ダイアログを追加。ローダーが `_` `.` 始まりの
       ディレクトリを構造から除外。到達不能だった確認 kind を削除。
       テスト 764 green / build green / ブラウザ実機確認済み。詳細は §7
       ⚠ 当初案（Zod 検査・構造分類 A/B/C・近似照合）は**全部破棄**した

[後] connection-profiles       接続プロファイル（独立。会社持ち込みの直前で可）
```

**当初の「change 3: スキル適合 + workspace 運用」は分割された。** 探索の結果、
作業ファイルの置き場は `workspace/` ではなく `contents-plan/` に一本化する方針となり、
上記 3 本に分けた。決定の経緯は `adopt-contents-plan-layout` の `design.md`、
スキル側の影響は `handoff-dx-training-create.md` §1.1 を参照。

### 次のアクション

1. `handoff-dx-training-create.md` の**初回実行**（前提はすべて解消済み。ここが次の主線）
2. ペイン4 への**ツール解禁**。`dx-training-create` の frontmatter に `tools:` を 1 行足すだけ。初回実行を観測してからでよい（→ §7）
3. `connection-profiles`（独立。会社持ち込みの直前で可）

### リポジトリの状態

ブランチ `dx-training-studio2`。`retire-workspace-folder` までの成果物は `7112e1b` / `48be3f6` でコミット済み。`contents-write-gate` の成果物は未コミット（コミットは別ツールで手作業）。

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

## 3. 【完了】置き場の一本化と workspace 廃止

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

### 次: `contents-write-gate` → **完了（→ §7）**

`dx-training-create` との衝突は解消した。同スキルが `contents/<シリーズ>/<コース>/<レッスン>/` を
ディレクトリごと作る動作は、確認ダイアログを 1 枚挟んで通るようになった。

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

---

## 7. 【2026-08-11】contents-write-gate の実施記録

change artifacts は `openspec/changes/archive/2026-08-11-contents-write-gate/`。
本体 spec への同期は 4 capability 分を手作業で実施済み（MODIFIED 3 / ADDED 2）。

```
着手前:  737 passed / 6 skipped （97 files）
完了時:  764 passed / 6 skipped （97 files）  +27
型:      tsc --noEmit のアプリ側エラーはゼロ（テスト側の既存 8 件は着手前から）
lint:    16 errors（着手前と同数。新規ゼロ）
build:   green / ブラウザ実機確認済み
```

### 決まった規約

**contents/ ではファイルは階層を問わず自由に置ける。予約名だけ拒否する。**

| 対象 | 判定 |
|---|---|
| `session.json` / `.meta.json` | **拒否**（アプリが管理。id・表示順が壊れる） |
| `contents.md`（レッスン階層） | 許可（レッスン本文の着地） |
| `contents.md`（それ以外の階層） | **拒否**（偽の本文になる） |
| その他のファイル（どの階層でも） | 許可 |
| 新シリーズ・新コース・新レッスンのフォルダ | 許可。ただし**実行前に確認ダイアログ** |
| レッスンより深いフォルダ | 許可（確認なし。構造を作らない） |
| `_` `.` 始まりのフォルダ | 許可（確認なし。ローダーが構造として解釈しない） |

### ⚠ 当初案は全部破棄した

**「Zod スキーマ検査 + 構造分類 A/B/C + 近似照合」は一つも実装していない。** 再提案しないこと。

- **Zod 検査**: アプリが読込・同期のたびに frontmatter を正規化する
  （`Workspace.tsx:82` / `use-content-sync.ts:87` の `normalizeAllLessonsInSeries`）ので二重になる。
  加えて内容検査は書込ツールごとに見えるものが違い（append は追記分だけ、mkdir は内容なし）、
  正しくやるには共有の書込コミット関数を新設して 9 箇所を通す必要があった
- **構造分類 A/B/C・近似照合**: 確認ダイアログにシリーズ名が原文で出るので、
  打ち間違いはユーザーが読んで気づける。機能まるごと不要になった
- **`recoverable` フラグの配線**: コード上どこからも読まれていない
  （モデルが tool_result の JSON をテキストで読むだけ）。エラー文字列を良くするだけで済んだ

### 実装中に方針転換した点（重要）

**最初は「`contents/<S>/<C>/<L>/contents.md` のみ許可」で実装し、全テストで 40 件が落ちた。**
内訳は `write_file` / `copy_file` / `replace_in_file` / `replace_between` / `append_file` /
`generate_and_write` / `inline_html_assets` / 額縁退避 / `run_script` の `writes` 宣言
——**ファイル系ツール一式が正本ツリーで使えなくなっていた**。

守りたかったのは「フォルダがシリーズ・コース・レッスンと混同されないこと」であって、
ファイルの自由を奪うことではなかった。**混同はフォルダ側（確認ゲート + ローダー除外）で解ける。**
ユーザー判断で上表の形に緩め、40 件はそのまま green に戻った。

### 実装で判明した事実

- **書込ゲートにはテストが 1 本も無かった。** 旧 `checkContentsWriteShape` は `forWrite` 経路も
  含めて未カバーで、そのせいで `mkdir contents/<新S>` が素通りする穴に誰も気づいていなかった
  （深さの数え方が「末尾はファイル名」前提で、`mkdir` では 1 段ずれる）。今回テストを付けた
- **`OutsideProjectPathDialog` は生きていた。** 引き継ぎでは「死んだ確認 kind の道連れで削除」と
  見込んでいたが、実際は確認 kind と無関係の機能で、**送信前にユーザーの入力文から
  プロジェクト外を指すパス表記を検出して警告する**（`findOutsideProjectPathHints` 駆動・専用テストあり）。
  削除していない。死んでいたのは `ToolConfirmInlineCard` の 2 ケースと kind 定義だけ
- **ローダーはディレクトリ名を一切見ていなかった**（`isDirectory()` のみ）。`_work` は
  フォーカスが「シリーズ」「contents 直下」のとき幻のコース・幻のシリーズになる。
  `.meta.json` の `order` に残った名前も同じフィルタで弾くようにした
- **退避機能（`resolveFramedWriteTarget`）は無変更。** 退避先は「モデルが推測できる決まった場所」で
  なければならず、`contents-plan/runs/<run>/` へ向けようにも**「現在の run」はスキル側の
  約束事でホストは知らない**ため計算できない

### 未実施として残したこと

- **ツール解禁はしていない。** 現在どのスキルもファイル書込ツールを宣言していない
  （`general-chat` / `create-draft` は社内コンテキスト検索のみ）＝ペイン4 から `contents/` へ書く
  経路は現時点でゼロ。本 change は先回りの防御。解禁は初回実行を観測してから `tools:` を 1 行
- **確認カードは実機ではなくレンダリングテストで検証した**（上記のとおり発火経路が無いため）
- **退避機能が `contents-plan/` を保護していない。** `toProjectRelative` がフォーカス中の
  `contents/` 配下しか見ないため、額縁テンプレートが実際に置かれる `contents-plan/runs/` では
  発火しない。守る先と実際の置き場がずれているが、必要な形は分割出力を実際に使ってからでないと
  決まらないので触っていない
- `content-folder-loader` spec の前半に**旧設計の記述が残っている**（`_series-order.json` /
  `_course.json` / 数値プレフィックス）。実装は `.meta.json` の `order` で動いており乖離している。
  本 change の範囲外として触っていない
