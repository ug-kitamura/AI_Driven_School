## ADDED Requirements

### Requirement: ⚙ メニューの最上部に表示言語切り替えを配置する
`WorkspaceSettingsDialog` の ⚙ メニュー内に表示言語（`displayLanguage: "ja" | "en"`）の切り替え UI を最上部に配置する。初期値は `"ja"`。設定は `data/workspace.json` に永続化する。

#### Scenario: 言語設定が workspace.json に保存される
- **WHEN** ユーザーが ⚙ メニューで言語を `English` に切り替える
- **THEN** `data/workspace.json` の `displayLanguage` が `"en"` に更新される

#### Scenario: アプリ再起動後も言語設定が維持される
- **WHEN** 言語を `"en"` に設定した後にページをリロードする
- **THEN** アプリは英語モードで起動する

### Requirement: 英語モードで Pane 1/2 のタイトルが英語表示になる
`displayLanguage = "en"` の場合、Pane 1（シリーズ一覧）と Pane 2（コース一覧）はシリーズ名・コース名を `_meta.json` の `title.en` で表示する。`title.en` が未設定の場合は `title.ja` にフォールバックし、「要翻訳」バッジを表示する。

#### Scenario: title.en が設定済みの場合は英語名が表示される
- **WHEN** `displayLanguage = "en"` かつ `_meta.json` に `title.en = "Git Mastery Series"` が設定されている
- **THEN** Pane 1 にシリーズ名 `Git Mastery Series` が表示される

#### Scenario: title.en が未設定の場合は ja にフォールバックする
- **WHEN** `displayLanguage = "en"` かつ `_meta.json` に `title.en` が設定されていない
- **THEN** Pane 1 に `title.ja` の値が表示され、未翻訳を示すバッジが付与される

### Requirement: 英語モードで Pane 3 が英語版レッスンを表示する
`displayLanguage = "en"` の場合、Pane 3 は `<slug>.en.md` を表示・編集対象とする。`<slug>.en.md` が存在しない場合は生成プレースホルダーを表示する。

#### Scenario: 英語モードでは .en.md がエディタに読み込まれる
- **WHEN** `displayLanguage = "en"` かつ `version-control.en.md` が存在する
- **THEN** Pane 3 のエディタは `version-control.en.md` の内容を表示する

### Requirement: 英語モードで曼陀羅ラベルが英語表示になる
`displayLanguage = "en"` の場合、曼陀羅ビューのラベル（対象者・前提コース・次のコース・ステータス）を英語で表示する。コース名は `_meta.json` の `title.en`（未設定時は `title.ja`）で解決する。

#### Scenario: 英語モードで曼陀羅ラベルが英語になる
- **WHEN** `displayLanguage = "en"` の場合
- **THEN** 「対象者」→ `Target audience`、「前提コース」→ `Prerequisites`、「次のコース」→ `Next courses` と表示される
