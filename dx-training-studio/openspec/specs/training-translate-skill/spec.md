# training-translate-skill Specification

## Purpose

dx-training-translate スキル（教材の一括英訳）の要件。範囲指定・鮮度レポートと冪等な処理・正本 lib 経由のハッシュ計算・翻訳契約の参照・差分翻訳・書き込み対象と不可侵領域・changelog 追訳を定める。

## Requirements

### Requirement: 起動時確認は範囲を1回だけ聞く

スキルは起動時に翻訳範囲（全体／シリーズ指定／コース指定／レッスン指定。いずれもメタ含む）を確認しなければならない（SHALL）。依頼文から範囲が明確な場合は聞き直さない（SHALL NOT）。範囲に関わらず changelog は鮮度チェックの対象に含めなければならない（SHALL）。

#### Scenario: コース指定の実行

- **WHEN** 「Git三大エリアコースを英訳して」と依頼される
- **THEN** 範囲の聞き直しをせず、コースメタ＋配下レッスン（メタ＋本文）＋changelog を対象に進む

### Requirement: 鮮度レポートを提示し未翻訳と古いものだけを処理する

スキルは翻訳の前に範囲内の全ユニットの鮮度（`translation-freshness` の3状態）を走査し、「未翻訳 n・翻訳が古い m・最新 k」のレポートを提示しなければならない（SHALL）。処理対象は未翻訳と古いユニットだけとし、最新のユニットを再翻訳してはならない（SHALL NOT）——同じ範囲で再実行しても差分が出ない（冪等）。未完成（open / in_progress）のレッスンも対象に含める（SHALL）——status で絞らない。

#### Scenario: 再実行で何も起きない

- **WHEN** 全ユニットが最新の範囲でスキルを実行する
- **THEN** レポートに「最新 k」だけが並び、ファイルは1つも変更されない

### Requirement: 鮮度判定とハッシュは正本 lib を import したスクリプトで計算する

鮮度の判定と、翻訳後に書くハッシュ値（本文ハッシュ・メタハッシュ）は、スキル同梱の走査スクリプトが Studio の正本実装（`studio/lib/translation/freshness.ts`）を import して計算しなければならない（SHALL）。スキルの文書やその場のコードに判定・ハッシュ計算のロジックを複製してはならない（SHALL NOT）。

#### Scenario: 走査スクリプトの出力

- **WHEN** 走査スクリプトを範囲付きで実行する
- **THEN** ユニットごとの状態（本文/メタ）と、翻訳時に書くべきハッシュ値が出力される

### Requirement: 翻訳は契約を読み既訳を活かす差分翻訳で行う

スキルは翻訳の前に `contracts/translation-contract.md` を読み、その規則・用語集に従わなければならない（SHALL）——規則をスキル側に複製しない。既訳が存在するユニットでは既訳を読み取り、原文の変更に対応する箇所だけを更新しなければならない（SHALL）——変わっていない段落の訳文は変えない。

#### Scenario: 古い翻訳の更新

- **WHEN** 原文に1節だけ追記されたレッスンを処理する
- **THEN** 既訳の他の段落は一語も変わらず、追記部分の訳だけが加わる

### Requirement: 書き込みの対象と作法

書き込みは次に限定しなければならない（SHALL）: (1) `contents.en.md`——1行目に原文ハッシュ行（`translation-freshness` の書式）を持つ全文 (2) `.meta.json` の `_en` フィールド（レッスンは `name_en` / `description_en`、コースは `target_en` を含む）と `en_source_hash`——既存 JSON を読み、対象キーだけを差し替えて書き戻す (3) `changelog.en.md`。次に触れてはならない（SHALL NOT）: `author` / `author_en`・`id` / `order` / `slug` / `cross_series_prev` / `cross_series_next` / `is_start` / `is_goal`・`contents.md`（日本語正本）・画像ファイル。コミットしてはならない（SHALL NOT）——差分レビューと採否は人が行う。

#### Scenario: メタ書き込みの保全

- **WHEN** コース `.meta.json` の `name_en` / `target_en` / `en_source_hash` を書く
- **THEN** `id` / `order` / `slug` / `cross_series_*` / `style` / 日本語フィールドは1文字も変わらない

#### Scenario: author は書かない

- **WHEN** `author_en` が空のレッスンを翻訳する
- **THEN** `author_en` は空のままである

### Requirement: changelog 追訳は不足エントリの先頭挿入に限る

`changelog.en.md` が存在する場合、英語側の先頭エントリより新しい日本語エントリだけを訳し、既存エントリの前（ヘッダー直後）に挿入しなければならない（SHALL）。既存の英訳エントリを変更してはならない（SHALL NOT）。`changelog.en.md` が無ければ全文を翻訳して作成する（SHALL）。ハッシュ行は書かない（SHALL NOT）——changelog の鮮度は日付比較が正本。

#### Scenario: 追訳の挿入位置

- **WHEN** ja に新エントリが1件増えた状態で処理する
- **THEN** その英訳が `changelog.en.md` の既存エントリ群の前に挿入され、既存部分は不変である

### Requirement: 完了報告は差分の見どころを示す

スキルは処理の最後に、書き込んだユニットの一覧（新規翻訳／更新の別）と、レビューの見どころ（訳注コメントを残した箇所・整合の自己点検で気づいたこと）を報告しなければならない（SHALL）。翻訳品質の最終判断は人の差分レビューに委ねる。

#### Scenario: 完了報告

- **WHEN** コース1つ分の翻訳が終わる
- **THEN** 書いたファイルの一覧と訳注を残した箇所が報告され、コミットはされていない
