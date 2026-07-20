# ebex-agent-script-runtime Specification

## Purpose

TBD - created by archiving change ebex-agent-script-runtime. Update Purpose after archive.
## Requirements
### Requirement: サンドボックス実行基盤

システムはスクリプトを Node 子プロセスとして実行し、Node Permission Model により fs 読取を「プロジェクトフォルダ・実行中スキルディレクトリ・スクリプト自身」に、fs 書込を「プロジェクトフォルダ内」に制限しなければならない（MUST）。実行は `cwd` をプロジェクトフォルダに固定し、タイムアウトと stdout/stderr のサイズ上限を設けなければならない（MUST）。子プロセスへ渡す環境変数は allowlist 方式で最小構成（実行に必要な `PATH` 等の必須項目）とし、サーバプロセスの秘密情報（API キー等）を継承させてはならない（MUST NOT）。システムは子プロセスへ `EBEX_PROJECT_DIR`（プロジェクトフォルダの絶対パス）を注入し、スキル実行中は `EBEX_SKILL_DIR`（実行中スキルの `skillDirAbsolute`）も注入しなければならない（SHALL）。`EBEX_SKILL_DIR` の値は fs 読取許可（`--allow-fs-read`）に渡す値と同一の `skillDirAbsolute` から導出しなければならない（SHALL）。

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

#### Scenario: 環境変数でスキルファイルを直接読める

- **WHEN** スキル実行中のスクリプトが `path.join(process.env.EBEX_SKILL_DIR, "references", "style.css")` を読み取る
- **THEN** 実行中スキルの当該ファイルが読取に成功する

#### Scenario: env と読取許可は同一のスキルディレクトリを指す

- **WHEN** 同一 `skill.id` のスキルがホストルートと ebex ルートの両方に存在する状態でスクリプトが実行される
- **THEN** `EBEX_SKILL_DIR` の値と `--allow-fs-read` の対象は、ホスト優先で解決された同一の `skillDirAbsolute` である

#### Scenario: スキル外実行では EBEX_SKILL_DIR が未設定

- **WHEN** スキルを実行していない通常チャットから `run_script` が実行される
- **THEN** 子プロセスの `EBEX_SKILL_DIR` は未設定であり、`EBEX_PROJECT_DIR` は設定されている

#### Scenario: サーバの秘密情報は継承されない

- **WHEN** サーバプロセスの環境に API キー等の秘密情報が設定された状態でスクリプトが実行される
- **THEN** 子プロセスの環境変数に当該秘密情報は含まれない

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

システムは `run_skill_script` ツールを提供しなければならない（MUST）。ただしツール定義を LLM へ渡すのは、実行中スキルのディレクトリ配下に `scripts/` ディレクトリが実在する場合のみとし（SHALL）、実在しない場合は `resolveToolDefinitions` の結果に `run_skill_script` を含めてはならない（MUST NOT）。公開判定は `scripts/` ディレクトリの実在のみを条件とし、スキル名・スクリプト内容による分岐を持ってはならない（MUST NOT）。入力はスキル相対のスクリプトパス `script_path`（`scripts/` 配下）、任意の引数 `args`、目的説明 `purpose` とする。実行できるのは実行中スキルのディレクトリ配下に実在するスクリプトのみとし（MUST）、他スキルやプロジェクト外のスクリプト指定は拒否しなければならない（MUST）。

#### Scenario: scripts が実在するスキルではツール定義に含まれる

- **WHEN** 実行中スキルのディレクトリ配下に `scripts/` ディレクトリが存在する状態で agent が invoke される
- **THEN** LLM へ渡されるツール定義に `run_skill_script` が含まれる

#### Scenario: scripts が無いスキルではツール定義に含まれない

- **WHEN** 実行中スキルのディレクトリ配下に `scripts/` ディレクトリが存在しない状態で agent が invoke される
- **THEN** LLM へ渡されるツール定義に `run_skill_script` が含まれず、モデルは当該ツールを呼び出せない

#### Scenario: スキル実行中でない場合もツール定義に含まれない

- **WHEN** スキルを実行していない通常のチャットで agent が invoke される
- **THEN** LLM へ渡されるツール定義に `run_skill_script` が含まれない

#### Scenario: スキル同梱スクリプトを実行する

- **WHEN** 実行中スキルに `scripts/build-html.cjs` が存在し、モデルが `run_skill_script` で実行を要求し、ユーザーが確認を許可する
- **THEN** スクリプトはサンドボックス内で実行され、要約のみが tool_result で返る

#### Scenario: 実行中スキル外のスクリプトは拒否

- **WHEN** `script_path` が他スキルまたはプロジェクト内のファイルを指す
- **THEN** 実行されず、実行中スキルの `scripts/` 配下のみ実行できる旨のエラーが返る

#### Scenario: 存在しないスクリプトはエラー

- **WHEN** `script_path` に存在しないパスが指定される（例: `scripts/` は実在するがファイルが無い）
- **THEN** 実行されず、ファイルが見つからない旨のエラーが返る

### Requirement: スクリプト実行の確認ゲート

システムは `run_script` / `run_skill_script` の実行前に、毎回ユーザー確認を要求しなければならない（MUST）。確認表示には目的説明・書き込み予定パス（既存ファイルには上書きである旨）・折りたたみ可能なコード全文を含めなければならない（SHALL）。拒否された場合は実行せず、拒否された旨を tool_result でモデルへ返さなければならない（SHALL）。`run_script`（モデルが本文を与える即興コード）のネットワークアクセスの扱いは「実行経路によるネットワークアクセス境界」要件に従う。

