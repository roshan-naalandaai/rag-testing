import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompiledMeta {
  title: string;
  resolution: { width: number; height: number };
  duration: number;
  backgroundColor: string;
  fps: number;
}

interface TextAction {
  type: "text";
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  startTime: number;
  duration: number;
  animationType: "draw" | "fade" | "none";
}

interface ShapeAction {
  type: "shape";
  id: string;
  shape: "rectangle" | "circle" | "line";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  x2?: number;
  y2?: number;
  color: string;
  fill: boolean;
  startTime: number;
  duration: number;
}

interface SvgAction {
  type: "svgAnimation";
  id: string;
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  startTime: number;
  duration: number;
}

type AnyAction =
  | TextAction
  | ShapeAction
  | SvgAction
  | { type: string; startTime: number; [k: string]: unknown };

interface CompiledScene {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  background: string;
  actions: AnyAction[];
}

interface SvgAsset {
  id: string;
  url: string;
}

export interface CompiledProject {
  meta: CompiledMeta;
  assets?: {
    svgs?: SvgAsset[];
    audio?: unknown[];
    images?: unknown[];
  };
  scenes: CompiledScene[];
}

export interface VoiceoverEntry {
  scene_id: string;
  narration: string;
}

interface Props {
  project: CompiledProject;
  voiceover?: VoiceoverEntry[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NATIVE_W = 1920;
const NATIVE_H = 1080;

function hexToNum(hex: string): number {
  return parseInt((hex || "#ffffff").replace("#", ""), 16);
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SceneRenderer({ project, voiceover = [] }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixiRef = useRef<PixiState | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentScene, setCurrentScene] = useState<CompiledScene | null>(null);

  const rafRef = useRef<number | null>(null);
  const startWallRef = useRef<number | null>(null);
  const baseTimeRef = useRef<number>(0);

  const totalDuration = project.meta.duration;

  const resolveScene = useCallback(
    (t: number) =>
      project.scenes.find(
        (s) => t >= s.startTime && t < s.startTime + s.duration
      ) ?? null,
    [project.scenes]
  );

  // ── Init PixiJS once per project ──────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;

    (async () => {
      // Wait for web fonts (Caveat Brush) before initialising PixiJS so that
      // text metrics match what the compiler estimated.
      await document.fonts.ready;

      const PIXI = await import("pixi.js");
      if (cancelled || !canvasRef.current) return;

      const app = new PIXI.Application({
        view: canvasRef.current,
        width: NATIVE_W,
        height: NATIVE_H,
        backgroundColor: hexToNum(project.meta.backgroundColor || "#FFFFFF"),
        antialias: true,
        resolution: 1,
      });

      const state = new PixiState(app, PIXI as PixiModule);
      state.load(project);
      pixiRef.current = state;
      state.renderAt(0);
      setCurrentTime(0);
      setCurrentScene(resolveScene(0));
    })();

    return () => {
      cancelled = true;
      pixiRef.current?.destroy();
      pixiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // ── Render at time t ──────────────────────────────────────────────────────
  const renderAtTime = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(totalDuration, t));
      setCurrentTime(clamped);
      setCurrentScene(resolveScene(clamped));
      pixiRef.current?.renderAt(clamped);
    },
    [totalDuration, resolveScene]
  );

  // ── Playback loop ─────────────────────────────────────────────────────────
  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tick = useCallback(() => {
    if (startWallRef.current === null) return;
    const elapsed =
      baseTimeRef.current +
      (performance.now() - startWallRef.current) / 1000;
    if (elapsed >= totalDuration) {
      renderAtTime(totalDuration);
      setPlaying(false);
      stopLoop();
      return;
    }
    renderAtTime(elapsed);
    rafRef.current = requestAnimationFrame(tick);
  }, [renderAtTime, totalDuration, stopLoop]);

