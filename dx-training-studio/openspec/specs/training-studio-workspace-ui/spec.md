# training-studio-workspace-ui Specification

## Purpose

DX Training Studio のワークスペース UI（Pane1/Pane2）における進捗表示、ヘッダー高さ、階層別追加ボタン（シリーズ・コース・レッスン）の配置と見た目を定義する。`refine-training-editor-ui` change により確定した挙動を正本とする。
## Requirements
### Requirement: ワークスペースヘッダー高さの揃え

統合ツリーペインのヘッダーとメイン領域の `GlobalHeader` は、いずれも `h-12`（48px）の固定高で描画し、ワークスペース左上の接合部で下側の `border-b` が水平に揃うようにしなければならない（SHALL）。

#### Scenario: ツリーペイン展開時にヘッダー下線が揃う

- **WHEN** 統合ツリーペインが展開された状態でワークスペースを表示する
- **THEN** ツリーペインのワークスペース名ヘッダーの下線と GlobalHeader の下線が同じ高さにある

#### Scenario: ツリーペインヘッダーは固定高を用いる

- **WHEN** ツリーペインのヘッダーを描画する
- **THEN** ヘッダーコンテナは `h-12 shrink-0` を用い、内容は縦方向中央揃えとする
- **AND** 合計高さが 48px を超えるような内容起点の padding は用いない

### Requirement: 全体進捗の削除

エディタは、Pane1 にシリーズ横断のレッスン完了全体進捗ブロックを表示してはならない（SHALL NOT）。

#### Scenario: 全体進捗カードがない

- **WHEN** Pane1 のコンテンツが表示される（展開時）
- **THEN** シリーズ一覧の上に全体進捗カードは存在しない

### Requirement: シリーズ 0 件時のオンボーディング

シリーズが 0 件のとき、統合ツリーペインは右クリック（空きスペースのコンテキストメニュー）から最初のシリーズを作成するようユーザーを案内しなければならない（SHALL）。

#### Scenario: 空状態の文言

- **WHEN** `series.length === 0` の状態でツリーペインを表示する
- **THEN** 右クリックからシリーズを追加できる旨の短い誘導文が表示される
- **AND** スクロール領域やフッターに追加ボタンは置かない

#### Scenario: シリーズなしではコース・レッスン UI を出さない

- **WHEN** シリーズが 0 件である
- **THEN** ツリーにコース行・レッスン行・子追加の UI は表示されない

### Requirement: GlobalHeader に曼陀羅と設定を並置する

`GlobalHeader` はパンくずを左、右側に DX トレーニング曼陀羅ボタン・社内コンテキストボタン・GitHub リンク・設定ボタンをこの順で配置しなければならない（SHALL）。社内コンテキストの詳細は `company-context-dialog` に従う。設定の詳細は `training-studio-workspace-settings` に従う。

GitHub リンクは全体メタ（`contents/.meta.json`）の `github_url` を新しいタブで開くアイコンボタンとしなければならない（SHALL）。`github_url` が未設定（空）のときはボタンを表示してはならない（MUST NOT）。アイコンは GitHub のマーク（インライン SVG）とし、通常時はサブテキスト色・ホバーで primary 色という隣接ボタンと同じ振る舞いに揃える（SHALL）。塗りつぶしのマークは同じ外接箱の線アイコンより大きく見えるため、寸法は隣の設定アイコンと視覚的に釣り合う値へ目視で確定する。

#### Scenario: 右端に設定が表示される

- **WHEN** ワークスペースを表示する
- **THEN** GlobalHeader 右側に設定アイコンが右端にある

#### Scenario: 社内コンテキストが曼陀羅と設定の間にある

- **WHEN** ワークスペースを表示する
- **THEN** GlobalHeader 右側に社内コンテキストボタンが曼陀羅と GitHub リンクの間に表示される

#### Scenario: GitHub リンクが設定の左にある

- **WHEN** `github_url` が設定されたワークスペースを表示する
- **THEN** GitHub アイコンが社内コンテキストボタンと設定アイコンの間に表示される
- **AND** クリックすると `github_url` が新しいタブで開く

#### Scenario: github_url 未設定ならアイコンが出ない

- **WHEN** `contents/.meta.json` に `github_url` が無いワークスペースを表示する
- **THEN** GlobalHeader に GitHub アイコンは表示されない

### Requirement: ダイアログ内ボタンはホバー時に識別できる

