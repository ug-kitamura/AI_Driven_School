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

### Requirement: Pane3 最小幅は 520px とする

Pane3（Markdown エディタペイン）の実幅は **520px 未満になってはならない**（SHALL NOT）。`PANE3_MIN_WIDTH` 定数（520）として `pane-layout.ts` に定義しなければならない（SHALL）。Pane3 幅は設定ダイアログの項目に含めてはならない（MUST NOT）。

#### Scenario: fit 後の pane3 が min 以上

- **WHEN** `fitPaneLayout` が任意の入力で実行される
- **THEN** 返却後のレイアウトにおける pane3 実幅は 520px 以上である（利用可能幅が全 min 合計未満の例外を除く）

#### Scenario: 設定 UI に pane3 幅がない

- **WHEN** ユーザーがワークスペース設定ダイアログの横幅セクションを開く
- **THEN** 編集可能なペイン幅入力は pane1・pane2・pane4 の 3 つのみである

### Requirement: fitPaneLayout は利用可能幅にペインを収める

`fitPaneLayout` pure function は、要求幅（pane1 / pane2 / pane4）と利用可能幅を受け取り、Pane3 最小幅を満たすよう pane1 / pane2 / pane4 を調整した `WorkspacePaneWidths` を返さなければならない（SHALL）。各 pane は `PANE_WIDTH_LIMITS` の min/max 内に収めなければならない（SHALL）。

#### Scenario: 幅に余裕がある

- **WHEN** 要求幅の合計 + pane3 min + ハンドルが利用可能幅以下である
- **THEN** pane1 / pane2 / pane4 は要求値（clamp 後）のまま返される

#### Scenario: 不足時は pane4 から縮小

- **WHEN** 要求幅の合計が利用可能幅を超え、pane4 が開いている
- **THEN** まず pane4 幅を min（240）まで減らす

#### Scenario: 不足時の縮小順

- **WHEN** pane4 を min まで縮めても pane3 が 520 未満である
- **THEN** 次に pane1 を min（180）まで、続けて pane2 を min（200）まで縮小する

### Requirement: fit はブラウザリサイズとペイン操作で実行する

ワークスペースは、SidebarInset 内ペイン行の幅変化（ResizeObserver）および pane1 / pane2 / pane4 のリサイズハンドル操作、設定ダイアログからの横幅適用のたびに `fitPaneLayout` を実行し、返却値を pane 幅 state に反映しなければならない（SHALL）。横スクロールバーをレイアウト救済に用いてはならない（MUST NOT）。

#### Scenario: ウィンドウ幅を狭める

- **WHEN** ユーザーがブラウザウィンドウ幅を狭める
- **THEN** pane4 → pane1 → pane2 の順で各 min まで自動縮小される
- **AND** pane3 実幅は 520px 以上が維持される（可能な範囲で）

#### Scenario: pane2 ハンドルで広げる

- **WHEN** ユーザーが pane2 を広げようとドラッグする
- **AND** pane3 に譲れる幅が不足する
- **THEN** fit により pane4 / pane1 が先に縮小され pane2 拡大が可能になる

### Requirement: 折りたたみ状態は fit から変更しない

`fitPaneLayout` は pane1 の sidebar アイコン折りたたみ状態および pane4 の開閉（`pane4Open`）を変更してはならない（MUST NOT）。pane4 閉時は pane4 有効幅を折りたたみストリップ幅（48px）として計算に用いなければならない（SHALL）。

#### Scenario: pane4 閉時は 48px として fit

- **WHEN** pane4 が閉じている
- **THEN** fit の pane4 寄与幅は 48px である
- **AND** fit は pane4 を開く操作を行わない

#### Scenario: fit は sidebar 折りたたみを触らない

- **WHEN** fit が実行される
- **THEN** pane1 の sidebar collapsible 状態は変化しない

