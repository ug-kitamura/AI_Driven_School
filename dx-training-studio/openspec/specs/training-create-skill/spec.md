# training-create-skill Specification

## Purpose

レッスン草稿生成スキル（`dx-training-create`）のパッケージ構成と参照ドキュメントを定義する。計画書が決めた構成を入力として、レッスン本文の草稿を生成するスキルの側の規約を扱う。構成そのものの設計は `training-plan-skill` の担当領域。

## Requirements

### Requirement: 執筆原則ドキュメントの配置

`dx-training-create` スキルの執筆原則は `.claude/skills/dx-training-create/references/design-principles.md` として、独立した Markdown ファイルで存在しなければならない（SHALL）。現時点では `SKILL.md` およびその他の references を作成してはならない（SHALL NOT）。スキルとしてロードされない中間状態であることを受け入れる。

#### Scenario: references が独立したファイルとして存在する

- **WHEN** 開発者が `.claude/skills/dx-training-create/references/` を見る
- **THEN** `design-principles.md` が存在する

#### Scenario: スキル本体は作らない

- **WHEN** `.claude/skills/dx-training-create/` を見る
- **THEN** `SKILL.md` は存在しない
- **AND** スキルとしてロードされない中間状態であることが受け入れられている

### Requirement: 抽出元と網羅

原則は `ads-lecture/` の講義文字起こしから抽出しなければならない（SHALL）。全11回すべてに当たらなければならない（SHALL）。拾うものが無い回が存在してよく、その場合に無理に項目を作ってはならない（SHALL NOT）。

#### Scenario: 全11回に当たる

- **WHEN** 抽出作業を行う
- **THEN** 第1回から第11回までのすべての文字起こしを読む

#### Scenario: 収穫のない回を許容する

- **WHEN** ある回に本文執筆の判断を変える知見が含まれていない
- **THEN** その回からは何も抽出しない
- **AND** 項目数を揃えるための水増しをしない

### Requirement: 抽出の判定基準

抽出対象は、**レッスン本文を書くときの判断を変えるもの**に限定しなければならない（SHALL）。具体的には説明の順序、図解の使いどころ、たとえの作り方、演習の組み立て、つまずきの扱いを含む。次に該当するものは抽出してはならない（SHALL NOT）: 講義の運営・受講者管理、シリーズ/コース/レッスンの構成設計（`dx-training-plan` の担当領域）、特定ツール固有の事情。

#### Scenario: 本文執筆の判断を変える知見を拾う

- **WHEN** 講義に「概念より先に手を動かさせると定着する」といった記述がある
- **THEN** 本文の構成順に影響するため抽出する

#### Scenario: 構成設計の知見は拾わない

- **WHEN** 講義にコースの並べ方や前提関係に関する記述がある
- **THEN** `dx-training-plan` の担当領域として抽出しない

#### Scenario: 運営の知見は拾わない

- **WHEN** 講義に受講者の募集・出欠・進捗管理に関する記述がある
- **THEN** 抽出しない

#### Scenario: ツール固有の事情は拾わない

- **WHEN** 講義に特定ツールのバージョン差異や設定手順が含まれる
- **THEN** 原則ではなく個別事情として抽出しない

### Requirement: 講義に無い原則を創作しない

`design-principles.md` に記載する原則は、講義文字起こしに根拠があるものだけでなければならない（SHALL）。一般論として尤もらしいだけの原則を追加してはならない（SHALL NOT）。

#### Scenario: 根拠のない原則を追加しない

- **WHEN** 執筆上よく言われる原則を思いついたが、講義に該当する記述がない
- **THEN** その原則は記載しない

### Requirement: dx-training-plan 版との関係

`design-principles.md` は単体で読んで意味が通らなければならない（SHALL）。`dx-training-plan/references/design-principles.md` に既にある原則と重なった場合、原則の説明文を書き写してはならない（SHALL NOT）。見出しと要点を短く示したうえで、**草稿への落とし方**を `dx-training-create` の視点で書かなければならない（SHALL）。`dx-training-plan` 側の references を変更してはならない（SHALL NOT）。

#### Scenario: 重複した原則の扱い

- **WHEN** 抽出した原則が `dx-training-plan` 版に既に存在する
- **THEN** 原則の説明文を複製せず、見出しと要点のみを短く示す
- **AND** 草稿への落とし方だけを新たに書く

#### Scenario: 単体で読める

- **WHEN** `dx-training-plan` 版を読んでいない者が `dx-training-create` 版を読む
- **THEN** 各項目の意味が通じる

#### Scenario: plan 側を変更しない

- **WHEN** 差分を確認する
- **THEN** `.claude/skills/dx-training-plan/` 配下に変更がない

### Requirement: 体裁

`design-principles.md` は既存の `dx-training-plan/references/design-principles.md` と同じ体裁でなければならない（SHALL）。各項目は「原則の見出し」「なぜそうするか」「草稿への落とし方」を対にしなければならない（SHALL）。冒頭に目次を置かなければならない（SHALL）。

#### Scenario: 原則と落とし方が対になっている

- **WHEN** `design-principles.md` の任意の項目を読む
- **THEN** 原則の理由と、草稿に落とすときの具体的な指針の両方が書かれている

#### Scenario: 目次を持つ

- **WHEN** ファイル冒頭を読む
- **THEN** 収録されている原則の分類が一覧できる
