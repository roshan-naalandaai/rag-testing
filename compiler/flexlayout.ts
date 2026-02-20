/**
 * FlexLayout - Core layout calculation engine
 * 
 * Handles automatic positioning and sizing of elements based on
 * semantic layout specifications (regions, positions, flex distribution).
 */

import {
  Position,
  Region,
  SizeHint,
  FlexDirection,
  JustifyContent,
  AlignItems,
  SizingStrategy,
  SingleLayout,
  GroupLayout,
  ConnectionLayout,
  BoundingBox,
  LayoutResult,
  FlexItem,
} from './types';
import { FontRegistry } from './utils/fontRegistry';

/**
 * Size ratios for different size hints (as fraction of region)
 */
const SIZE_RATIOS: Record<SizeHint, number> = {
  tiny: 0.1,
  small: 0.2,
  medium: 0.35,
  large: 0.5,
  xl: 0.7,
  fill: 0.9,
  auto: 0.35, // Default to medium
};

/**
 * FlexLayout class - handles all layout calculations
 */
export class FlexLayout {
  private canvasWidth: number;
  private canvasHeight: number;

  constructor(width: number = 1920, height: number = 1080) {
    this.canvasWidth = width;
    this.canvasHeight = height;
  }

  // ===========================================================================
  // REGION CALCULATIONS
  // ===========================================================================

  /**
   * Get bounding box for a named region
   */
  getRegionBounds(region: Region): BoundingBox {
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    const regions: Record<Region, BoundingBox> = {
      'full': { x: 0, y: 0, width: w, height: h },
      'top-half': { x: 0, y: 0, width: w, height: h * 0.5 },
      'bottom-half': { x: 0, y: h * 0.5, width: w, height: h * 0.5 },
      'left-half': { x: 0, y: 0, width: w * 0.5, height: h },
      'right-half': { x: w * 0.5, y: 0, width: w * 0.5, height: h },
      'left-third': { x: 0, y: 0, width: w / 3, height: h },
      'center-third': { x: w / 3, y: 0, width: w / 3, height: h },
      'right-third': { x: (2 * w) / 3, y: 0, width: w / 3, height: h },
      'top-third': { x: 0, y: 0, width: w, height: h / 3 },
      'middle-third': { x: 0, y: h / 3, width: w, height: h / 3 },
      'bottom-third': { x: 0, y: (2 * h) / 3, width: w, height: h / 3 },
      'center': { x: w * 0.15, y: h * 0.15, width: w * 0.7, height: h * 0.7 },
      'main-content': { x: w * 0.05, y: h * 0.15, width: w * 0.9, height: h * 0.7 },
      'top-banner': { x: 0, y: 0, width: w, height: h * 0.2 },
      'bottom-banner': { x: 0, y: h * 0.8, width: w, height: h * 0.2 },
    };

    return regions[region] || regions['full'];
  }

  /**
   * Get anchor point within a region
   */
  getAnchorPoint(region: Region, anchor: Position): { x: number; y: number } {
    const bounds = this.getRegionBounds(region);
    return this.getPositionInBounds(bounds, anchor, 0, 0);
  }

  // ===========================================================================
  // SINGLE ELEMENT LAYOUT
  // ===========================================================================

  /**
   * Calculate layout for a single element
   */
  layoutSingle(
    layout: SingleLayout,
    intrinsicWidth: number,
    intrinsicHeight: number
  ): LayoutResult {
    const region = this.getRegionBounds(layout.region || 'full');
    const padding = 50;

    // Calculate target size based on size hint
    const sizeRatio = SIZE_RATIOS[layout.size || 'medium'];
    const aspectRatio = intrinsicWidth / intrinsicHeight;

    let targetWidth: number;
    let targetHeight: number;

    // Calculate size maintaining aspect ratio
    const maxWidth = region.width * sizeRatio;
    const maxHeight = region.height * sizeRatio;

    if (aspectRatio >= 1) {
      // Wider than tall
      targetWidth = Math.min(maxWidth, maxHeight * aspectRatio);
      targetHeight = targetWidth / aspectRatio;
    } else {
      // Taller than wide
      targetHeight = Math.min(maxHeight, maxWidth / aspectRatio);
      targetWidth = targetHeight * aspectRatio;
    }

    // Calculate scale
    const scale = targetWidth / intrinsicWidth;

    // Calculate position within region
    const pos = this.getPositionInBounds(
      region,
      layout.position,
      targetWidth,
      targetHeight,
      padding
    );

    // Apply offset if specified
    const offsetX = layout.offset?.x || 0;
    const offsetY = layout.offset?.y || 0;

    return {
      x: pos.x + offsetX,
      y: pos.y + offsetY,
      width: targetWidth,
      height: targetHeight,
      scale,
    };
  }

