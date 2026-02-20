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

const ReactFlow = dynamic(() => import("reactflow").then((mod) => mod.default), {
  ssr: false,
});

const PANEL_TITLE = "text-xs font-medium text-gray-400 uppercase tracking-wider";
const NODE_WIDTH = 230;
const NODE_HEIGHT = 90;

const TYPE_COLORS: Record<string, string> = {
  principle: "#60a5fa",
  mechanic: "#34d399",
  model: "#f59e0b",
  concept: "#f472b6",
  optimization: "#f97316",
  hyperparameter: "#c084fc",
  mathematical_concept: "#38bdf8",
  convention: "#94a3b8",
};

const graph = new dagre.graphlib.Graph();
graph.setDefaultEdgeLabel(() => ({}));

type LayoutResult = { nodes: Node[]; edges: Edge[] };

function layoutElements(nodes: Node[], edges: Edge[]): LayoutResult {
  graph.setGraph({ rankdir: "LR", nodesep: 40, ranksep: 80 });

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

export default function KnowledgeGraphPage() {
  const [data, setData] = useState<KnowledgeGraphResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedConcept, setSelectedConcept] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let mountedFlag = true;
    setLoading(true);
    fetch("http://localhost:8000/knowledge-graph")
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json();
      })
      .then((payload: KnowledgeGraphResponse) => {
        if (!mountedFlag) return;
        setData(payload);
        const firstTopic = Object.keys(payload.topics).sort()[0] ?? null;
        setSelectedTopic(firstTopic);
      })
      .catch((err) => {
        if (!mountedFlag) return;
        setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => mountedFlag && setLoading(false));

    return () => {
      mountedFlag = false;
    };
  }, []);

  const conceptsById = useMemo(() => {
    const map = new Map<string, Concept>();
    data?.concepts.forEach((c) => map.set(c.id, c));
    return map;
  }, [data]);

  const topics = useMemo(() => {
    if (!data) return [] as string[];
    return Object.keys(data.topics).sort();
  }, [data]);

  const { nodes, edges } = useMemo(() => {
    if (!data || !selectedTopic) return { nodes: [], edges: [] } as LayoutResult;

    const ids = data.topics[selectedTopic] ?? [];
    const needle = filter.trim().toLowerCase();
    const filteredIds = needle
      ? ids.filter((id) => {
          const c = conceptsById.get(id);
          if (!c) return false;
          return [c.id, c.title, c.type, c.description].some((v) =>
            v.toLowerCase().includes(needle)
          );
        })
      : ids;

    const nextNodes: Node[] = filteredIds.map((id) => {
      const concept = conceptsById.get(id)!;
      const color = TYPE_COLORS[concept.type] ?? "#94a3b8";
      return {
        id,
        type: "default",
        data: {
          label: (
            <div className="space-y-1">
              <div className="text-sm font-semibold text-gray-100">{concept.title}</div>
              <div className="text-xs text-gray-400">{concept.id}</div>
              <div className="text-[11px] text-gray-500 uppercase tracking-wide">{concept.type}</div>
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
    filteredIds.forEach((id) => {
      const concept = conceptsById.get(id);
      concept?.depends_on.forEach((dep) => {
        if (!filteredIds.includes(dep)) return;
        nextEdges.push({
          id: `${dep}->${id}`,
          source: dep,
          target: id,
          animated: false,
          style: { stroke: "#475569" },
        });
      });
    });

    return layoutElements(nextNodes, nextEdges);
  }, [data, selectedTopic, conceptsById, filter]);

  const activeConcept = selectedConcept ? conceptsById.get(selectedConcept) : null;

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 px-8 py-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Knowledge Graph</h1>
            <p className="text-sm text-gray-500 mt-1">
              Visual map of topics, concept sequencing, and dependencies used for lesson planning.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-md px-3 py-2 text-xs text-gray-400">
            Backend: <span className="text-gray-200">/knowledge-graph</span>
          </div>
        </div>

        {loading && <p className="text-sm text-gray-500">Loading graph…</p>}
        {error && (
          <div className="bg-red-950 border border-red-700 rounded-md px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_320px] gap-6">
            <section className="space-y-3">
              <h2 className={PANEL_TITLE}>Topics</h2>
              <div className="space-y-2">
                {topics.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => {
                      setSelectedTopic(topic);
                      setSelectedConcept(null);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm border transition-colors ${
                      selectedTopic === topic
                        ? "bg-blue-950/40 border-blue-700 text-blue-200"
                        : "bg-gray-900 border-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-700"
                    }`}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <h2 className={PANEL_TITLE}>Graph View</h2>
                <input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filter concepts…"
                  className="bg-gray-900 border border-gray-800 rounded-md px-3 py-1.5 text-xs text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="h-[640px] border border-gray-800 rounded-md overflow-hidden bg-slate-950">
                {mounted ? (
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    fitView
                    onNodeClick={(_, node) => setSelectedConcept(node.id)}
                  >
                    <Background gap={18} color="#1f2937" />
                    <MiniMap maskColor="rgba(2,6,23,0.8)" nodeColor="#60a5fa" />
                    <Controls />
                  </ReactFlow>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-gray-500">
                    Loading graph…
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className={PANEL_TITLE}>Concept Detail</h2>
              {activeConcept ? (
                <div className="bg-gray-900 border border-gray-800 rounded-md p-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-100">{activeConcept.title}</p>
                    <p className="text-xs text-gray-500">{activeConcept.id} • {activeConcept.type}</p>
                  </div>
                  <p className="text-sm text-gray-300 leading-relaxed">{activeConcept.description}</p>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Prerequisites</p>
                    {activeConcept.depends_on.length === 0 ? (
                      <p className="text-xs text-gray-500">None (root concept)</p>
                    ) : (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {activeConcept.depends_on.map((dep) => (
                          <span key={dep} className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300">
                            {dep}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Examples</p>
                    <ul className="mt-2 space-y-2">
                      {activeConcept.examples.map((ex, idx) => (
                        <li key={idx} className="text-xs text-gray-300 bg-gray-800/70 rounded px-3 py-2">
                          {ex}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-md p-4 text-xs text-gray-500">
                  Select a concept to view details.
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
