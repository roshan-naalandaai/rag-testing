import { Project, Action, AssetDefinition } from '../types';
import { Renderer } from './Renderer';
import { Timeline } from './Timeline';
import { Stroke } from '../drawables/Stroke';
import { Shape } from '../drawables/Shape';
import { TextNode } from '../drawables/TextNode';
import { ImageNode } from '../drawables/ImageNode';
import { VideoNode } from '../drawables/VideoNode';
import { SVGAnimationNode } from '../drawables/SVGAnimationNode';
import { StrokeGenerator } from '../handdrawn/StrokeGenerator';
import { ChalkStyle } from '../handdrawn/ChalkStyle';
import { MarkerStyle } from '../handdrawn/MarkerStyle';
import { parseSVGToShapes } from '../utils/SVGPathParser';
import { ChalkSoundGenerator } from '../utils/ChalkSoundGenerator';

export class ProjectLoader {
  private project: Project;
  private renderer: Renderer;
  private timeline: Timeline;
  private assets: Map<string, any> = new Map();
  private drawables: Map<string, any> = new Map();
  private sceneDrawables: Map<string, Set<any>> = new Map(); // Track drawable objects per scene (not IDs!)
  private chalkSound: ChalkSoundGenerator;
  private audioElements: Map<string, { element: HTMLAudioElement; startTime: number; endTime?: number }> = new Map();

  constructor(project: Project, renderer: Renderer, timeline: Timeline) {
    this.project = project;
    this.renderer = renderer;
    this.timeline = timeline;
    this.chalkSound = new ChalkSoundGenerator();
  }

  public async load(): Promise<void> {
    // Initialize chalk sound generator
    // Note: Audio context requires user interaction, so we initialize it here
    // It will be activated on first user interaction with the page
    this.initializeAudio();

    // Load all assets first
    await this.loadAssets();

    // Process all scenes and actions
    this.processScenes();
  }

  private initializeAudio(): void {
    // Initialize audio on user interaction
    const initAudio = () => {
      if (!this.chalkSound.isInitialized()) {
        this.chalkSound.initialize();
        document.removeEventListener('click', initAudio);
        document.removeEventListener('touchstart', initAudio);
        document.removeEventListener('keydown', initAudio);
      }
    };

    document.addEventListener('click', initAudio);
    document.addEventListener('touchstart', initAudio);
    document.addEventListener('keydown', initAudio);
  }

  private async loadAssets(): Promise<void> {
    const loadPromises: Promise<void>[] = [];

    // Load images
    if (this.project.assets.images) {
      for (const asset of this.project.assets.images) {
        loadPromises.push(this.loadImageAsset(asset));
      }
    }

    // Load videos
    if (this.project.assets.videos) {
      for (const asset of this.project.assets.videos) {
        loadPromises.push(this.loadVideoAsset(asset));
      }
    }

    // Load audio
    if (this.project.assets.audio) {
      for (const asset of this.project.assets.audio) {
        loadPromises.push(this.loadAudioAsset(asset));
      }
    }

    // Load SVGs
    if (this.project.assets.svgs) {
      for (const asset of this.project.assets.svgs) {
        loadPromises.push(this.loadSvgAsset(asset));
      }
    }

    await Promise.all(loadPromises);
  }

