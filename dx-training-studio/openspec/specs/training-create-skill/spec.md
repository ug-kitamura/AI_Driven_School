# training-create-skill Specification

## Purpose

レッスン草稿生成スキル（`dx-training-create`）のパッケージ構成と参照ドキュメントを定義する。計画書が決めた構成を入力として、レッスン本文の草稿を生成するスキルの側の規約を扱う。構成そのものの設計は `training-plan-skill` の担当領域。

## Requirements

### Requirement: 執筆原則ドキュメントの配置

`dx-training-create` スキルの執筆原則は `.claude/skills/dx-training-create/references/design-principles.md` として、独立した Markdown ファイルで存在しなければならない（SHALL）。スキルは `SKILL.md` を持ち、スキルとしてロード可能でなければならない（SHALL）。`SKILL.md` は references の内容を重複させてはならない（SHALL NOT）——参照先を書くに留める。

#### Scenario: references が独立したファイルとして存在する

- **WHEN** 開発者が `.claude/skills/dx-training-create/references/` を見る
- **THEN** `design-principles.md` が存在する
- **AND** `lesson-template.md` が存在する

#### Scenario: スキルとしてロードできる

- **WHEN** `.claude/skills/dx-training-create/` を見る
- **THEN** `SKILL.md` が存在する
- **AND** frontmatter に `name` と `description` を持つ

#### Scenario: SKILL.md が references を重複させない

- **WHEN** `SKILL.md` を読む
- **THEN** 執筆原則の本文もレッスンの型の本文も書かれておらず、参照先が示されている

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

### Requirement: 生成範囲と執筆単位を分ける

スキルは生成範囲を**全体 / シリーズ / コース / レッスン**の4段階から選べなければならない（SHALL）。既定はコース単位でなければならない（SHALL）。範囲がどれであっても、**執筆は1レッスンずつ順次行い、1レッスン書き終えるごとにファイルへ書き出さなければならない**（SHALL）。複数レッスンをまとめて生成してはならない（SHALL NOT）。

#### Scenario: コース単位を選んで3レッスンを書く

- **WHEN** ユーザーがコース単位を選び、そのコースに3レッスンある
- **THEN** 設計メモはコース単位で1本作られる
- **AND** 執筆は1レッスンずつ順に行われ、各レッスンの `contents.md` が書き終えるたびに保存される

#### Scenario: 途中で中断しても再開できる

- **WHEN** コース単位の執筆が2レッスン目で中断される
- **THEN** 1レッスン目の `contents.md` は保存されている
- **AND** 設計メモが残っているため、どこまで書いたかが分かる

### Requirement: 出力先とディレクトリ命名

生成物は `contents/<シリーズ名>/<コース名>/<レッスン名>/contents.md` に出力しなければならない（SHALL）。ディレクトリ名は**計画書に書かれた名前をそのまま使わなければならない**（SHALL）。slug をディレクトリ名に使ってはならない（SHALL NOT）。既存の `contents/` 配下を変更・削除してはならない（SHALL NOT）。

#### Scenario: 計画書の名前でディレクトリを作る

- **WHEN** 計画書にシリーズ「はじめに」、コース「DX入門」、レッスン「トレーニングの進め方」とある
- **THEN** `contents/はじめに/DX入門/トレーニングの進め方/contents.md` が作られる

#### Scenario: 名前が衝突する

- **WHEN** 出力先に同名のディレクトリが既に存在する
- **THEN** 衝突する対象を一覧で提示する
- **AND** ユーザーの確認を得るまで書き込まない

### Requirement: frontmatter と .meta.json の書き分け

`contents.md` の frontmatter には `series` / `course` / `lesson` / `status` / `description` / `tags` / `estimated_minutes` / `author` を書かなければならない（SHALL）。`.meta.json` には `order` と `target` を書かなければならない（SHALL）。`.meta.json` に `id` を書いてはならない（SHALL NOT）——loader が自動採番して書き戻す。`cross_series_prev` および `cross_series_next` を書いてはならない（SHALL NOT）——曼陀羅の辺は計画側の責任。

#### Scenario: コースの .meta.json を書く

- **WHEN** コース単位で生成する
- **THEN** そのコースの `.meta.json` に `order`（レッスン名の配列）と `target`（計画書の受講対象）が書かれる
- **AND** `id` と `cross_series_prev` と `cross_series_next` は書かれていない

#### Scenario: 順序が計画書どおりになる

- **WHEN** 計画書のレッスン順が名前の昇順と一致しない
- **THEN** `.meta.json` の `order` によって計画書どおりの順序が保たれる

### Requirement: 設計メモの出力

執筆の前に設計メモを出力し、ユーザーの承認を得なければならない（SHALL）。設計メモは `docs/<yyyymmdd>/` 配下に、範囲に応じたファイル名で出力しなければならない（SHALL）: 全体は `overall.md`、シリーズは `{シリーズslug}.md`、コースは `{シリーズslug}-{コースslug}.md`、レッスンは `{シリーズslug}-{コースslug}-{レッスンslug}.md`。同日に同じ対象を再実行する場合、既存の最大連番+1 を付けなければならない（SHALL）。設計メモは**要求と供給の突き合わせを兼ねなければならない**（SHALL）。

#### Scenario: 設計メモを出力して承認を得る

- **WHEN** 情報収集フェーズが終わる
- **THEN** 設計メモ案が提示される
- **AND** ユーザーが承認するまで本文の執筆に進まない

#### Scenario: 同日に再実行する

