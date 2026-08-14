# DX Training Mandala（公開サイト）

`contents/` の原稿を受講者向けの静的サイトに変換して公開する。Nextra 4（Next.js 16 / React 19）＋ React Flow。

Studio（`../`）とは独立した npm プロジェクトで、正本 `../contents` と `../images` を**読み取るだけ**。

## 使い方

```bash
npm install
npm run dev     # 変換 → 開発サーバー
npm run build   # 変換 → 静的 export（out/ に出る）
npm run start   # out/ をローカル配信して確認
npm run test    # 変換・曼陀羅グラフのテスト
```

`npm run build:content` だけを単体で実行すれば、変換（`content/` と `public/images/` の生成）のみ走る。

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

ワークフローは2本。**契機が違う**ので混ぜない。

| ワークフロー                   | 契機                                           | やること                                   |
| ------------------------------ | ---------------------------------------------- | ------------------------------------------ |
| `dx-training-site-ci.yml`      | `site/` `contents/` `images/` を含む push / PR | 変換 → ビルド → テスト。**デプロイしない** |
| `dx-training-site-release.yml` | `v*` タグの push                               | Pages と Vercel へ配信                     |

```bash
git tag v0.1.0 && git push origin v0.1.0
```

- タグは **`main` に含まれるコミット**に打つこと。作業ブランチのコミットに打つとワークフローが検証で止める（`git merge-base --is-ancestor`）
- Pages はサブパス配信なので `NEXT_PUBLIC_BASE_PATH=/AI_Driven_School` 付きでビルドし、Vercel は付けずにビルドする。同じコミットから2回ビルドして配る
- リリース番号（タグ名）は `NEXT_PUBLIC_SITE_RELEASE` としてビルドに渡され、フッターに出る。ローカルビルドでは `dev` になる

### 事前に必要な設定（人が行う）

1. **GitHub Pages**: リポジトリの Settings → Pages → Source を **GitHub Actions** にする。**Pages 配信にはリポジトリが public である必要がある**（Free プラン）。CI と Vercel は private のままでも動く
2. **Vercel**: 公開サイト用のプロジェクトを新規作成し、**git 連携を切る**（連携したままだと push のたびに公開され、「タグでのみ配信」が崩れる）。Studio 本体のプロジェクトとは別にすること
3. **Secrets**: `VERCEL_TOKEN` / `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` をリポジトリに登録する。**未登録なら Vercel のジョブはスキップされ、Pages だけでリリースが完結する**（失敗にはならない）

### 注意: Pages は1リポジトリ1サイト

この repo の Pages は `commit-track-tool-report.yml`（comitora レポート）も使う。**両方を出すと互いに丸ごと上書きする**。当面は comitora を手動実行する際に `deploy_pages: false` を選ぶ運用で回避する。

### 将来: 専用 public リポ方式へ切り替える場合

「成果物のみを別の public リポへ push する」方式に変える場合、変更は `dx-training-site-release.yml` の冒頭 `env` と `deploy-pages` ジョブに閉じる。**`site/` のコードと `scripts/` の変換処理は変更不要**。

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
- **トップページを `content/` の `index.mdx` として生成している**。Next.js は同階層に `[series]` と Nextra の `[[...mdxPath]]` を同居できないため、`app/` 直下に独自ルートを作れない
- **曼陀羅のホバートレース**は、現在のコンテンツでは見た目に変化が出ない。全コースが1本の鎖で繋がっており、どのノードから辿っても全ノードが経路に入るため（シリーズが増えて枝分かれすると効く）

## 構成

```
site/
├─ scripts/build-content.mts   変換の入口
│  └─ lib/                     content-source（正本読み取り）/ site-model / emit / images
├─ app/                        layout・Nextra カタチオール・アイコン
├─ components/                 ページ / 曼陀羅 / パンくず / バッジ
├─ lib/                        site-data・locale-path・asset-path・mandala（graph / layout）
└─ __tests__/                  変換・曼陀羅グラフ・Studio ローダーとの突き合わせ
```

`__tests__/content-source.parity.test.mts` は、**site の読み取りロジックが Studio の `lib/contents-loader.ts` とずれていないか**を実際の `contents/` を両方で読んで検証する。走査規則を変えるときは両方を直す。
