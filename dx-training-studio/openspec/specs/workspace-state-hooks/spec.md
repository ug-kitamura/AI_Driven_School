# workspace-state-hooks Specification

## Purpose

DX Training Studio の `Workspace.tsx` 状態管理における hook 責務境界を定義する。`useWorkspaceSelection`・`useSeriesMutations`・`useLessonMutations` による関心分離、および `lib/workspace-selection.ts` による削除後選択ルールを規定する。ユーザー向け挙動は `training-studio-workspace-ui`・`training-studio-course-flow` に従い、本 spec は実装構造の要件を扱う。

## Requirements

### Requirement: 削除後の選択状態は pure function で決定する

シリーズまたはコース削除後の `selectedSeriesId` / `selectedCourseId` / `selectedLessonId` は、`lib/workspace-selection.ts` の pure function（`resolveSelectionAfterDelete`）で決定しなければならない（SHALL）。`setSeries` の updater 内から別の `setState` を呼んではならない（MUST NOT）。決定結果はフォーカス降下規則（下の階層があれば先頭へ降り、無ければその階層で止まる）に従わなければならない（SHALL）。

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
- **THEN** `selectedLessonId` は空文字になり、フォーカスはコースに止まる

#### Scenario: 最後のコースを削除するとシリーズにフォーカスが残る

- **WHEN** ユーザーがシリーズ内の最後のコースを削除する
- **THEN** `selectedCourseId` と `selectedLessonId` は空文字になる
- **AND** `selectedSeriesId` は当該シリーズのままで、フォーカスはシリーズに止まる

### Requirement: 選択状態は useWorkspaceSelection hook に集約する

`selectedSeriesId`・`selectedCourseId`・`selectedLessonId`・派生 `selectedSeries` / `selectedCourse` / `selectedLesson`・`selectSeries` / `selectCourse` / `selectLesson` は `useWorkspaceSelection` hook に集約しなければならない（SHALL）。

選択操作は**フォーカス降下規則**に従わなければならない（SHALL）: 下の階層が存在すればその先頭へ降り、存在しなければその階層で止まる。`selectSeries` は当該シリーズの最初のコース（さらにその最初のレッスン）を自動選択しなければならない（SHALL）。`selectCourse` は当該コースの最初のレッスンを自動選択しなければならない（SHALL）。

フォーカス階層は `selectedSeriesId` / `selectedCourseId` / `selectedLessonId` の**最深の非空フィールドから導出**しなければならない（SHALL）。フォーカス階層を表す判別フィールドを別に保持してはならない（MUST NOT）——下の階層が空でないのに上で止まる状態は降下規則により存在しないため、判別フィールドは状態との不整合を生むだけになる。

#### Scenario: コース選択で先頭レッスンが選ばれる

- **WHEN** ユーザーがレッスンを含むコースを選択する
- **THEN** 当該コースの最初のレッスン ID が `selectedLessonId` になる

#### Scenario: レッスンなしコース選択

- **WHEN** ユーザーがレッスン 0 件のコースを選択する
- **THEN** `selectedLessonId` は空文字になり、フォーカスはコースになる

#### Scenario: シリーズ選択で先頭コースの先頭レッスンまで降りる

- **WHEN** ユーザーがコースとレッスンを含むシリーズを選択する
- **THEN** 当該シリーズの最初のコース ID が `selectedCourseId` になる
- **AND** そのコースの最初のレッスン ID が `selectedLessonId` になる

#### Scenario: コースなしシリーズ選択

- **WHEN** ユーザーがコース 0 件のシリーズを選択する
- **THEN** `selectedCourseId` と `selectedLessonId` は空文字になり、フォーカスはシリーズになる

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

### Requirement: 保存済み選択の後方互換

`localStorage` に保存された選択状態が `seriesId` を持たない旧形式（`{ courseId, lessonId }`）であっても、読み込みが失敗してはならない（MUST NOT）。旧形式を読んだ場合は `courseId` から所属シリーズを逆引きして `seriesId` を補完しなければならない（SHALL）。逆引きできない場合はフォールバックの選択を使わなければならない（SHALL）。

#### Scenario: 旧形式の選択を読み込む

- **WHEN** `localStorage` に `{ courseId, lessonId }` のみが保存されている状態で起動する
- **THEN** エラーにならず、`courseId` の所属シリーズが `selectedSeriesId` に補完される

#### Scenario: 逆引きできない旧形式

- **WHEN** 保存された `courseId` が現在の `contents/` に存在しない
- **THEN** フォールバックの選択が使われる
