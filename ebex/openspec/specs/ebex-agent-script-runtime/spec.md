# ebex-agent-script-runtime Specification

## Purpose
TBD - created by archiving change ebex-agent-script-runtime. Update Purpose after archive.
## Requirements
### Requirement: サンドボックス実行基盤

システムはスクリプトを Node 子プロセスとして実行し、Node Permission Model により fs 読取を「プロジェクトフォルダ・実行中スキルディレクトリ・スクリプト自身」に、fs 書込を「プロジェクトフォルダ内」に制限しなければならない（MUST）。実行は `cwd` をプロジェクトフォルダに固定し、タイムアウトと stdout/stderr のサイズ上限を設けなければならない（MUST）。

#### Scenario: プロジェクト外への書込はプロセスレベルで失敗する

- **WHEN** 実行されたスクリプトがプロジェクトフォルダ外のパス（絶対パスや `..` 経由）へ書き込もうとする
- **THEN** Permission Model により書込は拒否され、スクリプトはエラーで終了し、tool_result にエラーが返る

#### Scenario: スキルディレクトリは読めるが書けない

- **WHEN** スクリプトが実行中スキルの `references/base.html` を読み取り、プロジェクト内の `output/x.html` へ書き込む
- **THEN** 読取・書込とも成功する

#### Scenario: タイムアウトで打ち切られる

- **WHEN** スクリプトが制限時間を超えて実行し続ける
- **THEN** 子プロセスは強制終了され、タイムアウトした旨のエラーが tool_result で返る

#### Scenario: 子プロセスの再帰起動はできない

- **WHEN** スクリプトが `child_process` で別プロセスを起動しようとする
- **THEN** Permission Model により拒否され、スクリプトはエラーで終了する

#### Scenario: 非対応 Node 環境の明確なエラー

- **WHEN** 実行環境の Node が Permission Model のフラグを受理しない
- **THEN** スクリプトは実行されず、Node のバージョン要件を満たさない旨のエラーが返る

### Requirement: run_script ツール

システムは `run_script` ツールを提供しなければならない（MUST）。入力はスクリプト本文 `code`（CommonJS）、目的説明 `purpose`、書き込み予定パスの配列 `writes` とする。成果物の本文はモデルの出力トークンに載せず、スクリプトの実行によってディスクへ書き出すための経路である。tool_result には成果物の本文を含めてはならず（MUST NOT）、書込パス・stdout の要約・実行時間などの要約のみを返さなければならない（SHALL）。

#### Scenario: Markdown とテンプレートから HTML を組み立てる

- **WHEN** モデルが「プロジェクト内の md を読み、スキルの base.html / style.css と組み合わせて output/x.html を書く」スクリプトを `run_script` で実行し、ユーザーが確認を許可する
- **THEN** HTML はスクリプト実行でディスクに書かれ、tool_result には path / bytes / stdout 要約のみが返る

#### Scenario: code 欠落は壊れた tool_use として扱う

- **WHEN** `run_script` の `code` が欠落または空で呼び出される
- **THEN** 実行されず、復旧可能なエラーと案内が tool_result でモデルへ返り、loop は継続する

#### Scenario: 実行成功した writes は上書き再確認をスキップする

- **WHEN** `run_script` が宣言した `writes` のファイルを書き込み成功し、その後同じパスへ書込系ツールが実行される
- **THEN** 同一セッション内では上書き確認は再度要求されない

### Requirement: run_skill_script ツール

システムは `run_skill_script` ツールを提供しなければならない（MUST）。入力はスキル相対のスクリプトパス `script_path`（`scripts/` 配下）、任意の引数 `args`、目的説明 `purpose` とする。実行できるのは実行中スキルのディレクトリ配下に実在するスクリプトのみとし（MUST）、他スキルやプロジェクト外のスクリプト指定は拒否しなければならない（MUST）。

#### Scenario: スキル同梱スクリプトを実行する

- **WHEN** 実行中スキルに `scripts/build-html.cjs` が存在し、モデルが `run_skill_script` で実行を要求し、ユーザーが確認を許可する
- **THEN** スクリプトはサンドボックス内で実行され、要約のみが tool_result で返る

#### Scenario: 実行中スキル外のスクリプトは拒否

- **WHEN** `script_path` が他スキルまたはプロジェクト内のファイルを指す
- **THEN** 実行されず、実行中スキルの `scripts/` 配下のみ実行できる旨のエラーが返る

#### Scenario: 存在しないスクリプトはエラー

- **WHEN** `script_path` に存在しないパスが指定される
- **THEN** 実行されず、ファイルが見つからない旨のエラーが返る

### Requirement: スクリプト実行の確認ゲート

システムは `run_script` / `run_skill_script` の実行前に、毎回ユーザー確認を要求しなければならない（MUST）。確認表示には目的説明・書き込み予定パス（既存ファイルには上書きである旨）・折りたたみ可能なコード全文を含めなければならない（SHALL）。拒否された場合は実行せず、拒否された旨を tool_result でモデルへ返さなければならない（SHALL）。

#### Scenario: 確認して実行する

- **WHEN** モデルが `run_script` を要求し、確認ダイアログでユーザーが許可する
- **THEN** スクリプトが実行され、結果の要約が返る

#### Scenario: 拒否時は実行しない

- **WHEN** 確認ダイアログでユーザーが拒否する
- **THEN** スクリプトは実行されず、ユーザーが拒否した旨が tool_result で返り、loop は継続する

#### Scenario: 同一セッション内でも毎回確認する

- **WHEN** 同一セッションで 2 回目の `run_script` が要求される
- **THEN** 1 回目の許可に関わらず、再度確認ダイアログが表示される

#### Scenario: ネットワークアクセスの疑いを警告表示する

- **WHEN** `run_script` のコードに `http` / `https` / `net` / `fetch` 等のネットワークアクセスの兆候が静的に検出される
- **THEN** 確認ダイアログに警告バッジが表示される（実行のブロックはしない）

### Requirement: 構文チェックとリトライ契約

システムは確認ダイアログを表示する前にスクリプトの構文を検査しなければならない（MUST）。構文エラーの場合はユーザー確認を出さずに、エラー内容を含む復旧可能な tool_result をモデルへ返さなければならない（SHALL）。実行時エラーの場合は stderr の要約と exit code を tool_result でモデルへ返し、モデルが修正して再試行できるようにしなければならない（SHALL）。

#### Scenario: 構文エラーは確認前に弾く

- **WHEN** `run_script` の `code` に構文エラーがある
- **THEN** 確認ダイアログは表示されず、構文エラーの内容が tool_result でモデルへ返り、loop は継続する

#### Scenario: 実行時エラーはモデルが修正できる

- **WHEN** 実行されたスクリプトが実行時エラーで異常終了する
- **THEN** stderr の要約（サイズ上限あり）と exit code が tool_result で返り、モデルは修正版で再試行できる

