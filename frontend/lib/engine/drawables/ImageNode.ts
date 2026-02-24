import { Sprite, Texture } from 'pixi.js';
import { ImageAction } from '../types';

export class ImageNode {
  public sprite: Sprite;

  constructor(imageElement: HTMLImageElement, config: ImageAction) {

    // Create texture from image element
    const texture = Texture.from(imageElement);
    this.sprite = new Sprite(texture);

    // Set position
    this.sprite.x = config.x;
    this.sprite.y = config.y;

    // Set size if specified
    if (config.width && config.height) {
      this.sprite.width = config.width;
      this.sprite.height = config.height;
    } else if (config.width) {
      this.sprite.width = config.width;
      this.sprite.scale.y = this.sprite.scale.x;
    } else if (config.height) {
      this.sprite.height = config.height;
      this.sprite.scale.x = this.sprite.scale.y;
    }

    // Center anchor
    this.sprite.anchor.set(0.5);
  }

  public destroy(): void {
    this.sprite.destroy();
  }
}

