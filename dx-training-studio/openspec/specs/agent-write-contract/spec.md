# agent-write-contract Specification

## Purpose
TBD - created by archiving change port-ebex-agent-core. Update Purpose after archive.
## Requirements
### Requirement: agent 書込契約の正本

`contracts/agent-write-contract.md` が存在し、agent の書込境界・確認フロー・スキル作者向けの制約と作法を規定する正本でなければならない（SHALL）。書込境界は `contents-plan/`（作業ファイル）と `contents/`（レッスン草稿の着地）の 2 ルートを許可しなければならない（SHALL）。移行期間中は `workspace/` を暫定の 3 つ目のルートとして許可する——これは後続 change `retire-workspace-folder` で削除される。`docs/` への書込を許可してはならない（SHALL NOT）。ペイン4 agent の system プロンプトおよびスキルは、制約の内容を再掲せず本契約を参照しなければならない（SHALL）。EBEX の契約文書（`ebex-skill-contract.md`）を取り込んではならない（MUST NOT）。

契約は中間生成物の置き場を「案件フォルダ」ではなく run ディレクトリ（`contents-plan/runs/<run>/`）として記述しなければならない（SHALL）。

#### Scenario: 契約文書が存在する
- **WHEN** `contracts/agent-write-contract.md` を開く
- **THEN** 書込境界・確認ゲート・スキル作者向け制約が記載されている
- **AND** 許可されるルートとして `contents-plan/` と `contents/` が明記されている

#### Scenario: docs への書込は拒否される
- **WHEN** agent が `docs/` 配下のファイルへ書き込もうとする
- **THEN** ツールがエラーとして拒否する

#### Scenario: 用語に案件フォルダを使わない
- **WHEN** 契約文書の中間生成物の置き場に関する記述を読む
- **THEN** 「案件フォルダ」ではなく run ディレクトリを基準とした記述になっている

#### Scenario: スキルは契約を参照する
- **WHEN** ペイン4 で実行されるスキルが書込制約に言及する
- **THEN** 制約本文の再掲ではなく `contracts/agent-write-contract.md` への参照で行われる

