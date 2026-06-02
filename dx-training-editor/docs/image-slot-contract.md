# レッスン画像スロット契約（骨子 AI スキル向け）

## Markdown 記法（記法案 A）

```markdown
![ui] VSCode 風の画面。ファイルツリーとエディタ、下部にターミナル。](images/git-env-overview.png)
```

- **path**: 必ず `images/<filename>`（`uploaded` / `ai` / `web` を path に含めない）
- **alt**: 生成ヒント。接頭辞 `[ui]` / `[diagram]` / `[photo]` を推奨
- ファイルは未作成のままでよい（プレビューは壊れ画像＝挿入予定の目印）

## ワークスペースでの充足

| タブ | staging | promote 先 |
|---|---|---|
| UP | `images/uploaded/` | `images/` |
| AI | `images/ai/` | `images/` |
| Web | `images/web/`（将来） | `images/` |

挿入操作で staging → 正本にコピーし、編集モードのカーソル（または選択範囲）に `![filename](images/filename)` を反映する。
