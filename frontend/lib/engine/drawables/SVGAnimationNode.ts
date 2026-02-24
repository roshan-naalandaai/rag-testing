/**
 * SVGAnimationNode - Handles animated drawing of SVG shapes
 * Progressively draws SVG paths with chalk sound effects
 */

import { Graphics, Container } from 'pixi.js';
import { SVGShape, PathCommand } from '../utils/SVGPathParser';
import { ChalkSoundGenerator } from '../utils/ChalkSoundGenerator';

export class SVGAnimationNode {
  public container: Container;
  private graphics: Graphics;
  private shapes: SVGShape[];
  private currentProgress: number = 0;
  private chalkSound: ChalkSoundGenerator;
  private lastDrawnShapeIndex: number = -1;

  constructor(shapes: SVGShape[], chalkSound: ChalkSoundGenerator) {
    this.shapes = shapes;
    this.chalkSound = chalkSound;
    
    this.container = new Container();
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
  }

  /**
   * Update the drawing progress (0 to 1)
   */
  public updateProgress(progress: number): void {
    this.currentProgress = Math.max(0, Math.min(1, progress));
    this.redraw();
  }

  /**
   * Redraw the shapes based on current progress
   */
  private redraw(): void {
    this.graphics.clear();

    const totalShapes = this.shapes.length;
    if (totalShapes === 0) return;

    // Calculate which shape we're currently drawing
    const currentShapeIndex = Math.floor(this.currentProgress * totalShapes);
    
    // Play chalk sound when starting a new shape
    if (currentShapeIndex > this.lastDrawnShapeIndex && this.chalkSound.isInitialized()) {
      this.chalkSound.playChalkSound();
      this.lastDrawnShapeIndex = currentShapeIndex;
    }

    // Draw all completed shapes
    for (let i = 0; i < currentShapeIndex; i++) {
      this.drawShape(this.shapes[i], 1.0);
    }

    // Draw the current shape partially
    if (currentShapeIndex < totalShapes) {
      const shapeProgress = (this.currentProgress * totalShapes) - currentShapeIndex;
      this.drawShape(this.shapes[currentShapeIndex], shapeProgress);
    }
  }

  /**
   * Draw a single shape with given progress
   */
  private drawShape(shape: SVGShape, progress: number): void {
    // Skip rendering if progress is too small (prevents stroke blips)
    // When progress is tiny, the rendered geometry is barely visible but can 
    // create visual artifacts as new shapes start animating
    if (progress < 0.01) return;
    
    // Draw the shape geometry
    if (shape.type === 'circle' && shape.circle) {
      // Draw circle with progress
      this.drawCircleWithProgress(shape.circle, progress);
    } else if (shape.commands) {
      // Draw path commands with progress
      this.drawPathWithProgress(shape.commands, progress);
    }

    // Apply fill styling if the shape has a fill
    if (shape.fill !== 'none') {
      this.graphics.fill({
        color: this.parseColor(shape.fill),
        alpha: shape.opacity
      });
    }

    // Apply stroke styling if the shape has a stroke (new v8 API)
    if (shape.stroke !== 'none') {
      const strokeColor = this.parseColor(shape.stroke);
      this.graphics.stroke({
        width: shape.strokeWidth || 2,
        color: strokeColor,
        alpha: shape.opacity
      });
    }
  }

  /**
   * Draw circle with progress (as arc)
   */
  private drawCircleWithProgress(
    circle: { cx: number; cy: number; r: number },
    progress: number
  ): void {
    const endAngle = progress * Math.PI * 2;
    
    // CRITICAL: Move to the arc's starting point first
    // This prevents connecting from the previous shape's endpoint
    this.graphics.moveTo(
      circle.cx + circle.r,
      circle.cy
    );
    
    this.graphics.arc(circle.cx, circle.cy, circle.r, 0, endAngle);
    
    if (progress >= 1.0) {
      this.graphics.closePath();
    }
  }

  /**
   * Draw path commands with progress
   */
  private drawPathWithProgress(commands: PathCommand[], progress: number): void {
    if (commands.length === 0) return;

    const totalCommands = commands.length;
    const currentCommandIndex = Math.floor(progress * totalCommands);
    const commandProgress = (progress * totalCommands) - currentCommandIndex;

    let lastControlPoint: { x: number; y: number } | null = null;

    // Draw all completed commands
    for (let i = 0; i <= currentCommandIndex && i < totalCommands; i++) {
      const cmd = commands[i];
      const prevCmd = i > 0 ? commands[i - 1] : null;
      const isLastCommand = i === currentCommandIndex;
      const partialProgress = isLastCommand ? commandProgress : 1.0;

      this.executeCommand(cmd, prevCmd, lastControlPoint, partialProgress);

      // Update last control point for smooth curves
      if (cmd.code === 'C' && cmd.x2 !== undefined && cmd.y2 !== undefined) {
        lastControlPoint = { x: cmd.x2, y: cmd.y2 };
      } else if (cmd.code === 'Q' && cmd.x1 !== undefined && cmd.y1 !== undefined) {
        lastControlPoint = { x: cmd.x1, y: cmd.y1 };
      } else if (cmd.code !== 'S' && cmd.code !== 'T') {
        lastControlPoint = null;
      }
    }
  }

