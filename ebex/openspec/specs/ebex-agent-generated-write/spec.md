# ebex-agent-generated-write Specification

## Purpose

TBD - created by archiving change ebex-agent-large-write-runtime. Update Purpose after archive.

## Requirements

### Requirement: generate_and_write ツールの提供

システムは `generate_and_write` ツールを実装し、`resolveToolDefinitions` が返すツール一覧に含めなければならない（SHALL）。入力は少なくとも `purpose`（ユーザー向けの目的説明）、`path`（プロジェクト相対の書込先）、`instruction`（生成指示）を含まなければならない（SHALL）。任意入力として `sections`（セクション分割の指示、順序どおり生成・連結）と `context_paths`（子プロンプトへ本文を含める参照ファイル）を受け付けなければならない（SHALL）。実行時、システムはサーバ内で子 LLM 呼び出しを行い、得られた本文をサーバがファイルへ書き込まなければならない（SHALL）。成果物の本文を親エージェントの tool 引数に要求してはならない（MUST NOT）。

#### Scenario: 小さな指示で大きな成果物が書かれる

- **WHEN** モデルが `generate_and_write` を `path`・`instruction`・`sections` のみ（本文なし）で呼び出し、ユーザーが確認を許可する
- **THEN** サーバ内の子 LLM 生成によって `path` にファイルが作成され、親の tool_use 引数に成果物本文は含まれない

#### Scenario: ツール定義に含まれる

- **WHEN** Agent が invoke される
- **THEN** LLM リクエストの tools に `generate_and_write` が含まれる

### Requirement: 子 LLM 呼び出しの独立性と材料の受け渡し

子 LLM 呼び出しは親エージェントの会話履歴を引き継いではならない（MUST NOT）。子の system prompt は「成果物本文のみを出力し、前置き・後書き・コードフェンス・説明文を出力しない」旨のランタイム固定文を含まなければならない（SHALL）。`context_paths` に指定されたファイルは、プロジェクトフォルダ配下および実行中スキルの読取ゾーン配下に限り読み取り、読取上限つきで子プロンプトに含めなければならない（SHALL）。それ以外のパスが指定された場合は当該ファイルを読まずエラーを返さなければならない（SHALL）。ツール説明は、親が収集した材料（アウトライン・参考メモ等）をファイルに書き出して `context_paths` で渡す運用を案内しなければならない（SHALL）。

#### Scenario: 参照ファイルが子プロンプトに渡る

- **WHEN** `context_paths` にプロジェクト内のアウトラインファイルと実行中スキルの `references/model-answer.html` が指定される
- **THEN** 両ファイルの内容（読取上限つき）が子プロンプトに含まれた状態で生成が行われる

#### Scenario: ゾーン外の context_paths は拒否

- **WHEN** `context_paths` にプロジェクト外かつスキルゾーン外のパスが含まれる
- **THEN** 子 LLM 呼び出しは行われず、エラーが tool_result として返る

### Requirement: セクション分割と max_tokens 継続

`sections` が指定された場合、システムは各セクションを順に子 LLM 呼び出しで生成し、順序どおり連結しなければならない（SHALL）。子応答の `stop_reason` が `max_tokens` の場合、システムは生成済みテキストを保持したまま「続きのみを繰り返しなしで出力する」継続呼び出しを行い、受領テキストを無加工で連結しなければならない（SHALL）。継続回数にはセクションあたりの上限を設けなければならない（SHALL）。上限値は実行モデルのモデルプロファイル（`continuations.generatePerSection`）から解決しなければならない（SHALL）。子 LLM 呼び出しにはプロファイルの `providerParams.generate`（通過袋）をプロバイダへ渡さなければならない（SHALL）。生成合計サイズには上限を設け、その上限は `replace_between` の `from_path` 読取上限を超えてはならない（MUST NOT）。いずれかの上限に達した場合は書き込みを行わず、完了済みセクション数を含むエラーを返さなければならない（SHALL）。

#### Scenario: 途中切れから継続して完走する

- **WHEN** あるセクションの子応答が `stop_reason: "max_tokens"` で途中終了する
- **THEN** システムは継続呼び出しで残りを取得し、つなぎ合わせた完全なセクションが成果物に含まれる

#### Scenario: 継続上限がモデル別に適用される

- **WHEN** 同一の generate_and_write を Claude 系モデルと gpt-5-nano でそれぞれ実行する
- **THEN** 継続上限は Claude 系では 4、nano ではプロファイルの 8 が適用される

#### Scenario: 継続上限到達はエラーで返す

- **WHEN** 1 セクションの継続回数がプロファイルの上限に達してもセクションが完了しない
- **THEN** ファイルは書き込まれず、完了済みセクション数と、`sections` を細かく分割して再試行する旨の案内を含むエラーが tool_result として返る

#### Scenario: 生成物は from_path で差し込める

- **WHEN** `generate_and_write` が成功した partial ファイルを `replace_between` の `from_path` に指定する
- **THEN** 生成合計サイズ上限が読取上限以下であるため、サイズ超過エラーにならず差し込みが成功する

### Requirement: 実行前ユーザー確認

