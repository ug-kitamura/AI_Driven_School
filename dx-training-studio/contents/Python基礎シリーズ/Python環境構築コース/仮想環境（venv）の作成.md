---
series: Python基礎シリーズ
course: Python環境構築コース
lesson: 仮想環境（venv）の作成
status: open
description: プロジェクトごとに独立した Python 環境を用意する
tags: [python, venv]
estimated_minutes: 20
author: 山田太郎
---

# 仮想環境（venv）の作成

プロジェクトごとにパッケージを分離するため、venv を使います。

```bash
cd my-project
python -m venv .venv
```

## 有効化

**Windows (PowerShell):**

```powershell
.venv\Scripts\Activate.ps1
```

**Mac / Linux:**

```bash
source .venv/bin/activate
```

有効化後、`pip install` で入れたパッケージはこのプロジェクト専用になります。
