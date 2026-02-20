import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Edge, Node } from "reactflow";
import { Background, Controls, MiniMap } from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";

type Concept = {
  id: string;
  title: string;
  type: string;
  description: string;
  examples: string[];
  depends_on: string[];
};

type KnowledgeGraphResponse = {
  topics: Record<string, string[]>;
  concepts: Concept[];
};

type UserGraphResponse = {
  mastery: Record<string, number>;
  effective_mastery: Record<string, number>;
  exposure_count: Record<string, number>;
  confusion_count: Record<string, number>;
  last_updated: Record<string, number>;
};

const ReactFlow = dynamic(() => import("reactflow").then((mod) => mod.default), {
  ssr: false,
});

const PANEL_TITLE = "text-xs font-medium text-gray-400 uppercase tracking-wider";
const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;

const graph = new dagre.graphlib.Graph();
graph.setDefaultEdgeLabel(() => ({}));

type LayoutResult = { nodes: Node[]; edges: Edge[] };

function layoutElements(nodes: Node[], edges: Edge[]): LayoutResult {
  graph.setGraph({ rankdir: "LR", nodesep: 30, ranksep: 80 });

  nodes.forEach((node) => {
    graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  const layoutedNodes = nodes.map((node) => {
    const { x, y } = graph.node(node.id);
    return {
      ...node,
      position: {
        x: x - NODE_WIDTH / 2,
        y: y - NODE_HEIGHT / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

function masteryColor(value: number) {
  const clamped = Math.min(1, Math.max(0, value));
  const hue = 200 - clamped * 120; // blue -> green
  return `hsl(${hue}, 80%, 60%)`;
}

export default function UserGraphPage() {
  const [kg, setKg] = useState<KnowledgeGraphResponse | null>(null);
  const [ug, setUg] = useState<UserGraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [userId, setUserId] = useState("default");

  useEffect(() => setMounted(true), []);

  async function load(user: string) {
    setLoading(true);
    setError(null);
    try {
      const [kgRes, ugRes] = await Promise.all([
        fetch("http://localhost:8000/knowledge-graph"),
        fetch(`http://localhost:8000/user-graph?user_id=${encodeURIComponent(user)}`),
      ]);
      if (!kgRes.ok) throw new Error(await kgRes.text());
      if (!ugRes.ok) throw new Error(await ugRes.text());
      const kgData: KnowledgeGraphResponse = await kgRes.json();
      const ugData: UserGraphResponse = await ugRes.json();
      setKg(kgData);
      setUg(ugData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(userId);
  }, []);

  const { nodes, edges } = useMemo(() => {
    if (!kg || !ug) return { nodes: [], edges: [] } as LayoutResult;

    const conceptMap = new Map(kg.concepts.map((c) => [c.id, c]));
    const nextNodes: Node[] = kg.concepts.map((concept) => {
      const effective = ug.effective_mastery[concept.id] ?? 0;
      const raw = ug.mastery[concept.id] ?? 0;
      const color = masteryColor(effective);
      return {
        id: concept.id,
        type: "default",
        data: {
          label: (
            <div className="space-y-1">
              <div className="text-sm font-semibold text-gray-100">{concept.title}</div>
              <div className="text-[11px] text-gray-400">raw {raw.toFixed(2)} • eff {effective.toFixed(2)}</div>
              <div className="text-[11px] text-gray-500">{concept.id}</div>
            </div>
          ),
        },
        position: { x: 0, y: 0 },
        style: {
          border: `1px solid ${color}`,
          background: "#0f172a",
          borderRadius: 10,
          padding: 6,
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          boxShadow: `0 0 0 1px ${color}33`,
        },
      };
    });

    const nextEdges: Edge[] = [];
    kg.concepts.forEach((concept) => {
      concept.depends_on.forEach((dep) => {
        if (!conceptMap.has(dep)) return;
        nextEdges.push({
          id: `${dep}->${concept.id}`,
          source: dep,
          target: concept.id,
          style: { stroke: "#475569" },
        });
      });
    });

    return layoutElements(nextNodes, nextEdges);
  }, [kg, ug]);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 px-8 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">User Graph</h1>
            <p className="text-sm text-gray-500 mt-1">
              Mastery signal overlay on the knowledge graph (color = effective mastery).
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-md px-3 py-2 text-xs text-gray-400">
            Backend: <span className="text-gray-200">/user-graph</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500">User ID</label>
          <input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-md px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="default"
          />
          <button
            onClick={() => load(userId)}
            className="text-xs px-3 py-1.5 rounded border border-blue-600 text-blue-200 hover:bg-blue-950/30"
          >
            Refresh
          </button>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading user graph…</p>}
        {error && (
          <div className="bg-red-950 border border-red-700 rounded-md px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {kg && ug && (
          <div className="space-y-3">
            <h2 className={PANEL_TITLE}>Graph View</h2>
            <div className="h-[700px] border border-gray-800 rounded-md overflow-hidden bg-slate-950">
              {mounted ? (
                <ReactFlow nodes={nodes} edges={edges} fitView>
                  <Background gap={18} color="#1f2937" />
                  <MiniMap maskColor="rgba(2,6,23,0.8)" nodeColor="#38bdf8" />
                  <Controls />
                </ReactFlow>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-500">
                  Loading graph…
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
