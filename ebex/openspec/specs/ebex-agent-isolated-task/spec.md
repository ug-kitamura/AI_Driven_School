# ebex-agent-isolated-task Specification

## Purpose

サブエージェント起動の代替として、親の会話履歴を引き継がない独立コンテキストでタスクを実行する `run_isolated_task` ツール。

## Requirements

### Requirement: run_isolated_task ツールの提供

システムは `run_isolated_task` ツールを実装し、`resolveToolDefinitions` が返すツール一覧に常に含めなければならない（SHALL）。入力は少なくとも `purpose`（ユーザー向けの目的説明）と `instruction`（実行させるタスクの指示）を含まなければならない（SHALL）。任意入力として `path`（結果をファイルへ書き込む場合の書込先）、`sections`（結果が大きい場合のセクション分割指示）、`context_paths`（子プロンプトへ内容を含める参照ファイル）を受け付けなければならない（SHALL）。実行時、システムはサーバ内で親の会話履歴を引き継がない子 LLM 呼び出しを行わなければならない（SHALL）。

#### Scenario: 独立した子呼び出しでタスクが実行される

- **WHEN** モデルが `run_isolated_task` を `purpose` と `instruction` のみで呼び出し、ユーザーが確認を許可する
- **THEN** 親の会話履歴を含まない子 LLM 呼び出しが行われ、結果が返る

#### Scenario: ツール定義に含まれる

- **WHEN** Agent が invoke される
- **THEN** LLM リクエストの tools に `run_isolated_task` が含まれる

### Requirement: 結果の書込またはテキスト返却

`path` が指定された場合、システムは子呼び出しの結果本文をサーバが直接 `path` へ書き込まなければならない（SHALL）。この場合の tool_result にはパス・バイト数等の要約のみを含めなければならず（SHALL）、結果本文をモデル履歴に戻してはならない（MUST NOT）。`path` が省略された場合、システムは子呼び出しの結果本文をそのまま tool_result のテキストとして返さなければならない（SHALL）。この場合の結果本文には上限文字数を設けなければならず（SHALL）、上限を超える場合は結果を返さず、`sections` による分割等の修正指針を含むエラーを返さなければならない（SHALL）。

#### Scenario: path 指定時はファイルに書き込まれる

- **WHEN** `run_isolated_task` が `path` 付きで呼び出され成功する
- **THEN** 結果本文は `path` のファイルへ書き込まれ、tool_result にはパスとバイト数のみが含まれる

#### Scenario: path 省略時は結果テキストが返る

- **WHEN** `run_isolated_task` が `path` なしで呼び出され成功する
- **THEN** 子呼び出しの結果本文がそのまま tool_result のテキストとして返り、ファイルは作成されない

#### Scenario: 結果が大きすぎる場合はエラーで返す

- **WHEN** `path` なしの `run_isolated_task` の結果本文が上限文字数を超える
- **THEN** 結果は返されず、`sections` を分割する等の修正指針を含むエラーが tool_result として返る

### Requirement: 子呼び出しの独立性と材料の受け渡し

子 LLM 呼び出しは親エージェントの会話履歴を引き継いではならない（MUST NOT）。子の system prompt は「親から独立して指示されたタスクを実行し、その結果をそのまま出力する」旨のランタイム固定文を含まなければならない（SHALL）。`context_paths` に指定されたファイルは、プロジェクトフォルダ配下および実行中スキルの読取ゾーン配下に限り読み取り、読取上限つきで子プロンプトに含めなければならない（SHALL）。それ以外のパスが指定された場合は当該ファイルを読まずエラーを返さなければならない（SHALL）。`context_paths` として渡した参照ファイルの内容そのものは、tool_result として親の履歴へ戻してはならない（MUST NOT）。

#### Scenario: 参照ファイルが子プロンプトに渡る

- **WHEN** `context_paths` に評価対象の完成済み成果物ファイルが指定される
- **THEN** その内容（読取上限つき）が子プロンプトに含まれた状態でタスクが実行される

#### Scenario: 参照ファイルの内容は親履歴に戻らない

- **WHEN** `context_paths` に指定したファイルの内容を子呼び出しが参照して結果を生成する
- **THEN** tool_result には `context_paths` の内容そのものは含まれず、子呼び出しの結果本文（または `path` 指定時は要約）のみが含まれる

#### Scenario: ゾーン外の context_paths は拒否

- **WHEN** `context_paths` にプロジェクト外かつスキルゾーン外のパスが含まれる
- **THEN** 子 LLM 呼び出しは行われず、エラーが tool_result として返る

### Requirement: セクション分割と max_tokens 継続

`sections` が指定された場合、システムは各セクションを順に子 LLM 呼び出しで生成し、順序どおり連結しなければならない（SHALL）。子応答の `stop_reason` が `max_tokens` の場合、システムは生成済みテキストを保持したまま継続呼び出しを行い、受領テキストを無加工で連結しなければならない（SHALL）。継続回数にはセクションあたりの上限を設けなければならない（SHALL）。上限値は実行モデルのモデルプロファイルから解決しなければならない（SHALL）。

#### Scenario: 途中切れから継続して完走する

- **WHEN** あるセクションの子応答が `stop_reason: "max_tokens"` で途中終了する
- **THEN** システムは継続呼び出しで残りを取得し、つなぎ合わせた完全なセクションが結果に含まれる

#### Scenario: 継続上限到達はエラーで返す

- **WHEN** 1 セクションの継続回数がプロファイルの上限に達してもセクションが完了しない
- **THEN** 結果は返されず、完了済みセクション数と修正の指針を含むエラーが tool_result として返る

### Requirement: 実行前ユーザー確認

`run_isolated_task` の実行前に、システムはユーザー確認を求めなければならない（SHALL）。確認表示には `purpose`、`instruction`、`path` が指定されていればその書込先（既存ファイルの場合は上書きである旨）を含めなければならない（SHALL）。サーバが emit した `confirm_required`（`kind: "isolated-task"`）はクライアントのストリーム消費層で破棄されることなく確認UIへ転送されなければならない（SHALL）。ユーザーが拒否した場合、子 LLM 呼び出しを行わず、拒否された旨を tool_result としてモデルに返さなければならない（SHALL）。

#### Scenario: 確認内容の表示

- **WHEN** モデルが `run_isolated_task` を呼び出す
- **THEN** 子 LLM 呼び出しの前に、purpose・instruction・（指定時は）書込先パスを含む確認が表示される

#### Scenario: 拒否時は実行しない

- **WHEN** ユーザーが確認で拒否する
- **THEN** 子 LLM 呼び出しは発生せず、拒否の旨がモデルに返る

### Requirement: 書込境界

`path` が指定された場合、書込先はプロジェクトフォルダ配下でなければならない（SHALL）。実行中スキルディレクトリ配下への書込は拒否しなければならない（MUST NOT 書き込む）。書込先がプロジェクトフォルダ外を指す場合は既存のプロジェクト外確認ゲートに従わなければならない（SHALL）。

#### Scenario: スキルゾーンへの書込は拒否

- **WHEN** `path` が実行中スキルディレクトリ配下に解決される
- **THEN** 子 LLM 呼び出しは行われず、拒否理由が tool_result として返る
