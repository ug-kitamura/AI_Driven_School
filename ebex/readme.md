# EBEX

**EBEX**（Editor + Browser + EXecution）は、プロジェクトフォルダ内のファイルを入力に AI スキルを発火し、出力を同フォルダに置くための 3 ペインワークスペースです。

## 起動

**利用者（標準）**: `start.bat` をダブルクリック。本番モード（事前ビルド・watcher なし）で起動します。初回とソース更新後は自動でビルドが走ります。ソースを更新したのに反映されない場合は `start.bat rebuild` を実行してください。

**EBEX 自体の開発**: `start-dev.bat` または以下のコマンドで開発モード（ソース変更の即時反映あり）を起動します。

```bash
cd ebex
npm install
npm run dev
```

ブラウザで [http://localhost:3001](http://localhost:3001) を開きます。

dx-training-studio（ポート 3000）と同時に使う場合は、EBEX は 3001 で起動します。

> 補足: workspace 内のユーザーコンテンツ（md/html 等）はどちらのモードでもリクエスト毎に読み込まれるため即時反映されます。モードの違いが影響するのは EBEX のソースコードだけです。

## 3 ペイン構成

| ペイン     | 役割                                                      |
| ---------- | --------------------------------------------------------- |
| **Pane 1** | プロジェクトフォルダとファイルのツリー（CRUD・検索・DnD） |
| **Pane 2** | 編集 / プレビュー（md, html, csv, json, yml, vtt）        |
| **Pane 3** | Agent チャット（フォルダ単位セッション）                  |

## データ正本

- プロジェクトデータ: `workspace/<フォルダ名>/` 配下のファイル
- EBEX 運用データ: `workspace/.meta/`（プロジェクトフォルダ内には置かない）
  - `meta.json` — プロジェクト台帳（NTFS fileID による同一性管理）
  - `sessions/<ino>.json` — Agent セッション（旧 `session.json` は初回起動時に自動移行）
  - `favorites.json` — お気に入り（旧 `.ebex-favorites.json` は初回起動時に自動移行）
  - `diagnostics.log` — フォルダリネーム失敗時の診断記録
- EBE Purpose: `purpose.md`（🍃 ボタンで読み取り専用表示）

> 旧バージョンへ戻す場合: `.meta/sessions/<ino>.json` を該当フォルダの `session.json` として手動で戻してください（`meta.json` の `folderPath` でフォルダを特定できます）。

## 設定

ヘッダーの ⚙ から以下を変更できます。

- テーマ（light / dark / system）
- エディタフォントサイズ
- ペイン既定幅
- AI モデル / API キー

localStorage キー接頭辞は `ebex-*` です。

## コマンド

```bash
npm run dev      # 開発サーバー
npm run build    # 本番ビルド
npm run lint     # ESLint
npm run test     # Vitest
```

## 由来

dx-training-studio の Agent スタック・CodeMirror エディタ・ペインリサイズを流用し、トレーニングコンテンツ制作機能を引いた standalone アプリです。
