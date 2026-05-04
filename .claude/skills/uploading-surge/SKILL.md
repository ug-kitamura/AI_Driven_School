---
name: uploading-surge
description: |
  成果物をsurgeにアップロードするスキル。
  「surgeにアップロードして」と依頼された際に使用する。
---

# Uploading Surge

任意の成果物をsurge.shに公開する。

## ワークフロー

### Step 1: 公開

公開する前にまず Node.js の有無を確認する。

```bash
node --version
```

バージョン番号が表示された → そのまま「公開の実行」に進む。

`command not found` と表示された → `references/node-install-guide.md` の手順に従ってNode.jsのインストールを案内する。

#### 公開の実行

以下のスクリプトを**実行する**（中身を読む必要はない）。

**macOS / Git Bash（Windows）の場合:**

```bash
bash .claude/skills/creating-visual-explainers/scripts/deploy-diagram.sh output/{スラッグ}.html [スラッグ]
```

**Windows（PowerShell）で bash が使えない場合:**

```powershell
npx --yes surge output/{スラッグ}.html --domain diagram-[スラッグ].surge.sh
```

スラッグにはトピックに関連する短い英単語を指定する（例: `git-rebase`, `api-basics`）。

#### 初回の場合（Surge未登録）

ターミナルにメールアドレスとパスワードの入力を求められる。以下を伝える:

> 初回のみアカウント登録が必要です。
> メールアドレスを入力して Enter → パスワードを決めて入力して Enter。
> 確認メールが届いたらリンクをクリックすれば登録完了です。
> 次回以降はこの手順は不要です。

#### エラーが出た場合

エラーメッセージをそのまま見せず、**何が起きていて何をすれば解決するか**を、専門用語を避けて平易に説明する。

よくあるエラーと対応:

- **`npx: command not found`** — Node.js がまだ入っていない。`references/node-install-guide.md` の手順を案内する
- **`surge: not found` / surge関連エラー** — `npm install -g surge` を実行してから再度試す
- **認証エラー / `Login required`** — `npx surge login` を実行してメールアドレスとパスワードを入力する
- **その他** — エラーの内容を読み、「何が問題で」「次に何をすればいいか」を平易に説明する

### 成果物の削除

ユーザーが「この成果物を削除して」と依頼した場合:

1. `deploy-history.log` を読み、直近のデプロイURLを特定する
   - ログが存在しない場合 → ユーザーに削除したいURLを聞く
2. `npx surge teardown [ドメイン]` を実行する
3. 削除完了をユーザーに伝える

### Step 2: 完了報告

```
完成・公開完了: 【成果物のタイトル】

（成果物の内容を1〜2文で要約）

公開URL:
https://diagram-スラッグ.surge.sh

成果物の主なポイント:
- （主要トピックを3〜5個）

この成果物を削除したいとき:
チャット欄で「この成果物を削除して」と伝えてください。
```

