---
series: Git完全マスターシリーズ
course: Git環境構築コース
lesson: 初期設定（名前・メールアドレス）
status: in_progress
description: git config で名前とメールアドレスを設定する
tags: [git, config]
estimated_minutes: 10
author: Kitamura
---

# 初期設定（名前・メールアドレス）

## 学習目標

このレッスンを終えると、以下ができるようになります。

- `git config` コマンドで名前とメールアドレスをグローバル設定できる
- 設定内容を確認・修正できる
- 設定がコミット履歴にどう反映されるかを説明できる

---

## なぜ設定が必要なのか

Git はコミット（変更の記録）を作成するたびに、**誰が・いつ変更したか**を自動的に記録します。この「誰が」にあたる情報が、ここで設定する名前とメールアドレスです。

設定を行わないままコミットすると、履歴に正しい作成者情報が残らず、チームでの作業に支障をきたす場合があります。

> **NMS ワンポイント**
> NMS プロジェクトでは、コミットメッセージの先頭にチケット ID を付与するルールがあります（例: `NMS-1234: ログイン API のバリデーション追加`）。コミット履歴には名前・メールアドレスとともにこのメッセージも残るため、**最初の設定を正確に行うことが特に重要**です。
> 詳細は社内 Git ブランチ運用ルール（`https://docupedia.example.local/new-major-system/git-branch-strategy`）を参照してください。

---

## 手順

### 1. 名前を設定する

```bash
git config --global user.name "あなたの名前"
```

**例:**

```bash
git config --global user.name "Kitamura"
```

> `--global` オプションを付けると、そのコンピュータ上のすべての Git リポジトリに共通して適用されます。

---

### 2. メールアドレスを設定する

```bash
git config --global user.email "your@email.com"
```

**例:**

```bash
git config --global user.email "yamada.taro@example.com"
```

> 社内プロジェクトでは、会社のメールアドレスを使用することを推奨します。

---

### 3. 設定内容を確認する

設定が正しく反映されているか、以下のコマンドで確認しましょう。

```bash
git config --global user.name
git config --global user.email
```

すべての設定を一覧表示したい場合は：

```bash
git config --list
```

---

### 4. 設定を修正したい場合

入力ミスがあった場合は、同じコマンドを再度実行するだけで上書きできます。

```bash
git config --global user.name "正しい名前"
git config --global user.email "correct@email.com"
```

---

## 確認ポイント

- [ ] `git config --global user.name` を実行して、自分の名前が表示されることを確認した
- [ ] `git config --global user.email` を実行して、メールアドレスが表示されることを確認した
- [ ] 表示された内容に誤字・脱字がないことを確認した

---

## まとめ

| 設定項目 | コマンド |
|---------|---------|
| 名前 | `git config --global user.name "名前"` |
| メールアドレス | `git config --global user.email "メール"` |
| 設定確認 | `git config --list` |

名前とメールアドレスの設定は、Git を使う上での最初の一歩です。次のレッスンでは、実際にリポジトリを作成して Git の基本操作を学びます。