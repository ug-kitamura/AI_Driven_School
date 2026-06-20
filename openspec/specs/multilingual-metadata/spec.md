## ADDED Requirements

### Requirement: _meta.json は多言語タイトルと対象者を保持する
各シリーズフォルダ・コースフォルダに `_meta.json` を配置し、以下のフィールドを持つ。

```json
{
  "title": { "ja": "Git完全マスターシリーズ", "en": "Git Mastery Series" },
  "target_audience": { "ja": "Gitを初めて使う方", "en": "Git beginners" }
}
```

`title.ja` は必須。`title.en` / `target_audience.ja` / `target_audience.en` は省略可能（未設定時は `null` または空文字）。

#### Scenario: _meta.json が正しく読み込まれる
- **WHEN** `contents/git-mastery/_meta.json` に `title.ja = "Git完全マスターシリーズ"` が設定されている
- **THEN** アプリは日本語モードでシリーズ名を `Git完全マスターシリーズ` として表示する

#### Scenario: title.en が未設定の場合は title.ja にフォールバックする
- **WHEN** `_meta.json` に `title.en` が設定されていない状態で英語モードになる
- **THEN** アプリはシリーズ名を `title.ja` の値で表示し、「要翻訳」バッジを付与する

### Requirement: _mandala.json はコース依存関係をスラッグ参照で保持する
コースフォルダに `_mandala.json` を配置し、以下のフィールドを持つ。参照はコースのスラッグ文字列とする。

```json
{
  "prerequisites": ["git-setup"],
  "next_courses": ["git-branching"]
}
```

#### Scenario: _mandala.json の参照がコース名として解決される
- **WHEN** `_mandala.json` の `prerequisites` に `"git-setup"` が含まれる
- **THEN** 曼陀羅ビューは現在の言語設定に応じた `git-setup` コースの title を表示する

### Requirement: title.ja を変更したとき title.en 更新をプロンプトする
`_meta.json` の `title.ja` をダイアログで変更・保存したとき、かつ `title.en` が既に設定されている場合、アプリは英語タイトルの更新を提案するダイアログを表示する。

#### Scenario: title.ja 変更後に英語更新プロンプトが表示される
- **WHEN** ユーザーが `title.ja` を変更して保存し、`title.en` が設定済みの場合
- **THEN** 「英語タイトルも更新しますか？」ダイアログが表示され、[AI で更新] / [このまま保存] の選択肢を提示する

#### Scenario: [AI で更新] を選択すると title.en が自動翻訳される
- **WHEN** ユーザーが英語更新プロンプトで [AI で更新] を押す
- **THEN** AI が新しい `title.ja` を英語訳して `title.en` に設定し、`_meta.json` を保存する
