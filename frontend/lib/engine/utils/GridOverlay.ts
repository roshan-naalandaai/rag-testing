import { Graphics, Text, Container, TextStyle } from 'pixi.js';

export interface GridConfig {
  majorInterval: number;  // Major grid lines every N pixels
  minorInterval: number;  // Minor grid lines every N pixels
  width: number;          // Canvas width
  height: number;         // Canvas height
  majorColor: number;     // Color for major lines
  minorColor: number;     // Color for minor lines
  majorAlpha: number;     // Opacity for major lines
  minorAlpha: number;     // Opacity for minor lines
  showLabels: boolean;    // Show coordinate labels
}

export class GridOverlay {
  private container: Container;
  private graphics: Graphics;
  private config: GridConfig;
  private labels: Text[] = [];

  constructor(config: Partial<GridConfig> = {}) {
    this.container = new Container();
    this.container.label = 'grid-overlay';
    this.graphics = new Graphics();
    
    // Default configuration
    this.config = {
      majorInterval: 100,
      minorInterval: 50,
      width: 1920,
      height: 1080,
      majorColor: 0xffffff,
      minorColor: 0x666666,
      majorAlpha: 0.3,
      minorAlpha: 0.15,
      showLabels: true,
      ...config,
    };

    this.container.addChild(this.graphics);
    this.draw();
  }

  private draw(): void {
    this.graphics.clear();
    this.clearLabels();

    const { width, height, majorInterval, minorInterval } = this.config;

    // Draw minor grid lines (vertical)
    for (let x = 0; x <= width; x += minorInterval) {
      const isMajor = x % majorInterval === 0;
      if (!isMajor) {
        this.drawVerticalLine(x, false);
      }
    }

    // Draw minor grid lines (horizontal)
    for (let y = 0; y <= height; y += minorInterval) {
      const isMajor = y % majorInterval === 0;
      if (!isMajor) {
        this.drawHorizontalLine(y, false);
      }
    }

    // Draw major grid lines (vertical)
    for (let x = 0; x <= width; x += majorInterval) {
      this.drawVerticalLine(x, true);
      if (this.config.showLabels && x > 0) {
        this.addLabel(x.toString(), x, 5);
      }
    }

    // Draw major grid lines (horizontal)
    for (let y = 0; y <= height; y += majorInterval) {
      this.drawHorizontalLine(y, true);
      if (this.config.showLabels && y > 0) {
        this.addLabel(y.toString(), 5, y);
      }
    }

    // Draw origin label
    if (this.config.showLabels) {
      this.addLabel('0,0', 5, 5);
    }
  }

  private drawVerticalLine(x: number, isMajor: boolean): void {
    const color = isMajor ? this.config.majorColor : this.config.minorColor;
    const alpha = isMajor ? this.config.majorAlpha : this.config.minorAlpha;
    const lineWidth = isMajor ? 1.5 : 0.5;

    this.graphics
      .moveTo(x, 0)
      .lineTo(x, this.config.height)
      .stroke({ width: lineWidth, color, alpha });
  }

  private drawHorizontalLine(y: number, isMajor: boolean): void {
    const color = isMajor ? this.config.majorColor : this.config.minorColor;
    const alpha = isMajor ? this.config.majorAlpha : this.config.minorAlpha;
    const lineWidth = isMajor ? 1.5 : 0.5;

    this.graphics
      .moveTo(0, y)
      .lineTo(this.config.width, y)
      .stroke({ width: lineWidth, color, alpha });
  }

  private addLabel(text: string, x: number, y: number): void {
    const style = new TextStyle({
      fontFamily: 'monospace',
      fontSize: 12,
      fill: 0xffffff,
      align: 'left',
    });

    const label = new Text({
      text,
      style,
    });

    label.x = x;
    label.y = y;
    label.alpha = 0.6;
    
    this.labels.push(label);
    this.container.addChild(label);
  }

  private clearLabels(): void {
    for (const label of this.labels) {
      this.container.removeChild(label);
      label.destroy();
    }
    this.labels = [];
  }

  public show(): void {
    this.container.visible = true;
  }

  public hide(): void {
    this.container.visible = false;
  }

  public toggle(): void {
    this.container.visible = !this.container.visible;
  }

  public isVisible(): boolean {
    return this.container.visible;
  }

  public getContainer(): Container {
    return this.container;
  }

  public updateSize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    this.draw();
  }

  public setMajorInterval(interval: number): void {
    this.config.majorInterval = interval;
    this.draw();
  }

  public setMinorInterval(interval: number): void {
    this.config.minorInterval = interval;
    this.draw();
  }

  public destroy(): void {
    this.clearLabels();
    this.graphics.destroy();
    this.container.destroy({ children: true });
  }
}