  const play = useCallback(() => {
    baseTimeRef.current = currentTime >= totalDuration ? 0 : currentTime;
    startWallRef.current = performance.now();
    setPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [currentTime, totalDuration, tick]);

  const pause = useCallback(() => {
    stopLoop();
    setPlaying(false);
    startWallRef.current = null;
  }, [stopLoop]);

  useEffect(() => () => stopLoop(), [stopLoop]);

  const onScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const t = parseFloat(e.target.value);
      baseTimeRef.current = t;
      if (playing) startWallRef.current = performance.now();
      renderAtTime(t);
    },
    [playing, renderAtTime]
  );

  const narration = currentScene
    ? (voiceover.find((v) => v.scene_id === currentScene.id)?.narration ?? null)
    : null;

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(1).padStart(4, "0");
    return `${m}:${sec}`;
  };

  return (
    <div className="flex flex-col gap-3">

      {/* ── Canvas: CSS scales it to full width, height auto-follows ── */}
      <div className="w-full rounded-lg overflow-hidden border border-gray-700">
        <canvas
          ref={canvasRef}
          width={NATIVE_W}
          height={NATIVE_H}
          style={{ display: "block", width: "100%", height: "auto" }}
        />
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={playing ? pause : play}
          className="w-20 shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-1.5 rounded transition-colors"
        >
          {playing ? "Pause" : currentTime >= totalDuration ? "Replay" : "Play"}
        </button>

        <input
          type="range"
          min={0}
          max={totalDuration}
          step={0.05}
          value={currentTime}
          onChange={onScrub}
          className="flex-1 accent-blue-500"
        />

        <span className="text-xs text-gray-400 tabular-nums shrink-0 w-20 text-right">
          {fmt(currentTime)} / {fmt(totalDuration)}
        </span>
      </div>

      {/* ── Scene label ── */}
      {currentScene && (
        <p className="text-xs text-gray-500">
          Scene:{" "}
          <span className="text-gray-300">{currentScene.name}</span>
        </p>
      )}

      {/* ── Voiceover caption ── */}
      {narration && (
        <div className="bg-gray-900 border border-gray-700 rounded-md px-4 py-3 text-sm text-gray-200 italic leading-relaxed">
          <span className="text-xs font-medium text-gray-500 not-italic block mb-1">
            Teacher
          </span>
          {narration}
        </div>
      )}
    </div>
  );
}

// ── PixiJS rendering engine ───────────────────────────────────────────────────

type PixiModule = typeof import("pixi.js");

interface SceneObjects {
  textItems: TextItem[];
  shapeItems: ShapeItem[];
  svgItems: SvgItem[];
}

interface TextItem {
  action: TextAction;
  sprite: import("pixi.js").Text;
}

interface ShapeItem {
  action: ShapeAction;
  gfx: import("pixi.js").Graphics;
}

interface SvgItem {
  action: SvgAction;
  sprite: import("pixi.js").Sprite;
}

class PixiState {
  private app: import("pixi.js").Application;
  private PIXI: PixiModule;
  private sceneObjects: Map<string, SceneObjects> = new Map();
  private _project: CompiledProject | null = null;

  constructor(app: import("pixi.js").Application, PIXI: PixiModule) {
    this.app = app;
    this.PIXI = PIXI;
  }

  load(project: CompiledProject) {
    this._project = project;
    const { PIXI, app } = this;
    app.stage.removeChildren();
    this.sceneObjects.clear();

    // Build a map from assetId → URL from project.assets.svgs
    const svgUrlMap = new Map<string, string>();
    for (const svgAsset of project.assets?.svgs ?? []) {
      svgUrlMap.set(svgAsset.id, svgAsset.url);
    }

    for (const scene of project.scenes) {
      const textItems: TextItem[] = [];
      const shapeItems: ShapeItem[] = [];
      const svgItems: SvgItem[] = [];

      for (const action of scene.actions) {
        if (action.type === "text") {
          const a = action as TextAction;
          const safeX = Math.max(0, a.x);
          const wrapWidth = NATIVE_W - safeX - 40;
          const style = new PIXI.TextStyle({
            fontFamily: "Caveat Brush, sans-serif",
            fontSize: a.fontSize,
            fill: a.color,
            wordWrap: true,
            wordWrapWidth: wrapWidth > 200 ? wrapWidth : NATIVE_W - 80,
          });
          const sprite = new PIXI.Text("", style);
          sprite.x = safeX;
          sprite.y = a.y;
          sprite.alpha = 0;
          sprite.visible = false;
          app.stage.addChild(sprite);
          textItems.push({ action: a, sprite });
        } else if (action.type === "shape") {
          const a = action as ShapeAction;
          const gfx = new PIXI.Graphics();
          gfx.alpha = 0;
          gfx.visible = false;
          app.stage.addChild(gfx);
          shapeItems.push({ action: a, gfx });
        } else if (action.type === "svgAnimation") {
          const a = action as SvgAction;
          const url = svgUrlMap.get(a.assetId) ?? "";
          if (url) {
            const sprite = PIXI.Sprite.from(url);
            sprite.x = a.x - a.width / 2;
            sprite.y = a.y - a.height / 2;
            sprite.width = a.width;
            sprite.height = a.height;
            sprite.alpha = 0;
            sprite.visible = false;
            app.stage.addChild(sprite);
            svgItems.push({ action: a, sprite });
          }
        }
      }

      this.sceneObjects.set(scene.id, { textItems, shapeItems, svgItems });
    }
  }

