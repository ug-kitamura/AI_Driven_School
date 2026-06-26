# training-editor-image-pane Specification

## Purpose

DX Training Editor の Pane4（画像アセットマネージャー）における staging / promote、Used タブ、グリッド UI、拡大プレビュー、画像 API を定義する。`pane4-image-assets` を起点とし、`pane4-delete-and-filter`・`pane4-mp4-upload` の挙動を含む。`images/` 直下はレッスン用静的メディア（画像・短尺 MP4）の正本置き場とする。
## Requirements
### Requirement: 画像は source 別 staging フォルダに保存する

Pane4 で取得した画像は `dx-training-editor/images/{source}/` に **staging として** 保存しなければならない（SHALL）。`source` は `uploaded`・`ai`・`web` のいずれかである。UP タブからの取得は `uploaded` を用いなければならない（SHALL）。`images/uploaded/`・`images/ai/`・`images/web/`・**`images/trash/`** は git 追跡対象外としなければならない（SHALL）。正本（promote 済み）は `images/<filename>` 直下のみとし、git 追跡対象としなければならない（SHALL）。

#### Scenario: アップロードは uploaded staging に保存される

- **WHEN** ユーザーが UP タブで画像ファイルをアップロードする
- **THEN** ファイルは `images/uploaded/` 配下に保存される
- **AND** UP タブの一覧に表示される

### Requirement: UP タブは staging メディアのみ表示する

UP タブは `images/uploaded/` 内の画像および MP4（`video/mp4`）のみを一覧表示しなければならない（SHALL）。

#### Scenario: UP タブに promote 済みは表示されない

- **WHEN** 画像が promote 済みである
- **THEN** 当該画像は UP タブには表示されない
- **AND** Used タブに表示される

### Requirement: 挿入時に promote コピーとパス挿入を行う

staging 画像または staging MP4 からの挿入操作は、`images/{source}/{filename}` を `images/{filename}` へ **コピー** しなければならない（SHALL）。staging 側のファイルは削除してはならない（MUST NOT）。同時に Markdown へ `![{filename}](images/{filename})` 形式の文字列を挿入しなければならない（SHALL）。CodeMirror に選択範囲がある場合は当該範囲を置換し、選択がない場合はカーソル位置に挿入しなければならない（SHALL）。

#### Scenario: staging から挿入で promote コピーが残る

- **WHEN** ユーザーが UP タブの staging 画像を挿入する
- **THEN** `images/{filename}` にコピーが作成される
- **AND** `images/uploaded/{filename}` は残る
- **AND** エディタに `images/{filename}` パスが挿入される

#### Scenario: staging MP4 から挿入で promote コピーが残る

- **WHEN** ユーザーが UP タブの staging MP4 を挿入する
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

Used タブの各行は、全レッスン `content` 内における当該 `images/<filename>` パス（拡張子 `.mp4` を含む）の **出現回数合計** を表示しなければならない（SHALL）。出現回数が 0 の promote 済みファイルは `未使用` と表示しなければならない（SHALL）。出現回数が 1 以上の場合は `使用中: N` 形式で表示しなければならない（SHALL）。

#### Scenario: 複数レッスンで参照された回数

- **WHEN** 2 つのレッスン content にそれぞれ同一 `images/foo.png` が 1 回ずつ含まれる
- **THEN** Used タブの当該行は `使用中: 2` と表示する

#### Scenario: 未使用の promote 済みファイル

- **WHEN** promote 済みファイルが存在する
- **AND** いずれのレッスン content にも当該パスへの参照がない
- **THEN** Used タブの当該行は `未使用` と表示する

#### Scenario: MP4 の参照回数を表示

- **WHEN** レッスン content に `images/demo.mp4` への参照がある
- **THEN** Used タブの当該行は `使用中: N` と表示する

### Requirement: UP タブで MP4 をアップロードできる

UP タブは `video/mp4` 形式のファイルを `images/uploaded/` に staging として保存できなければならない（SHALL）。1 ファイルあたりのサイズ上限は **3 MB**（3_145_728 bytes）とし、超過時はアップロードを拒否しなければならない（SHALL）。

UP ドロップゾーンは、MP4 について **10 秒以内の録画を推奨**する旨を表示しなければならない（SHALL）。動画の長さ（秒数）をサーバー側で検証する必要はない（MUST NOT）。

録画ツール（Screenity 等）の起動ボタンや操作手順の案内は提供してはならない（MUST NOT）。

#### Scenario: MP4 を staging にアップロード

