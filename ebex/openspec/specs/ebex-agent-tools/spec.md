# ebex-agent-tools Specification

## Purpose
Agent の workspace 限定 L1（発見）/ L2（読取）/ L3（書込）ツール、L4/L6 ブロック、上書き・プロジェクト外アクセスの確認ゲート、ツール入出力のサイズ上限。
## Requirements
### Requirement: 実ツールの提供

Agent invoke 時、システムは `lib/agent/tools/registry.ts` の `resolveToolDefinitions` を通じて実在する L1（発見）/ L2（読取）/ L3（書込）ツール定義を LLM に渡さなければならない（SHALL）。ツール一覧が空のまま偽の `<tool_call>` / `<tool_response>` テキストをモデルに生成させてはならない（MUST NOT）。

#### Scenario: 実ツールが渡される

- **WHEN** ユーザーがファイル作成を伴うスキル（例: `minutes-maid`）を invoke する
- **THEN** LLM リクエストには `read_file` / `write_file` 等の実ツール定義が含まれる

#### Scenario: 偽ツール呼び出しを防ぐ

- **WHEN** モデルがファイル操作を行おうとする
- **THEN** 本物のツール呼び出し（`tool_use` ブロック）が実行され、チャット本文への偽の `<tool_call>` テキスト生成は発生しない

### Requirement: L1 発見ツール

システムはプロジェクトフォルダ配下、および実行中スキルの `skillDirAbsolute` 配下（読取専用ゾーン）を対象とする発見ツール（一覧・glob・grep 相当、例: `list_files` / `glob_files` / `search_content`）を実装しなければならない（SHALL）。`path` が省略または `.` のときはプロジェクトフォルダ直下を既定の scope 根としなければならない（SHALL）。`path` は **scope 根**として解釈しなければならず（SHALL）、解決先がディレクトリなら配下を walk / list し、解決先がファイルならその 1 ファイルだけを対象としなければならない（SHALL）。親ディレクトリへの暗黙フォールバックをしてはならない（MUST NOT）。ファイル scope 時の各ツールは次のとおりでなければならない（SHALL）: `search_content` はそのファイルだけを grep する、`glob_files` はその相対パスまたはファイル名（basename）が `pattern` に一致するかだけを判定し一致なら 1 件・不一致なら 0 件を返す、`list_files` はそのファイルを `{ name, type: "file" }` の 1 エントリとして返す。`path` が存在するファイルまたはディレクトリを指す場合、発見ツールは `readdir` / scandir 由来の未捕捉例外で agent ターンを abort してはならない（MUST NOT）。欠落パスは明確な tool result error として返さなければならない（SHALL）。`path` または検索対象が実行中スキル配下に解決される場合（スキル相対が実在する、または明示の `skill/<実行中skillId>/...`）は、当該スキル配下を scope とし、ヒットを返さなければならない（SHALL）。`path` 省略時でも、pattern の第一パスセグメントが実行中スキル直下に実在しプロジェクト側に該当ヒットが無い（または同等の skill 優先規則）ときは、スキルゾーンを検索対象に含め、`references/*` やスキル内にのみ存在する `**/base.html` が 0 件にならないようにしなければならない（SHALL）。プロジェクト内および実行中スキル配下の発見はユーザー確認なしで実行できなければならない（SHALL）。検索系ツールのヒット件数には上限（既定 50 件程度）を設けなければならない（SHALL）。スキルゾーンへの書込を発見ツールが行ってはならない（MUST NOT）。

#### Scenario: プロジェクト内一覧は確認不要

- **WHEN** スキルがプロジェクトフォルダ配下のファイル一覧取得ツールを呼び出す
- **THEN** 確認ダイアログなしで結果が返る

#### Scenario: path 省略の直下一覧はプロジェクト

- **WHEN** `list_files` が path 省略（または `.`）で呼ばれる
- **THEN** 結果はプロジェクトフォルダ直下であり、スキルディレクトリの内容で置き換わらない

#### Scenario: references 配下の glob がスキルでヒットする

- **WHEN** 実行中スキルに `references/base.html` があり、`glob_files` が `pattern: "references/*"`（path 省略可）で呼ばれる
- **THEN** 1 件以上ヒットし、表示パスはホスト非依存のスキル論理形式（例: `skill/<skillId>/references/base.html`）である

