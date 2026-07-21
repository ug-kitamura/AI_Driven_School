# ebex-project-root Specification

## Purpose

appRoot（ebex の設置ディレクトリ）と projectRoot（ユーザーの作業データの基準）の二層ルート解決、その可視化、およびホスト配布・更新の手順。

## Requirements

### Requirement: projectRoot の自動検出

システムは projectRoot を、`process.cwd()` の**親 1 階層のみ**を対象とするマーカー検出で決定しなければならない（SHALL）。`process.cwd()` の親ディレクトリに `.ebex.host` という名前のファイルが存在する場合、その親ディレクトリを projectRoot としなければならない（SHALL）。存在しない場合は `process.cwd()` 自身を projectRoot としなければならない（SHALL）。マーカーを求めて祖先ディレクトリを再帰的に遡ってはならない（MUST NOT）。projectRoot の指定に環境変数を用いてはならない（MUST NOT）。実行中に projectRoot を切り替える UI を設けてはならない（MUST NOT）。

#### Scenario: ホスト配下で親が projectRoot になる

- **WHEN** `host/.ebex.host` が存在し、`process.cwd()` が `host/ebex` である
- **THEN** projectRoot は `host` になる

#### Scenario: マーカーが無ければ cwd 自身

- **WHEN** `process.cwd()` の親に `.ebex.host` が存在しない
- **THEN** projectRoot は `process.cwd()` になる

#### Scenario: 祖先まで遡らない

- **WHEN** `a/.ebex.host` が存在し、`process.cwd()` が `a/b/ebex` である（親は `a/b`）
- **THEN** projectRoot は `a` ではなく `a/b/ebex` になる

#### Scenario: 環境変数では変えられない

- **WHEN** `EBEX_PROJECT_ROOT` を設定して起動する
- **THEN** projectRoot の解決結果は環境変数を設定しない場合と同一である

### Requirement: ルート解決のキャッシュ

`getProjectRoot()` はプロセス内で最初の呼び出し時に一度だけファイルシステムを参照し、以降は解決済みの値を返さなければならない（SHALL）。呼び出しのたびにマーカーの存在確認を行ってはならない（MUST NOT）。

#### Scenario: fs アクセスは一度だけ

- **WHEN** `getProjectRoot()` を同一プロセス内で複数回呼び出す
- **THEN** マーカーの存在確認は最初の 1 回のみ実行され、2 回目以降は同じ値が返る

#### Scenario: 起動後のマーカー追加は反映されない

- **WHEN** プロセス起動後に親ディレクトリへ `.ebex.host` を作成し `getProjectRoot()` を呼び出す
- **THEN** 起動時に解決された値が返る

### Requirement: appRoot と projectRoot の区分

システムは 2 つのルートを区別しなければならない（SHALL）。appRoot は ebex の設置ディレクトリであり、製品同梱物（`contracts/`、ebex 側の `.claude/skills`、`images/` 等）の基準としなければならない（SHALL）。projectRoot はユーザーの作業データの基準であり、`workspace/`、`workspace/.meta/`、ホスト側スキルの基準としなければならない（SHALL）。ユーザーの作業データを appRoot 基準で解決してはならない（MUST NOT）。製品同梱物を projectRoot 基準で解決してはならない（MUST NOT）。

#### Scenario: 作業データは projectRoot 基準

- **WHEN** projectRoot が `host` で appRoot が `host/ebex` の状態で、workspace の読み書き API を呼び出す
- **THEN** 対象は `host/workspace/` 配下であり、`host/ebex/workspace/` は使われない

#### Scenario: 製品同梱物は appRoot 基準

- **WHEN** projectRoot が `host` で appRoot が `host/ebex` の状態で、Purpose を取得する
- **THEN** 読み込まれるのは `host/ebex/contracts/ebe-purpose.md` である

#### Scenario: 単体起動では両者が一致する