  /**
   * Calculate layout for text (auto-sizes based on text length)
   */
  layoutText(
    layout: SingleLayout,
    text: string,
    fontSize: number = 72,
    fontFamily: string = 'Caveat'
  ): LayoutResult {
    // Estimate text dimensions
    const charWidthRatio = this.getFontWidthRatio(fontFamily);
    const estimatedWidth = text.length * fontSize * charWidthRatio;
    const estimatedHeight = fontSize * 1.2;

    const region = this.getRegionBounds(layout.region || 'full');
    const padding = 50;

    // Calculate position
    const pos = this.getPositionInBounds(
      region,
      layout.position,
      estimatedWidth,
      estimatedHeight,
      padding
    );

    // Apply offset
    const offsetX = layout.offset?.x || 0;
    const offsetY = layout.offset?.y || 0;

    return {
      x: pos.x + offsetX,
      y: pos.y + offsetY,
      width: estimatedWidth,
      height: estimatedHeight,
    };
  }

  /**
   * Calculate layout for a line or arrow connecting two points
   */
  layoutConnection(layout: ConnectionLayout): {
    x: number;
    y: number;
    x2: number;
    y2: number;
  } {
    const fromPoint = this.getAnchorPoint(layout.from.region, layout.from.anchor);
    const toPoint = this.getAnchorPoint(layout.to.region, layout.to.anchor);

    return {
      x: fromPoint.x,
      y: fromPoint.y,
      x2: toPoint.x,
      y2: toPoint.y,
    };
  }

  // ===========================================================================
  // GROUP LAYOUT (ROW/COLUMN DISTRIBUTION)
  // ===========================================================================

  /**
   * Calculate layout for multiple items in a group (row or column)
   */
  layoutGroup(
    layout: GroupLayout,
    items: FlexItem[]
  ): Map<string, LayoutResult> {
    if (items.length === 0) {
      return new Map();
    }

    const region = this.getRegionBounds(layout.region || 'full');
    const padding = layout.padding ?? 50;
    const gap = layout.gap ?? 30;

    // Apply padding to get content area
    const contentArea: BoundingBox = {
      x: region.x + padding,
      y: region.y + padding,
      width: region.width - 2 * padding,
      height: region.height - 2 * padding,
    };

    // Calculate item sizes
    const sizes = this.calculateGroupItemSizes(
      items,
      contentArea,
      layout.direction,
      layout.sizing || 'uniform',
      gap
    );

    // Calculate positions along main axis
    const positions = this.calculateGroupPositions(
      sizes,
      contentArea,
      layout.direction,
      layout.justify || 'center',
      gap
    );

    // Apply cross-axis alignment
    return this.applyGroupAlignment(
      items,
      sizes,
      positions,
      contentArea,
      layout.direction,
      layout.align || 'center'
    );
  }

  // ===========================================================================
  // PRIVATE HELPER METHODS
  // ===========================================================================

