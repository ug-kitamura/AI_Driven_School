# ebex-agent-prompt-caching Specification

## Purpose

Anthropic API の prompt caching を agent loop と子生成呼び出しに適用する契約（ブレークポイント配置・応答内容の不変性・効果観測）。

## Requirements

### Requirement: agent loop リクエストのキャッシュ指定

Anthropic プロバイダで agent loop のターンを実行するとき、システムは Messages API リクエストへ prompt caching の `cache_control` ブレークポイントを付与しなければならない（SHALL）。配置は最大でツール定義の末尾・システムプロンプトの末尾・メッセージ履歴の最新メッセージ末尾の 3 箇所とし、API 上限（4 箇所）を超えてはならない（MUST NOT）。ブレークポイントの付与はプロバイダ層で行い、agent loop・ツール層はキャッシュの有無を意識してはならない（MUST NOT）。キャッシュの有無・ヒット／ミスは応答の意味内容を変えてはならない（MUST NOT）。

#### Scenario: 連続ターンでキャッシュがヒットする

- **WHEN** 同一スキル実行内で agent loop が連続して 2 ターン以上実行される
- **THEN** 2 ターン目以降のリクエストには前ターンと同一 prefix（system・tools・履歴前半）への `cache_control` 指定が含まれ、キャッシュ再利用が可能な形になっている

#### Scenario: ブレークポイントは上限内

- **WHEN** system・tools・長い履歴を含むリクエストが組み立てられる
- **THEN** `cache_control` の指定箇所は合計 4 箇所以下である

#### Scenario: tools が空でも壊れない

- **WHEN** ツール定義なしのリクエスト（子生成呼び出し等）が組み立てられる
- **THEN** ツール定義へのブレークポイントは付与されず、リクエストはエラーにならない

### Requirement: 子生成呼び出しのキャッシュ指定

`generate_and_write` の子 LLM 呼び出しにおいて、システムはプロンプトを「不変 prefix（instruction＋context_paths の内容）」と「可変部（セクション指定・直前生成の末尾抜粋）」に分割し、不変 prefix の末尾に `cache_control` を付与しなければならない（SHALL）。不変 prefix はセクション間・max_tokens 継続間でバイト同一でなければならない（SHALL）。

#### Scenario: セクション間で prefix がヒットする

- **WHEN** `generate_and_write` が複数セクションを順に生成する
- **THEN** 各セクションの子呼び出しの不変 prefix（instruction＋context）は同一であり、2 セクション目以降でキャッシュ再利用が可能な形になっている

#### Scenario: 継続呼び出しでも prefix が同一

- **WHEN** あるセクションの生成が max_tokens で継続呼び出しされる
- **THEN** 継続リクエストの不変 prefix は初回と同一である

### Requirement: キャッシュ効果の観測

システムは Anthropic API 応答の usage から `cache_read_input_tokens` / `cache_creation_input_tokens` を取得し、サーバ側で観測可能（ログ出力等）にしなければならない（SHALL）。取得に失敗してもリクエスト処理を失敗させてはならない（MUST NOT）。

#### Scenario: ヒット状況がログで確認できる

- **WHEN** キャッシュ付きリクエストの応答が届く
- **THEN** cache 読取／作成トークン数がサーバログで確認できる
