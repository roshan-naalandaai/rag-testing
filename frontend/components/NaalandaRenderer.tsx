import { useEffect, useRef, useState, useCallback } from "react";

export interface VoiceoverEntry {
  scene_id: string;
  narration: string;
}

interface Props {
  project: object | null;
  voiceover?: VoiceoverEntry[];
  naalandaUrl?: string;
}

interface TimeState {
  time: number;
  duration: number;
  progress: number;
}

const NAALANDA_URL = "http://localhost:3001";

export default function NaalandaRenderer({
  project,
  voiceover = [],
  naalandaUrl = NAALANDA_URL,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [timeState, setTimeState] = useState<TimeState>({ time: 0, duration: 0, progress: 0 });
  const pendingProjectRef = useRef<object | null>(null);

  const sendProject = useCallback((proj: object) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "NAALANDA_LOAD_PROJECT", project: proj },
      "*"
    );
  }, []);

  // Listen for messages from the iframe
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data?.type) return;

      if (data.type === "NAALANDA_IFRAME_READY") {
        setIframeReady(true);
        // If we already have a project queued, send it now
        if (pendingProjectRef.current) {
          sendProject(pendingProjectRef.current);
          pendingProjectRef.current = null;
        }
      }

      if (data.type === "NAALANDA_READY") {
        setEngineReady(true);
      }

      if (data.type === "NAALANDA_TIME") {
        setTimeState({
          time: data.time ?? 0,
          duration: data.duration ?? 0,
          progress: data.progress ?? 0,
        });
      }

      if (data.type === "NAALANDA_ERROR") {
        console.error("Naalanda engine error:", data.error);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [sendProject]);

  // When project changes, send it to the iframe
  useEffect(() => {
    if (!project) return;
    setEngineReady(false);

    if (iframeReady) {
      sendProject(project);
    } else {
      // Iframe not ready yet — queue it
      pendingProjectRef.current = project;
    }
  }, [project, iframeReady, sendProject]);

  // Find current narration based on scene — approximated by time
  // The compiled project has scenes with startTime, we find which scene we're in
  const currentNarration = (() => {
    if (!project || !voiceover.length) return null;
    const scenes = (project as { scenes?: Array<{ id: string; startTime: number; duration: number }> }).scenes ?? [];
    const t = timeState.time;
    const activeScene = scenes.find((s) => t >= s.startTime && t < s.startTime + s.duration);
    if (!activeScene) return null;
    return voiceover.find((v) => v.scene_id === activeScene.id)?.narration ?? null;
  })();

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Status bar */}
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span
          className={`w-2 h-2 rounded-full ${
            engineReady ? "bg-green-500" : iframeReady ? "bg-yellow-500" : "bg-gray-600"
          }`}
        />
        <span>
          {engineReady
            ? `Ready · ${fmt(timeState.time)} / ${fmt(timeState.duration)}`
            : iframeReady
            ? "Loading project…"
            : "Connecting to renderer…"}
        </span>
      </div>

      {/* Iframe — the naalanda engine fills this */}
      <div className="w-full rounded-lg overflow-hidden border border-gray-700 bg-black">
        <iframe
          ref={iframeRef}
          src={naalandaUrl}
          style={{ width: "100%", height: "540px", border: "none", display: "block" }}
          allow="autoplay"
          title="Naalanda Whiteboard Renderer"
        />
      </div>

      {/* Progress bar (mirror of iframe's own progress, for voiceover sync) */}
      {engineReady && timeState.duration > 0 && (
        <div className="h-1 w-full rounded bg-gray-700 overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-100"
            style={{ width: `${timeState.progress * 100}%` }}
          />
        </div>
      )}

      {/* Voiceover caption */}
      {currentNarration && (
        <div className="bg-gray-900 border border-gray-700 rounded-md px-4 py-3 text-sm text-gray-200 italic leading-relaxed">
          <span className="text-xs font-medium text-gray-500 not-italic block mb-1">
            Teacher
          </span>
          {currentNarration}
        </div>
      )}
    </div>
  );
}