  /**
   * Get position within a bounding box based on position keyword
   */
  private getPositionInBounds(
    bounds: BoundingBox,
    position: Position,
    elementWidth: number,
    elementHeight: number,
    padding: number = 0
  ): { x: number; y: number } {
    const positions: Record<Position, { x: number; y: number }> = {
      center: {
        x: bounds.x + (bounds.width - elementWidth) / 2,
        y: bounds.y + (bounds.height - elementHeight) / 2,
      },
      left: {
        x: bounds.x + padding,
        y: bounds.y + (bounds.height - elementHeight) / 2,
      },
      right: {
        x: bounds.x + bounds.width - elementWidth - padding,
        y: bounds.y + (bounds.height - elementHeight) / 2,
      },
      top: {
        x: bounds.x + (bounds.width - elementWidth) / 2,
        y: bounds.y + padding,
      },
      bottom: {
        x: bounds.x + (bounds.width - elementWidth) / 2,
        y: bounds.y + bounds.height - elementHeight - padding,
      },
      'top-left': {
        x: bounds.x + padding,
        y: bounds.y + padding,
      },
      'top-right': {
        x: bounds.x + bounds.width - elementWidth - padding,
        y: bounds.y + padding,
      },
      'bottom-left': {
        x: bounds.x + padding,
        y: bounds.y + bounds.height - elementHeight - padding,
      },
      'bottom-right': {
        x: bounds.x + bounds.width - elementWidth - padding,
        y: bounds.y + bounds.height - elementHeight - padding,
      },
    };

    return positions[position] || positions.center;
  }

  /**
   * Get font width ratio for text size estimation
   */
  private getFontWidthRatio(fontFamily: string): number {
    // Use FontRegistry for width ratios
    return FontRegistry.getCharWidthRatio(fontFamily);
  }

  /**
   * Calculate sizes for items in a group
   */
  private calculateGroupItemSizes(
    items: FlexItem[],
    contentArea: BoundingBox,
    direction: FlexDirection,
    sizing: SizingStrategy,
    gap: number
  ): Array<{ width: number; height: number; scale: number }> {
    const n = items.length;
    const isRow = direction === 'row';
    const mainAxisSize = isRow ? contentArea.width : contentArea.height;
    const crossAxisSize = isRow ? contentArea.height : contentArea.width;

    // Calculate available space
    const totalGapSpace = (n - 1) * gap;
    const availableForItems = mainAxisSize - totalGapSpace;

    switch (sizing) {
      case 'uniform': {
        // All items same size
        const itemMainSize = availableForItems / n;

        // Calculate average aspect ratio
        const avgAspectRatio =
          items.reduce((sum, i) => sum + i.aspectRatio, 0) / n;

        let finalWidth: number;
        let finalHeight: number;

        if (isRow) {
          finalWidth = Math.min(itemMainSize, crossAxisSize * avgAspectRatio * 0.8);
          finalHeight = finalWidth / avgAspectRatio;

          // Ensure height fits
          if (finalHeight > crossAxisSize * 0.8) {
            finalHeight = crossAxisSize * 0.8;
            finalWidth = finalHeight * avgAspectRatio;
          }
        } else {
          finalHeight = Math.min(itemMainSize, (crossAxisSize / avgAspectRatio) * 0.8);
          finalWidth = finalHeight * avgAspectRatio;

          // Ensure width fits
          if (finalWidth > crossAxisSize * 0.8) {
            finalWidth = crossAxisSize * 0.8;
            finalHeight = finalWidth / avgAspectRatio;
          }
        }

        return items.map((item) => ({
          width: finalWidth,
          height: finalHeight,
          scale: finalWidth / item.intrinsicWidth,
        }));
      }

      case 'intrinsic': {
        // Each item at its natural ratio, scaled to fit
        const totalIntrinsicMain = items.reduce(
          (sum, item) => sum + (isRow ? item.intrinsicWidth : item.intrinsicHeight),
          0
        );

        const maxCrossIntrinsic = Math.max(
          ...items.map((i) => (isRow ? i.intrinsicHeight : i.intrinsicWidth))
        );

        const scaleFactor = Math.min(
          availableForItems / totalIntrinsicMain,
          (crossAxisSize * 0.8) / maxCrossIntrinsic
        );

        return items.map((item) => ({
          width: item.intrinsicWidth * scaleFactor,
          height: item.intrinsicHeight * scaleFactor,
          scale: scaleFactor,
        }));
      }

      case 'fill':
      default: {
        // Fill available space equally
        const itemMainSize = availableForItems / n;

        return items.map((item) => {
          let width: number;
          let height: number;

          if (isRow) {
            width = itemMainSize;
            height = Math.min(width / item.aspectRatio, crossAxisSize * 0.8);
            width = height * item.aspectRatio;
          } else {
            height = itemMainSize;
            width = Math.min(height * item.aspectRatio, crossAxisSize * 0.8);
            height = width / item.aspectRatio;
          }

          return {
            width,
            height,
            scale: width / item.intrinsicWidth,
          };
        });
      }
    }
  }

