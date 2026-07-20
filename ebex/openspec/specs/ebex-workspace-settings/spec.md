# ebex-workspace-settings Specification

## Purpose

TBD - created by archiving change ebex-v1-workspace. Update Purpose after archive.
## Requirements
### Requirement: 設定項目

設定ダイアログ（⚙）には以下の項目のみが含まれなければならない（SHALL）: テーマ（light / dark / system）、編集フォントサイズ、ペイン既定幅（pane1 / pane2 / pane3）、AI モデル、AI API キー、最大出力トークン（`8192` / `16384` / `32000`、既定 `32000`）。

#### Scenario: 設定項目の表示

- **WHEN** ユーザーが設定ダイアログを開く
- **THEN** テーマ、フォントサイズ、ペイン幅、AI モデル、AI API キー、最大出力トークンの入力が表示される

#### Scenario: 除外項目が表示されない

- **WHEN** ユーザーが設定ダイアログを開く
- **THEN** Pixabay API キー、画像ストレージ、社内コンテキストの設定は表示されない

#### Scenario: 最大出力トークンの既定値

- **WHEN** ユーザーが設定を変更せずに（または未保存の既定のまま）Agent を invoke する
- **THEN** LLM 呼び出しの `max_tokens` は既定値 `32000` になる

#### Scenario: 最大出力トークンの変更が反映される

- **WHEN** ユーザーが最大出力トークンを `8192` に変更して Agent を invoke する
- **THEN** LLM 呼び出しの `max_tokens` に `8192` が渡される

#### Scenario: モデル上限でクランプ

- **WHEN** 選択した最大出力トークンが使用中モデルの上限を超える
- **THEN** 実際に送信される `max_tokens` はモデル上限にクランプされる

#### Scenario: 既存保存値は維持

- **WHEN** localStorage に最大出力トークン `8192` が既に保存されている
- **THEN** ページ読込後も `8192` が使われ、自動的に `32000` へ書き換えられない

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

ペイン既定幅の変更は 5px 刻みで clamp されなければならない（SHALL）。pane1 の既定値は 350px、最小 200px、最大 500px でなければならない（SHALL）。pane3 の既定値は 700px、最小 400px、最大 1000px でなければならない（SHALL）。pane2（エディタ）の最小幅は 400px でなければならない（SHALL）。設定 UI のスライダー範囲は `PANE_WIDTH_LIMITS` を参照して pane1 / pane3 の最小・最大に追従しなければならない（SHALL）。

#### Scenario: pane3 の最小 clamp

- **WHEN** ユーザーが pane3 の既定幅を 200 に設定しようとする
- **THEN** 最小値（400）に clamp される

#### Scenario: pane1 の最大 clamp

- **WHEN** ユーザーが pane1 の既定幅を 800 に設定しようとする
- **THEN** 最大値（500）に clamp される

#### Scenario: pane1 の既定値

- **WHEN** ユーザーがペイン既定幅をリセットする
- **THEN** pane1 は 350px に戻る

#### Scenario: pane3 の既定値

- **WHEN** ユーザーがペイン既定幅をリセットする
- **THEN** pane3 は 700px に戻る

