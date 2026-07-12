# ebex-editor-preview Specification

## Purpose
Pane 2 のファイル種別モード解決、編集／プレビュー／閲覧表示、自動保存に関する仕様。
## Requirements
### Requirement: ファイル種別モード解決

Pane 2 は選択中ファイルの拡張子から表示モードを解決しなければならない（SHALL）。モードは次のいずれかでなければならない（SHALL）: `edit-preview`（Edit|Preview タブ）、`edit-only`（編集のみ・タブなし）、`view-only`（閲覧のみ・タブなし）。

`edit-preview` 対象は次でなければならない（SHALL）: `md`, `html`, `htm`, `csv`, `json`, `yml`, `yaml`, `vtt`。

`edit-only` 対象は少なくとも次を含まなければならない（SHALL）: `py`, `js`, `jsx`, `ts`, `tsx`, `css`, `bat`, `ps1`, `sh`, `txt`。

`view-only` 対象は少なくとも次を含まなければならない（SHALL）: `png`, `jpg`, `jpeg`, `webp`, `gif`, `svg`, `pdf`, `zip`。

上記いずれにも該当しないバイナリ／未知形式は、UTF-8 テキストとして開いてはならない（MUST NOT）。タブなしで非対応メッセージを表示しなければならない（SHALL）。

#### Scenario: Markdown は Edit|Preview

- **WHEN** ユーザーが `.md` ファイルを開く
- **THEN** ヘッダー右に Edit|Preview タブが表示される

#### Scenario: TypeScript は Edit のみ

- **WHEN** ユーザーが `.ts` ファイルを開く
- **THEN** Edit|Preview タブは表示されず、文法ハイライト付きの編集ビューが表示される

#### Scenario: PNG は View のみ

- **WHEN** ユーザーが `.png` ファイルを開く
- **THEN** Edit|Preview タブは表示されず、画像の閲覧ビューが表示される

#### Scenario: 未知バイナリはテキストで開かない

- **WHEN** ユーザーがモード未定義のバイナリ拡張子のファイルを開く
- **THEN** 非対応メッセージが表示され、ファイル内容は UTF-8 テキストとしてエディタに載らない

### Requirement: 編集時の言語別文法ハイライト

`edit-preview` および `edit-only` の編集ビューは CodeMirror を用い、ファイル拡張子に応じた文法ハイライトを適用しなければならない（SHALL）。`.md` は Markdown 文法（フェンス内の入れ子ハイライト含む）でなければならない（SHALL）。少なくとも `py`, `js`, `jsx`, `ts`, `tsx`, `css`, `json`, `yml`/`yaml`, `bat`, `ps1`, `sh` は対応言語でハイライトされなければならない（SHALL）。対応言語が無い拡張子はプレーンテキストとして編集できなければならない（SHALL）。

#### Scenario: Python ファイルのハイライト

- **WHEN** ユーザーが `.py` ファイルを編集モードで開く
- **THEN** Python の文法に応じたハイライトが適用される

#### Scenario: JSON ファイルのハイライト

- **WHEN** ユーザーが `.json` ファイルを編集モードで開く
- **THEN** JSON の文法に応じたハイライトが適用される

### Requirement: Markdown プレビューの下地

Markdown プレビュー表示領域の背景はカード面（`bg-card` / 白ベースのトークン）でなければならず（SHALL）、Workspace のページ背景グレーがプレビュー本文の下地として露出してはならない（MUST NOT）。

#### Scenario: MD プレビューが白下地

- **WHEN** ユーザーが `.md` の Preview を表示する
- **THEN** プレビュー領域の背景はカード面の白ベースであり、ページ背景のグレー一色で塗りつぶされていない

### Requirement: 画像の View 表示

`view-only` の画像ファイルは、ペイン内に画像そのものを表示しなければならない（SHALL）。内容は UTF-8 テキストとして読み込んではならない（MUST NOT）。自動保存してはならない（MUST NOT）。

#### Scenario: JPEG を画像として表示

- **WHEN** ユーザーが `.jpg` ファイルを開く
- **THEN** プレビュー相当の単一ビューに画像が表示される

### Requirement: PDF の View 表示

`view-only` の PDF は、ペイン内に PDF 内容を表示しなければならない（SHALL）（ブラウザ標準の埋め込みビューアでよい）。内容は UTF-8 テキストとして読み込んではならない（MUST NOT）。自動保存してはならない（MUST NOT）。

#### Scenario: PDF を埋め込み表示