業務 Dialog および設定 Dialog（`DialogContent` 内）の `outline` および `ghost` ボタンは、ポインタホバー時に背景色または文字色が変化し、非ホバー状態と識別できなければならない（SHALL）。ワークスペースペイン内・GlobalHeader 上のボタンは本要件の対象外としてよい（MAY）。

#### Scenario: 設定ダイアログのキャンセルにホバー反応がある

- **WHEN** ユーザーが設定ダイアログを開く
- **AND** キャンセル（outline）ボタンにポインタを載せる
- **THEN** ボタン背景または文字色が変化して識別できる

#### Scenario: 削除確認ダイアログのキャンセルにホバー反応がある

- **WHEN** ユーザーがコース削除確認ダイアログを開く
- **AND** キャンセル（outline）ボタンにポインタを載せる
- **THEN** ボタン背景または文字色が変化して識別できる

### Requirement: Pane1/Pane2 のリスト横余白を共有定数で揃える

Pane1 の `SidebarContent` および `SidebarFooter`、Pane2 のルートスクロール領域は、いずれも `PANE_LIST_CONTENT_X_INSET_CLASS`（`pl-1 pr-3`）で横余白を揃えなければならない（SHALL）。左は `pl-1`、右は `pr-3` とし、Pane1 フッターの「シリーズを追加」ボタンはコンテンツ列と右端が一致しなければならない（SHALL）。

#### Scenario: Pane2 の右余白が一段広い

- **WHEN** Pane2 でコースが選択されている
- **THEN** リストコンテンツの右パディングは `pr-3` である

#### Scenario: Pane1 フッターがコンテンツと右揃え

- **WHEN** Pane1 が展開されている
- **THEN** シリーズ一覧とフッターの「シリーズを追加」ボタンの右端が揃う

### Requirement: Pane2 サマリー要素は左インデント列に揃える

Pane2 では、コース名・対象者行・ミニ曼陀羅・コース進捗・レッスン一覧を `LIST_CHILD_LEFT_INSET_CLASS` の同一列に配置し、左端を揃えなければならない（SHALL）。対象者行は `text-[10px] text-muted-foreground` とし、コース名直下の余白はコース進捗ラベルより狭く（例: `mb-1`）しなければならない（SHALL）。

#### Scenario: コース名と曼陀羅の左端が一致する

- **WHEN** Pane2 でコースが選択されている
- **THEN** コース名、対象行、ミニ曼陀羅サムネイルの左端が視覚的に揃う

#### Scenario: 対象行のスタイル

- **WHEN** 対象者行が表示される
- **THEN** ラベルは `text-[10px] text-muted-foreground` で表示される

### Requirement: ミニ曼陀羅サムネイルの枠表現

Pane2 のミニ曼陀羅サムネイル（クリックで拡大）は、`bg-muted/30` の背景と `border-border/50` 程度の弱い枠線でクリック可能領域を示さなければならない（SHALL）。上下にはミニ曼陀羅専用の余白（例: `my-3`）を設け、対象行・コース進捗との間を空けなければならない（SHALL）。ホバー時は背景をやや濃く（例: `hover:bg-muted/50`）してよい（MAY）。

#### Scenario: サムネイルが背景差で識別できる

- **WHEN** Pane2 でミニ曼陀羅サムネイルが表示される
- **THEN** 周囲の `bg-card` と背景色・弱い枠で区別できる

#### Scenario: サムネイル上下に余白がある

- **WHEN** 対象行の下にミニ曼陀羅が表示される
- **THEN** 対象行と曼陀羅、曼陀羅とコース進捗の間に視認できる縦余白がある

### Requirement: supergraphic バナー

Studio の画面は、最上部に高さ 6px・全幅の supergraphic バナーを表示しなければならない（SHALL）。EBEX の同名要件（`ebex-workspace-ui`）と同型の表示とする。画像はツール埋め込み資産として `app/` 直下（ファビコンと同じ場所）に置き、静的 import で参照しなければならない（SHALL）。正本 `images/` に置いてはならない（SHALL NOT）——正本はペイン4 の画像マネージャの管理下にあり、ユーザーが UI から削除できるため。

#### Scenario: 画面表示時にバナーが出る

- **WHEN** Studio のワークスペースを表示する
- **THEN** 画面最上部に高さ 6px・全幅の supergraphic バナーが表示される

#### Scenario: 画面幅を変えても全幅を保つ

- **WHEN** ブラウザの横幅を変更する
- **THEN** バナーは常に全幅を占め、supergraphic の色帯の横方向の並びが保たれる

