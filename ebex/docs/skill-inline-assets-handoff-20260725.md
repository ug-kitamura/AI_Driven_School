# EBEX — スキル改善 / CSS インライン化 引き継ぎ

> **【2026-07-26 追記】この資料の役割は終わった。**
>
> 「次に着手するときの起点」に書いた作業は 3 本の change として実装済み。
>
> | change | 内容 | 状態 |
> | --- | --- | --- |
> | `html-preview-viewport` | Pane 2 のプレビューを固定高 iframe へ。`h-screen` / `position:fixed` が実ブラウザと同じ挙動になる | 23/23 完了 |
> | `skill-workflow-fixes` | 英語版の額縁英訳・残留チェック追加・visual-explainer の額縁コピー先行 | 20/24（残は実機受け入れ） |
> | `inline-assets-on-demand` | **本資料の本体**。インライン化を EBEX 機能化し、Tailwind v3 をプロセス内でオンデマンドコンパイル | 47/51（残は実機受け入れ） |
>
> 決着した論点:
>
> - **未解決だった「手で叩ける CLI が必要か」→ 不要**。`lib/agent/tools/inline-html-assets.ts` のみ。`.mjs` から TypeScript を呼ぶ実行時変換を持ち込まない
> - 事前ビルド方式の限界が数字で裏づけられた。visual-explainer / Haiku 4.5 の実成果物で **使用 319 クラス中 89 (28%) が subset.css に不在**。オンデマンドでは 0 件（回帰テストとして常設）
> - 実測サイズは本資料の見積り（CSS 7.7〜19.4KB）より大きい **13.8〜27.7KB**。preflight を含めるため。事前ビルドの 84〜93KB に対しては約 1/4〜1/6
> ### 残した課題: 額縁のフォント調達
>
> `visual-explainer` の額縁は Google Fonts（`Noto Sans JP`）を `<link>` で読み込む。インライン化後もこれは**意図的に残している**。
>
> - 実測では、フォントの有無でレイアウトは変わらない（`scrollHeight` 9712 で一致）。ローカルに Noto が無い環境でも `Yu Gothic UI` へ倒れ、**崩れではなく字形違い**に留まる（日本語の実寸 280.5px → 237.1px）
> - Bosch 社内端末はスタック先頭の `Bosch Sans` が当たるため、そもそも Noto へ到達しない
> - 埋め込みは不採用。日本語フォントはサブセット化しても数百 KB〜MB 級で、+28〜47KB に収めた意味が消える
>
> **未解決**: 到達できる環境では、成果物を開くたびに Google へリクエストが飛ぶ。GDPR 上の懸念は字形の差とは独立している。本筋の解は「社のデザインシステムのフォントへ揃える処理を入れる」ことで、これは後日の課題とした。
>
> 以降の記述は**当時の検討過程の記録**として残す。現在の仕様は `openspec/specs/skill-bundled-asset-inlining/spec.md` を参照すること。

**作成日**: 2026-07-25
**目的**: スキル関連の 3 change の実装状況と、CSS インライン化の方針転換（事前ビルド → EBEX 機能化）を、別セッション / 別担当が引き継げるように記録する
**ステータス**: change 1・2 は実装済み ✅ / change 3 は**実装済みだが方針転換により作り直し** ⚠️
**ブランチ**: `update-skills`（`eac6a95` 時点。作業ツリーはクリーン）
**関連**（3 本とも 2026-07-25 にアーカイブ済み）:

- `openspec/changes/archive/2026-07-25-skill-contract-two-tier/`（23/23）
- `openspec/changes/archive/2026-07-25-skills-contract-conformance/`（37/40）
- `openspec/changes/archive/2026-07-25-skill-inline-assets/`（30/32・**作り直し対象**）
- 契約の正本: `contracts/ebex-skill-contract.md`
- canonical spec: `ebex-skill-contract` / `bundled-skills-conformance` / `skill-bundled-asset-inlining`

