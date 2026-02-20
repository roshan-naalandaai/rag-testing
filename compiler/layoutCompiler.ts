
/**
 * LayoutCompiler - Transforms layout specifications into project JSON
 * 
 * Takes a semantic layout spec (with regions, positions, flex groups)
 * and compiles it into the final project format with calculated coordinates.
 */

import { FlexLayout } from './FlexLayout';
import {
  LayoutSpec,
  LayoutScene,
  LayoutElement,
  LayoutSvgElement,
  LayoutTextElement,
  LayoutShapeElement,
  LayoutLineElement,
  LayoutImageElement,
  LayoutGroupElement,
  LayoutGroupItem,
  LayoutAssets,
  FlexItem,
  SingleLayout,
  ConnectionLayout,
} from './types';

// =============================================================================
// OUTPUT TYPES (matching project.schema.json)
// =============================================================================

interface ProjectMeta {
  title: string;
  version: string;
  resolution: { width: number; height: number };
  fps: number;
  duration: number;
  backgroundColor?: string;
}

interface ProjectAsset {
  id: string;
  type: 'image' | 'video' | 'audio' | 'svg';
  url: string;
}

interface ProjectAssets {
  images?: ProjectAsset[];
  videos?: ProjectAsset[];
  audio?: ProjectAsset[];
  svgs?: ProjectAsset[];
}

interface ActionBase {
  type: string;
  id: string;
  startTime: number;
}

interface SvgAnimationAction extends ActionBase {
  type: 'svgAnimation';
  assetId: string;
  x: number;
  y: number;
  scale: number;
  duration: number;
}

interface TextAction extends ActionBase {
  type: 'text';
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  duration: number;
  animationType: 'fade' | 'typewriter' | 'draw' | 'none';
}

interface ShapeAction extends ActionBase {
  type: 'shape';
  shape: 'circle' | 'rectangle' | 'ellipse' | 'polygon' | 'line' | 'arrow';
  x: number;
  y: number;
  color: string;
  fill: boolean;
  duration: number;
  // Optional properties based on shape type
  radius?: number;
  width?: number;
  height?: number;
  points?: number[][];
  x2?: number;
  y2?: number;
  strokeWidth?: number;
  arrowHeadSize?: number;
}

interface ImageAction extends ActionBase {
  type: 'image';
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  duration: number;
  animationType?: 'fade' | 'scale' | 'none';
}

interface AudioAction extends ActionBase {
  type: 'audio';
  assetId: string;
  volume: number;
}

type Action = SvgAnimationAction | TextAction | ShapeAction | ImageAction | AudioAction;

interface ProjectScene {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  background?: string;
  actions: Action[];
}

interface Project {
  meta: ProjectMeta;
  assets: ProjectAssets;
  scenes: ProjectScene[];
}

// =============================================================================
// COMPILER CLASS
// =============================================================================

/**
 * Default values for compilation
 */
const DEFAULTS = {
  fontSize: 72,
  fontFamily: 'CaveatBrush',
  textAnimationType: 'draw' as const,
  imageAnimationType: 'fade' as const,
  strokeWidth: 3,
  arrowHeadSize: 15,
  audioVolume: 1.0,
};

export class LayoutCompiler {
  private layout: FlexLayout;
  private assetDimensions: Map<string, { width: number; height: number }>;
  private idCounter: number = 0;

  constructor(width: number = 1920, height: number = 1080) {
    this.layout = new FlexLayout(width, height);
    this.assetDimensions = new Map();
  }

  /**
   * Compile a layout specification into a project
   */
  compile(spec: LayoutSpec): Project {
    // Reset counter for each compilation
    this.idCounter = 0;

    // Build asset dimensions map
    this.buildAssetDimensionsMap(spec.assets);

    // Calculate total duration from scenes
    const totalDuration = this.calculateTotalDuration(spec.scenes);

    // Compile assets
    const assets = this.compileAssets(spec.assets);

    // Compile scenes
    const scenes = spec.scenes.map((scene) => this.compileScene(scene));

    return {
      meta: {
        title: spec.meta.title,
        version: spec.meta.version,
        resolution: spec.meta.resolution,
        fps: spec.meta.fps,
        duration: totalDuration,
        backgroundColor: spec.meta.backgroundColor,
      },
      assets,
      scenes,
    };
  }

