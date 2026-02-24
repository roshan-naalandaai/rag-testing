import gsap from 'gsap';
import { RenderMode } from '../types';

export class Timeline {
  public master: gsap.core.Timeline;
  private renderMode: RenderMode;
  private rafId: number | null = null;
  private onTickCallback?: (time: number) => void;

  constructor(renderMode: RenderMode) {
    this.renderMode = renderMode;
    
    // Create master timeline - paused by default
    this.master = gsap.timeline({
      paused: true,
      onUpdate: () => {
        if (this.onTickCallback) {
          this.onTickCallback(this.master.time());
        }
      },
    });
  }

  public play(): void {
    if (this.renderMode.type === 'live') {
      this.master.play();
      this.startRAF();
    }
  }

  public pause(): void {
    this.master.pause();
    this.stopRAF();
  }

  public seek(time: number): void {
    this.master.seek(time);
  }

  public seekToProgress(progress: number): void {
    this.master.progress(progress);
  }

  public setSpeed(speed: number): void {
    this.master.timeScale(speed);
  }

  public getDuration(): number {
    return this.master.duration();
  }

  public getCurrentTime(): number {
    return this.master.time();
  }

  public getProgress(): number {
    return this.master.progress();
  }

  public isPlaying(): boolean {
    return this.master.isActive();
  }

  public onTick(callback: (time: number) => void): void {
    this.onTickCallback = callback;
  }

  private startRAF(): void {
    if (this.rafId !== null) return;

    const tick = () => {
      // GSAP handles its own time progression
      // This RAF is just to ensure smooth rendering in live mode
      if (this.master.isActive()) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.rafId = null;
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }

  private stopRAF(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public destroy(): void {
    this.stopRAF();
    this.master.kill();
  }

  // Export mode: step through timeline at fixed intervals
  public stepToTime(time: number): void {
    this.master.seek(time, false); // false = suppress events on seek
  }

  public addCallback(callback: () => void, time: number): void {
    this.master.call(callback, [], time);
  }

  public addTween(target: any, vars: gsap.TweenVars, position?: gsap.Position): void {
    this.master.to(target, vars, position);
  }

  public addFromTween(target: any, vars: gsap.TweenVars, position?: gsap.Position): void {
    this.master.from(target, vars, position);
  }
}

