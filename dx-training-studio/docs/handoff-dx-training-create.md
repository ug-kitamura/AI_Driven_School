# 引き継ぎ: `dx-training-create` スキルの実装

**やること**: OpenSpec change `add-dx-training-create-skill` を実装する。`/opsx:apply add-dx-training-create-skill` で始められる。

**この文書の前版は役目を終えた。** 前版は「決まっていないこと 4.1〜4.6」を並べた設計前の引き継ぎだった。それらはグリル19問と explore で全部決着したので、本版は**決定事項と、実装前に知っておくべき事実**に置き換えてある。前版の内容は `git show :dx-training-studio/docs/handoff-dx-training-create.md` で取り出せる（ステージ済みのため）。

---

## 1. 現在地

```
[済] add-lesson-design-principles     archive 済み・spec 同期済み
       └ references/design-principles.md  117行13項目

[次] add-dx-training-create-skill     proposal/design/specs/tasks 完成・未実装  ← ここ
       └ SKILL.md + references/lesson-template.md を作る

[後] 初回実行 → 出来の良い1本を模範解答に昇格
     穴埋め（社内PC・VSCode + GitHub Copilot）
     旧スキル削除（手作業）
```

### ⚠ 最初に確認すること

**`openspec/changes/` は `.gitignore` されている**（`dx-training-studio/.gitignore:28`）。change アーティファクトはコミットされない。

- **同じマシンの別セッション**なら、そのままファイルがある
- **別マシン・別クローン**なら change が存在しない。その場合はこの文書と `openspec/specs/training-create-skill/spec.md`（こちらはコミット対象）から再構成する必要がある

まず `npx openspec list --json` で `add-dx-training-create-skill` があるか確認すること。

### リポジトリの状態（未コミット4件）

```
A  dx-training-studio/.claude/skills/dx-training-create/references/design-principles.md
A  dx-training-studio/docs/handoff-dx-training-create.md
M  dx-training-studio/docs/training-plan-20260805.md      ← L11/L12 見直しで大幅変更
A  dx-training-studio/openspec/specs/training-create-skill/spec.md
```

ブランチ `dx-training-create`。コミットするかは人が決める。

---

## 2. 最初に読むファイル

| ファイル | なぜ |
|---|---|
| `openspec/changes/add-dx-training-create-skill/design.md` | 7つの決定と根拠。**ここを読めば再議論不要** |
| `openspec/changes/add-dx-training-create-skill/tasks.md` | 6グループ32タスク |
| `.claude/skills/dx-training-create/references/design-principles.md` | 前 change の成果物。**触らない** |
| `.claude/skills/dx-training-plan/SKILL.md` | 体裁の手本（162行） |
| `docs/training-plan-20260805.md` | 入力。29レッスンの構成 |

---

## 3. 実装調査で判明した事実（再調査不要）

グリル時の想定と食い違っていた点。**ここを間違えると出力先が壊れる。**

### 3.1 `order` は frontmatter に無い

```
contents/<シリーズ>/.meta.json          { id, order: [コース名...] }
contents/<シリーズ>/<コース>/.meta.json  { id, order: [レッスン名...], target,
                                          cross_series_prev, cross_series_next }
```

`lib/schema.ts` の `lessonSchema` にあるのは `id / series / course / lesson / status / description / tags / estimated_minutes / author / content` だけ。**`order` は無い。**

`order` を書かないと、並びは**ディレクトリ名の昇順**になる（`contents-loader.ts` の `[...actualLessons].sort()`）。計画書の順序と一致する保証がないので `.meta.json` に書く必要がある。

### 3.2 `id` は loader が自動採番して書き戻す

```ts
// lib/contents-loader.ts
if (!courseId) {
  courseId = generateCourseId(courseName, usedIds);
  writeMetaJson(courseDir, { ...courseMetaRaw, id: courseId });  // 既存キーは保持
}
```

スプレッドで展開しているので、**`order` だけ書いた `.meta.json` に後から `id` が足される**。共存できる。だから create は `id` を書かない。

レッスンの id は `buildLessonId(seriesName, courseName, lessonName)` で導出され、ファイルには保存されない。

### 3.3 ディレクトリ名は slug ではなく表示名

`contents-loader.ts` は `const seriesName = seriesDirName` とディレクトリ名をそのまま表示名にする。既存は `contents/はじめにシリーズ/DX piyopiyo コース/` という日本語名。

**決定: 計画書の名前をそのまま使う。** `contents/はじめに/DX入門/トレーニングの進め方/contents.md`。既存の「〜シリーズ」「〜コース」というサフィックス付きのものはお試しで作ったもので、退避予定。

