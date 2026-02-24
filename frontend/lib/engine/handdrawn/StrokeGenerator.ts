import { StrokeStyle } from '../types';

export class StrokeGenerator {
  private style: StrokeStyle;
  private rng: () => number;

  constructor(style: StrokeStyle) {
    this.style = style;
    this.rng = this.createSeededRNG(0);
  }

  // Mulberry32 - fast and high quality seeded PRNG
  private createSeededRNG(seed: number): () => number {
    let state = seed;
    return () => {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  public generate(cleanPath: number[][], seed: number): number[][] {
    // Reset RNG with provided seed for determinism
    this.rng = this.createSeededRNG(seed);

    // Sample the path into more points for smoother hand-drawn effect
    const sampledPath = this.samplePath(cleanPath, 5); // Add points every 5 pixels

    // Apply hand-drawn effects
    const wobbledPath = this.applyWobble(sampledPath);
    const pressuredPath = this.applyPressure(wobbledPath);

    return pressuredPath;
  }

  private samplePath(path: number[][], interval: number): number[][] {
    if (path.length < 2) return path;

    const sampled: number[][] = [path[0]];
    let accumulated = 0;

    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];

      const dx = curr[0] - prev[0];
      const dy = curr[1] - prev[1];
      const distance = Math.sqrt(dx * dx + dy * dy);

      accumulated += distance;

      // Insert intermediate points
      const numSegments = Math.floor(distance / interval);
      for (let j = 1; j <= numSegments; j++) {
        const t = j / (numSegments + 1);
        sampled.push([
          prev[0] + dx * t,
          prev[1] + dy * t,
        ]);
      }

      sampled.push(curr);
    }

    return sampled;
  }

  private applyWobble(path: number[][]): number[][] {
    const wobbled: number[][] = [];
    const amplitude = this.style.noiseAmplitude;

    for (let i = 0; i < path.length; i++) {
      const point = path[i];
      
      // Apply positional wobble using seeded random
      const wobbleX = (this.rng() - 0.5) * 2 * amplitude;
      const wobbleY = (this.rng() - 0.5) * 2 * amplitude;

      // Reduce wobble at endpoints for cleaner start/end
      const edgeFactor = Math.min(i / 5, (path.length - 1 - i) / 5, 1);

      wobbled.push([
        point[0] + wobbleX * edgeFactor,
        point[1] + wobbleY * edgeFactor,
      ]);
    }

    return wobbled;
  }

  private applyPressure(path: number[][]): number[][] {
    // Pressure variation can be used to vary stroke width
    // For now, we just pass through the path
    // This can be enhanced to return pressure values with each point
    return path;
  }

  private perlinNoise1D(x: number): number {
    // Simple pseudo-perlin noise using RNG
    const xi = Math.floor(x);
    const lerp = x - xi;

    // Use RNG to generate gradient values
    const a = this.rng();
    const b = this.rng();

    // Smooth interpolation
    const t = lerp * lerp * (3 - 2 * lerp);
    return a * (1 - t) + b * t;
  }
}

