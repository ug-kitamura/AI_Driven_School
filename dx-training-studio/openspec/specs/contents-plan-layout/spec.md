# contents-plan-layout Specification

## Purpose

トレーニングスキル（`dx-training-plan` / `dx-training-create`）が生む作業ファイルの置き場である `contents-plan/` のディレクトリ規約を定める。`plans/` と `runs/` の役割分担、識別子をフォルダ名が持つ命名原則、run ディレクトリ内のファイル名規約、git 追跡の方針を扱う。特定スキルに属さない横断的な取り決めであり、`training-plan-skill` / `training-create-skill` はここを参照する。レッスン草稿の着地先（`contents/`）は `content-folder-loader` と `training-create-skill` の担当領域。

## Requirements

### Requirement: contents-plan ディレクトリの構成

トレーニングスキルの作業ファイルは `contents-plan/` 配下に置かなければならない（SHALL）。`contents-plan/plans/` には計画書を、`contents-plan/runs/` には1実行分の作業ファイルを置かなければならない（SHALL）。`docs/` 配下および `workspace/` 配下に作業ファイルを新規に出力してはならない（SHALL NOT）。

#### Scenario: 作業ファイルの置き場を確認する
- **WHEN** `contents-plan/` を開く
- **THEN** `plans/` と `runs/` の 2 つのディレクトリが存在する

#### Scenario: docs 配下へ出力しない
- **WHEN** スキルが計画書または設計メモを出力する
- **THEN** 出力先は `contents-plan/` 配下であり、`docs/` 配下には作られない

### Requirement: 識別子はフォルダ名が持つ

`contents-plan/runs/` 配下の 1 実行分は `<yyyymmdd>-<slug>/` 形式のディレクトリでなければならない（SHALL）。ディレクトリ内のファイル名は役割のみを表さなければならず（SHALL）、対象名・範囲・実行回数をファイル名に含めてはならない（SHALL NOT）。同日に同じ対象を再実行する場合は、ファイル名に連番を付けるのではなく別のディレクトリを作らなければならない（SHALL）。

#### Scenario: run ディレクトリの命名
- **WHEN** `dx-training-create` を 2026-08-10 に `onenote-basic` を対象として実行する
- **THEN** `contents-plan/runs/20260810-onenote-basic/` が作られる

#### Scenario: 同日に同じ対象を再実行する
- **WHEN** `contents-plan/runs/20260810-onenote-basic/` が既に存在する状態で同じ対象を再実行する
- **THEN** 既存ディレクトリ内のファイルに連番を付けるのではなく、別の run ディレクトリが作られる
- **AND** 既存の run ディレクトリは変更されない

### Requirement: run ディレクトリ内のファイル名規約

`contents-plan/runs/<run>/` 配下のファイル名は次の 3 種でなければならない（SHALL）: 設計メモは `design-note.md`、レビューはレッスンごとに `review-<レッスン名>.md`、曼陀羅案は `mandala.md`。設計メモを `training-draft.md` のように草稿と紛らわしい名前にしてはならない（SHALL NOT）。

#### Scenario: run の中身を確認する
- **WHEN** コース単位の実行が完了した run ディレクトリを開く
- **THEN** `design-note.md` と `mandala.md` が 1 つずつ存在する
- **AND** 執筆したレッスンの本数分の `review-<レッスン名>.md` が存在する

#### Scenario: 読み手が設計メモを一意に特定できる
- **WHEN** run ディレクトリから設計メモを探す
- **THEN** 範囲や実行回数を考慮せず `design-note.md` を読めばよい

### Requirement: 計画書のファイル名規約

`contents-plan/plans/` 配下の計画書は `<yyyymmdd>-<slug>.md` 形式でなければならない（SHALL）。適切な slug が定まらない移設済みの既存計画書については、日付のみのファイル名を許容する。

#### Scenario: 計画書を出力する
- **WHEN** `dx-training-plan` が 2026-08-10 に `onenote` の計画書を出力する
- **THEN** `contents-plan/plans/20260810-onenote.md` が作られる

### Requirement: git 追跡の方針

`contents-plan/plans/` は git の追跡対象でなければならない（SHALL）。`contents-plan/runs/` は追跡対象から除外しなければならない（SHALL）。`.gitignore` のパターンは先頭スラッシュ付きの anchored 形式（`/contents-plan/runs/`）で記述しなければならない（SHALL）——非 anchored のディレクトリ名は任意の深さの同名ディレクトリにマッチし、Tailwind のソース走査から意図しないディレクトリを除外する事故が過去に発生している。

#### Scenario: 計画書は追跡される
- **WHEN** `contents-plan/plans/` に計画書を追加する
- **THEN** `git status` に未追跡ファイルとして現れる

#### Scenario: run は追跡されない
- **WHEN** `contents-plan/runs/` に設計メモを出力する
- **THEN** `git status` に現れない

#### Scenario: gitignore は anchored で書く
- **WHEN** `.gitignore` の `contents-plan` 関連の行を確認する
- **THEN** `/contents-plan/runs/` と先頭スラッシュ付きで記述されている
