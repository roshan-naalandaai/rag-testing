/**
 * AudioManager - Manages Web Audio API for chalk scratching sounds
 * Generates procedural white noise with bandpass filter for realistic chalk effect
 */
export class AudioManager {
  private audioContext: AudioContext | null = null;
  private chalkGainNode: GainNode | null = null;
  private initialized = false;

  /**
   * Initialize audio context (requires user interaction)
   */
  public initialize(): void {
    if (this.initialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.chalkGainNode = this.audioContext.createGain();
      this.chalkGainNode.connect(this.audioContext.destination);
      this.chalkGainNode.gain.value = 0.3; // Volume control
      this.initialized = true;
    } catch (error) {
      console.warn('AudioContext initialization failed:', error);
    }
  }

  /**
   * Play chalk scratching sound for a single stroke
   */
  public playChalkSound(): void {
    if (!this.audioContext || !this.chalkGainNode) {
      this.initialize();
      if (!this.audioContext || !this.chalkGainNode) return;
    }

    const duration = 0.03; // 30ms per stroke
    const sampleRate = this.audioContext.sampleRate;
    const noiseBuffer = this.audioContext.createBuffer(1, sampleRate * duration, sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);

    // Generate white noise for chalk texture
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const noiseSource = this.audioContext.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // Bandpass filter for chalk-like sound
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000 + Math.random() * 100; // Slight variation per stroke
    filter.Q.value = 10;

    // Envelope for percussive stroke sound
    const gainNode = this.audioContext.createGain();
    const now = this.audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.005); // Quick attack
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration); // Quick decay

    // Connect nodes
    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.chalkGainNode);

    // Play sound
    noiseSource.start(now);
    noiseSource.stop(now + duration);
  }

  /**
   * Check if audio is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  public setVolume(volume: number): void {
    if (this.chalkGainNode) {
      this.chalkGainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Clean up audio resources
   */
  public destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.chalkGainNode = null;
      this.initialized = false;
    }
  }
}

// Singleton instance
export const audioManager = new AudioManager();

