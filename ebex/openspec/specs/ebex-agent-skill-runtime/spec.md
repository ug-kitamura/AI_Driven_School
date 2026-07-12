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

システムは可視スキルおよびスキル読込のために、ebex インストールルートとホストルート（`process.cwd()`）の `.claude/skills` を和集合として解決しなければならない（SHALL）。同一 `skill.id` が両方に存在する場合はホスト側を優先しなければならない（SHALL）。`GET /api/agent/skills`、`/` オートコンプリート、スキル invoke の `loadSkill` は同じ解決規則に従わなければならない（SHALL）。standalone 実行で両ルートが一致する場合は二重に列挙してはならない（MUST NOT）。

#### Scenario: ホストと ebex のスキルが両方見える

- **WHEN** ホストの `.claude/skills/report` と ebex の `.claude/skills/create-draft` が存在しユーザーが `/` を入力する
- **THEN** 候補に `report` と `create-draft` の両方が含まれる

#### Scenario: 同 id はホスト優先

- **WHEN** ホストと ebex の両方に `create-draft` が存在する
- **THEN** 一覧および invoke はホスト側の `create-draft` を用いる

#### Scenario: /skill も同じカタログ

- **WHEN** ユーザーが `/skill` を実行する
- **THEN** 挿入される一覧は複ルート和集合の可視スキルと一致する

### Requirement: 薄いスキルランタイム契約

スキル実行時、ツールはスキル本文を強制解釈・書き換えしてはならない（MUST NOT）。代わりに次の抽象契約だけをランタイムの場の説明として添えてよい（MAY）。**Scope**: 既定の舞台はいま開いているプロジェクトフォルダである。**Focus**: 入力が明示されていないとき第一の焦点はいま開いているファイルである。出力が明示されていないとき第一の焦点はいま開いているファイルと同じフォルダ、次点はプロジェクトフォルダ直下である。**Boundary**: プロジェクトフォルダ外のパスに触れるときはユーザ確認を必須とし、プロジェクト内で出力候補が複数あるときは勝手に確定せずユーザに選ばせなければならない（SHALL）。

#### Scenario: 場の説明が添わる

- **WHEN** ユーザーが可視スキルを invoke する
- **THEN** リクエストに Scope / Focus / Boundary を説明する短いランタイム文脈が含まれる

#### Scenario: スキルの相対パス指示を尊重する

- **WHEN** スキルまたはユーザがプロジェクト内の `input/` や `export/` 等を明示している
- **THEN** ツールはその指示を Focus の既定より優先して尊重する

#### Scenario: プロジェクト外は確認する

- **WHEN** スキルまたはユーザがプロジェクトフォルダ外のパスを入出力に指定する
- **THEN** 実行前にユーザ確認 UI が表示され、否認時は当該入出力を行わない

#### Scenario: 出力先が未確定なら選ばせる

- **WHEN** 出力先がスキル／ユーザから明示されておらず複数候補がある
- **THEN** 少なくとも「開いているファイルと同じフォルダ」「プロジェクトフォルダ直下」をこの優先順で提示し、ユーザ選択後に進む
