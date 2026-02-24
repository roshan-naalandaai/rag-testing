import { Sprite, Texture } from 'pixi.js';
import { VideoAction } from '../types';

export class VideoNode {
  public sprite: Sprite;
  private videoElement: HTMLVideoElement;

  constructor(videoElement: HTMLVideoElement, config: VideoAction) {
    this.videoElement = videoElement;

    // Create texture from video element
    const texture = Texture.from(videoElement);
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

    // Set volume if specified
    if (config.volume !== undefined) {
      this.videoElement.volume = config.volume;
    }
  }

  public destroy(): void {
    this.sprite.destroy();
  }
}

