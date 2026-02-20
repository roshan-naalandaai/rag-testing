import { useState, useCallback } from "react";

type Provider = "openai" | "claude" | "gemini";
type Mode = "direct_schema" | "two_pass" | "tool_calling" | "grammar_constrained";

interface GenerateResponse {
  raw_output: string;
  valid: boolean;
  errors: string[];
  parsed: object | null;
  latency_ms: number;
  mode: string;
  saved_id: string | null;
  compiled: object | null;
  compile_error: string | null;
}

interface EvaluateResponse {
  runs: number;
  valid_count: number;
  invalid_count: number;
  identical_structure_count: number;
  valid_pct: number;
  identical_pct: number;
  avg_latency_ms: number;
}

interface OutputEntry {
  id: string;
  topic: string;
  created_at: string | null;
  has_compiled: boolean;
}

const DEFAULT_MASTERY = JSON.stringify(
  { entity_concept: 0.9, accounting_equation: 0.7, accrual: 0.2, matching: 0.1 },
  null,
  2
);

const SELECT_CLS =
  "bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

const SECTION_LABEL = "text-xs font-medium text-gray-400 uppercase tracking-wider";

export default function Home() {
  const [provider, setProvider] = useState<Provider>("openai");
  const [mode, setMode] = useState<Mode>("direct_schema");
  const [topic, setTopic] = useState("");
  const [userId, setUserId] = useState("default");
  const [masteryText, setMasteryText] = useState(DEFAULT_MASTERY);
  const [masteryError, setMasteryError] = useState<string | null>(null);
  const [showMastery, setShowMastery] = useState(false);
  const [runs, setRuns] = useState(3);

  const [generating, setGenerating] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [evalResult, setEvalResult] = useState<EvaluateResponse | null>(null);

  // Outputs panel state
  const [outputs, setOutputs] = useState<OutputEntry[] | null>(null);
  const [loadingOutputs, setLoadingOutputs] = useState(false);
  const [expandedOutput, setExpandedOutput] = useState<string | null>(null);
  const [outputData, setOutputData] = useState<Record<string, { uncompiled?: object; compiled?: object }>>({});

  // Compiled section toggle
  const [showCompiled, setShowCompiled] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [showParsed, setShowParsed] = useState(true);

  function parseMastery(): Record<string, number> | null {
    try {
      const parsed = JSON.parse(masteryText);
      setMasteryError(null);
      return parsed;
    } catch {
      setMasteryError("Invalid JSON in mastery editor");
      return null;
    }
  }

  async function handleGenerate() {
    const user_mastery = parseMastery();
    if (user_mastery === null) return;

    setGenerating(true);
    setResult(null);
    setFetchError(null);
    setShowCompiled(false);

    try {
      const res = await fetch("http://localhost:8000/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, topic, mode, user_mastery, user_id: userId }),
      });
      if (!res.ok) {
        setFetchError(`Backend error ${res.status}: ${await res.text()}`);
        return;
      }
      const data: GenerateResponse = await res.json();
      setResult(data);
      // Auto-show compiled if available
      if (data.compiled) setShowCompiled(true);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleEvaluate() {
    setEvaluating(true);
    setEvalResult(null);
    setFetchError(null);

    try {
      const res = await fetch("http://localhost:8000/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, topic, mode, runs }),
      });
      if (!res.ok) {
        setFetchError(`Backend error ${res.status}: ${await res.text()}`);
        return;
      }
      setEvalResult(await res.json());
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setEvaluating(false);
    }
  }

  const loadOutputs = useCallback(async () => {
    setLoadingOutputs(true);
    try {
      const res = await fetch("http://localhost:8000/outputs");
      if (res.ok) setOutputs(await res.json());
    } finally {
      setLoadingOutputs(false);
    }
  }, []);

  async function toggleOutputExpand(id: string) {
    if (expandedOutput === id) {
      setExpandedOutput(null);
      return;
    }
    setExpandedOutput(id);
    if (outputData[id]) return; // already loaded

    const [uncRes, compRes] = await Promise.all([
      fetch(`http://localhost:8000/outputs/${id}/uncompiled`),
      fetch(`http://localhost:8000/outputs/${id}/compiled`),
    ]);

    const entry: { uncompiled?: object; compiled?: object } = {};
    if (uncRes.ok) entry.uncompiled = await uncRes.json();
    if (compRes.ok) entry.compiled = await compRes.json();
    setOutputData((prev) => ({ ...prev, [id]: entry }));
  }

  const busy = generating || evaluating;
  const canSubmit = topic.trim().length > 0 && !busy;

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <h1 className="text-2xl font-semibold tracking-tight">SceneSpec Generator</h1>

        {/* ── Controls ── */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)} className={SELECT_CLS}>
              <option value="openai">OpenAI (GPT-4o)</option>
              <option value="claude">Claude (claude-sonnet-4-6)</option>
              <option value="gemini">Gemini (gemini-2.0-flash)</option>
            </select>

            <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} className={SELECT_CLS}>
              <option value="direct_schema">direct_schema</option>
              <option value="two_pass">two_pass</option>
              <option value="tool_calling">tool_calling</option>
              <option value="grammar_constrained">grammar_constrained</option>
            </select>

            <input
              type="text"
              placeholder="Enter topic…"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && canSubmit && handleGenerate()}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <button
              onClick={handleGenerate}
              disabled={!canSubmit}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium px-5 py-2 rounded-md transition-colors whitespace-nowrap"
            >
              {generating ? "Generating…" : "Generate"}
            </button>
          </div>

          <button
            onClick={() => setShowMastery((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            {showMastery ? "▾ Hide user mastery" : "▸ Edit user mastery"}
          </button>

          {showMastery && (
            <div className="space-y-1">
              <textarea
                value={masteryText}
                onChange={(e) => { setMasteryText(e.target.value); setMasteryError(null); }}
                rows={7}
                spellCheck={false}
                className="w-full bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-xs font-mono text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
              {masteryError && <p className="text-xs text-red-400">{masteryError}</p>}
              <p className="text-xs text-gray-500">
                Values 0.0–1.0. Concepts below threshold (default 0.6) are included in the lesson plan.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">Evaluate stability</span>
            <input
              type="number"
              min={1}
              max={10}
              value={runs}
              onChange={(e) => setRuns(Math.max(1, Math.min(10, Number(e.target.value))))}
              className="w-16 bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-500">runs</span>
            <button
              onClick={handleEvaluate}
              disabled={!canSubmit}
              className="bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded-md transition-colors"
            >
              {evaluating ? "Evaluating…" : "Evaluate Stability"}
            </button>
          </div>
        </div>

        {/* Fetch-level error */}
        {fetchError && (
          <div className="bg-red-950 border border-red-700 rounded-md px-4 py-3 text-sm text-red-300">
            {fetchError}
          </div>
        )}

        {/* ── Evaluate results ── */}
        {evalResult && (
          <div className="space-y-3">
            <h2 className={SECTION_LABEL}>
              Stability Report — {evalResult.runs} runs · {mode} · {provider}
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Valid" value={`${evalResult.valid_pct}%`} sub={`${evalResult.valid_count} / ${evalResult.runs}`}
                color={evalResult.valid_pct === 100 ? "green" : evalResult.valid_pct >= 50 ? "yellow" : "red"} />
              <Metric label="Identical Structure" value={`${evalResult.identical_pct}%`} sub={`${evalResult.identical_structure_count} / ${evalResult.runs}`}
                color={evalResult.identical_pct === 100 ? "green" : evalResult.identical_pct >= 50 ? "yellow" : "red"} />
              <Metric label="Avg Latency" value={`${evalResult.avg_latency_ms} ms`} sub="per run" color="blue" />
            </div>
          </div>
        )}

        {/* ── Generate results ── */}
        {result && (
          <div className="space-y-5">

            {/* Status bar */}
            <div className={`flex items-center justify-between px-4 py-3 rounded-md text-sm font-medium border ${
              result.valid
                ? "bg-green-950 border-green-700 text-green-300"
                : "bg-red-950 border-red-700 text-red-300"
            }`}>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${result.valid ? "bg-green-400" : "bg-red-400"}`} />
                {result.valid ? "Valid SceneSpec" : "Invalid SceneSpec"}
                {result.saved_id && (
                  <span className="text-xs opacity-60 font-normal ml-1">· saved as {result.saved_id}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs opacity-70">
                {result.compiled && (
                  <span className="text-emerald-400 opacity-100">compiled ✓</span>
                )}
                {result.compile_error && (
                  <span className="text-amber-400 opacity-100">compile failed</span>
                )}
                <span>{result.latency_ms} ms · {result.mode}</span>
              </div>
            </div>

            {/* Validation errors */}
            {result.errors.length > 0 && (
              <div className="space-y-1.5">
                <h2 className={SECTION_LABEL}>Validation Errors</h2>
                <ul className="space-y-1">
                  {result.errors.map((err, i) => (
                    <li key={i} className="text-xs text-red-300 bg-gray-900 rounded px-3 py-2 font-mono">{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Compile error */}
            {result.compile_error && (
              <div className="space-y-1.5">
                <h2 className={SECTION_LABEL}>Compile Error</h2>
                <pre className="bg-gray-900 border border-amber-900 rounded-md p-4 text-xs text-amber-300 font-mono overflow-auto max-h-40 whitespace-pre-wrap">
                  {result.compile_error}
                </pre>
              </div>
            )}

            {/* ── Three-panel toggle row ── */}
            <div className="flex gap-2">
              <PanelToggle label="Raw LLM" active={showRaw} onClick={() => setShowRaw((v) => !v)} />
              <PanelToggle label="Parsed (SceneSpec)" active={showParsed} onClick={() => setShowParsed((v) => !v)} />
              {result.compiled && (
                <PanelToggle label="Compiled (pixel coords)" active={showCompiled} onClick={() => setShowCompiled((v) => !v)} accent />
              )}
            </div>

            {/* Raw output */}
            {showRaw && (
              <div className="space-y-1.5">
                <h2 className={SECTION_LABEL}>Raw LLM Output</h2>
                <pre className="bg-gray-900 border border-gray-800 rounded-md p-4 text-xs text-gray-300 font-mono overflow-auto max-h-72 whitespace-pre-wrap break-all">
                  {result.raw_output}
                </pre>
              </div>
            )}

            {/* Parsed JSON */}
            {showParsed && result.parsed && (
              <div className="space-y-1.5">
                <h2 className={SECTION_LABEL}>Parsed JSON (SceneSpec)</h2>
                <pre className="bg-gray-900 border border-gray-800 rounded-md p-4 text-xs text-green-300 font-mono overflow-auto max-h-96 whitespace-pre-wrap">
                  {JSON.stringify(result.parsed, null, 2)}
                </pre>
              </div>
            )}

            {/* Compiled output */}
            {showCompiled && result.compiled && (
              <div className="space-y-1.5">
                <h2 className={SECTION_LABEL}>Compiled Output (pixel coordinates)</h2>
                <pre className="bg-gray-900 border border-emerald-900 rounded-md p-4 text-xs text-emerald-300 font-mono overflow-auto max-h-[32rem] whitespace-pre-wrap">
                  {JSON.stringify(result.compiled, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ── Outputs browser ── */}
        <div className="border-t border-gray-800 pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className={SECTION_LABEL}>Saved Outputs</h2>
            <button
              onClick={loadOutputs}
              disabled={loadingOutputs}
              className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600 transition-colors"
            >
              {loadingOutputs ? "Loading…" : outputs === null ? "Load outputs" : "Refresh"}
            </button>
          </div>

          {outputs !== null && (
            outputs.length === 0 ? (
              <p className="text-sm text-gray-600">No outputs saved yet.</p>
            ) : (
              <div className="space-y-2">
                {outputs.map((entry) => (
                  <div key={entry.id} className="border border-gray-800 rounded-md overflow-hidden">
                    <button
                      onClick={() => toggleOutputExpand(entry.id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm text-gray-200 capitalize">{entry.topic}</p>
                        <p className="text-xs text-gray-500">{entry.created_at ?? entry.id}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {entry.has_compiled
                          ? <span className="text-xs text-emerald-400">compiled ✓</span>
                          : <span className="text-xs text-gray-600">uncompiled only</span>
                        }
                        <span className="text-gray-500 text-sm">{expandedOutput === entry.id ? "▾" : "▸"}</span>
                      </div>
                    </button>

                    {expandedOutput === entry.id && (
                      <div className="border-t border-gray-800">
                        <OutputDetail data={outputData[entry.id]} hasCompiled={entry.has_compiled} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>

      </div>
    </main>
  );
}

// ── Panel toggle button ───────────────────────────────────────────────────────

function PanelToggle({ label, active, onClick, accent }: {
  label: string; active: boolean; onClick: () => void; accent?: boolean;
}) {
  const activeClass = accent
    ? "bg-emerald-900 border-emerald-700 text-emerald-300"
    : "bg-gray-700 border-gray-600 text-gray-200";
  const inactiveClass = "bg-gray-900 border-gray-800 text-gray-500 hover:text-gray-300";
  return (
    <button
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded border transition-colors ${active ? activeClass : inactiveClass}`}
    >
      {label}
    </button>
  );
}

// ── Output detail (uncompiled + compiled tabs) ────────────────────────────────

function OutputDetail({ data, hasCompiled }: {
  data?: { uncompiled?: object; compiled?: object };
  hasCompiled: boolean;
}) {
  const [tab, setTab] = useState<"uncompiled" | "compiled">("uncompiled");

  if (!data) {
    return <div className="px-4 py-3 text-xs text-gray-500">Loading…</div>;
  }

  const content = tab === "uncompiled" ? data.uncompiled : data.compiled;

  return (
    <div className="bg-gray-950">
      <div className="flex border-b border-gray-800">
        <TabBtn label="Uncompiled (SceneSpec)" active={tab === "uncompiled"} onClick={() => setTab("uncompiled")} />
        {hasCompiled && (
          <TabBtn label="Compiled (pixel coords)" active={tab === "compiled"} onClick={() => setTab("compiled")} accent />
        )}
      </div>
      {content ? (
        <pre className={`p-4 text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap ${
          tab === "compiled" ? "text-emerald-300" : "text-green-300"
        }`}>
          {JSON.stringify(content, null, 2)}
        </pre>
      ) : (
        <div className="px-4 py-3 text-xs text-gray-600">Not available</div>
      )}
    </div>
  );
}

function TabBtn({ label, active, onClick, accent }: {
  label: string; active: boolean; onClick: () => void; accent?: boolean;
}) {
  const activeClass = accent
    ? "border-b-2 border-emerald-500 text-emerald-300 bg-emerald-950/30"
    : "border-b-2 border-blue-500 text-blue-300";
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2.5 text-xs font-medium transition-colors ${
        active ? activeClass : "text-gray-500 hover:text-gray-300"
      }`}
    >
      {label}
    </button>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

const COLOR = {
  green:  { card: "bg-green-950 border-green-800",  value: "text-green-300" },
  yellow: { card: "bg-yellow-950 border-yellow-800", value: "text-yellow-300" },
  red:    { card: "bg-red-950 border-red-800",       value: "text-red-300" },
  blue:   { card: "bg-blue-950 border-blue-800",     value: "text-blue-300" },
} as const;

function Metric({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: keyof typeof COLOR;
}) {
  const c = COLOR[color];
  return (
    <div className={`${c.card} border rounded-md px-4 py-3 space-y-0.5`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-xl font-semibold ${c.value}`}>{value}</p>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}
