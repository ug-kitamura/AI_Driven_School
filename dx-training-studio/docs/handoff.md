# 引き継ぎ: dx-training-studio

**次の主線は「レビュー指摘の採否」**（→ 3章）。はじめにシリーズと Git基礎シリーズに未処理のレビューが1本ずつあり、どちらも判定は「リリース見送り」。⚠ **採否は人がやる。**

公開サイト **DX Training Mandala**（`mandala/`）は 2026-08-15 の見た目の詰めとワークフロー整備まで完了した（→ 2章）。実コンテンツで37ページが生成でき、検索・曼陀羅・言語切替が動く。リポジトリは public 化済み。残っているのは**人の作業**（公開の外部設定）だけ。

**完了した作業の経緯は書かない** — 記録は `openspec/changes/archive/<日付>-<change名>/` の `design.md` と `tasks.md` が正本（⚠ ただし追跡外。→ 6.1）。本文書に残すのは**次に必要な知識と未決事項だけ**。

---

## 1. 残っている仕事

```
[次] レビュー指摘の採否                            ← 主線。3章
       未処理のレビューが2本ある。どちらも判定は
       「リリース見送り」。⚠ 採否は人がやる
         ・はじめにシリーズ  blocking 6 / advisory 21
             runs/20260814-review/
         ・Git基礎シリーズ    blocking 6 / advisory 51
             runs/20260813-review/
       blocking の大半は「社内の空欄を埋める」作業で、
       中身が決まれば機械的に終わる

[次] Studio デモの Vercel デプロイ修復              8.6
       change fix-studio-vercel-demo-deploy。コード側は実装済み・
       **preview 未検証**。残るのは人の手が要る2つだけ:
         ・作業ブランチを push して preview を検証する
           ⚠ 緑では不合格。開いてツリーが空でないことと
             画像が出ることまで見る
         ・検証後に Ignored Build Step を元へ戻す
           （preview を通すため一時的に緩めてある）
       ⚠ 直るまで社内デモは兄弟構成移行前のビルドを表示し続ける

       ✅ Vercel 2プロジェクトの Root Directory 更新は完了（2026-08-16）
       ✅ Studio 本体の Ignored Build Step も投入済み
       ✅ Pages 配信は通った（v5.1.0・2026-08-15）
       ✅ site の Vercel git 連携も通った（2026-08-16）

[後] connection-profiles                          会社持ち込みの直前で可。4章

[後] 模範解答の2本目（→ 5章。1本目は昇格済み）
     空欄埋め（社内側の埋め作業フロー。別系統）
     レッスン .meta.json 移行＋4階層メタ編集 UI（2.7）
```


### リポジトリの状態

ブランチは作業の区切りで変わる（⚠ **`git branch --show-current` を信じること**）。数分おきの「勝手コミット」は**ユーザー自身が別ツールで行っていたもの**と判明した（2026-08-16）——謎の自動機構ではないが、作業の区切りで `git log` を見る運用は引き続き無害。

**フォルダ構成は 2026-08-16 に兄弟構成へ移行した**（change `restructure-studio-mandala`）。`dx-training-studio/` は入れ物になり、アプリは `studio/`（旧直下）と `mandala/`（旧 `site/`）、正本（`contents/` `images/` `contents-work/` `local-db/`）と共通（`.claude/` `openspec/` `docs/` `contracts/`）は入れ物直下のまま。構造の要件は spec `project-layout` が正本。起動は入れ物直下の `start-studio(-dev).bat` / `start-mandala(-dev).bat`。

追跡の線引き: **正本画像 `images/*.png` は追跡対象**（公開サイトがローカル参照で配信するため）。staging（`uploaded/` `ai/` `web/` `trash/`）と動画は除外。`mandala/` の生成物（`content/` `public/images/` `public/_pagefind/` `out/` `.next/`）は除外。

---

## 2. 公開サイト（DX Training Mandala）

### 2.1 何ができているか

`contents/` の原稿を受講者向けの静的サイトに変換して公開する仕組み。**37ページ（日英・トップ3階層・レッスン9本）が生成でき、ローカルで通しで閲覧できる**。設計判断の経緯は `docs/grill-me/grill-me-20260814.md` が正本。

| | |
|---|---|
| 置き場 | `mandala/`（Studio と兄弟の独立した npm プロジェクト。正本 `../contents` を**読み取るだけ**） |
| 技術 | Nextra 4（Next.js 16 / React 19）＋ React Flow ＋ dagre ＋ Pagefind。`output: 'export'` の静的サイト |
| 手順書 | **`mandala/README.md` が正本**（起動・検索・設定・デプロイ・既知の制約） |
| テスト | 101件（変換・emit・画像・曼陀羅グラフ・style / Start・Goal 読取・現在地のパス解決とノード解決・リリース情報・Studio ローダーとの突き合わせ）。**型エラーは0件——クリーンを保つこと** |

```bash
start-mandala-dev.bat   # 入れ物直下。ビルド → 開発サーバー（検索を使うならこれ）
start-mandala.bat       # 入れ物直下。ビルド → out/ をローカル配信
cd mandala
npm run dev     # 変換 → 開発サーバー（http://localhost:3002）
npm run build   # 変換 → out/ に静的サイト ＋ 検索インデックス
npm run start   # out/ をローカル配信
```

**ポート**: EBEX=3000 / Studio=3001 / site=3002。

**実装済みの機能**: トップ3階層の自動生成（見出しは「{名前}　～{catch}～」）、レッスンページ（ラベル行＝状態 / 所要時間 / 受講形態、右端に「著者: …」）、Nextra 内蔵パンくず（全体トップとシリーズトップには出さない）、GitHub アラート（`> [!TIP]` 等）、Pagefind 全文検索、**全体曼陀羅**（シリーズ枠・折りたたみ・ゴーストノード・ノードクリック遷移・Start / Goal の文字ノード）、**ナビバーの map アイコンから開く全体曼陀羅モーダル**（現在地を青枠＋ピンで強調。**シリーズを畳んでも集約ノードへ、シリーズトップを開けば枠へ印が移る**）、**シリーズ枠のクリックでシリーズトップへ遷移**、コーストップの「前に受けるコース / 次に受けるコース」、選択言語だけのサイドバー、`/en` ツリー（未翻訳は日本語フォールバック＋バッジ）、supergraphic 帯、サイドバー最上部のリリース番号。**フッターは無い。**

⚠ **シリーズ曼陀羅・ミニ曼陀羅は「機能は保持・ページには出さない」**（2026-08-15 の判断。似た図が複数あると混乱するため全体1つに絞った）。`seriesView` / `courseView` と scope 分岐・テストは**将来の再導入に備えて残す要件**なので、「未使用だから」を理由に消さないこと（`publishing-site-mandala` spec に明文あり）。`courseView` は前後コース章のデータ源として現役。

### 2.2 触るときに知っておくこと

