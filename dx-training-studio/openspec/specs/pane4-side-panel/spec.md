# pane4-side-panel Specification

## Purpose
TBD - created by archiving change pane4-agent-side-panel. Update Purpose after archive.
## Requirements
### Requirement: Pane 4 は Agent ビューと画像ビューを切り替える

Pane 4 は **Agent ビュー** と **画像ビュー** の 2 モードを持たなければならない（SHALL）。デフォルトは Agent ビューでなければならない（SHALL）。Pane 4 が折りたたまれている間、表示中のビュー選択（`agent` / `images`）は保持されなければならない（SHALL）。Pane 4 を再度開いたとき、直前に表示していたビューが復元されなければならない（SHALL）。

#### Scenario: 初回表示は Agent ビュー

- **WHEN** ユーザーが初めて Pane 4 を開く（永続化 state なし）
- **THEN** Agent ビューが表示される

#### Scenario: 折りたたみ復帰で前回ビューを復元

- **WHEN** ユーザーが画像ビューを表示した状態で Pane 4 を折りたたむ
- **AND** その後 Pane 4 を再度開く
- **THEN** 画像ビューが表示される

#### Scenario: Agent から画像へ切り替える

- **WHEN** ユーザーが Agent ビュー表示中にヘッダー右の「画像」セグメントをクリックする
- **THEN** 画像ビューに切り替わる
- **AND** Agent チャットの mount 状態は維持される（unmount しない）

### Requirement: Pane 4 ヘッダーは 1 段で左ビュー操作・右モード切替

Pane 4 ヘッダーは **高さ `h-12`** の 1 段としなければならない（SHALL）。右端には常に **Agent / 画像** のセグメント切替と **Pane4 折りたたみ**（`Pane4Toggle`）を配置しなければならない（SHALL）。Agent / 画像セグメントは Pane 3 の編集モード切替（`border` 枠付きセグメント、`bg-primary` アクティブ）と **同一の視覚パターン** を用いなければならない（SHALL）。

Agent ビュー時、左側には **新規**・**履歴** ボタンと **アクティブセッションタイトル**（truncate）を配置しなければならない（SHALL）。画像ビュー時、左側には **Used / UP / AI / Web** のセグメント切替を配置しなければならない（SHALL）。新規・履歴・セッションタイトルは画像ビュー時に表示してはならない（MUST NOT）。

#### Scenario: Agent ビューのヘッダー構成

- **WHEN** Agent ビューが表示されている
- **THEN** ヘッダー左に新規・履歴ボタンとセッションタイトルがある
- **AND** ヘッダー右に `[●Agent | 画像]` セグメントと折りたたみボタンがある

#### Scenario: 画像ビューのヘッダー構成

- **WHEN** 画像ビューが表示されている
- **THEN** ヘッダー左に `[Used | UP | AI | Web]` セグメントがある
- **AND** ヘッダー右に `[Agent | ●画像]` セグメントと折りたたみボタンがある

#### Scenario: ヘッダーは 2 段にしない

- **WHEN** 画像ビューが表示されている
- **THEN** Used / UP / AI / Web と Agent / 画像切替は同一ヘッダー行内に収まる

### Requirement: 狭幅時は左側をアイコンのみに縮小する

Pane 4 の **実幅** が 480px 未満のとき、ヘッダー左側のコントロールは **アイコンのみ** 表示に切り替えなければならない（SHALL）。Agent ビュー時のセッションタイトルは **非表示** としなければならない（SHALL）。右端の Agent / 画像セグメントおよび折りたたみボタンは **常に表示** しなければならない（SHALL）。compact 判定は Pane 4 コンテナの `ResizeObserver` 等による **実幅** を用い、ウィンドウ幅のみで判定してはならない（MUST NOT）。

#### Scenario: 狭幅で Agent ヘッダーが compact になる

- **WHEN** Pane 4 実幅が 400px である
- **AND** Agent ビューが表示されている
- **THEN** 新規・履歴はアイコンのみ表示される
- **AND** セッションタイトルは表示されない
- **AND** Agent / 画像セグメントは表示される

#### Scenario: 狭幅で画像タブが compact になる

- **WHEN** Pane 4 実幅が 350px である
- **AND** 画像ビューが表示されている
- **THEN** Used / UP / AI / Web はアイコンのみ表示される
- **AND** 各アイコンにツールチップでフルラベルが提供される

### Requirement: 編集と Agent を並列表示する

Pane 3 が編集・プレビュー・差分のいずれかを表示している間、Pane 4 が開いて Agent ビューである場合、**編集内容（またはプレビュー / 差分）と Agent チャットが横並び**で同時に見えなければならない（SHALL）。Agent ビューは Pane 3 のモード切替 UI に含めてはならない（MUST NOT）。

#### Scenario: 編集と Agent が並列

- **WHEN** Pane 3 が編集モード（raw）である
- **AND** Pane 4 が Agent ビューで開いている
- **THEN** CodeMirror エディタと Agent チャットが同時に表示される

#### Scenario: Pane 3 に Agent タブがない

- **WHEN** ユーザーが Pane 3 ヘッダーを見る
- **THEN** 編集・プレビュー・差分の 3 モードのみが表示される
- **AND** Agent ボタンは存在しない

### Requirement: 画像ビュー切替中も Agent 処理を継続する

画像ビューへ切り替えても、`AgentChatPane` を unmount してはならない（MUST NOT）。進行中の AI invoke / ストリーミングは裏で継続しなければならない（SHALL）。Agent ビューに戻ったとき、進行中または完了済みのメッセージ状態が反映されていなければならない（SHALL）。

#### Scenario: 画像ビュー切替中もストリーミング継続

- **WHEN** ユーザーが Agent ビューでメッセージを送信し AI がストリーミング中である
- **AND** ユーザーが画像ビューに切り替える
- **THEN** ストリーミングは中断されない
- **AND** Agent ビューに戻ると応答が更新されている

### Requirement: 旧 Pane 3 Agent モード state をマイグレーションする

永続化された `pane3Mode === "agent"` を検出した場合、初回ロード時に `pane3Mode` を `"raw"` に、`pane4View` を `"agent"` に、`pane4Open` を true にマップしなければならない（SHALL）。

#### Scenario: 旧 Agent モードから復元

- **WHEN** localStorage に `pane3Mode: "agent"` が保存されている
- **AND** ワークスペースを読み込む
- **THEN** Pane 3 は編集モードになる
- **AND** Pane 4 が Agent ビューで開く

