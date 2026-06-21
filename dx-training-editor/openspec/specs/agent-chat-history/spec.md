# agent-chat-history Specification

## Purpose

Agent ビューの会話履歴をブラウザ `localStorage` で永続化し、複数セッションの作成・切替・削除を提供する。レッスン選択に依存しない会話スコープと、履歴 UI の要件を規定する。
## Requirements
### Requirement: localStorage によるセッション永続化
Agent ビューの会話はブラウザ `localStorage` に複数セッションとして保存されなければならない（SHALL）。ストレージキーは `dx-training-editor-agent-chat` でなければならない（SHALL）。各セッションは `id`、`title`、`messages`、`activeSkillId`、`createdAt`、`updatedAt` を含まなければならない（SHALL）。セッション数の上限は 20 でなければならない（SHALL）。上限超過時は `updatedAt` が最も古いセッションを削除しなければならない（SHALL）。

#### Scenario: 初回起動時に空セッションを作成する
- **WHEN** `localStorage` に Agent チャットデータが存在しない
- **THEN** 空のセッション 1 件が作成され、アクティブセッションとして表示される

#### Scenario: リロード後に会話を復元する
- **WHEN** ユーザーがメッセージ送信後にページをリロードする
- **THEN** 直前のアクティブセッションの messages と activeSkillId が復元される

#### Scenario: メッセージ変更時に自動保存する
- **WHEN** messages または activeSkillId が変更される
- **THEN** 現在のアクティブセッションが `localStorage` に保存される

#### Scenario: セッション上限で古いセッションを削除する
- **WHEN** 21 件目のセッションが作成される
- **THEN** `updatedAt` が最も古いセッションが削除され、20 件以内に収まる

### Requirement: セッション内会話のスコープ
1 セッション内の会話履歴はレッスン選択に依存せず、エージェントビュー全体で共有されなければならない（SHALL）。レッスンを切り替えても同一セッションの messages は維持されなければならない（SHALL）。

#### Scenario: レッスン切替後も会話が維持される
- **WHEN** ユーザーがレッスン A で会話した後、レッスン B を選択して Agent ビューを表示する
- **THEN** 同一セッションの会話履歴が表示される

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
現在のアクティブセッションを削除する操作が提供されなければならない（SHALL）。削除前に確認ダイアログが表示されなければならない（SHALL）。削除後は別セッションに切り替えるか、セッションが 0 件の場合は新規空セッションを作成しなければならない（SHALL）。

#### Scenario: 現在セッションを削除する
- **WHEN** ユーザーが `/clear` または同等 UI で現在セッションの削除を確認する
- **THEN** 当該セッションが `localStorage` から削除され、別セッションまたは空セッションが表示される

