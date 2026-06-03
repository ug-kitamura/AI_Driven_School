# training-editor-image-pane Specification

## Purpose

DX Training Editor の Pane4（画像アセットマネージャー）における staging / promote、Used タブ、グリッド UI、拡大プレビュー、画像 API を定義する。`pane4-image-assets` change により確定した挙動を正本とする。
## Requirements
### Requirement: 画像は source 別 staging フォルダに保存する

Pane4 で取得した画像は `dx-training-editor/images/{source}/` に **staging として** 保存しなければならない（SHALL）。`source` は `uploaded`・`ai`・`web` のいずれかである。UP タブからの取得は `uploaded` を用いなければならない（SHALL）。`images/uploaded/`・`images/ai/`・`images/web/` は git 追跡対象外としなければならない（SHALL）。正本（promote 済み）は `images/<filename>` 直下のみとし、git 追跡対象としなければならない（SHALL）。

#### Scenario: アップロードは uploaded staging に保存される

- **WHEN** ユーザーが UP タブで画像ファイルをアップロードする
- **THEN** ファイルは `images/uploaded/` 配下に保存される
- **AND** UP タブの一覧に表示される

### Requirement: UP タブは staging 画像のみ表示する

UP タブは `images/uploaded/` 内の画像のみを一覧表示しなければならない（SHALL）。Web タブは実 API 連携を行わず、準備中のプレースホルダ UI を表示してよい（MAY）。

#### Scenario: UP タブに promote 済みは表示されない

- **WHEN** 画像が promote 済みである
- **THEN** 当該画像は UP タブには表示されない
- **AND** Used タブに表示される

### Requirement: 挿入時に promote コピーとパス挿入を行う

staging 画像からの挿入操作は、`images/{source}/{filename}` を `images/{filename}` へ **コピー** しなければならない（SHALL）。staging 側のファイルは削除してはならない（MUST NOT）。同時に Markdown へ `![{filename}](images/{filename})` 形式の文字列を挿入しなければならない（SHALL）。CodeMirror に選択範囲がある場合は当該範囲を置換し、選択がない場合はカーソル位置に挿入しなければならない（SHALL）。

#### Scenario: staging から挿入で promote コピーが残る

- **WHEN** ユーザーが UP タブの staging 画像を挿入する
- **THEN** `images/{filename}` にコピーが作成される
- **AND** `images/uploaded/{filename}` は残る
- **AND** エディタに `images/{filename}` パスが挿入される

### Requirement: Used タブは promote 済みと壊れリンクを表示する

Used タブは Pane4 タブ列の **左端** に配置し、ラベル **Used** と Lucide **`SquareCheckBig`** アイコンを用いなければならない（SHALL）。Used タブは次を一覧表示しなければならない（SHALL）:

1. `images/` 直下の正本ファイル（`uploaded`・`ai`・`web` ディレクトリを除く）
2. いずれかのレッスン `content` に参照があるが正本ファイルが存在しない `images/<filename>` パス

#### Scenario: promote 済みが Used に表示される

- **WHEN** 画像が promote 済みである
- **THEN** Used タブの一覧に当該画像が表示される

#### Scenario: 壊れリンクが Used に表示される

- **WHEN** レッスン content に `images/missing.png` への参照がある
- **AND** 当該ファイルが存在しない
- **THEN** Used タブに当該パスの行が表示される
- **AND** 「画像が存在しません」と表示される

### Requirement: Used タブは参照出現回数を表示する

Used タブの各行は、全レッスン `content` 内における当該 `images/<filename>` パスの **出現回数合計** を表示しなければならない（SHALL）。出現回数が 0 の promote 済みファイルは `未使用` と表示しなければならない（SHALL）。出現回数が 1 以上の場合は `参照: N` 形式で表示しなければならない（SHALL）。

#### Scenario: 複数レッスンで参照された回数

- **WHEN** 2 つのレッスン content にそれぞれ同一 `images/foo.png` が 1 回ずつ含まれる
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

Pane3 プレビューモードは、本文中の `images/<filename>` 形式の Markdown 画像参照を API 経由で表示しなければならない（SHALL）。`data:` URL は後方互換のため引き続き表示してよい（MAY）。