---

## 全体像

社内で使用中の 4 スキル（`meeting-minutes` / `meeting-minutes-ebe` / `training-record` / `visual-explainer`）を EBEX で確実に動かすための一連の作業。3 本の change に分割した。

```
1. skill-contract-two-tier        契約の A/B 二層化・自動発火なし・spec 整理      実装済み ✅
2. skills-contract-conformance    4 スキルの契約準拠（★完走条件）               実装済み ✅
3. skill-inline-assets            CSS・アイコンのインライン化                    方針転換 ⚠️
```

---

## change 1・2: 実装済みの内容

### 発見した 2 つの構造的バグ（これが作業全体の起点）

現行 4 スキルは **EBEX 上でどのモデルを使っても完走しない**状態だった。原因はモデルの賢さと無関係な 2 点。

| # | 問題 | 根拠 |
| --- | --- | --- |
| 1 | 額縁の区間マーカーが同一ファイル内で全部同名（`CONTENT_START` × 3〜5 組） | `replace_between` は `original.indexOf` の先頭一致（[registry.ts:1225](../lib/agent/tools/registry.ts)）。**2 番目以降の区間へ到達できない** |
| 2 | SKILL.md が「完成した HTML を保存する」＝全文一括書き込みを指示 | `write_file` は 30,000 文字上限（[registry.ts:84](../lib/agent/tools/registry.ts)）。模範回答相当（46〜60KB）は必ず超える |

この 2 つは独立ではなく、**片方だけ直しても完走しない**。マーカーを一意化した上で、手順を「額縁コピー → 変数一括置換 → 区間ごとに差し込み」へ移した。

区間名は次のとおり（番号ではなく構造語。区間の増減で番号がずれるのを避けるため）。

| スキル | 区間名 |
| --- | --- |
| meeting-minutes | `AGENDA_LIST` / `AGENDA_DETAILS` / `ACTION_PLAN` |
| meeting-minutes-ebe | 上記 ＋ `PURPOSE_CONTRIBUTION` |
| training-record | `TOPIC_LIST` / `TOPIC_DETAILS` / `ACTION_PLAN` / `QA` / `QUIZ` |
| visual-explainer | `CONTENT` |

### 契約の A/B 二層化

**方針転換**: 「EBEX の都合でスキルの機能を落とさない」。従来の契約は全 8 項目が「〜を前提に書かない」という否定形で、Cursor / Claude Code で使える機能を捨てさせていた。

```
A: ホストが吸収する制約 — 書いてよい
     サブエージェント / web 検索 / 画像・マルチモーダル / 削除 / MCP・外部コネクタ
     作者の責務は「落とされても手順が破綻しない形にすること」

B: どのホストでも守る作法 — 必須
     プレースホルダー / 区間名の一意性 / テンプレの自己完結 /
     大きな成果物のコピー先行 / 作業フォルダの境界 / 中間ファイル /
     スクリプト実行とネットワーク / パスは役割語で書く
```

EBEX 側が A 群をすべて吸収する仕組みを既に持っていることを確認済み（サブエージェント検出 → 同一セッション実行、検索キー未設定 → 人手フォールバック UI、画像検出 → スキップ/中止の選択）。

### その他

- 中間ファイルの置き場を「成果物と同じフォルダの `_work/`」から**「作業フォルダ直下の `_work/`」**へ統一（契約・spec・`lib/agent/skill-runtime-context.ts` の 3 箇所）
- `creating-skills` に削除されていたホスト contract フック 1 行を復元（ホスト非依存表現。EBEX 固有パスは書かない）
- Pane 3 の空状態に ✗ 行「スキルは自動で始まりません → / で選んでください」を追加
- 新 spec `ebex-skill-contract` を作成。`skill-template-conventions` から削除済み minutes-maid を指す要件を除去
- `meeting-minutes-ebe` の PowerShell 手順を削除し、ロゴを base.html へ base64 直書き（`images/logo_small.png` 由来、7.3KB）

