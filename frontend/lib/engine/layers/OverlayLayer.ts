import { Container } from 'pixi.js';

export class OverlayLayer {
  public container: Container;

  constructor() {
    this.container = new Container();
    this.container.label = 'OverlayLayer';
  }

  public clear(): void {
    this.container.removeChildren();
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}

