# agent-file-tools Specification

## Purpose
TBD - created by archiving change port-ebex-agent-core. Update Purpose after archive.
## Requirements
### Requirement: ファイル操作ツール群

`lib/agent/tools/registry.ts` に EBEX と同一のツール群（`list_files` / `glob_files` / `search_content` / `read_file` / `write_file` / `copy_file` / `replace_in_file` / `replace_between` / `append_file` / `mkdir` / `inline_html_assets`）が登録されなければならない（SHALL）。モデルへ提示されるツールはスキル frontmatter の `tools:` 宣言（toolNames）で解決されたもののみでなければならない（SHALL）。未宣言ツールの実装が存在しても、モデルへ提示してはならない（MUST NOT）。

#### Scenario: 宣言済みツールのみ提示される
- **WHEN** スキルが `tools: [read_file, write_file]` を宣言して invoke される
- **THEN** LLM API へ渡る tools 定義は当該 2 種のみである

#### Scenario: 実装済み未宣言ツールは眠る
- **WHEN** どのスキルも `run_script` を宣言していない
- **THEN** `run_script` の実装は存在するが、いかなる invoke でもモデルへ提示されない

### Requirement: 書込 2 ルート境界

書込系ツールの書込先は「`contents-work/` 配下」または「`contents/` 配下」のいずれかに限定されなければならない(SHALL)。`workspace/` 配下への書込を許可してはならない（MUST NOT）。絶対パス・ドライブレター・`~` はエラー結果を返さなければならない（SHALL）。読取は従来どおりリポジトリ内および実行中スキルのディレクトリを許可してよい（MAY）。

明示プレフィックスのない相対パスは**フォーカス中のコンテンツフォルダ相対**として解決されなければならない（SHALL）。基準はフォーカス階層に従う: レッスンなら `contents/<シリーズ>/<コース>/<レッスン>/`、コースなら `contents/<シリーズ>/<コース>/`、シリーズなら `contents/<シリーズ>/`、フォーカスなしなら `contents/`。リポ直下（`data/` `app/` `lib/` `docs/` 等）へ到達してはならない（MUST NOT）。

`contents-work/` への書込は明示プレフィックス（`contents-work/...`）で行わなければならない（SHALL）——相対パスの基準ではない。

**正本ツリーでは、予約された名前のファイルだけを拒否する。** それ以外のファイルは階層を問わず書込を許可しなければならない（SHALL）。判定は**書込先パスのみ**で行い、ファイル内容を参照してはならない（MUST NOT）。

拒否しなければならない名前（SHALL）:

- `session.json` および `.meta.json` — アプリが管理する。agent が書くと安定 id や表示順が壊れる
- `contents.md` のうち、レッスン階層（`contents/<シリーズ>/<コース>/<レッスン>/`）**以外**に置かれるもの — 偽のレッスン本文になるため

**作業ファイルのルートでは、`contents-work/sessions/` 配下への書込を拒否しなければならない（SHALL）。** ここは agent 自身の会話履歴の保存先であり、agent が書くと実行中の会話が壊れる。判定は**ディレクトリ単位**で行わなければならない（SHALL）——ファイル名で判定すると、保存形式が変わったときに保護が漏れる。`contents-work/` のそれ以外の配下（`plans/` `runs/`）への書込は許可しなければならない（SHALL）。

ディレクトリ作成の深さによって書込を拒否してはならない（MUST NOT）——新しいシリーズ・コース・レッスンのフォルダを伴う書込は正当である。フォルダが新しく生まれる場合の実行前確認は `agent-confirm-gate` が規定する。

拒否時のエラーメッセージは、拒否の理由・代替（別名にするか `contents-work/` 配下へ書く）・拒否された実際のパスを含まなければならない（SHALL）。

frontmatter のスキーマ検査は本要件の範囲外である——アプリが読込時に lesson frontmatter を正規化するため、書込時に重ねて検査しない。

#### Scenario: レッスン本文への書込は許可される
- **WHEN** `write_file` が `contents/シリーズA/コースB/レッスンC/contents.md` を対象に実行される
- **THEN** 書込が実行される（確認ゲートの要件は agent-confirm-gate に従う）

#### Scenario: contents-work/ への書込は許可される
- **WHEN** `write_file` が `contents-work/runs/20260811-example/design-note.md` を対象に実行される
- **THEN** 書込が実行される

#### Scenario: 素の相対パスはフォーカス中のコンテンツフォルダへ解決される
- **WHEN** レッスンにフォーカスした状態で `write_file` が `contents.md` を対象に実行される
- **THEN** パスは `contents/<シリーズ>/<コース>/<レッスン>/contents.md` へ解決され、書込が実行される

#### Scenario: 素の相対パスはリポ直下へ届かない
- **WHEN** `write_file` が `data/workspace.json` を対象に実行される
- **THEN** パスはフォーカス中のコンテンツフォルダ配下へ解決され、リポ直下の `data/` には書き込まれない

#### Scenario: 予約名以外のファイルはどの階層でも許可される
- **WHEN** `write_file` が `contents/シリーズA/コースB/レッスンC/memo.md` を対象に実行される
- **THEN** 書込が実行される

#### Scenario: レッスン配下の任意のディレクトリへ書ける
- **WHEN** `write_file` が `contents/シリーズA/コースB/レッスンC/assets/diagram.svg` を対象に実行される
- **THEN** 書込が実行される

#### Scenario: レッスン階層以外の contents.md は拒否される
- **WHEN** `write_file` が `contents/シリーズA/コースB/contents.md` を対象に実行される
- **THEN** エラー結果が返り、置ける場所の案内が含まれる
- **AND** ファイルは作られない

#### Scenario: .meta.json への書込は拒否される
- **WHEN** `write_file` が `contents/シリーズA/コースB/.meta.json` を対象に実行される
- **THEN** エラー結果が返り、ファイルは書き換えられない

#### Scenario: session.json への書込は拒否される
- **WHEN** `write_file` が `contents/シリーズA/コースB/レッスンC/session.json` を対象に実行される
- **THEN** エラー結果が返り、ファイルは書き換えられない

#### Scenario: 会話履歴の保存先への書込は拒否される
- **WHEN** `write_file` が `contents-work/sessions/agent-chat.json` を対象に実行される
- **THEN** エラー結果が返り、ファイルは書き換えられない

#### Scenario: 会話履歴のディレクトリ配下は名前によらず拒否される
- **WHEN** `write_file` が `contents-work/sessions/any-other-name.json` を対象に実行される
- **THEN** エラー結果が返り、ファイルは作られない

#### Scenario: 新しいシリーズを伴うレッスン本文の書込は規約上は許可される
- **WHEN** `write_file` が、いずれの階層も未作成の `contents/新シリーズ/新コース/新レッスン/contents.md` を対象に実行される
- **THEN** パス規約による拒否は発生しない（実行前確認は agent-confirm-gate に従う）

#### Scenario: workspace/ への書込は拒否される
- **WHEN** `write_file` が `workspace/` 配下のパスを対象に実行される
- **THEN** エラー結果（recoverable）が tool_result として返る

#### Scenario: 絶対パスは拒否される
- **WHEN** ツール入力の path に絶対パスまたは `~` が指定される
- **THEN** エラー結果（recoverable）が tool_result として返り、エージェントは継続する

### Requirement: パス脱出の防止

ツール入力のパスは正規化され、`../` 等による境界外脱出を拒否しなければならない（SHALL）。

#### Scenario: 親ディレクトリ参照を拒否する
- **WHEN** ツール入力の path に `../../etc/hosts` が指定される
- **THEN** エラー結果が返り、ファイルアクセスは発生しない

