# publishing-site-deployment Specification

## Purpose

公開サイトの継続的テストとリリース配信（GitHub Pages / Vercel）の要件を規定する。

## Requirements

### Requirement: push のたびに変換とビルドを検証する

`site/` または `contents/` の変更を含む push・pull request では、変換スクリプトの実行・サイトのビルド・テストを実行しなければならない（SHALL）。この検証ジョブは**いかなるデプロイも行ってはならない**（MUST NOT）。検証はリポジトリが private の状態でも実行できなければならない（SHALL）。

#### Scenario: 原稿を直して push する

- **WHEN** `contents/` のレッスンを変更して push する
- **THEN** 変換 → ビルド → テストが実行される
- **AND** GitHub Pages にも Vercel にもデプロイされない

#### Scenario: slug の欠落を検出する

- **WHEN** slug を持たないレッスンを追加して push する
- **THEN** 変換が失敗し、ジョブが失敗する

#### Scenario: 無関係な変更では走らない

- **WHEN** `site/` にも `contents/` にも関係しないファイルだけを変更して push する
- **THEN** 公開サイトの検証ジョブは起動しない

### Requirement: 公開は main の release タグでのみ行う

公開サイトのデプロイは、`v` で始まるタグの push によってのみ実行しなければならない（SHALL）。通常の push・merge でデプロイしてはならない（MUST NOT）。

タグはブランチに紐付かないため、**タグが指すコミットが `main` に含まれることを検証しなければならない**（SHALL）。含まれない場合はデプロイを実行せずに失敗させなければならない（SHALL）。

#### Scenario: main のコミットにタグを付けて公開する

- **WHEN** `main` にあるコミットへ `v0.1.0` タグを push する
- **THEN** ビルドが実行され、Pages と Vercel へ配信される

#### Scenario: main に無いコミットのタグを拒否する

- **WHEN** `main` に含まれないコミット（作業ブランチ等）へ `v0.1.1` タグを push する
- **THEN** ジョブは失敗し、どこにもデプロイされない

#### Scenario: merge ではデプロイしない

- **WHEN** pull request を `main` にマージする
- **THEN** 検証ジョブだけが動き、デプロイは発生しない

### Requirement: Pages と Vercel へ同じ内容を配信する

リリースでは GitHub Pages と Vercel の両方へ、**同一のコミットから**ビルドした内容を配信しなければならない（SHALL）。画像の参照先は両者で同一でなければならない（SHALL）——現在は `site.config.json` の `imageSource: "local"` により、どちらもローカル画像を配信する。

Pages 向けビルドにはサブパス配信のための `basePath` を与えなければならない（SHALL）。Vercel 向けビルドには `basePath` を与えてはならない（MUST NOT）——ルート配信のため。

Vercel は Studio 本体とは**別のプロジェクト**へ配信しなければならない（SHALL）。公開サイトの Vercel プロジェクトでは git 連携による自動デプロイを使ってはならない（MUST NOT）——push のたびに公開されるのを防ぐ。

#### Scenario: 同じタグから2か所へ配る

- **WHEN** `v0.1.0` のリリースが実行される
- **THEN** Pages には `basePath` 付き、Vercel には `basePath` 無しのビルドが配信される
- **AND** どちらも同じコミットの `contents/` から生成されている

#### Scenario: Studio のデプロイに影響しない

- **WHEN** 公開サイトのリリースが実行される
- **THEN** Studio 本体の Vercel プロジェクトのデプロイは発生しない

### Requirement: 配信されたサイトはリリース番号と出所を示す

サイトはリリース番号とリポジトリへのリンクを表示しなければならない（SHALL）。リリース番号はビルド時に注入し、タグから作られていないビルド（ローカル・CI）では `dev` と表示しなければならない（SHALL）。

#### Scenario: リリースされたサイトを見る

- **WHEN** `v0.1.0` から配信されたサイトを開く
- **THEN** `v0.1.0` とリポジトリへのリンクが表示される

#### Scenario: ローカルビルドを見る

- **WHEN** ローカルで `npm run build` したサイトを開く
- **THEN** リリース番号の表示は `dev` である

### Requirement: 配信先を差し替えられる形に保つ

Pages への配り方は1つのジョブに閉じ込め、配信先に依存する値（`basePath` 等）はワークフロー冒頭でまとめて定義しなければならない（SHALL）。将来「成果物のみを専用 public リポへ push する」方式へ切り替える際に、**サイト側のコードと変換スクリプトを変更せずに済む**構成でなければならない（SHALL）。

#### Scenario: 専用 public リポ方式へ切り替える

- **WHEN** 配信方法を「別リポジトリへの push」に変更する
- **THEN** 変更はワークフローのデプロイジョブと冒頭の設定値に閉じる
- **AND** `site/` 配下のコードと `scripts/` の変換処理は変更されない
