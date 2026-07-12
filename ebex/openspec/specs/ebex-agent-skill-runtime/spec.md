# ebex-agent-skill-runtime Specification

## Purpose
可視スキルの平等な候補表示と、スキルを包む薄いランタイム契約（Scope / Focus / Boundary）。
## Requirements
### Requirement: 可視スキルの平等な候補表示

Agent 入力の `/` オートコンプリートは、複ルートカタログ上の `hidden` でないスキルをスキル固有の理由で除外してはならない（MUST NOT）。レッスン選択有無や特定 `skill.id` に依存する候補フィルタを設けてはならない（MUST NOT）。

#### Scenario: レッスン未選択でも create-draft が候補に出る

- **WHEN** レッスンオブジェクトが無くプロジェクトフォルダのみが選択されている状態でユーザーが `/` を入力する
- **THEN** `create-draft` が可視スキルであれば候補に含まれる

#### Scenario: hidden スキルは出ない

- **WHEN** ユーザーが `/` を入力する
- **THEN** `hidden: true` のスキル（例: `general-chat`）は候補に含まれない

#### Scenario: ホスト側の可視スキルも平等に出る

- **WHEN** ホストルートにのみ存在する可視スキルがある状態でユーザーが `/` を入力する
- **THEN** そのスキルが候補に含まれる

### Requirement: 複ルートスキルカタログ

システムは可視スキルおよびスキル読込のために、ebex インストールルートとホストルート（`process.cwd()`）のそれぞれについて、次のディレクトリ配下のスキルを和集合として解決しなければならない（SHALL）: `.claude/skills` / `.cursor/skills` / `.agent/skills` / `.github/skills`。同一 `skill.id` が複数ルートに存在する場合はホスト側を優先しなければならない（SHALL）。同一ルート内で複数のホスト規約ディレクトリに同一 `skill.id` がある場合は、`.claude` → `.cursor` → `.agent` → `.github` の順で先に見つかったものを用いなければならない（SHALL）。`GET /api/agent/skills`、`/` オートコンプリート、スキル invoke の `loadSkill` / `resolveSkillDir` は同じ解決規則に従わなければならない（SHALL）。standalone 実行で両ルートが一致する場合は二重に列挙してはならない（MUST NOT）。

#### Scenario: ホストと ebex のスキルが両方見える

- **WHEN** ホストの `.claude/skills/report` と ebex の `.claude/skills/create-draft` が存在しユーザーが `/` を入力する
- **THEN** 候補に `report` と `create-draft` の両方が含まれる

#### Scenario: .cursor 配下のスキルも発見される

- **WHEN** ホストの `.cursor/skills/minutes-maid` に `SKILL.md` が存在する
- **THEN** 一覧および invoke で `minutes-maid` を解決できる

#### Scenario: 同 id はホスト優先

- **WHEN** ホストと ebex の両方に `create-draft` が存在する
- **THEN** 一覧および invoke はホスト側の `create-draft` を用いる

#### Scenario: 同一ルート内のホスト規約衝突は固定順

- **WHEN** 同一ルートに `.claude/skills/demo` と `.cursor/skills/demo` の両方が存在する
- **THEN** `.claude/skills/demo` が選ばれる

#### Scenario: /skill も同じカタログ

- **WHEN** ユーザーが `/skill` を実行する
- **THEN** 挿入される一覧は複ルート・複数ホスト規約の和集合の可視スキルと一致する

### Requirement: 薄いスキルランタイム契約

スキル実行時、ツールはスキル本文を強制解釈・書き換えしてはならない（MUST NOT）。代わりに次の抽象契約だけをランタイムの場の説明として添えてよい（MAY）。**Scope**: 既定の舞台はいま開いているプロジェクトフォルダである。実行中スキルの参照ファイル（`SKILL.md` と同じフォルダ配下、例: `references/*`）はホスト規約に依存しないスキルゾーンとして確認なしで読み取れる。スキル本文の相対パスはスキル側を優先し、成果物の書込先は `workspace/<project>/` 配下である。**Focus**: 入力が明示されていないとき第一の焦点はいま開いているファイルである。出力が明示されていないとき第一の焦点はいま開いているファイルと同じフォルダ、次点はプロジェクトフォルダ直下である。**Boundary**: プロジェクトフォルダ外のパスに触れるときはユーザ確認を必須とし、プロジェクト内で出力候補が複数あるときは勝手に確定せずユーザに選ばせなければならない（SHALL）。ランタイム場の説明は `.claude/skills/` 等のホスト規約パスをモデルへの推奨パスとして提示してはならない（MUST NOT）。

