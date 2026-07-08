# ebex-workspace-settings Specification

## Purpose
TBD - created by archiving change ebex-v1-workspace. Update Purpose after archive.
## Requirements
### Requirement: 設定項目

設定ダイアログ（⚙）には以下の項目のみが含まれなければならない（SHALL）: テーマ（light / dark / system）、編集フォントサイズ、ペイン既定幅（pane1 / pane2 / pane3）、AI モデル、AI API キー。

#### Scenario: 設定項目の表示

- **WHEN** ユーザーが設定ダイアログを開く
- **THEN** テーマ、フォントサイズ、ペイン幅、AI モデル、AI API キーの入力が表示される

#### Scenario: 除外項目が表示されない

- **WHEN** ユーザーが設定ダイアログを開く
- **THEN** Pixabay API キー、画像ストレージ、社内コンテキストの設定は表示されない

### Requirement: localStorage 永続化

設定は localStorage キー `ebex-settings` に JSON 形式で保存されなければならない（SHALL）。ページリロード後に設定が復元されなければならない（SHALL）。

#### Scenario: 設定の保存と復元

- **WHEN** ユーザーがテーマを dark に変更してページをリロードする
- **THEN** ダークテーマが維持される

### Requirement: AI API キーの優先順位

設定ダイアログに AI API キーが入力されている場合、ダイアログの値が `.env.local` の `AI_API_KEY` より優先されなければならない（SHALL）。

#### Scenario: ダイアログ優先

- **WHEN** 設定ダイアログに API キーが入力されている
- **THEN** Agent invoke 時にダイアログのキーが使用される

### Requirement: ペイン既定幅

ペイン既定幅の変更は 5px 刻みで clamp されなければならない（SHALL）。pane1 の既定値は 300px、最小 200px、最大 400px でなければならない（SHALL）。pane3 の既定値は 600px、最小 400px、最大 800px でなければならない（SHALL）。pane2（エディタ）の最小幅は 400px でなければならない（SHALL）。

#### Scenario: pane3 の最小 clamp

- **WHEN** ユーザーが pane3 の既定幅を 200 に設定しようとする
- **THEN** 最小値（400）に clamp される

#### Scenario: pane1 の既定値

- **WHEN** ユーザーがペイン既定幅をリセットする
- **THEN** pane1 は 300px に戻る

#### Scenario: pane3 の既定値

- **WHEN** ユーザーがペイン既定幅をリセットする
- **THEN** pane3 は 600px に戻る

