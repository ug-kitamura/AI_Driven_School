## ADDED Requirements

### Requirement: 英語版レッスンファイルを <slug>.en.md として管理する
各レッスンの英語版コンテンツは同一ディレクトリに `<slug>.en.md` として配置する。英語版ファイルは省略可能であり、存在しないレッスンがあっても構わない。

#### Scenario: 英語版ファイルが英語モードで表示される
- **WHEN** `version-control.en.md` が存在し、英語モードが有効な場合
- **THEN** Pane 3 は `version-control.en.md` の内容を表示・編集対象とする

#### Scenario: 英語版ファイルが存在しない場合はプレースホルダーを表示する
- **WHEN** `version-control.en.md` が存在せず、英語モードが有効な場合
- **THEN** Pane 3 は「英語版が未作成です」メッセージと [AI で英語版を生成] / [空白から作成] ボタンを表示する

### Requirement: source_hash で翻訳の陳腐化を検知する
`<slug>.en.md` のフロントマターに `source_hash` フィールドを持つ。このフィールドは英語版生成時点の `<slug>.md` 全文の SHA-256 ハッシュである。

```yaml
---
source_hash: sha256:a1b2c3d4...
generated_at: 2026-06-20T00:00:00Z
---
```

#### Scenario: source_hash が一致する場合は最新状態として扱う
- **WHEN** `version-control.en.md` の `source_hash` が現在の `version-control.md` のハッシュと一致する
- **THEN** Pane 3 の英語モードでは「最新」として表示し、警告を表示しない

#### Scenario: source_hash が不一致の場合は要再翻訳バッジを表示する
- **WHEN** `version-control.md` が更新され、`version-control.en.md` の `source_hash` と不一致になった場合
- **THEN** Pane 3 は「⚠ ソースが更新されています」バッジと [英語版を再生成] / [このまま維持] ボタンを表示する

#### Scenario: [このまま維持] で source_hash を更新する
- **WHEN** ユーザーが [このまま維持] を押す
- **THEN** `source_hash` が現在の `version-control.md` のハッシュに更新され、警告が消える

### Requirement: AI で英語版を生成・再生成する
ユーザーが [AI で英語版を生成] または [英語版を再生成] を押すと、AI が `<slug>.md` の内容を英語に翻訳して `<slug>.en.md` を生成・上書きする。生成後に `source_hash` と `generated_at` を更新する。

#### Scenario: AI 生成後にファイルが保存される
- **WHEN** ユーザーが [AI で英語版を生成] を押す
- **THEN** `<slug>.en.md` が生成され、`source_hash` と `generated_at` が設定された状態でディスクに保存される
