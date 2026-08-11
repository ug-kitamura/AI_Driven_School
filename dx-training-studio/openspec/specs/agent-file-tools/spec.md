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

書込系ツールの書込先は「`contents-plan/` 配下」または「`contents/` 配下」のいずれかに限定されなければならない(SHALL)。`workspace/` 配下への書込を許可してはならない（MUST NOT）。絶対パス・ドライブレター・`~` はエラー結果を返さなければならない（SHALL）。読取は従来どおりリポジトリ内および実行中スキルのディレクトリを許可してよい（MAY）。

明示プレフィックスのない相対パスは**フォーカス中のコンテンツフォルダ相対**として解決されなければならない（SHALL）。基準はフォーカス階層に従う: レッスンなら `contents/<シリーズ>/<コース>/<レッスン>/`、コースなら `contents/<シリーズ>/<コース>/`、シリーズなら `contents/<シリーズ>/`、フォーカスなしなら `contents/`。リポ直下（`data/` `app/` `lib/` `docs/` 等）へ到達してはならない（MUST NOT）。

`contents-plan/` への書込は明示プレフィックス（`contents-plan/...`）で行わなければならない（SHALL）——相対パスの基準ではない。

**正本ツリーの構造を壊さない。** `contents/` 配下に置いてよい成果物は**レッスン本文（`<レッスン名>/contents.md`）のみ**である。書込系ツールは、`contents/` 配下に新しいディレクトリを作る書込を、**フォーカス中のコースの直下にレッスンフォルダを作る場合を除いて**拒否しなければならない（SHALL）。

これはシリーズ階層および `contents/` 直下でとくに重要である。ローダーはそれらの階層のディレクトリを無条件にコース・シリーズとして解釈するため、中間生成物のディレクトリがそのまま**幻のコース・幻のシリーズ**として画面に現れ、`.meta.json` まで書き込まれる。中間生成物は `contents-plan/` へ置く。

なお frontmatter・ファイル名規約のスキーマ検査と構造分類（上書き確認・新シリーズの近似照合）は本要件の範囲外であり、後続 change `contents-write-gate` が担う。

#### Scenario: contents/ への書込は許可される
- **WHEN** `write_file` が `contents/series-a/course-b/lesson-c.md` を対象に実行される
- **THEN** 書込が実行される（確認ゲートの要件は agent-confirm-gate に従う）

#### Scenario: contents-plan/ への書込は許可される
- **WHEN** `write_file` が `contents-plan/runs/20260811-example/design-note.md` を対象に実行される
- **THEN** 書込が実行される

#### Scenario: 素の相対パスはフォーカス中のコンテンツフォルダへ解決される
- **WHEN** レッスンにフォーカスした状態で `write_file` が `contents.md` を対象に実行される
- **THEN** パスは `contents/<シリーズ>/<コース>/<レッスン>/contents.md` へ解決される

#### Scenario: 素の相対パスはリポ直下へ届かない
- **WHEN** `write_file` が `data/workspace.json` を対象に実行される
- **THEN** パスはフォーカス中のコンテンツフォルダ配下へ解決され、リポ直下の `data/` には書き込まれない

#### Scenario: シリーズ階層で新しいディレクトリを作れない
- **WHEN** シリーズにフォーカスした状態で `write_file` が `メモ/note.md` を対象に実行される
- **THEN** エラー結果（recoverable）が返り、中間生成物は `contents-plan/` へ置くよう案内される
- **AND** `contents/<シリーズ>/メモ/` は作られない

#### Scenario: コース直下のレッスンフォルダ作成は許可される
- **WHEN** コースにフォーカスした状態で `write_file` が `新しいレッスン/contents.md` を対象に実行される
- **THEN** 書込が実行される

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

