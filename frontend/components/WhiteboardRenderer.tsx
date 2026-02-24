"use client";

import { useEffect, useRef, useState, useCallback, useId } from "react";

export interface VoiceoverEntry {
  scene_id: string;
  narration: string;
}

interface Props {
  project: object | null;
  voiceover?: VoiceoverEntry[];
}

interface TimeState {
  time: number;
  duration: number;
  progress: number;
  playing: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WhiteboardRenderer({ project, voiceover = [] }: Props) {
  const uid = useId().replace(/:/g, "");
  const containerId = `wb-canvas-${uid}`;

  // We store the engine in a ref (never triggers re-render on its own)
  const engineRef = useRef<import("@/lib/engine/core/Engine").Engine | null>(null);
  const audioInitRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeState, setTimeState] = useState<TimeState>({
    time: 0,
    duration: 0,
    progress: 0,
    playing: false,
  });

  // ── Load engine + project ────────────────────────────────────────────────

  useEffect(() => {
    if (!project) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setReady(false);
      setError(null);

      // Destroy previous engine
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
        // Clear the container so PixiJS can re-attach a fresh canvas
        const el = document.getElementById(containerId);
        if (el) el.innerHTML = "";
      }

      try {
        // Load opentype.js into window global (TextPathAnimator expects it)
        if (!(window as any).opentype) {
          const ot = await import("opentype.js");
          (window as any).opentype = ot.default ?? ot;
        }

        // Dynamically import the engine (browser-only)
        const { Engine } = await import("@/lib/engine/core/Engine");

        if (cancelled) return;

        const engine = new Engine({
          canvasId: containerId,
          project: project as any,
          renderMode: { type: "live" },
        });

        await engine.initialize();

        if (cancelled) {
          engine.destroy();
          return;
        }

        engine.onTimeUpdate((time) => {
          setTimeState({
            time,
            duration: engine.getDuration(),
            progress: engine.getProgress(),
            playing: engine.isPlaying(),
          });
        });

        engineRef.current = engine;
        setTimeState({
          time: 0,
          duration: engine.getDuration(),
          progress: 0,
          playing: false,
        });
        setReady(true);
      } catch (err: unknown) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // ── Playback controls ────────────────────────────────────────────────────

  const play = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!audioInitRef.current) {
      // AudioManager requires a user gesture before initialising
      import("@/lib/engine/utils/AudioManager").then(({ audioManager }) => {
        audioManager.initialize();
        audioInitRef.current = true;
      });
    }
    engine.play();
    setTimeState((s) => ({ ...s, playing: true }));
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    setTimeState((s) => ({ ...s, playing: false }));
  }, []);

  const restart = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!audioInitRef.current) {
      import("@/lib/engine/utils/AudioManager").then(({ audioManager }) => {
        audioManager.initialize();
        audioInitRef.current = true;
      });
    }
    engine.restart();
    setTimeState((s) => ({ ...s, playing: true }));
  }, []);

  const onScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const progress = parseFloat(e.target.value);
    engineRef.current?.seekToProgress(progress);
  }, []);

  const onSpeedChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    engineRef.current?.setSpeed(parseFloat(e.target.value));
  }, []);

  // ── Voiceover caption ────────────────────────────────────────────────────

  const currentNarration = (() => {
    if (!project || !voiceover.length) return null;
    const scenes = (project as { scenes?: Array<{ id: string; startTime: number; duration: number }> }).scenes ?? [];
    const t = timeState.time;
    const scene = scenes.find((s) => t >= s.startTime && t < s.startTime + s.duration);
    return scene ? (voiceover.find((v) => v.scene_id === scene.id)?.narration ?? null) : null;
  })();

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-3">
      {/* Canvas container — PixiJS appends its <canvas> inside this div.
          The canvas itself is 1920×1080; CSS scales it to fill the container. */}
      <div
        id={containerId}
        className="w-full rounded-lg overflow-hidden border border-gray-700 bg-black"
        style={{ aspectRatio: "16/9" }}
      >
        {/* PixiJS canvas is injected here; make it fill the container */}
        <style>{`#${containerId} canvas { width: 100% !important; height: 100% !important; display: block; }`}</style>
      </div>

      {/* Status / error */}
      {loading && (
        <p className="text-xs text-gray-400 animate-pulse">Loading renderer…</p>
      )}
      {error && (
        <p className="text-xs text-red-400">Render error: {error}</p>
      )}

      {/* Controls */}
      {ready && (
        <>
          <div className="flex items-center gap-3">
            <button
              onClick={timeState.playing ? pause : play}
              className="w-16 shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded transition-colors"
            >
              {timeState.playing ? "Pause" : "Play"}
            </button>

            <button
              onClick={restart}
              className="shrink-0 text-gray-400 hover:text-white text-sm px-2 py-1.5 rounded border border-gray-700 hover:border-gray-500 transition-colors"
            >
              ↺
            </button>

            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={timeState.progress}
              onChange={onScrub}
              className="flex-1 accent-blue-500"
            />

            <span className="text-xs text-gray-400 tabular-nums shrink-0 w-24 text-right">
              {fmt(timeState.time)} / {fmt(timeState.duration)}
            </span>

            <select
              onChange={onSpeedChange}
              defaultValue="1"
              className="bg-gray-800 text-gray-300 text-xs border border-gray-700 rounded px-2 py-1"
            >
              <option value="0.5">0.5×</option>
              <option value="1">1×</option>
              <option value="1.5">1.5×</option>
              <option value="2">2×</option>
            </select>
          </div>

          {/* Voiceover caption */}
          {currentNarration && (
            <div className="bg-gray-900 border border-gray-700 rounded-md px-4 py-3 text-sm text-gray-200 italic leading-relaxed">
              <span className="text-xs font-medium text-gray-500 not-italic block mb-1">
                Teacher
              </span>
              {currentNarration}
            </div>
          )}
        </>
      )}
    </div>
  );
}
