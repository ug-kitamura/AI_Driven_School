# pane3-agent-view Specification

## Purpose

DX Training Studio の Pane 3 Agent ビューの UI と操作を定義する。AI チャット、スキル呼び出し（`/`）、ファイル参照（`@`）、草稿のエディタ挿入、ストリーミング停止などのユーザー向け挙動を規定する。
## Requirements
### Requirement: Agent ビュー切り替え
Pane 3 のモード切り替え UI に Agent ビューボタンが存在しなければならない（SHALL）。ボタンは差分ビューボタンの右隣に配置されなければならない（SHALL）。

#### Scenario: Agent ビューに切り替える
- **WHEN** ユーザーが Pane 3 の Agent ビューボタンをクリックする
- **THEN** Pane 3 が AI チャット画面に切り替わる

#### Scenario: 他モードから Agent ビューに戻れる
- **WHEN** Agent ビュー表示中にユーザーが編集・プレビュー・差分のいずれかのボタンをクリックする
- **THEN** 選択したモードに切り替わる

### Requirement: AI チャット UI
Agent ビューにはメッセージ入力欄と送信ボタンを備えた AI チャット UI が表示されなければならない（SHALL）。ユーザーメッセージと AI 応答が時系列で表示されなければならない（SHALL）。ユーザーメッセージは右寄せの吹き出しスタイルで表示されなければならない（SHALL）。AI 応答は左寄せで表示されなければならない（SHALL）。送信ボタンは上矢印アイコンのみのボタンでなければならない（SHALL）。ストリーミング中は入力欄右下に停止ボタンが表示されなければならない（SHALL）。入力欄左下には **保存済みワークスペース設定の AI モデル** の表示名が表示されなければならない（SHALL）。表示名は `resolveModelLabel(settings.aiModel)` により slug から決定し、ハードコードしてはならない（MUST NOT）。

#### Scenario: メッセージを送信する
- **WHEN** ユーザーがテキストを入力して送信ボタンをクリックする
- **THEN** ユーザーメッセージがチャット履歴に追加され、AI 応答の取得が開始される

#### Scenario: ストリーミング応答を表示する
- **WHEN** AI 応答がストリーミングで返される
- **THEN** 応答テキストが逐次チャット画面に表示される

#### Scenario: ユーザーメッセージを右寄せ吹き出しで表示する
- **WHEN** ユーザーがメッセージを送信する
- **THEN** チャット履歴上で当該メッセージが右寄せの吹き出しとして表示される

#### Scenario: ストリーミング中に停止する
- **WHEN** ユーザーがストリーミング中に停止ボタンをクリックする
- **THEN** 部分応答と直前のユーザーメッセージが履歴から削除され、ユーザーメッセージの内容が入力欄に復元される

#### Scenario: 保存済みモデル名を表示する
- **WHEN** Agent ビューが表示される
- **AND** ワークスペース設定に `aiModel: claude-sonnet-4-6` が保存されている
- **THEN** 入力欄左下に `Claude Sonnet 4.6` が表示される

#### Scenario: 設定保存後にフッター表示が更新される
- **WHEN** ユーザーが設定ダイアログで AI モデルを変更して保存する（Claude Sonnet 4.6 のみ保存可能）
- **AND** Agent ビューを表示している
- **THEN** 入力欄左下のモデル表示名が保存後の `aiModel` に対応するラベルに更新される

### Requirement: スラッシュコマンドによるスキル呼び出し
チャット入力欄で `/` を入力すると、`.claude/skills/` 配下のスキルが skill id のアルファベット順でオートコンプリート表示されなければならない（SHALL）。`/ ` の後に文字を入力した場合は skill id、スキル名（name）、description のいずれかにその文字列が部分一致するスキルだけを表示しなければならない（SHALL）。候補はスキル名を主表示とし、直後に description をうっすら表示しなければならない（SHALL）。候補選択後、アクティブスキルが設定され、送信時にそのスキルで invoke が実行されなければならない（SHALL）。`/` メニューには組み込みコマンド `clear` と `export` も表示されなければならない（SHALL）。

#### Scenario: `/` でスキル候補をアルファベット順表示する
- **WHEN** ユーザーがチャット入力欄で `/` を入力する
- **THEN** skill id がアルファベット順のスキル候補リストが表示される

#### Scenario: スキル候補の表示形式
- **WHEN** `create-draft` スキルが候補に含まれる
- **THEN** 主表示は frontmatter の `name`（スキル名）で、その直後にうっすら `description` が表示される

#### Scenario: スキル候補を部分一致でフィルタする
- **WHEN** ユーザーが `/draft` のように `/` の後に文字を入力する
- **THEN** skill id、name、description のいずれかに `draft` が部分一致するスキルのみが候補に残る

#### Scenario: スキルを選択して実行する
- **WHEN** ユーザーが候補から `create-draft` を選択し、メッセージを送信する
- **THEN** `create-draft` スキルで invoke が実行される

#### Scenario: スキル未選択で送信する
- **WHEN** アクティブスキルが未設定の状態で送信する
- **THEN** エラーメッセージが表示され、`/` によるスキル選択が促される

