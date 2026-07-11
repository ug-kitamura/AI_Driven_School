# my-issue.md 提案出力（my-writing-proposals スキル）

入力: `my-issue.md`  
生成日: 2026/07/11  
対話で確定した承認範囲: ワークスペース試験導入のみ（APIは現行ベーシック）  
比較用: `my-proposal-1.md`（チームプラン＋部内導入を一括申請する版）

## 日本語版

```
【提案】3ペインAIワークスペースの試験導入（3〜5名・4週間）を承認いただきたい。APIは現行ベーシックのまま進めます。

■ コスト vs ベネフィット
・コスト：追加ライセンス費用なし（APIベーシック既存）。運用負荷は週1時間程度
・ベネフィット：AIスキル配布の障壁除去。将来判断にCopilot10名300€/月とチームAPI250€/月の比較材料を得る

■ 現状
・社内で有用なAIスキルを多数開発しているが、実行にはVSCode＋Copilot申請が必要
・Copilotは個別課金と社内プロセスの負荷により、部内展開が進んでいない
・3ペインワークスペースはプロトタイプ完成済み。個人検証で配布課題の解消を確認

■ 推奨
・案A：3〜5名・4週間の試験導入（現行APIベーシック利用）
・案B：チームAPI（月250€＋従量）を同時申請し本格展開
・案C：Copilot個別申請を継続し従来ルートを優先
→推奨：案A（追加コストゼロで検証でき、将来のAPI・部内正式導入の判断材料になる）

■ リスク
・ベーシックAPIは軽量モデルのみで成果物品質に限界 — 試験は配布・運用検証に限定し品質要件は次段階で判断
・小規模試験では全員のニーズをカバーできない — 4週間後に結果共有し次の申請可否を協議
```

## English Version

```
【Proposal】Please approve a 4-week pilot of the 3-pane AI workspace for 3–5 members, using the existing Basic API plan.

- Cost vs Benefit
- Cost: No additional license fees (existing Basic API). Estimated ops load: ~1 hour per week
- Benefit: Removes barriers to AI skill distribution. Provides comparison data for a future decision: Copilot for 10 users at ~€300/month vs Team API at €250/month plus usage

- Current State
- The team has built many useful internal AI skills, but running them requires VS Code plus individual Copilot requests
- Copilot adoption has stalled due to per-user billing and heavy internal approval processes
- The 3-pane workspace prototype is complete; personal testing confirmed it resolves the distribution bottleneck

- Recommendation
- Option A: 4-week pilot with 3–5 members (existing Basic API)
- Option B: Apply for Team API (€250/month + usage) and roll out department-wide now
- Option C: Continue individual Copilot requests on the current path
→ Recommended: Option A (zero added cost, validates distribution and operations, and informs later API and department-wide rollout decisions)

- Risks
- Basic API supports only lightweight models, limiting output quality — limit the pilot to distribution and workflow validation; defer quality requirements to the next phase
- A small pilot may not cover all members' needs — share results after 4 weeks and decide on the next approval step together
```

## 対話メモ

| 材料 | 確定内容 |
|---|---|
| 承認範囲 | 課長向けは試験導入のみ。チームプランAPI・部内正式導入は次段階 |
| 根拠 | プロトタイプ完成＋個人検証、Copilot10名300€/月 vs チームAPI250€/月 |
| 試験規模 | 3〜5名・4週間 |
| 決定者 | まず課長（論理・コスト重視）→ 最終は部長 |
