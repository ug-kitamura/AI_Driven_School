"use client";

import { useState, useCallback, useMemo } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { GlobalHeader } from "@/components/workspace/GlobalHeader";
import { SeriesCoursePane } from "@/components/workspace/SeriesCoursePane";
import { LessonListPane } from "@/components/workspace/LessonListPane";
import { MarkdownEditorPane } from "@/components/workspace/MarkdownEditorPane";
import { ImageManagerPane } from "@/components/workspace/ImageManagerPane";
import type { Series, Course, Lesson, ImageAsset } from "@/lib/schema";

export type Pane3Mode = "inline" | "raw" | "diff";

type WorkspaceProps = {
  initialSeries: Series[];
  initialImages: ImageAsset[];
  workspace: { name: string; icon: string };
};

export function Workspace({
  initialSeries,
  initialImages,
  workspace,
}: WorkspaceProps) {
  const [series, setSeries] = useState<Series[]>(initialSeries);
  const [imageHistory, setImageHistory] = useState<ImageAsset[]>(initialImages);
  const [pane4ManuallyClosed, setPane4ManuallyClosed] = useState(false);
  const [pane3Mode, setPane3Mode] = useState<Pane3Mode>("raw");

  // 最初のコースを初期選択
  const firstCourseId = initialSeries[0]?.courses[0]?.id ?? "";
  const firstLessonId = initialSeries[0]?.courses[0]?.lessons[0]?.id ?? "";
  const [selectedCourseId, setSelectedCourseId] = useState<string>(firstCourseId);
  const [selectedLessonId, setSelectedLessonId] = useState<string>(firstLessonId);

  // カーソル挿入位置（Pane3 の textarea ref から Pane4 が使う）
  const [insertCallback, setInsertCallback] = useState<
    ((markdown: string) => void) | null
  >(null);

  // 派生: 選択中コース・レッスン
  const selectedCourse = useMemo((): Course | undefined => {
    for (const s of series) {
      const c = s.courses.find((c) => c.id === selectedCourseId);
      if (c) return c;
    }
    return undefined;
  }, [series, selectedCourseId]);

  const selectedLesson = useMemo((): Lesson | undefined => {
    return selectedCourse?.lessons.find((l) => l.id === selectedLessonId);
  }, [selectedCourse, selectedLessonId]);

  // コース選択（Pane1 から、またはPane2の前提/次コースクリック）
  const selectCourse = useCallback((courseId: string) => {
    setSelectedCourseId(courseId);
    // そのコースの最初のレッスンを自動選択
    for (const s of series) {
      const c = s.courses.find((c) => c.id === courseId);
      if (c && c.lessons.length > 0) {
        setSelectedLessonId(c.lessons[0].id);
        return;
      }
    }
    setSelectedLessonId("");
  }, [series]);

  // レッスン選択（Pane2 から）
  const selectLesson = useCallback((lessonId: string) => {
    setSelectedLessonId(lessonId);
  }, []);

  // レッスンのコンテンツ更新（Pane3 から）
  const updateLessonContent = useCallback(
    (lessonId: string, content: string) => {
      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) => ({
            ...c,
            lessons: c.lessons.map((l) =>
              l.id === lessonId ? { ...l, content } : l,
            ),
          })),
        })),
      );
    },
    [],
  );

  // レッスンのステータス更新（Pane2 から）
  const updateLessonStatus = useCallback(
    (lessonId: string, status: Lesson["status"]) => {
      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) => ({
            ...c,
            lessons: c.lessons.map((l) =>
              l.id === lessonId ? { ...l, status } : l,
            ),
          })),
        })),
      );
    },
    [],
  );

  // レッスン追加（Pane2 から）
  const addLesson = useCallback((courseId: string, lessonName: string) => {
    const newId = `lesson-${Date.now()}`;
    setSeries((prev) =>
      prev.map((s) => ({
        ...s,
        courses: s.courses.map((c) => {
          if (c.id !== courseId) return c;
          const newLesson: Lesson = {
            id: newId,
            series: s.name,
            course: c.name,
            lesson: lessonName,
            status: "draft",
            description: "",
            tags: [],
            estimated_minutes: 15,
            author: "",
            content: `---\nseries: ${s.name}\ncourse: ${c.name}\nlesson: ${lessonName}\nstatus: draft\ndescription: \ntags: []\nestimated_minutes: 15\nauthor: \n---\n\n# ${lessonName}\n\n（ここに本文を書いてください）\n`,
          };
          return { ...c, lessons: [...c.lessons, newLesson] };
        }),
      })),
    );
    setSelectedLessonId(newId);
  }, []);

  // レッスン削除（Pane2 から）
  const deleteLesson = useCallback(
    (courseId: string, lessonId: string) => {
      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) =>
            c.id === courseId
              ? { ...c, lessons: c.lessons.filter((l) => l.id !== lessonId) }
              : c,
          ),
        })),
      );
      if (selectedLessonId === lessonId) setSelectedLessonId("");
    },
    [selectedLessonId],
  );

  // シリーズ追加（Pane1 から）
  const addSeries = useCallback((name: string) => {
    const newId = `series-${Date.now()}`;
    setSeries((prev) => [
      ...prev,
      { id: newId, name, courses: [] },
    ]);
    return newId;
  }, []);

  // シリーズ削除（Pane1 から・コースがある場合は UI 側でブロック）
  const deleteSeries = useCallback(
    (seriesId: string) => {
      setSeries((prev) => {
        const next = prev.filter((s) => s.id !== seriesId);
        const removed = prev.find((s) => s.id === seriesId);
        const hadSelectedCourse =
          removed?.courses.some((c) => c.id === selectedCourseId) ?? false;
        if (hadSelectedCourse) {
          const firstCourse = next.flatMap((s) => s.courses)[0];
          setSelectedCourseId(firstCourse?.id ?? "");
          setSelectedLessonId(firstCourse?.lessons[0]?.id ?? "");
        }
        return next;
      });
    },
    [selectedCourseId],
  );

  // コース削除（Pane1 から・レッスンがある場合は UI 側でブロック）
  const deleteCourse = useCallback(
    (seriesId: string, courseId: string) => {
      setSeries((prev) => {
        const next = prev.map((s) =>
          s.id === seriesId
            ? { ...s, courses: s.courses.filter((c) => c.id !== courseId) }
            : s,
        );
        if (selectedCourseId === courseId) {
          const firstCourse = next.flatMap((s) => s.courses)[0];
          setSelectedCourseId(firstCourse?.id ?? "");
          setSelectedLessonId(firstCourse?.lessons[0]?.id ?? "");
        }
        return next;
      });
    },
    [selectedCourseId],
  );

  // コース追加（Pane1 から）
  const addCourse = useCallback((seriesId: string, name: string) => {
    const newId = `course-${Date.now()}`;
    setSeries((prev) =>
      prev.map((s) => {
        if (s.id !== seriesId) return s;
        const newCourse: Course = {
          id: newId,
          name,
          target_audience: "",
          prerequisites: [],
          next_courses: [],
          lessons: [],
        };
        return { ...s, courses: [...s.courses, newCourse] };
      }),
    );
  }, []);

  // コース並び替え（Pane1 DnD から）同シリーズ内のみ
  const reorderCourses = useCallback(
    (seriesId: string, fromIndex: number, toIndex: number) => {
      setSeries((prev) =>
        prev.map((s) => {
          if (s.id !== seriesId) return s;
          const courses = [...s.courses];
          const [moved] = courses.splice(fromIndex, 1);
          courses.splice(toIndex, 0, moved);
          return { ...s, courses };
        }),
      );
    },
    [],
  );

  // レッスン並び替え（Pane2 DnD から）
  const reorderLessons = useCallback(
    (courseId: string, fromIndex: number, toIndex: number) => {
      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) => {
            if (c.id !== courseId) return c;
            const lessons = [...c.lessons];
            const [moved] = lessons.splice(fromIndex, 1);
            lessons.splice(toIndex, 0, moved);
            return { ...c, lessons };
          }),
        })),
      );
    },
    [],
  );

  // コースメタ情報更新（Pane2 の編集ダイアログから）
  const updateCourseMeta = useCallback(
    (
      courseId: string,
      meta: Pick<Course, "target_audience" | "prerequisites" | "next_courses">,
    ) => {
      setSeries((prev) =>
        prev.map((s) => ({
          ...s,
          courses: s.courses.map((c) =>
            c.id === courseId ? { ...c, ...meta } : c,
          ),
        })),
      );
    },
    [],
  );

  // 画像追加（Pane4 から）
  const addImage = useCallback((asset: ImageAsset) => {
    setImageHistory((prev) => [asset, ...prev]);
  }, []);

  // 画像挿入コールバック登録（Pane3 → Pane4 の橋渡し）
  const registerInsertCallback = useCallback(
    (cb: (markdown: string) => void) => {
      setInsertCallback(() => cb);
    },
    [],
  );

  const insertImageMarkdown = useCallback(
    (markdown: string) => {
      insertCallback?.(markdown);
    },
    [insertCallback],
  );

  const selectedSeriesName = useMemo(() => {
    for (const s of series) {
      if (s.courses.some((c) => c.id === selectedCourseId)) return s.name;
    }
    return "";
  }, [series, selectedCourseId]);

  return (
    <SidebarProvider
      defaultOpen
      className="h-screen w-full overflow-hidden bg-background text-foreground"
    >
      <SeriesCoursePane
        workspaceName={workspace.name}
        series={series}
        selectedCourseId={selectedCourseId}
        onSelectCourse={selectCourse}
        onReorderCourses={reorderCourses}
        onAddSeries={addSeries}
        onAddCourse={addCourse}
        onDeleteSeries={deleteSeries}
        onDeleteCourse={deleteCourse}
      />
      <SidebarInset className="flex min-w-0 flex-col bg-background">
        <GlobalHeader
          departmentTitle={selectedSeriesName}
          positionTitle={selectedCourse?.name ?? ""}
          candidateName={selectedLesson?.lesson ?? ""}
          series={series}
          selectedCourseId={selectedCourseId}
          onSelectCourse={selectCourse}
        />
        <div className="flex min-h-0 flex-1">
          <LessonListPane
            series={series}
            course={selectedCourse}
            selectedLessonId={selectedLessonId}
            onSelectLesson={selectLesson}
            onSelectCourse={selectCourse}
            onAddLesson={addLesson}
            onDeleteLesson={deleteLesson}
            onReorderLessons={reorderLessons}
            onUpdateCourseMeta={updateCourseMeta}
            onUpdateLessonStatus={updateLessonStatus}
          />
          <MarkdownEditorPane
            lesson={selectedLesson}
            mode={pane3Mode}
            onModeChange={setPane3Mode}
            onUpdateContent={updateLessonContent}
            onRegisterInsertCallback={registerInsertCallback}
          />
          <ImageManagerPane
            imageHistory={imageHistory}
            onAddImage={addImage}
            onInsertImage={insertImageMarkdown}
            pane4Open={!pane4ManuallyClosed}
            onTogglePane4={() => setPane4ManuallyClosed((v) => !v)}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
