import { Text, TextStyle, Container } from 'pixi.js';
import { TextAction } from '../types';
import { TextPathAnimator } from '../utils/TextPathAnimator';
// import { TextPathAnimator } from '../utils/TextPathAnimator1';

export class TextNode {
  public text: Text;
  public container: Container;
  public pathAnimator: TextPathAnimator | null = null;
  private config: TextAction;
  private isPathBased: boolean = false;

  constructor(config: TextAction) {
    this.config = config;
    this.container = new Container();

    // Determine if this is a path-based animation
    this.isPathBased = config.animationType === 'draw';

    if (this.isPathBased) {
      // Path-based rendering (for draw animation)
      // We'll initialize the path animator later (async)
      this.text = new Text({ text: '', style: new TextStyle() }); // Placeholder
      this.text.visible = false; // Hide standard text for draw mode
    } else {
      // Standard text rendering
      const style = new TextStyle({
        fontFamily: config.fontFamily || 'Arial',
        fontSize: config.fontSize,
        fill: config.color,
        align: 'left',
      });

      this.text = new Text({
        text: config.text,
        style,
      });

      this.text.x = config.x;
      this.text.y = config.y;
    }

    this.container.addChild(this.text);
  }

  /**
   * Initialize path animator for draw animation (async)
   */
  public async initializePathAnimator(): Promise<void> {
    if (!this.isPathBased) return;

    this.pathAnimator = new TextPathAnimator({
      text: this.config.text,
      x: this.config.x,
      y: this.config.y,
      fontSize: this.config.fontSize,
      color: this.config.color,
      fontFamily: this.config.fontFamily, // Now passes fontFamily from config
    });

    await this.pathAnimator.loadAndPrepare();

    // Add graphics to container
    const graphics = this.pathAnimator.getGraphics();
    this.container.addChild(graphics);
  }

  /**
   * Update drawing progress for path animation (0 to 1)
   */
  public updateDrawProgress(progress: number): void {
    if (this.pathAnimator) {
      this.pathAnimator.drawProgress(progress);
    }
  }

  /**
   * Update text content (for typewriter effect)
   */
  public updateText(newText: string): void {
    this.text.text = newText;
  }

  /**
   * Check if this is a path-based text node
   */
  public isPathBasedText(): boolean {
    return this.isPathBased;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    if (this.pathAnimator) {
      this.pathAnimator.destroy();
    }
    this.text.destroy();
    this.container.destroy({ children: true });
  }
}

