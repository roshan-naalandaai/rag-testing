import { Container } from 'pixi.js';

export class MediaLayer {
  public container: Container;

  constructor() {
    this.container = new Container();
    this.container.label = 'MediaLayer';
  }

  public clear(): void {
    this.container.removeChildren();
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}