#### Scenario: clear コマンドを実行する
- **WHEN** ユーザーが `/` メニューから `clear` を選択し確認する
- **THEN** 現在のチャットセッションが削除される

#### Scenario: export コマンドを実行する
- **WHEN** ユーザーが `/` メニューから `export` を選択する
- **THEN** 現在セッションの会話が Markdown ファイルとしてダウンロードされる

### Requirement: @ によるファイル参照
チャット入力欄で `@` を入力すると、`contents/**/*.md` の全ファイルがオートコンプリート表示されなければならない（SHALL）。選択中レッスンがある場合はそのファイルを先頭に、残りは path のアルファベット順で表示しなければならない（SHALL）。`@` の後に文字を入力した場合は、path または file name の部分一致でフィルタしなければならない（SHALL）。候補はファイル名を主表示とし、直後にワークスペースルートからの相対パスをうっすら表示しなければならない（SHALL）。

#### Scenario: `@` で全ファイルを表示する
- **WHEN** ユーザーがチャット入力欄で `@` を入力する（フィルタ文字なし）
- **THEN** `contents/**/*.md` の全ファイルが表示され、選択中レッスンがある場合はそのファイルが先頭である

#### Scenario: 候補の表示形式
- **WHEN** `@contents/series/course/lesson.md` が候補に含まれる
- **THEN** 主表示は `lesson.md` で、その直後にうっすら `contents/series/course/lesson.md` が表示される

#### Scenario: ファイル候補を部分一致でフィルタする
- **WHEN** ユーザーが `@lesson` のように `@` の後に文字を入力する
- **THEN** path または file name に `lesson` が部分一致するファイルのみが候補に残る

#### Scenario: ファイルを選択して参照トークンを挿入する
- **WHEN** ユーザーが候補から `contents/foo/bar/lesson.md` を選択する
- **THEN** 入力欄に `@contents/foo/bar/lesson.md` 形式のトークンが挿入される

#### Scenario: 参照ファイル付きメッセージを送信する
- **WHEN** ユーザーが `@contents/foo/bar/lesson.md` を含むメッセージを送信する
- **THEN** 該当ファイルの内容が invoke リクエストに添付され、AI 応答の生成に利用される

#### Scenario: 参照トークンの表示
- **WHEN** ユーザーメッセージに `@path` トークンが含まれる
- **THEN** チャット履歴上で参照ファイルが識別可能なチップまたはスタイルで表示される

### Requirement: 草稿のエディタ挿入
AI 応答に対して「エディタに挿入」アクションが提供されなければならない（SHALL）。挿入操作は選択中レッスンの編集内容に markdown テキストを追加しなければならない（SHALL）。「エディタに挿入」と「コピー」は AI 応答のストリーミングが完了した後にのみ表示されなければならない（SHALL）。

#### Scenario: 草稿をエディタに挿入する
- **WHEN** ユーザーが AI 応答の「エディタに挿入」ボタンをクリックする
- **THEN** 応答テキストが選択中レッスンの本文に挿入される

#### Scenario: レッスン未選択時の挿入
- **WHEN** レッスンが選択されていない状態で「エディタに挿入」をクリックする
- **THEN** 操作は無効化されるか、エラーメッセージが表示される

#### Scenario: ストリーミング中は挿入ボタンを非表示にする
- **WHEN** AI 応答がストリーミング中である
- **THEN** 当該応答に「エディタに挿入」ボタンは表示されない

#### Scenario: 応答をクリップボードにコピーする
- **WHEN** ストリーミング完了後にユーザーが「コピー」ボタンをクリックする
- **THEN** 応答テキストがクリップボードにコピーされる

### Requirement: create-draft の DB 検索オーケストレーション

`create-draft` スキルがアクティブな Agent セッションにおいて、クライアント（`AgentChatPane`）は次を実行しなければならない（SHALL）: (1) 初回 invoke では `contextItems` を `"[]"` として渡す、(2) ユーザーがタグを承認・修正したターンで確定タグを解釈し `GET /api/context/items?tags=...` を呼ぶ、(3) 応答 JSON を `variables.contextItems` にマージしてから invoke する。DB 未接続時はチャットにエラーを表示しなければならない（SHALL）。フェーズ状態はセッション単位とし、セッション切替・新規作成でリセットしてよい（MAY）。

#### Scenario: タグ確定後に contextItems を渡す

- **WHEN** ユーザーが create-draft 対話でタグを承認する
- **AND** `GET /api/context/items` が 2 件を返す
- **THEN** 次の invoke の `variables.contextItems` にその JSON が含まれる

#### Scenario: DB 未接続で検索失敗

- **WHEN** ユーザーがタグを承認する
- **AND** `DATABASE_URL` が未設定である
- **THEN** チャットに「データベースに接続できません」等のエラーが表示される

#### Scenario: セッション切替でフェーズリセット

- **WHEN** ユーザーが create-draft 対話の途中で別セッションに切り替える
- **THEN** 新セッションでは `contextItems` は `"[]"` から再開される