  // ===========================================================================
  // ASSET HANDLING
  // ===========================================================================

  private buildAssetDimensionsMap(assets: LayoutAssets): void {
    this.assetDimensions.clear();

    if (assets.svgs) {
      for (const svg of assets.svgs) {
        this.assetDimensions.set(svg.id, { width: svg.width, height: svg.height });
      }
    }

    if (assets.images) {
      for (const img of assets.images) {
        if (img.width && img.height) {
          this.assetDimensions.set(img.id, { width: img.width, height: img.height });
        }
      }
    }
  }

  private compileAssets(assets: LayoutAssets): ProjectAssets {
    const result: ProjectAssets = {};

    if (assets.svgs && assets.svgs.length > 0) {
      result.svgs = assets.svgs.map((svg) => ({
        id: svg.id,
        type: 'svg' as const,
        url: svg.url,
      }));
    }

    if (assets.audio && assets.audio.length > 0) {
      result.audio = assets.audio.map((a) => ({
        id: a.id,
        type: 'audio' as const,
        url: a.url,
      }));
    }

    if (assets.images && assets.images.length > 0) {
      result.images = assets.images.map((img) => ({
        id: img.id,
        type: 'image' as const,
        url: img.url,
      }));
    }

    return result;
  }

  private getAssetDimensions(assetId: string): { width: number; height: number } {
    return this.assetDimensions.get(assetId) || { width: 100, height: 100 };
  }

  // ===========================================================================
  // SCENE COMPILATION
  // ===========================================================================

  private calculateTotalDuration(scenes: LayoutScene[]): number {
    if (scenes.length === 0) return 0;
    
    return Math.max(
      ...scenes.map((scene) => scene.startTime + scene.duration)
    );
  }

  private compileScene(scene: LayoutScene): ProjectScene {
    const actions: Action[] = [];

    // Add audio action if present
    if (scene.audio) {
      actions.push({
        type: 'audio',
        id: scene.audio.assetId,
        assetId: scene.audio.assetId,
        startTime: scene.startTime,
        volume: scene.audio.volume ?? DEFAULTS.audioVolume,
      });
    }

    // Compile each element
    for (const element of scene.elements) {
      const compiledActions = this.compileElement(element, scene.startTime);
      actions.push(...compiledActions);
    }

    return {
      id: scene.id,
      name: scene.name,
      startTime: scene.startTime,
      duration: scene.duration,
      background: scene.background,
      actions,
    };
  }

  // ===========================================================================
  // ELEMENT COMPILATION
  // ===========================================================================

  private compileElement(element: LayoutElement, sceneStartTime: number): Action[] {
    switch (element.type) {
      case 'svg':
        return [this.compileSvgElement(element, sceneStartTime)];

      case 'text':
        return [this.compileTextElement(element, sceneStartTime)];

      case 'shape':
        if (element.shape === 'line' || element.shape === 'arrow') {
          return [this.compileLineElement(element as LayoutLineElement, sceneStartTime)];
        }
        return [this.compileShapeElement(element as LayoutShapeElement, sceneStartTime)];

      case 'image':
        return [this.compileImageElement(element, sceneStartTime)];

      case 'group':
        return this.compileGroupElement(element, sceneStartTime);

      default:
        return [];
    }
  }

  private compileSvgElement(element: LayoutSvgElement, sceneStartTime: number): SvgAnimationAction {
    const dimensions = this.getAssetDimensions(element.assetId);
    const layoutResult = this.layout.layoutSingle(
      element.layout,
      dimensions.width,
      dimensions.height
    );

    return {
      type: 'svgAnimation',
      id: this.generateId(element.assetId),
      assetId: element.assetId,
      x: Math.round(layoutResult.x),
      y: Math.round(layoutResult.y),
      scale: layoutResult.scale || 1,
      startTime: sceneStartTime + element.startTime,
      duration: element.duration,
    };
  }

