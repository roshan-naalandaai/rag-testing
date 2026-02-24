/**
 * ChalkSoundGenerator - Generates procedural chalk sound effects
 * Creates realistic chalk-on-board scratching sounds using Web Audio API
 */

export class ChalkSoundGenerator {
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private initialized = false;

  /**
   * Initialize the audio context and gain node
   * Must be called after user interaction (click, touch, etc.)
   */
  public initialize(): void {
    if (this.initialized) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
      this.gainNode.gain.value = 1.0;
      this.initialized = true;
    } catch (error) {
      console.warn('Failed to initialize ChalkSoundGenerator:', error);
    }
  }

  /**
   * Play a short chalk scratch sound
   * Generates white noise filtered through a bandpass filter
   */
  public playChalkSound(): void {
    if (!this.audioContext || !this.gainNode || !this.initialized) {
      return;
    }

    try {
      const duration = 0.03; // 30ms sound
      
      // Create noise buffer
      const noiseBuffer = this.audioContext.createBuffer(
        1,
        this.audioContext.sampleRate * duration,
        this.audioContext.sampleRate
      );
      const noiseData = noiseBuffer.getChannelData(0);
      
      // Fill with white noise
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = Math.random() * 2 - 1;
      }

      // Create source
      const noiseSource = this.audioContext.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      // Create bandpass filter for chalk-like frequency
      const filter = this.audioContext.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1000 + Math.random() * 100; // Slight variation
      filter.Q.value = 10;

      // Create envelope (attack-decay)
      const envGainNode = this.audioContext.createGain();
      const now = this.audioContext.currentTime;
      envGainNode.gain.setValueAtTime(0, now);
      envGainNode.gain.linearRampToValueAtTime(0.2, now + 0.005); // Quick attack
      envGainNode.gain.exponentialRampToValueAtTime(0.01, now + duration); // Decay

      // Connect nodes
      noiseSource.connect(filter);
      filter.connect(envGainNode);
      envGainNode.connect(this.gainNode);

      // Play
      noiseSource.start(now);
      noiseSource.stop(now + duration);
    } catch (error) {
      console.warn('Failed to play chalk sound:', error);
    }
  }

  /**
   * Set the master volume for chalk sounds
   * @param volume - Volume level (0.0 to 1.0)
   */
  public setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Check if the audio system is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clean up audio resources
   */
  public destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.gainNode = null;
      this.initialized = false;
    }
  }
}

