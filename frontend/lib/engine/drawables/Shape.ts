import { Graphics } from 'pixi.js';
import { ShapeAction } from '../types';

export class Shape {
  public graphics: Graphics;
  private config: ShapeAction;

  constructor(config: ShapeAction) {
    this.config = config;
    this.graphics = new Graphics();
    this.draw();
  }

  private draw(): void {
    this.graphics.clear();

    switch (this.config.shape) {
      case 'circle':
        this.drawCircle();
        break;
      case 'rectangle':
        this.drawRectangle();
        break;
      case 'ellipse':
        this.drawEllipse();
        break;
      case 'polygon':
        this.drawPolygon();
        break;
      case 'line':
        this.drawLine();
        break;
      case 'arrow':
        this.drawArrow();
        break;
    }
  }

  private drawCircle(): void {
    const radius = this.config.radius || 50;
    this.graphics.circle(this.config.x, this.config.y, radius);
    
    if (this.config.fill) {
      this.graphics.fill(this.config.color);
    } else {
      this.graphics.stroke({
        width: 2,
        color: this.config.color,
      });
    }
  }

  private drawRectangle(): void {
    const width = this.config.width || 100;
    const height = this.config.height || 100;
    
    this.graphics.rect(
      this.config.x - width / 2,
      this.config.y - height / 2,
      width,
      height
    );
    
    if (this.config.fill) {
      this.graphics.fill(this.config.color);
    } else {
      this.graphics.stroke({
        width: 2,
        color: this.config.color,
      });
    }
  }

  private drawEllipse(): void {
    const width = this.config.width || 100;
    const height = this.config.height || 50;
    
    this.graphics.ellipse(this.config.x, this.config.y, width / 2, height / 2);
    
    if (this.config.fill) {
      this.graphics.fill(this.config.color);
    } else {
      this.graphics.stroke({
        width: 2,
        color: this.config.color,
      });
    }
  }

  private drawPolygon(): void {
    if (!this.config.points || this.config.points.length < 3) return;

    const points = this.config.points.flat();
    this.graphics.poly(points);
    
    if (this.config.fill) {
      this.graphics.fill(this.config.color);
    } else {
      this.graphics.stroke({
        width: 2,
        color: this.config.color,
      });
    }
  }

  private drawLine(): void {
    const x1 = this.config.x;
    const y1 = this.config.y;
    const x2 = this.config.x2 ?? (x1 + 100);
    const y2 = this.config.y2 ?? y1;
    const strokeWidth = this.config.strokeWidth || 2;

    this.graphics.moveTo(x1, y1);
    this.graphics.lineTo(x2, y2);
    this.graphics.stroke({
      width: strokeWidth,
      color: this.config.color,
    });
  }

  private drawArrow(): void {
    const x1 = this.config.x;
    const y1 = this.config.y;
    const x2 = this.config.x2 ?? (x1 + 100);
    const y2 = this.config.y2 ?? y1;
    const strokeWidth = this.config.strokeWidth || 2;
    const headSize = this.config.arrowHeadSize || 15;

    // Draw the line
    this.graphics.moveTo(x1, y1);
    this.graphics.lineTo(x2, y2);
    this.graphics.stroke({
      width: strokeWidth,
      color: this.config.color,
    });

    // Calculate arrow head angle
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const headAngle = Math.PI / 6; // 30 degrees

    // Arrow head points
    const headX1 = x2 - headSize * Math.cos(angle - headAngle);
    const headY1 = y2 - headSize * Math.sin(angle - headAngle);
    const headX2 = x2 - headSize * Math.cos(angle + headAngle);
    const headY2 = y2 - headSize * Math.sin(angle + headAngle);

    // Draw arrow head
    this.graphics.moveTo(x2, y2);
    this.graphics.lineTo(headX1, headY1);
    this.graphics.moveTo(x2, y2);
    this.graphics.lineTo(headX2, headY2);
    this.graphics.stroke({
      width: strokeWidth,
      color: this.config.color,
    });

    // Optionally fill the arrow head as a triangle
    if (this.config.fill) {
      this.graphics.poly([x2, y2, headX1, headY1, headX2, headY2]);
      this.graphics.fill(this.config.color);
    }
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}

