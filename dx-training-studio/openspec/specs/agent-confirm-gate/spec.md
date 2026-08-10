# agent-confirm-gate Specification

## Purpose
TBD - created by archiving change port-ebex-agent-core. Update Purpose after archive.
## Requirements
### Requirement: 実行前ユーザー確認

書込（新規・上書き）・スクリプト実行・生成書込（generate_and_write）・web 検索は、実行前に `confirm_required` SSE イベントを送出しユーザーの決裁を待たなければならない（SHALL）。承認時はツールを実行し、拒否時は `rejected` と理由・ガイダンスを含む結果をモデルへ返して継続しなければならない（SHALL）。時間内に応答がない場合はタイムアウトとして実行を見送り、画面再読み込みの案内を含む結果を返さなければならない（SHALL）。

#### Scenario: 上書きを承認して実行する
- **WHEN** 既存ファイルへの `write_file` で確認ダイアログが表示され、ユーザーが承認する
- **THEN** 書込が実行され、tool_result に成功が記録される

#### Scenario: 拒否するとモデルにガイダンスが返る
- **WHEN** ユーザーが確認ダイアログで拒否する
- **THEN** tool_result に `rejected: true` と理由が含まれ、エージェントループは停止せず継続する

#### Scenario: 無応答はタイムアウトで見送る
- **WHEN** 確認ダイアログが時間内に応答されない
- **THEN** 実行は見送られ、timedOut を含む結果と再読み込み案内がモデルへ返る

### Requirement: 承認済みパスのスキップ追跡

同一セッション内で AI が作成したファイル、および上書きを承認済みのパスへの再書込は、以後の上書き確認をスキップしなければならない（SHALL）。スキップ対象は会話履歴からも復元（seed）されなければならない（SHALL）。

#### Scenario: AI 作成ファイルへの再書込は確認なし
- **WHEN** 同一セッション内で AI が新規作成したファイルへ再度 `write_file` が実行される
- **THEN** 確認ダイアログは表示されず書込が実行される

#### Scenario: リロード後もスキップが維持される
- **WHEN** セッション復元後、履歴上で承認済みのパスへ書込が実行される
- **THEN** 確認ダイアログは表示されない

### Requirement: ペイン4 の確認 UI

確認要求はペイン4 のツール実行ブロック内にインライン表示され、種別（上書き / スクリプト / 生成 / 検索）・対象パス・目的（purpose）を提示しなければならない（SHALL）。ユーザーは承認・拒否を選択できなければならない（SHALL）。

#### Scenario: 確認ダイアログの表示内容
- **WHEN** `generate_and_write` の確認要求が発生する
- **THEN** ツールブロックに書込先パスと purpose が表示され、承認 / 拒否ボタンが提供される

