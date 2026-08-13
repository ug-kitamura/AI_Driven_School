---
series: Python基礎シリーズ
course: Python基礎コース
lesson: 型を理解しよう
status: open
description: Pythonで使う基本的な型（数値・文字列・リスト・タプル・集合・辞書）を網羅的に学ぶレッスンです。
tags: [python, tutorial]
estimated_minutes: 20
author: ""
---

# 型を理解しよう

## 学習目標

このレッスンを終えると、以下ができるようになります。

- Python の主要な組み込み型を列挙できる
- 各型の特徴と使いどころを説明できる
- 型を確認する `type()` 関数を使える

---

## 1. 型とは？

Python では、すべての値に **型（type）** があります。型によって「どんな操作ができるか」が決まります。

```python
x = 42
print(type(x))  # <class 'int'>
```

---

## 2. 数値型

### int（整数）

```python
a = 10
b = -3
print(type(a))  # <class 'int'>
```

### float（浮動小数点数）

```python
pi = 3.14
print(type(pi))  # <class 'float'>
```

### complex（複素数）

```python
c = 2 + 3j
print(type(c))  # <class 'complex'>
```

> **ポイント** 日常的な計算では `int` と `float` を主に使います。`int` 同士の除算（`/`）は `float` になる点に注意しましょう。

```python
print(10 / 3)   # 3.3333...（float）
print(10 // 3)  # 3（整数除算）
```

---

## 3. 文字列型（str）

シングルクォート `'` またはダブルクォート `"` で囲みます。

```python
name = "Python"
greeting = '型を学ぼう'
print(type(name))  # <class 'str'>
```

### よく使う操作

```python
s = "Hello, Python!"
print(len(s))        # 文字数: 14
print(s.upper())     # 大文字化: HELLO, PYTHON!
print(s[0:5])        # スライス: Hello
print(s.replace("Python", "World"))  # Hello, World!
```

---

## 4. リスト（list）

順序があり、**変更可能**なコレクション。

```python
fruits = ["apple", "banana", "cherry"]
print(type(fruits))  # <class 'list'>

fruits.append("date")   # 末尾に追加
fruits[0] = "avocado"   # 要素の変更
print(fruits)
```

- インデックスは `0` 始まり
- 異なる型の値を混在させることも可能

---

## 5. タプル（tuple）

順序があり、**変更不可**なコレクション。

```python
point = (10, 20)
print(type(point))  # <class 'tuple'>

print(point[0])  # 10
# point[0] = 99  # → TypeError（変更不可）
```

> **ポイント** 変更されては困るデータ（座標、設定値など）にはタプルを使うと安全です。

---

## 6. 集合（set）

**順序なし・重複なし**のコレクション。

```python
colors = {"red", "blue", "green", "red"}
print(colors)       # {'red', 'blue', 'green'}（重複が除去される）
print(type(colors)) # <class 'set'>
```

### 集合演算

```python
a = {1, 2, 3}
b = {2, 3, 4}
print(a | b)  # 和集合: {1, 2, 3, 4}
print(a & b)  # 積集合: {2, 3}
print(a - b)  # 差集合: {1}
```

---

## 7. 辞書（dict）

**キーと値のペア**を管理するコレクション。

```python
person = {"name": "Alice", "age": 30, "city": "Tokyo"}
print(type(person))  # <class 'dict'>

print(person["name"])       # Alice
person["age"] = 31          # 値の更新
person["email"] = "alice@example.com"  # キーの追加
```

### よく使う操作

```python
print(person.keys())    # dict_keys(['name', 'age', 'city', 'email'])
print(person.values())  # dict_values([...])
print(person.get("phone", "未登録"))  # キーがなければデフォルト値
```

---

## 8. 型の確認と変換

```python
x = "42"
print(type(x))       # <class 'str'>

y = int(x)           # 文字列 → 整数
print(type(y))       # <class 'int'>

z = float(x)         # 文字列 → 浮動小数点
print(type(z))       # <class 'float'>

lst = list((1, 2, 3))  # タプル → リスト
print(type(lst))        # <class 'list'>
```

---

## 9. まとめ

| 型 | リテラル例 | 変更可否 | 重複 | 順序 |
|---|---|---|---|---|
| `int` / `float` / `complex` | `1`, `3.14`, `2+3j` | ✅ | — | — |
| `str` | `"hello"` | ❌ | ✅ | ✅ |
| `list` | `[1, 2, 3]` | ✅ | ✅ | ✅ |
| `tuple` | `(1, 2, 3)` | ❌ | ✅ | ✅ |
| `set` | `{1, 2, 3}` | ✅ | ❌ | ❌ |
| `dict` | `{"k": "v"}` | ✅ | キー❌ | ✅ |

---

## 確認ポイント

- [ ] `type()` 関数で任意の値の型を確認できる
- [ ] リストとタプルの違い（変更可否）を説明できる
- [ ] 集合が重複を自動で除去することを確認した
- [ ] 辞書のキーで値を取得・更新できる