  private async loadImageAsset(asset: AssetDefinition): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.assets.set(asset.id, img);
        resolve();
      };
      img.onerror = reject;
      img.src = asset.url;
    });
  }

  private async loadVideoAsset(asset: AssetDefinition): Promise<void> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = asset.url;
      video.preload = 'auto';
      video.muted = true; // Video audio handled separately
      
      video.onloadeddata = () => {
        this.assets.set(asset.id, video);
        resolve();
      };
      video.onerror = reject;
    });
  }

  private async loadAudioAsset(asset: AssetDefinition): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(asset.url);
      audio.preload = 'auto';
      
      audio.oncanplaythrough = () => {
        this.assets.set(asset.id, audio);
        resolve();
      };
      audio.onerror = reject;
    });
  }

  private async loadSvgAsset(asset: AssetDefinition): Promise<void> {
    return new Promise((resolve, reject) => {
      fetch(asset.url)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load SVG: ${response.statusText}`);
          }
          return response.text();
        })
        .then((svgText) => {
          this.assets.set(asset.id, svgText);
          resolve();
        })
        .catch(reject);
    });
  }

  private processScenes(): void {
    // Calculate total timeline duration
    let maxTime = this.project.meta.duration || 0;
    
    for (const scene of this.project.scenes) {
      const sceneEndTime = scene.startTime + scene.duration;
      maxTime = Math.max(maxTime, sceneEndTime);
    }

    // Process each scene
    for (const scene of this.project.scenes) {
      // Initialize drawable tracking for this scene
      this.sceneDrawables.set(scene.id, new Set());

      // Set background if specified
      if (scene.background) {
        this.setSceneBackground(scene.background, scene.startTime);
      }

      // Process each action in the scene
      for (const action of scene.actions) {
        this.processAction(action, scene.id);
      }

      // Add scene cleanup callback at the end of scene duration
      const sceneEndTime = scene.startTime + scene.duration;
      this.addSceneCleanup(scene.id, sceneEndTime);
    }

    // Ensure timeline has the correct duration by adding a dummy callback at the end
    this.timeline.addCallback(() => {
      // Timeline end marker
    }, maxTime);
  }

  private setSceneBackground(color: string, startTime: number): void {
    // Add background color change to timeline
    this.timeline.addCallback(() => {
      this.renderer.app.renderer.background.color = color;
    }, startTime);
  }

  private addSceneCleanup(sceneId: string, endTime: number): void {
    const fadeOutDuration = 0.001;
    const fadeOutStartTime = endTime - fadeOutDuration;

    // Get all drawable objects for this scene
    const sceneDrawableObjects = this.sceneDrawables.get(sceneId);
    if (!sceneDrawableObjects) return;

    // Fade out each drawable before scene ends
    for (const drawable of sceneDrawableObjects) {
      if (!drawable) continue;

      // Determine what object to fade out based on drawable type
      let targetObject = null;
      
      if (drawable.graphics) {
        // Shape, Stroke
        targetObject = drawable.graphics;
      } else if (drawable.sprite) {
        // Image, Video
        targetObject = drawable.sprite;
      } else if (drawable.container) {
        // SVGAnimationNode, TextNode
        targetObject = drawable.container;
      } else if (drawable.text) {
        // TextNode (fallback to text object)
        targetObject = drawable.text;
      }

      if (targetObject) {
        // Add fade out animation
        this.timeline.addTween(
          targetObject,
          {
            alpha: 0,
            duration: fadeOutDuration,
          },
          fadeOutStartTime
        );
      }
    }

    // Remove drawables from stage after fade completes
    this.timeline.addCallback(() => {
      for (const drawable of sceneDrawableObjects) {
        if (!drawable) continue;

        // Remove from parent
        if (drawable.graphics && drawable.graphics.parent) {
          drawable.graphics.parent.removeChild(drawable.graphics);
        }
        if (drawable.sprite && drawable.sprite.parent) {
          drawable.sprite.parent.removeChild(drawable.sprite);
        }
        if (drawable.container && drawable.container.parent) {
          drawable.container.parent.removeChild(drawable.container);
        }
        if (drawable.text && drawable.text.parent && !drawable.container) {
          drawable.text.parent.removeChild(drawable.text);
        }
      }
    }, endTime);
  }

  private processAction(action: Action, sceneId: string): void {
    switch (action.type) {
      case 'stroke':
        this.processStroke(action, sceneId);
        break;
      case 'shape':
        this.processShape(action, sceneId);
        break;
      case 'text':
        this.processText(action, sceneId);
        break;
      case 'image':
        this.processImage(action, sceneId);
        break;
      case 'video':
        this.processVideo(action, sceneId);
        break;
      case 'audio':
        this.processAudio(action, sceneId);
        break;
      case 'svgAnimation':
        this.processSvgAnimation(action, sceneId);
        break;
    }
  }

  private processStroke(action: any, sceneId: string): void {
    const strokeLayer = this.renderer.getLayer('stroke');
    if (!strokeLayer) return;

    // Get style
    const style = action.style === 'chalk' ? new ChalkStyle() : new MarkerStyle();
    
    // Create stroke generator
    const generator = new StrokeGenerator(style);
    const generatedPath = generator.generate(action.path, action.seed || 0);

    // Create stroke drawable
    const stroke = new Stroke(generatedPath, action.color, action.width);
    strokeLayer.addChild(stroke.graphics);

    // Add animation to timeline
    this.timeline.addTween(
      stroke,
      {
        progress: 1,
        duration: action.duration,
        ease: 'none',
        onUpdate: () => stroke.updateProgress(),
      },
      action.startTime
    );

    this.drawables.set(action.id, stroke);
    this.sceneDrawables.get(sceneId)?.add(stroke);
  }

  private processShape(action: any, sceneId: string): void {
    const shapeLayer = this.renderer.getLayer('shape');
    if (!shapeLayer) return;

    const shape = new Shape(action);
    shapeLayer.addChild(shape.graphics);

    // Fade in animation
    this.timeline.addFromTween(
      shape.graphics,
      {
        alpha: 0,
        duration: 0.3,
      },
      action.startTime
    );

    // Fade out at end (only if action has explicit duration fade out)
    if (action.duration) {
      this.timeline.addTween(
        shape.graphics,
        {
          alpha: 0,
          duration: 0.3,
        },
        action.startTime + action.duration - 0.3
      );
    }

    this.drawables.set(action.id, shape);
    this.sceneDrawables.get(sceneId)?.add(shape);
  }

  private processText(action: any, sceneId: string): void {
    const textLayer = this.renderer.getLayer('text');
    if (!textLayer) return;

    const textNode = new TextNode(action);

    // Add container (not just text) for path-based rendering support
    textLayer.addChild(textNode.container);

    // Handle animation type
    if (action.animationType === 'fade') {
      this.timeline.addFromTween(
        textNode.text,
        {
          alpha: 0,
          duration: 0.5,
        },
        action.startTime
      );
    } else if (action.animationType === 'typewriter') {
      // Typewriter effect
      const chars = action.text.length;
      const charDuration = action.duration / chars;
      
      for (let i = 0; i <= chars; i++) {
        this.timeline.addCallback(() => {
          textNode.updateText(action.text.substring(0, i));
        }, action.startTime + i * charDuration);
      }
    } else if (action.animationType === 'draw') {
      // Path-based draw animation with chalk sounds
      // Initialize path animator asynchronously
      textNode.initializePathAnimator().then(() => {
        // Create progressive drawing animation using timeline
        const updateInterval = 1 / 60; // Update at 60 FPS
        const totalUpdates = Math.floor(action.duration / updateInterval);

        for (let i = 0; i <= totalUpdates; i++) {
          const progress = i / totalUpdates;
          const time = action.startTime + (progress * action.duration);

          this.timeline.addCallback(() => {
            textNode.updateDrawProgress(progress);
          }, time);
        }
      }).catch((error) => {
        console.error('Failed to initialize text path animator:', error);
      });
    }

    this.drawables.set(action.id, textNode);
    this.sceneDrawables.get(sceneId)?.add(textNode);
  }

  private processImage(action: any, sceneId: string): void {
    const mediaLayer = this.renderer.getLayer('media');
    if (!mediaLayer) return;

    const asset = this.assets.get(action.assetId);
    if (!asset) return;

    const imageNode = new ImageNode(asset, action);
    mediaLayer.addChild(imageNode.sprite);

    // Handle animation type
    if (action.animationType === 'fade') {
      this.timeline.addFromTween(
        imageNode.sprite,
        {
          alpha: 0,
          duration: 0.5,
        },
        action.startTime
      );
    } else if (action.animationType === 'scale') {
      this.timeline.addFromTween(
        imageNode.sprite,
        {
          // scale: { x: 0, y: 0 },
          duration: 0.5,
        },
        action.startTime
      );
    }

    this.drawables.set(action.id, imageNode);
    this.sceneDrawables.get(sceneId)?.add(imageNode);
  }

  private processVideo(action: any, sceneId: string): void {
    const mediaLayer = this.renderer.getLayer('media');
    if (!mediaLayer) return;

    const asset = this.assets.get(action.assetId);
    if (!asset) return;

    const videoNode = new VideoNode(asset, action);
    mediaLayer.addChild(videoNode.sprite);

    // Control video playback via timeline callbacks
    this.timeline.addCallback(() => {
      asset.currentTime = 0;
      asset.play();
    }, action.startTime);

    this.timeline.addCallback(() => {
      asset.pause();
    }, action.startTime + action.duration);

    this.drawables.set(action.id, videoNode);
    this.sceneDrawables.get(sceneId)?.add(videoNode);
  }

  private processAudio(action: any, _sceneId: string): void {
    const asset = this.assets.get(action.assetId);
    if (!asset) return;

    // Store audio element for playback control
    this.audioElements.set(action.id, {
      element: asset,
      startTime: action.startTime,
      endTime: action.duration ? action.startTime + action.duration : undefined
    });

    // Control audio playback via timeline callbacks
    this.timeline.addCallback(() => {
      asset.currentTime = 0;
      asset.volume = action.volume || 1.0;
      asset.play();
    }, action.startTime);

    // Stop audio at end time if specified
    if (action.duration) {
      this.timeline.addCallback(() => {
        asset.pause();
      }, action.startTime + action.duration);
    }
  }

  private processSvgAnimation(action: any, sceneId: string): void {
    const mediaLayer = this.renderer.getLayer('media');
    if (!mediaLayer) return;

    const svgText = this.assets.get(action.assetId);
    if (!svgText) return;

    // Calculate scale based on width/height if provided
    let scale = action.scale || 1;
    
    // Parse SVG to get shapes with transformations
    const shapes = parseSVGToShapes(
      svgText,
      scale,
      action.x || 0,
      action.y || 0
    );
    for (const shape of shapes) {
      console.log(shape.commands);
    }
    // Create SVG animation node
    const svgNode = new SVGAnimationNode(shapes, this.chalkSound);
    mediaLayer.addChild(svgNode.container);

    // Animate the drawing progress over the duration
    const updateInterval = 1 / 60; // Update at 60 FPS
    const totalUpdates = Math.floor(action.duration / updateInterval);

    for (let i = 0; i <= totalUpdates; i++) {
      const progress = i / totalUpdates;
      const time = action.startTime + (progress * action.duration);

      this.timeline.addCallback(() => {
        svgNode.updateProgress(progress);
      }, time);
    }

    this.drawables.set(action.id, svgNode);
    this.sceneDrawables.get(sceneId)?.add(svgNode);
  }

  public getDrawable(id: string): any {
    return this.drawables.get(id);
  }

  public pauseAllAudio(): void {
    this.audioElements.forEach(({ element }) => {
      if (!element.paused) {
        element.pause();
      }
    });
  }

  public resumeAllAudio(currentTime: number): void {
    this.audioElements.forEach(({ element, startTime, endTime }) => {
      // Only play audio if we're within its time range
      if (currentTime >= startTime && (!endTime || currentTime < endTime)) {
        const audioTime = currentTime - startTime;
        element.currentTime = audioTime;
        element.play().catch(err => {
          console.warn('Failed to resume audio:', err);
        });
      }
    });
  }

  public seekAllAudio(currentTime: number): void {
    this.audioElements.forEach(({ element, startTime, endTime }) => {
      // Pause all audio first
      element.pause();
      
      // If we're within the audio's time range, set its current time
      if (currentTime >= startTime && (!endTime || currentTime < endTime)) {
        const audioTime = currentTime - startTime;
        element.currentTime = Math.max(0, Math.min(audioTime, element.duration));
      } else {
        element.currentTime = 0;
      }
    });
  }

  public setAudioPlaybackRate(rate: number): void {
    this.audioElements.forEach(({ element }) => {
      element.playbackRate = rate;
    });
  }

  public destroy(): void {
    // Pause and clean up all audio
    this.audioElements.forEach(({ element }) => {
      element.pause();
      element.currentTime = 0;
    });
    this.audioElements.clear();

    // Clean up all drawables
    for (const drawable of this.drawables.values()) {
      if (drawable.destroy) {
        drawable.destroy();
      }
    }
    this.drawables.clear();
    this.assets.clear();
    
    // Clean up audio resources
    if (this.chalkSound) {
      this.chalkSound.destroy();
    }
  }
}