### 3.4 `target`（受講対象）はコースの `.meta.json` にある

計画書5章にコースごとの受講対象があるので、create が書く。人が Studio で入力し直すのは無駄。

---

## 4. 決まっていること（再議論しない）

グリル19問 + explore で決着済み。根拠は `design.md` にある。

### 4.1 位置づけ

- **理想環境（Claude Code・強いモデル）前提**で作る。自宅と社内で挙動を分岐させない
- Studio Pane4 の Agent は **GPT-5 nano** なので、このスキルは動かない前提でよい
- 責務は草稿生成に留まらず、**内容の深掘り・画像の判断・必要な社内データの判断・情報収集**まで含む（計画書に本文の具体が無いため）

### 4.2 入出力

- 生成範囲は**全体 / シリーズ / コース / レッスン**の4段階。既定はコース単位
- **執筆は範囲に関わらず1レッスンずつ順次**、都度ファイルに落とす（範囲＝設計メモの単位であって執筆単位ではない）
- 出力先 `contents/<シリーズ名>/<コース名>/<レッスン名>/contents.md`
- `.meta.json` は `order` と `target` を書く。`id` と `cross_series_prev/next` は書かない
- 既存 `contents/` は触らない。名前衝突は一覧提示して確認
- 曼陀羅は範囲に関わらず**最後の固定フェーズ**。シリーズまたぎは提案のみ

### 4.3 フェーズ

```
対話(最小) → 情報収集 → 設計メモ案 → 対話(詰め) → 承認 → 執筆 → 曼陀羅
```

- 対話は**1問ずつ**
- 設計メモは `docs/<yyyymmdd>/` 配下。`overall.md` / `{series}.md` / `{series}-{course}.md` / `{series}-{course}-{lesson}.md`。同日再実行は最大連番+1
- 設計メモが**要求／供給表を兼ねる**。計画書と `plan-template.md` は変更しない
- 検索は `creating-visual-explainers` の Step 3 に準拠（2〜3回、定義／最新動向／具体例）。出典はインライン、素の markdown 斜体1行

### 4.4 穴の記法（3種）

| 記法 | 用途 | 埋める場所 |
|---|---|---|
| `> **社内**:` | 社内情報のテキスト | 社内PC |
| `> **社内画像**:` | 社内画面の撮影・録画 | 社内PC |
| `> **素材**:` | 一般だが人手が要る画像 | どこでも |

- **`contracts/image-slot-contract.md` は変更しない。** HTML コメントは AI 画像生成専用のまま
- 社内の穴は**答えるべき問いを箇条書き**にし、形式と分量も指定する（自宅では中身を知り得ず、持ち出さない方針のためユーザーにも聞けない）
- 画像の穴は中身を知らなくても**撮影指示を具体化できる**。テキストと画像で「具体的」の意味が違う
- 穴の周囲に**一般論を書かない**。導入文と接続文だけ。一般論を残すと埋め忘れが誤情報として公開される
- 穴は社内PCの **VSCode + GitHub Copilot** で埋める想定。AI への指示として機能する粒度で書く
- 執筆中に新しい穴を見つけたら、**本文に書く前に提示して承認を取り、設計メモと本文を同時更新**する

### 4.5 references

- `design-principles.md` — **完成済み。触らない**
- `lesson-template.md` — 今回作る（章立て・frontmatter 規則・`<details>` 解答例・穴の記法・出典の書き方）
- `model-answer` — **初回は作らない。** 空の状態を正常として扱いエラーにしない。実行の最後に昇格を促す

### 4.6 既定方針（計画書 1.4）

- 1レッスン 10〜15分
- **全レッスンに5分以内の「やってみる」演習**（読み物と選択式だけにしない）
- 小演習は `<details>` で折りたたんだ**解答例1行**。完成コード一式はハンズオンのみ
- 手順の説明にはスクリーンショットや図を載せる
- 構成: 学習目標 → 本文 → やってみる → まとめ → 確認問題

---

## 5. 落とし穴

### 5.1 AI は手順をスキップする

`ads-lecture` に明言がある。「スキルにこの手順でやってねと言っても、**AI は平気でサボります。手順を自分の判断でスキップする**」。

対策として、フェーズの完了条件を**ファイルの存在**（設計メモが書かれた、承認が取れた）で示す。口頭の宣言で済ませない。

### 5.2 大量に作らせると必ず品質が落ちる

実測がある。1問なら十分な品質、80問（1コース分）を一度に作らせると選択肢が雑になり解説が薄くなる。8〜12問単位で安定。文章でも3000語一括だと後半が崩れ、500語ずつなら維持できる。