#### Scenario: path に references を指定して一覧できる

- **WHEN** `list_files` または `glob_files` が `path: "references"` で呼ばれ、実行中スキルに当該ディレクトリがある
- **THEN** スキルの `references/` 配下が一覧／検索され、確認ダイアログは出ない

#### Scenario: 検索結果の上限

- **WHEN** grep 相当のツール呼び出しでヒット件数が上限を超える
- **THEN** 応答は上限件数に切り詰められ、切り詰められた旨が結果に含まれる

#### Scenario: path がファイルのとき search_content はそのファイルだけを検索する

- **WHEN** `search_content` の `path` が既存ファイル（例: `output/minutes.html`）に解決される
- **THEN** そのファイルのみが検索対象となり、未捕捉の `ENOTDIR` でターンは abort せず、ヒットは従来形式の配列で返る

#### Scenario: path がファイルのとき glob_files は 0 または 1 件を返す

- **WHEN** `glob_files` の `path` が既存ファイルに解決され、`pattern` がそのファイルの相対パスまたはファイル名に一致する
- **THEN** matches は 1 件であり、親ディレクトリ配下の他ファイルは含まれない

#### Scenario: path がファイルのとき basename でも pattern 照合される

- **WHEN** `glob_files` が `path: "output/minutes.html"`、`pattern: "*.html"` で呼ばれる（`*` は `/` を跨がないためフルパスには不一致）
- **THEN** ファイル名 `minutes.html` が `*.html` に一致するため matches は 1 件である

#### Scenario: path がファイルで pattern 不一致なら glob は 0 件

- **WHEN** `glob_files` の `path` が既存ファイルに解決され、`pattern` がそのファイルの相対パスにもファイル名にも一致しない
- **THEN** matches は空配列であり、例外は投げられない

#### Scenario: path がファイルのとき list_files は単一エントリを返す

- **WHEN** `list_files` の `path` が既存ファイルに解決される
- **THEN** entries は当該ファイルの `{ name, type: "file" }` 1 件のみであり、「ディレクトリではありません」エラーにはならない

### Requirement: L2 読取ツール

システムはプロジェクトフォルダ配下、および実行中スキルの `skillDirAbsolute` 配下（読取専用ゾーン）を対象とする `read_file` ツールを実装しなければならない（SHALL）。読取対象の文字数には上限（既定 約10万文字）を設けなければならない（SHALL）。上限を超えるファイルは切り詰めて返し、切り詰められた旨を結果に含めなければならない（SHALL）。プロジェクト内および実行中スキル配下の読取はユーザー確認なしで実行できなければならない（SHALL）。

#### Scenario: プロジェクト内読取は確認不要

- **WHEN** スキルがプロジェクトフォルダ内のファイルに対し `read_file` を呼び出す
- **THEN** 確認ダイアログなしでファイル内容が返る

#### Scenario: スキル配下の読取は確認不要

- **WHEN** スキルが `references/base.html` など実行中スキル配下のファイルに対し `read_file` を呼び出す
- **THEN** 確認ダイアログなしで当該スキルディレクトリ上の内容が返る

#### Scenario: 上限超のファイル

- **WHEN** 対象ファイルが上限文字数を超える
- **THEN** 結果は上限で切り詰められ、切り詰められたことが明示される

### Requirement: L3 書込ツール

システムはプロジェクトフォルダ配下限定の `write_file`（必要なら `mkdir`）ツールを実装しなければならない（SHALL）。書込先が新規パスであればプロジェクト内は確認なしで書き込まなければならない（SHALL）。書込先が既存ファイルと同名の場合は「プロジェクト内上書きの確認ゲート」要件に従わなければならない（SHALL）。書込成功時の tool_result にはパスとバイト数のみを含めなければならず（SHALL）、書き込んだ本文をモデル履歴に戻してはならない（MUST NOT）。`content` が上限（`WRITE_FILE_CHAR_LIMIT` = 30,000 文字）を超える場合は書き込まず、リトライ可能なエラー（`recoverable: true` と、成果物の形→経路の対応を要約した guidance を含む）を返さなければならない（SHALL）。

#### Scenario: 新規ファイルは確認不要