  private compileTextElement(element: LayoutTextElement, sceneStartTime: number): TextAction {
    const fontSize = element.fontSize || DEFAULTS.fontSize;
    const fontFamily = element.fontFamily || DEFAULTS.fontFamily;

    const layoutResult = this.layout.layoutText(
      element.layout,
      element.text,
      fontSize,
      fontFamily
    );

    return {
      type: 'text',
      id: this.generateId('text'),
      text: element.text,
      x: Math.round(layoutResult.x),
      y: Math.round(layoutResult.y),
      fontSize,
      fontFamily,
      color: element.color,
      startTime: sceneStartTime + element.startTime,
      duration: element.duration,
      animationType: element.animationType || DEFAULTS.textAnimationType,
    };
  }

  private compileShapeElement(element: LayoutShapeElement, sceneStartTime: number): ShapeAction {
    // For shapes, we need to calculate size based on the layout
    const layoutResult = this.layout.layoutSingle(
      element.layout,
      100, // Default intrinsic size for shapes
      100
    );

    const baseAction: ShapeAction = {
      type: 'shape',
      id: this.generateId(element.shape),
      shape: element.shape,
      x: Math.round(layoutResult.x + layoutResult.width / 2), // Center position
      y: Math.round(layoutResult.y + layoutResult.height / 2),
      color: element.color,
      fill: element.fill ?? true,
      startTime: sceneStartTime + element.startTime,
      duration: element.duration,
    };

    // Add shape-specific properties
    switch (element.shape) {
      case 'circle':
        baseAction.radius = Math.min(layoutResult.width, layoutResult.height) / 2;
        break;

      case 'rectangle':
        baseAction.width = layoutResult.width;
        baseAction.height = layoutResult.height;
        break;

      case 'ellipse':
        baseAction.width = layoutResult.width;
        baseAction.height = layoutResult.height;
        break;

      case 'polygon':
        if (element.points) {
          // Scale and offset points relative to center
          const centerX = layoutResult.x + layoutResult.width / 2;
          const centerY = layoutResult.y + layoutResult.height / 2;
          const scale = layoutResult.scale || 1;

          baseAction.points = element.points.map((p) => [
            centerX + p[0] * scale,
            centerY + p[1] * scale,
          ]);
        }
        break;
    }

    return baseAction;
  }

  private compileLineElement(element: LayoutLineElement, sceneStartTime: number): ShapeAction {
    const connectionLayout = element.layout as ConnectionLayout;
    const points = this.layout.layoutConnection(connectionLayout);

    return {
      type: 'shape',
      id: this.generateId(element.shape),
      shape: element.shape,
      x: Math.round(points.x),
      y: Math.round(points.y),
      x2: Math.round(points.x2),
      y2: Math.round(points.y2),
      color: element.color,
      fill: element.shape === 'arrow',
      strokeWidth: element.strokeWidth || DEFAULTS.strokeWidth,
      arrowHeadSize: element.shape === 'arrow' ? (element.arrowHeadSize || DEFAULTS.arrowHeadSize) : undefined,
      startTime: sceneStartTime + element.startTime,
      duration: element.duration,
    };
  }

  private compileImageElement(element: LayoutImageElement, sceneStartTime: number): ImageAction {
    const dimensions = this.getAssetDimensions(element.assetId);
    const layoutResult = this.layout.layoutSingle(
      element.layout,
      dimensions.width || 400,
      dimensions.height || 300
    );

    return {
      type: 'image',
      id: this.generateId(element.assetId),
      assetId: element.assetId,
      x: Math.round(layoutResult.x + layoutResult.width / 2), // Image uses center anchor
      y: Math.round(layoutResult.y + layoutResult.height / 2),
      width: Math.round(layoutResult.width),
      height: Math.round(layoutResult.height),
      startTime: sceneStartTime + element.startTime,
      duration: element.duration,
      animationType: element.animationType || DEFAULTS.imageAnimationType,
    };
  }

