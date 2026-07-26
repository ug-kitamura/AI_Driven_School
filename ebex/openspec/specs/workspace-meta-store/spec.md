# workspace-meta-store Specification

## Purpose

workspace/.meta/ 配下の台帳（ino キー）・セッション・お気に入り・診断ログの構造と、自己修復・マイグレーションの要件。
## Requirements
### Requirement: .meta ディレクトリ構成

システムは EBEX の運用データを `workspace/.meta/` 配下に集約しなければならない（SHALL）。構成は `meta.json`（台帳）・`sessions/<ino>.json`（プロジェクト別セッション）・`favorites.json`（お気に入り）・`diagnostics.log`（診断ログ）とする。プロジェクトフォルダ内に EBEX の運用ファイル（session.json 等）を作成してはならない（MUST NOT）。

#### Scenario: プロジェクトフォルダがクリーンに保たれる

- **WHEN** ユーザーがエージェントと会話し、お気に入りを登録し、ファイルを編集する
- **THEN** プロジェクトフォルダ配下にはユーザーの成果物のみが存在し、EBEX の運用ファイルは一切作成されない

#### Scenario: .meta が UI に露出しない

- **WHEN** Pane 1 のツリー表示・コンテンツ検索・エージェントのファイル一覧を利用する
- **THEN** `.meta` ディレクトリとその中身は表示・検索・添付の対象にならない

### Requirement: ino ベースの台帳

`meta.json` は各プロジェクトフォルダについて `ino`（NTFS fileID。`fs.stat` の bigint 値を文字列化）・`folderPath`（workspace からの相対パス）・`createdAt` を保持しなければならない（SHALL）。ino はフォルダ同一性の主キー、folderPath は自己修復用の予備キーとする。ino の取得・比較には bigint を使用しなければならない（MUST）。

#### Scenario: EBEX 内リネームへの追従

- **WHEN** ユーザーが EBEX 上でプロジェクトフォルダをリネームする
- **THEN** ino は変わらないため、台帳の folderPath のみが更新され、セッション・お気に入りはそのまま引き継がれる

#### Scenario: 外部リネームへの追従

- **WHEN** ユーザーが Explorer 等の外部ツールでプロジェクトフォルダをリネームし、EBEX が次回スキャンする
- **THEN** ino 照合により同一プロジェクトと判定され、台帳の folderPath が新名称へ更新され、セッション・お気に入りが維持される

### Requirement: 台帳の自己修復

フォルダの ino が台帳に存在しない場合、システムは folderPath による照合で自己修復を試みなければならない（SHALL）。folderPath が一致するレコードがあれば台帳の ino を更新し、`sessions/<旧ino>.json` を新 ino 名にリネームする。どちらも一致しない場合は新規プロジェクトとして台帳に登録する。

#### Scenario: コピー・復元で ino が変わったフォルダ

- **WHEN** バックアップ復元等でフォルダの ino が変わり、folderPath は台帳のレコードと一致する
- **THEN** 台帳の ino が新しい値へ更新され、セッションファイルが新 ino 名に付け替えられ、履歴が引き継がれる

#### Scenario: フォルダ複製は新規扱い

- **WHEN** ユーザーがプロジェクトフォルダを複製する（ino・folderPath ともに台帳と不一致）
- **THEN** 複製側はセッションを引き継がない新規プロジェクトとして登録される

#### Scenario: 台帳喪失からの再構築

- **WHEN** `.meta/meta.json` が存在しない状態で workspace をロードする
- **THEN** 全プロジェクトフォルダの走査により台帳が再構築され、エラーにならない

### Requirement: セッションの物理分離

各プロジェクトのエージェントセッションは `sessions/<ino>.json` に個別ファイルとして保存しなければならない（SHALL）。セッションファイルはセッションデータ（`AgentChatStorage` スキーマ）のみを保持し、folderPath 等の紐付け情報を含んではならない（MUST NOT）。

#### Scenario: 書込の影響範囲が単一プロジェクトに閉じる

- **WHEN** プロジェクト A のエージェント会話が保存される
- **THEN** `sessions/<Aのino>.json` のみが書き換わり、他プロジェクトのセッションファイルおよび meta.json は変更されない

### Requirement: 既存データのマイグレーション

初回ロード時（`.meta/meta.json` 不在時）、システムは既存のフォルダ内 `session.json` を `.meta/sessions/<ino>.json` へ、アプリルートの `.ebex-favorites.json` を ino キー形式の `.meta/favorites.json` へ一括移行し、移行成功後に元ファイルを削除しなければならない（SHALL）。移行は「コピー → 検証 → 元の削除」の順で行い、再実行しても安全（冪等）でなければならない（MUST）。

#### Scenario: 旧形式からの移行

- **WHEN** 各プロジェクトフォルダに session.json が存在する状態で新バージョンを初回起動する
- **THEN** 全セッションが `.meta/sessions/` へ移行され、フォルダ内の session.json は削除され、会話履歴が従来どおり表示される

#### Scenario: 移行の途中失敗からの回復

- **WHEN** マイグレーション中にプロセスが中断され、再起動する
- **THEN** 移行が最初から再実行され、データの重複・欠損が発生しない

### Requirement: ino のクライアント露出

システムは、ワークスペース走査 API(`/api/workspace/load` 等)のレスポンスに、各プロジェクトフォルダの `ino`(文字列化した NTFS fileID)を含めなければならない(SHALL)。クライアントはプロジェクトを一意に識別する必要がある処理(エージェントセッションのスコープ判定等)において、フォルダ名文字列ではなく `ino` を用いなければならない(MUST)。ただし、ファイルパス解決のみを目的とする API 呼び出しは対象外とし、引き続きパス文字列を用いてよい。

#### Scenario: ワークスペース走査結果に ino が含まれる

- **WHEN** クライアントがワークスペースを走査し、プロジェクト一覧を取得する
- **THEN** レスポンスの各プロジェクトエントリに `ino` フィールドが含まれる

#### Scenario: 同名プロジェクトの再作成でも ino が異なる

- **WHEN** プロジェクトを削除した後、削除前と同じ名前で新規プロジェクトを作成する
- **THEN** 新規プロジェクトの `ino` は削除されたプロジェクトの `ino` と異なる値になる

### Requirement: プロジェクト削除時のクライアント側セッションデータ削除

プロジェクト削除が完了した際、システムはサーバー側のセッションファイル(`.meta/sessions/<ino>.json`)だけでなく、クライアント側 localStorage に残る当該プロジェクト(`ino`)に紐づくエージェントチャット履歴のエントリも削除しなければならない(SHALL)。

#### Scenario: 削除後に localStorage の該当エントリが残らない

- **WHEN** ユーザーがプロジェクトを削除し、削除処理が正常に完了する
- **THEN** localStorage 上の当該プロジェクトの `ino` に紐づくエージェントチャット履歴エントリが削除される

#### Scenario: 削除後の同名プロジェクト再作成で旧履歴が復元されない

- **WHEN** プロジェクト削除後、削除前と同じ名前で新規プロジェクトを作成し、そのエージェントセッションを読み込む
- **THEN** 削除前の会話履歴は表示されず、新規プロジェクトとして空のセッションから開始される

