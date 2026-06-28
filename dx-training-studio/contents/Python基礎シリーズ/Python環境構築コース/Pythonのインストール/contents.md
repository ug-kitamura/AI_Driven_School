---
series: Python基礎シリーズ
course: Python環境構築コース
lesson: Pythonのインストール
status: open
description: Windows/Mac への Python インストール手順
tags: [python, setup, install]
estimated_minutes: 15
author: 山田太郎
---

# Python のインストール

## 🎯 学習目標

このレッスンを終えると、以下ができるようになります。

- Windows または Mac に Python をインストールできる
- インストール後にバージョンを確認してインストールの成功を確かめられる
- PATH の設定について基本的な概念を理解できる

---

## Windows へのインストール

### 手順

1. ブラウザで [https://www.python.org/](https://www.python.org/) を開く
2. 「Downloads」メニューから **Windows 向けの最新インストーラー**（例: `python-3.x.x-amd64.exe`）をダウンロードする
3. ダウンロードしたインストーラーをダブルクリックして起動する
4. **⚠️ 重要**: インストール画面の下部にある **「Add python.exe to PATH」にチェックを入れる**
   - これを忘れると、コマンドプロンプトから `python` コマンドが認識されません
5. 「Install Now」をクリックしてインストールを開始する
6. 完了後、「Close」をクリックして終了する

<!-- スクリーンショット: インストーラー起動直後の画面。「Add python.exe to PATH」チェックボックスを赤枠で強調 -->

### ✅ 確認方法

コマンドプロンプト（`Win + R` → `cmd`）を開き、以下を実行します。

```bash
python --version
```

以下のようにバージョンが表示されれば成功です。

```
Python 3.x.x
```

> **💡 ポイント**  
> `python` が認識されない場合は、PATH の設定が正しくできていない可能性があります。インストーラーを再実行し、「Add python.exe to PATH」にチェックが入っているか確認してください。

---

## Mac へのインストール

### 前提: Homebrew のインストール

Mac では **Homebrew**（パッケージマネージャー）を使って Python をインストールするのが一般的です。  
Homebrew がまだ入っていない場合は、ターミナルで以下を実行してください。

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

<!-- スクリーンショット: ターミナルで Homebrew インストールコマンドを実行している様子 -->

### 手順

1. ターミナル（`Command + Space` → `ターミナル`）を開く
2. 以下のコマンドを実行して Python をインストールする

```bash
brew install python
```

3. インストール完了後、バージョンを確認する

```bash
python3 --version
```

<!-- スクリーンショット: ターミナルで brew install python を実行している様子 -->

### ✅ 確認方法

以下のようにバージョンが表示されれば成功です。

```
Python 3.x.x
```

> **💡 ポイント**  
> Mac では `python` コマンドが macOS 標準の Python 2 系を指す場合があります。Homebrew でインストールした Python 3 系を使うには、**`python3`** と入力してください。

---

## 📝 まとめ

| OS      | インストール方法            | バージョン確認コマンド |
|---------|-----------------------------|------------------------|
| Windows | 公式サイトからインストーラー | `python --version`     |
| Mac     | Homebrew (`brew install python`) | `python3 --version` |

インストールが完了したら、次のレッスンで **仮想環境（venv）の作成** に進みましょう！
