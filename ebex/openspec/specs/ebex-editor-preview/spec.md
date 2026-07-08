# ebex-editor-preview Specification

## Purpose
TBD - created by archiving change ebex-v1-workspace. Update Purpose after archive.
## Requirements
### Requirement: 編集／プレビュー切替

Pane 2 はヘッダー右の下線タブ（dx-training-studio の `ImageTabBar` と同系のスタイル）により編集モードとプレビューモードを切り替えられなければならない（SHALL）。タブには「Edit」「Preview」のラベルと既存と同様のアイコンを含めなければならない（SHALL）。エディタは CodeMirror を使用しなければならない（SHALL）。

#### Scenario: 編集からプレビューへ切替

- **WHEN** ユーザーがプレビュータブを選択する
- **THEN** 現在のファイル内容がプレビュー表示される

#### Scenario: 切替タブの見た目

- **WHEN** プレビュー対応ファイルを開きヘッダーを確認する
- **THEN** 編集／プレビュー切替がヘッダー右に下線タブとして表示され、選択中タブは下線と強調色で示される

### Requirement: プレビュー対応拡張子

以下の拡張子はプレビューを提供しなければならない（SHALL）: md（react-markdown）、html（スクリプト実行を許可したサンドボックス iframe）、csv（表表示）、json / yml（整形表示、パースエラー時はエラー表示）、vtt（タイムスタンプ付き発話リスト、話者ラベルがあれば表示）。プレビュー表示はペイン内で縦スクロール可能でなければならない（SHALL）。

#### Scenario: Markdown プレビュー

- **WHEN** ユーザーが `.md` ファイルのプレビューを表示する
- **THEN** Markdown がレンダリングされて表示される

#### Scenario: Markdown プレビューのスクロール

- **WHEN** ユーザーがビューポートより長い `.md` のプレビューを表示する
- **THEN** プレビュー領域を縦スクロールして末尾まで読める

#### Scenario: HTML プレビューでスクリプトが動く

- **WHEN** ユーザーが Tailwind CDN や Lucide 初期化などスクリプトを含む `.html` をプレビューする
- **THEN** iframe 内でスクリプトが実行され、スタイルおよびアイコンが適用された状態で表示される

#### Scenario: CSV 表プレビュー

- **WHEN** ユーザーが `.csv` ファイルのプレビューを表示する
- **THEN** 表形式でデータが表示される

#### Scenario: JSON パースエラー

- **WHEN** ユーザーが不正な `.json` ファイルのプレビューを表示する
- **THEN** パースエラーメッセージが表示される

#### Scenario: VTT プレビュー

- **WHEN** ユーザーが `.vtt` ファイルのプレビューを表示する
- **THEN** タイムスタンプ付きの発話リストが表示される

### Requirement: 非対応拡張子の扱い

プレビュー非対応のファイルはプレーンテキストとして扱われなければならない（SHALL）。プレビューモードでも編集画面と同じ内容が表示されなければならない（SHALL）。

#### Scenario: テキストファイルのプレビュー

- **WHEN** ユーザーが `.txt` ファイルのプレビューを表示する
- **THEN** プレーンテキストがそのまま表示される

### Requirement: Pane 2 ヘッダー

ヘッダー左には選択中ファイルのファイル名のみを表示しなければならない（SHALL）。表示スタイルは Pane 3 ヘッダー左の「Agent」と同様に `text-sm font-medium` でなければならない（SHALL）。フォルダパスを含むパンくずは表示してはならない（MUST NOT）。プレビュー対応ファイルではヘッダー右に編集／プレビュー切替を配置しなければならない（SHALL）。

#### Scenario: ファイル名表示

- **WHEN** ユーザーがフォルダ `demo` のファイル `notes.md` を開いている
- **THEN** ヘッダー左に `notes.md` のみが表示される

#### Scenario: パンくずを出さない

- **WHEN** ユーザーがネストしたフォルダ内のファイルを開いている
- **THEN** ヘッダー左にフォルダパスや `>` / `/` 区切りのパンくずは表示されない

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

ファイル内容の変更は debounce 後に自動保存されなければならない（SHALL）。保存失敗時はエラーメッセージが表示されなければならない（SHALL）。

#### Scenario: 編集内容の自動保存

- **WHEN** ユーザーがファイルを編集する
- **THEN** debounce 後にファイル内容がディスクに保存される
