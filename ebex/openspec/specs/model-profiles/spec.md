# model-profiles Specification

## Purpose

モデルプロファイル（EBEX 解釈層＋providerParams 通過袋）の構造・既定値・外部上書き・未知モデルの既定挙動。

## Requirements

### Requirement: モデルプロファイルの構造

システムはモデルごとのプロファイルを一元管理しなければならない（SHALL）。プロファイルは EBEX が解釈する層（`maxOutputTokens`、継続上限 `generatePerSection` / `textPerTurn` / `nudgeMax`）と、プロバイダへ無解釈で渡す通過袋 `providerParams`（`agent` / `generate` の 2 スロット）で構成しなければならない（SHALL）。EBEX 本体は `providerParams` の中身を解釈・検証してはならない（MUST NOT）。

#### Scenario: 継続上限のプロファイル参照

- **WHEN** generate_and_write が gpt-5-nano で実行される
- **THEN** セクションあたりの継続上限は nano プロファイルの `generatePerSection`（8）が適用され、Claude 系では従来どおり 4 が適用される

#### Scenario: 通過袋のスロット出し分け

- **WHEN** プロバイダが agent ループと generate 子生成をそれぞれ実行する
- **THEN** それぞれ `providerParams.agent` / `providerParams.generate` が渡され、プロバイダが対応しないキーは無視される

### Requirement: 未知モデルの保守的既定プロファイル

プロファイル未定義のモデルには保守的な既定プロファイル（継続上限・nudge 上限を多めに設定した値）を適用しなければならない（SHALL）。未知モデルの実行がプロファイル不在を理由に失敗してはならない（MUST NOT）。

#### Scenario: 新モデルの初回実行

- **WHEN** プロファイル未定義の新モデル（例: Gemini 系）でエージェントを実行する
- **THEN** 既定プロファイル（generatePerSection 8 / textPerTurn 8 / nudgeMax 10 / maxOutputTokens 32000）で動作する

### Requirement: プロファイルの外部上書き

環境変数 `EBEX_MODEL_PROFILES`（JSON 文字列）により、プロファイル値を slug 単位で部分上書き（deep merge）できなければならない（SHALL）。不正な JSON は警告の上で無視し、既定プロファイルで続行しなければならない（SHALL）。

#### Scenario: コード変更なしのチューニング

- **WHEN** `EBEX_MODEL_PROFILES={"gpt-5-nano":{"continuations":{"nudgeMax":15}}}` を設定して起動する
- **THEN** nano の nudge 上限のみ 15 になり、他の値は既定のまま動作する

#### Scenario: 不正な設定値への耐性

- **WHEN** `EBEX_MODEL_PROFILES` に不正な JSON が設定されている
- **THEN** 警告が記録され、既定プロファイルで正常に起動する

### Requirement: 既存定数のプロファイル統合

`MODEL_MAX_OUTPUT_TOKENS`・`GENERATE_MAX_CONTINUATIONS_PER_SECTION`・`MAX_TEXT_CONTINUATIONS_PER_TURN` に相当する値はプロファイルから解決しなければならない（SHALL）。Claude 系モデルのプロファイル初期値は現行定数と同値とし、挙動を変えてはならない（MUST NOT）。`gpt-5-nano` のプロファイルエントリを追加しなければならない（SHALL）。

#### Scenario: Claude 系の挙動不変

- **WHEN** claude-sonnet-4-6 で従来どおりエージェントを実行する
- **THEN** maxOutputTokens 32000・継続上限 4 など、統合前と同一の値で動作する

### Requirement: 新モデル受け入れ手順の文書化

docs に新モデル受け入れ手順を記載しなければならない（SHALL）: (1) 保守的既定で標準タスクを実行 → (2) 継続診断ログから実測値を取得 → (3) `EBEX_MODEL_PROFILES` で値を設定。あわせて社内フォーク側の確認事項として、ゲートウェイの実効 max tokens の確認方法と `finish_reason` → `stopReason` マッピング（`length` → `max_tokens`）の検証を明記しなければならない（SHALL）。

#### Scenario: フォーク側での配線

- **WHEN** 社内フォークが新しいプロバイダを追加する
- **THEN** docs の手順に従い、通過袋の受け取り・stopReason マッピング・プロファイル値の決定を上流コード変更なしで完了できる

### Requirement: モデル依存数値のプロファイル集約

モデルによって変わる数値（各種上限・継続回数・`max_tokens`・`nudgeMax`・provider params 等）は、`model-profiles` のプロファイル定義に置かなければならない（SHALL）。エージェントのコアロジックに特定モデル向けの数値をハードコードしてはならない（MUST NOT）。新しいモデルの追加は、コアロジックの変更ではなくプロファイルの追加で完結できなければならない（SHALL）。

#### Scenario: 新モデルはプロファイル追加で完結する

- **WHEN** 新しいモデル（例: claude-opus-4-8）を追加する
- **THEN** プロファイル追加のみで必要な数値が解決され、コアロジックの変更を要しない

#### Scenario: コアに特定モデル向け数値をハードコードしない

- **WHEN** エージェントのコアロジックを検査する
- **THEN** 特定モデル向けの上限・継続回数・max_tokens 等がハードコードされていない
