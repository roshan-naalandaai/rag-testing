import { Graphics } from 'pixi.js';

export class Stroke {
  public graphics: Graphics;
  public progress: number = 0;
  private path: number[][];
  private color: string;
  private width: number;

  constructor(path: number[][], color: string, width: number) {
    this.path = path;
    this.color = color;
    this.width = width;

    this.graphics = new Graphics();
    this.draw();
  }

  private draw(): void {
    this.graphics.clear();

    if (this.path.length === 0) return;

    // Calculate how many points to draw based on progress
    const numPoints = Math.floor(this.path.length * this.progress);
    if (numPoints < 2) return;

    // Draw the path up to the current progress
    this.graphics.moveTo(this.path[0][0], this.path[0][1]);
    
    for (let i = 1; i < numPoints; i++) {
      const point = this.path[i];
      this.graphics.lineTo(point[0], point[1]);
    }

    this.graphics.stroke({
      width: this.width,
      color: this.color,
      cap: 'round',
      join: 'round',
    });
  }

  public updateProgress(): void {
    this.draw();
  }

  public setProgress(progress: number): void {
    this.progress = Math.max(0, Math.min(1, progress));
    this.draw();
  }

  public destroy(): void {
    this.graphics.destroy();
  }
}

