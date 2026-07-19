# 新モデル受け入れ手順（モデルプロファイル）

EBEX にモデルを追加・調整するときの標準フロー。モデルごとの継続・出力制御値は
`lib/agent/model-profiles.ts` の**モデルプロファイル**に一元管理されている。

## プロファイルの構造

```jsonc
{
  // ---- EBEX 解釈層（EBEX 本体が読んで動作を変える）----
  "maxOutputTokens": 32000,
  "continuations": {
    "generatePerSection": 8, // generate_and_write のセクションあたり継続上限
    "textPerTurn": 8,        // max_tokens 自動継続の上限/ターン
    "nudgeMax": 10           // 3値判定による自動続行（nudge）の総回数上限
  },
  // ---- 通過袋（プロバイダへ無解釈で渡す。未対応キーは無視される）----
  "providerParams": {
    "agent":    { "reasoning_effort": "medium", "verbosity": "medium" },
    "generate": { "reasoning_effort": "minimal", "verbosity": "high" }
  }
}
```

- `agent` スロット: ツール選択を伴うエージェントループ本体向け
- `generate` スロット: `generate_and_write` の子生成（考えるより書くタスク）向け
- 語彙はモデル系統ごとに異なる（OpenAI: `reasoning_effort`/`verbosity`、
  Gemini: `thinkingBudget` 等）。EBEX 本体は中身を解釈しない

## 受け入れフロー

1. **保守的既定で起動する**
   プロファイル未定義のモデルには自動で保守的既定
   （継続上限多め・nudgeMax 10）が適用される。まず動かすのに設定は不要。

2. **標準タスクを 1 回実行して診断ログを採取する**
   サンプル VTT で minutes-maid を実行するなど、成果物生成を伴うタスクを流す。
   `workspace/.meta/diagnostics.log` に `type: "turn"` のレコードが残る:
   - `stopReason` の分布（`max_tokens` が多い → 出力上限が実質低い）
   - `outputTokens`（1 ターンの可視出力量）
   - `continuations` / `nudges`（完走までに何回の自動継続が要ったか）
   - `leftoverArtifacts`（ターン終了時の埋め残し数）

3. **ログの数字からプロファイル値を決めて上書きする**
   環境変数 `EBEX_MODEL_PROFILES`（JSON、slug 単位の部分上書き）で設定する。
   コード変更・再デプロイは不要（再起動のみ）。

   ```bash
   EBEX_MODEL_PROFILES={"gpt-5-nano":{"continuations":{"nudgeMax":15},"providerParams":{"generate":{"reasoning_effort":"minimal"}}}}
   ```

   恒久値にする場合は `lib/agent/model-profiles.ts` の `BASE_MODEL_PROFILES` に
   エントリを追加する。

## 自動続行（nudge）の無効化

自動続行の誤動作が疑われる場合は `EBEX_AUTO_NUDGE=disabled` で切り戻せる。
無効時は従来どおり `max_tokens` 継続のみが動作する。

## 社内フォーク側の確認事項（プロバイダ配線）

社内ゲートウェイ経由でモデル（GPT-5 nano 等）を配線する際は、以下を必ず確認する。

1. **ゲートウェイの実効 max tokens**
   EBEX は `maxTokens`（既定 32000）を渡すが、ゲートウェイが独自に
   completion tokens をキャップしている場合がある。レスポンスの `usage` を確認し、
   実効上限がプロファイルの `maxOutputTokens` より低い場合はプロファイルを
   実効値に合わせる。推論系モデルでは reasoning トークンが同じ枠を消費するため、
   可視出力はさらに少なくなることに注意。

2. **finish_reason → stopReason のマッピング**
   OpenAI 系の `finish_reason: "length"` は必ず EBEX の
   `stopReason: "max_tokens"` に対応させること。このマッピングが欠けると
   max_tokens 自動継続（`runTurnWithMaxTokensContinuation`・generate_and_write の
   セクション継続）が一切発火せず、手動「つづき」が必要な状態に戻る。

3. **通過袋（providerParams）の配線**
   `LlmProviderRunOptions.providerParams` を API リクエストへ展開する。
   未対応・不明なキーはエラーにせず黙って無視する（契約）。
   `agent` / `generate` のどちらのスロット値が渡ってくるかは呼び出し側
   （agent-loop / generate-write）が制御するため、プロバイダは受け取った
   `providerParams` をそのまま使えばよい。

4. **usage の出力トークン数**
   `ProviderTurnResult.outputTokens` にレスポンス usage の出力トークン数を
   設定すると、診断ログでプロファイル調整の精度が上がる（任意だが推奨）。