- **WHEN** スキルがプロジェクト内の存在しないパスへ `write_file` を呼び出す
- **THEN** 確認ダイアログなしでファイルが作成される

#### Scenario: 書込結果は要約のみ

- **WHEN** `write_file` が成功する
- **THEN** tool_result にはパスとバイト数のみが含まれ、書き込んだ本文全体は含まれない

#### Scenario: 上限超の content は書き込まない

- **WHEN** `write_file` の `content` が 30,000 文字を超える
- **THEN** ファイルは書き込まれず（既存ファイルも変更されず）、`recoverable: true` と経路対応の guidance（額縁があれば `copy_file`＋`replace_*`、創作長文は `generate_and_write`、データ変換は `run_script`）を含むエラーが tool_result で返り、loop は継続する

#### Scenario: 上限以内の content は従来どおり書ける

- **WHEN** `write_file` の `content` が 30,000 文字以内である
- **THEN** 従来どおり書き込みが行われる

### Requirement: プロジェクト内上書きの確認ゲート

`write_file` / `copy_file` / `replace_in_file` の書込先が、**ユーザーが事前に作った既存ファイル**と同名の場合、EBEX ランタイムはユーザーへ上書き確認を求め、同意を得てから上書きしなければならない（SHALL）。この確認はスキル frontmatter の設定値に関わらずランタイムが強制しなければならない（SHALL）。ただし次は上書き確認を求めてはならない（MUST NOT）: (1) 同一 Agent 実行（および同一会話履歴上で AI が作成・更新したと分かるパス）のファイル、(2) ユーザーが一度上書きを許可したパスへの以降の書込。

#### Scenario: 同名ファイルへの上書き確認

- **WHEN** スキルがプロジェクト内の、AI 未作成かつ未許可の既存ファイルと同名のパスへ `write_file` を呼び出す
- **THEN** ユーザーに上書き確認ダイアログが表示され、同意した場合のみファイルが上書きされる

#### Scenario: 拒否時は上書きしない

- **WHEN** ユーザーが上書き確認ダイアログで拒否する
- **THEN** ファイルは変更されず、拒否した旨がツール結果としてモデルに返る

#### Scenario: AI が新規作成したファイルは再確認しない

- **WHEN** 同一実行内で AI が新規に作成したファイルへ続けて `replace_in_file` または `write_file` する
- **THEN** 上書き確認ダイアログは表示されず書き込みが続行される

#### Scenario: 一度許可したパスは再確認しない

- **WHEN** ユーザーがあるパスの上書きを許可したあと、同一実行内で同じパスへ再度書き込む
- **THEN** 上書き確認ダイアログは再表示されない

### Requirement: プロジェクト外アクセスの確認ゲート

発見・読取・書込ツールの対象パスがプロジェクトフォルダ外を指す場合、実行前に必ずユーザー確認を求めなければならない（SHALL）。プロジェクト外への書込確認では、対象パスと新規／上書きの区別を明示しなければならない（SHALL）。ユーザーが拒否した場合はそのツール呼び出しを実行してはならない（MUST NOT）。

#### Scenario: プロジェクト外読取の確認

- **WHEN** ツール呼び出しの対象パスがプロジェクトフォルダ外を指す
- **THEN** 実行前にユーザー確認ダイアログが表示される

#### Scenario: プロジェクト外書込は新規/上書きを明示

- **WHEN** プロジェクト外への `write_file` が要求される
- **THEN** 確認ダイアログには対象パスと、新規作成か上書きかの区別が明示される

#### Scenario: 拒否時は実行しない

- **WHEN** ユーザーがプロジェクト外アクセスの確認ダイアログで拒否する
- **THEN** 当該ツール呼び出しは実行されず、拒否した旨がツール結果としてモデルに返る

### Requirement: L4 削除のブロック

システムは削除操作（`delete_file` 等）をツールとして実行してはならない（MUST NOT）。削除が要求された場合、対象ファイルパス、ブロックした理由（EBEX では自動削除しない等）、手動削除の案内を含む結果をモデルに返さなければならない（SHALL）。

#### Scenario: 削除要求のブロック

- **WHEN** モデルがファイル削除を要求する
- **THEN** 削除は実行されず、対象パスとブロック理由、手動削除の案内を含む結果が返る

### Requirement: L6 コマンド実行のブロック

