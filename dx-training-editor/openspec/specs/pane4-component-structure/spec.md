# pane4-component-structure Specification

## Purpose

DX Training Studio の Pane4（ImageManagerPane）内部モジュール構成を定義する。`useImageLists`・`usePromoteAndInsert` によるロジック集約、タブコンポーネント分割、および `lib/image-list-client.ts` を用いたスコープ単位 fetch の責務境界を規定する。ユーザー向け挙動は `training-studio-image-pane` に従い、本 spec は実装構造の要件を扱う。

## Requirements

### Requirement: 画像リスト取得は useImageLists hook に集約する

Pane4 の画像リスト state（`promotedFiles`・`stagingFiles`・`aiStagingFiles`・`webStagingFiles`）および `refreshScope` / `refreshScopes` は `useImageLists` hook に集約しなければならない（SHALL）。hook は `lib/image-list-client.ts` の `fetchImageList`・`scopesAfterPromote` を用いなければならない（SHALL）。Pane4 開閉およびアクティブタブ変更時は **アクティブタブの 1 スコープのみ** fetch しなければならない（SHALL）。レッスン編集による `series` 変更を fetch トリガーにしてはならない（MUST NOT）。

#### Scenario: アクティブタブのみ fetch する

- **WHEN** ユーザーが Pane4 を開き Used タブが表示されている
- **THEN** `scope=used` の list API のみ呼び出される
- **AND** staging 用 3 スコープの list API は呼び出されない

#### Scenario: タブ切替で該当スコープを fetch する

- **WHEN** ユーザーが Used タブから AI タブに切り替える
- **THEN** `scope=staging&source=ai` の list API が呼び出される

#### Scenario: series 変更では list API を再取得しない

- **WHEN** Pane4 が開いたまま Pane3 でレッスン本文を編集する
- **THEN** list API は追加で呼び出されない
- **AND** Used タブの参照回数表示はクライアント側 `useMemo` で更新される

### Requirement: promote 挿入は usePromoteAndInsert hook に集約する

staging 画像からの promote → Markdown 挿入フロー（UP・AI・Web の 3 パターン）は `usePromoteAndInsert` hook に 1 箇所で実装しなければならない（SHALL）。hook は staging ソース（`uploaded` / `ai` / `web`）と任意の alt 解決関数を受け取り、成功時に `scopesAfterPromote` で定義されたスコープを silent refresh しなければならない（SHALL）。

#### Scenario: AI staging から promote 挿入

- **WHEN** ユーザーが AI タブの staging 画像で挿入する
- **THEN** `POST /api/images/promote` が呼び出される
- **AND** 成功かつ編集モードの場合 Markdown が挿入される
- **AND** `ai` と `used` スコープが refresh される

#### Scenario: promote 失敗時にタブ内通知

- **WHEN** promote API がエラーを返す
- **THEN** 対象タブの `TabNoticeBanner` にエラーが表示される
- **AND** Markdown 挿入は行われない

#### Scenario: 編集モード外では挿入不可通知

- **WHEN** Pane3 が編集モード（raw）以外である
- **AND** ユーザーが staging 画像で挿入を試みる
- **THEN** 対象タブに「編集モードに切り替えてから挿入してください」が表示される

### Requirement: タブ UI は専用コンポーネントに分割する

Pane4 の 4 タブ（Used・UP・AI・Web）のコンテンツ領域は、それぞれ専用コンポーネント（`UsedImagesTab`・`UploadImagesTab`・`AiImagesTab`・`WebImagesTab`）に分割しなければならない（SHALL）。`ImageManagerPane` はタブバー・Pane4 折りたたみ・共有 AlertDialog・ImageLightbox・hook 配線に限定しなければならない（SHALL）。

#### Scenario: ImageManagerPane がシェルとして機能する

- **WHEN** 開発者が `ImageManagerPane.tsx` を開く
- **THEN** タブ切替 UI と共有 Dialog が定義されている
- **AND** 各タブの詳細 UI は対応する `*ImagesTab.tsx` に存在する

### Requirement: 既存のユーザー向け挙動を維持する

本変更は内部構造のリファクタであり、`training-studio-image-pane` および関連 spec で定義されたユーザー向け挙動（promote・削除・フィルタ・通知・グリッド等）を変更してはならない（MUST NOT）。

#### Scenario: リファクタ後も promote 挿入が同等に動作する

- **WHEN** ユーザーが UP タブの staging 画像を挿入する
- **THEN** Step 0 以前と同様に正本へコピーされ Markdown が挿入される

#### Scenario: リファクタ後も Used フィルタが同等に動作する

- **WHEN** ユーザーが Used タブでシリーズ・コース・レッスンフィルタを操作する
- **THEN** Step 0 以前と同様の行が表示される

### Requirement: AI タブの API ロジックは useAiImageTab hook に集約する

AI タブのプロンプト state、generate / 自動入力 / リセット、staging alt 更新、および `/api/images/generate`・`/api/images/suggest-prompt` 呼び出しは `useAiImageTab` hook に集約しなければならない（SHALL）。`AiImagesTab` は hook を内部で利用し、シェルから prompt / generating 等の props を受け取ってはならない（MUST NOT）。

#### Scenario: シェルに AI プロンプト state がない

- **WHEN** 開発者が `ImageManagerPane` シェルを開く
- **THEN** `aiPrompt` / `generating` / `suggesting` の useState がシェルに存在しない
- **AND** 当該 state は `useAiImageTab` 内にある

#### Scenario: AI 生成成功時に staging を refresh する

- **WHEN** ユーザーが AI タブで画像生成に成功する
- **THEN** `refreshScope("ai")` が silent で呼び出される
- **AND** 成功通知が AI タブ内に表示される

### Requirement: Web タブの API ロジックは useWebImageTab hook に集約する

Web タブのプロンプト state、search / 自動入力 / リセット、staging alt 更新、および `/api/images/search`・`/api/images/suggest-web-prompt` 呼び出しは `useWebImageTab` hook に集約しなければならない（SHALL）。`WebImagesTab` は hook を内部で利用しなければならない（SHALL）。

#### Scenario: シェルに Web プロンプト state がない

- **WHEN** 開発者が `ImageManagerPane` シェルを開く
- **THEN** `webPrompt` / `searching` / `webSuggesting` の useState がシェルに存在しない

### Requirement: UP タブのアップロードロジックは useUploadImagesTab hook に集約する

UP タブのファイルアップロード（`/api/images/upload`）、クリップボード paste 処理、MP4 サイズ検証は `useUploadImagesTab` hook に集約しなければならない（SHALL）。成功時は `refreshScope("uploaded")` と UP タブへの切替を行わなければならない（SHALL）。

#### Scenario: アップロード成功後に UP タブへ切替

- **WHEN** ユーザーが画像をアップロードする
- **THEN** staging リストが refresh される
- **AND** アクティブタブが upload になる

### Requirement: ImageManagerPane シェルは横断 concern のみ保持する

`ImageManagerPane` シェルはタブバー、Pane4 折りたたみ、Used フィルタ state、共有 Lightbox / 削除 Dialog、`useImageLists`、`usePromoteAndInsert`、およびタブコンポーネントの配置に限定しなければならない（SHALL）。タブ専用 API ロジックをシェルに残してはならない（MUST NOT）。

#### Scenario: シェル行数の縮小

- **WHEN** 本 change 適用後に `ImageManagerPane.tsx` の行数を計測する
- **THEN** 850 行超から大幅に減少している（目安 350 行以下）
