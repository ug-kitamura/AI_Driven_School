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

## ホストリポジトリへの導入

EBEX は単体でも使えますが、専門リポジトリ（ホスト）の直下に置くと、**ホスト側の `.claude/skills` と `workspace/` を使いながら EBEX 同梱のベーシックスキルも併用**できます。

```
dx-training-studio/
├── .ebex.host          ← マーカー（空ファイル）
├── .claude/skills/     ← ホスト専用スキル
├── workspace/          ← 作業データの正本
├── start.bat           ← ebex/start.host.bat をコピーしたもの
└── ebex/               ← EBEX リポジトリを clone（ホスト側では git 管理しない）
```

導入手順:

1. ホストリポジトリ直下に空ファイル `.ebex.host` を作る（EBEX はこれを見てホストを認識します）
2. ホストの `.gitignore` に `/ebex/` を追加する
3. EBEX リポジトリを `ebex/` へ clone する
4. `ebex/start.host.bat` をホスト直下へ `start.bat` としてコピーする
5. 更新は `cd ebex && git pull`

起動すると Pane 1 のヘッダーが **`EBEX for dx-training-studio`** になります。`for ...` が出ない場合は手順 1 のマーカーが無く、単体モードで動いています（作業データが `ebex/workspace/` に入ってしまうので確認してください）。

> `ebex/start.bat` を直接起動しても結果は同じです。ホスト直下の `start.bat` は導線の利便性のためだけに置きます。

> **注意**: `workspace/` をホスト側で git 管理する場合、`workspace/.meta/` は除外してください。セッション履歴やお気に入りは PC 固有のため、共有すると毎回差分が出ます。EBEX 側では `.gitignore` を自動生成しません。

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
- EBE Purpose: `contracts/ebe-purpose.md`（Pane 1 ヘッダーのロゴ／「EBEX」クリックで読み取り専用表示）

> 旧バージョンへ戻す場合: `.meta/sessions/<ino>.json` を該当フォルダの `session.json` として手動で戻してください（`meta.json` の `folderPath` でフォルダを特定できます）。

## 設定

ヘッダーの ⚙ から以下を変更できます。

- テーマ（light / dark / system）
- エディタフォントサイズ
- ペイン既定幅
- AI モデル / API キー

localStorage キー接頭辞は `ebex-*` です。

## 制約と誓約

EBEX は軽量ツールです。軽さと引き換えに、意図的な制約があります（Web 検索・サブエージェント・画像・フォルダ外操作・削除など）。できないことは「代わりの進め方」でフォローします。

- スキルを EBEX 向けに書く／直すとき → [`contracts/ebex-skill-contract.md`](contracts/ebex-skill-contract.md)（正本）
- 利用者向けの要約 → アプリのペイン 3（Agent チャット）の空状態に表示

## コマンド

```bash
npm run dev      # 開発サーバー
npm run build    # 本番ビルド
npm run lint     # ESLint
npm run test     # Vitest
```

## 由来

dx-training-studio の Agent スタック・CodeMirror エディタ・ペインリサイズを流用し、トレーニングコンテンツ制作機能を引いた standalone アプリです。
