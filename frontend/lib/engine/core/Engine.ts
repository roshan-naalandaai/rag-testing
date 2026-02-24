import { Project, RenderMode, EngineConfig } from '../types';
import { Renderer } from './Renderer';
import { Timeline } from './Timeline';
import { ProjectLoader } from './ProjectLoader';

export class Engine {
  private renderer: Renderer;
  private timeline: Timeline;
  private projectLoader: ProjectLoader;
  private project: Project;
  private renderMode: RenderMode;

  constructor(config: EngineConfig) {
    this.project = config.project;
    this.renderMode = config.renderMode;

    // Initialize core components (construction only)
    this.renderer = new Renderer(config.canvasId, this.project.meta);
    this.timeline = new Timeline(this.renderMode);
    this.projectLoader = new ProjectLoader(this.project, this.renderer, this.timeline);
  }

  public async initialize(): Promise<void> {
    // Initialize renderer first (async operation for PixiJS v8)
    await this.renderer.initialize();
    
    // Load project (assets + build scene graph + timeline)
    await this.projectLoader.load();

    console.log('Engine initialized successfully');
    console.log(`Timeline duration: ${this.timeline.getDuration()}s`);
  }

  // Playback controls
  public play(): void {
    this.timeline.play();
    // Resume audio from current time
    this.projectLoader.resumeAllAudio(this.timeline.getCurrentTime());
  }

  public pause(): void {
    this.timeline.pause();
    // Pause all audio elements
    this.projectLoader.pauseAllAudio();
  }

  public seek(time: number): void {
    this.timeline.seek(time);
    // Synchronize audio to the new time
    this.projectLoader.seekAllAudio(time);
  }

  public seekToProgress(progress: number): void {
    this.timeline.seekToProgress(progress);
    // Synchronize audio to the new time
    const time = this.timeline.getCurrentTime();
    this.projectLoader.seekAllAudio(time);
  }

  public setSpeed(speed: number): void {
    this.timeline.setSpeed(speed);
    // Adjust audio playback rate
    this.projectLoader.setAudioPlaybackRate(speed);
  }

  public restart(): void {
    this.timeline.seek(0);
    this.projectLoader.seekAllAudio(0);
    this.timeline.play();
    this.projectLoader.resumeAllAudio(0);
  }

  // Getters
  public getDuration(): number {
    return this.timeline.getDuration();
  }

  public getCurrentTime(): number {
    return this.timeline.getCurrentTime();
  }

  public getProgress(): number {
    return this.timeline.getProgress();
  }

  public isPlaying(): boolean {
    return this.timeline.isPlaying();
  }

  public getRenderer(): Renderer {
    return this.renderer;
  }

  public getTimeline(): Timeline {
    return this.timeline;
  }

  // For export mode: step through timeline at fixed intervals
  public stepToTime(time: number): void {
    this.timeline.stepToTime(time);
    this.renderer.render();
  }

  public captureFrame(): Blob | null {
    const canvas = this.renderer.app.canvas as HTMLCanvasElement;
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    }) as any;
  }

  // Cleanup
  public destroy(): void {
    this.timeline.destroy();
    this.projectLoader.destroy();
    this.renderer.destroy();
  }

  // Event callback
  public onTimeUpdate(callback: (time: number) => void): void {
    this.timeline.onTick(callback);
  }
}