- **変換スクリプトが入口**（`mandala/scripts/build-content.mts`）。正本の走査 → slug 検証 → `content/**` と `content/site-data.json` の生成 → 画像コピー、の順。ページ側は `site-data.json` しか見ない
- **生成物は毎回作り直される**（`content/` `public/images/` `out/`）。**ここを直接編集しても次のビルドで消える**——直すのは `scripts/` か `components/` か正本
- **トップページは `content/**/index.mdx` として生成され、MDX からコンポーネントを呼ぶ**。Next.js は同階層に `[series]` と Nextra の `[[...mdxPath]]` を同居できないため、`app/` 直下に独自ルートを作れない（この制約は動かせない）
- ⚠ **テーマの `<Layout>` を動的セグメント配下のレイアウトに置かないこと。** いまは `components/SiteShell.tsx`（`"use client"`）がルートレイアウトから描いている。**`app/[[...mdxPath]]/layout.tsx` に戻すと console エラーが再発する**——`[[...mdxPath]]` は全ページが同じセグメントの別の値なので、クライアント遷移のたびにレイアウトごと作り直され、next-themes の `<script>` が再マウントされて `Encountered a script tag while rendering React component` と、その巻き添えの `Element type is invalid` を撒く（2026-08-15 に実測・根治）
- **言語別サイドバーは params ではなく `usePathname()` で解決する**（SiteShell）。`getPageMap("/en")` は「ルート pageMap の `en` フォルダの children」と同一なので、サーバーで2回引かずクライアントで導出できる。`usePathname()` はプリレンダ時にも実ルートを返すため、静的 HTML の時点で正しい言語のツリーになる
- **サイドバーの「概要」項目は出さない。** シリーズ・コースの index に `asIndexPage: true` を付けてフォルダ自身をページにしている
- ⚠ **`_meta.js` の `theme` は子の階層へ継承される**（`nextra/dist/client/normalize-pages.js` の `pageThemeContext`）。シリーズでパンくずを切ったぶんは**コース階層で明示的に戻している**——戻さないとコース・レッスンのパンくずまで消える
- ⚠ **dev / build とも `--webpack` が必須**（`package.json` の scripts）。`next.config.mjs` が rehype プラグイン（GitHub アラート）を関数で渡しており、Turbopack はローダー options をシリアライズ可能な値に限るため「does not have serializable options」で落ちる。unified は文字列でのプラグイン指定を受け付けないので逃げ道は webpack だけ
- **リリース番号はサイドバーの `::before`** で描く（テーマに差し込み口が無いため）。値はルートレイアウトが `<body>` の `--dxm-release` に入れる。**タグ由来でないビルドでは変数を置かない**ので `content` が無効になり、擬似要素ごと生成されない＝行も余白も出ない
- **ヒーロー画像は切り抜かない**（`width:100%; height:auto`）。**縦横比がそのまま高さになる**ので、差し替えるときは 3.75:1 前後に揃える
- **検索インデックスはビルドでしか作られない**（Pagefind の postbuild）。`public/_pagefind`（dev 用）と `out/_pagefind`（配信用）の**両方に出すのが要点**——`output: 'export'` では postbuild の時点で `out/` へのコピーが終わっているため
- ⚠ **`--nextra-*` CSS 変数は `17,17,17` 形式のトリプレット。** 色として使うには `rgb(var(--nextra-bg))` と包む。`var(--nextra-bg, #fff)` は無効な指定になる（2026-08-14 に既存バグとして発見・修正済み）
- ⚠ **全ページが単一のキャッチオール route（`app/[[...mdxPath]]`）から生成される。** クライアント chunk は**全ページの和集合**になるので、重いライブラリは静的 import が1箇所でも残ると全ページに載る。**曼陀羅の描画は必ず `components/mandala/LazyMandala.tsx`（`"use client"` ＋ `dynamic(..., { ssr: false })`）を通す**——モーダル側だけを動的 import しても分割されず、レッスンページに React Flow 約 520KB が載った（2026-08-15 実測・現在は 1556KB → 1037KB）。引き換えに全体トップの曼陀羅は静的 HTML に含まれずハイドレーション後に描かれる
- ⚠ **React Flow の色は CSS 変数（`--xy-*`）で与える。** `nodeColor` 等の props はインラインスタイルになり、ダークテーマの stylesheet から**上書きできない**（ミニマップが白いまま残る）。辺と矢印だけは SVG `<marker>` が CSS 変数を引けないため JS の固定色のまま（既知の妥協）
- ⚠ **アイコンは「箱の数字」ではなく「見た目の幅」で揃える。** glyph が箱をどれだけ埋めるかが出所ごとに違う——`GitHubIcon`（nextra）は `viewBox="3 3 18 18"` で余白ゼロの被覆 100%、lucide は `0 0 24 24` で `Map` 75% / `Compass` 83% / `MapPin` 67%。ナビバーは左上のロゴ（`1.1rem` ＝ 見た目 17.6px）を基準に、GitHub は `18`（見た目 18px）、lucide `Map` は `21`（見た目 15.75px）。**同じ `size` を与えると揃わない**（2026-08-15 に「GitHub だけ一回り大きい」として発覚。それ以前のコメントは補正の向きが逆だった）。⚠ **さらに、外接箱を揃えても足りない**——丸い絵（GitHub の猫）と矩形の絵（Map）では、同じ箱でも矩形のほうが大きく見える（直径 d の円と一辺 d の正方形で面積比 4/π ≒ 1.27）。**矩形側は1割強ちいさくする**のが目視で落ち着いた線
- ⚠ **`:is()` の詳細度は引数の最大値を取る。** テーマのダーク上書き `:is(html.dark, .dark) .dxm-node` は (0,2,1) なので、**クラス2つ (0,2,0) では越えられない**。ノードの地色を両テーマで揃えるときは `.dxm-node.dxm-node-X, :is(html.dark, .dark) .dxm-node-X` とセレクタを2本並べる（2026-08-15 に実測で判明）
- ⚠ **React Flow のクリックとパンの機構**（2026-08-15 に実測・ソース確認）:
  - `onNodeClick` を渡すと **全ノードの wrapper が `pointer-events: all`** になる（`hasPointerEvents = isSelectable || isDraggable || onClick || …`）。つまり `hrefById` に ID を足すだけでそのノードは押せる。**一部だけ押せるようにしたいときは wrapper を `pointer-events: none` に落として子で拾う**（子で起きたクリックは bubbling で wrapper の React ハンドラに届く。bubbling は `pointer-events` の影響を受けない）
  - **`.react-flow__pane`（d3-zoom がパンを見る要素）はノードの祖先**。ノードの上で押してもパンは効く。「ノードを押せるようにするとパンできなくなる」は誤り
  - **移動後のクリックは d3-zoom が抑止する** — `dragEnable(view, g.moved)` → `yesdrag` が capture 段の `click` ハンドラを1tick だけ張る（`d3-drag/src/nodrag.js`）。だから「ドラッグしてパン → 離した瞬間に遷移」は起きない。⚠ ただし **`draggable: false` のノードでは React Flow 側の `nodeClickDistance` は効かない**（`useDrag` が `disabled: !isDraggable` で無効）ので、頼っているのは d3-zoom 側だけ
  - **`zIndex: -1` はヒットテストを塞がない**。重なり順の制御にだけ効く（枠 −1 / コース 0 なので、枠の上でもコースノードが優先される）
- ⚠ **絶対配置の基準はパディングボックス**（枠線の内側）。枠線ぶんのズレを戻す必要がある。⚠ **シリーズ枠の枠線は 1.5px 指定だが実効値は 1px**（レイアウト時に丸められる。実測）ので、補正値はノードと同じ 1px
- ⚠ **曼陀羅の CSS は「変種 → 状態」の順に置く。** `.dxm-node-here` のような状態指定を `.dxm-node-compact` / `-collapsed` より前に書くと、同じ詳細度で後勝ちになり**変種側が状態を上書きする**（集約ノードの枠色が「いまここ」の青を潰す形で踏んだ）
- **slug が1つでも欠けると変換が中断する**（URL を決められないため）。エラーメッセージに対象と理由が出る
- **本文が参照する画像の実体が無いとビルドが失敗する**。参照切れの検出を兼ねた仕様。**`cover` は例外**（表示しないので実体チェックもしない）
- **`mandala/__tests__/content-source.parity.test.mts`** が、mandala の読み取りロジックと Studio の `studio/lib/contents-loader.ts` のずれを実 `contents/` で突き合わせる。**走査規則を変えるときは両方を直す**
- ⚠ **mandala は `mandala/` の外の `node_modules`・設定に依存してはいけない。**CI は `mandala/` でしか `npm ci` しないので、外に寄生した瞬間 CI だけが落ちる（ローカルは何でも揃っているので気づけない）。兄弟構成になって親からの設定漏れは構造的に塞がったが、**この2つを「不要そうだから」で消さないこと**（spec `publishing-site-deployment` に明文あり）:
  - `mandala/postcss.config.mjs` — **中身が空なのが正しい**。Next の postcss 設定探索は `find-up` で親方向へ遡るため、親側に設定が生えた瞬間に黙って拾う構造へ戻さないための防御（過去に Studio の `@tailwindcss/postcss` を拾って CI だけが落ちた実績あり）
  - `mandala/__tests__/helpers/studio-alias-hooks.mjs` の `ALLOWED_PACKAGES` — parity テストが Studio 側ソース（`../studio/lib/`）を走らせるとき、**許可した名前だけ** `mandala/node_modules` から解決する。現在は `zod` の1件。⚠ mandala の zod は 4.3.6（nextra#5008 回避で固定）、Studio の実依存は 4.4.3 で**版がずれている**——検証対象は走査規則であって zod の挙動ではない、という前提で受け入れている既知の近似
  - ⚠ 許可リストに無い依存が Studio 側に生えるとテストが落ちる。**それが仕掛けの狙い**なので、落ちたら「許可リストに足す」か「依存を持ち込まない形に直す」かを判断する

