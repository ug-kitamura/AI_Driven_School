---
series: Python基礎シリーズ
course: Python基礎コース
lesson: リスト内包表記
status: open
description: Pythonのリスト内包表記の基本構文を例を交えて学び、for ループとの違いや使いどころを理解する
tags: [python, tutorial]
estimated_minutes: 15
author: ""
---

# リスト内包表記

## 学習目標

このレッスンを終えると、以下ができるようになります。

- リスト内包表記の基本構文を理解できる
- `for` ループとリスト内包表記を使い分けられる
- 条件付きリスト内包表記（フィルタリング）を書ける
- ネストしたリスト内包表記の読み方を理解できる

---

## 1. リスト内包表記とは？

**リスト内包表記**（list comprehension）とは、リストを簡潔に生成するための Python の構文です。  
`for` ループを 1 行にまとめたようなイメージで、コードがすっきり読みやすくなります。

### 基本構文

```python
[式 for 変数 in イテラブル]
```

---

## 2. for ループとの比較

### for ループで書いた場合

```python
numbers = [1, 2, 3, 4, 5]
squares = []

for n in numbers:
    squares.append(n ** 2)

print(squares)  # [1, 4, 9, 16, 25]
```

### リスト内包表記で書いた場合

```python
numbers = [1, 2, 3, 4, 5]
squares = [n ** 2 for n in numbers]

print(squares)  # [1, 4, 9, 16, 25]
```

> **ポイント**: 処理の流れは同じです。リスト内包表記を使うと 4 行 → 1 行に短縮できます。

---

## 3. 条件付きリスト内包表記（フィルタリング）

`if` を末尾に追加することで、条件に合う要素だけを抽出できます。

### 構文

```python
[式 for 変数 in イテラブル if 条件]
```

### 例: 偶数だけ取り出す

```python
numbers = [1, 2, 3, 4, 5, 6, 7, 8]
evens = [n for n in numbers if n % 2 == 0]

print(evens)  # [2, 4, 6, 8]
```

### 例: 文字列のフィルタリング

```python
words = ["apple", "banana", "cherry", "avocado"]
a_words = [w for w in words if w.startswith("a")]

print(a_words)  # ['apple', 'avocado']
```

---

## 4. 式の中で変換する

取り出した値に変換処理を加えることもできます。

### 例: 文字列をすべて大文字にする

```python
fruits = ["apple", "banana", "cherry"]
upper_fruits = [f.upper() for f in fruits]

print(upper_fruits)  # ['APPLE', 'BANANA', 'CHERRY']
```

### 例: 条件で値を変換する（三項演算子との組み合わせ）

```python
numbers = [1, 2, 3, 4, 5]
labels = ["偶数" if n % 2 == 0 else "奇数" for n in numbers]

print(labels)  # ['奇数', '偶数', '奇数', '偶数', '奇数']
```

---

## 5. ネストしたリスト内包表記

`for` を複数重ねることもできます。ただし、複雑になりすぎる場合は通常の `for` ループを使うほうが読みやすいこともあります。

### 例: 二次元リストのフラット化

```python
matrix = [[1, 2, 3], [4, 5, 6], [7, 8, 9]]
flat = [n for row in matrix for n in row]

print(flat)  # [1, 2, 3, 4, 5, 6, 7, 8, 9]
```

> **ポイント**: `for` の順番は通常のネストした `for` ループと同じ順（外側 → 内側）です。

---

## 6. 使いどころと注意点

| 状況 | おすすめ |
|------|----------|
| 単純な変換・フィルタリング | ✅ リスト内包表記 |
| 処理が複雑 / 複数行にわたる | ✅ for ループ |
| ネストが 2 段以上 | ⚠️ for ループを検討 |
| 副作用（print など）が目的 | ❌ リスト内包表記は不向き |

---

## 7. 確認ポイント

- [ ] `[式 for 変数 in イテラブル]` の基本構文を書ける
- [ ] `if` を使って条件フィルタリングができる
- [ ] `for` ループとリスト内包表記を相互に変換できる
- [ ] ネストしたリスト内包表記の読み方を理解している

---

## まとめ

リスト内包表記を使うと、`for` ループよりも簡潔にリストを生成できます。  
ただし、複雑になりすぎると可読性が下がるため、シンプルな変換・フィルタリングに活用するのがベストプラクティスです。