- **WHEN** ユーザーが UP タブで 3 MB 以下の MP4 をアップロードする
- **THEN** ファイルは `images/uploaded/` 配下に保存される
- **AND** UP タブの一覧に表示される

#### Scenario: 3 MB 超の MP4 を拒否

- **WHEN** ユーザーが 3 MB を超える MP4 をアップロードしようとする
- **THEN** アップロードは拒否される
- **AND** UP タブ内にエラーメッセージが表示される

### Requirement: MP4 サムネイルに Play アイコンを表示する

Pane4 の画像グリッド（UP・Used および拡大プレビュー対象タブ）において、`.mp4` ファイルのサムネイルは動画の先頭フレーム（または同等の静止表示）の上に **中央 Play アイコン** を重ねて表示しなければならない（SHALL）。通常の画像ファイルには Play アイコンを表示してはならない（MUST NOT）。

#### Scenario: UP グリッドの MP4 に Play アイコン

- **WHEN** UP タブに MP4 の staging 行がある
- **THEN** サムネイル中央に Play アイコンが表示される

### Requirement: 画像一覧はレスポンシブグリッドで表示する

Pane4 の画像一覧（Used・UP・AI・Web 各タブの `ImageGrid`）は、Pane 幅に応じた **2 列以上** のサムネイルグリッドで表示しなければならない（SHALL）。**1 列のみの表示としてはならない**（SHALL NOT）。各セル幅は `IMAGE_GRID_CELL_MIN`（100px）以上でなければならない（SHALL）。列の最大幅はコンテナ幅の 50%（gap 考慮可）を超えてはならない（SHALL NOT）— 画像が 1 枚のみの場合も同様である。各セルはサムネイルとファイル名を含まなければならない（SHALL）。

#### Scenario: 画像 1 枚でも 2 列

- **WHEN** Pane4 に画像が 1 枚だけ表示されている
- **THEN** グリッドは 2 列レイアウトである
- **AND** 画像カードの幅は Pane4 全幅を占めない

#### Scenario: 狭い Pane4 幅でも 2 列

- **WHEN** Pane4 の幅が min（240px）付近である
- **THEN** グリッドは 2 列表示となる
- **AND** 各セル幅は 100px 以上である

#### Scenario: 広い Pane4 で 3 列以上

- **WHEN** Pane4 の幅が広く複数画像がある
- **THEN** グリッドは 2 列以上（必要に応じ 3 列以上）で表示される
- **AND** 各セル幅は 100px 以上である

### Requirement: サムネイルクリックで拡大表示する

画像サムネイル（壊れリンク行を除く）をクリックすると、拡大プレビュー（モーダルまたはオーバーレイ）を表示しなければならない（SHALL）。拡大表示はファイル名・パス・画像のピクセル寸法（幅 × 高さ）を含んでもよい（MAY）。

拡大プレビューは **当該タブのグリッド一覧** をコンテキストとし、**前/次** 操作（Lucide `ChevronLeft` / `ChevronRight`、画像の左右配置）で隣接サムネイルへ移動できなければならない（SHALL）。先頭/末尾では対応する方向のナビを無効化しなければならない（SHALL）。

拡大プレビューの **右下** に、当該タブで利用可能な **挿入**・**削除** 操作を配置しなければならない（SHALL）。挿入・削除はグリッド行と同等の API・確認ルールを用いなければならない（SHALL）。

メディア表示領域（枠線・背景付きブロック）は、表示中の画像または動画の **実寸（最大 `70vh` / モーダル幅内）に合わせて幅を収め**なければならない（SHALL）。モーダル全体の幅は `min(90vw, 720px)` 程度を維持し、メディアブロックは中央配置とし、モーダル端とメディアブロック端の余白は可変でよい（MAY）。

#### Scenario: サムネクリックで拡大

- **WHEN** ユーザーが promote 済み画像のサムネイルをクリックする
- **THEN** 拡大プレビューが表示される

#### Scenario: 拡大プレビューにピクセル寸法を表示

- **WHEN** ユーザーが拡大プレビューを表示する
- **THEN** 画像の読み込み後に `幅 × 高さpx` 形式の寸法が表示される

#### Scenario: 拡大プレビューで次の画像へ

- **WHEN** ユーザーが AI staging グリッドの 2 枚目を拡大表示している
- **AND** 次へ操作を実行する
- **THEN** 3 枚目の画像が拡大表示される

#### Scenario: 拡大プレビューから挿入

