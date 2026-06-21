## ADDED Requirements

### Requirement: レッスン本文の自動保存
レッスン本文が編集されてから 800ms 以内に変更が静止した場合、`/api/content/save-lesson` を呼び出して `.md` ファイルに保存しなければならない（SHALL）。

#### Scenario: 編集後 800ms で自動保存される
- **WHEN** ユーザーがレッスン本文を編集し、800ms 間タイピングを止める
- **THEN** 対応する `.md` ファイルが更新されている

#### Scenario: 連続入力中は保存されない
- **WHEN** ユーザーが 800ms 未満の間隔で連続してテキストを入力し続ける
- **THEN** 最後の入力から 800ms が経過するまで API 呼び出しは発生しない

### Requirement: コースメタデータの自動保存
コースの `target`・`cross_series_prev`・`cross_series_next` が変更された場合、`/api/content/save-course` を呼び出して `.meta.json` を保存しなければならない（SHALL）。

#### Scenario: コースメタが変更されると保存される
- **WHEN** ユーザーが UI でコースの `target` を変更する
- **THEN** 対応するコースフォルダの `.meta.json` が更新されている

### Requirement: シリーズ順序の自動保存
シリーズの表示順が変更された場合、`/api/content/save-series-order` を呼び出して `_series-order.json` を更新しなければならない（SHALL）。

#### Scenario: シリーズ並び替え後に保存される
- **WHEN** ユーザーが UI でシリーズの表示順を変更する
- **THEN** `contents/_series-order.json` のシリーズ名配列が新しい順序で保存されている

### Requirement: 保存エラーのユーザー通知
自動保存の API 呼び出しが失敗した場合、ユーザーにエラーを通知しなければならない（SHALL）。

#### Scenario: 保存 API がエラーを返す
- **WHEN** `/api/content/save-lesson` が 5xx エラーを返す
- **THEN** UI にエラートーストが表示される
