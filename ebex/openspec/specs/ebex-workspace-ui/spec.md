# ebex-workspace-ui Specification

## Purpose
TBD - created by archiving change ebex-v1-workspace. Update Purpose after archive.
## Requirements
### Requirement: 3 ペイン構成

ワークスペースは Pane 1（ファイルツリー）、Pane 2（編集+プレビュー）、Pane 3（Agent）の 3 ペインで構成されなければならない（SHALL）。Pane 1 ヘッダーにはツール名 **EBEX** が表示されなければならない（SHALL）。

#### Scenario: 3 ペインが同時に表示される

- **WHEN** ユーザーが EBEX を起動する
- **THEN** ファイルツリー、エディタ、Agent の 3 ペインが横並びで表示される

#### Scenario: Pane 1 に EBEX 表示

- **WHEN** ワークスペースが表示される
- **THEN** Pane 1 のヘッダーに「EBEX」が表示される

### Requirement: ペインリサイズ

各ペイン間のリサイズハンドルで幅を変更できなければならない（SHALL）。`pane-layout.ts` は pane1 / pane2 / pane3 の 3 ペイン用に定義されなければならない（SHALL）。ペイン幅は localStorage に永続化されなければならない（SHALL）。

#### Scenario: リサイズハンドルで幅変更

- **WHEN** ユーザーがペイン間のリサイズハンドルをドラッグする
- **THEN** 隣接ペインの幅が更新される

#### Scenario: リロード後に幅が復元される

- **WHEN** ユーザーがペイン幅を変更してページをリロードする
- **THEN** 変更後のペイン幅が復元される

### Requirement: テーマ初期化

`ThemeInitializer` により workspace-settings のテーマ設定（light / dark / system）が適用されなければならない（SHALL）。

#### Scenario: ダークテーマ適用

- **WHEN** 設定でテーマが dark に設定されている
- **THEN** ワークスペース全体がダークテーマで表示される

### Requirement: GlobalHeader の簡略化

dx-training-studio の曼陀羅ボタン、シリーズ名表示、社内コンテキストボタンは含めてはならない（MUST NOT）。設定（⚙）は Pane 2 / Pane 3 のヘッダーに配置し、GlobalHeader は使用しない（SHALL）。

#### Scenario: 曼陀羅が表示されない

- **WHEN** ワークスペースが表示される
- **THEN** 曼陀羅ボタンは存在しない