- **WHEN** ユーザーが Web staging 画像を拡大表示している
- **AND** 挿入操作を実行する
- **THEN** グリッドの挿入と同様に promote と Markdown 挿入が行われる

### Requirement: MP4 は拡大モーダルでクリック再生する

`.mp4` のサムネイルをクリックすると拡大プレビュー（モーダル）を開かなければならない（SHALL）。モーダル内では動画は **停止状態**（先頭フレーム表示）で開き、動画エリアをクリックすると再生が開始されなければならない（SHALL）。モーダルを閉じたとき、再生を停止し先頭に戻さなければならない（SHALL）。

拡大プレビューの前/次ナビ・挿入・削除は、MP4 についても画像と同等に提供しなければならない（SHALL）。

#### Scenario: 拡大モーダルで MP4 をクリック再生

- **WHEN** ユーザーが UP タブの MP4 サムネイルをクリックする
- **THEN** 拡大モーダルが開く
- **AND** 動画は停止状態で表示される
- **WHEN** ユーザーがモーダル内の動画エリアをクリックする
- **THEN** 動画が再生される

### Requirement: 画像を削除できる

Pane4 の **全タブ**（Used・UP・AI・Web）における削除操作は、対象ファイルを **`images/trash/<filename>` へ move** しなければならない（SHALL）。`images/trash/` に同名ファイルがある場合は **上書き**（既存 trash ファイルを置換）してよい（MAY）。正本・staging の区別なく basename で trash へ移す（SHALL）。

削除を実行する前に確認ダイアログを表示しなければならない（SHALL）。確認ダイアログのタイトルは **「画像を削除しますか？」** としなければならない（SHALL）。

- **参照出現回数が 1 以上**の promote 済みファイル（Used タブ）: サブメッセージに **「{filename} は {N} 箇所で使用しています。」** を表示しなければならない（SHALL）。ユーザーが確認した場合のみ trash 移動する（SHALL）。
- **参照出現回数が 0**の promote 済みファイル（Used タブ）: サブメッセージを表示してはならない（MUST NOT）。ユーザーが確認した場合のみ trash 移動する（SHALL）。
- **staging 画像**（UP・AI・Web タブ）: サブメッセージを表示してはならない（MUST NOT）。ユーザーが確認した場合のみ trash 移動する（SHALL）。

壊れリンク行（ファイル不存在）はファイル削除操作を提供してはならない（MUST NOT）。

Used タブおよび UP・AI・Web タブ（staging）の各行は削除操作を提供しなければならない（SHALL）。拡大プレビューからの削除も同一の確認ルールに従わなければならない（SHALL）。

#### Scenario: 未使用画像の削除確認

- **WHEN** ユーザーが Used タブで `未使用` の promote 済み画像を削除しようとする
- **THEN** タイトルのみの確認ダイアログが表示される
- **AND** ユーザーが確認した場合に `images/<filename>` が `images/trash/<filename>` へ移動する

#### Scenario: 使用中画像の削除確認

- **WHEN** ユーザーが `使用中: N`（N ≥ 1）の promote 済み画像を削除しようとする
- **THEN** 確認ダイアログに参照箇所数のサブメッセージが表示される
- **AND** ユーザーが確認した場合のみ trash 移動する

#### Scenario: staging 画像の削除確認

- **WHEN** ユーザーが UP タブの staging 画像を削除しようとする
- **THEN** タイトルのみの確認ダイアログが表示される
- **AND** ユーザーが確認した場合に `images/uploaded/<filename>` が `images/trash/<filename>` へ移動する

#### Scenario: 削除確認をキャンセル

- **WHEN** ユーザーが確認ダイアログでキャンセルする
- **THEN** ファイルは移動されない

### Requirement: プレビューは images パスを解決して表示する

Pane3 プレビューモード（inline レビュー）は、本文中の `images/<filename>` 形式の Markdown 画像参照を API 経由で表示しなければならない（SHALL）。拡張子が `.mp4` の場合は、先頭フレーム（または同等の静止表示）の上に **中央 Play アイコン** を重ね、ユーザーがクリックすると動画を再生しなければならない（SHALL）。`data:` URL は後方互換のため引き続き表示してよい（MAY）。

Markdown `src` に含まれる **パーセントエンコード**（日本語ファイル名等）はデコードして解決しなければならない（SHALL）。アップロード時にサニタイズされたファイル名（空白・記号の `_` 置換）へは、必要に応じてフォールバック照合しなければならない（SHALL）。

#### Scenario: レビューで MP4 をクリック再生