#### Scenario: プレビューで promote 済み画像が表示される

- **WHEN** 本文に `![alt](images/foo.png)` があるレッスンをプレビューする
- **THEN** 当該画像がレンダリングされる

### Requirement: 本文の画像参照は正本パスのみとする

レッスン本文の Markdown 画像 URL は、正本形式 `images/<filename>` を用いなければならない（SHALL）。`images/uploaded/`・`images/ai/`・`images/web/` を本文に含めてはならない（MUST NOT）。`extract-image-refs` 等の参照抽出は正本パスおよび壊れリンクを対象とし、staging パスは本文から抽出されない（SHALL）。

#### Scenario: 旧形式パスは安全判定で拒否する

- **WHEN** API が `images/uploaded/foo.png` をファイル取得パスとして受け取る
- **THEN** 正本として解決しない、または staging としてのみ解決する

### Requirement: AI タブは ai staging を UP と同型のグリッドで表示する

AI タブは UP タブと同型の構成とし、**上部**に実線枠のプロンプト入力エリア・**生成/自動入力/リセット** 操作行、**下部**に `images/ai/` 内の staging 画像をサムネイルグリッドで表示し、挿入・削除・拡大プレビューを提供しなければならない（SHALL）。プロンプト入力枠は UP の点線 D&D エリアとは異なり **実線 border** としなければならない（SHALL）。詳細な生成・自動入力契約は `training-editor-ai-image-generation` に従う。

#### Scenario: AI タブにプロンプト欄と staging がある

- **WHEN** ユーザーが AI タブを開く
- **THEN** プロンプト入力エリアと staging グリッドが表示される
- **AND** UP タブの点線 D&D エリアは表示されない

#### Scenario: AI staging から挿入できる

- **WHEN** ユーザーが AI タブの staging 画像で挿入する
- **THEN** `images/{filename}` に promote される
- **AND** UP タブと同様の Markdown 挿入が行われる

### Requirement: Pane4 の通知はタブ内に限定する

Pane4 の成功・エラー・警告メッセージ（生成結果、promote 失敗、削除失敗、挿入不可など）は、操作の対象タブ（Used・UP・AI・Web）の **コンテンツ領域内** バナーのみに表示しなければならない（SHALL）。タブ列や Pane 共通ヘッダー直下の横断バナーに表示してはならない（MUST NOT）。他タブに切り替えたとき、非表示タブのメッセージは見えてはならない（MUST NOT）。非表示タブに戻ったとき、当該タブの直前メッセージを再表示してよい（MAY）。

#### Scenario: UP タブのエラーは UP 内のみ

- **WHEN** UP タブで削除が失敗する
- **AND** ユーザーが AI タブを表示している
- **THEN** エラーメッセージは AI タブに表示されない

#### Scenario: AI タブの成功は AI 内のみ

- **WHEN** AI タブで staging 保存成功メッセージが出る
- **AND** ユーザーが Used タブを表示している
- **THEN** 成功メッセージは Used タブに表示されない

### Requirement: AI と UP タブはコンテンツ横幅を揃える

AI タブおよび UP タブは、プロンプト入力（または D&D エリア）・操作ボタン行・画像グリッドが **同一の左右インセット** を共有し、左端・右端が揃わなければならない（SHALL）。Used タブは内部要素の相互整列は要求しないが、**同一インセット** により AI/UP と同じコンテンツ横幅でなければならない（SHALL）。

#### Scenario: AI タブでプロンプトとグリッドが揃う

- **WHEN** ユーザーが AI タブを表示する
- **THEN** プロンプト入力枠の左端と staging グリッド最左列カードの左端が一致する

#### Scenario: UP タブで D&D とグリッドが揃う

- **WHEN** ユーザーが UP タブを表示する
- **THEN** D&D エリアの左端と staging グリッド最左列カードの左端が一致する

#### Scenario: Used タブの横幅が他タブと一致

- **WHEN** ユーザーが Used タブを表示する
- **THEN** グリッドの利用可能横幅は AI タブのプロンプト入力枠と同じ左右マージン内に収まる

