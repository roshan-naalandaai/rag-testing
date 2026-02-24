import { Container } from 'pixi.js';

export class ShapeLayer {
  public container: Container;

  constructor() {
    this.container = new Container();
    this.container.label = 'ShapeLayer';
  }

  public clear(): void {
    this.container.removeChildren();
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}