#### Scenario: 場の説明が添わる

- **WHEN** ユーザーが可視スキルを invoke する
- **THEN** リクエストに Scope / Focus / Boundary を説明する短いランタイム文脈が含まれる

#### Scenario: スキル相対パスはホスト規約を推奨しない

- **WHEN** スキル実行のランタイム文脈が生成される
- **THEN** 文脈は `references/*` 等のスキル相対パスを案内し、`.claude/skills/<id>/` を推奨表示パスとして含めない

#### Scenario: スキルの相対パス指示を尊重する

- **WHEN** スキルまたはユーザがプロジェクト内の `input/` や `export/` 等を明示している
- **THEN** ツールはその指示を Focus の既定より優先して尊重する

#### Scenario: プロジェクト外は確認する

- **WHEN** スキルまたはユーザがプロジェクトフォルダ外のパスを入出力に指定する
- **THEN** 実行前にユーザ確認 UI が表示され、否認時は当該入出力を行わない

#### Scenario: 出力先が未確定なら選ばせる

- **WHEN** 出力先がスキル／ユーザから明示されておらず複数候補がある
- **THEN** 少なくとも「開いているファイルと同じフォルダ」「プロジェクトフォルダ直下」をこの優先順で提示し、ユーザ選択後に進む

### Requirement: スキルディレクトリ基準の実行時パス契約

スキル invoke 時、システムは解決済みの `skillDirAbsolute`（当該 `SKILL.md` の親ディレクトリ）を実行コンテキストに保持しなければならない（SHALL）。読取系ツールがスキル相対パス（例: `references/purpose.md`）またはホスト非依存のスキル論理パス（例: `skill/<実行中skillId>/...`）を受け取ったとき、実ファイルは `skillDirAbsolute` 配下へ解決しなければならない（SHALL）。パス解決ロジックは `.claude` / `.cursor` 等のホスト規約文字列を必須条件としてはならない（MUST NOT）。スキルゾーンへの書込は拒否しなければならない（SHALL）。

#### Scenario: references は SKILL.md と同じフォルダから読む

- **WHEN** 実行中スキルのディレクトリに `references/purpose.md` があり、`read_file` が `references/purpose.md` を要求する
- **THEN** 当該スキルディレクトリ上のファイルが読まれ、確認ダイアログは出ない

#### Scenario: .cursor 配置でも同じ相対パスで読める

- **WHEN** スキルが `.cursor/skills/minutes-maid` にあり `read_file` が `references/base.html` を要求する
- **THEN** `.cursor/skills/minutes-maid/references/base.html` が読まれる

#### Scenario: スキルゾーンへの書込は拒否

- **WHEN** `write_file` の対象が実行中スキルディレクトリ配下に解決される
- **THEN** 書込は実行されず、拒否理由がツール結果として返る

### Requirement: サブエージェント指示の検出とフォールバック

システムはスキル本文に文字列「サブエージェント」が含まれる場合、EBEX がサブエージェントを起動できないことをユーザーに明示し、同一エージェント・同一セッションでの通常実行にフォールバックしなければならない（SHALL）。v1 の検出キーワードは「サブエージェント」のみとし、英語表記や Task tool 名の広範検出は必須としない（MUST NOT require）。フォールバック時、ランタイムはモデル向けに「サブエージェントを起動せず、同じセッション内で自ら役割を順に実行する」旨の短い案内を添えてよい（MAY）。サブエージェント用の実ツールを提供してはならない（MUST NOT）。

#### Scenario: キーワード検出時にユーザーへ案内する

- **WHEN** 本文に「サブエージェント」を含むスキルをユーザーが invoke する
- **THEN** ユーザーに対し、EBEX はサブエージェント非対応であり同一セッションで続行する旨が表示される

#### Scenario: キーワードが無いスキルでは案内しない

- **WHEN** 本文に「サブエージェント」を含まないスキルを invoke する
- **THEN** サブエージェント非対応の特別案内は表示されない

#### Scenario: 検出後も同一セッションで実行する

- **WHEN** 「サブエージェント」を含むスキルが検出される
- **THEN** システムは実行を中止せず、既存の単一 agent loop でスキル実行を続行する