`generate_and_write` の実行前に、システムはユーザー確認を求めなければならない（SHALL）。確認表示には `purpose`、書込先 `path`（既存ファイルの場合は上書きである旨）、`instruction`、および `sections` を含めなければならない（SHALL）。サーバが emit した `confirm_required`（`kind: "generate-write"`）はクライアントのストリーム消費層で破棄されることなく確認ダイアログとして表示されなければならず（SHALL）、`generate` ペイロード（purpose / instruction / sections / contextPaths）はダイアログまで転送されなければならない（SHALL）。ユーザーが拒否した場合、子 LLM 呼び出しと書き込みを行わず、拒否された旨を tool_result としてモデルに返さなければならない（SHALL）。承認は当該 `path` への書込許可を兼ね、成功時には以降の同一パス上書き再確認を求めてはならない（MUST NOT）。

#### Scenario: 確認内容の表示

- **WHEN** モデルが `generate_and_write` を呼び出す
- **THEN** 子 LLM 呼び出しの前に、purpose・書込先パス（新規／上書きの区別）・生成指示・セクション一覧を含む確認ダイアログが表示される

#### Scenario: 確認イベントはクライアントで破棄されない

- **WHEN** サーバが `kind: "generate-write"` の `confirm_required` イベントを emit する
- **THEN** クライアントのストリームパーサはイベントを `onConfirmRequired` へ転送し、ダイアログが表示されないままサーバ側の確認待ちがタイムアウトすることはない

#### Scenario: 拒否時は生成も書込もしない

- **WHEN** ユーザーが確認ダイアログで拒否する
- **THEN** 子 LLM 呼び出しは発生せず、ファイルも変更されず、拒否の旨がモデルに返る

#### Scenario: 承認後の同一パス再書込は再確認しない

- **WHEN** `generate_and_write` の承認・成功後、同一実行内で同じパスへ `replace_between` 等の書込が行われる
- **THEN** 上書き確認ダイアログは再表示されない

### Requirement: 書込境界

`generate_and_write` の書込先はプロジェクトフォルダ配下でなければならない（SHALL）。実行中スキルディレクトリ配下への書込は拒否しなければならない（MUST NOT 書き込む）。書込先がプロジェクトフォルダ外を指す場合は既存のプロジェクト外確認ゲートに従わなければならない（SHALL）。書き込みは全セクション完了後に行い、生成が途中で失敗した場合に部分的な内容でファイルを作成・更新してはならない（MUST NOT）。

#### Scenario: スキルゾーンへの書込は拒否

- **WHEN** `path` が実行中スキルディレクトリ配下に解決される
- **THEN** 子 LLM 呼び出しは行われず、拒否理由が tool_result として返る

#### Scenario: 途中失敗でファイルを残さない

- **WHEN** 複数セクションのうち途中のセクションで子 API 呼び出しが失敗する
- **THEN** 書込先ファイルは作成・更新されず、失敗内容と完了済みセクション数がエラーとして返る

### Requirement: tool_result の要約返却とリトライ契約

成功時の tool_result にはパス・バイト数・セクション数・継続回数など要約のみを含めなければならず（SHALL）、生成本文をモデル履歴に戻してはならない（MUST NOT）。`context_paths` のいずれかで読取上限による切り捨てが発生した場合、成功時の tool_result の要約に、切り捨てが発生した事実と対象ファイルのパスを含めなければならない（SHALL）。切り捨てが発生しなかった場合は、切り捨てに関する情報を含めてはならない（MUST NOT）。失敗時はエラー内容・完了済みセクション数・修正の指針（sections の分割・instruction の絞り込み等）を返し、モデルが自己修正して再試行できるようにしなければならない（SHALL）。`path` または `instruction` が欠落・空の tool_use は実行してはならず（MUST NOT）、`generate_and_write` の入力 schema を再提示する案内を含む失敗の tool_result を返さなければならない（SHALL）。

#### Scenario: 成功結果は要約のみ

- **WHEN** `generate_and_write` が成功する
- **THEN** tool_result にはパス・バイト数・セクション数・継続回数が含まれ、生成本文は含まれない

#### Scenario: 切り捨て発生時は tool_result に現れる

- **WHEN** `context_paths` に読取上限を超えるファイルが指定され、`generate_and_write` が成功する
- **THEN** tool_result の要約に、切り捨てが発生した事実と対象ファイルのパスが含まれる

#### Scenario: 切り捨てなしでは情報が増えない

- **WHEN** `context_paths` のすべてのファイルが読取上限以内で、`generate_and_write` が成功する
- **THEN** tool_result に切り捨てに関する情報は含まれない

#### Scenario: 入力不備には schema を再提示する

- **WHEN** `generate_and_write` の tool_use に `instruction` が無い、または空である
- **THEN** 生成は行われず、必須入力と schema の案内を含む失敗の tool_result がモデルへ返る

### Requirement: context_paths 切り捨ての実行ログ表示

`context_paths` の読取上限による切り捨てが発生した場合、システムはツール実行ログの表示にも切り捨てが起きた旨を含めなければならない（SHALL）。表示は切り捨てが発生したファイルを特定できるものでなければならない（SHALL）。

本要件は可視化のみを対象とし、読取上限の値および切り捨ての方式（どの範囲を保持するか）を変更してはならない（MUST NOT）。

#### Scenario: 切り捨てが実行ログに表示される

- **WHEN** `context_paths` に読取上限を超えるファイルが指定され、`generate_and_write` が成功する
- **THEN** ツール実行ログの表示に、切り捨てが発生した旨と対象ファイルが現れる

#### Scenario: 切り捨てなしでは表示が変わらない

- **WHEN** `context_paths` のすべてのファイルが読取上限以内で、`generate_and_write` が成功する
- **THEN** ツール実行ログの表示は従来どおりで、切り捨てに関する記述は現れない