### 2.3 デプロイ（コード側は完成・外部設定は未実施）

**Pages と Vercel は役割が違う。同じものを2か所へ配るのではない。**

| | GitHub Pages | Vercel |
|---|---|---|
| 位置づけ | **リリース版**（社内トライアル） | **最新版**（理想追求・実験） |
| 契機 | `v*` タグ（＋確認用の手動） | **`main` へのマージ** |
| 担い手 | GitHub Actions | **Vercel の git 連携** |
| リリース番号 | 出る | 出ない |

⚠ **両者の内容は一致しない。**マージからタグを打つまでの間、Vercel は最新・Pages は前回リリースのまま。**どちらを見ているかで判断が変わる場面では URL を明示すること。**

| ワークフロー | 契機 | やること |
|---|---|---|
| `.github/workflows/dx-training-mandala-ci.yml` | **`main` への push** / PR（`mandala/` `contents/` `images/` を含むもの）/ 手動 | 変換 → ビルド → テスト。**デプロイしない** |
| `.github/workflows/dx-training-site-release-pages.yml` | `v*` タグの push / **手動** | GitHub Pages へ配信（basePath 付き） |
| `.github/workflows/dx-training-site-release-vercel.yml` | **使っていない** | git 連携へ移行済み。逃げ道として残置（UI で disable ＋ タグ契機をコメントアウトの二重停止。使うには Enable と Secrets 登録が要る） |

⚠ **CI の `push` は `main` に絞ってある。外すと同じ push で2回走る**——`pull_request` と同じ paths を見ているため、PR が開いているブランチへの push で両方が発火する。`concurrency` の group は `github.ref` 依存で、push（`refs/heads/<branch>`）と PR（`refs/pull/<n>/merge`）は値が違うので相殺されない（2026-08-15 に実際に2回走って発覚）。作業ブランチは PR の契機で、`main` へのマージは push の契機で拾う。**代償として PR を作る前のブランチ push では CI が回らない。**

**手動トリガー（動作確認用）**は `v*` タグを打たずに配信経路を試すためのもの。リリース番号は `version` 入力で与え、**既定は空＝番号を表示しない**（偽のバージョンを出さないため）。契機ごとの振る舞いは次のとおり。

| | `v*` タグ | 手動 |
|---|---|---|
| main 祖先チェック（ワークフロー側） | する | **しない** |
| リリース番号 | タグ名 | `version` 入力（既定 空） |
| 配信先 | Pages の本番サイト | Pages の本番サイト（プレビューの概念が無い） |

⚠ **作業ブランチからの手動 Pages 実行は成功しない。**ワークフローが main 祖先チェックを飛ばしても、`github-pages` environment の保護が `main` とタグ以外を弾く。この保護は「作業ブランチの内容が社内トライアルサイトに出る」のを防ぐ安全網なので、**"No restriction" にしないこと**（`publishing-site-deployment` spec に明文あり）。

⚠ **作業ブランチの内容を「配信して」確認する手段は無い。**Pages は environment 保護で弾かれ、Vercel は Ignored Build Step で `main` 限定にしてある。確認は**ローカルビルド**（`npm run build` → `npm run start`）か**`main` へマージ**のどちらか。

⚠ **Vercel の Ignored Build Step は `exit 1` = ビルドする / `exit 0` = スキップ**。向きが逆なので**両方の分岐を書く**（`if [ "$VERCEL_GIT_COMMIT_REF" = "main" ]; then exit 1; else exit 0; fi`）。片方だけ書くと `if` 文が 0 を返し、**`main` こそがキャンセルされる**（2026-08-16 に実際に踏んだ）。**同じリポジトリを見ている Vercel プロジェクト全部に要る**（公開サイト・Studio 本体）。設定手順は `mandala/README.md`。

⚠ **`workflow_dispatch` の Run workflow ボタンは、デフォルトブランチのワークフロー定義を見て出る。**手動トリガーを新しく足したときは**一度 `main` にマージするまでボタンが現れない**（`gh workflow run` でも同じ）。マージ後は任意ブランチを選んで起動できる。

⚠ **Pages を通すには設定が2つ要り、順序がある**（Source の有効化 → environment のタグルール）。**手順と失敗時のエラー文言は `mandala/README.md` が正本**——ここには書かない。要点だけ言うと、**environment はワークフローが参照した時点で自動生成されるので「設定画面はあるのに Pages サイトが無い」状態が起きる**。これが誤診の元で、実際に2回続けて踏んだ（2026-08-15 に解決済み）。

⚠ **ワークフローの発火条件（`v*`）と environment の許可パターン（`v*.*.*`）が一致していない。**`v6` や `v0.2` のようなタグを打つと**ビルドは走ってから deploy だけが拒否される**（今日踏んだのと同じ分かりにくい落ち方）。いまの27タグは全て `vX.Y.Z` なので実害は出ていない。**揃えるならワークフロー側を `v*.*.*` に狭めるのが筋**（非セマンティックなタグはそもそも発火しなくなる）。未判断。

✅ **Studio tsconfig の `exclude: ["site"]` は兄弟構成化で不要になり削除した**（2026-08-16）。site が Studio の配下から出たため、型検査が巻き込む経路そのものが消えた（かつては外すと Vercel で落ちた）。

⚠ **2026-08-15 にリリースワークフローを1本から2本へ分割した**（`dx-training-site-release.yml` → `-pages.yml` / `-vercel.yml`）。Pages（社内トライアル用）と Vercel（ゲーミフィケーションを見据えた理想追求用）は**目的が異なる**ため。トリガー（`v*` タグ）は共有し続けるので「同一コミットから両方へ配信する」という前提は変わらない。タグ検証ロジックは単純さを優先して両ファイルに意図的に重複させている（DRY化しない）。spec（`publishing-site-deployment`）の要件は変わっていないため、この分割は通常作業として実施した（OpenSpec change は起こしていない）。

- タグが **main に含まれないと検証で止まる**（`git merge-base --is-ancestor`）。この検証は2ファイルそれぞれに入っている
- `VERCEL_TOKEN` 未登録なら Vercel のワークフローはスキップされ、Pages だけでリリースが完結する（失敗にはならない）
- ✅ **Pages 配信は通った**（2026-08-15・`v5.1.0`）。public 化 → Source を GitHub Actions → environment にタグルール、まで完了（→ 2.6）
- ✅ **Vercel の git 連携も通った**（2026-08-16）。Secrets 3本は**不要になった**（逃げ道のワークフローを使う日にだけ要る）
- ✅ **Vercel 2プロジェクトの Root Directory 更新と Studio 本体への Ignored Build Step は完了**（2026-08-16）。手順は `mandala/README.md`。⚠ ただし Studio 側は Root Directory 変更をきっかけにビルドが落ちるようになった（→ 8.6）
- ⚠ **Pages は1リポジトリ1サイト。** comitora レポート（`commit-track-tool-ci.yml` / `commit-track-tool-report.yml`）を GitHub 側で Disable して競合を外している。**再有効化するなら**、comitora の手動実行時に `deploy_pages: false` を選ぶ運用に戻すこと

### 2.4 人の作業として残っているもの

**サイト側で残っているのは Vercel の設定だけ**（→ 2.3）。Pages 配信は通った。メタの値入れ（`style` / `target` 全5コース）と見た目の目視は完了している。

- `images/web-2562325-2.jpg` — ヒーロー画像の元データ。`mandala/app/hero.jpg` にコピー済みなので**正本 `images/` には不要**。未追跡のまま残っているので消すか判断する
- ⚠ **見た目を変えたら毎回人が目視する。** ブラウザペインで確認できないものが3種ある（→ 7章）: **曼陀羅の辺**（矢印・アニメーション・実線/破線。そもそも描画されない）、**キャンバス基準の位置**（fitView が未適用なので実機と全く違う）、**ドラッグ操作**（枠の上でパンでき、離しても遷移しないこと）
- **Start / Goal は DX入門コースの Start のみ**。**Goal は意図的に未宣言**——AI・Python・GitHub のシリーズが増えるので、いま到達点を確定させない

### 2.5 既知の弱点・仮置き

