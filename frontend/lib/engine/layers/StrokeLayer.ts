import { Container } from 'pixi.js';

export class StrokeLayer {
  public container: Container;

  constructor() {
    this.container = new Container();
    this.container.label = 'StrokeLayer';
  }

  public clear(): void {
    this.container.removeChildren();
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}