  /**
   * Execute a single path command
   */
  private executeCommand(
    cmd: PathCommand,
    prevCmd: PathCommand | null,
    lastControlPoint: { x: number; y: number } | null,
    progress: number
  ): void {
    const x = cmd.x ?? 0;
    const y = cmd.y ?? 0;

    switch (cmd.code) {
      case 'M':
        this.graphics.moveTo(x, y);
        break;

      case 'L':
      case 'H':
      case 'V':
        if (progress < 1.0 && prevCmd && prevCmd.x !== undefined && prevCmd.y !== undefined) {
          const startX = prevCmd.x;
          const startY = prevCmd.y;
          const partialX = startX + (x - startX) * progress;
          const partialY = startY + (y - startY) * progress;
          this.graphics.lineTo(partialX, partialY);
        } else {
          this.graphics.lineTo(x, y);
        }
        break;

      case 'C':
        if (cmd.x1 !== undefined && cmd.y1 !== undefined && 
            cmd.x2 !== undefined && cmd.y2 !== undefined) {
          this.graphics.bezierCurveTo(cmd.x1, cmd.y1, cmd.x2, cmd.y2, x, y);
        }
        break;

      case 'S':
        if (cmd.x2 !== undefined && cmd.y2 !== undefined && cmd.x0 !== undefined && cmd.y0 !== undefined) {
          let x1 = cmd.x0;
          let y1 = cmd.y0;
          if (lastControlPoint && prevCmd) {
            x1 = 2 * cmd.x0 - lastControlPoint.x;
            y1 = 2 * cmd.y0 - lastControlPoint.y;
          }
          this.graphics.bezierCurveTo(x1, y1, cmd.x2, cmd.y2, x, y);
        }
        break;

      case 'Q':
        if (cmd.x1 !== undefined && cmd.y1 !== undefined) {
          this.graphics.quadraticCurveTo(cmd.x1, cmd.y1, x, y);
        }
        break;

      case 'T':
        if (cmd.x0 !== undefined && cmd.y0 !== undefined) {
          let x1 = cmd.x0;
          let y1 = cmd.y0;
          if (lastControlPoint && prevCmd) {
            x1 = 2 * cmd.x0 - lastControlPoint.x;
            y1 = 2 * cmd.y0 - lastControlPoint.y;
          }
          this.graphics.quadraticCurveTo(x1, y1, x, y);
        }
        break;

      case 'A':
        if (cmd.rx !== undefined && cmd.ry !== undefined) {
          this.drawEllipticalArc(cmd);
        }
        break;

      case 'Z':
      case 'z':
        this.graphics.closePath();
        break;
    }
  }

  /**
   * Draw elliptical arc (SVG arc to canvas conversion)
   */
  private drawEllipticalArc(cmd: PathCommand): void {
    const { rx, ry, xAxisRotation, largeArc, sweep, x0, y0, x, y } = cmd;
    
    if (!rx || !ry || !x || !y || x0 === undefined || y0 === undefined) return;

    // Fallback to line if radii too small
    if (rx < 0.01 || ry < 0.01) {
      this.graphics.lineTo(x, y);
      return;
    }

    const rotation = ((xAxisRotation || 0) * Math.PI) / 180;
    const dx = (x0 - x) / 2;
    const dy = (y0 - y) / 2;

    const cosRot = Math.cos(rotation);
    const sinRot = Math.sin(rotation);

    const x1Prime = cosRot * dx + sinRot * dy;
    const y1Prime = -sinRot * dx + cosRot * dy;

    let rxAbs = Math.abs(rx);
    let ryAbs = Math.abs(ry);

    const lambda = (x1Prime * x1Prime) / (rxAbs * rxAbs) + (y1Prime * y1Prime) / (ryAbs * ryAbs);
    if (lambda > 1) {
      rxAbs *= Math.sqrt(lambda);
      ryAbs *= Math.sqrt(lambda);
    }

    const sign = largeArc !== sweep ? 1 : -1;
    const sq = Math.max(
      0,
      (rxAbs * rxAbs * ryAbs * ryAbs - rxAbs * rxAbs * y1Prime * y1Prime - ryAbs * ryAbs * x1Prime * x1Prime) /
        (rxAbs * rxAbs * y1Prime * y1Prime + ryAbs * ryAbs * x1Prime * x1Prime)
    );
    const coef = sign * Math.sqrt(sq);

    const cxPrime = coef * ((rxAbs * y1Prime) / ryAbs);
    const cyPrime = coef * (-(ryAbs * x1Prime) / rxAbs);

    const cx = cosRot * cxPrime - sinRot * cyPrime + (x0 + x) / 2;
    const cy = sinRot * cxPrime + cosRot * cyPrime + (y0 + y) / 2;

    const theta1 = Math.atan2((y1Prime - cyPrime) / ryAbs, (x1Prime - cxPrime) / rxAbs);
    const theta2 = Math.atan2((-y1Prime - cyPrime) / ryAbs, (-x1Prime - cxPrime) / rxAbs);

    let dTheta = theta2 - theta1;

    if (sweep && dTheta < 0) {
      dTheta += 2 * Math.PI;
    } else if (!sweep && dTheta > 0) {
      dTheta -= 2 * Math.PI;
    }

    this.graphics.arc(cx, cy, rxAbs, theta1, theta1 + dTheta, !sweep);
  }

  /**
   * Parse color string to hex number
   */
  private parseColor(color: string): number {
    if (color.startsWith('#')) {
      return parseInt(color.substring(1), 16);
    }
    // Handle rgb/rgba or named colors if needed
    return 0x000000;
  }

  /**
   * Get current progress
   */
  public getProgress(): number {
    return this.currentProgress;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.graphics.destroy();
    this.container.destroy();
  }
}

