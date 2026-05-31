# training-editor-image-pane Specification

## Purpose

DX Training Editor の Pane4（画像アセットマネージャー）における staging / promote、Used タブ、グリッド UI、拡大プレビュー、画像 API を定義する。`pane4-image-assets` change により確定した挙動を正本とする。

## Requirements

### Requirement: 画像は source 別 staging フォルダに保存する

Pane4 で取得した画像は `dx-training-editor/images/{source}/_staging/` に保存しなければならない（SHALL）。`source` は `uploaded`・`ai`・`web` のいずれかである。UP タブからの取得は `uploaded` を用いなければならない（SHALL）。`images/**/_staging/**` は git 追跡対象外としなければならない（SHALL）。promote 先（`images/{source}/` 直下、`_staging` 除く）は git 追跡対象としなければならない（SHALL）。

#### Scenario: アップロードは uploaded staging に保存される

- **WHEN** ユーザーが UP タブで画像ファイルをアップロードする
- **THEN** ファイルは `images/uploaded/_staging/` 配下に保存される
- **AND** UP タブの一覧に表示される

### Requirement: UP タブは staging 画像のみ表示する

UP タブは `images/uploaded/_staging/` 内の画像のみを一覧表示しなければならない（SHALL）。AI タブ・Web タブは本 change では実 API 連携を行わず、準備中のプレースホルダ UI を表示してよい（MAY）。

#### Scenario: UP タブに promote 済みは表示されない

- **WHEN** 画像が promote 済みである
- **THEN** 当該画像は UP タブには表示されない
- **AND** Used タブに表示される

### Requirement: 挿入時に promote コピーとパス挿入を行う

staging 画像からの挿入操作は、`images/{source}/_staging/{filename}` を `images/{source}/{filename}` へ **コピー** しなければならない（SHALL）。staging 側のファイルは削除してはならない（MUST NOT）。同時に Markdown へ `![{filename}](images/{source}/{filename})` 形式の文字列を挿入しなければならない（SHALL）。

#### Scenario: staging から挿入で promote コピーが残る

- **WHEN** ユーザーが UP タブの staging 画像を挿入する
- **THEN** `images/uploaded/{filename}` にコピーが作成される
- **AND** `images/uploaded/_staging/{filename}` は残る
- **AND** エディタに `images/uploaded/...` パスが挿入される

### Requirement: Used タブは promote 済みと壊れリンクを表示する

Used タブは Pane4 タブ列の **左端** に配置し、ラベル **Used** と Lucide **`SquareCheckBig`** アイコンを用いなければならない（SHALL）。Used タブは次を一覧表示しなければならない（SHALL）:

1. `images/uploaded/`・`images/ai/`・`images/web/` 直下の promote 済みファイル（`_staging` 除く）
2. いずれかのレッスン `content` に参照があるがファイルが存在しない `images/...` パス

#### Scenario: promote 済みが Used に表示される

- **WHEN** 画像が promote 済みである
- **THEN** Used タブの一覧に当該画像が表示される

#### Scenario: 壊れリンクが Used に表示される

- **WHEN** レッスン content に `images/uploaded/missing.png` への参照がある
- **AND** 当該ファイルが存在しない
- **THEN** Used タブに当該パスの行が表示される
- **AND** 「画像が存在しません」と表示される

### Requirement: Used タブは参照出現回数を表示する

Used タブの各行は、全レッスン `content` 内における当該 `images/...` パスの **出現回数合計** を表示しなければならない（SHALL）。出現回数が 0 の promote 済みファイルは `未使用` と表示しなければならない（SHALL）。出現回数が 1 以上の場合は `参照: N` 形式で表示しなければならない（SHALL）。

#### Scenario: 複数レッスンで参照された回数

- **WHEN** 2 つのレッスン content にそれぞれ同一 `images/uploaded/foo.png` が 1 回ずつ含まれる
- **THEN** Used タブの当該行は `参照: 2` と表示する

#### Scenario: 未使用の promote 済みファイル

- **WHEN** promote 済みファイルが存在する
- **AND** いずれのレッスン content にも当該パスへの参照がない
- **THEN** Used タブの当該行は `未使用` と表示する

### Requirement: 画像一覧はレスポンシブグリッドで表示する

Pane4 の画像一覧（Used・UP）は、Pane 幅に応じて **1〜3 列** のサムネイルグリッドで表示しなければならない（SHALL）。各セルはサムネイルとファイル名を含まなければならない（SHALL）。

#### Scenario: 狭い Pane4 幅

- **WHEN** Pane4 の幅が狭い
- **THEN** グリッドは 1 列表示となる

### Requirement: サムネイルクリックで拡大表示する

画像サムネイル（壊れリンク行を除く）をクリックすると、拡大プレビュー（モーダルまたはオーバーレイ）を表示しなければならない（SHALL）。拡大表示はファイル名・パス・画像のピクセル寸法（幅 × 高さ）を含んでもよい（MAY）。挿入・削除操作はサムネイルクリックとは別のコントロールとしなければならない（SHALL）。

#### Scenario: サムネクリックで拡大

- **WHEN** ユーザーが promote 済み画像のサムネイルをクリックする
- **THEN** 拡大プレビューが表示される

#### Scenario: 拡大プレビューにピクセル寸法を表示

- **WHEN** ユーザーが拡大プレビューを表示する
- **THEN** 画像の読み込み後に `幅 × 高さpx` 形式の寸法が表示される

### Requirement: 画像を削除できる

Used タブおよび UP タブ（staging）の各行は削除操作を提供しなければならない（SHALL）。参照出現回数が 0 の promote 済みファイルは確認なしで削除してよい（MAY）。参照出現回数が 1 以上の promote 済みファイルを削除する前に、確認を表示しなければならない（SHALL）。壊れリンク行（ファイル不存在）はファイル削除操作を提供してはならない（MUST NOT）。

#### Scenario: 未使用画像の削除

- **WHEN** ユーザーが Used タブで `未使用` の promote 済み画像を削除する
- **THEN** ディスク上の当該ファイルが削除される
- **AND** Used タブの一覧から消える

#### Scenario: 使用中画像の削除確認

- **WHEN** ユーザーが `参照: N`（N ≥ 1）の promote 済み画像を削除しようとする
- **THEN** 確認ダイアログが表示される

### Requirement: プレビューは images パスを解決して表示する

Pane3 プレビューモードは、本文中の `images/...` 形式の Markdown 画像参照を API 経由で表示しなければならない（SHALL）。`data:` URL は後方互換のため引き続き表示してよい（MAY）。

#### Scenario: プレビューで promote 済み画像が表示される

- **WHEN** 本文に `![alt](images/uploaded/foo.png)` があるレッスンをプレビューする
- **THEN** 当該画像がレンダリングされる