- **WHEN** 本文に `![alt](images/demo.mp4)` があるレッスンをレビュー表示する
- **THEN** 先頭フレームと中央 Play アイコンが表示される
- **WHEN** ユーザーが当該表示をクリックする
- **THEN** 動画が再生される

#### Scenario: プレビューで promote 済み画像が表示される

- **WHEN** 本文に `![alt](images/foo.png)` があるレッスンをプレビューする
- **THEN** 当該画像がレンダリングされる

#### Scenario: エンコード済みパスを解決する

- **WHEN** 本文の Markdown 画像 URL が `images/foo%E6%97%A5.mp4` のようにパーセントエンコードされている
- **AND** 正本ファイル `images/foo日.mp4` が存在する
- **THEN** プレビューは当該ファイルを欠落と判定しない

### Requirement: 本文の画像参照は正本パスのみとする

レッスン本文の Markdown 画像 URL は、正本形式 `images/<filename>` を用いなければならない（SHALL）。`images/uploaded/`・`images/ai/`・`images/web/` を本文に含めてはならない（MUST NOT）。`extract-image-refs` 等の参照抽出は正本パス（`.mp4` を含む）および壊れリンクを対象とし、staging パスは本文から抽出されない（SHALL）。抽出時は Markdown URL のパーセントエンコードをデコードしなければならない（SHALL）。

#### Scenario: 旧形式パスは安全判定で拒否する

- **WHEN** API が `images/uploaded/foo.png` をファイル取得パスとして受け取る
- **THEN** 正本として解決しない、または staging としてのみ解決する

#### Scenario: MP4 正本パスを参照抽出する

- **WHEN** レッスン content に `![demo](images/demo.mp4)` がある
- **THEN** `extract-image-refs` は `images/demo.mp4` を抽出する

### Requirement: AI タブは ai staging を UP と同型のグリッドで表示する

AI タブは UP タブと同型の構成とし、**上部**に実線枠のプロンプト入力エリア・**生成/自動入力/リセット** 操作行、**下部**に `images/ai/` 内の staging 画像をサムネイルグリッドで表示し、挿入・削除・拡大プレビューを提供しなければならない（SHALL）。プロンプト入力枠は UP の点線 D&D エリアとは異なり **実線 border** としなければならない（SHALL）。**プロンプト入力エリア（textarea 枠）の最小高さおよび上下余白**は UP の D&D エリアと **視覚的に揃え**なければならない（SHALL）。プロンプト+操作行ブロックの下余白は上余白と同等でなければならない（SHALL）。詳細な生成・自動入力契約は `training-editor-ai-image-generation` に従う。

AI タブの staging サムネイルは、画像の **全体** が枠内に収まるよう表示しなければならない（SHALL）。縦長・横長の画像で上下または左右が **クロップされて見えなくなる表示** を用いてはならない（MUST NOT）。拡大プレビュー（Lightbox）の挙動は変更してはならない（MUST NOT）。

#### Scenario: AI タブにプロンプト欄と staging がある

- **WHEN** ユーザーが AI タブを開く
- **THEN** プロンプト入力エリアと staging グリッドが表示される
- **AND** UP タブの点線 D&D エリアは表示されない

#### Scenario: AI staging から挿入できる

- **WHEN** ユーザーが AI タブの staging 画像で挿入する
- **THEN** `images/{filename}` に promote される
- **AND** UP タブと同様の Markdown 挿入が行われる

#### Scenario: 縦長画像の全体がサムネイルに表示される

- **WHEN** AI タブに縦長の staging 画像がある
- **THEN** サムネイル枠内で画像の上端から下端までが切れずに表示される

#### Scenario: 横長画像の全体がサムネイルに表示される

- **WHEN** AI タブに横長の staging 画像がある
- **THEN** サムネイル枠内で画像の左端から右端までが切れずに表示される

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

AI タブ・UP タブ・Web タブは、プロンプト入力（または D&D エリア）・操作ボタン行・画像グリッドが **同一の左右インセット** を共有し、左端・右端が揃わなければならない（SHALL）。Used タブは内部要素の相互整列は要求しないが、**同一インセット** により AI/UP/Web と同じコンテンツ横幅でなければならない（SHALL）。

#### Scenario: AI タブでプロンプトとグリッドが揃う

- **WHEN** ユーザーが AI タブを表示する
- **THEN** プロンプト入力枠の左端と staging グリッド最左列カードの左端が一致する

#### Scenario: UP タブで D&D とグリッドが揃う

- **WHEN** ユーザーが UP タブを表示する
- **THEN** D&D エリアの左端と staging グリッド最左列カードの左端が一致する

