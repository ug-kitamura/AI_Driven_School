# publishing-meta-fields Specification

## Purpose

公開サイト（DX Training Mandala）向けの正本メタフィールド（`slug` / `description` / `catch` / `cover` / `_en`）の定義と制約を規定する。

## Requirements

### Requirement: slug の形式と一意性

公開サイトの URL に使う `slug` は、アルファベット小文字・数字・ハイフンのみで構成されなければならない（SHALL）。`slug` は同じ親に属する兄弟エンティティ間（同一階層のシリーズ同士・同一シリーズ内のコース同士・同一コース内のレッスン同士）で一意でなければならない（SHALL）。`slug` は人が正本に書く値であり、ツールが日本語名から自動ローマ字変換で生成してはならない（SHALL NOT）。

公開サイトの URL は `/{シリーズslug}/{コースslug}/{レッスンslug}` の3階層で構成される。URL の組み立てとビルド時の欠落検出は公開サイト側（別 change）の責務とする。

#### Scenario: 有効な slug を受理する

- **WHEN** シリーズ `.meta.json` に `"slug": "git-basics"` が記述されている
- **THEN** スキーマ検証が成功し、ローダーがその値を返す

#### Scenario: 不正な文字種の slug を拒否する

- **WHEN** `.meta.json` に `"slug": "Git基礎"` のような ASCII 外文字を含む slug が記述されている
- **THEN** スキーマ検証が失敗し、その旨がわかるエラーになる

### Requirement: 公開サイト向けフィールドはすべて後方互換の任意フィールドである

`slug` / `description` / `catch` / `cover` / `name_en` / `description_en` / `catch_en` はすべて任意フィールドでなければならない（SHALL）。これらが存在しない正本に対して、Studio のロード・保存・編集は従来どおり動作しなければならない（SHALL）。Studio が `.meta.json` を書き戻す際、既に書かれている公開サイト向けフィールドを削除・欠落させてはならない（SHALL NOT）。

#### Scenario: フィールドが無い既存正本がそのまま動く

- **WHEN** 公開サイト向けフィールドを一切持たない既存の `.meta.json` と `contents.md` をロードする
- **THEN** エラーにならず、従来と同じ構造が返される

#### Scenario: 保存で公開サイト向けフィールドが消えない

- **WHEN** `slug` と `catch` を持つコース `.meta.json` があるコースについて、Studio が `order` を更新して保存する
- **THEN** 保存後の `.meta.json` にも `slug` と `catch` が残っている

### Requirement: 英語フィールドは `_en` サフィックスで同一ファイルに持つ

表示テキストの英語版は、日本語フィールドに `_en` サフィックスを付けたフィールド（`name_en` / `description_en` / `catch_en`）として**同一の `.meta.json` 内**に持たなければならない（SHALL）。別ファイル（`.meta.en.json` 等）に分離してはならない（SHALL NOT）。本 change の範囲はスキーマとローダーの対応（器）までとし、値の書込と公開サイトでの日本語フォールバック表示は範囲外とする。

#### Scenario: _en フィールドを読み込める

- **WHEN** シリーズ `.meta.json` に `"name_en": "Git Basics"` が記述されている
- **THEN** ローダーが返すシリーズ情報から `name_en` の値を取得できる

#### Scenario: _en フィールドが無くてもエラーにならない

- **WHEN** `_en` 系フィールドを持たない `.meta.json` をロードする
- **THEN** エラーにならず、`_en` 系は未設定として扱われる

### Requirement: cover はシリーズのみが持つ

ヒーロー画像の参照 `cover` は、シリーズ `.meta.json` のみが持てる（MAY）。コース・レッスン・全体（`contents/.meta.json`）のスキーマに `cover` を定義してはならない（SHALL NOT）。`cover` の値は正本画像置き場（`images/<file>`）のファイル名でなければならない（SHALL）。

#### Scenario: シリーズの cover を読み込める

- **WHEN** シリーズ `.meta.json` に `"cover": "cover-git-basics.png"` が記述されている
- **THEN** ローダーが返すシリーズ情報から `cover` の値を取得できる
