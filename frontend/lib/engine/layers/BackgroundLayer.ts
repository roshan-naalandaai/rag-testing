import { Container, Graphics } from 'pixi.js';

export class BackgroundLayer {
  public container: Container;
  private background: Graphics;

  constructor() {
    this.container = new Container();
    this.container.label = 'BackgroundLayer';
    
    this.background = new Graphics();
    this.container.addChild(this.background);
  }

  public setColor(color: string): void {
    this.background.clear();
    this.background.rect(0, 0, 1920, 1080);
    this.background.fill(color);
  }

  public clear(): void {
    this.background.clear();
  }

  public destroy(): void {
    this.background.destroy();
    this.container.destroy({ children: true });
  }
}

