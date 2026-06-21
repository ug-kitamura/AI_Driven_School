# workspace-pane-layout Specification

## Purpose

DX Training Editor のワークスペースペイン幅（pane1 / pane2 / pane4）の clamp・snap ロジックを定義する。`components/workspace/pane-layout.ts` の pure function として実装され、リサイズ UI および設定モーダルから利用される。

## Requirements

### Requirement: ペイン幅は clamp により範囲内に収める

各ペイン（pane1 / pane2 / pane4）の幅は `PANE_WIDTH_LIMITS` で定義された min/max の範囲内に収めなければならない（SHALL）。`clampPaneWidth` はこの規則を pure function として実装しなければならない（SHALL）。

#### Scenario: 下限未満の値を clamp

- **WHEN** `clampPaneWidth("pane1", 100)` を呼び出す
- **THEN** 結果は pane1 の min（180）である

#### Scenario: 上限超過の値を clamp

- **WHEN** `clampPaneWidth("pane4", 999)` を呼び出す
- **THEN** 結果は pane4 の max（480）である

### Requirement: 設定モーダル用 snap は PANE_WIDTH_STEP 刻みに丸める

`snapPaneWidth` は clamp 後に `PANE_WIDTH_STEP`（5px）刻みで丸めなければならない（SHALL）。`snapPaneWidths` は 3 ペインすべてに適用しなければならない（SHALL）。

#### Scenario: 刻みに snap

- **WHEN** `snapPaneWidth("pane2", 213)` を呼び出す
- **THEN** 結果は 215 である

#### Scenario: snapPaneWidths が全ペインに適用される

- **WHEN** 任意の `WorkspacePaneWidths` を `snapPaneWidths` に渡す
- **THEN** 返却値の各ペイン幅は対応する min/max 内かつ 5px 刻みである
