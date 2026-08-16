import { describe, expect, it, afterEach, beforeAll, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

// SidebarProvider（use-mobile）が参照する matchMedia は jsdom に無い
beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});
import { SidebarProvider } from "@/components/ui/sidebar";
import { ContentTreePane } from "@/components/workspace/ContentTreePane";
import type { Series } from "@/lib/schema";

const series: Series[] = [
  {
    id: "srs-1",
    name: "Git基礎シリーズ",
    courses: [
      {
        id: "crs-1",
        name: "Git概念コース",
        lessons: [
          {
            id: "lsn-1",
            series: "Git基礎シリーズ",
            course: "Git概念コース",
            lesson: "バージョン管理ってなに？",
            status: "done",
            content: "",
            description: "",
            tags: [],
            estimated_minutes: 10,
            author: "",
          },
          {
            id: "lsn-2",
            series: "Git基礎シリーズ",
            course: "Git概念コース",
            lesson: "Gitの三大エリア",
            status: "open",
            content: "",
            description: "",
            tags: [],
            estimated_minutes: 15,
            author: "",
          },
        ],
      },
    ],
  },
];

function noop() {}

function renderTree(overrides: Partial<Parameters<typeof ContentTreePane>[0]> = {}) {
  const handlers = {
    onSelectSeries: vi.fn(),
    onSelectCourse: vi.fn(),
    onSelectLesson: vi.fn(),
    onUpdateLessonStatus: vi.fn(),
  };
  render(
    <SidebarProvider defaultOpen>
      <ContentTreePane
        workspaceName="DX Training Studio"
        series={series}
        selectedSeriesId="srs-1"
        selectedCourseId=""
        selectedLessonId=""
        onSelectSeries={handlers.onSelectSeries}
        onSelectCourse={handlers.onSelectCourse}
        onSelectLesson={handlers.onSelectLesson}
        onReorderSeries={noop}
        onReorderCourses={noop}
        onReorderLessons={noop}
        onAddSeries={() => "srs-new"}
        onAddCourse={noop}
        onAddLesson={noop}
        onDeleteSeries={noop}
        onDeleteCourse={noop}
        onDeleteLesson={noop}
        onUpdateSeriesName={noop}
        onUpdateCourseMeta={noop}
        onUpdateLessonMeta={noop}
        onUpdateLessonStatus={handlers.onUpdateLessonStatus}
        tagSuggestions={[]}
        {...overrides}
      />
    </SidebarProvider>,
  );
  return handlers;
}

afterEach(cleanup);

describe("ContentTreePane", () => {
  it("3階層と、シリーズ行右端の完了/総レッスン数を表示する", () => {
    renderTree();
    expect(screen.getByText("Git基礎シリーズ")).toBeDefined();
    expect(screen.getByText("Git概念コース")).toBeDefined();
    expect(screen.getByText("Gitの三大エリア")).toBeDefined();
    // done 1 / 総 2
    expect(screen.getByText("1/2")).toBeDefined();
  });

  it("レッスン行クリックで onSelectLesson が呼ばれる", () => {
    const handlers = renderTree();
    fireEvent.click(screen.getByText("Gitの三大エリア"));
    expect(handlers.onSelectLesson).toHaveBeenCalledWith("lsn-2");
  });

  it("ステータスボタンは循環値で onUpdateLessonStatus を呼び、行選択を発生させない", () => {
    const handlers = renderTree();
    // lsn-2 は open → クリックで in_progress へ
    const statusButtons = screen.getAllByLabelText("未着手、クリックで変更");
    fireEvent.click(statusButtons[0]);
    expect(handlers.onUpdateLessonStatus).toHaveBeenCalledWith(
      "lsn-2",
      "in_progress",
    );
    expect(handlers.onSelectLesson).not.toHaveBeenCalled();
  });

  it("chevron クリックは開閉のみで選択を変えない", () => {
    const handlers = renderTree();
    fireEvent.click(screen.getByLabelText("コースを折りたたむ"));
    // 折りたたまれてレッスンが消える
    expect(screen.queryByText("Gitの三大エリア")).toBeNull();
    expect(handlers.onSelectCourse).not.toHaveBeenCalled();
    expect(handlers.onSelectSeries).not.toHaveBeenCalled();
  });

  it("シリーズ 0 件では右クリック案内の空状態を表示する", () => {
    render(
      <SidebarProvider defaultOpen>
        <ContentTreePane
          workspaceName="DX Training Studio"
          series={[]}
          selectedSeriesId=""
          selectedCourseId=""
          selectedLessonId=""
          onSelectSeries={noop}
          onSelectCourse={noop}
          onSelectLesson={noop}
          onReorderSeries={noop}
          onReorderCourses={noop}
          onReorderLessons={noop}
          onAddSeries={() => "srs-new"}
          onAddCourse={noop}
          onAddLesson={noop}
          onDeleteSeries={noop}
          onDeleteCourse={noop}
          onDeleteLesson={noop}
          onUpdateSeriesName={noop}
          onUpdateCourseMeta={noop}
          onUpdateLessonMeta={noop}
          onUpdateLessonStatus={noop}
          tagSuggestions={[]}
        />
      </SidebarProvider>,
    );
    expect(
      screen.getByText(/右クリックからシリーズを追加できます/),
    ).toBeDefined();
  });
});
