// Project JSON structure types

export interface ProjectMeta {
  title: string;
  version: string;
  resolution: {
    width: number;
    height: number;
  };
  fps: number;
  duration: number;
  backgroundColor?: string;
}

export interface AssetDefinition {
  id: string;
  type: 'image' | 'video' | 'audio' | 'svg';
  url: string;
}

export interface Assets {
  images?: AssetDefinition[];
  videos?: AssetDefinition[];
  audio?: AssetDefinition[];
  svgs?: AssetDefinition[];
}

export interface StrokeAction {
  type: 'stroke';
  id: string;
  path: number[][]; // Array of [x, y] points
  style: 'chalk' | 'marker';
  color: string;
  width: number;
  startTime: number;
  duration: number;
  seed?: number;
}

export interface ShapeAction {
  type: 'shape';
  id: string;
  shape: 'circle' | 'rectangle' | 'ellipse' | 'polygon' | 'line' | 'arrow';
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  points?: number[][];
  // Properties for line and arrow
  x2?: number;           // End x coordinate for line/arrow
  y2?: number;           // End y coordinate for line/arrow
  strokeWidth?: number;  // Line thickness (default: 2)
  arrowHeadSize?: number; // Arrow head size (default: 15)
  color: string;
  fill: boolean;
  startTime: number;
  duration: number;
}

export interface TextAction {
  type: 'text';
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily?: string;
  color: string;
  startTime: number;
  duration: number;
  animationType?: 'fade' | 'typewriter' | 'draw' | 'none';
}

export interface ImageAction {
  type: 'image';
  id: string;
  assetId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  startTime: number;
  duration: number;
  animationType?: 'fade' | 'scale' | 'none';
}

export interface VideoAction {
  type: 'video';
  id: string;
  assetId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  startTime: number;
  duration: number;
  volume?: number;
}

export interface AudioAction {
  type: 'audio';
  id: string;
  assetId: string;
  startTime: number;
  volume?: number;
}

export interface SvgAnimationAction {
  type: 'svgAnimation';
  id: string;
  assetId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  scale?: number;
  startTime: number;
  duration: number;
}

export type Action = StrokeAction | ShapeAction | TextAction | ImageAction | VideoAction | AudioAction | SvgAnimationAction;

export interface Scene {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  actions: Action[];
  background?: string;
}

export interface Project {
  meta: ProjectMeta;
  assets: Assets;
  scenes: Scene[];
}

// Runtime types

export interface RenderMode {
  type: 'live' | 'export';
  frameRate?: number;
}

export interface StrokeStyle {
  name: string;
  baseWidth: number;
  noiseAmplitude: number;
  opacityBehavior: 'constant' | 'fade' | 'pressure';
  pressureVariation: number;
}

export interface LayerNames {
  BACKGROUND: string;
  STROKE: string;
  SHAPE: string;
  TEXT: string;
  MEDIA: string;
  OVERLAY: string;
}

export interface EngineConfig {
  canvasId: string;
  project: Project;
  renderMode: RenderMode;
}