システムは任意のシェルコマンド・スクリプト実行をツールとして実行してはならない（MUST NOT）。ただし専用ツール（`run_script` / `run_skill_script`）経由のサンドボックス化された Node スクリプト実行は例外とし、ユーザー確認を経て許可する。任意コマンドの実行が要求された場合、実行しようとしたコマンド全文、ブロックした理由、大きな成果物の生成であれば `run_script`（サンドボックス化 Node スクリプト）を使用する旨の案内を含む結果をモデルに返さなければならない（SHALL）。

#### Scenario: コマンド実行要求のブロック

- **WHEN** モデルがシェルコマンド（`bash` / `exec` / `shell` 等）の実行を要求する
- **THEN** コマンドは実行されず、コマンド全文とブロック理由、`run_script` への誘導を含む結果が返る

#### Scenario: 専用ツール経由のスクリプト実行は許可される

- **WHEN** モデルが `run_script` または `run_skill_script` でスクリプト実行を要求し、ユーザーが確認を許可する
- **THEN** スクリプトはサンドボックス内で実行される

### Requirement: 確認待ち中の agent loop 一時停止

ユーザー確認が必要なツール呼び出しが発生した場合、agent loop は当該ターンの以降のツール実行を一時停止し、ユーザーの応答（同意／拒否）を受け取ってから該当ツール呼び出しの結果を確定し、loop を再開しなければならない（SHALL）。一時停止中、ユーザーは通常のチャット入力を送信できない状態にしなければならない（SHALL）。

#### Scenario: 確認待ちで一時停止

- **WHEN** ツール呼び出しが確認ゲートに該当する
- **THEN** agent loop は当該ツールの結果が確定するまで次のツール実行に進まない

#### Scenario: 同意後に再開

- **WHEN** ユーザーが確認ダイアログで同意する
- **THEN** 保留していたツール呼び出しが実行され、agent loop が再開する

#### Scenario: 一時停止中は入力ロック

- **WHEN** agent loop が確認待ちで一時停止している
- **THEN** チャット入力欄は新規メッセージ送信を受け付けない

### Requirement: スキルゾーンのホスト非依存パス解決

発見・読取ツールは、実行中スキルの `skillDirAbsolute` を用いてスキル相対パスを解決できなければならない（SHALL）。ツール結果に含めるスキル配下の表示パスは、ホスト規約（`.claude` / `.cursor` 等）に依存しない論理形式（例: `skill/<skillId>/...`）でなければならない（SHALL）。実行中スキルに限り、旧形式 `.claude/skills/<実行中skillId>/...` 入力は `skillDirAbsolute` へマップして受け付けてよい（MAY）。他スキル id への明示パスは拒否しなければならない（SHALL）。

#### Scenario: スキル相対読取の表示がホスト非依存

- **WHEN** `read_file` が `references/purpose.md` をスキルゾーンから読む
- **THEN** tool_result の path は `skill/<skillId>/references/purpose.md` 形式（または同等のホスト非依存形式）である

#### Scenario: スキル相対発見の表示がホスト非依存

- **WHEN** `glob_files` が実行中スキルの `references/base.html` にヒットする
- **THEN** matches の各 path は `skill/<skillId>/...` 形式（または同等のホスト非依存形式）である

#### Scenario: 旧 .claude パスも実行中スキルなら受理

- **WHEN** `read_file` が `.claude/skills/<実行中skillId>/references/purpose.md` を要求し、実体は別ホスト規約ディレクトリにある
- **THEN** `skillDirAbsolute` 配下の当該ファイルが読まれる

#### Scenario: 他スキルへの明示パスは拒否

- **WHEN** `read_file` が実行中以外のスキル id を含む明示スキルパスを要求する
- **THEN** 読取は行われずエラーが返る

### Requirement: 壊れた tool_use での loop 停止

agent loop は、`tool_use` の入力 JSON パースに失敗した場合、または `read_file` / `write_file` / `mkdir` / `copy_file` / `replace_in_file` / `replace_between` / `append_file` で必須パスが欠落または空の場合、空の入力のままツールを実行してはならない（MUST NOT）。当該呼び出しは失敗の tool_result（理由と、大きな成果物では成果物の形→経路の対応（額縁があれば `copy_file`＋`replace_*`、創作長文は `generate_and_write`、データ変換は `run_script`）の案内を含んでよい）としてモデルへ返し、同一エラーの連続上限に達するまで loop を続行しなければならない（SHALL）。空 path を成功扱いで実行してはならない（MUST NOT）。案内は特定スキル名や HTML 専用の強制手順に依存してはならない（MUST NOT）。

