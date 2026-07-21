# セッション並行ストリームの積み残し（次ターン引き継ぎ）

- 作成: 2026-07-21
- 対象 change: `openspec/changes/ebex-constraints-and-pledges`（32/32 実装完了・未アーカイブ）
- 目的: 今回修正した cross-session バグと、**未修正の深い問題**、および次に着手する際の推奨方針を openspec 作業へ引き継ぐ。

## 背景（この文書が要る理由）

`ebex-session-concurrency` capability の当初 spec は「フォルダ切替＝AI 中断」としていた。しかし実挙動の検証で、切替時の中断関数 `interruptForSwitch` は **定義のみで一度も呼ばれない dead code** であり、実際には中断していなかった。ユーザーの手動テストで以下が判明した。

- フォルダ切替でも AI 応答は継続する（＝ユーザーはこれを望ましいと判断）
- ストリーミング中は全フォルダの入力送信が無効（＝ユーザーは良いと判断）
- しかし **別フォルダの中断ボタンで元フォルダのストリームを止められた**（バグ）
- さらに **中断後、別フォルダのチャット入力欄に元フォルダのプロンプトが復元された**（バグ）

根本原因は、`AgentChatPane` が単一インスタンスで、ストリーミング状態（`isStreaming` / `abortRef` / `stopContextRef` / `input` / `streamingAssistantId`）を全フォルダで共有していること。

## 今回やったこと（B 案・実装済み）

「切替では中断しない」を正とし、**ストリームの所有 scopeId を追跡して制御を所有セッションに限定**した。

- 所有判定の純関数: `lib/agent/session-stream-ownership.ts`
  - `isForeignActiveStream(streamingScopeId, currentScopeId)` — 所有者が表示中フォルダと異なるか
  - `isStopDisabledForScope(isStreaming, streamingScopeId, currentScopeId)` — 中断ボタンを無効化すべきか
  - テスト: `__tests__/lib/agent/session-stream-ownership.test.ts`
- `components/workspace/AgentChatPane.tsx`
  - `streamingScopeId` state を追加し、ストリーム開始時にセット、終了時（finally）・停止時に null クリア
  - 中断ボタンに `stopDisabled`（別フォルダ所有時は無効化）
  - `handleStop` の冒頭で `isForeignActiveStream` なら早期 return（他フォルダから止めない・入力復元しない）
  - dead code の `interruptForSwitch` を削除
- `components/workspace/AgentChatInput.tsx` — `stopDisabled` prop を追加
- `lib/agent-chat-controller.ts` — `interruptForSwitch` 型フィールドを削除
- spec `ebex-session-concurrency` を「単一アクティブストリームとフォルダ切替の非中断／制御は所有セッション限定」へ改訂（`proposal.md` / `design.md` も反映済み）

この結果、報告された 2 バグは解消済み（テスト付き）。

## 未修正の深い問題（次ターンの主題）

**別フォルダ表示中も、バックグラウンドで走る所有フォルダのストリームが `setMessages` を呼ぶ。** その `setMessages` は「今表示中のセッションの messages」を対象に map するため、所有フォルダの assistant メッセージ ID が表示中リストに無く、更新が空振りする。

結果として、**所有フォルダへ戻ったとき、その回の AI 応答テキストがクライアント上で欠落し得る**。

- 影響範囲: チャット表示のテキストのみ。**サーバ側のファイル出力（成果物）は無事**（ツール実行はサーバで完了しディスクに書かれる）。
- 由来: 「単一コンポーネント＋バックグラウンドストリーム」という既存構造。B 案の変更が生んだものではない（`interruptForSwitch` が元々 dead code だったため以前から潜在）。
- 今回のユーザー報告には含まれない（未報告の潜在問題）。

## 次に着手する際の推奨方針

### 第一候補: A 案（フォルダ切替時に確認モーダル → AI 応答を中断）

不変条件が「**アクティブなストリームの所有者 = 常に表示中フォルダ**」になり、"別フォルダの裏でストリームが走る" 状態そのものが無くなる。→ 上の欠落問題は**原理的に消える**。今回の 2 バグも同時に起きなくなる（ので B 案の所有者追跡は不要になり撤去できる）。

- 必要な作業:
  - フォルダ切替の経路（親 `components/workspace/Workspace.tsx` / `FileTreePane.tsx` 側）に「応答中です。移動すると中断されます」の確認モーダルを挟む配線（`AgentChatPane` 内で完結しないのが要点）
  - 中断関数を復活（`interruptForSwitch` 相当）し、承認時に abort → セッション保存
  - B 案で入れた所有者追跡（`streamingScopeId` / `session-stream-ownership.ts` / `stopDisabled`）は撤去可能
  - spec `ebex-session-concurrency` を再度「切替＝中断（確認モーダル付き）」へ改訂
- トレードオフ:
  - バックグラウンド継続が失われる（ユーザーが当初「望ましい」とした挙動）
  - 切替のたびに確認モーダルの摩擦
  - abort はクライアント側の打ち切りで、サーバが既に書いた副作用（ファイル等）は残り得る（"きれいな取り消し"ではない）

### 代替: B 案を保ったまま深い問題だけ直す

ストリーミング状態をセッション（scopeId）単位に持たせ、`setMessages` を「所有 scopeId のセッション」に対して行うようにする本格リファクタ。バックグラウンド継続は維持できるが、単一コンポーネントの構造変更が必要で作業量は大きい。

## 着手時の最初のアクション

**A 案 / B 案-継続 のどちらで直すかは product 判断**（バックグラウンド継続を残すか否か）なので、実装前にユーザーへ確認すること。決めたら該当 spec を改訂し、この文書の「必要な作業」に沿って進める。

## 関連ファイル

- spec: `openspec/changes/ebex-constraints-and-pledges/specs/ebex-session-concurrency/spec.md`
- 実装: `components/workspace/AgentChatPane.tsx`, `components/workspace/AgentChatInput.tsx`, `lib/agent/session-stream-ownership.ts`, `lib/agent-chat-controller.ts`
- 親（A 案で触る）: `components/workspace/Workspace.tsx`, `components/workspace/FileTreePane.tsx`
