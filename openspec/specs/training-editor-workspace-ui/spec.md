# training-editor-workspace-ui Specification

## Purpose

DX Training Editor のワークスペース UI（Pane1/Pane2）における進捗表示、ヘッダー高さ、階層別追加ボタン（シリーズ・コース・レッスン）の配置と見た目を定義する。`refine-training-editor-ui` change により確定した挙動を正本とする。

## Requirements

### Requirement: Workspace header height alignment

Pane1 (`SeriesCoursePane`) sidebar header and the main area `GlobalHeader` SHALL both render at a fixed height of `h-12` (48px) so their bottom `border-b` edges align horizontally at the top-left junction of the workspace.

#### Scenario: Headers align when Pane1 is expanded

- **WHEN** Pane1 が展開された状態でワークスペースを表示する
- **THEN** Pane1 ワークスペース名ヘッダーの下線と GlobalHeader の下線が同じ高さにある

#### Scenario: Pane1 header uses fixed height

- **WHEN** Pane1 ヘッダーを描画する
- **THEN** ヘッダーコンテナは `h-12 shrink-0` を用い、内容は縦方向中央揃えとする
- **AND** 合計高さが 48px を超えるような内容起点の padding は用いない

### Requirement: Global progress removed

The editor SHALL NOT display a cross-series global lesson completion progress block in Pane1.

#### Scenario: No global progress card

- **WHEN** Pane1 のコンテンツが表示される（展開時）
- **THEN** シリーズ一覧の上に全体進捗カードは存在しない

### Requirement: Course progress matches series progress style

When a course is selected, Pane2 SHALL show course progress using the same visual pattern as series progress in Pane1: small label, done/total fraction, and a thin progress bar without an extra section divider below the progress block.

#### Scenario: Course progress styling

- **WHEN** レッスンを含むコースが Pane2 で選択されている
- **THEN** UI は「コース進捗」ラベルと完了数/総レッスン数、およびシリーズ進捗と整合する細い `Progress`（おおよそ `text-[10px]` ラベル、`h-1` バー）を表示する

#### Scenario: No border below course progress only

- **WHEN** コース進捗が表示されている
- **THEN** 進捗ブロックとレッスン一覧の間だけを分ける `border-b` はない
- **AND** コースメタ情報エリア下の `border-b` は維持してよい

### Requirement: Child entity add buttons use dashed full-width pattern

Adding a course (within a series) and adding a lesson (within a course) SHALL use the same dashed-border full-width ghost button at the bottom of the respective list, with a Plus icon and explicit Japanese label.

#### Scenario: Add course button placement

- **WHEN** Pane1 でシリーズが展開されている
- **THEN** そのシリーズのコース一覧の直下に「コースを追加」dashed 全幅ボタンが表示される

#### Scenario: Add course button not on series row hover

- **WHEN** ユーザーが Pane1 のシリーズ行見出しを見る
- **THEN** コース追加用の hover 表示のみの Plus アイコンはシリーズ行にない

#### Scenario: Add lesson button unchanged pattern

- **WHEN** Pane2 でコースが選択されている
- **THEN** 「レッスンを追加」はレッスン一覧下の dashed 全幅ボタンのままとし、コース追加ボタンと同じ視覚クラスを用いる

### Requirement: Series add action in Pane1 footer

Adding a series SHALL be initiated from a control fixed at the bottom of Pane1 (`SidebarFooter`), not from a button that scrolls with the series list.

#### Scenario: Series add in footer when expanded

- **WHEN** Pane1 が展開されている
- **THEN** Pane1 フッターに dashed 全幅の「シリーズを追加」が表示される

#### Scenario: Series add icon-only when collapsed

- **WHEN** Pane1 がアイコンモードに折りたたまれている
- **THEN** フッターには Plus アイコンのみのボタンが表示される
- **AND** アクセシブル名「シリーズを追加」が `aria-label` および/または `sr-only` で提供される

### Requirement: Empty series list onboarding

When there are zero series, Pane1 SHALL guide the user to create the first series via the footer add action.

#### Scenario: Empty state copy

- **WHEN** `series.length === 0` かつ Pane1 が展開されている
- **THEN** コンテンツ領域に最初のシリーズ追加を促す短い誘導文が表示される
- **AND** 主 CTA はフッターの「シリーズを追加」のみとし、スクロール領域に重複ボタンを置かない

#### Scenario: No course or lesson UI without series

- **WHEN** シリーズが 0 件である
- **THEN** Pane1 にシリーズアコーディオンやシリーズ別コース追加 UI は表示されない