#### Scenario: 確認して実行する

- **WHEN** モデルが `run_script` を要求し、確認ダイアログでユーザーが許可する
- **THEN** スクリプトが実行され、結果の要約が返る

#### Scenario: 拒否時は実行しない

- **WHEN** 確認ダイアログでユーザーが拒否する
- **THEN** スクリプトは実行されず、ユーザーが拒否した旨が tool_result で返り、loop は継続する

#### Scenario: 同一セッション内でも毎回確認する

- **WHEN** 同一セッションで 2 回目の `run_script` が要求される
- **THEN** 1 回目の許可に関わらず、再度確認ダイアログが表示される

#### Scenario: 審査済みスクリプトのネットワークは警告表示する

- **WHEN** `run_skill_script` のコードに `http` / `https` / `net` / `fetch` 等のネットワークアクセスの兆候が静的に検出される
- **THEN** 確認ダイアログに警告バッジが表示される（実行はブロックしない）

### Requirement: 構文チェックとリトライ契約

システムは確認ダイアログを表示する前にスクリプトの構文を検査しなければならない（MUST）。構文エラーの場合はユーザー確認を出さずに、エラー内容を含む復旧可能な tool_result をモデルへ返さなければならない（SHALL）。実行時エラーの場合は stderr の要約と exit code を tool_result でモデルへ返し、モデルが修正して再試行できるようにしなければならない（SHALL）。

#### Scenario: 構文エラーは確認前に弾く

- **WHEN** `run_script` の `code` に構文エラーがある
- **THEN** 確認ダイアログは表示されず、構文エラーの内容が tool_result でモデルへ返り、loop は継続する

#### Scenario: 実行時エラーはモデルが修正できる

- **WHEN** 実行されたスクリプトが実行時エラーで異常終了する
- **THEN** stderr の要約（サイズ上限あり）と exit code が tool_result で返り、モデルは修正版で再試行できる

### Requirement: スクリプトからのスキルファイル参照経路の案内

`run_script` / `run_skill_script` のツール定義 description は、スキルの参照ファイルを `process.env.EBEX_SKILL_DIR` 基準（`path.join` 使用）で読む旨を含まなければならない（SHALL）。スキル同梱スクリプト（`run_skill_script`）の規約として、スキル側ファイルの読取は `__dirname` または `EBEX_SKILL_DIR` 基準、成果物の書込は cwd（プロジェクト）基準の相対パスまたは `EBEX_PROJECT_DIR` 基準としなければならない（SHALL）。ツール結果の論理パス（`skill/<skillId>/...`）をスクリプト内の fs パスとして案内してはならない（MUST NOT）。

#### Scenario: description が参照経路を案内する

- **WHEN** `run_script` のツール定義が LLM へ渡される
- **THEN** description に `EBEX_SKILL_DIR` によるスキルファイル読取の案内が含まれる

#### Scenario: 同梱スクリプトは \_\_dirname で参照できる

- **WHEN** スキルの `scripts/build.cjs` が `path.join(__dirname, "..", "references", "base.html")` を読み取る
- **THEN** 読取は成功する（`run_skill_script` はスキル内の絶対パスで実行されるため `__dirname` はスキルの `scripts/` を指す）

### Requirement: 実行経路によるネットワークアクセス境界

システムはスクリプト実行のネットワークアクセスを実行経路（provenance）で区別しなければならない（SHALL）。`run_script`（モデルが本文を与える即興コード）では、ネットワークアクセスの兆候（`http` / `https` / `net` / `tls` / `dgram` / `http2` / `fetch` / `WebSocket` / `XMLHttpRequest` 等）を静的に検出した場合、実行を拒否しなければならない（MUST NOT 実行）。拒否時は、外部通信ができない理由と、代替（データ取得が必要なら審査済みのスキル同梱スクリプト、または web_search の人手フォールバック）を tool_result でモデルへ返さなければならない（SHALL）。`run_skill_script`（実行中スキルの `scripts/` 配下に実在する審査済みスクリプト）ではネットワークアクセスを許可してよい（MAY）が、実行前のユーザー確認は維持し、確認ダイアログにネットワークアクセスの兆候がある旨の警告バッジを表示しなければならない（SHALL）。信頼の単位はインストール済みスキルとする。静的検出は完全ではなく難読化で回避され得ることを運用前提とする。

#### Scenario: run_script のネットワークはブロックする

- **WHEN** `run_script` の `code` に `fetch` / `https` 等のネットワークアクセスが静的に検出される
- **THEN** スクリプトは実行されず、外部通信不可の理由と代替の案内が tool_result で返り、loop は継続する

#### Scenario: 審査済みスクリプトのネットワークは許可する

- **WHEN** 実行中スキルの `scripts/fetch-repo.cjs` が外部からデータを取得する内容で、モデルが `run_skill_script` を要求しユーザーが確認を許可する
- **THEN** スクリプトはサンドボックス内で実行され、確認ダイアログにはネットワークの警告バッジが表示されていた

#### Scenario: ネットワーク兆候の無い run_script は従来どおり

- **WHEN** `run_script` の `code` にネットワークアクセスの兆候が無い
- **THEN** ネットワーク境界による拒否は発生せず、従来どおり確認後に実行できる