  private compileGroupElement(element: LayoutGroupElement, sceneStartTime: number): Action[] {
    const actions: Action[] = [];

    // Build FlexItem array from group items
    const flexItems: FlexItem[] = element.items.map((item, index) => {
      let intrinsicWidth = 100;
      let intrinsicHeight = 100;

      if (item.type === 'svg' || item.type === 'image') {
        if (item.assetId) {
          const dims = this.getAssetDimensions(item.assetId);
          intrinsicWidth = dims.width;
          intrinsicHeight = dims.height;
        }
      } else if (item.type === 'text' && item.text) {
        const fontSize = item.fontSize || DEFAULTS.fontSize;
        const fontFamily = item.fontFamily || DEFAULTS.fontFamily;
        const charWidthRatio = 0.55; // Approximate
        intrinsicWidth = item.text.length * fontSize * charWidthRatio;
        intrinsicHeight = fontSize * 1.2;
      }

      return {
        id: `group-item-${index}`,
        intrinsicWidth,
        intrinsicHeight,
        aspectRatio: intrinsicWidth / intrinsicHeight,
      };
    });

    // Calculate group layout
    const layoutResults = this.layout.layoutGroup(element.layout, flexItems);

    // Compile each item with its calculated position
    element.items.forEach((item, index) => {
      const flexItemId = `group-item-${index}`;
      const result = layoutResults.get(flexItemId);

      if (!result) return;

      const action = this.compileGroupItem(item, result, sceneStartTime);
      if (action) {
        actions.push(action);
      }
    });

    return actions;
  }

  private compileGroupItem(
    item: LayoutGroupItem,
    layoutResult: { x: number; y: number; width: number; height: number; scale?: number },
    sceneStartTime: number
  ): Action | null {
    switch (item.type) {
      case 'svg':
        if (!item.assetId) return null;
        return {
          type: 'svgAnimation',
          id: this.generateId(item.assetId),
          assetId: item.assetId,
          x: Math.round(layoutResult.x),
          y: Math.round(layoutResult.y),
          scale: layoutResult.scale || 1,
          startTime: sceneStartTime + item.startTime,
          duration: item.duration,
        };

      case 'text':
        if (!item.text) return null;
        return {
          type: 'text',
          id: this.generateId('text'),
          text: item.text,
          x: Math.round(layoutResult.x),
          y: Math.round(layoutResult.y),
          fontSize: item.fontSize || DEFAULTS.fontSize,
          fontFamily: item.fontFamily || DEFAULTS.fontFamily,
          color: item.color || '#FFFFFF',
          startTime: sceneStartTime + item.startTime,
          duration: item.duration,
          animationType: (item.animationType as 'fade' | 'typewriter' | 'draw' | 'none') || DEFAULTS.textAnimationType,
        };

      case 'image':
        if (!item.assetId) return null;
        return {
          type: 'image',
          id: this.generateId(item.assetId),
          assetId: item.assetId,
          x: Math.round(layoutResult.x + layoutResult.width / 2),
          y: Math.round(layoutResult.y + layoutResult.height / 2),
          width: Math.round(layoutResult.width),
          height: Math.round(layoutResult.height),
          startTime: sceneStartTime + item.startTime,
          duration: item.duration,
          animationType: (item.animationType as 'fade' | 'scale' | 'none') || DEFAULTS.imageAnimationType,
        };

      default:
        return null;
    }
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  private generateId(prefix: string): string {
    return `${prefix}-${this.idCounter++}`;
  }
}

// =============================================================================
// CONVENIENCE FUNCTION
// =============================================================================

/**
 * Compile a layout specification to project JSON
 */
export function compileLayout(spec: LayoutSpec): Project {
  const compiler = new LayoutCompiler(
    spec.meta.resolution.width,
    spec.meta.resolution.height
  );
  return compiler.compile(spec);
}
