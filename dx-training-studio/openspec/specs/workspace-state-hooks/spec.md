# workspace-state-hooks Specification

## Purpose

DX Training Studio の `Workspace.tsx` 状態管理における hook 責務境界を定義する。`useWorkspaceSelection`・`useSeriesMutations`・`useLessonMutations` による関心分離、および `lib/workspace-selection.ts` による削除後選択ルールを規定する。ユーザー向け挙動は `training-studio-workspace-ui`・`training-studio-course-flow` に従い、本 spec は実装構造の要件を扱う。

## Requirements

### Requirement: 削除後の選択状態は pure function で決定する

シリーズまたはコース削除後の `selectedCourseId` / `selectedLessonId` は、`lib/workspace-selection.ts` の pure function（`resolveSelectionAfterDelete`）で決定しなければならない（SHALL）。`setSeries` の updater 内から別の `setState` を呼んではならない（MUST NOT）。

#### Scenario: 選択中シリーズ削除後に先頭コースへフォールバック

- **WHEN** ユーザーが選択中コースを含むシリーズを削除する
- **THEN** 残存 series から最初のコースが選択される
- **AND** 当該コースの最初のレッスンが選択される（存在する場合）

#### Scenario: 選択中コース削除後に先頭コースへフォールバック

- **WHEN** ユーザーが現在選択中のコースを削除する
- **THEN** 残存 series から最初のコースが選択される
- **AND** 当該コースの最初のレッスンが選択される（存在する場合）

#### Scenario: 非選択コース削除では選択を維持

- **WHEN** ユーザーが選択中でないコースを削除する
- **THEN** `selectedCourseId` と `selectedLessonId` は変更されない

#### Scenario: レッスン削除で選択中レッスンが消えた場合

- **WHEN** ユーザーが選択中のレッスンを削除する
- **THEN** `selectedLessonId` は空文字になる

### Requirement: 選択状態は useWorkspaceSelection hook に集約する

`selectedCourseId`・`selectedLessonId`・派生 `selectedCourse` / `selectedLesson`・`selectCourse` / `selectLesson` は `useWorkspaceSelection` hook に集約しなければならない（SHALL）。`selectCourse` は当該コースの最初のレッスンを自動選択しなければならない（SHALL）。

#### Scenario: コース選択で先頭レッスンが選ばれる

- **WHEN** ユーザーがレッスンを含むコースを選択する
- **THEN** 当該コースの最初のレッスン ID が `selectedLessonId` になる

#### Scenario: レッスンなしコース選択

- **WHEN** ユーザーがレッスン 0 件のコースを選択する
- **THEN** `selectedLessonId` は空文字になる

### Requirement: シリーズ/コース CRUD は useSeriesMutations hook に集約する

シリーズ/コースの追加・削除・並び替え・メタ更新（`addSeries`・`deleteSeries`・`addCourse`・`deleteCourse`・`reorderSeries`・`reorderCourses`・`updateCourseMeta`・`updateSeriesName`）は `useSeriesMutations` hook に集約しなければならない（SHALL）。ドメイン変換は既存 `lib/course-flow.ts` を用いなければならない（SHALL）。

#### Scenario: deleteSeries が updater 内 setState しない

- **WHEN** 開発者が `deleteSeries` の実装を確認する
- **THEN** `setSeries` updater 内に `setSelectedCourseId` 等の呼び出しがない
- **AND** series 更新と selection 更新は同一ハンドラ内の別々の setState 呼び出しである

### Requirement: レッスン CRUD は useLessonMutations hook に集約する

レッスンの追加・削除・並び替え・本文/メタ/ステータス更新は `useLessonMutations` hook に集約しなければならない（SHALL）。本文/メタ更新は `lib/lesson-frontmatter.ts` の関数を用いなければならない（SHALL）。

#### Scenario: レッスン追加後に新レッスンが選択される

- **WHEN** ユーザーがコースにレッスンを追加する
- **THEN** 新規レッスン ID が `selectedLessonId` になる

### Requirement: 既存のユーザー向け挙動を維持する

本変更は内部構造のリファクタであり、4 ペイン構成・選択フロー・CRUD 操作の結果は変更前と同等でなければならない（SHALL）。

#### Scenario: リファクタ後も Pane1 コース選択が動作する

- **WHEN** ユーザーが Pane1 でコースをクリックする
- **THEN** Pane2 に当該コースのレッスン一覧が表示される

#### Scenario: リファクタ後もレッスン編集が動作する

- **WHEN** ユーザーが Pane3 でレッスン本文を編集する
- **THEN** セッション内の `series` state が更新される
