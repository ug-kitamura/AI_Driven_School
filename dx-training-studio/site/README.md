# DX Training Mandala（公開サイト）

`contents/` の原稿を受講者向けの静的サイトに変換して公開する。Nextra 4（Next.js 16 / React 19）＋ React Flow。

Studio（`../`）とは独立した npm プロジェクトで、正本 `../contents` と `../images` を**読み取るだけ**。

## 使い方

```bash
npm install
npm run dev     # 変換 → 開発サーバー（http://localhost:3002）
npm run build   # 変換 → 静的 export（out/ に出る）＋ 検索インデックス生成
npm run start   # out/ をローカル配信して確認（http://localhost:3002）
npm run test    # 変換・曼陀羅グラフのテスト
```

**`start.bat` をダブルクリックすれば「ビルド → 開発サーバー」が一発で走る。** 検索インデックスはビルドでしか作られないため、この順序で起動すると開発サーバーでも検索が使える（→ 検索）。

`npm run build:content` だけを単体で実行すれば、変換（`content/` と `public/images/` の生成）のみ走る。

**ポート**: このサイトは **3002**。同時に立ち上げる別アプリは EBEX が 3000、Studio が 3001。

## 検索

全文検索は [Pagefind](https://pagefind.app/) のインデックスを使う。インデックスは **`npm run build` の postbuild で生成される**。

| 出力先              | 用途                                                   |
| ------------------- | ------------------------------------------------------ |
| `public/_pagefind/` | 開発サーバー（`npm run dev`）が配信する                |
| `out/_pagefind/`    | 静的配信・デプロイ（`npm run start` / Pages / Vercel） |

- **ビルドを一度も走らせていないと検索はエラーになる**。`npm run dev` だけで起動した場合はインデックスが存在しない
- **開発サーバーの検索結果は直近ビルド時点のスナップショット**。原稿を直しても、再ビルドするまで検索結果には反映されない（本文表示のほうは dev が変換をやり直すので最新になる）
- ショートカットは Nextra 標準の `Ctrl+K` / `Cmd+K`
- インデックスは生成物なので git 追跡対象外

## 生成物

変換スクリプト（`scripts/build-content.mts`）が毎回作り直すため、**すべて git 追跡対象外**。

| 生成物                   | 中身                                                   |
| ------------------------ | ------------------------------------------------------ |
| `content/**/*.md`        | レッスン本文（日本語＝ルート、英語＝`en/` サブツリー） |
| `content/**/index.mdx`   | 全体・シリーズ・コースのトップページ                   |
| `content/**/_meta.js`    | サイドバー（slug → 日本語表示名、`order` 順）          |
| `content/site-data.json` | 全階層のメタと曼陀羅グラフ                             |
| `public/images/*`        | 本文とヒーローが参照する正本画像のコピー               |

## 設定（`site.config.json`）

```json
{
  "siteName": "DX Training Mandala",
  "imageSource": "local",
  "repositoryUrl": "https://github.com/ug-kitamura/AI_Driven_School"
}
```

- **`imageSource`**: `local`（正本画像を `public/images/` へコピー）か `blob`。
  **デプロイ先ごとの環境変数ではなくこのファイルで持つ**——GitHub Pages と Vercel で画像の参照先が食い違うと、画像の有無で挙動差が生まれるため。
- **`blob` は未実装**。現在の Blob は `access: "private"` で公開サイトから参照できない。public 化の手順が決まるまでは `local` を使う（選ぶとエラーで停止する）。

## `basePath`（サブパス配信）

GitHub Pages のプロジェクトページ配信ではサブパスになる。環境変数で渡す。

```bash
NEXT_PUBLIC_BASE_PATH=/AI_Driven_School npm run build
```

未設定ならルート配信（Vercel・ローカル）。生の `<img>` には basePath が自動で付かないため、`lib/asset-path.ts` の `assetPath()` を通す。

## デプロイ

ワークフローは3本。**契機が違う**ので混ぜない。Pages と Vercel は同じ v* タグで起動するが、**目的が異なる**（Pages＝社内トライアル用 / Vercel＝ゲーミフィケーションを見据えた理想追求用）ためファイルを分けている。

| ワークフロー                           | 契機                                            | やること                                   |
| --------------------------------------- | ----------------------------------------------- | ------------------------------------------ |
| `dx-training-site-ci.yml`               | `site/` `contents/` `images/` を含む push / PR | 変換 → ビルド → テスト。**デプロイしない** |
| `dx-training-site-release-pages.yml`    | `v*` タグの push                               | GitHub Pages へ配信                        |
| `dx-training-site-release-vercel.yml`   | `v*` タグの push                               | Vercel へ配信                              |

```bash
git tag v0.1.0 && git push origin v0.1.0
```

- タグは **`main` に含まれるコミット**に打つこと。作業ブランチのコミットに打つとワークフローが検証で止める（`git merge-base --is-ancestor`）
- Pages はサブパス配信なので `NEXT_PUBLIC_BASE_PATH=/AI_Driven_School` 付きでビルドし、Vercel は付けずにビルドする。**同じタグ**から2つのワークフローが並列にビルドして配るので、常に同一コミット由来になる
- タグ検証（main に含まれるかの確認）は2ファイルそれぞれに重複して入っている（単純さを優先し、共通化していない）
- リリース番号（タグ名）は `NEXT_PUBLIC_SITE_RELEASE` としてビルドに渡され、**サイドバー最上部**に出る。ローカルビルドでは**何も表示されない**（行も余白も出ない）

### 事前に必要な設定（人が行う）

1. **GitHub Pages**: リポジトリの Settings → Pages → Source を **GitHub Actions** にする。**Pages 配信にはリポジトリが public である必要がある**（Free プラン）。CI と Vercel は private のままでも動く
2. **Vercel**: 公開サイト用のプロジェクトを新規作成し、**git 連携を切る**（連携したままだと push のたびに公開され、「タグでのみ配信」が崩れる）。Studio 本体のプロジェクトとは別にすること
3. **Secrets**: `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` をリポジトリに登録する。**未登録なら Vercel のワークフローはスキップされ、Pages だけでリリースが完結する**（失敗にはならない）

### 注意: Pages は1リポジトリ1サイト

この repo の Pages は `commit-track-tool-report.yml`（comitora レポート）とも共有していたが、**現在は `commit-track-tool-ci.yml` / `commit-track-tool-report.yml` とも GitHub 側で Disable 済み**なので競合しない。再有効化するときは、comitora を手動実行する際に `deploy_pages: false` を選ぶ運用に戻すこと。

### 将来: 専用 public リポ方式へ切り替える場合

「成果物のみを別の public リポへ push する」方式に変える場合、変更は `dx-training-site-release-pages.yml` の冒頭 `env` と `deploy` ジョブに閉じる。**`site/` のコードと `scripts/` の変換処理は変更不要**。

## 正本に必要なもの

変換は **slug が1つでも欠けていると中断する**（URL を決められないため）。

| 階層     | 置き場                                 | 必須   | 任意                                                  |
| -------- | -------------------------------------- | ------ | ----------------------------------------------------- |
| 全体     | `contents/.meta.json`                  | —      | `description` / `description_en`                      |
| シリーズ | `contents/<series>/.meta.json`         | `slug` | `description` / `catch` / `cover` / `*_en`            |
| コース   | `.../<course>/.meta.json`              | `slug` | `description` / `catch` / `target` / `*_en`           |
| レッスン | `.../<lesson>/contents.md` frontmatter | `slug` | `id` / `status` / `description` / `estimated_minutes` |

- **画像**: 本文の `images/<file>` とシリーズの `cover` は、**正本 `../images/<file>` に実体が必要**。無いとビルドが失敗する（参照切れの検出を兼ねる）
- **英語版**: レッスンは同フォルダの `contents.en.md`、メタは同じ `.meta.json` の `*_en` フィールド。無ければ日本語へフォールバックし、未翻訳バッジが出る

## 既知の制約

- **`zod` を 4.3.6 に固定している**（`package.json` の `overrides`）。Nextra 4.6.x は zod 4.4.x と衝突し、`Layout` の `children` 検証で全ページのプリレンダが落ちる（[shuding/nextra#5008](https://github.com/shuding/nextra/issues/5008)）。**上流が修正されたら overrides を外す**——判断は Nextra のリリースノートで #5008 の修正を確認してから
- **ビルドは webpack に固定している**（`package.json` の `--webpack`）。`next.config.mjs` が rehype プラグイン（GitHub アラート）を関数で渡しており、Turbopack はローダー options をシリアライズ可能な値に限るため「does not have serializable options」で落ちる。unified は文字列でのプラグイン指定を受け付けないので、外せるのは上流が対応してから
- **トップページを `content/` の `index.mdx` として生成している**。Next.js は同階層に `[series]` と Nextra の `[[...mdxPath]]` を同居できないため、`app/` 直下に独自ルートを作れない
- ⚠ **テーマの `<Layout>` を動的セグメント配下のレイアウトに置かないこと**（いまは `components/SiteShell.tsx` がルートレイアウトから描いている）。`app/[[...mdxPath]]/layout.tsx` に戻すと、クライアント遷移のたびにレイアウトが作り直されて next-themes の `<script>` が再マウントされ、console エラーが再発する
- **リリース番号はサイドバーの `::before`** で描いている（テーマに差し込み口が無いため）。テーマのクラス名 `.nextra-sidebar` に依存するので、Nextra 更新時に消えることがある
- **曼陀羅のホバートレース**は、現在のコンテンツでは見た目に変化が出ない。全コースが1本の鎖で繋がっており、どのノードから辿っても全ノードが経路に入るため（シリーズが増えて枝分かれすると効く）

## 構成

```
site/
├─ scripts/build-content.mts   変換の入口
│  └─ lib/                     content-source（正本読み取り）/ site-model / emit / images
├─ app/                        ルートレイアウト・グローバル CSS・supergraphic / hero・アイコン
├─ components/                 SiteShell（テーマの Layout）/ ページ / 曼陀羅 / ラベル
├─ lib/                        site-data・locale-path・asset-path・mandala（graph / layout）
└─ __tests__/                  変換・曼陀羅グラフ・Studio ローダーとの突き合わせ
```

`__tests__/content-source.parity.test.mts` は、**site の読み取りロジックが Studio の `lib/contents-loader.ts` とずれていないか**を実際の `contents/` を両方で読んで検証する。走査規則を変えるときは両方を直す。