### 既存テストの向け直し

削除済みスキルを参照して失敗していた受け入れテスト 2 件を、現存スキルへ向け直した。

| テスト | 変更前 | 変更後 |
| --- | --- | --- |
| `registry.test.ts` の受け入れ | `creating-visual-explainers`（削除済み） | `visual-explainer` |
| `artifact-routing-flow.test.ts` | `minutes-maid`（削除済み） | `meeting-minutes` |

後者は単なる修復ではなく、**3 区間すべてに順に差し込む**形へ強化した。base.html のマーカーを旧仕様（同名）へ戻すと FAIL し、戻すと PASS することを確認済み。上記バグ 1 の回帰を実際に捕まえる。

---

## change 3: 方針転換の経緯（**ここが引き継ぎの核心**）

### 実装したもの（現在リポジトリに入っている）

事前ビルド方式。**この方式は採らないことになった**が、コードは残っている。

```
scripts/build-skill-assets.mjs                 開発用ビルド（npm run build:skill-assets）
.claude/skills/*/assets/subset.css             Tailwind サブセット（84〜91KB × 4）
.claude/skills/*/assets/icons.json             Lucide のパスデータ（120〜125 個 × 4）
.claude/skills/*/scripts/inline-assets.mjs     変換スクリプト（4 つバイト同一）
```

動作自体は検証済み（実測 46KB → 142KB、外部 URL 0 件、オフラインでも代替アイコンで完走、在庫外アイコンの unpkg 取得も成功）。

### なぜ作り直すのか

議論の中で **EBEX の機能にすればサーバ側で Tailwind を「その場でコンパイル」できる**ことが分かり、事前ビルドの前提が崩れた。実測値。

```
                    オンデマンド    事前ビルド     成果物の最終サイズ
meeting-minutes       7.7KB          84.1KB        53KB  か  129KB
training-record       8.1KB          84.3KB        67KB  か  143KB
visual-explainer     19.4KB          91.3KB        79KB  か  150KB
```

**CSS が約 1/10、成果物 HTML が半分以下になる。** 事前ビルドの 84KB はほぼ全部が safelist（使うかもしれないクラス）で、実際に使うのは 8〜19KB だけだった。

さらに、これまで議論してきた問題が副作用として全部消える。

| 事前ビルド方式の懸念 | オンデマンドだと |
| --- | --- |
| safelist の保守（未収録クラスが出たら足す） | 不要。実物を見てコンパイルするので取りこぼしゼロ |
| デザイン系統ごとの枝分かれ（作者が増えたとき） | 不要。ドキュメント 1 つずつ独立して生成 |
| `theme.extend` の衝突 | 起きない。額縁自身の `tailwind.config` だけを使う |
| 任意値クラス `w-[137px]` が使えない | 使える。JIT が実物を見るため |

### 決定事項（合意済み）

1. **B 案（EBEX の機能にする）を採る。** スキル同梱スクリプトも共有アセットも持たない
2. **実装は `lib/` の TypeScript。** `scripts/` ではない（理由は後述）
3. **Tailwind v3 をエイリアスで併存させ、プロセス内 API で呼ぶ**（`npx` の spawn はしない）
4. **Cursor / Claude Code へのフォールバックは SKILL.md に 1〜2 行**。手順は書き下さず目的だけ伝えて任せる
5. インライン化は**スキップ既定の後処理**なので、他ホストでの出力が EBEX と一致する必要はない

#### 2 の理由: `scripts/` ではなく `lib/`

`ebex/scripts/` の 5 ファイル（`render-diagram` / `context-db-utils` / `generate-app-icon` / `check-japanese-encoding` / `migrate-content`）は **app・lib・components から一度も参照されていない**。ここは「人が npm 経由で叩く道具箱」であり、製品の実行時コードは 1 つも無い。