- **WHEN** ユーザーが `.pdf` ファイルを開く
- **THEN** 単一ビューに PDF 内容が表示される

### Requirement: zip エントリ一覧の View 表示

`view-only` の zip は、アーカイブ内のファイルパス一覧を表示しなければならない（SHALL）。中身の展開プレビューや内部ファイルのクリックオープンは必須ではない。内容は UTF-8 テキストとして読み込んではならない（MUST NOT）。自動保存してはならない（MUST NOT）。

#### Scenario: zip の一覧表示

- **WHEN** ユーザーが `.zip` ファイルを開く
- **THEN** 単一ビューにアーカイブ内エントリのパス一覧が表示される

### Requirement: バイナリ読み取り経路の分離

画像・PDF・zip およびその他の非テキスト閲覧は、テキスト用 `read-file`（UTF-8 本文）経路に載せてはならない（MUST NOT）。画像／PDF はバイト列配信（適切な Content-Type）または同等の安全な URL 解決を用いなければならない（SHALL）。zip 一覧は専用 API または同等のサーバ処理でエントリ名を返さなければならない（SHALL）。パス解決は workspace 内に限定しなければならない（SHALL）。

#### Scenario: 画像表示で read-file の UTF-8 本文を使わない

- **WHEN** ユーザーが画像ファイルを開く
- **THEN** 表示はバイナリ配信経路を用い、UTF-8 のテキスト本文としては扱われない

### Requirement: 編集／プレビュー切替

Pane 2 は、`edit-preview` モードのファイルに限り、ヘッダー右の下線タブ（dx-training-studio の `ImageTabBar` と同系のスタイル）により編集モードとプレビューモードを切り替えられなければならない（SHALL）。タブには「Edit」「Preview」のラベルと既存と同様のアイコンを含めなければならない（SHALL）。`edit-only` および `view-only` では当該タブを表示してはならない（MUST NOT）。`edit-preview` / `edit-only` の編集ビューは CodeMirror を使用しなければならない（SHALL）。

#### Scenario: 編集からプレビューへ切替

- **WHEN** ユーザーが `edit-preview` 対象ファイルでプレビュータブを選択する
- **THEN** 現在のファイル内容がプレビュー表示される

#### Scenario: 切替タブの見た目

- **WHEN** `edit-preview` 対象ファイルを開きヘッダーを確認する
- **THEN** 編集／プレビュー切替がヘッダー右に下線タブとして表示され、選択中タブは下線と強調色で示される

#### Scenario: edit-only ではタブなし

- **WHEN** ユーザーが `.py` など `edit-only` 対象ファイルを開く
- **THEN** Edit|Preview タブは表示されない

### Requirement: プレビュー対応拡張子

`edit-preview` 対象の拡張子はプレビューを提供しなければならない（SHALL）: md（react-markdown）、html（スクリプト実行を許可したサンドボックス iframe）、csv（表表示）、json / yml（整形表示、パースエラー時はエラー表示）、vtt（タイムスタンプ付き発話リスト、話者ラベルがあれば表示）。プレビュー表示はペイン内で縦スクロール可能でなければならない（SHALL）。HTML プレビューは iframe 内ではなく Pane 2 プレビュー領域（`workspace-scrollbar` を適用した外側コンテナ）で縦スクロールしなければならない（SHALL）。HTML プレビューの縦スクロールバーは Markdown プレビューおよび Pane 3 と同じ `workspace-scrollbar` 見た目でなければならない（SHALL）。

#### Scenario: Markdown プレビュー

- **WHEN** ユーザーが `.md` ファイルのプレビューを表示する
- **THEN** Markdown がレンダリングされて表示される

#### Scenario: Markdown プレビューのスクロール

- **WHEN** ユーザーがビューポートより長い `.md` のプレビューを表示する
- **THEN** プレビュー領域を縦スクロールして末尾まで読める

#### Scenario: HTML プレビューでスクリプトが動く

- **WHEN** ユーザーが Tailwind CDN や Lucide 初期化などスクリプトを含む `.html` をプレビューする
- **THEN** iframe 内でスクリプトが実行され、スタイルおよびアイコンが適用された状態で表示される

#### Scenario: HTML プレビューのスクロール

- **WHEN** ユーザーがビューポートより長い `.html` をプレビューする
- **THEN** Pane 2 プレビュー領域（外側コンテナ）を縦スクロールして末尾まで読める

#### Scenario: HTML プレビューのスクロールバー

- **WHEN** ユーザーが `.html` ファイルのプレビューを表示し、内容が溢れて縦スクロールが発生する
- **THEN** 表示される縦スクロールバーは `workspace-scrollbar` と同じ形状・色である

