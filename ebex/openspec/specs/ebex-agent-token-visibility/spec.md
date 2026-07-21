# ebex-agent-token-visibility Specification

## Purpose

TBD - created by archiving change ebex-constraints-and-pledges. Update Purpose after archive.

## Requirements

### Requirement: token 数の集計

システムは各ターンの可視 token 数と、セッション累計の token 数を集計しなければならない（SHALL）。集計値は `.meta/diagnostics.log` に記録される可視 token 数と整合しなければならない（SHALL）。

#### Scenario: ターンとセッション累計を集計する

- **WHEN** あるターンが完了する
- **THEN** 当該ターンの可視 token 数が求まり、セッション累計に加算される

### Requirement: token 数の表示

システムはチャット UI に、直近ターンの token 数とセッション累計の token 数を表示しなければならない（SHALL）。金額（コスト）換算は表示してはならない（MUST NOT。社内規約に依存するため本 capability の対象外）。

#### Scenario: token 数がチャットに表示される

- **WHEN** ユーザーがチャット画面を見る
- **THEN** 直近ターンとセッション累計の token 数が表示され、金額換算は表示されない

### Requirement: token 表示のセッション永続化

システムは可視 token 数（直近ターンおよびセッション累計）をセッション単位で永続化しなければならない（SHALL）。ユーザーが別のプロジェクトフォルダへ切り替えて戻ってきたとき、システムは当該セッションの直近ターンおよびセッション累計の token 数を復元して表示し続けなければならない（SHALL）。フォルダ切替に伴うセッション状態の適用（`applySessionState`）で token 表示を無条件に消去してはならない（MUST NOT）。

#### Scenario: フォルダ往復で token 表示が残る

- **WHEN** あるフォルダで token 数が表示された後、別フォルダを開いて元フォルダへ戻る
- **THEN** 直近ターンとセッション累計の token 数が復元されて表示され続ける

#### Scenario: セッション累計は保存された値から継続する

- **WHEN** 永続化された token 累計を持つセッションを再表示する
- **THEN** セッション累計は保存値から継続し、0 にリセットされない