EBEX が実行時に使うものは `lib/agent/tools/` にある（`generate-write.ts` / `search-provider.ts` / `script-sandbox.ts`）。インライン化はこれらと同じ性格なので、`lib/agent/tools/inline-html-assets.ts` 相当が自然。

#### 3 の理由: spawn より プロセス内 API

| | npx を spawn | プロセス内で API 呼び出し |
| --- | --- | --- |
| 実行時のネットワーク | 必要（初回 DL） | 不要 |
| 子プロセス | 起動する | しない |
| バージョンの再現性 | npx の解決に依存 | package-lock で固定 |
| vitest | しづらい | 通常のユニットテスト |

```
package.json（案）
  "tailwindcss": "^4"                          ← EBEX 本体（現状のまま）
  "tailwindcss-v3": "npm:tailwindcss@3.4.17"   ← エイリアスで併存
```

**Tailwind は必ず v3 を使うこと。** スキルの額縁が読み込む `https://cdn.tailwindcss.com` は v3 の Play CDN であり、v4 でコンパイルすると `shadow-*` の段階名やデフォルトのボーダー色が変わって既存の成果物と見た目がずれる。EBEX 本体の Tailwind v4 とは無関係な話。

#### フォールバックの書き方（イメージ）

```
> ホストにインライン化の機能があればそれを使う。
> 無ければ、CDN 読み込みを除き、使用中のスタイルとアイコンを HTML 内へ埋め込む。
```

物理パスもツール名も書かない（契約のポータブル規約）。EBEX では専用機能に、Cursor では自前の処理に解決される。「スキルは劣化させない、ホストが吸収する」という A 群の考え方そのもの。

### 未解決の問い（**新セッションで最初に決めること**）

**手で叩ける CLI が必要か。** `lib/` に寄せると `node scripts/inline-assets.mjs out.html` のような直接実行ができなくなる。

- 日常的に手で回したい想定が**無い** → `lib/` のみ。必要になってから薄い CLI を足す（`.mjs` から TypeScript を呼ぶには実行時変換が要るので、先に作らないほうがよい）
- 想定が**ある** → 最初から `.mjs` + `scripts/` にしておくほうが素直

---

## 実装時に効いてくる EBEX の制約（再調査不要）

| 制約 | 根拠 |
| --- | --- |
| シェル / コマンド実行ツールは**存在しない**（安全境界として意図的に未提供） | [registry.ts](../lib/agent/tools/registry.ts) `buildBlockedOutcome` |
| `run_script` は node バイナリ直起動 + Permission Model。`--allow-child-process` なし → スクリプト内から `npx` を spawn しても Node が拒否 | [script-sandbox.ts:209](../lib/agent/tools/script-sandbox.ts) |
| サンドボックスの fs 読取は **projectDir + 実行中スキル dir + スクリプト自身のみ**。appRoot は読めない | 同上 `buildPermissionArgs` |
| fs 書込は projectDir のみ。スキルフォルダへの書込は拒否 | 同上 |
| ネットワークは Permission Model の管轄外。`run_script` のその場コードはブロック、同梱スクリプトは許可 | [registry.ts:1648](../lib/agent/tools/registry.ts) |
| `run_skill_script` は**実行中スキルの `scripts/` 配下のみ**実行できる | [registry.ts:1407](../lib/agent/tools/registry.ts) `resolveSkillScriptPath` |
| `run_skill_script` の公開条件は実行中スキルに `scripts/` が実在すること | [registry.ts:409](../lib/agent/tools/registry.ts) `skillHasScriptsDir` |
| **スクリプト実行の確認には記憶がない**（同じスクリプトを 2 回呼べばダイアログも 2 回） | [confirm-gate.ts:196](../lib/agent/tools/confirm-gate.ts) |
| 確認ダイアログはスクリプト実体を読んで**コード全文**・書込予定パス・通信警告を表示する | [confirm-gate.ts:242](../lib/agent/tools/confirm-gate.ts) |

