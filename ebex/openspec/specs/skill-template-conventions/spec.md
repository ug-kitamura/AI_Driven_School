# skill-template-conventions Specification

## Purpose
スキルテンプレートのプレースホルダー・マーカー・自己完結性に関する規約。軽量モデルでも決定的に埋め込み操作が実行できることを保証する。
## Requirements

### Requirement: 変数プレースホルダーの統一
スキルテンプレート内の短い可変値（タイトル・日付・人名等）は `{{XXX}}` 形式のプレースホルダーで表現しなければならない（MUST）。プレースホルダー名は大文字スネークケースとする。

#### Scenario: 短スロットの置換
- **WHEN** スキルがテンプレートをコピーして短スロットを埋める
- **THEN** `replace_in_file` の `replacements` map による `{{XXX}}` の一括置換のみで完了し、挿入位置の判断を必要としない

### Requirement: 区間マーカーの統一
スキルテンプレート内の可変長ブロック挿入位置は `<!-- XXX_START -->` と `<!-- XXX_END -->` の明示マーカー組で表現しなければならない（MUST）。マーカー名は大文字スネークケース＋ `_START`/`_END` サフィックスとする。

#### Scenario: 可変長ブロックの差し込み
- **WHEN** スキルが議題リスト等の可変長ブロックをテンプレートへ差し込む
- **THEN** `replace_between`（start_marker/end_marker 指定、必要に応じ from_path 併用）のみで完了し、挿入位置の判断を必要としない

#### Scenario: マーカー以外のコメント禁止
- **WHEN** テンプレートファイルをレビューする
- **THEN** HTML コメントは `_START`/`_END` マーカーのみであり、自由記述の説明コメントは存在しない（指示は SKILL.md 側に記載される）

### Requirement: テンプレートの自己完結
スキルテンプレートは外部ファイル参照を持ってはならない（MUST NOT）。CSS は `<style>` タグとしてインライン化し、ロゴ等の小さな画像は base64 data URI で埋め込む。CDN 経由のライブラリ読み込み（Tailwind、Lucide 等）はこの制約の対象外とする。

#### Scenario: CSS の扱い
- **WHEN** テンプレートから HTML を生成する
- **THEN** モデルによる CSS インライン化の操作は発生せず、テンプレートに最初から含まれる `<style>` がそのまま生成物に含まれる

#### Scenario: 生成物の単体配布
- **WHEN** 生成された HTML ファイルを単体で共有する
- **THEN** 同梱ファイル（style.css 等）なしでスタイル・ロゴが正しく表示される

### Requirement: creating-skills への規約収録
creating-skills スキルは、上記のテンプレート設計規約（変数・区間・自己完結）を独立した節として収録しなければならない（MUST）。規約は特定の実行環境（EBEX）に依存しない表現で記述する。

#### Scenario: 新規スキル作成時の参照
- **WHEN** ユーザーが creating-skills を使って穴埋めテンプレートを持つスキルを作成する
- **THEN** 生成されるテンプレートは変数 `{{XXX}}`・区間 `_START`/`_END`・自己完結の規約に準拠する

### Requirement: minutes-maid の規約準拠
minutes-maid スキルの `references/base.html` は本規約に準拠しなければならない（MUST）。CSS は `<style>` インライン済みとし、`<link rel="stylesheet" href="style.css">` および自由記述コメントを含まない。SKILL.md から「スタイルのインライン化」手順を削除する。

#### Scenario: 軽量モデルでの HTML 生成
- **WHEN** 軽量モデル（GPT-5 nano 相当）が minutes-maid の Phase 4 を実行する
- **THEN** CSS に関する操作は一切不要で、生成された HTML は正しいスタイルを持つ

#### Scenario: style.css との同期
- **WHEN** 開発者が references/style.css を変更する
- **THEN** SKILL.md 記載の保守手順に従い base.html の `<style>` にも同内容が反映される
