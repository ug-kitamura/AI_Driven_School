# agent-chat-history Specification

## Purpose

Agent ビューの会話履歴をブラウザ `localStorage` で永続化し、複数セッションの作成・切替・削除を提供する。レッスン選択に依存しない会話スコープと、履歴 UI の要件を規定する。
## Requirements
### Requirement: localStorage によるセッション永続化

Agent ビューの会話は、レッスン ID 単位で永続化されなければならない（SHALL）。ローカル dev ではレッスンフォルダの `session.json`（`AgentChatStorage` 形式）を正本としなければならない（SHALL）。FS 書き込み不可環境では `localStorage` キー `dx-training-studio-agent-chat-v2` 内の当該 `lessonId` エントリを正本としなければならない（SHALL）。各セッションは `id`、`title`、`messages`、`activeSkillId`、`createdAt`、`updatedAt` を含まなければならない（SHALL）。**レッスンあたり**のセッション数上限は 10 でなければならない（SHALL）。上限超過時は `updatedAt` が最も古いセッションを削除しなければならない（SHALL）。

永続化の debounce 保存は、**会話内容**（messages・activeSkillId・createDraftContext 等の意味的スナップショット）が前回保存から変化した場合にのみ実行されなければならない（SHALL）。保存処理そのものが React state（`chatStorage` オブジェクト参照の更新等）を変化させるだけで、追加の保存を連鎖的にトリガーしてはならない（MUST NOT）。

#### Scenario: 初回起動時に空セッションを作成する

- **WHEN** 当該レッスンの `session.json` も v2 `localStorage` エントリも存在しない
- **THEN** 空のセッション 1 件が作成され、アクティブセッションとして表示される

#### Scenario: リロード後に会話を復元する

- **WHEN** ユーザーがメッセージ送信後にページをリロードする
- **THEN** 直前のアクティブレッスンの直前アクティブセッションの messages と activeSkillId が復元される

#### Scenario: メッセージ変更時に自動保存する

- **WHEN** messages または activeSkillId が変更される
- **THEN** 現在のアクティブセッションが debounce 後に `session.json`（または FS 不可時 `localStorage`）に保存される
- **AND** 保存内容が前回と同一の場合、追加の PUT は発行されない

#### Scenario: 保存ループが発生しない

- **WHEN** Agent ビューが idle 状態で会話内容に変更がない
- **THEN** `PUT /api/agent/session` は連続して発行されない

#### Scenario: セッション上限で古いセッションを削除する

- **WHEN** 当該レッスンで 11 件目のセッションが作成される
- **THEN** `updatedAt` が最も古いセッションが削除され、10 件以内に収まる

### Requirement: 履歴選択 UI
Agent ビュー上部にサブヘッダーが表示され、履歴ドロップダウンと「新規」ボタンが提供されなければならない（SHALL）。履歴ドロップダウンには保存済みセッションが `updatedAt` 降順で一覧表示されなければならない（SHALL）。各項目には title、メッセージ数、更新日時が表示されなければならない（SHALL）。項目選択でアクティブセッションが切り替わらなければならない（SHALL）。

#### Scenario: 履歴から別セッションに切り替える
- **WHEN** ユーザーが履歴ドロップダウンから別セッションを選択する
- **THEN** 選択したセッションの messages と activeSkillId が表示される

#### Scenario: 新規セッションを作成する
- **WHEN** ユーザーが「新規」ボタンをクリックする
- **THEN** 現在のセッションが保存され、空の新セッションがアクティブになる

#### Scenario: セッション title を自動生成する
- **WHEN** セッションで初めて user メッセージが送信確定される
- **THEN** そのメッセージ先頭 30 字がセッション title として設定される

### Requirement: セッション削除

現在のアクティブセッションを削除する操作が提供されなければならない（SHALL）。削除前に確認ダイアログが表示されなければならない（SHALL）。削除後は別セッションに切り替えるか、セッションが 0 件の場合は新規空セッションを作成しなければならない（SHALL）。削除は当該レッスンの `session.json`（または FS 不可時 `localStorage`）に反映されなければならない（SHALL）。

#### Scenario: 現在セッションを削除する

- **WHEN** ユーザーが `/clear` または同等 UI で現在セッションの削除を確認する
- **THEN** 当該セッションが永続化ストアから削除され、別セッションまたは空セッションが表示される

### Requirement: レッスン単位のセッションスコープ

Agent 会話履歴はレッスン ID 単位で分離されなければならない（SHALL）。レッスンを切り替えた場合、切替先レッスンの `AgentChatStorage` を load し、当該レッスンの sessions を表示しなければならない（SHALL）。切替元レッスンの進行中 state は flush して保存しなければならない（SHALL）。

#### Scenario: レッスン切替後に当該レッスンの会話が表示される

- **WHEN** ユーザーがレッスン A で会話した後、レッスン B を選択して Agent ビューを表示する
- **THEN** レッスン B の会話履歴（または空セッション）が表示される
- **AND** レッスン A の会話は表示されない

#### Scenario: レッスン A に戻ると A の会話が復元される

- **WHEN** ユーザーがレッスン A → B → A と選択を切り替える
- **THEN** レッスン A に戻った時点で A の保存済み会話が表示される

