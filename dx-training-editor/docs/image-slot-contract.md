# レッスン画像指示契約（骨子 AI スキル向け）

## Markdown 記法

骨子 AI スキルは、画像生成の指示を **HTML コメント** に書く。

```markdown
<!--
Git の commit から push までを
4 ステップのフロー図 + ターミナル UI mock で
-->
```

- **プロンプト本文のみ**（ファイル名行は不要 — 生成時に AI がスラッグを付ける）
- コメントはプレビューに表示されない（制作メモ）
- `![…](images/…)` 形式の **未生成プレースホルダは使わない**

## ワークスペースでの制作フロー

1. 骨子 AI が `<!-- プロンプト -->` を本文に挿入
2. 作者が編集モードでコメント内にカーソルを置く → AI タブのプロンプト欄へ **自動同期**
3. 必要ならプロンプトを編集し **生成** → `images/ai/` に staging PNG
4. **挿入** → 正本 `images/<file>.png` へ promote + カーソル位置に `![短い alt](images/<file>.png)` を追加（コメントは残す）

| タブ | staging | promote 先 |
|---|---|---|
| UP | `images/uploaded/` | `images/` |
| AI | `images/ai/` | `images/` |
| Web | `images/web/`（将来） | `images/` |

## 生成品質

- creating-visual-explainers の **グラフィック語彙**（構造図 + UI mock）
- model-answer.html の **図 1 ブロック** 水準（`custom.*` 配色・Lucide）
- 図内テキスト OK、図外の説明段落 NG
- **図内テキストは原則英語**（プロンプトで「日本語で」等と明示された場合のみ例外）
