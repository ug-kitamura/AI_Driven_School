import { describe, expect, it } from "vitest";
import {
  ancestorsOf,
  buildView,
  collapseSeries,
  courseView,
  descendantsOf,
  dimmedEdgeIds,
  dimmedNodeIds,
  globalView,
  seriesView,
  traceFrom,
} from "../lib/mandala/graph";
import { layoutTopDown } from "../lib/mandala/layout";
import type { MandalaGraph } from "../lib/site-data";

/**
 * start: setup → (cross) → git: concepts → basics
 * git: concepts → basics は order 辺
 */
const graph: MandalaGraph = {
  nodes: [
    {
      id: "crs-setup",
      label: "開発環境準備コース",
      seriesSlug: "start",
      seriesName: "はじめにシリーズ",
      courseSlug: "setup",
      href: "/start/setup",
      lessonCount: 2,
      totalMinutes: 25,
      status: "in_progress",
    },
    {
      id: "crs-intro",
      label: "DX入門コース",
      seriesSlug: "start",
      seriesName: "はじめにシリーズ",
      courseSlug: "intro",
      href: "/start/intro",
      lessonCount: 1,
      totalMinutes: 15,
      status: "in_progress",
    },
    {
      id: "crs-concepts",
      label: "Git概念コース",
      seriesSlug: "git",
      seriesName: "Git基礎シリーズ",
      courseSlug: "concepts",
      href: "/git/concepts",
      lessonCount: 2,
      totalMinutes: 30,
      status: "done",
    },
    {
      id: "crs-basics",
      label: "Git基本操作コース",
      seriesSlug: "git",
      seriesName: "Git基礎シリーズ",
      courseSlug: "basics",
      href: "/git/basics",
      lessonCount: 3,
      totalMinutes: 40,
      status: "done",
    },
  ],
  edges: [
    { id: "e1", source: "crs-intro", target: "crs-setup", kind: "order" },
    { id: "e2", source: "crs-concepts", target: "crs-basics", kind: "order" },
    { id: "e3", source: "crs-setup", target: "crs-concepts", kind: "cross" },
  ],
};

describe("globalView", () => {
  it("全ノード・全辺をゴーストなしで返す", () => {
    const view = globalView(graph);
    expect(view.nodes).toHaveLength(4);
    expect(view.edges).toHaveLength(3);
    expect(view.nodes.every((n) => !n.ghost)).toBe(true);
  });
});

describe("seriesView", () => {
  it("シリーズ内のコースを現在地として返す", () => {
    const view = seriesView(graph, "git");
    const own = view.nodes.filter((n) => !n.ghost);
    expect(own.map((n) => n.id)).toEqual(["crs-concepts", "crs-basics"]);
    expect(own.every((n) => n.current)).toBe(true);
  });

  it("跨ぎの相手をゴーストノードとして含める", () => {
    const view = seriesView(graph, "git");
    const ghosts = view.nodes.filter((n) => n.ghost);
    expect(ghosts).toHaveLength(1);
    expect(ghosts[0]).toMatchObject({
      id: "crs-setup",
      seriesName: "はじめにシリーズ",
    });
  });

  it("無関係なシリーズ内部の辺を持ち込まない", () => {
    const view = seriesView(graph, "git");
    // e1（start 内部の辺）は含まれない
    expect(view.edges.map((e) => e.id).sort()).toEqual(["e2", "e3"]);
  });
});

describe("courseView", () => {
  it("中央のコースと直接の前後だけを返す", () => {
    const view = courseView(graph, "crs-concepts");
    expect(view.nodes.map((n) => n.id).sort()).toEqual([
      "crs-basics",
      "crs-concepts",
      "crs-setup",
    ]);
    expect(view.nodes.find((n) => n.id === "crs-concepts")!.current).toBe(true);
  });

  it("別シリーズの隣接をゴーストにする", () => {
    const view = courseView(graph, "crs-concepts");
    expect(view.nodes.find((n) => n.id === "crs-setup")!.ghost).toBe(true);
    expect(view.nodes.find((n) => n.id === "crs-basics")!.ghost).toBe(false);
  });

  it("存在しないコースには空のビューを返す", () => {
    expect(courseView(graph, "crs-unknown")).toEqual({ nodes: [], edges: [] });
  });
});

describe("buildView", () => {
  it("scope に応じたビューを返す", () => {
    expect(buildView(graph, { kind: "global" }).nodes).toHaveLength(4);
    expect(
      buildView(graph, { kind: "series", seriesSlug: "git" }).nodes,
    ).toHaveLength(3);
    expect(
      buildView(graph, { kind: "course", courseId: "crs-basics" }).nodes,
    ).toHaveLength(2);
  });
});

