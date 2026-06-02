# training-editor-ai-image-generation Specification

## Purpose
TBD - created by archiving change pane4-ai-generation-and-settings. Update Purpose after archive.
## Requirements
### Requirement: AI タブは選択レッスン内の画像スロットを一覧する

AI タブは、ワークスペースで選択中のレッスンの本文（フロントマター除く）から、正本形式 `images/<filename>` の Markdown 画像参照を抽出して一覧表示しなければならない（SHALL）。各行はファイル名・alt テキスト・状態（正本未作成／staging のみ／正本あり）を示さなければならない（SHALL）。他レッスン・他コースの参照は含めてはならない（MUST NOT）。

#### Scenario: 骨子プレースホルダが未生成として表示される

- **WHEN** 本文に `![diagram] 説明](images/git-flow.png)` がある
- **AND** `images/git-flow.png` が存在しない
- **AND** `images/ai/git-flow.png` も存在しない
- **THEN** AI タブに当該スロットが未充足として表示される

#### Scenario: staging のみ存在するスロット

- **WHEN** `images/ai/git-flow.png` が存在する
- **AND** `images/git-flow.png` が存在しない
- **THEN** AI タブは staging 済みとして表示する

### Requirement: 画像生成はレッスン全文文脈と alt ヒントを用いる

AI タブの生成操作は、選択中レッスンの未保存 `content` を正本とし、本文全文およびフロントマターの `lesson`・`description`・`tags` を Claude API に渡さなければならない（SHALL）。対象スロットの `images/<filename>` および alt テキストはヒントとして渡し、本文文脈と矛盾する場合は本文文脈を優先する旨をプロンプトで指示しなければならない（SHALL）。生成のみでは Markdown を変更してはならない（MUST NOT）。

#### Scenario: 本文変更後に生成すると新しい文脈が使われる

- **WHEN** ユーザーが骨子の alt のまま本文の説明を書き換えた
- **AND** AI タブで当該スロットを生成する
- **THEN** リクエストには書き換え後の本文全文が含まれる

### Requirement: ui と diagram は Tailwind HTML 経由で PNG 化する

`[ui]` または `[diagram]` で始まる alt、またはそれに相当する分類のスロットに対する生成は、Claude が Tailwind CSS 断片 HTML を出力し、Playwright により PNG にラスタライズしたうえで `images/ai/<filename>` に保存しなければならない（SHALL）。viewport 幅 768・`deviceScaleFactor` 2・キャプチャ対象要素クリップを既定としなければならない（SHALL）。生成 HTML の背景はライトとし、アプリのダークテーマに依存してはならない（SHALL）。

#### Scenario: 生成成功で ai staging に PNG ができる

- **WHEN** ユーザーが未充足スロットで生成を実行する
- **AND** Claude と Playwright が成功する
- **THEN** `images/ai/<filename>` に PNG が存在する
- **AND** `images/<filename>` はまだ存在しないか、挿入操作まで更新されない

#### Scenario: photo 分類は本 change で生成しない

- **WHEN** alt が `[photo]` で始まるスロットで生成を実行する
- **THEN** 外部画像生成未実装のエラーまたは同等のフィードバックを表示する
- **AND** ファイルは作成しない

### Requirement: API キー未設定時は生成できない

Anthropic API キーがクライアント設定およびサーバー環境変数のいずれにも無いとき、生成 API は失敗を返さなければならない（SHALL）。AI タブは生成を無効化し、設定ダイアログへの導線を示さなければならない（SHALL）。

#### Scenario: キー未設定で生成拒否

- **WHEN** API キーが未設定である
- **AND** ユーザーが生成を試みる
- **THEN** 生成は実行されない
- **AND** 設定を促すメッセージが表示される

### Requirement: AI タブの挿入は UP タブと同等である

AI タブ staging 画像の挿入操作は、UP タブと同様に `images/ai/<filename>` を `images/<filename>` へコピー（promote）し、staging 側を削除してはならない（MUST NOT）。続けて編集モードの CodeMirror において、選択範囲があればその範囲を、なければカーソル位置に `![<filename>](images/<filename>)` を挿入しなければならない（SHALL）。プレビュー・差分モードでは挿入してはならない（MUST NOT）。

#### Scenario: 挿入で promote と Markdown が更新される

- **WHEN** ユーザーが編集モードでプレースホルダ行を選択し AI タブから挿入する
- **THEN** `images/<filename>` が作成される
- **AND** 選択範囲が画像 Markdown に置換される
- **AND** `images/ai/<filename>` は残る

