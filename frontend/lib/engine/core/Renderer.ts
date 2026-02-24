import { Application, Container } from 'pixi.js';
import { ProjectMeta } from '../types';
import { GridOverlay } from '../utils/GridOverlay';

export class Renderer {
  public app: Application;
  public layers: Map<string, Container>;
  private canvasId: string;
  private meta: ProjectMeta;
  private gridOverlay: GridOverlay | null = null;
  private contentRoot: Container;
  private readonly SAFE_PADDING = 48;

  private readonly LAYER_NAMES = {
    BACKGROUND: 'background',
    STROKE: 'stroke',
    SHAPE: 'shape',
    TEXT: 'text',
    MEDIA: 'media',
    OVERLAY: 'overlay',
  };

  constructor(canvasId: string, meta: ProjectMeta) {
    // Create Pixi Application with WebGL (Canvas fallback automatic)
    this.app = new Application();
    this.layers = new Map();
    this.canvasId = canvasId;
    this.meta = meta;
    this.contentRoot = new Container();
  }

  public async initialize(): Promise<void> {
    // Check if we're in export mode (headless browser)
    const isExportMode = (window as any).__EXPORT_MODE__ === true;
    
    await this.app.init({
      width: this.meta.resolution.width,
      height: this.meta.resolution.height,
      backgroundColor: this.meta.backgroundColor || '#000000',
      antialias: true,
      resolution: isExportMode ? 1 : (window.devicePixelRatio || 1),
      autoDensity: !isExportMode,
      // In export mode, prefer WebGL over WebGPU for headless browser compatibility
      preference: isExportMode ? 'webgl' : undefined,
    });

    // Append canvas to DOM
    const container = document.getElementById(this.canvasId);
    if (container) {
      container.appendChild(this.app.canvas);
    }

    this.configureContentRoot();

    // Create fixed layer hierarchy
    this.createLayers();
    
    // Initialize grid overlay (hidden by default)
    this.initializeGrid();
  }

  private createLayers(): void {
    const layerOrder = [
      this.LAYER_NAMES.BACKGROUND,
      this.LAYER_NAMES.MEDIA,
      this.LAYER_NAMES.STROKE,
      this.LAYER_NAMES.SHAPE,
      this.LAYER_NAMES.TEXT,
      this.LAYER_NAMES.OVERLAY,
    ];

    for (const layerName of layerOrder) {
      const layer = new Container();
      layer.label = layerName;
      this.layers.set(layerName, layer);
      this.contentRoot.addChild(layer);
    }
  }

  private configureContentRoot(): void {
    const canvasW = this.meta.resolution.width;
    const canvasH = this.meta.resolution.height;
    const pad = this.SAFE_PADDING;

    const availableW = Math.max(1, canvasW - pad * 2);
    const availableH = Math.max(1, canvasH - pad * 2);
    const scale = Math.min(availableW / canvasW, availableH / canvasH);

    const scaledW = canvasW * scale;
    const scaledH = canvasH * scale;
    const offsetX = pad + (availableW - scaledW) / 2;
    const offsetY = pad + (availableH - scaledH) / 2;

    this.contentRoot.position.set(offsetX, offsetY);
    this.contentRoot.scale.set(scale);
    this.app.stage.addChild(this.contentRoot);
  }

  private initializeGrid(): void {
    this.gridOverlay = new GridOverlay({
      width: this.meta.resolution.width,
      height: this.meta.resolution.height,
      majorInterval: 100,
      minorInterval: 50,
    });
    
    // Add grid to overlay layer (on top of everything)
    const overlayLayer = this.getLayer(this.LAYER_NAMES.OVERLAY);
    if (overlayLayer) {
      overlayLayer.addChild(this.gridOverlay.getContainer());
    }
    
    // Hide by default
    this.gridOverlay.hide();
  }

  public getLayer(name: string): Container | undefined {
    return this.layers.get(name);
  }

  public clear(): void {
    for (const layer of Array.from(this.layers.values())) {
      layer.removeChildren();
    }
  }

  public resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
  }

  public destroy(): void {
    if (this.gridOverlay) {
      this.gridOverlay.destroy();
    }
    this.app.destroy(true, { children: true, texture: true });
  }

  public render(): void {
    this.app.renderer.render(this.app.stage);
  }

  // Grid overlay controls
  public toggleGrid(): void {
    if (this.gridOverlay) {
      this.gridOverlay.toggle();
    }
  }

  public showGrid(): void {
    if (this.gridOverlay) {
      this.gridOverlay.show();
    }
  }

  public hideGrid(): void {
    if (this.gridOverlay) {
      this.gridOverlay.hide();
    }
  }

  public isGridVisible(): boolean {
    return this.gridOverlay ? this.gridOverlay.isVisible() : false;
  }
}