describe("トレース", () => {
  it("上流を跨ぎ越しに遡る", () => {
    expect([...ancestorsOf(graph.edges, "crs-basics")].sort()).toEqual([
      "crs-basics",
      "crs-concepts",
      "crs-intro",
      "crs-setup",
    ]);
  });

  it("下流を辿る", () => {
    expect([...descendantsOf(graph.edges, "crs-setup")].sort()).toEqual([
      "crs-basics",
      "crs-concepts",
      "crs-setup",
    ]);
  });

  it("上流と下流の和を返す", () => {
    expect([...traceFrom(graph.edges, "crs-concepts")].sort()).toEqual([
      "crs-basics",
      "crs-concepts",
      "crs-intro",
      "crs-setup",
    ]);
  });

  it("循環があっても止まる", () => {
    const cyclic: MandalaGraph = {
      nodes: graph.nodes,
      edges: [
        { id: "c1", source: "a", target: "b", kind: "order" },
        { id: "c2", source: "b", target: "a", kind: "order" },
      ],
    };
    expect([...ancestorsOf(cyclic.edges, "a")].sort()).toEqual(["a", "b"]);
  });
});

describe("ホバー時の減光", () => {
  const disconnected: MandalaGraph = {
    nodes: [
      ...graph.nodes,
      {
        id: "crs-python",
        label: "Python概要コース",
        seriesSlug: "python",
        seriesName: "Python基礎シリーズ",
        courseSlug: "overview",
        href: "/python/overview",
        lessonCount: 1,
        totalMinutes: 10,
        status: "open",
      },
    ],
    edges: graph.edges,
  };

  it("ホバーしていなければ何も減光しない", () => {
    const ids = disconnected.nodes.map((n) => n.id);
    expect(dimmedNodeIds(disconnected.edges, ids, null).size).toBe(0);
    expect(dimmedEdgeIds(disconnected.edges, null).size).toBe(0);
  });

  it("経路に含まれないノードを減光する", () => {
    const ids = disconnected.nodes.map((n) => n.id);
    const dimmed = dimmedNodeIds(disconnected.edges, ids, "crs-concepts");
    expect([...dimmed]).toEqual(["crs-python"]);
  });

  it("全ノードが1本に繋がっていれば減光は起きない", () => {
    const ids = graph.nodes.map((n) => n.id);
    expect(dimmedNodeIds(graph.edges, ids, "crs-basics").size).toBe(0);
  });

  it("両端が経路に含まれない辺だけを減光する", () => {
    const withIsolatedEdge: MandalaGraph = {
      nodes: disconnected.nodes,
      edges: [
        ...graph.edges,
        {
          id: "e-py",
          source: "crs-python",
          target: "crs-python2",
          kind: "order",
        },
      ],
    };
    const dimmed = dimmedEdgeIds(withIsolatedEdge.edges, "crs-concepts");
    expect([...dimmed]).toEqual(["e-py"]);
  });
});

describe("collapseSeries", () => {
  it("畳まないときは元のビューを返す", () => {
    const view = globalView(graph);
    const result = collapseSeries(view, new Set());
    expect(result.collapsed).toHaveLength(0);
    expect(result.nodes).toHaveLength(4);
  });

  it("畳んだシリーズを1ノードに集約する", () => {
    const result = collapseSeries(globalView(graph), new Set(["start"]));
    expect(result.nodes.map((n) => n.id)).toEqual([
      "crs-concepts",
      "crs-basics",
    ]);
    expect(result.collapsed).toHaveLength(1);
    expect(result.collapsed[0]).toMatchObject({
      id: "series:start",
      seriesName: "はじめにシリーズ",
      courseCount: 2,
      lessonCount: 3,
      totalMinutes: 40,
      href: "/start",
    });
  });

  it("跨ぎの辺を集約ノードへ張り替え、内部の辺を落とす", () => {
    const result = collapseSeries(globalView(graph), new Set(["start"]));
    // e1（start 内部）は消え、e3 は series:start → crs-concepts になる
    expect(result.edges).toHaveLength(2);
    expect(
      result.edges.some(
        (e) => e.source === "series:start" && e.target === "crs-concepts",
      ),
    ).toBe(true);
  });

  it("集約後に重複する辺を作らない", () => {
    const withDup: MandalaGraph = {
      nodes: graph.nodes,
      edges: [
        ...graph.edges,
        {
          id: "e4",
          source: "crs-intro",
          target: "crs-concepts",
          kind: "cross",
        },
      ],
    };
    const result = collapseSeries(globalView(withDup), new Set(["start"]));
    const toCcepts = result.edges.filter(
      (e) => e.source === "series:start" && e.target === "crs-concepts",
    );
    expect(toCcepts).toHaveLength(1);
  });
});

describe("layoutTopDown", () => {
  it("上から下に段を作る", () => {
    const positions = layoutTopDown(
      graph.nodes.map((n) => n.id),
      graph.edges,
      { size: { width: 200, height: 80 } },
    );
    const y = new Map(positions.map((p) => [p.id, p.y]));
    // intro → setup → concepts → basics の順に下がる
    expect(y.get("crs-intro")!).toBeLessThan(y.get("crs-setup")!);
    expect(y.get("crs-setup")!).toBeLessThan(y.get("crs-concepts")!);
    expect(y.get("crs-concepts")!).toBeLessThan(y.get("crs-basics")!);
  });

  it("全ノードの座標を返す", () => {
    const positions = layoutTopDown(["crs-setup"], [], {
      size: { width: 100, height: 50 },
    });
    expect(positions).toHaveLength(1);
    expect(Number.isFinite(positions[0]!.x)).toBe(true);
    expect(Number.isFinite(positions[0]!.y)).toBe(true);
  });
});