#### Scenario: JSON パース失敗でもモデルへ返して続行

- **WHEN** ストリームされた `tool_use` の input JSON が破損しパースできない
- **THEN** agent loop は当該ツールを実行せず、壊れた tool_use である旨の tool_result をモデルへ返し、次ターンへ進める

#### Scenario: path 欠落でもモデルへ返して続行

- **WHEN** `write_file` の tool_use に `path` が無い、または空文字である
- **THEN** agent loop はツールを実行せず、欠落である旨と形→経路の対応案内を tool_result としてモデルへ返し、次ターンへ進める

### Requirement: 同一ツールエラー連続時の loop 停止

agent loop は、連続するツール実行結果が同一のエラー内容である場合、2 回まではモデルに結果を返して続行してよい（MAY）が、3 回目には loop を停止し、同一エラーが繰り返された旨を示さなければならない（SHALL）。

#### Scenario: 同一エラーが3回目で停止

- **WHEN** ツールが同じエラー結果を連続して返し、それが3回目に達する
- **THEN** agent loop はそれ以上のターンを実行せず停止する

#### Scenario: 2回までは続行

- **WHEN** 同一ツールエラーが2回連続した時点である
- **THEN** agent loop はまだ停止せず、モデルに結果を返して次ターンへ進める

### Requirement: サブエージェント系ツール名のブロック

システムはサブエージェント起動を意図するツール名（例: 名前に `subagent` や `Task` を含む未知ツール）を実行してはならない（MUST NOT）。要求された場合、ブロックした理由と「同一セッション内で自ら作業を続行する」案内を含む結果をモデルに返さなければならない（SHALL）。

#### Scenario: サブエージェント系ツール要求のブロック

- **WHEN** モデルがサブエージェント起動を意図する未知ツールを呼び出す
- **THEN** ツールは実行されず、非対応である理由と同一セッションでの続行案内を含む結果が返る

### Requirement: 実行中プロジェクトフォルダ消失時の即停止

Agent loop は invoke 時の `projectFolderId` に対応するプロジェクトフォルダがディスク上に存在することを、各 turn 開始時および各ツール実行前に確認しなければならない（SHALL）。フォルダがリネームまたは削除により存在しない場合、連続同一ツールエラーの再試行を待たず、loop を即座に停止し、ユーザーに分かりやすいエラーを表示しなければならない（SHALL）。フォルダ消失後に旧パスへ `write_file` / `mkdir` してフォルダを再作成してはならない（MUST NOT）。

#### Scenario: 削除されたフォルダで即停止する

- **WHEN** Agent 実行中に対象プロジェクトフォルダがディスク上から消える
- **THEN** 次の turn または次のツール実行の前に loop が停止し、ユーザーにエラーが表示され、旧パスにフォルダは再作成されない

#### Scenario: リネーム後も旧 ID では即停止する

- **WHEN** Agent 実行中に対象プロジェクトフォルダが別名へリネームされる
- **THEN** 旧 `projectFolderId` 向けの以降のツール実行は行われず、loop がエラーで停止する

### Requirement: copy_file ツール

システムはプロジェクトフォルダおよび実行中スキル配下からの読取と、プロジェクトフォルダへの書込を行う `copy_file` ツールを実装しなければならない（SHALL）。入力は少なくともコピー元 `from` とコピー先 `to` を含まなければならない（SHALL）。実行中スキル配下からプロジェクト配下へのコピーは許可しなければならない（SHALL）。スキルディレクトリへの書込、および実行中スキル以外のスキル配下からのコピーは拒否しなければならない（MUST NOT）。コピー先がプロジェクト内の既存ファイルと同名の場合は、既存のプロジェクト内上書き確認ゲートに従わなければならない（SHALL）。プロジェクト外パスは既存のプロジェクト外確認ゲートに従わなければならない（SHALL）。成功時の tool_result にはパス情報とバイト数（または同等の要約）のみを含め、ファイル本文を戻してはならない（MUST NOT）。

