import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import dynamic from "next/dynamic";
import { VoiceoverEntry } from "@/components/WhiteboardRenderer";
const WhiteboardRenderer = dynamic(() => import("@/components/WhiteboardRenderer"), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────────

type Provider = "openai" | "claude" | "gemini";
type AgentMode = "single" | "multi";
type ProviderModels = Record<Provider, string[]>;

interface GenerateResponse {
  req_id: string;
  valid: boolean;
  errors: string[];
  scene_spec: object | null;   // uncompiled layout JSON
  compiled: object | null;
  compile_error: string | null;
  voiceover: VoiceoverEntry[];
  saved_id: string | null;
  latency_ms: number;
  agent_mode?: AgentMode;
  provider?: Provider;
  model?: string | null;
  agent_providers?: {
    planner: Provider;
    drafter: Provider;
    reviewer: Provider;
  } | null;
  agent_models?: {
    planner?: string | null;
    drafter?: string | null;
    reviewer?: string | null;
  } | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<Provider, string> = {
  openai: "OpenAI",
  claude: "Claude",
  gemini: "Gemini",
};

const PROVIDER_MODELS: ProviderModels = {
  openai: [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-5",
    "gpt-5-chat-latest",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5.1",
    "gpt-5.1-chat-latest",
    "gpt-5.1-codex",
    "gpt-5.1-codex-max",
    "gpt-5-pro",
    "gpt-5.2",
    "gpt-5.2-codex",
  ],
  claude: ["claude-sonnet-4-6", "claude-3-5-haiku-latest"],
  gemini: ["gemini-2.0-flash", "gemini-2.5-pro"],
};

const AGENT_MODE_LABELS: Record<AgentMode, string> = {
  single: "Single Agent",
  multi: "Multi Agent",
};

function formatMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function defaultModelFor(provider: Provider): string {
  return PROVIDER_MODELS[provider][0];
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [model, setModel] = useState<string>(defaultModelFor("openai"));
  const [agentMode, setAgentMode] = useState<AgentMode>("single");
  const [plannerModel, setPlannerModel] = useState<string>(defaultModelFor("openai"));
  const [drafterModel, setDrafterModel] = useState<string>(defaultModelFor("openai"));
  const [reviewerModel, setReviewerModel] = useState<string>(defaultModelFor("openai"));
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);

  const canSubmit = prompt.trim().length > 0 && !loading;

  async function handleGenerate() {
    setLoading(true);
    setFetchError(null);
    setResult(null);

    try {
      const res = await fetch("http://localhost:8000/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          provider,
          model: agentMode === "single" ? model : undefined,
          agent_mode: agentMode,
          planner_model: agentMode === "multi" ? plannerModel : undefined,
          drafter_model: agentMode === "multi" ? drafterModel : undefined,
          reviewer_model: agentMode === "multi" ? reviewerModel : undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        setFetchError(`Backend ${res.status}: ${text}`);
        return;
      }
      setResult(await res.json());
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">

        {/* ── Hero ── */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Lesson Generator</h1>
          <p className="text-muted-foreground text-sm">
            Ask any accounting question — get an animated whiteboard lesson with teacher narration.
          </p>
        </div>

        <Separator />

        {/* ── Input card ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generate a lesson</CardTitle>
            <CardDescription>
              Type a topic or question. The system will retrieve relevant curriculum content and produce a scene-by-scene lesson.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {/* Prompt */}
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canSubmit && handleGenerate()}
                placeholder="e.g. Explain the Entity Concept with an example"
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Select
                  value={provider}
                  onValueChange={(v) => {
                    const nextProvider = v as Provider;
                    setProvider(nextProvider);
                    setModel(defaultModelFor(nextProvider));
                    setPlannerModel(defaultModelFor(nextProvider));
                    setDrafterModel(defaultModelFor(nextProvider));
                    setReviewerModel(defaultModelFor(nextProvider));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="claude">Claude</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={agentMode} onValueChange={(v) => setAgentMode(v as AgentMode)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Agent mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single Agent</SelectItem>
                    <SelectItem value="multi">Multi Agent</SelectItem>
                  </SelectContent>
                </Select>

                {agentMode === "single" && (
                  <Select value={model} onValueChange={(v) => setModel(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Model" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_MODELS[provider].map((m) => (
                        <SelectItem key={`${provider}-${m}`} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {agentMode === "multi" && (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground font-medium">Planner</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select value={plannerModel} onValueChange={(v) => setPlannerModel(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Planner model" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDER_MODELS[provider].map((m) => (
                          <SelectItem key={`planner-${provider}-${m}`} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                      Provider: {PROVIDER_LABELS[provider]}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground font-medium">Drafter</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select value={drafterModel} onValueChange={(v) => setDrafterModel(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Drafter model" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDER_MODELS[provider].map((m) => (
                          <SelectItem key={`drafter-${provider}-${m}`} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                      Provider: {PROVIDER_LABELS[provider]}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground font-medium">Reviewer</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Select value={reviewerModel} onValueChange={(v) => setReviewerModel(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Reviewer model" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVIDER_MODELS[provider].map((m) => (
                          <SelectItem key={`reviewer-${provider}-${m}`} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                      Provider: {PROVIDER_LABELS[provider]}
                    </div>
                  </div>
                </div>
              )}

              {/* Submit */}
              <Button onClick={handleGenerate} disabled={!canSubmit} className="w-full md:w-48">
                {loading
                  ? <><Spinner /> Generating…</>
                  : "Generate Lesson"
                }
              </Button>
            </div>

            {/* Loading hint */}
            {loading && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Spinner className="text-primary" />
                Retrieving topics and calling {PROVIDER_LABELS[provider]} ({AGENT_MODE_LABELS[agentMode]})… this takes ~20–60s
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Fetch error ── */}
        {fetchError && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="pt-4 text-sm text-destructive-foreground">
              {fetchError}
            </CardContent>
          </Card>
        )}

        {/* ── Result ── */}
        {result && <ResultPanel result={result} />}

      </div>
    </div>
  );
}

// ── Result panel ───────────────────────────────────────────────────────────────

function ResultPanel({ result }: { result: GenerateResponse }) {
  return (
    <div className="space-y-6">

      {/* Status bar */}
      <Card className={result.valid ? "border-emerald-800/60" : "border-destructive/60"}>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${result.valid ? "bg-emerald-400" : "bg-red-400"}`} />
              <span className="font-medium text-sm">
                {result.valid ? "Lesson generated successfully" : "Generation failed"}
              </span>
              {result.saved_id && (
                <Badge variant="outline" className="text-xs font-mono">
                  {result.saved_id}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">{formatMs(result.latency_ms)}</Badge>
              {result.agent_mode && <Badge variant="outline">{AGENT_MODE_LABELS[result.agent_mode]}</Badge>}
              {result.agent_mode === "single" && result.provider && (
                <Badge variant="outline" className="text-xs">
                  {PROVIDER_LABELS[result.provider]} / {result.model || "default"}
                </Badge>
              )}
              {result.agent_mode === "multi" && result.agent_providers && (
                <Badge variant="outline" className="text-xs">
                  P:{PROVIDER_LABELS[result.agent_providers.planner]}/{result.agent_models?.planner || "default"} D:{PROVIDER_LABELS[result.agent_providers.drafter]}/{result.agent_models?.drafter || "default"} R:{PROVIDER_LABELS[result.agent_providers.reviewer]}/{result.agent_models?.reviewer || "default"}
                </Badge>
              )}
              {result.compiled && <Badge className="bg-emerald-900 text-emerald-300 hover:bg-emerald-900">compiled ✓</Badge>}
              {result.compile_error && <Badge variant="destructive">compile failed</Badge>}
              {result.req_id && (
                <Badge variant="outline" className="text-xs font-mono text-muted-foreground">
                  req: {result.req_id}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation errors */}
      {result.errors.length > 0 && (
        <Card className="border-destructive/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive">Validation Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {result.errors.map((err, i) => (
                <li key={i} className="text-xs font-mono bg-muted rounded px-3 py-2 text-muted-foreground">
                  {err}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Compile error */}
      {result.compile_error && (
        <Card className="border-yellow-800/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-yellow-500">Compile Error</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-32">
              <pre className="text-xs font-mono text-yellow-300 whitespace-pre-wrap">
                {result.compile_error}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Main content tabs */}
      <Tabs defaultValue={result.compiled ? "renderer" : "scene_spec"} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="renderer" disabled={!result.compiled}>
            Lesson Renderer
          </TabsTrigger>
          <TabsTrigger value="scene_spec" disabled={!result.scene_spec}>
            Layout Spec
          </TabsTrigger>
          <TabsTrigger value="compiled" disabled={!result.compiled}>
            Compiled JSON
          </TabsTrigger>
        </TabsList>

        {/* ── Renderer tab ── */}
        <TabsContent value="renderer" className="space-y-4">
          {result.compiled ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {(result.compiled as { meta?: { title?: string } }).meta?.title ?? "Lesson"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {(() => {
                    const c = result.compiled as { meta?: { duration?: number; resolution?: { width: number; height: number } }; scenes?: unknown[] };
                    return `${c.scenes?.length ?? 0} scenes · ${c.meta?.duration?.toFixed(1) ?? "?"}s total · ${c.meta?.resolution?.width ?? 1920}×${c.meta?.resolution?.height ?? 1080}`;
                  })()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <WhiteboardRenderer project={result.compiled} voiceover={result.voiceover} />
              </CardContent>
            </Card>
          ) : (
            <EmptyState message="No compiled output available." />
          )}

          {/* Voiceover script list */}
          {result.voiceover.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Teacher Script</CardTitle>
                <CardDescription className="text-xs">Full narration for all scenes</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-3 pr-3">
                    {result.voiceover.map((v, i) => (
                      <div key={i} className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground font-mono">{v.scene_id}</p>
                        <p className="text-sm italic leading-relaxed">{v.narration}</p>
                        {i < result.voiceover.length - 1 && <Separator className="mt-3" />}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Layout spec tab (uncompiled) ── */}
        <TabsContent value="scene_spec">
          {result.scene_spec ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Layout Spec (Uncompiled)</CardTitle>
                <CardDescription className="text-xs">
                  Semantic SceneSpec JSON — named regions, no pixel coordinates. Saved to{" "}
                  <code className="font-mono">outputs/uncompiled/</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[36rem]">
                  <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap pr-3">
                    {JSON.stringify(result.scene_spec, null, 2)}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <EmptyState message="No scene spec available." />
          )}
        </TabsContent>

        {/* ── Compiled JSON tab ── */}
        <TabsContent value="compiled">
          {result.compiled ? (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Compiled Project JSON</CardTitle>
                <CardDescription className="text-xs">
                  Pixel-coordinate render-ready JSON. Saved to{" "}
                  <code className="font-mono">outputs/compiled/</code>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[36rem]">
                  <pre className="text-xs font-mono text-blue-300 whitespace-pre-wrap pr-3">
                    {JSON.stringify(result.compiled, null, 2)}
                  </pre>
                </ScrollArea>
              </CardContent>
            </Card>
          ) : (
            <EmptyState message="No compiled output available." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Small reusable pieces ──────────────────────────────────────────────────────

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin ${className}`}
    />
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center text-sm text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  );
}