  renderAt(t: number) {
    if (!this._project) return;
    const { app } = this;

    const scene = this._project.scenes.find(
      (s) => t >= s.startTime && t < s.startTime + s.duration
    );

    // Set background colour directly on the renderer
    app.renderer.background.color = hexToNum(
      scene?.background || this._project.meta.backgroundColor || "#FFFFFF"
    );

    // Hide everything first, then show only the active scene
    for (const [sid, objs] of Array.from(this.sceneObjects.entries())) {
      const active = scene?.id === sid;

      for (const ti of objs.textItems) {
        if (!active) {
          ti.sprite.visible = false;
          continue;
        }
        const a = ti.action;
        const elapsed = t - a.startTime; // absolute time minus action's absolute startTime
        if (elapsed < 0) {
          ti.sprite.visible = false;
          continue;
        }
        ti.sprite.visible = true;
        if (a.animationType === "draw") {
          const progress = Math.min(1, elapsed / Math.max(0.01, a.duration));
          const chars = Math.round(progress * a.text.length);
          ti.sprite.text = a.text.substring(0, chars);
          ti.sprite.alpha = chars > 0 ? 1 : 0;
        } else if (a.animationType === "fade") {
          ti.sprite.text = a.text;
          const fadeDur = Math.min(0.6, a.duration * 0.4);
          ti.sprite.alpha = Math.min(1, elapsed / Math.max(0.01, fadeDur));
        } else {
          ti.sprite.text = a.text;
          ti.sprite.alpha = 1;
        }
      }

      for (const si of objs.shapeItems) {
        if (!active) {
          si.gfx.visible = false;
          continue;
        }
        const a = si.action;
        const elapsed = t - a.startTime;
        if (elapsed < 0) {
          si.gfx.visible = false;
          continue;
        }
        si.gfx.visible = true;
        const progress = Math.min(1, elapsed / Math.max(0.01, a.duration));
        this._drawShape(si.gfx, a, progress);
      }

      for (const sv of objs.svgItems) {
        if (!active) {
          sv.sprite.visible = false;
          continue;
        }
        const a = sv.action;
        const elapsed = t - a.startTime;
        if (elapsed < 0) {
          sv.sprite.visible = false;
          continue;
        }
        sv.sprite.visible = true;
        sv.sprite.alpha = Math.min(1, elapsed / Math.max(0.01, Math.min(0.5, a.duration * 0.3)));
      }
    }
  }

  private _drawShape(
    gfx: import("pixi.js").Graphics,
    a: ShapeAction,
    progress: number
  ) {
    gfx.clear();
    gfx.alpha = progress;
    const colorNum = hexToNum(a.color);

    if (a.fill) gfx.beginFill(colorNum);
    else gfx.lineStyle(5, colorNum, 1);

    if (a.shape === "rectangle") {
      const w = a.width ?? 300;
      const h = a.height ?? 150;
      gfx.drawRect(a.x - w / 2, a.y - h / 2, w, h);
    } else if (a.shape === "circle") {
      gfx.drawCircle(a.x, a.y, a.radius ?? 80);
    } else if (a.shape === "line") {
      const x2 = a.x2 ?? a.x + 300;
      const y2 = a.y2 ?? a.y;
      gfx.moveTo(a.x, a.y);
      gfx.lineTo(a.x + (x2 - a.x) * progress, a.y + (y2 - a.y) * progress);
    }

    if (a.fill) gfx.endFill();
  }

  destroy() {
    try { this.app.destroy(false); } catch { /* ignore */ }
  }
}
