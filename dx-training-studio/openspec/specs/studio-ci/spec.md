# studio-ci Specification

## Purpose

Studio の継続的検証。何を・どの契機で・どの順で検証するか、および意図的に検証しないものとその理由を定める。デプロイは扱わない。

## Requirements
### Requirement: Studio は pull request で検証される

Studio の変更は、main へ入る前に GitHub Actions で検証されなければならない（SHALL）。ワークフローは `.github/workflows/dx-training-studio-ci.yml` に置く（SHALL）。

発火の契機は `pull_request` と main への `push` の 2 つとする（SHALL）。`push` は必ずブランチを main に絞らなければならない（SHALL）——絞らずに `pull_request` と併用すると、PR が開いているブランチへの push で同じ検証が二重に走る。

デプロイを行ってはならない（SHALL NOT）。必要な権限は `contents: read` のみとする（SHALL）。

#### Scenario: PR で検証が走る

- **WHEN** `dx-training-studio/studio/` 配下を変更した pull request を開く
- **THEN** Studio の CI が発火する

#### Scenario: 二重発火しない

- **WHEN** pull request が開いている作業ブランチへ push する
- **THEN** 発火するのは `pull_request` の 1 回だけで、`push` では発火しない

### Requirement: 検証は型・ビルド・テストの3段で行い、型検査を先に置く

CI は次の 3 つをこの順で実行しなければならない（SHALL）。

1. `npx tsc --noEmit`
2. `npm run build`
3. `npx vitest run`

`tsc --noEmit` を `npm run build` より先に置かなければならない（SHALL）——`next build` の型検査は最初の 1 件しか報告せず、かつ `__tests__` の診断を捨てるため、失敗時に全体像が出る `tsc --noEmit` を先に走らせる。

`npm run build` を省いてはならない（SHALL NOT）——Vercel の本番ビルドが落ちる条件を再現する唯一の段である。

#### Scenario: 型エラーで落ちる

- **WHEN** `__tests__/` 配下に型エラーを含む pull request を開く
- **THEN** `tsc --noEmit` の段で CI が失敗する

#### Scenario: 失敗時に全件が出る

- **WHEN** 型エラーが複数ある状態で CI が失敗する
- **THEN** ログに 1 件だけでなく全件が出力される

### Requirement: 境界を越えて読まれるファイルの変更でも発火する

`paths` フィルタには、Studio 自身に加えて **Studio が境界を越えて読むもの**と **Studio がビルド時に取り込むもの**を含めなければならない（SHALL）。

- `dx-training-studio/studio/**`
- `dx-training-studio/mandala/lib/**` — parity テストが `mandala/lib/site-labels.ts` を読むため
- `dx-training-studio/contents/**` — デモが正本をビルド時に静的ペイロードへ焼き込むため
- ワークフロー自身のファイル

#### Scenario: mandala の語彙変更で Studio の CI が発火する

- **WHEN** `dx-training-studio/mandala/lib/site-labels.ts` だけを変更した pull request を開く
- **THEN** Studio の CI が発火し、parity テストが語彙のずれを検出する

### Requirement: lint と整形検査は当面 CI に含めない

`npm run lint` と `npm run format:check` を CI に含めてはならない（SHALL NOT）——現時点で lint には未修正のエラーが残っており、整形の状態は Windows の CRLF ワーキングツリーでは手元で検証できないため、いずれも初日から red になる恐れがある。

これは恒久的な除外ではない（MAY）。負債を解消し、CI 上で緑になることを確かめたうえで段階的に追加してよい。除外している理由はワークフローのコメントに残さなければならない（SHALL）——理由の書かれていない除外は、次に読む人が「入れ忘れ」と誤読する。

#### Scenario: 除外の理由が読める

- **WHEN** `.github/workflows/dx-training-studio-ci.yml` を読む
- **THEN** lint と整形検査を入れていない理由がコメントとして書かれている
