# skill-template-conventions Specification

## Purpose

スキルテンプレートのプレースホルダー・マーカー・自己完結性に関する規約。軽量モデルでも決定的に埋め込み操作が実行できることを保証する。

## Requirements

### Requirement: 変数プレースホルダーの統一

スキルテンプレート内の短い可変値（タイトル・日付・人名等）は `{{XXX}}` 形式のプレースホルダーで表現しなければならない（MUST）。プレースホルダー名は大文字スネークケースとする。

#### Scenario: 短スロットの置換

- **WHEN** スキルがテンプレートをコピーして短スロットを埋める
- **THEN** `replace_in_file` の `replacements` map による `{{XXX}}` の一括置換のみで完了し、挿入位置の判断を必要としない

### Requirement: 区間マーカーの統一

スキルテンプレート内の可変長ブロック挿入位置は `<!-- XXX_START -->` と `<!-- XXX_END -->` の明示マーカー組で表現しなければならない（MUST）。マーカー名は大文字スネークケース＋ `_START`/`_END` サフィックスとする。

#### Scenario: 可変長ブロックの差し込み

- **WHEN** スキルが議題リスト等の可変長ブロックをテンプレートへ差し込む
- **THEN** `replace_between`（start_marker/end_marker 指定、必要に応じ from_path 併用）のみで完了し、挿入位置の判断を必要としない

#### Scenario: マーカー以外のコメント禁止

- **WHEN** テンプレートファイルをレビューする
- **THEN** HTML コメントは `_START`/`_END` マーカーのみであり、自由記述の説明コメントは存在しない（指示は SKILL.md 側に記載される）

### Requirement: 区間マーカー名の一意性

スキルテンプレート内の区間マーカー名は、同一ファイル内で一意でなければならない（MUST）。同じ `<!-- XXX_START -->` / `<!-- XXX_END -->` の組を 1 つのファイルに複数置いてはならない（MUST NOT）。複数の差し込み区間を持つテンプレートは、区間ごとに役割を表す異なる名前（例: `AGENDA_LIST` / `ACTION_PLAN`）を用いなければならない（SHALL）。

区間端トークンと同じ字面を、マーカー以外の位置（ガイド文・説明・サンプル）に書いてはならない（MUST NOT）。

#### Scenario: 複数区間を持つテンプレートの差し込み

- **WHEN** テンプレートが議題リスト・議題の詳細・アクションプランの 3 区間を持ち、スキルが 2 番目の区間へ差し込む
- **THEN** 当該区間の一意な名前を指定するだけで 2 番目の区間が置換され、1 番目の区間は変更されない

#### Scenario: 同名マーカーの検出

- **WHEN** テンプレートファイルをレビューする
- **THEN** 同一ファイル内に同名の `_START` / `_END` マーカーの組が 2 つ以上存在しない

### Requirement: テンプレートの自己完結

スキルテンプレートは外部ファイル参照を持ってはならない（MUST NOT）。CSS は `<style>` タグとしてインライン化し、ロゴ等の小さな画像は base64 data URI で埋め込む。CDN 経由のライブラリ読み込み（Tailwind、Lucide 等）はこの制約の対象外とする。

#### Scenario: CSS の扱い

- **WHEN** テンプレートから HTML を生成する
- **THEN** モデルによる CSS インライン化の操作は発生せず、テンプレートに最初から含まれる `<style>` がそのまま生成物に含まれる

#### Scenario: 生成物の単体配布

- **WHEN** 生成された HTML ファイルを単体で共有する
- **THEN** 同梱ファイル（style.css 等）なしでスタイル・ロゴが正しく表示される

### Requirement: creating-skills への規約収録

テンプレート設計規約（変数・区間・自己完結・区間名の一意性）の正本は、作業ホストの `contracts/` に置かれた skill contract でなければならない（SHALL）。creating-skills スキルは当該規約の本文を自スキル内へ重複して収録してはならない（MUST NOT）。creating-skills は既存要件「creating-skills のホスト contract フック」に従って契約を必読へ加えることで規約に準拠しなければならない（SHALL）。

#### Scenario: 新規スキル作成時の参照

- **WHEN** ユーザーが creating-skills を使って穴埋めテンプレートを持つスキルを、契約が存在するホストで作成する
- **THEN** 契約が必読に加えられ、生成されるテンプレートは変数 `{{XXX}}`・区間 `_START`/`_END`・区間名の一意性・自己完結の規約に準拠する

#### Scenario: 規約本文が二重管理されない

- **WHEN** creating-skills の `SKILL.md` および `references/` をレビューする
- **THEN** テンプレート設計規約の本文は含まれず、ホスト契約への参照のみが存在する

### Requirement: creating-skills のホスト contract フック

creating-skills スキルは、作業ホストの `contracts/` に skill contract が存在する場合、それを必読リファレンスに加えて準拠しなければならない（SHALL）。当該フックはホスト非依存の汎用表現とし、特定ホスト（EBEX 等）固有の名称・パスに依存してはならない（MUST NOT）。フックの追記はスキル本文を膨張させず、参照を促す最小限に留めなければならない（SHALL）。

#### Scenario: contract 存在時に必読へ加える

- **WHEN** ホストの `contracts/` に skill contract があり、creating-skills でスキルを作成・改善する
- **THEN** その契約が必読に加えられ、生成・更新されるスキルが契約に準拠する

#### Scenario: contract が無いホストでは従来どおり

- **WHEN** ホストに skill contract が存在しない
- **THEN** 追加の必読は発生せず、creating-skills は従来どおり動作する