B 案ではサーバ側実行になるため、上記のサンドボックス制約は**どれも適用されない**。逆に言えば、B 案を採る限り「共有ゾーンの読取許可を足す」「`run_skill_script` の実行ゾーンを緩める」といった**安全境界の変更は一切不要**。

### その他の実測メモ

- `lucide-react` v1.14 では旧名が新名への **再エクスポート**になっている（`circle-help` → `circle-question-mark`、`alert-circle` → `circle-alert`）。パスデータを取るときは辿る必要がある
- 全 1703 アイコンのパスデータ合計は 518KB。4 スキルに同梱すると約 2MB になるため却下した経緯がある（B 案では同梱自体が不要）
- 4 スキルが使う Lucide は 21〜42 種類（和集合 138）、Tailwind クラスは 93〜285 種類。任意値クラスは visual-explainer に 4 種類（19 箇所）

---

## 現在のリポジトリの状態

作業はすべて `eac6a95` までにコミット済み。作業ツリーはクリーン。

### 残っているタスク（EBEX 実起動が必要・私の側では実行不可）

```
skills-contract-conformance  37/40
  6.1 meeting-minutes を EBEX 上で実行し、区間差し込みで日本語版 HTML が最後まで生成されること
  6.3 meeting-minutes-ebe を実行し、ロゴが表示され PowerShell 手順なしで完走すること
  6.4 英語版・レビューの可否確認が 1 項目ずつ提示されること

skill-inline-assets  30/32   ※ 作り直すなら消化不要
  4.1 インライン化が 1 回のスクリプト呼び出しと 1 回の承諾で完了すること
  4.7 確認ダイアログにスクリプト全文・書込予定パス・通信警告が表示されること
```

### 既知の未解決事項（今回の作業とは無関係）

- **`npm run format:check` が 119 ファイルで失敗する。** 変更前からの状態で、`openspec/specs/*.md`・`readme.md`・`scripts/*.mjs`・`components/` などが対象。今回 `.prettierignore` を新規作成して `.claude/skills` を除外した（スキルは配布物であり、HTML のタブ・空白やマークダウン表記を整形で変えないため）が、それ以外は手つかず
- **`script-sandbox` の abort テストがフレーク。** 3 回連続実行すると 1 回目だけ落ちる。子プロセスの kill タイミング依存で、今回の変更とは無関係

---

## 次に着手するときの起点

1. この docs と `openspec/changes/archive/2026-07-25-skill-inline-assets/design.md` を読む
   - design.md には「サンドボックスが appRoot を読めないため共有は不可能」という**前提ごと変わった記述**が残っている点に注意
2. 上記「未解決の問い」（手で叩ける CLI が要るか）を決める
3. 新しい change を propose する。スコープは概ね次のとおり
   - `lib/agent/tools/` にインライン化機能を実装（HTML 文字列処理 + Tailwind v3 プロセス内コンパイル + Lucide 展開）
   - `package.json` に `tailwindcss-v3` エイリアスを追加
   - ツール登録・確認ゲート・spec の追加
   - 4 スキルの SKILL.md をフォールバック 1〜2 行の記述へ差し替え
   - 事前ビルドの遺物を削除（`scripts/build-skill-assets.mjs`、各スキルの `assets/` と `scripts/`、`package.json` の `build:skill-assets`）
   - **canonical spec `skill-bundled-asset-inlining` は事前ビルド方式の要件で埋まっている。**新 change で REMOVED / MODIFIED の delta を書いて置き換えること（「インライン化は同梱スクリプトで行う」「素材の生成と保守」あたりが丸ごと入れ替わる）
   - `bundled-skills-conformance` の「後処理工程の可否確認」も、サイズ増加の実測値の記述が変わる（84KB → 8〜19KB）
4. デザインの統一については別途、`contracts/` にデザインシステム（`design.md` 相当）を置く構想がある。スキル個別のデザインは `base.html` / `model-answer.html` で定義するという住み分け。今回の change には含めない