**これが「1レッスンずつ順次」の根拠。** 効率のために束ねたくなるが、束ねない。

### 5.3 大量の出力は「さらっと眺めるとどれもいい感じに見えてくる」

だから1本ずつ見る。自己レビューは**時系列**で行う——俯瞰レビューだけだと冒頭の分かりにくさが拾われない。

### 5.4 レビューは根本的なやり直しを提案しない

鮭弁当に「野菜を増やしては」は出るが「そもそもサンドイッチでは」は出てこない。レビューで問題なしと言われても完璧ではない。レビュー役に修正はさせない（指摘のみ）。

### 5.5 計画書の制約が2箇所に分散している

第6章は**表の行**と**表の下の注記**に情報が分かれている。

```
表の行:  | L26 | 外部ライブラリを使う | ... | 15分 | pandas を導入し… |
注記:    > L26 は pandas の超基礎のみ。DataFrame の詳細には踏み込まない
```

人が読む分には自然だが、機械的に拾うと散らばる。**計画書は変更しない方針**なので、`SKILL.md` 側で「表の行と直後の注記の両方を読む」ことを明示する。

### 5.6 計画書の ID は今回ずれた

L11/L12 の見直しで **L14〜L28 が L15〜L29 に繰り上がり、全29レッスン**になった。古い ID（L28 = 応用課題）を覚えている前提で書かないこと。決定の経緯は計画書 11.20 にある。

---

## 6. 守るべき作法

### 6.1 OpenSpec

このリポジトリは 42 の spec を全て change 経由で管理している。

```
/openspec-propose        proposal → design → specs → tasks
/openspec-apply-change   タスクを順に実装、完了ごとに [ ] → [x]
/openspec-archive-change delta spec を本体 spec へ同期 → archive へ移動
```

- planning home は **`dx-training-studio/`**（リポジトリルートではない）。ルートから叩くと `No OpenSpec changes directory found`
- **`openspec-sync-specs` スキルはこの環境に無い。** archive 時の同期は手作業（前回は本体 spec を直接書いて `npx openspec validate --specs` で42件通ることを確認した）
- **同期を忘れると本体 spec が古いまま残る。** 今回は **MODIFIED を含む**ので特に注意
- アーティファクトは**日本語**で書く
- 検証: `npx openspec validate <change> --strict`

### 6.2 スキルの SSoT 作法

**`SKILL.md` は薄く保ち、内容は `references/` に置く。重複させない。**

`dx-training-plan` の実測:

```
SKILL.md                  162行   フェーズの流れと参照のみ
references/
  design-principles.md    108行
  mandala-guide.md        214行
  plan-template.md        231行
  verification.md         127行
```

- `SKILL.md` は 200行以内、`references/` は各300行以内が目安
- 100行を超える references には目次を置く
- **同じ内容を2箇所に書かない**
- スキルの作成・更新には `creating-skills` スキルを使う

### 6.3 その他

- 出力は日本語
- 今回の change は `.claude/skills/` 配下に markdown を2本足すだけで、アプリケーションコードに触れない。`npm run test` / `npm run lint` への影響は無いはずだが、念のため後始末で `git status` を見る
- `npm run lint` は既存エラーが残っている。増やしていないかだけ見る

---

## 7. 対象外（やらない）

- 穴埋めスキル（社内側）
- 社内コンテキストDB の逆向き運用
- ebex 機能の Studio 移植
- Studio 側の改修（コメント種別の判定、未充足の穴の一覧表示）
- 旧スキル（`create-draft` / `create-structure`）の削除 — **後日手作業**
- 計画書の再修正
- `references/model-answer/` の作成

---

## 8. 未決事項

| 項目 | 状況 |
|---|---|
| 模範解答の昇格基準 | どの1本を、どうなったら模範とするか未定 |
| 同日再実行時のメモの扱い | 連番（最大+1）までは決めたが、古い版を消すかは未定 |
| `SKILL.md` の「表＋注記」読み取り | 5.5 の対応方法をタスク 3.3 で詰める |
| 空振り確認の設計メモ | 残すか破棄するか（タスク 6.3） |

---

## 9. 実装後

1. `/openspec-archive-change add-dx-training-create-skill`
2. **MODIFIED を本体 spec に手で同期**（6.1 参照）。「`SKILL.md` を作成してはならない」の解除を反映し忘れない
3. `npx openspec validate --specs` で全件通ることを確認
4. 初回実行 → 出来の良い1本を模範解答に昇格
