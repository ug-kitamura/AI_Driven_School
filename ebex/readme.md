# EBEX

**EBEX**（Editor + Browser + EXecution）は、プロジェクトフォルダ内のファイルを入力に AI スキルを発火し、出力を同フォルダに置くための 3 ペインワークスペースです。

## 起動

```bash
cd ebex
npm install
npm run dev
```

ブラウザで [http://localhost:3001](http://localhost:3001) を開きます。

dx-training-studio（ポート 3000）と同時に使う場合は、EBEX は 3001 で起動します。

## 3 ペイン構成

| ペイン | 役割 |
|--------|------|
| **Pane 1** | プロジェクトフォルダとファイルのツリー（CRUD・検索・DnD） |
| **Pane 2** | 編集 / プレビュー（md, html, csv, json, yml, vtt） |
| **Pane 3** | Agent チャット（フォルダ単位セッション） |

## データ正本

- プロジェクトデータ: `workspace/<フォルダ名>/` 直下のファイル（v1 は 1 階層）
- Agent セッション: `workspace/<フォルダ名>/session.json`（ツリー非表示・gitignore 対象）
- EBE Purpose: `purpose.md`（🍃 ボタンで読み取り専用表示）

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
