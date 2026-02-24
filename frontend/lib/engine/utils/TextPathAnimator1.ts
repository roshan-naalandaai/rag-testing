/**
 * TextPathAnimator - Converts text to vector paths and animates drawing
 * Uses opentype.js for font parsing and path extraction
 * 
 * Uses a mask-based approach: draws filled text masked by a progressive
 * thick stroke, creating the effect of "drawing" solid filled text.
 */

import { Graphics, Container } from 'pixi.js';
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

  private container: Container;      // Container holding filled text + mask
  private fillGraphics: Graphics;    // The full filled text
  private maskGraphics: Graphics;    // Progressive stroke used as mask
  private graphics: Graphics;        // Keep for backward compatibility (returns container)
  private commands: PathCommand[] = [];
  private config: TextPathConfig;
  private lastDrawnIndex = -1;
  private fillDrawn = false;         // Track if fill has been drawn

  constructor(config: TextPathConfig) {
    this.config = config;
    
    // Create container to hold the masked text
    this.container = new Container();
    
    // Create the filled text graphics (will be masked)
    this.fillGraphics = new Graphics();
    
    // Create the mask graphics (thick progressive stroke)
    this.maskGraphics = new Graphics();
    
    // Set up the mask relationship
    this.fillGraphics.mask = this.maskGraphics;
    
    // Add both to container (mask must be in display list)
    this.container.addChild(this.fillGraphics);
    this.container.addChild(this.maskGraphics);
    
    // For backward compatibility
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
  }

  /**
   * Draw the path progressively based on progress (0 to 1)
   * Uses mask-based approach: filled text is revealed by a progressive thick stroke
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

    // Parse color (support hex format)
    const color = this.parseColor(this.config.color);

    // Draw the full filled text once (optimization - only draw on first call)
    if (!this.fillDrawn) {
      this.fillGraphics.clear();
      
      for (const cmd of this.commands) {
        switch (cmd.type) {
          case 'M':
            this.fillGraphics.moveTo(cmd.x!, cmd.y!);
            break;
          case 'L':
            this.fillGraphics.lineTo(cmd.x!, cmd.y!);
            break;
          case 'C':
            this.fillGraphics.bezierCurveTo(
              cmd.x1!,
              cmd.y1!,
              cmd.x2!,
              cmd.y2!,
              cmd.x!,
              cmd.y!
            );
            break;
          case 'Q':
            this.fillGraphics.quadraticCurveTo(cmd.x1!, cmd.y1!, cmd.x!, cmd.y!);
            break;
          case 'Z':
            this.fillGraphics.closePath();
            break;
        }
      }
      
      // Fill the complete text path
      this.fillGraphics.fill({ color: color });
      this.fillDrawn = true;
    }

    // Clear and redraw the mask stroke progressively
    this.maskGraphics.clear();

    // Calculate stroke width based on font size (thicker = better coverage)
    // Use a generous width to ensure the filled text is fully revealed
    const maskStrokeWidth = Math.max(this.config.fontSize * 0.25, 8);

    // Draw all commands up to current index for the mask
    for (let i = 0; i <= currentIndex; i++) {
      const cmd = this.commands[i];

      // Play chalk sound for new drawing commands (not move or close)
      if (i > this.lastDrawnIndex) {
        if (cmd.type === 'L' || cmd.type === 'C' || cmd.type === 'Q') {
          audioManager.playChalkSound();
        }
      }

      // Execute drawing command on mask
      switch (cmd.type) {
        case 'M':
          this.maskGraphics.moveTo(cmd.x!, cmd.y!);
          break;
        case 'L':
          this.maskGraphics.lineTo(cmd.x!, cmd.y!);
          break;
        case 'C':
          this.maskGraphics.bezierCurveTo(
            cmd.x1!,
            cmd.y1!,
            cmd.x2!,
            cmd.y2!,
            cmd.x!,
            cmd.y!
          );
          break;
        case 'Q':
          this.maskGraphics.quadraticCurveTo(cmd.x1!, cmd.y1!, cmd.x!, cmd.y!);
          break;
        case 'Z':
          this.maskGraphics.closePath();
          break;
      }
    }

    // Stroke the mask path with a thick white stroke
    // The color doesn't matter for masking, only the shape
    this.maskGraphics.stroke({ 
      width: maskStrokeWidth, 
      color: 0xffffff,
      cap: 'round',
      join: 'round'
    });

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
   * Get the Container object for rendering (contains masked filled text)
   */
  public getGraphics(): Container {
    return this.container;
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
    this.fillGraphics.destroy();
    this.maskGraphics.destroy();
    this.container.destroy();
    this.graphics.destroy();
    this.commands = [];
  }

  /**
   * Reset animation state
   */
  public reset(): void {
    this.lastDrawnIndex = -1;
    this.fillDrawn = false;
    this.fillGraphics.clear();
    this.maskGraphics.clear();
  }
}

