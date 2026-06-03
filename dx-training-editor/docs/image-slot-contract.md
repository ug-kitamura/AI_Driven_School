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
2. 作者が編集モードでコメント内にカーソルを置く → AI / Web タブのプロンプト欄へ **自動同期**
3. **AI**: 必要ならプロンプトを編集し **生成** → `images/ai/` に staging PNG
4. **Web**: 必要なら検索条件（説明文）を編集し **検索** → Pixabay から最大 3 枚を `images/web/` に staging
5. **挿入** → 正本 `images/<file>` へ promote + カーソル位置に `![短い alt](images/<file>)` を追加（コメントは残す）

| タブ | staging | promote 先 |
|---|---|---|
| UP | `images/uploaded/` | `images/` |
| AI | `images/ai/` | `images/` |
| Web | `images/web/` | `images/` |

### Web タブ（Pixabay 素材検索）

- プロンプト欄は **人間向けの説明文**（図解指示でも可 — 検索時に Claude が Pixabay キーワードへ変換）
- **検索** で Pixabay 固定・写実ビジネス優先・最大 3 枚を staging へ追加
- **自動入力**: コメント内 → そのままコピー / コメント外 → Claude が説明文を提案
- 要 **Anthropic API キー**（プランナー・自動入力）と **Pixabay API キー**（検索）

## 生成品質

- creating-visual-explainers の **グラフィック語彙**（構造図 + UI mock）
- model-answer.html の **図 1 ブロック** 水準（`custom.*` 配色・Lucide）
- 図内テキスト OK、図外の説明段落 NG