| 項目 | 状況 |
|---|---|
| **英語は器だけ** | `/en` はビルドされるが中身は全部日本語フォールバック。`contents.en.md` と `.meta.json` の `*_en` は未記入 |
| **`zod` を 4.3.6 に固定している** | Nextra 4.6.x が zod 4.4.x と衝突し全ページのプリレンダが落ちる（[nextra#5008](https://github.com/shuding/nextra/issues/5008)）。**上流修正後に `package.json` の `overrides` を外す** |
| **ビルドを webpack に固定している** | Turbopack はローダー options に関数を渡せず、rehype プラグイン（GitHub アラート）が乗らない。**Nextra か unified が文字列でのプラグイン指定に対応したら `--webpack` を外せる** |
| **テーマ内部の class 名に依存している** | リリース番号は `.nextra-sidebar::before`、**サイドバー幅は `.nextra-sidebar.x\:w-64`**（展開状態だけを狙う。平坦に書くと手動トグルの `x:w-20` まで潰れて畳めなくなる）、Studio の帯は `[data-slot="sidebar-*"]`。テーマ・shadcn の更新で変わりうる。壊れ方は「番号が出ない」「幅が広がらない」「帯が覆われる」で機能影響は無い |
| **supergraphic の `z-index: 40`** | テーマのナビバーが `z-30` である前提の数値。ナビバーの `z-index` が上がると帯がその下に潜る。壊れ方は「帯が隠れる」だが、**クラス名ではなく数値の依存なので更新時に気づきにくい** |
| **supergraphic 帯の固定は `fixed` + 高さ変数** | 帯は `position: fixed` でフローから外し、6px の居場所は `--nextra-navbar-height` を 64 → 70px にして確保（ナビバーの中身の行に `padding-top: 6px`）。⚠ `sticky` に戻すと帯がフローの先頭 6px を占め、ナビバーがスクロール開始直後に 6px ずり上がってから固定される。⚠ 変数を戻して覆いかぶせる形にすると、ヘッダーも本文も 6px 上へ詰まって見える。**6px は帯の `height` と変数の加算分の 2 箇所**。サイドバー・目次・モバイルナビはこの変数を見ているので自動追随する |
| **曼陀羅の辺の色が固定値で、しかも2箇所にある** | SVG の `<marker>` は CSS 変数を引けないため、辺と矢印は `Mandala.tsx` の `EDGE_COLOR`（`#7a8189`）に直値で持つ。**接続点の丸ポチだけは `globals.css` の `--xy-handle-*`** にあるので、**色を変えるときは両方直す**。値は「ライトの地とダークの地に対して同じくらいのコントラストになる明度」（相対輝度 ≒ 0.21 → どちらも約 4:1）から決めており、片方に寄せるともう片方のテーマで沈む。テーマ別に色を変えるなら辺の色分けごと作り直し |
| **全体トップの曼陀羅が静的 HTML に無い** | 遅延境界（`LazyMandala`）に通した副作用で、ハイドレーション後に描かれる。Pagefind の索引語数が 1434 → 1410 に減った（曼陀羅ノードのコース名ぶん。同じ語はシリーズ一覧にもあるので検索性への影響は無い）。初期 JS 519KB 減との引き換え |
| **モーダルの現在地はパス解決に依存** | レッスンページは素の MDX でページ側から現在地を渡せないため `usePathname()` から解く（`lib/current-course.ts`）。**URL 構造（`/{シリーズslug}/{コースslug}/…`）を変えると壊れる** |
| **Blob 画像モードは未実装** | 器（設定値と分岐）だけあり、選ぶとエラーで停止する。現 Blob は `access: "private"` で公開参照できないため、使うなら public 再アップロードが前提 |
| **ローカルの `npm ci` が EPERM で落ちる** | Windows で native モジュールがプロセスに掴まれるため。**CI（ubuntu）では起きない**。ローカルは `npm install` を使う |
| **`cover` フィールドは温存だが未使用** | シリーズトップの画像表示を廃止したため、どのページでも表示しない。将来使うなら表示側から作り直す |

### 2.6 public 化（実施済み・2026-08-15）

**このリポジトリは public。**2026-08-14 の公開前スイープの結果を踏まえて公開に踏み切った。

- **秘密情報はゼロ**。追跡ファイル・git 履歴とも実キーなし（`.env.template` 等はすべてプレースホルダ）。メールアドレスは `example.com` 系のダミーのみ
- ⚠ **勤務先が特定できる状態のまま公開している**: git 履歴の**企業メールのコミット1件**（2026-07-30・`APAC\kau2yk <Yuji.Kitamura@jp.bosch.com>`）と `ebex/.claude/skills/meeting-minutes/SKILL.md` の Bosch の記述は、**履歴 rewrite をしていないので残っている**。承知の上での判断（再提案しない）
- 見送った代替案: 専用 public リポを作り成果物（`out/` の中身）だけを Actions が push する方式。履歴も他プロジェクトも公開せずに済むが、本体を public にしたので不要になった。**必要になったときの差し替え点はワークフロー冒頭の env と deploy ジョブに閉じている**（`mandala/` のコードと変換処理は変更不要）

### 2.7 将来構想（今回スコープ外・記録として）

- ペイン1＋2を統合して EBEX 風ツリーにし、**右クリックのコンテキストメニューから4階層（全体 / シリーズ / コース / レッスン）のメタ編集 UI** を呼ぶ
- そのメタ編集 UI に**英訳ボタン**を付け、`_en` フィールドを AI が自動翻訳する
- **レッスンの frontmatter 廃止 → レッスン用 `.meta.json` 化**は、この UI 改修と**同一 change** で実施する（保存層を一度で正しい形にするため）
- 画像ピッカー（`ImageGrid` 再利用）、セマンティックズーム、進捗リング付きノード（ゲーミフィケーション）

### 2.8 兄弟構成への移行（✅ 完了・2026-08-16）

change `restructure-studio-mandala` で実施済み。`dx-training-studio/` は入れ物になり、アプリは `studio/` と `mandala/`（旧 `site/`）が兄弟、正本とプロジェクト共通は入れ物直下。**構造の要件（兄弟・正本の位置・入れ物に設定を置かない・起動スクリプト4本）は spec `project-layout` が正本**。全体像は入れ物直下の `CLAUDE.md` / `readme.md`。

移行で知っておくこと:

- **Studio の正本参照は `studio/lib/project-root.ts` の `getProjectRoot()`（cwd の親を返す）に一元化した**。`process.cwd()` を直接パス基準に使わないこと——移行時に API route 約20本と `app/page.tsx` の直接参照を全部この関数経由に直した（⚠ 点検の grep には `.tsx` も含めること。page.tsx を見落として「シリーズが空」になった）
- テストで cwd を偽装するときは**フィクスチャルート直下の `studio/` 相当を返す**（`getProjectRoot()` が親を見るため。save-course / save-lesson / images-file のテストが実例）
- npm workspaces は導入しない（hoisting が「宣言していない依存が使える」穴を持ち込むため。検討経緯は archive の design.md）
- 入れ物直下に `package.json` や `node_modules` を置かない・残さない——**残すと studio からのモジュール解決が親へフォールバックして漏れ口が復活する**（移行時に旧 node_modules を削除済み）

---

## 3. 主線: レビュー指摘の採否

**はじめにシリーズの再生成は完了した**（2026-08-14 に `b2eea1c` でコミット。run は `contents-work/runs/20260813-start/`）。Claude Code × Fable 5 で作り直し、trial 版は `runs/20260813-start-trial/` に残っている。

残るのは**レビュー指摘の採否**で、未処理のレビューが**2本**ある。⚠ **採否は人がやる——スキルは直さない。**

| run | 対象 | 判定 |
|---|---|---|
| `runs/20260814-review/` | はじめにシリーズ 2コース3レッスン | 見送り: blocking 6 / advisory 21 |
| `runs/20260813-review/` | Git基礎シリーズ 6レッスン | 見送り: blocking 6 / advisory 51 |

**はじめにシリーズの blocking 6件のうち4件は「社内の空欄を埋める＋ status を done にする」作業**で、中身が決まれば機械的に終わる。残る2件は判断が要る:

- 「AI基礎シリーズ」が実在しない（計画書の正式名は AI完全マスターシリーズ。4箇所とも受講可能な前提で書かれている）
- Teams チャンネル名「DX Tools Training」が仮称のまま本文3箇所に露出（原稿自身がコメントで仮称と宣言している）

⚠ **はじめにシリーズのレビューは模範解答を参照していない**（summary が「`model-answer/` が無いため、コーパスの自己一貫性のみで判定」と明記）。**トンマナは「全体が同じ方向に外れている」ずれを検出できていない**ので、K（トンマナ）の指摘は少なめに出ている可能性がある。Git基礎シリーズのレビューも模範解答の昇格より前に走っており、同じ限界を持つ。

### 再生成で使った決定（次に別シリーズを作るときも同じ）

| | |
|---|---|
| 計画書 | `contents-work/plans/20260805-dx-training.md` |

- **モデルの使い分け**: 原稿は **Claude Code × Fable 5**、画像・軽作業は **Studio ペイン4 × Sonnet 5**。ペイン4 を fable/opus で回すのは費用面から避ける
- 反映済みの改修: 情緒の3段レベル（Lv0=全レッスンの声かけ / Lv1=シリーズ開閉は定型構造 / Lv2=F2F は本文の骨格）、全体を貫く比喩を**すごろく → RPG** へ、禁止事項に**損失フレーム禁止**を追加、画像密度の二層方式（公開ツールは「画面が変わる操作ステップごとに枠」・社内システムは空欄に方針だけ書いて人が差し込む）

### 観測すること（次に別シリーズを作るときに使う）

| 観測対象 | 見かた |
|---|---|
| 明文化した規則が守られたか | レッスン番号の生参照・用語の揺れ・表の不使用・出典の URL 直書き・単純化の明示漏れが減ったか |
| 新しく崩れたものはないか | 明文化を増やしたぶん落ちる項目が出ていないか。落ちたなら「規則が多すぎる」のサイン |
| コース単位への縮小の効き | 1コース ≈ 15分の見積もりが実態と合うか。承認ゲート・レビュー採否に人が付き合えたか |
| run またぎの引き継ぎ | 同一シリーズの2コース目で、用語表とたとえが実際に引き継がれたか |
| 社内コンテキストの3段梯子 | 段1（DB 検索）が届くか。届かないとき段2→段3へ自然に降格するか。`context-outbox.json` が書かれるか |
| 名前確認ゲート | 提示された名前でそのまま進めたか。止めて計画書を直す判断が要ったか |
| 画像コメントの出力保証 | 図を置くと決めた節に必ずコメントが出たか |
| 実在アプリ画面の書き分け | 純再現／注釈付きを書き分けたか |
| 模範解答の効き | トンマナと密度が模範解答に寄ったか。題材が違うのに引きずられていないか |
| 情緒の3段レベル | L01 に目的・ゴール・修了時に得られるものが出たか。声かけが定型文の繰り返しになっていないか |
| 手順型の画像密度 | 画面が変わるステップごとに枠が出たか。社内手順で枚数を勝手に決めていないか |

**レビュー運用は変更不要**（per-lesson 独立・指摘のみ・採否を執筆側がファイルに残す）。

### Git基礎シリーズの blocking（`runs/20260813-review/`）

**残っている判断**（同じく**採否は人がやる**）:

| # | 分類 | 要旨 |
|---|---|---|
| 2 | A: 名前 | 「AIシリーズ」が実在しない（正式名は AI完全マスターシリーズ） |
| 4 | G: 次・前参照 | 「Gitの三大エリア」の「次のコース」参照4箇所が、実際には2つ先のコースの内容を指す |
| 6 | P: 内容品質 | user.name/email の実行指示が設定ルール（空欄）より先にあり、埋め忘れると誤設定が全コミットに残る |

⚠ **#2 は両シリーズに共通する指摘**（AI シリーズの表記）。直すなら一度にやるのが安い。advisory は 51件＋21件が未着手。

---

## 4. connection-profiles（会社持ち込みの直前で可）

決定済みの骨子。実装は未着手。

- 3 プロファイル: **private**（家・Anthropic 直・sonnet/opus）/ **development**（会社無償・gpt-5-nano 等・月 6M ゲートウェイ縛り）/ **enterprise**（会社有償・上位モデル・日次上限）
- 1 接続先 = 1 ファイル（`profiles/`）。モデル別 route・providerParams・モデルプロファイル値を同居。env 1 本で選択。**会社リポに private を置かない**
- ループ上限はモデル別のまま（プロファイル別に締めない）。予算はゲートウェイ任せで、アプリ内の累計トークン会計は実装しない
- LLM SDK は見合わせ。再訪トリガーは (a) 会社 PC で社内ルートのワイヤ形式を Azure OpenAI 純正と照合したとき (b) Gemini 対応で3つ目のワイヤ形式を書く前

---

## 5. 模範解答（1本・2026-08-13 昇格）

`references/model-answer/` に **「Gitの三大エリア」1本**（`contents.md` + 出自を書いた `README.md`）。**0本の状態も正常**（spec で保証済み）なので、無い場合の経路は壊さないこと。

見本価値の中心は、形式の網羅よりも**執筆原則が実物として入っていること**——懸念の先回り、単純化の断り、分からなくてよい範囲の明示、そして**たとえの限界を同じ比喩の中で語る**（「ゲームのセーブには『選ぶ』に当たる段はありません」）。

**この1本に無い要素**: アラート（TIP/CAUTION）・`diff` フェンス・実在アプリ画面のプロンプト・**空欄の記法**。形式の正本は `lesson-template.md` が持つので網羅は不要だが、空欄の書きぶりだけは実例が無い。

⚠ **模範解答はコピーであって参照ではない。** レッスン本体を後から直しても追従しない。**本体に手を入れたら再コピーする**。

### 担わせるもの / 担わせないもの

| 担わせる（規則で書けないもの） | 担わせない（実例から読み取れないもの） |
|---|---|
| **トンマナ** — 文体・語りかけ方・断定の強さ・専門語を出す間合い | **フェーズとゲート**（AI は手順を平気で飛ばす） |
| **密度** — 1節あたりの分量・図と文の比率・たとえの長さ | **出力規約**（パス・`.meta.json`・命名。1本から一般則は導けない） |
| **空欄の書きぶり** — 「答えるべき問い」の具体度 | **制約**（既存を変更しない等。実例には「やらなかったこと」が写らない） |
| マークダウンの運用（太字の当て方・箇条書きの使い分け） | **禁止事項**（負の制約は実物から読み取れない。→ `design-principles.md`） |

**スリム化できるのは `lesson-template.md` の一部だけ。** `SKILL.md` のフェーズ・出力規約・制約は削らない——削ると「飛ばし」が悪化する。

### 昇格基準

**次の4つを全て満たす1本**を昇格させる。

1. 人の手直しが**段落単位で発生していない**（語句の修正だけで済んだ）
2. 社内の空欄が、**中身を知らない人でも何を書けばいいか分かる**粒度になっている
3. 「やってみる」が**学習目標を検証している**（演習をこなすこと自体が到達確認になる）
4. 読み返して**冒頭で詰まらない**（時系列レビューで冒頭に指摘が出ていない）

⚠ **1本目は項目2を判定できなかった**（社内の空欄が無いレッスンのため）。**空欄を含むレッスンが昇格候補になったときが、項目2の初判定**になる。

⚠ **「さらっと眺めるといい感じに見える」現象に注意。** 大量の出力は全部それなりに見える。1本ずつ明示的に判定する。

### 2本目をどうするか

**はじめにシリーズの3レッスンには社内の空欄が実際に入っている**ので、**手順型の候補がここにある**（再生成済みなので中身は最新）。足す価値があるのは、1本目に無い型（手順型・空欄の書きぶりの実例）が必要になったときだけ。**先回りして作らない**——「1本では足りない」と実際に困ってから。

⚠ **ただし昇格基準の項目2（社内の空欄が、中身を知らない人でも何を書けばいいか分かる粒度か）は、レビューの blocking が片付く前には判定できない**——いまの空欄は未記入のままで、レビューがまさにそれを指摘している。

```
references/model-answer/
  contents.md          ← レッスンの contents.md をそのままコピー（frontmatter 込み）
  README.md            ← 出自・昇格日・「本体に追従しない」注意（短く）
```

**本文に注釈を書き込まない**（注釈自体が「レッスンの形」として写る）。

---

## 6. 作法（守らないと事故る）

### 6.1 OpenSpec

- planning home は **`dx-training-studio/`**（リポジトリルートではない）。ルートから叩くと `No OpenSpec changes directory found` / `Unknown item`。⚠ **Bash の cwd はツール呼び出しをまたいで戻ることがある**ので、毎回 `cd` してから叩く
- **`openspec/changes/` は `.gitignore` されている。** アーカイブした artifacts は**このマシンにしか存在しない**。コミットされる設計の記録は **`openspec/specs/` だけ**
- ✅ **`openspec archive <change名> -y` は spec 同期まで自動でやる**（2026-08-13〜14 に計8本で実測）。**手で spec を書かないこと**
- ⚠ **先に手作業で spec を同期してしまうと `openspec archive` が使えなくなる。** delta を再適用しようとして止まる。そうなった場合だけディレクトリ移動でアーカイブする
- ⚠ **`openspec archive` はトランザクショナルではない。** 中断時に「Aborted. No files were changed.」と出るが**嘘**で、処理済みの spec は書き換わっている。中断したら `git status openspec/specs/` で実害を確認する。要件見出しが変わっていなければ再適用は冪等
- ⚠ **spec 同期が成功してもディレクトリ移動が EBUSY で失敗することがある**（2026-08-14 実測）。その場合は `openspec/changes/archive/<yyyy-mm-dd>-<change名>/` へ**手で移動**すれば完了（spec は既に正しい）
- ⚠ **capability を廃止する delta（全要件 REMOVED）は archive が受け付けない** — 「Spec must have at least one requirement」で落ちる。**要件が1つでも残るなら普通に REMOVED できる**ので、廃止前に「その capability の全要件が本当に不要か」を確認する。全廃が必要なら「新 capability を ADDED し、archive 後に旧ディレクトリを削除する」
- ⚠ **要件を削ったら `## Purpose` も見直す。** 同期は Purpose を触らないので、削除済みの機能を説明したまま残る
- ⚠ **複数 change を続けて archive するときは順序に注意。** 後の change の delta は**それを書いた時点の spec** に対して書かれている。先の change が新しい要件を追加すると取りこぼす。**archive 後に横断検索で確認する**
- ⚠ **`## MODIFIED Requirements` は1ファイルに1つだけ。** 複数書くと**最後の1つしか適用されず、残りが黙って落ちる**（2026-08-15 に3件書いて2件取りこぼした）。同じ種別の要件変更は**1つの見出しの下にまとめる**。`ADDED` / `REMOVED` も同様。取りこぼしは archive の出力（`~ 1 modified` 等の件数）と delta の要件数を突き合わせれば気づける
- delta 側の要件見出しは必ず `### Requirement: <名前>`。**要件内の小見出しに level-3 を使わない** — 同期すると `validate --specs` が落ちる
- ⚠ **要件変更を伴わない作業は change にしない。** `validate` は「差分が最低1つ」を要求する。既存要件に成果物を合わせるだけの作業は通常作業として進め、結果を本文書に記録する。要件を捏造して通さないこと
- アーティファクトは日本語で書く

### 6.2 スキルの SSoT 作法

スキルの作成・更新には **`creating-skills` スキルを使う**（SSoT 監査とハードコード・不整合レビューがゲートになっている）。

- `SKILL.md` は 200行が目安・500行が上限。`references/` は各300行以内、100行超なら目次
- **同じ内容を2箇所に書かない。** 特に `SKILL.md` に references の本文を写さない（spec の要件でもある）
- 外部ファイル（`lib/schema.ts` 等）の内容をスキルに写さない。参照先を示す
- **模範解答から読み取れるものは明文化しない**。例外は**負の制約**——良い実例をいくら読んでも「書いてはいけないもの」は復元できないので `design-principles.md` に明文で置く

### 6.3 用語

- **人が後工程で埋める箇所は「空欄」。** 旧称は「穴」。スキルと spec は移行済みだが、**`docs/` の過去記録と run ディレクトリには旧称が残っている**。古い文書で「穴」を見たら「空欄」と読み替える
- ⚠ **「プレースホルダー」を空欄の意味で使わない。** この語は `{{XXX}}` / `<!-- XXX_START -->` の**機械が決定的に埋めるスロット**を指す既存語で、agent の完了ゲートが「残留していたら未完了」と扱う。空欄は残っていて正常なので、**完了判定の意味が正反対**になる

---

## 7. 環境の注意（事故りやすい点）

- ⚠ **誰も `git commit` を叩いていないのにコミットが生まれ、新規ファイルが勝手にステージされる。** **数分おきに発火し、その時点の変更を意味のある単位でまとめて英語メッセージでコミットする**。内容の破壊は起きていないが、**「作業が終わってからまとめてコミットする」運用は成立しない**前提で動くこと。区切りごとに `git log` を見る
- ⚠ **`contents/` の JSON を CLI から触るときは `node -e` で書く。** PowerShell の `Out-File -Encoding utf8` は **BOM を付ける**ため `JSON.parse` が失敗し、**ローダーが「メタ無し」と判断して `id` を再採番し `slug`/`description`/`catch`/`target` を消す**（2026-08-14 に実際に発生・`git checkout` で復旧）
- ⚠ **Studio 実行中は `contents/` 配下が横から書き換わる。** loader が `.meta.json` に `id` を採番し `order` を整理する。ペイン4 での画像挿入も同様。**編集前に外部変更を確認する**
- ⚠ **テストの前に dev サーバーを止める。** ただし `compileCss`（`inline-html-assets.test.ts`）は**止めても全体実行では5秒タイムアウトで落ちる**（単体なら 411ms）。実装の異常ではなくマシン負荷
- ⚠ **`npm run build` の前にも dev サーバーを止める。** 同じ `.next` を使うため、動かしたままだとロックで「A next build still in progress」と出て**古い `out/` のまま**になる。このとき**ビルドは失敗したのに測定だけ進むと誤った結論に至る**ので、ビルド出力の成功行（`✓ Generating static pages (37/37)`）を必ず確認する
- ⚠ **dev サーバーは `content/site-data.json` をプロセス起動時に取り込む。** 正本を書き換えて `npm run build` し直しても、稼働中の dev サーバーには反映されないことがある（2026-08-15 に「Goal が出ない」と誤診しかけた）。**表示が合わないときはサーバーを立て直してから疑う**
- ⚠ **`_meta` ファイルの追加・拡張子変更も dev サーバーの再起動が要る**（2026-08-15 実測）。ページマップは起動時に組まれるので、`_meta.js` → `_meta.tsx` の入れ替えは HMR で拾われず、**コンポーネントの変更だけが反映されて「一部だけ効いている」状態に見える**——実装の異常と誤診しやすい。`npm run build` の出力（`out/` の HTML）で確かめるほうが速い
- ⚠ **ブラウザペインでは React Flow の辺が描画されない。** ノードの実測（ResizeObserver / rAF）が完了するまでノードは `visibility: hidden` で辺も描かれず、**ペイン非表示だと計測が完了しない**。辺が0件・fitView 未適用（`scale(1)` のまま）に見えても実装の異常ではない。同様に **Base UI の Select はポップアップが座標を持たず操作できない**。機構はメモリ `project-browser-pane-verification-limits`
  - **ノード・ミニマップ・DOM 構造・CSS の実測値は取れる**（2026-08-15 に実証）。`javascript_tool` で `getComputedStyle` や `getBoundingClientRect` を読み、`a.click()` でクライアント遷移を起こせば console エラーの有無まで確認できる。**座標クリック（`computer`）は効かないので DOM の `.click()` を使う**
  - ⚠ **ただし「キャンバスに対する位置」は測ってはいけない。** fitView が未適用なので viewport の transform は単位行列のままで、グラフは本来の中央寄せではなく**左上に貼り付いた状態**にある。この状態で「枠の左辺からキャンバス左端まで」を測ると 2px と出るが、実機では fitView が中央へ寄せるので数百 px ある（2026-08-15 に誤った測定値をもとに設計判断をして、実機のスクリーンショットで発覚）。**有効なのはノード同士・ノードと子要素といった相対位置だけ**。判定に `.react-flow__viewport` の transform が単位行列でないことを先に確かめると安全
  - ⚠ **React の dev 専用の警告・エラー全文は本番ビルドでは出ない。** `Element type is invalid` の詳細メッセージなどを追うときは **`npm run dev` で確認する**（`npm run start` の静的配信では出ない）
- **dev サーバーは同一プロジェクトで1台まで**（Next 16）。検証用に立てたら必ず止める（放置 → EBUSY ロック → 起動不能の事故あり）
- **`.gitignore` のパターンは必ず anchored**（`/images/` `/mandala/out/`）。非 anchored だと任意の深さにマッチし、**Tailwind のソース走査から `components/` 配下が丸ごと落ちて UI が崩れる**。変更したら **`.next` を削除する**。機構はメモリ `project-tailwind-gitignore-trap`
- **CRLF + BOM のファイルがある**（`__tests__/hooks/*.test.ts` 等）。LF 前提の文字列置換が黙って空振りするので、複数行の編集は Edit ツールを使う

---

## 8. 実行時に効く既知の事実（再調査不要）

### 8.1 名前と識別子

- **シリーズ名・コース名の出典は計画書「第5章 コース仕様」、レッスン名は「第6章 レッスン仕様」。** `slug`（公開 URL 用）も同じ2章にある。`L05` の ID・`【撮】`『【録】』の印・`☆` は名前に含めない
- **曼陀羅グラフの箱の中だけは短縮表記**（箱幅の都合）。ここから名前を取らない
- **識別子は3層**（計画書 §8.2）: `id`（不変キー・進捗データ用）/ `slug`（公開 URL）/ 表示名（ディレクトリ名）。**slug は表示名と独立なので、リネームしても URL は壊れない**
- **レッスン名に `/` が含まれるものが2本ある**（L13「リポジトリを作る / clone」・L25「ファイル読み書き（CSV / JSON）」）。ディレクトリ名では `_` に置換される。frontmatter の `lesson` は**ディレクトリ名のほう**に合わせる

### 8.2 リネームで何が起きるか（2026-08-13 に実測）

| 対象 | 挙動 |
|---|---|
| `.meta.json` の `id` | **保たれる**（ディレクトリごと移動するため）。進捗データのキーは壊れない |
| frontmatter の `series` / `course` | **ディレクトリ名から導出される**。ずれてもエラーにはならず、読み書きのたびに上書きされる |
| Studio の rename API | シリーズ・コース改名時に**レッスンの frontmatter を同期しない**（`order` の更新のみ）。ディスク上のテキストは古いまま残るので**手で合わせる**——公開サイトは frontmatter を直読みする |
| `contents/.meta.json` の `order` | loader が実体に合わせて整理する。名前が変わると**末尾へ動く**ので、並び順を保ちたければ自分で書き換える |
| 会話履歴 / 画像参照 | **影響なし**（会話は `contents-work/sessions/`、画像参照はレッスンパスを含まない） |

### 8.3 `.meta.json` と `contents/` への書込

- `id` は loader が自動採番して書き戻す。**スキルが `id` を書かないのは正しい**
- `order` には実在するディレクトリだけを書く。後から足したら親の `order` を計画書の順に直す
- ⚠ **ペイン4 の agent は `.meta.json` を書けない**（アプリ管理ファイルとして保護）。ペイン4 経由なら並べ替えは**ペイン1・2 のドラッグで人がやる**。Claude Code なら直接編集できる
- ⚠ **コースメタに項目を足すときは `listCoursesNeedingMetaPersist`（`lib/course-flow.ts`）の比較にも足す。** ここを忘れると「その項目だけ変更」が保存されずに消える（2026-08-14 に `style` 追加で踏んだ）。`is_start` / `is_goal` 追加時（2026-08-15）は比較を `!!a !== !!b` にした——未宣言が「キー無し」と `false` の2通りで来るため
- **`is_start` / `is_goal`**（コース `.meta.json`・省略時 false）は**カリキュラムの入口・到達点の宣言**で、曼陀羅に枠なしの文字ノード `Start` / `Goal` を出す。**制約は一切無い**——前のコースを持つコースでも Start にでき、複数コースが宣言してよい（入口が複数ある構成は正当）。⚠ **`cross_series_prev` / `next` の配列に番兵 ID を混ぜてはいけない**（`stripDanglingCourseLinks` が実在しない ID として黙って消す）。設定は Studio のコースメタ編集モーダルの特殊枠から（`style` と同じく人の作業）
- **`Course` 型に必須フィールドを足さない。** `style` と同じ `optional` にする——必須にすると全テストフィクスチャが型エラーになる
- ⚠ **shadcn base（Base UI）の `Select` はラベル解決に Root の `items` を渡す。** `SelectItem` の children だけではトリガーに**生の value** が出る（`LessonMetaPanel` が正しい流儀）

**`contents/` の書込規約**（`contents-write-gate` で確定。ファイルは階層を問わず自由、予約名だけ拒否）:

| 対象 | 判定 |
|---|---|
| `session.json` / `.meta.json` | **拒否**（アプリが管理。id・表示順が壊れる） |
| `contents-work/sessions/` 配下（どの名前でも） | **拒否**（agent 自身の会話履歴。書くと実行中の会話が壊れる） |
| `contents.md`（レッスン階層） | 許可 |
| `contents.md`（それ以外の階層） | **拒否**（偽の本文になる） |
| その他のファイル（どの階層でも） | 許可 |
| 新シリーズ・新コース・新レッスンのフォルダ | 許可。ただし**実行前に確認ダイアログ**（3階層まとめて提示） |
| レッスンより深いフォルダ / `_` `.` 始まり | 許可（確認なし） |

⚠ **この規約の当初案「Zod スキーマ検査 + 構造分類 A/B/C + 近似照合」は全部破棄した。再提案しないこと。**

### 8.4 作業ファイルの置き場

```
contents-work/
├─ plans/<yyyymmdd>-<slug>.md          ← 計画書。git 追跡
├─ sessions/agent-chat.json            ← ペイン4 の会話（全部で1本）。git 追跡外
│                                         agent は書込禁止（fs-guard がディレクトリ単位で拒否）
└─ runs/<yyyymmdd>-<slug>/             ← create 1実行分。git 追跡外
    ├─ design-note.md
    ├─ mandala.md                      ← 曼陀羅の図（確定＝実線 / 提案＝破線）を含む
    ├─ context-outbox.json             ← 段2で聞き取った社内データ（登録待ち）
    └─ reviews/<レッスン名>.md          ← レッスンごとのレビュー
```

- **識別子はフォルダ名が持ち、ファイル名は役割だけを表す**
- **サブディレクトリに畳むのはレビューだけ**（レッスン本数に比例して増える唯一の種別）
- `runs/` が**追跡外なのは仕様**。「設計メモが git に無い＝異常」ではない
- ペイン4 の `@` 参照候補は「レッスン本文 + `contents-work/plans/` + 最新3 run」。**読取は古い run も可能**
- 作業フォルダ（相対パスの基準）= **フォーカス中のコンテンツフォルダ**。`contents-work/` は書込許可ルートだが基準ではないので、明示プレフィックスで書く

### 8.5 画像とツール資産の置き場

| 種別 | 置き場 |
|---|---|
| 受講コンテンツの画像 | 正本 `images/<file>`（ペイン4 の画像マネージャ管理下・git 追跡） |
| ツール埋め込み資産（supergraphic・サイトのヒーロー画像） | **各アプリの `app/` 直下＝ファビコンと同居**。`images/` に置かない——**ユーザーが UI から削除できてしまう**ため |

### 8.6 Studio の Vercel デモ配信（触るときに知っておくこと）

Vercel 上の Studio は**社内に見せるための読み取り専用デモ**。要件の正本は spec `studio-demo-deployment`。

**成立の仕組み。** 閲覧に必要なものはランタイムのファイルシステムを使わない。

| | 供給元 |
|---|---|
| ツリー・レッスン本文 | **ビルド時に焼き込み**（`lessonSchema.content` → `contents-loader.ts` → `app/page.tsx` の `initialSeries` → `/` がプリレンダリング） |
| 画像 | Vercel Blob（`lib/image-storage/resolve.ts` の既定 storage モード） |
| 保存・追加・削除・Agent | — （read-only FS で**失敗する。許容された仕様**。編集はローカル起動が担う） |

⚠ **`Include files outside the root directory` は Enabled から動かさないこと。**正本 `contents/` は Root Directory（`dx-training-studio/studio`）の**外**にあるので、無効にするとビルド時に正本が見えなくなる。ところが `loadContentsFolder` と `reconcileOrderFiles` は正本が無いと**黙って空を返す**ため、**ビルド緑・デプロイ成功・中身が空のデモ**という気づけない壊れ方をする。兄弟構成移行前はこの設定が無効でも動いていたが、それは当時 `contents/` が Root Directory の**内側**にあったからで、今は成立しない。

⚠ **`next.config.ts` の `outputFileTracingRoot` を素朴に `__dirname` へ戻さないこと。**include-outside が ON だと Vercel はリポジトリ丸ごとを `/vercel/path0` に置き、`@vercel/next` は「Next アプリのルート == `path0`」と決めつけて `.next` と `.nft.json` を re-root する。ズレると `ENOENT: .../.next/routes-manifest-deterministic.json` で落ちる（Next 16 + Turbopack の噛み合わせ。上流の同一症状: resend/react-email#3557）。`turbopack.root` は逆に `studio/` のまま動かさない——リポジトリルートへ向けると `ebex/` `mandala/` `minutes-maid/` の lockfile を巻き込む。

**番人がいる。** `studio/scripts/check-vercel-build-root.mjs` が `npm run build` の前段で、①正本がビルド時に見えるか ②ソースルートの前提が崩れていないか を検査して、崩れていればビルドを止める。ローカルでは何もしない（正本が空でも起動できる挙動は維持）。**上の2つの罠に落ちたら、解読しにくい `ENOENT` ではなくこの番人のメッセージが出る。**

---

## 9. 未決事項

| 項目 | 状況 |
|---|---|
| **Vercel の設定** | プロジェクト作成と git 連携解除 / Secrets 3本 / 登録後の手動実行で preview URL 確認。**コード側は完成、人の作業が未実施**（2.3）。⚠ 登録までは手動実行しても「スキップして緑」で未検証のまま |
| **タグパターンを揃えるか** | ワークフロー `v*` / environment `v*.*.*` が不一致。`v6` 形式のタグでビルド後に deploy だけ拒否される。**揃えるならワークフロー側を `v*.*.*` に狭める**（2.3）。未判断 |
| **main push での preview 配信（3段構成）を足すか** | feature=確認 / main=リリース確認 / タグ=本番、の3段は今回見送った。Vercel の運用が固まってから判断（2.3） |
| **シリーズ・コース曼陀羅を復活させるか** | 2026-08-15 に「全体1つに絞る」判断で非表示にした（機能は保持）。**全体のバランスを見て再訪する**。復活は `SeriesPage` / `CoursePage` に `<LazyMandala scope={…}>` を書き戻すだけ（→ 2.1） |
| **`zod` 4.3.6 固定を外す時期** | nextra#5008 の上流修正待ち（2.5） |
| **site を Turbopack に戻す時期** | rehype プラグインを関数で渡している間は不可。Nextra か unified が文字列指定に対応したら `--webpack` を外す（2.5） |
| **アラートの見出しが英語** | `rehype-github-alerts` の既定が `Important` / `Tip` 等。Studio のプレビューと同じなので**揃ってはいる**が、受講者向けに和訳するなら両方の設定を同時に変える |
| **Goal をいつ宣言するか** | いまは Start のみ（DX入門コース）。**シリーズが出揃うまで到達点は決めない**という判断（2026-08-15）。Goal 未宣言でも曼陀羅は成立する |
| 昇格基準の項目2 / 模範解答2本目 | どちらも**レビューの blocking を片付けてから**（→ 3章・5章）。項目2 は社内の空欄が未記入のうちは判定できず、2本目の候補（手順型・空欄の実例）も同じレッスン群にある |
| AI・Python シリーズの表示名 | **原稿作成時に再検討**。「完全マスター」表記は Git で改めたのと同じ論点（AI は1レッスン15分）。**GitHub は決定済み: GitHub基礎シリーズ**。slug は表示名と独立なのでコストはディレクトリのリネームだけ |
| 計画書の曼陀羅 ASCII 図の枠ズレ | シリーズ名が枠幅に合っていない。**名前が全部決まった時点で図ごと引き直す**のが安い。中身（辺の構造）は正しい |

### 掃除の候補（急がない・実害なし）

**Studio の既知の失敗2件**（これ以外は green。2026-08-15 時点で **829 passed** / site は別途 **101 passed**）:

- `extract-markdown-block` — 全廃済みの `session.json` を読むため復活しない。**フィクスチャ化が要る**
- `compileCss` — 全体実行では5秒タイムアウトで落ちる（**dev を止めても落ちる**。単体なら 411ms ＝純粋にマシン負荷）

**型・設定**:

- ✅ **`tsc --noEmit` が site を巻き込む問題は構造ごと解消**（兄弟構成化で `exclude: ["site"]` 自体を削除。→ 2.3）
- テスト側の型エラー8件（`estimatedMinutes` の綴り違い等）——**すべて古くから**。site 側は0件（クリーンを保つこと）

**死んだコード・古い記述**:

- `resolveHeadContent()` — 差分 API が使うのは `lesson-git-diff.ts` の `resolveLessonGitDiff()`。`lesson-head-content.ts` から生きているのは `toRepoRelativePath` と `HeadSource` 型だけ
- 移行スクリプト3本（`migrate-content.ts` / `migrate-lesson-folders.ts` / `migrate-stable-ids.ts`）——実行済みで再実行の余地なし
- `content-folder-loader` spec 前半に `_series-order.json` / `_course.json` / 数値プレフィックスが残る（実装は `.meta.json` の `order`）。直すなら別 change
- `training-create-skill` spec 前半5件が作業記録に読める・`## Purpose` も実態とずれ。**中身は生きているので消さない**
- `agent-file-tools` spec が例に使う `data/workspace.json` は**廃止済み**（→ `lib/workspace-meta.ts`）。要件の意味は**パス解決**なので成立するが、実在しない名前は読み手に不親切。直すなら別 change
- `references/`（模範解答の置き場）が readme のディレクトリ構成に載っていない

**その他**:

- 退避機能が `contents-work/` を保護していない — `toProjectRelative` がフォーカス中の `contents/` 配下しか見ないため、額縁テンプレートが実際に置かれる `contents-work/runs/` では発火しない
- run ディレクトリの日付ずれ — 初回は `20260816-start`（実行日は 08-13）。**再生成では正しくなったが、日付を渡す手当ては入っていないので再発しうる**

---

## 10. 対象外（やらない）

- **空欄埋めスキル（社内側）** — 入口（3段梯子の段2・段3）は決めたが、埋め作業のフロー自体は別系統
- **社内コンテキスト DB の逆向き運用** — スキルは正本に対して**読み取り専用**。段2の聞き取りは `context-outbox.json` に退避し、正規登録は Studio 側の別工程のまま
- **Studio 側の改修**（画像コメント種別の判定、未充足の空欄の一覧表示）。**`lib/ai-image-prompt.ts` の生成品質強化も当面やらない**
- **`dx-training-review` に修正機能を持たせること** — 指摘のみ・採否は人、が設計の芯
- **計画書の再修正**（構成の作り直し。名前だけの限定更新は別）
- **`training-create-skill` spec の要件削除**（9章の該当行を参照）
- **「サイトをビルドして開く」ボタン（Studio）** — `start-mandala-dev.bat` で足りるか見てから
- **Start / Goal を構造から推測すること** — 入次数0 / 出次数0 からの導出は**採らないと決めた**（途中入口・複数入口が正当にありうるため危険）。著者の宣言（`is_start` / `is_goal`）が正本。再提案しないこと
- **Start / Goal をスキル（plan / create）に組み込むこと** — 設定は Studio のモーダルで人が行う（`style` と同じ運用）

---

## 11. 参照すべき正本

| 何 | どこ |
|---|---|
| **公開サイトの手順書**（起動・検索・設定・デプロイ・制約） | **`mandala/README.md`** |
| **公開サイトの設計判断の経緯** | `docs/grill-me/grill-me-20260814.md` |
| 要件の正本（**唯一コミットされる**） | `openspec/specs/` |
| 完了した change の判断と経緯 | `openspec/changes/archive/<日付>-<change名>/`（⚠ 追跡外・このマシンのみ） |
| 2026-08-12 の20課題の決定 | `docs/grill-me/grill-me-20260812.md` |
| agent の書込制約 | `contracts/agent-write-contract.md` |
| 画像スロットの書式 | `contracts/image-slot-contract.md` |
| 執筆の質・レッスンの型・禁止事項 | `.claude/skills/dx-training-create/references/` |
| 質とトンマナの実物（模範解答） | `.claude/skills/dx-training-create/references/model-answer/` |
| レビューの検査項目と手順 | `.claude/skills/dx-training-review/references/` |
| 計画書 | `contents-work/plans/20260805-dx-training.md`（識別子の設計は §8.2） |
| UI 崩れの機構・復旧手順 | メモリ `project-tailwind-gitignore-trap` |
| ブラウザペイン検証の限界 | メモリ `project-browser-pane-verification-limits` |
| 移植の決定ロック | メモリ `project-dx-agent-port` |
