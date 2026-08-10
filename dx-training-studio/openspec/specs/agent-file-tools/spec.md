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

書込系ツールの書込先は「現在の案件フォルダ（`workspace/<folder>/` 配下）」または「`contents/` 配下」のいずれかに限定されなければならない(SHALL)。`contents/` 前置のないの相対パスは案件フォルダ相対として解決され、リポ直下（`data/` `app/` `lib/` 等）へ到達してはならない（MUST NOT）。絶対パス・ドライブレター・`~` はエラー結果を返さなければならない（SHALL）。読取は従来どおりリポジトリ内および実行中スキルのディレクトリを許可してよい（MAY）。

#### Scenario: contents/ への書込は許可される
- **WHEN** `write_file` が `contents/series-a/course-b/lesson-c.md` を対象に実行される
- **THEN** 書込が実行される（確認ゲートの要件は agent-confirm-gate に従う）

#### Scenario: 案件フォルダへの書込は許可される
- **WHEN** `write_file` が現在の案件フォルダ内のパスを対象に実行される
- **THEN** 書込が実行される

#### Scenario: 素の相対パスはリポ直下へ届かない
- **WHEN** `write_file` が `data/workspace.json` を対象に実行される
- **THEN** パスは案件フォルダ配下（`workspace/<folder>/data/workspace.json`）へ解決され、リポ直下の `data/` には書き込まれない

#### Scenario: 絶対パスは拒否される
- **WHEN** ツール入力の path に絶対パスまたは `~` が指定される
- **THEN** エラー結果（recoverable）が tool_result として返り、エージェントは継続する

### Requirement: パス脱出の防止

ツール入力のパスは正規化され、`../` 等による境界外脱出を拒否しなければならない（SHALL）。

#### Scenario: 親ディレクトリ参照を拒否する
- **WHEN** ツール入力の path に `../../etc/hosts` が指定される
- **THEN** エラー結果が返り、ファイルアクセスは発生しない