#### Scenario: スキルテンプレをプロジェクトへコピー

- **WHEN** 実行中スキル配下の `references/base.html` をプロジェクト内の `output/minutes.html` へ `copy_file` する
- **THEN** 確認なし（新規パス）でプロジェクト側に同一内容のファイルが作成される

#### Scenario: スキルへのコピーは拒否

- **WHEN** プロジェクト内ファイルを実行中スキルディレクトリ配下へ `copy_file` する
- **THEN** コピーは実行されず、拒否理由が tool_result に含まれる

#### Scenario: 既存先へのコピーは上書き確認

- **WHEN** コピー先がプロジェクト内の既存ファイルである
- **THEN** 上書き確認ダイアログが表示され、同意した場合のみ上書きされる

### Requirement: replace_in_file ツール

システムはプロジェクトフォルダ内ファイルを対象とする `replace_in_file` ツールを実装しなければならない（SHALL）。入力は対象 `path` と、1 つ以上の置換指定（プレースホルダ名から置換文字列への map、または `old_string` / `new_string`）を含まなければならない（SHALL）。スキルディレクトリ内ファイルへの置換は拒否しなければならない（MUST NOT）。置換対象文字列が 1 件も見つからない場合はファイルを変更せずエラーを返さなければならない（SHALL）。既存ファイルの内容を書き換えるため、プロジェクト内上書き確認ゲートに従わなければならない（SHALL）。成功時の tool_result にはパスと置換件数（または同等の要約）のみを含め、ファイル全文を戻してはならない（MUST NOT）。

#### Scenario: プレースホルダを一括置換

- **WHEN** プロジェクト内 HTML に対し `{{MEETING_TITLE}}` などを `replace_in_file` で置換する
- **THEN** 該当プレースホルダが置換され、tool_result に置換件数が含まれる

#### Scenario: 未一致はエラー

- **WHEN** 指定した置換キーまたは `old_string` がファイル内に存在しない
- **THEN** ファイルは変更されず、未一致である旨のエラーが返る

#### Scenario: スキル配下への置換は拒否

- **WHEN** 実行中スキル配下のパスへ `replace_in_file` する
- **THEN** 置換は実行されず、拒否理由が tool_result に含まれる

### Requirement: 新ツール定義の提供

`resolveToolDefinitions` が返すツール一覧には、スキル実行でファイル演算が必要な場合に `copy_file` および `replace_in_file` を含めることができなければならない（SHALL）。これらのツールは空の偽テキストではなく実ツールとして実行されなければならない（SHALL）。

#### Scenario: 定義に含まれる

- **WHEN** Agent がファイル演算ツール付きで invoke される
- **THEN** LLM リクエストの tools に `copy_file` と `replace_in_file` が含まれる

### Requirement: replace_between ツール

システムはプロジェクトフォルダ内ファイルを対象とする `replace_between` ツールを実装しなければならない（SHALL）。入力は少なくとも対象 `path`、`start_marker`、`end_marker`、および差し込み本文の供給元として `content` または `from_path` のいずれか一方を含まなければならない（SHALL）。両方指定または両方省略は拒否しなければならない（MUST NOT）。ファイル内で `start_marker` の後に `end_marker` が現れる最初の組について、両マーカーの間の内容だけを差し込み本文で置き換え、マーカー自体は残さなければならない（SHALL）。組が 0 のときはファイルを変更せずエラーを返さなければならない（SHALL）。`from_path` はプロジェクト配下（および実行中スキル配下の読取）から本文を読み、その全文を差し込みに用いなければならない（SHALL）。スキルディレクトリ内ファイルへの置換は拒否しなければならない（MUST NOT）。既存のプロジェクト内上書き確認ゲートに従わなければならない（SHALL）。成功時の tool_result にはパスと要約（置換バイト数または文字数等）のみを含め、差し込み本文を戻してはならない（MUST NOT）。

#### Scenario: コメント区切りの間を content で置換

- **WHEN** プロジェクト内 HTML に `<!-- CONTENT_START -->` と `<!-- CONTENT_END -->` があり、`replace_between` が当該マーカーと `content` で呼ばれる
- **THEN** 両マーカーは残り、その間だけが `content` に置き換わる

#### Scenario: from_path で大きな本文を差し込む

