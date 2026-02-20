/**
 * Layout Module
 * 
 * Provides automatic positioning and sizing for whiteboard animations.
 * 
 * Usage:
 * ```typescript
 * import { compileLayout } from './layout';
 * 
 * const layoutSpec = { ... };  // Your layout specification
 * const project = compileLayout(layoutSpec);  // Compiled project JSON
 * ```
 */

// Core layout engine
export { FlexLayout } from './FlexLayout';

// Compiler
export { LayoutCompiler, compileLayout } from './LayoutCompiler';

// Types
export type {
  // Layout specification types
  Position,
  Region,
  SizeHint,
  FlexDirection,
  JustifyContent,
  AlignItems,
  SizingStrategy,
  TextAnimationType,
  ImageAnimationType,
  
  // Layout specs
  SingleLayout,
  GroupLayout,
  ConnectionLayout,
  
  // Element types
  LayoutSvgElement,
  LayoutTextElement,
  LayoutShapeElement,
  LayoutLineElement,
  LayoutImageElement,
  LayoutGroupElement,
  LayoutGroupItem,
  LayoutElement,
  
  // Asset types
  LayoutAssetSvg,
  LayoutAssetAudio,
  LayoutAssetImage,
  LayoutAssets,
  
  // Scene and project
  LayoutSceneAudio,
  LayoutScene,
  LayoutMeta,
  LayoutSpec,
  
  // Internal types (useful for extending)
  BoundingBox,
  LayoutResult,
  FlexItem,
} from './types';
