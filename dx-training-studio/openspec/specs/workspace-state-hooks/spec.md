# workspace-state-hooks Specification

## Purpose

DX Training Studio の `Workspace.tsx` 状態管理における hook 責務境界を定義する。`useWorkspaceSelection`・`useSeriesMutations`・`useLessonMutations` による関心分離、および `lib/workspace-selection.ts` による削除後選択ルールを規定する。ユーザー向け挙動は `training-studio-workspace-ui`・`training-studio-course-flow` に従い、本 spec は実装構造の要件を扱う。
## Requirements
### Requirement: 削除後の選択状態は pure function で決定する

シリーズまたはコース削除後の `selectedSeriesId` / `selectedCourseId` / `selectedLessonId` は、`lib/workspace-selection.ts` の pure function（`resolveSelectionAfterDelete`）で決定しなければならない（SHALL）。`setSeries` の updater 内から別の `setState` を呼んではならない（MUST NOT）。決定結果は**削除された階層の親へフォーカス**しなければならない（SHALL）: 選択中レッスンの削除→親コース、選択中コースの削除→親シリーズ、選択中シリーズの削除→ホーム（全空）。下位階層へ自動で降りてはならない（MUST NOT）。

#### Scenario: 選択中シリーズ削除後はホームになる

- **WHEN** ユーザーが選択中コースを含むシリーズを削除する
- **THEN** 選択は全空（ホーム）になる

#### Scenario: 選択中コース削除後は親シリーズにフォーカスが残る

- **WHEN** ユーザーが現在選択中のコースを削除する
- **THEN** `selectedSeriesId` は親シリーズのまま、`selectedCourseId` / `selectedLessonId` は空文字になる

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

選択操作は**クリックした階層で止まらなければならない**（SHALL）: `selectSeries` は当該シリーズを選択し `selectedCourseId` / `selectedLessonId` を空にする（SHALL）。`selectCourse` は当該コース（と所属シリーズ）を選択し `selectedLessonId` を空にする（SHALL）。下位階層を自動選択してはならない（MUST NOT）。

**3 フィールドすべてが空の状態はホーム（全体）選択**を表す（SHALL）。フォーカス階層は `selectedSeriesId` / `selectedCourseId` / `selectedLessonId` の**最深の非空フィールドから導出**しなければならない（SHALL）。フォーカス階層を表す判別フィールドを別に保持してはならない（MUST NOT）。

選択の永続化はホーム選択（全空）も対象としなければならない（SHALL）——保存値が全空なら復元時もホーム選択になる。保存値が存在しない初回起動は、従来どおり先頭のシリーズ・コース・レッスンへのフォールバックを使う（SHALL）。

#### Scenario: コース選択はコースで止まる

- **WHEN** ユーザーがレッスンを含むコースを選択する
- **THEN** `selectedCourseId` は当該コース ID になり、`selectedLessonId` は空文字になる

#### Scenario: シリーズ選択はシリーズで止まる

- **WHEN** ユーザーがコースとレッスンを含むシリーズを選択する
- **THEN** `selectedSeriesId` は当該シリーズ ID になり、`selectedCourseId` / `selectedLessonId` は空文字になる

#### Scenario: ホーム選択

- **WHEN** ユーザーがホーム（全体）を選択する
- **THEN** 3 フィールドすべてが空文字になり、フォーカス階層は「なし（全体）」になる

#### Scenario: ホーム選択が復元される

- **WHEN** ホーム選択の状態で保存された選択を次回起動時に読み込む
- **THEN** ホーム選択（全空）が復元される

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