- **WHEN** `replace_between` が `from_path` にプロジェクト内の partial ファイルを指定する
- **THEN** partial の内容が区間に差し込まれ、tool_use 引数に partial 全文が無くても成功する

#### Scenario: マーカー未検出はエラー

- **WHEN** `start_marker` または対応する `end_marker` がファイルに無い
- **THEN** ファイルは変更されず、未検出である旨のエラーが返る

#### Scenario: content と from_path の同時指定は拒否

- **WHEN** `replace_between` に `content` と `from_path` の両方が渡される
- **THEN** ファイルは変更されず、エラーが返る

#### Scenario: スキル配下への置換は拒否

- **WHEN** 実行中スキル配下のパスへ `replace_between` する
- **THEN** 置換は実行されず、拒否理由が tool_result に含まれる

### Requirement: append_file ツール

システムはプロジェクトフォルダ配下を対象とする `append_file` ツールを実装しなければならない（SHALL）。入力は少なくとも `path` と追記する `content` を含まなければならない（SHALL）。対象が存在しない場合は新規作成して内容を書いてよい（MAY）。スキルディレクトリへの追記は拒否しなければならない（MUST NOT）。既存ファイルへの追記はプロジェクト内上書き確認ゲートに従わなければならない（SHALL）。ただし同一 Agent 実行（および同一会話履歴上で AI が作成・更新したと分かるパス）への追記、およびユーザーが一度上書きを許可したパスへの以降の追記は、再確認を求めてはならない（MUST NOT）。成功時の tool_result にはパスと要約のみを含め、追記本文を戻してはならない（MUST NOT）。

#### Scenario: partial へ追記できる

- **WHEN** プロジェクト内の既存 partial へ `append_file` する
- **THEN** ファイル末尾に `content` が追加される

#### Scenario: 新規 path への append は作成になる

- **WHEN** 存在しないプロジェクト内 path へ `append_file` する
- **THEN** ファイルが作成され、内容は `content` と一致する

#### Scenario: スキルへの append は拒否

- **WHEN** 実行中スキル配下へ `append_file` する
- **THEN** 追記は実行されず、拒否理由が tool_result に含まれる

### Requirement: スキル固有 HTML 強制コピーの禁止

agent loop およびツール層は、宛先拡張子やスキル内の `references/base.html` の有無だけを理由に、`write_file` の内容を破棄してテンプレート強制コピーへ置き換えてはならない（MUST NOT）。大きな成果物向けの案内は「成果物の形→経路の一意対応」（額縁テンプレートがあれば `copy_file` でコピーして `replace_in_file` / `replace_between` で断片を差し込む、モデルが創作する長文は `generate_and_write` で partial に生成して `replace_between`（`from_path`）で差し込む、大量レコードの機械変換は `run_script`）として示さなければならず（SHALL）、複数経路を「失敗したら乗り換える」フォールバック列として示してはならない（MUST NOT）。案内は特定スキル名や HTML 専用の必須手順をランタイムが強制してはならない（MUST NOT）。

#### Scenario: HTML への write_file は内容どおり書く

- **WHEN** スキルに `references/base.html` があっても、モデルがプロジェクト内の新規 `.html` へ `write_file` で content を渡す
- **THEN** ランタイムはテンプレート強制コピーに差し替えず、渡された content で書き込む（または通常のバリデーション／サイズ上限エラーのみ）

#### Scenario: 巨大 write 案内は形→経路の対応表である

- **WHEN** 大きな `write_file` がサイズ上限等で失敗する
- **THEN** tool_result の案内は「額縁があれば `copy_file`＋`replace_*` で断片を差し込む／創作長文は `generate_and_write`／データ変換は `run_script`」という形→経路の対応を示し、特定スキル名やフォールバック順序（「◯◯が失敗したら△△」）を含まない

### Requirement: 新ツール定義の提供（区間置換）

`resolveToolDefinitions` が返すツール一覧には、`replace_between` および `append_file` を含めなければならない（SHALL）。これらのツールは空の偽テキストではなく実ツールとして実行されなければならない（SHALL）。

#### Scenario: 定義に含まれる

- **WHEN** Agent がファイル演算ツール付きで invoke される
- **THEN** LLM リクエストの tools に `replace_between` と `append_file` が含まれる