- **WHEN** マーカーが存在せず ebex 単体で起動している
- **THEN** projectRoot と appRoot は同一であり、`workspace/` も `contracts/` も従来と同じ位置に解決される

### Requirement: projectRoot の可視化

Pane 1 ヘッダーは、projectRoot が appRoot と異なる場合に「EBEX」の直後へ `for {name}` を表示しなければならない（SHALL）。`{name}` は projectRoot のディレクトリ名（basename）でなければならない（SHALL）。projectRoot と appRoot が同一の場合は「EBEX」のみを表示し、接尾辞を表示してはならない（MUST NOT）。接尾辞は `text-xs` かつ役割トークン `text-muted-foreground` で描画しなければならず（SHALL）、色番号のユーティリティを用いてはならない（MUST NOT）。長い名前がヘッダー右側の操作ボタンを押し出してはならない（MUST NOT）。接尾辞にツールチップや `title` 属性を付けてはならない（MUST NOT）。

#### Scenario: ホスト配下では for が出る

- **WHEN** projectRoot が `dx-training-studio` で appRoot が `dx-training-studio/ebex` である
- **THEN** Pane 1 ヘッダーに `EBEX for dx-training-studio` が表示される

#### Scenario: 単体起動では EBEX のみ

- **WHEN** projectRoot と appRoot が同一である
- **THEN** Pane 1 ヘッダーには `EBEX` のみが表示され、`for` から始まる接尾辞は表示されない

#### Scenario: 長い名前でも操作ボタンが残る

- **WHEN** projectRoot のディレクトリ名がヘッダー幅を超える長さである
- **THEN** 接尾辞が省略表示され、ヘッダー右側の操作ボタンは表示されたままになる

#### Scenario: ツールチップは出ない

- **WHEN** 接尾辞にマウスカーソルを重ねる
- **THEN** ツールチップは表示されない

### Requirement: ホスト起動の等価性

ホストリポ直下に置く起動ファイルは、`ebex/start.bat` へ委譲するだけの内容でなければならない（SHALL）。起動ロジックの実体を複製してはならない（MUST NOT）。ホスト直下の起動ファイルから起動した場合と `ebex/start.bat` を直接起動した場合とで、解決される projectRoot が一致しなければならない（SHALL）。委譲時は引数をそのまま透過させなければならない（SHALL）。

#### Scenario: どちらから起動しても同じルート

- **WHEN** `host/start.bat` を実行した場合と `host/ebex/start.bat` を実行した場合を比較する
- **THEN** いずれも作業ディレクトリは `host/ebex` になり、projectRoot は `host` になる

#### Scenario: 引数が透過する

- **WHEN** `host/start.bat rebuild` を実行する
- **THEN** `ebex/start.bat` に `rebuild` が渡り、再ビルドが実行される

### Requirement: 配布と更新の手順

`readme.md` はホストリポへの導入手順を記載しなければならない（SHALL）。手順はホストリポ直下への `.ebex.host` の設置、ホストリポの `.gitignore` への `/ebex/` の追加、ebex リポジトリの `ebex/` への clone、委譲用起動ファイルの設置、および `cd ebex && git pull` による更新を含まなければならない（SHALL）。git subtree による配布手順を記載してはならない（MUST NOT）。ホストへ自動配信する CI 設定を含めてはならない（MUST NOT）。`workspace/.meta/` をホスト側で git 管理から外すことは注意として記載するにとどめ、EBEX が `.gitignore` を自動生成してはならない（MUST NOT）。

#### Scenario: 導入手順が読める

- **WHEN** `readme.md` を読む
- **THEN** マーカー設置・gitignore・clone・起動ファイル設置・更新コマンドの 5 点が記載されている

#### Scenario: .meta の自動生成をしない

- **WHEN** ホスト配下で EBEX を起動し `workspace/.meta/` が作成される
- **THEN** `.meta/` 配下に `.gitignore` は自動生成されない