#### Scenario: Web タブでプロンプトとグリッドが揃う

- **WHEN** ユーザーが Web タブを表示する
- **THEN** プロンプト入力枠の左端と staging グリッド最左列カードの左端が一致する

#### Scenario: Used タブの横幅が他タブと一致

- **WHEN** ユーザーが Used タブを表示する
- **THEN** グリッドの利用可能横幅は AI タブのプロンプト入力枠と同じ左右マージン内に収まる

### Requirement: Web タブは web staging を AI と同型のグリッドで表示する

Web タブは AI タブと同型の構成とし、**上部**に実線枠のプロンプト入力エリア・**検索/自動入力/リセット** 操作行、**下部**に `images/web/` 内の staging 画像をサムネイルグリッドで表示し、挿入・削除・拡大プレビューを提供しなければならない（SHALL）。プロンプト入力枠は UP の点線 D&D エリアとは異なり **実線 border** としなければならない（SHALL）。**プロンプト入力エリアの最小高さおよび上下余白**は UP の D&D エリアおよび AI タブと **視覚的に揃え**なければならない（SHALL）。詳細な検索・自動入力契約は `training-editor-web-image-search` に従う。

#### Scenario: Web タブにプロンプト欄と staging がある

- **WHEN** ユーザーが Web タブを開く
- **THEN** プロンプト入力エリアと staging グリッドが表示される
- **AND** 「準備中」プレースホルダは表示されない

#### Scenario: Web staging から挿入できる

- **WHEN** ユーザーが Web タブの staging 画像で挿入する
- **THEN** `images/{filename}` に promote される
- **AND** UP タブ・AI タブと同様の Markdown 挿入が行われる

### Requirement: Web タブの通知は Web ビュー内のみ

Pane4 の Web タブにおける成功・失敗メッセージ（検索結果、promote 失敗、削除失敗、挿入不可など）は、Web タブ **コンテンツ領域内** バナーのみに表示しなければならない（SHALL）。他タブや Pane 共通ヘッダー直下に表示してはならない（MUST NOT）。

#### Scenario: Web タブの成功は Web 内のみ

- **WHEN** Web タブで staging 保存成功メッセージが出る
- **AND** ユーザーが AI タブを表示している
- **THEN** 成功メッセージは AI タブに表示されない

### Requirement: Used タブはシリーズ・コース・レッスンでフィルタできる

Used タブは **シリーズ**・**コース**・**レッスン** の 3 段カスケードフィルタ（Select 等）と **フィルタリセット** 操作を提供しなければならない（SHALL）。

シリーズ Select は次の選択肢をこの順序で提供しなければならない（SHALL）:

1. `すべてのシリーズ`
2. 各シリーズ名（既存のシリーズ一覧）
3. `（未使用）`（ワークスペース全体で参照 0 の promote 済み画像のみを表示するモード）

**フィルタ未適用**（3 段すべて未選択、またはリセット後）のとき、Used タブは **未使用**（参照 0）の promote 済み行も含めて一覧表示しなければならない（SHALL）。

**`（未使用）` モード**のとき、参照 0 の promote 済み行のみ表示しなければならない（SHALL）。コース・レッスン Select は disabled としなければならない（SHALL）。

**フィルタ適用中**（シリーズ・コース・レッスンのいずれかでスコープ選択がある）のとき、選択されたレッスン集合が Markdown 本文で参照している `images/<filename>` に該当する行のみ表示しなければならない（SHALL）。このとき **参照 0（未使用）の行は表示してはならない（MUST NOT）**。

#### Scenario: デフォルトですべての promote 済みが見える

- **WHEN** ユーザーが Used タブを開く
- **AND** フィルタが未選択である
- **THEN** 未使用の promote 済み画像も一覧に含まれる

#### Scenario: （未使用）モードで完全未使用のみ表示

- **WHEN** ユーザーがシリーズ Select で `（未使用）` を選択する
- **THEN** 参照 0 の promote 済み行のみ表示される
- **AND** コース・レッスン Select は disabled である

#### Scenario: レッスンでフィルタ

- **WHEN** ユーザーがシリーズ・コース・レッスンを選択する
- **THEN** 当該レッスン content が参照する画像行のみ表示される
- **AND** 未使用の promote 済み行は表示されない

#### Scenario: フィルタリセット

- **WHEN** ユーザーがフィルタリセットを実行する
- **THEN** 3 段フィルタがクリアされる
- **AND** 未使用行を含む全 Used 行が再表示される

