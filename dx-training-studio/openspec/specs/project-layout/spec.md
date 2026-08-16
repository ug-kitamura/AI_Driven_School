# project-layout Specification

## Purpose
TBD - created by archiving change restructure-studio-mandala. Update Purpose after archive.
## Requirements
### Requirement: studio と mandala は兄弟で、正本はどちらの子でもない

プロジェクトの入れ物 `dx-training-studio/` の直下に、Studio アプリを `studio/`、公開サイトを `mandala/` として**兄弟**で配置しなければならない（SHALL）。一方のアプリが他方のアプリの `node_modules`・設定ファイルに依存してはならない（SHALL NOT）。

正本データ（`contents/` `images/` `contents-work/` `local-db/`）とプロジェクト共通ディレクトリ（`.claude/` `openspec/` `docs/` `contracts/`）は入れ物の直下に置き、どちらのアプリの子にも置いてはならない（SHALL NOT）。各アプリは正本を「兄弟の正本を読む」形（アプリから見て `../contents` 等）で参照しなければならない（SHALL）。

Studio の正本参照はプロジェクトルート解決の一点（`lib/project-root.ts` の `getProjectRoot()`）を経由しなければならない（SHALL）——正本の位置を変える際の変更箇所を一点に保つため。

#### Scenario: アプリと正本が兄弟に並ぶ

- **WHEN** 入れ物 `dx-training-studio/` の直下を一覧する
- **THEN** `studio/` と `mandala/` が兄弟として存在し、`contents/` `images/` `contents-work/` `local-db/` はどちらのアプリの配下にも存在しない

#### Scenario: Studio が兄弟の正本を読み書きする

- **WHEN** Studio（cwd = `studio/`）でレッスンを開いて保存する
- **THEN** 読み書きされるのは入れ物直下の `contents/` 配下のファイルである

#### Scenario: mandala が兄弟の正本を読む

- **WHEN** mandala の変換スクリプトを実行する
- **THEN** 入れ物直下の `contents/` と `images/` が読み取られ、変更されない

### Requirement: 入れ物に設定ファイルを置かない

入れ物 `dx-training-studio/` の直下に `package.json`・`node_modules`・ビルドツール設定（postcss / eslint / tsconfig 等）を置いてはならない（SHALL NOT）——置いた瞬間に親子構造（設定探索・モジュール解決の親方向フォールバック）が復活するため。入れ物直下に置いてよいのは、起動スクリプト・`.gitignore`・案内文書（`readme.md` `CLAUDE.md`）・正本データ・プロジェクト共通ディレクトリだけである。

#### Scenario: 入れ物に依存解決の足場が無い

- **WHEN** 入れ物 `dx-training-studio/` の直下を確認する
- **THEN** `package.json` と `node_modules` は存在しない
- **AND** `studio/` からのモジュール解決が入れ物側へフォールバックする経路が無い

### Requirement: 入れ物直下の起動スクリプト4本

入れ物直下に起動スクリプト4本を置かなければならない（SHALL）: `start-studio.bat` / `start-studio-dev.bat` / `start-mandala.bat` / `start-mandala-dev.bat`。各スクリプトは自身の位置（`%~dp0`）を基準に対象アプリのディレクトリへ移動してから実行しなければならない（SHALL）。いずれも `node_modules` が無ければ `npm install` を先に実行しなければならない（SHALL）。

- `start-studio-dev.bat`: Playwright Chromium の確認後、開発サーバー（port 3001）を起動する。既に稼働中ならブラウザを開くだけにする
- `start-studio.bat`: ビルド後に本番サーバー（port 3001）を起動する
- `start-mandala-dev.bat` / `start-mandala.bat`: 挙動は publishing-site-build の起動スクリプト要件に従う（ビルド先行）

#### Scenario: どのスクリプトも入れ物直下から起動できる

- **WHEN** 入れ物直下で `start-studio-dev.bat` を実行する
- **THEN** `studio/` に移動した上で開発サーバーが port 3001 で起動する

#### Scenario: 依存が無ければ先にインストールする

- **WHEN** `studio/node_modules` が無い状態で `start-studio-dev.bat` を実行する
- **THEN** `npm install` が実行されてから起動処理が続行される