#### Scenario: CSV 表プレビュー

- **WHEN** ユーザーが `.csv` ファイルのプレビューを表示する
- **THEN** 表形式でデータが表示される

#### Scenario: JSON パースエラー

- **WHEN** ユーザーが不正な `.json` ファイルのプレビューを表示する
- **THEN** パースエラーメッセージが表示される

#### Scenario: VTT プレビュー

- **WHEN** ユーザーが `.vtt` ファイルのプレビューを表示する
- **THEN** タイムスタンプ付きの発話リストが表示される

### Requirement: Pane 2 ヘッダー

ヘッダー左には選択中ファイルのファイル名のみを表示しなければならない（SHALL）。表示スタイルは Pane 3 ヘッダー左の「Agent」と同様に `text-sm font-medium` でなければならない（SHALL）。フォルダパスを含むパンくずは表示してはならない（MUST NOT）。`edit-preview` 対象ファイルではヘッダー右に編集／プレビュー切替を配置しなければならない（SHALL）。`edit-only` / `view-only` ではヘッダー右に当該切替を配置してはならない（MUST NOT）。

#### Scenario: ファイル名表示

- **WHEN** ユーザーがフォルダ `demo` のファイル `notes.md` を開いている
- **THEN** ヘッダー左に `notes.md` のみが表示される

#### Scenario: パンくずを出さない

- **WHEN** ユーザーがネストしたフォルダ内のファイルを開いている
- **THEN** ヘッダー左にフォルダパスや `>` / `/` 区切りのパンくずは表示されない

#### Scenario: view-only では切替なし

- **WHEN** ユーザーが `.png` を開いている
- **THEN** ヘッダー右に Edit|Preview 切替は表示されない

### Requirement: 編集時の折りたたみ gutter

編集モードの CodeMirror は、行番号列の右側に折りたたみ gutter 列を常に持たなければならない（SHALL）。この列の幅と基本スタイルはファイル種別によらず同一でなければならない（SHALL）。折りたたみ操作（見出し / front matter の折りたたみ、列ホバー時の ▼ 表示）は `.md` ファイルでのみ有効でなければならない（SHALL）。非 `.md` ではマーカーが出ず折りたたみできないが、列自体は維持しなければならない（SHALL）。ホバー挙動は dx-training-studio と同様、折りたたみ列へのマウスオーバーで開状態マーカー（▼）が表示されなければならない（SHALL）。

#### Scenario: Markdown で折りたたみできる

- **WHEN** ユーザーが `.md` を編集し、折りたたみ可能な見出し行の gutter 列にマウスを乗せて ▼ をクリックする
- **THEN** 対応する本文範囲が折りたたまれる

#### Scenario: 非 Markdown でも gutter 列がある

- **WHEN** ユーザーが `.json` など非 `.md` ファイルを編集する
- **THEN** 行番号の右に折りたたみ gutter 列が表示され、Markdown 編集時と列幅が変わらない

#### Scenario: 非 Markdown では折れない

- **WHEN** ユーザーが非 `.md` ファイルの折りたたみ gutter 列をホバーまたはクリックする
- **THEN** 折りたたみマーカーは現れず、本文は折りたたまれない

### Requirement: ファイル未選択時

ファイルが選択されていない場合、空状態メッセージが表示されなければならない（SHALL）。最後に開いたファイルのパスは localStorage に記憶し、次回起動時に復元を試みなければならない（SHALL）。

#### Scenario: 未選択時の空状態

- **WHEN** ファイルが選択されていない
- **THEN** ファイルを選択するよう促す空状態メッセージが表示される

#### Scenario: 最後のファイル復元

- **WHEN** ユーザーがファイルを開いた後にページをリロードする
- **THEN** 最後に開いていたファイルが自動的に選択される

### Requirement: 自動保存

`edit-preview` および `edit-only` におけるファイル内容の変更は debounce 後に自動保存されなければならない（SHALL）。保存失敗時はエラーメッセージが表示されなければならない（SHALL）。`view-only` および非対応表示のファイルに対して自動保存を実行してはならない（MUST NOT）。

#### Scenario: 編集内容の自動保存

- **WHEN** ユーザーが編集可能なファイルを編集する
- **THEN** debounce 後にファイル内容がディスクに保存される

#### Scenario: 画像では自動保存しない

- **WHEN** ユーザーが画像ファイルを開いている
- **THEN** 自動保存は実行されない