- **WHEN** `docs/20260806/start-setup.md` が既に存在する状態で同じコースを再実行する
- **THEN** `docs/20260806/start-setup-2.md` が作られる

#### Scenario: 要求と供給を突き合わせる

- **WHEN** 設計メモを読む
- **THEN** そのレッスンが前提とする知識（要求）と、どのレッスンでそれが供給されるかが対応づけられている

### Requirement: 埋められない箇所を穴として残す

自宅環境で埋められない箇所は、本文に**穴**として残さなければならない（SHALL）。穴は3種類を使い分けなければならない（SHALL）: `> **社内**:`（社内情報のテキスト）、`> **社内画像**:`（社内画面の撮影・録画）、`> **素材**:`（一般だが人手が要る画像）。画像生成用の HTML コメントの書式を変更してはならない（SHALL NOT）。

社内情報の穴には、**答えるべき問いを箇条書きで具体的に書かなければならない**（SHALL）。あわせて期待する形式と分量を指定しなければならない（SHALL）。穴の周囲に一般論を書いてはならない（SHALL NOT）——導入文と次への接続文のみを書く。

#### Scenario: 社内手順の穴を残す

- **WHEN** 社内システムからの申請手順が必要な箇所に到達する
- **THEN** `> **社内**:` の blockquote が置かれる
- **AND** システムの呼称・画面の経路・必須入力項目・通知先・リードタイムといった答えるべき問いが箇条書きで書かれている
- **AND** 「番号付き手順3〜5ステップ / 200〜300字」のような形式と分量が指定されている

#### Scenario: 一般論で埋めない

- **WHEN** 社内手順が分からない箇所を書く
- **THEN** 一般的な手順を書いて「社内向けに直せ」と注記することはしない
- **AND** 導入文と次の段落への接続文だけを書く

#### Scenario: 画像コメントの書式を変えない

- **WHEN** AI 生成で埋まる画像の枠を置く
- **THEN** `contracts/image-slot-contract.md` の定める HTML コメント（プロンプト本文のみ）で書く
- **AND** 印や接頭辞を付けない

### Requirement: 執筆中に見つけた穴を承認なしに追加しない

執筆中に設計メモに無い穴が必要と判明した場合、本文に書き込む前にユーザーに提示して承認を得なければならない（SHALL）。承認後、**設計メモと本文を同時に更新しなければならない**（SHALL）。設計メモを承認なしに更新してはならない（SHALL NOT）。

#### Scenario: 新しい穴を見つける

- **WHEN** 執筆中に、設計メモに載っていない社内情報が必要だと判明する
- **THEN** その穴の内容をユーザーに提示して承認を求める
- **AND** 承認後に設計メモと本文の両方へ反映する

#### Scenario: メモと本文がずれない

- **WHEN** 執筆が終わる
- **THEN** 本文にあるすべての穴が設計メモの作業リストに載っている

### Requirement: 模範解答が無い状態を正常として扱う

`references/model-answer/` が存在しない、または空である状態をエラーとして扱ってはならない（SHALL NOT）。模範解答が無い場合は `lesson-template.md` と `design-principles.md` だけで執筆しなければならない（SHALL）。実行の最後に、生成した草稿を模範解答へ昇格させるかをユーザーに問わなければならない（SHALL）。

#### Scenario: 模範解答が無い状態で実行する

- **WHEN** `references/model-answer/` が存在しない状態でスキルを実行する
- **THEN** エラーにならず、型はテンプレート、質は執筆原則が支える形で執筆が進む

#### Scenario: 昇格を促す

- **WHEN** 執筆と曼陀羅フェーズが終わる
- **THEN** 出来の良い草稿を模範解答に昇格させるかをユーザーに問う

### Requirement: 曼陀羅フェーズを最後に固定する

曼陀羅（コース間のつながり）に関する作業は、生成範囲に関わらず**最後のフェーズとして実行しなければならない**（SHALL）。同一シリーズ内の順序は `.meta.json` の `order` で表現しなければならない（SHALL）。シリーズをまたぐ分岐・合流は**提案に留めなければならない**（SHALL）——`cross_series_prev/next` を書き込んではならない（SHALL NOT）。

#### Scenario: レッスン単位でも曼陀羅フェーズを通る

- **WHEN** 生成範囲にレッスン単位を選ぶ
- **THEN** 執筆後に曼陀羅フェーズが実行される
- **AND** そのレッスンがコース内のどの位置に入るかが確認される

#### Scenario: シリーズまたぎは提案に留める

- **WHEN** 別シリーズとの接続が必要だと判断する
- **THEN** 接続案を提示する
- **AND** `.meta.json` の `cross_series_prev` / `cross_series_next` は書き換えない

### Requirement: 自己レビュー

執筆した草稿に対し、**フレッシュな文脈でのレビューを行わなければならない**（SHALL）。レビュー役に修正させてはならない（SHALL NOT）——指摘のみを受け取り、反映は執筆側が判断する。レビューは全体評価だけでなく、**読者が頭から読んだときの反応を時系列で出させなければならない**（SHALL）。

#### Scenario: 時系列のレビューを行う

- **WHEN** 1レッスンの草稿が書き終わる
- **THEN** 初学者が頭から読んだときの反応が、本文の順に沿って出力される
- **AND** 全体をまとめた評価だけでは終わらない

#### Scenario: レビュー役に修正させない

- **WHEN** レビューで指摘が出る
- **THEN** レビュー役は改善案を出すに留まり、本文を書き換えない