  /**
   * Calculate positions for items along main axis
   */
  private calculateGroupPositions(
    sizes: Array<{ width: number; height: number }>,
    contentArea: BoundingBox,
    direction: FlexDirection,
    justify: JustifyContent,
    gap: number
  ): Array<{ x: number; y: number }> {
    const n = sizes.length;
    const isRow = direction === 'row';
    const mainAxisSize = isRow ? contentArea.width : contentArea.height;

    // Calculate total size of all items
    const totalItemMain = sizes.reduce(
      (sum, s) => sum + (isRow ? s.width : s.height),
      0
    );

    const positions: Array<{ x: number; y: number }> = [];
    let mainPos: number;
    let effectiveGap = gap;

    switch (justify) {
      case 'start':
        mainPos = 0;
        break;

      case 'end':
        mainPos = mainAxisSize - totalItemMain - (n - 1) * gap;
        break;

      case 'center':
        mainPos = (mainAxisSize - totalItemMain - (n - 1) * gap) / 2;
        break;

      case 'space-between':
        mainPos = 0;
        effectiveGap = n > 1 ? (mainAxisSize - totalItemMain) / (n - 1) : 0;
        break;

      case 'space-around':
        effectiveGap = (mainAxisSize - totalItemMain) / n;
        mainPos = effectiveGap / 2;
        break;

      case 'space-evenly':
        effectiveGap = (mainAxisSize - totalItemMain) / (n + 1);
        mainPos = effectiveGap;
        break;

      default:
        mainPos = (mainAxisSize - totalItemMain - (n - 1) * gap) / 2;
    }

    for (let i = 0; i < n; i++) {
      const size = sizes[i];

      if (isRow) {
        positions.push({
          x: contentArea.x + mainPos,
          y: contentArea.y, // Will be adjusted by alignment
        });
        mainPos += size.width + effectiveGap;
      } else {
        positions.push({
          x: contentArea.x, // Will be adjusted by alignment
          y: contentArea.y + mainPos,
        });
        mainPos += size.height + effectiveGap;
      }
    }

    return positions;
  }

  /**
   * Apply cross-axis alignment to positioned items
   */
  private applyGroupAlignment(
    items: FlexItem[],
    sizes: Array<{ width: number; height: number; scale: number }>,
    positions: Array<{ x: number; y: number }>,
    contentArea: BoundingBox,
    direction: FlexDirection,
    align: AlignItems
  ): Map<string, LayoutResult> {
    const results = new Map<string, LayoutResult>();
    const isRow = direction === 'row';
    const crossAxisSize = isRow ? contentArea.height : contentArea.width;

    items.forEach((item, i) => {
      const size = sizes[i];
      const pos = { ...positions[i] };

      const itemCross = isRow ? size.height : size.width;
      let crossOffset: number;

      switch (align) {
        case 'start':
          crossOffset = 0;
          break;
        case 'end':
          crossOffset = crossAxisSize - itemCross;
          break;
        case 'stretch':
          // For stretch, we'd resize the item - for now, treat as center
          crossOffset = (crossAxisSize - itemCross) / 2;
          break;
        case 'center':
        default:
          crossOffset = (crossAxisSize - itemCross) / 2;
          break;
      }

      if (isRow) {
        pos.y += crossOffset;
      } else {
        pos.x += crossOffset;
      }

      results.set(item.id, {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
        scale: size.scale,
      });
    });

    return results;
  }
}
