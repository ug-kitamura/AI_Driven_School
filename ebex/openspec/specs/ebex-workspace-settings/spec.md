# ebex-workspace-settings Specification

## Purpose

TBD - created by archiving change ebex-v1-workspace. Update Purpose after archive.
## Requirements
### Requirement: 設定項目

設定ダイアログ（⚙）には以下の項目のみが含まれなければならない（SHALL）: テーマ（light / dark / system）、編集フォントサイズ、ペイン既定幅（pane1 / pane2 / pane3）、AI モデル、AI API キー、最大出力トークン（選択中の AI モデルに対応するプロファイル上限値の読み取り専用表示）。

最大出力トークンはユーザーが選択・変更可能な入力であってはならない（MUST NOT）。表示値はモデルプロファイル（`resolveModelProfile(model).maxOutputTokens`）から都度取得しなければならない（SHALL）。AI モデルの選択を変更した場合、最大出力トークンの表示値も選択中モデルに応じて切り替わらなければならない（SHALL）。

#### Scenario: 設定項目の表示

- **WHEN** ユーザーが設定ダイアログを開く
- **THEN** テーマ、フォントサイズ、ペイン幅、AI モデル、AI API キー、選択中モデルの最大出力トークン（読み取り専用）が表示される

#### Scenario: 除外項目が表示されない

- **WHEN** ユーザーが設定ダイアログを開く
- **THEN** Pixabay API キー、画像ストレージ、社内コンテキストの設定は表示されない

#### Scenario: 最大出力トークンはモデルプロファイルから決まる

- **WHEN** ユーザーが AI モデルとして claude-haiku-4-5 を選択する
- **THEN** 最大出力トークンの表示は 32,000 になり、ユーザーはこの値を変更できない

#### Scenario: モデル変更で表示値が切り替わる

- **WHEN** ユーザーが AI モデルを claude-haiku-4-5 から claude-sonnet-5 へ切り替える
- **THEN** 最大出力トークンの表示は 32,000 から 64,000 へ切り替わる

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

