# ai-contracts Specification

## Purpose

ランタイム AI 向け規則 Markdown（`contracts/`）の配置、社内コンテキスト整形契約、画像 slot 契約の自己完結化とドキュメント参照先を定義する。
## Requirements
### Requirement: contracts フォルダで AI 規則を集約する

`dx-training-studio/contracts/` ディレクトリを作成し、ランタイム AI 向け規則 Markdown を配置しなければならない（SHALL）。`docs/` 内の grill-me・設計記録とは分離しなければならない（SHALL）。

#### Scenario: contracts フォルダが存在する

- **WHEN** リポジトリをクローンする
- **THEN** `contracts/` ディレクトリが存在する

### Requirement: 社内コンテキスト整形契約

`contracts/context-format-contract.md` を作成し、AI 整形 API 向けの規則を自己完結で記載しなければならない（SHALL）。少なくとも次を含めなければならない（SHALL）: 原文にない事実・手順・URL を追加しないこと、Markdown 出力、**title** の生成、**tags 1〜3 個（必須）** の提案、原文から取得できる場合のみ **source_last_updated_at**（`YYYY-MM-DD`）の抽出、既存タグリストが渡された場合は既存タグを優先すること。出力 JSON スキーマは `{"title":"...","body":"...","suggestedTags":["..."],"source_last_updated_at":"YYYY-MM-DD"|null}` でなければならない（SHALL）。

#### Scenario: 契約が創作禁止を規定する

- **WHEN** 開発者が `contracts/context-format-contract.md` を読む
- **THEN** 原文にない内容の追加禁止が明記されている

#### Scenario: 契約が拡張 JSON スキーマを規定する

- **WHEN** 開発者が契約の出力形式セクションを読む
- **THEN** `title` と `source_last_updated_at` が含まれる
- **AND** `suggestedTags` は 1〜3 個必須と明記されている

### Requirement: 画像 slot 契約の移行と自己完結化

`docs/image-slot-contract.md` を `contracts/image-slot-contract.md` に移行しなければならない（SHALL）。移行後、リポジトリ外のスキル・ファイル（`creating-visual-explainers`、`model-answer.html` 等）への参照を削除し、生成品質規則を契約ファイル内に自己完結で記載しなければならない（SHALL）。`CLAUDE.md` および `readme.md` のリンクを `contracts/` に更新しなければならない（SHALL）。

#### Scenario: 外部スキル参照がない

- **WHEN** `contracts/image-slot-contract.md` の「生成品質」セクションを読む
- **THEN** リポジトリ外パスへの参照が含まれない
- **AND** グラフィック語彙・配色・図内/図外テキスト規則が本文に記載されている

#### Scenario: 旧パスへの参照が更新される

- **WHEN** `CLAUDE.md` を読む
- **THEN** 画像契約へのリンクが `contracts/image-slot-contract.md` を指す

### Requirement: 翻訳契約

`contracts/translation-contract.md` に、日本語正本 → 英語派生の翻訳規則を自己完結の Markdown で置かなければならない（SHALL）。最低限含める内容: **英訳するもの**（本文・画像プロンプトコメント・GitHub アラートの中身・コード内のコメント文）、**変えないもの**（URL・画像などのパス・ファイル名・コード本体・コマンド名・Markdown 構造）、**迷ったときの作法**（訳さず `<!-- 訳注: … -->` で執筆者向けコメントを残す）、**`author` / `author_en` に触れないこと**、**トーン**（教材らしい平易な英語）、**名前の規則**（シリーズ名・コース名は Title Case で階層語 Series / Course を含め、レッスン名は見出しと同じ Sentence case。いずれも半角 36 字以内で、超えるときは語の短縮で収め、短縮した名前は報告する）、**用語集**（固有名詞・訳語の統一。運用で育てる。追加は人が行う）。

この契約は Studio の翻訳 API（`studio-translation` capability）と翻訳スキルの両方が読む SSoT でなければならない（SHALL）——スキル側に規則の複製を持たせてはならない（SHALL NOT）。契約の更新は人が行い、実行スキルが書き換えてはならない（MUST NOT）。

#### Scenario: 契約が存在し規則を含む

- **WHEN** `contracts/translation-contract.md` を開く
- **THEN** 英訳する/変えないの規則・訳注の作法・名前の規則（形式と 36 字の上限）・用語集の節が含まれている

#### Scenario: 翻訳 API が契約を注入する

- **WHEN** Studio の翻訳 API を実行する
- **THEN** プロンプトに契約の全文が含まれている

#### Scenario: 名前の規則が Studio の翻訳にも効く

- **WHEN** Studio のメタビューから「原文から翻訳」でコース名を翻訳する
- **THEN** 生成される `name_en` は Title Case で「… Course」の形式になり、36 字を超えない

#### Scenario: レッスン名は見出しと同じ大文字小文字にする

- **WHEN** レッスンの `name_en` を翻訳する
- **THEN** 先頭のみ大文字の Sentence case になり、`Series` / `Course` の階層語は付かない

