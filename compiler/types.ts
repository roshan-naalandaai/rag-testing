/**
 * Layout System Types
 * 
 * Defines the input format for the layout compiler and intermediate types
 * used during layout calculation.
 */

// =============================================================================
// LAYOUT SPECIFICATION TYPES (Input to Compiler)
// =============================================================================

/**
 * Position keywords for single element placement
 */
export type Position = 
  | 'center' 
  | 'left' 
  | 'right' 
  | 'top' 
  | 'bottom' 
  | 'top-left' 
  | 'top-right' 
  | 'bottom-left' 
  | 'bottom-right';

/**
 * Region names - predefined areas of the canvas
 */
export type Region = 
  | 'full'
  | 'top-half'
  | 'bottom-half'
  | 'left-half'
  | 'right-half'
  | 'left-third'
  | 'center-third'
  | 'right-third'
  | 'top-third'
  | 'middle-third'
  | 'bottom-third'
  | 'center'
  | 'main-content'
  | 'top-banner'
  | 'bottom-banner';

/**
 * Size hints for elements
 */
export type SizeHint = 'tiny' | 'small' | 'medium' | 'large' | 'xl' | 'fill' | 'auto';

/**
 * Flex direction for groups
 */
export type FlexDirection = 'row' | 'column';

/**
 * Justify content options (main axis distribution)
 */
export type JustifyContent = 
  | 'start' 
  | 'center' 
  | 'end' 
  | 'space-between' 
  | 'space-around' 
  | 'space-evenly';

/**
 * Align items options (cross axis alignment)
 */
export type AlignItems = 'start' | 'center' | 'end' | 'stretch';

/**
 * Sizing strategy for group items
 */
export type SizingStrategy = 'uniform' | 'intrinsic' | 'fill';

/**
 * Animation types for text
 */
export type TextAnimationType = 'fade' | 'typewriter' | 'draw' | 'none';

/**
 * Animation types for images
 */
export type ImageAnimationType = 'fade' | 'scale' | 'none';

// =============================================================================
// LAYOUT SPECS FOR DIFFERENT ELEMENT TYPES
// =============================================================================

/**
 * Layout specification for single positioned elements
 */
export interface SingleLayout {
  position: Position;
  region?: Region;
  size?: SizeHint;
  offset?: { x?: number; y?: number };
}

/**
 * Layout specification for groups (row/column)
 */
export interface GroupLayout {
  direction: FlexDirection;
  region?: Region;
  justify?: JustifyContent;
  align?: AlignItems;
  sizing?: SizingStrategy;
  gap?: number;
  padding?: number;
}

/**
 * Layout specification for lines/arrows connecting regions
 */
export interface ConnectionLayout {
  from: { region: Region; anchor: Position };
  to: { region: Region; anchor: Position };
}

// =============================================================================
// ELEMENT TYPES IN LAYOUT SPEC
// =============================================================================

/**
 * Base element properties
 */
interface BaseElement {
  startTime: number;
  duration: number;
}

/**
 * SVG element in layout spec
 */
export interface LayoutSvgElement extends BaseElement {
  type: 'svg';
  assetId: string;
  layout: SingleLayout;
}

/**
 * Text element in layout spec
 */
export interface LayoutTextElement extends BaseElement {
  type: 'text';
  text: string;
  color: string;
  fontSize?: number;
  fontFamily?: string;
  layout: SingleLayout;
  animationType?: TextAnimationType;
}

/**
 * Shape element in layout spec (circle, rectangle, ellipse, polygon)
 */
export interface LayoutShapeElement extends BaseElement {
  type: 'shape';
  shape: 'circle' | 'rectangle' | 'ellipse' | 'polygon';
  layout: SingleLayout;
  color: string;
  fill?: boolean;
  // For polygon, points are relative offsets from center
  points?: number[][];
}

/**
 * Line/Arrow element in layout spec
 */
export interface LayoutLineElement extends BaseElement {
  type: 'shape';
  shape: 'line' | 'arrow';
  layout: ConnectionLayout;
  color: string;
  strokeWidth?: number;
  arrowHeadSize?: number;
}

/**
 * Image element in layout spec
 */
export interface LayoutImageElement extends BaseElement {
  type: 'image';
  assetId: string;
  layout: SingleLayout;
  animationType?: ImageAnimationType;
}

/**
 * Group element containing multiple items
 */
export interface LayoutGroupElement {
  type: 'group';
  layout: GroupLayout;
  items: LayoutGroupItem[];
}

/**
 * Items that can be inside a group
 */
export interface LayoutGroupItem extends BaseElement {
  type: 'svg' | 'text' | 'image';
  assetId?: string;  // For svg/image
  text?: string;     // For text
  color?: string;    // For text
  fontSize?: number;
  fontFamily?: string;
  animationType?: TextAnimationType | ImageAnimationType;
}

/**
 * Union of all element types
 */
export type LayoutElement = 
  | LayoutSvgElement 
  | LayoutTextElement 
  | LayoutShapeElement 
  | LayoutLineElement
  | LayoutImageElement 
  | LayoutGroupElement;

// =============================================================================
// ASSET DEFINITIONS
// =============================================================================

export interface LayoutAssetSvg {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface LayoutAssetAudio {
  id: string;
  url: string;
}

export interface LayoutAssetImage {
  id: string;
  url: string;
  width?: number;
  height?: number;
}

export interface LayoutAssets {
  svgs?: LayoutAssetSvg[];
  audio?: LayoutAssetAudio[];
  images?: LayoutAssetImage[];
}

// =============================================================================
// SCENE AND PROJECT SPEC
// =============================================================================

export interface LayoutSceneAudio {
  assetId: string;
  volume?: number;
}

export interface LayoutScene {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  background?: string;
  audio?: LayoutSceneAudio;
  elements: LayoutElement[];
}

export interface LayoutMeta {
  title: string;
  version: string;
  resolution: {
    width: number;
    height: number;
  };
  fps: number;
  backgroundColor?: string;
}

/**
 * The complete layout specification (input to compiler)
 */
export interface LayoutSpec {
  meta: LayoutMeta;
  assets: LayoutAssets;
  scenes: LayoutScene[];
}

// =============================================================================
// INTERNAL TYPES FOR LAYOUT CALCULATION
// =============================================================================

/**
 * Bounding box for regions and elements
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Result of layout calculation for a single item
 */
export interface LayoutResult {
  x: number;
  y: number;
  width: number;
  height: number;
  scale?: number;
}

/**
 * Item with intrinsic dimensions (for layout calculation)
 */
export interface FlexItem {
  id: string;
  intrinsicWidth: number;
  intrinsicHeight: number;
  aspectRatio: number;
}
