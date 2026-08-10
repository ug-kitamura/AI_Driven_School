# agent-write-contract Specification

## Purpose
TBD - created by archiving change port-ebex-agent-core. Update Purpose after archive.
## Requirements
### Requirement: agent 書込契約の正本

`contracts/agent-write-contract.md` が存在し、agent の書込境界（案件フォルダ + contents/ の 2 ルート）・確認フロー・スキル作者向けの制約と作法を規定する正本でなければならない（SHALL）。ペイン4 agent の system プロンプトおよびスキルは、制約の内容を再掲せず本契約を参照しなければならない（SHALL）。EBEX の契約文書（`ebex-skill-contract.md`）を取り込んではならない（MUST NOT）。

#### Scenario: 契約文書が存在する
- **WHEN** `contracts/agent-write-contract.md` を開く
- **THEN** 書込 2 ルート境界・確認ゲート・スキル作者向け制約が記載されている

#### Scenario: スキルは契約を参照する
- **WHEN** ペイン4 で実行されるスキルが書込制約に言及する
- **THEN** 制約本文の再掲ではなく `contracts/agent-write-contract.md` への参照で行われる

