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

サイトはリポジトリへのリンクをナビバーに表示しなければならない（SHALL）。リリース番号はビルド時に注入し、タグから作られたビルドでは**サイドバー最上部**（メニューの上・左寄せ）に表示しなければならない（SHALL）——文字サイズはサイドバーメニューの文字より一回り小さく、色はメニューより濃いグレーとする。タグから作られていないビルド（ローカル・CI）ではリリース番号を**表示しない**（SHALL NOT）——`dev` 等の代替文字列を出さず、表示スペースも確保しない。ページ下部のフッター領域は持たない（SHALL NOT）。

#### Scenario: リリースされたサイトを見る

- **WHEN** `v0.1.0` から配信されたサイトを開く
- **THEN** サイドバーの最上部（メニューの上）に `v0.1.0` が小さく左寄せで表示される
- **AND** ナビバーにリポジトリへのリンクがある

#### Scenario: ローカルビルドを見る

- **WHEN** ローカルで `npm run build` したサイトを開く
- **THEN** リリース番号はどこにも表示されず、サイドバー最上部に空きスペースも生じない

#### Scenario: フッターが無い

- **WHEN** サイトの任意のページを最下部までスクロールする
- **THEN** フッター領域は表示されない

### Requirement: 配信先を差し替えられる形に保つ

Pages への配り方は1つのジョブに閉じ込め、配信先に依存する値（`basePath` 等）はワークフロー冒頭でまとめて定義しなければならない（SHALL）。将来「成果物のみを専用 public リポへ push する」方式へ切り替える際に、**サイト側のコードと変換スクリプトを変更せずに済む**構成でなければならない（SHALL）。

#### Scenario: 専用 public リポ方式へ切り替える

- **WHEN** 配信方法を「別リポジトリへの push」に変更する
- **THEN** 変更はワークフローのデプロイジョブと冒頭の設定値に閉じる
- **AND** `site/` 配下のコードと `scripts/` の変換処理は変更されない

### Requirement: 公開サイトのビルドは site/ 配下だけで完結する

公開サイトのビルドは、`site/` 配下の依存と設定だけで完結しなければならない（SHALL）。`site/` の外にある `node_modules` や設定ファイル（親ディレクトリ `dx-training-studio/` の `postcss.config.mjs` 等）に依存してはならない（SHALL NOT）。

CI・リリースの各ワークフローは `site/` でのみ `npm ci` を実行する。ビルドツールの設定探索（Next の postcss 設定探索は `find-up` で親方向へ遡る）が親ディレクトリまで届く場合、`site/` 側に**同名の設定ファイルを置いて探索を止めなければならない**（SHALL）——たとえ内容が空であっても。この種の設定ファイルには、なぜ空の設定が必要かをコメントで残さなければならない（SHALL）。

この独立性は検証・GitHub Pages・Vercel の3ワークフローすべての前提であり、いずれか1つでも `site/` 外へ依存すると3本とも同時に失敗する。ローカル開発では親の `node_modules` に解決できてしまうため、この破綻は CI でしか露見しない。

#### Scenario: 親の依存が無くてもビルドが通る

- **WHEN** `dx-training-studio/node_modules` が存在しない状態で `site/` の `npm ci` と `npm run build` を実行する
- **THEN** ビルドは成功する

#### Scenario: 3ワークフローすべてでビルドが通る

- **WHEN** 検証（CI）・GitHub Pages リリース・Vercel リリースの各ワークフローが `site/` でのみ `npm ci` してビルドする
- **THEN** どのワークフローでもビルドが成功する
- **AND** ワークフロー側に親ディレクトリの依存をインストールする手順は含まれない

#### Scenario: 親の設定が漏れない

- **WHEN** 親ディレクトリ `dx-training-studio/` にビルドツールの設定ファイル（`postcss.config.mjs` 等）が存在する状態で `site/` のビルドを実行する
- **THEN** ビルドは `site/` 側の設定だけを使い、親の設定を読み込まない

