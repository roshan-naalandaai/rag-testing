/**
 * TextPathAnimator - Converts text to vector paths and animates drawing
 * Uses opentype.js for font parsing and path extraction
 */

import { Graphics } from 'pixi.js';
import { audioManager } from './AudioManager';
import { FontRegistry } from './FontRegistry';

// opentype.js types (loaded via CDN)
declare const opentype: any;

export interface PathCommand {
  type: 'M' | 'L' | 'C' | 'Q' | 'Z';
  x?: number;
  y?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
}

export interface TextPathConfig {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  fontFamily?: string; // Now accepts font family name
  fontUrl?: string;    // Still support direct URL for override
}

export class TextPathAnimator {
  private static fontCache: Map<string, any> = new Map();
  private static readonly DEFAULT_FONT_FAMILY = 'CaveatBrush';

  private graphics: Graphics;
  private commands: PathCommand[] = [];
  private config: TextPathConfig;
  private lastDrawnIndex = -1;

  constructor(config: TextPathConfig) {
    this.config = config;
    this.graphics = new Graphics();
  }

  /**
   * Load font and convert text to path commands
   */
  public async loadAndPrepare(): Promise<void> {
    let fontUrl: string;

    // Priority: explicit fontUrl > fontFamily > default
    if (this.config.fontUrl) {
      // Direct URL provided (override)
      fontUrl = this.config.fontUrl;
    } else {
      // Resolve fontFamily to URL via registry
      const fontFamily = this.config.fontFamily || TextPathAnimator.DEFAULT_FONT_FAMILY;
      
      try {
        fontUrl = FontRegistry.getFontUrl(fontFamily);
      } catch (error) {
        // Font not found - show error and stop
        console.error(`❌ Font loading error: ${error}`);
        throw error;
      }
    }

    // Check cache first
    let font = TextPathAnimator.fontCache.get(fontUrl);

    if (!font) {
      // Load font
      try {
        font = await new Promise((resolve, reject) => {
          opentype.load(fontUrl, (err: any, loadedFont: any) => {
            if (err) {
              reject(new Error(`Failed to load font from ${fontUrl}: ${err.message || err}`));
            } else {
              resolve(loadedFont);
            }
          });
        });

        // Cache the font
        TextPathAnimator.fontCache.set(fontUrl, font);
        console.log(`✅ Font loaded successfully: ${fontUrl}`);
      } catch (error) {
        console.error(`❌ Font loading failed: ${error}`);
        throw error;
      }
    }

    // Convert text to path
    const path = font.getPath(
      this.config.text,
      this.config.x,
      this.config.y,
      this.config.fontSize
    );

    // Extract commands
    this.commands = path.commands.map((cmd: any) => {
      const command: PathCommand = {
        type: cmd.type,
      };

      if (cmd.x !== undefined) command.x = cmd.x;
      if (cmd.y !== undefined) command.y = cmd.y;
      if (cmd.x1 !== undefined) command.x1 = cmd.x1;
      if (cmd.y1 !== undefined) command.y1 = cmd.y1;
      if (cmd.x2 !== undefined) command.x2 = cmd.x2;
      if (cmd.y2 !== undefined) command.y2 = cmd.y2;

      return command;
    });

    // Some script fonts have negative left sidebearings, which can push glyph paths
    // left of the intended x (for example x=0 still renders at negative X).
    // Normalize path coordinates so the minimum X is at least 0.
    this.normalizeHorizontalBounds();
  }

  /**
   * Shift all path commands right if any command falls on negative X.
   * This keeps text visible when positioned at the left edge.
   */
  private normalizeHorizontalBounds(): void {
    if (this.commands.length === 0) return;

    let minX = Number.POSITIVE_INFINITY;
    for (const cmd of this.commands) {
      if (typeof cmd.x === 'number') minX = Math.min(minX, cmd.x);
      if (typeof cmd.x1 === 'number') minX = Math.min(minX, cmd.x1);
      if (typeof cmd.x2 === 'number') minX = Math.min(minX, cmd.x2);
    }

    if (!Number.isFinite(minX) || minX >= 0) return;

    const shiftX = -minX;
    this.commands = this.commands.map((cmd) => ({
      ...cmd,
      x: typeof cmd.x === 'number' ? cmd.x + shiftX : cmd.x,
      x1: typeof cmd.x1 === 'number' ? cmd.x1 + shiftX : cmd.x1,
      x2: typeof cmd.x2 === 'number' ? cmd.x2 + shiftX : cmd.x2,
    }));
  }

  /**
   * Draw the path progressively based on progress (0 to 1)
   */
  public drawProgress(progress: number): void {
    // Only skip if there are no commands at all
    if (this.commands.length === 0) {
      return;
    }

    // Cap currentIndex at the last valid index to ensure all commands are drawn at 100% progress
    const currentIndex = Math.min(
      Math.floor(progress * this.commands.length),
      this.commands.length - 1
    );

    // Clear and redraw from scratch
    this.graphics.clear();

    // Parse color (support hex format)
    const color = this.parseColor(this.config.color);

    this.graphics.moveTo(0, 0);

    // Draw all commands up to current index
    for (let i = 0; i <= currentIndex; i++) {
      const cmd = this.commands[i];

      // Play chalk sound for new drawing commands (not move or close)
      if (i > this.lastDrawnIndex) {
        if (cmd.type === 'L' || cmd.type === 'C' || cmd.type === 'Q') {
          audioManager.playChalkSound();
        }
      }

      // Execute drawing command
      switch (cmd.type) {
        case 'M':
          this.graphics.moveTo(cmd.x!, cmd.y!);
          break;
        case 'L':
          this.graphics.lineTo(cmd.x!, cmd.y!);
          break;
        case 'C':
          this.graphics.bezierCurveTo(
            cmd.x1!,
            cmd.y1!,
            cmd.x2!,
            cmd.y2!,
            cmd.x!,
            cmd.y!
          );
          break;
        case 'Q':
          this.graphics.quadraticCurveTo(cmd.x1!, cmd.y1!, cmd.x!, cmd.y!);
          break;
        case 'Z':
          this.graphics.closePath();
          break;
      }
    }

    // Stroke the path
    this.graphics.stroke({ width: 3, color: color });

    this.lastDrawnIndex = currentIndex;
  }

  /**
   * Parse color string to number
   */
  private parseColor(colorString: string): number {
    // Remove # if present
    const hex = colorString.replace('#', '');
    return parseInt(hex, 16);
  }

  /**
   * Get the Graphics object for rendering
   */
  public getGraphics(): Graphics {
    return this.graphics;
  }

  /**
   * Get total number of commands (for progress calculation)
   */
  public getCommandCount(): number {
    return this.commands.length;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.graphics.destroy();
    this.commands = [];
  }

  /**
   * Reset animation state
   */
  public reset(): void {
    this.lastDrawnIndex = -1;
    this.graphics.clear();
  }
}

