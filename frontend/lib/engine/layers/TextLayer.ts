import { Container } from 'pixi.js';

export class TextLayer {
  public container: Container;

  constructor() {
    this.container = new Container();
    this.container.label = 'TextLayer';
  }

  public clear(): void {
    this.container.removeChildren();
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}

