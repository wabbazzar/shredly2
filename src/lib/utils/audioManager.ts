/**
 * Audio Manager - Web Audio API based audio feedback for timer
 *
 * Uses synthesized tones instead of audio files for:
 * - Countdown beeps (3-2-1)
 * - Work complete chime
 * - Block complete chime
 * - Minute markers
 */

// ============================================================================
// TYPES
// ============================================================================

export interface AudioConfig {
  enabled: boolean;
  volume: number; // 0-1
  countdownEnabled: boolean;
  workCompleteEnabled: boolean;
  blockCompleteEnabled: boolean;
  minuteMarkerEnabled: boolean;
}

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  enabled: true,
  volume: 0.7,
  countdownEnabled: true,
  workCompleteEnabled: true,
  blockCompleteEnabled: true,
  minuteMarkerEnabled: true
};

// ============================================================================
// AUDIO MANAGER
// ============================================================================

/**
 * AudioManager singleton for timer audio cues
 * Uses Web Audio API to generate tones programmatically
 */
export class AudioManager {
  private audioContext: AudioContext | null = null;
  private config: AudioConfig;
  private isInitialized = false;

  constructor(config: AudioConfig = DEFAULT_AUDIO_CONFIG) {
    this.config = { ...config };
  }

  /**
   * Initialize audio context (must be called from user gesture)
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      // Create audio context (requires user gesture in most browsers)
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

      // Resume if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.isInitialized = true;
      return true;
    } catch (e) {
      console.warn('AudioManager: Failed to initialize audio context:', e);
      return false;
    }
  }

  /**
   * Update audio configuration
   */
  updateConfig(newConfig: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): AudioConfig {
    return { ...this.config };
  }

  /**
   * Check if audio is available and enabled
   */
  isAvailable(): boolean {
    return this.isInitialized && this.config.enabled && this.audioContext !== null;
  }

  /**
   * Play countdown beep (3-2-1 countdown)
   * Different pitch for each second:
   * - 3: lower pitch
   * - 2: medium pitch
   * - 1: higher pitch
   */
  playCountdown(secondsRemaining: number): void {
    if (!this.isAvailable() || !this.config.countdownEnabled) return;
    if (secondsRemaining < 1 || secondsRemaining > 3) return;

    // Pitch increases as countdown progresses
    const frequencies: Record<number, number> = {
      3: 440,   // A4
      2: 554,   // C#5
      1: 659    // E5
    };

    this.playTone(frequencies[secondsRemaining], 100, 'sine');
  }

  /**
   * Play work complete chime (after set or work phase)
   * Two-note ascending chime
   */
  playWorkComplete(): void {
    if (!this.isAvailable() || !this.config.workCompleteEnabled) return;

    // C5 -> G5 ascending chime
    this.playTone(523, 150, 'sine', 0);
    this.playTone(784, 200, 'sine', 160);
  }

  /**
   * Play block complete chime (after compound block)
   * Three-note completion fanfare
   */
  playBlockComplete(): void {
    if (!this.isAvailable() || !this.config.blockCompleteEnabled) return;

    // C5 -> E5 -> G5 ascending chord
    this.playTone(523, 200, 'sine', 0);
    this.playTone(659, 200, 'sine', 200);
    this.playTone(784, 400, 'sine', 400);
  }

  /**
   * Play minute marker beep (for EMOM/AMRAP)
   * Single short beep
   */
  playMinuteMarker(): void {
    if (!this.isAvailable() || !this.config.minuteMarkerEnabled) return;

    // A4 beep
    this.playTone(440, 80, 'square');
  }

  /**
   * Play exercise complete (short confirmation)
   */
  playExerciseComplete(): void {
    if (!this.isAvailable() || !this.config.workCompleteEnabled) return;

    // Single clean note
    this.playTone(587, 150, 'sine'); // D5
  }

  /**
   * Play session complete (longer celebration)
   */
  playSessionComplete(): void {
    if (!this.isAvailable() || !this.config.blockCompleteEnabled) return;

    // Victory fanfare: C5 -> E5 -> G5 -> C6
    this.playTone(523, 150, 'sine', 0);    // C5
    this.playTone(659, 150, 'sine', 150);  // E5
    this.playTone(784, 150, 'sine', 300);  // G5
    this.playTone(1047, 400, 'sine', 450); // C6
  }

  /**
   * Play a synthesized tone
   */
  private playTone(
    frequency: number,
    duration: number,
    waveType: OscillatorType = 'sine',
    delayMs = 0
  ): void {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const startTime = ctx.currentTime + delayMs / 1000;
    const endTime = startTime + duration / 1000;

    // Create oscillator
    const oscillator = ctx.createOscillator();
    oscillator.type = waveType;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    // Create gain node for volume control and envelope
    const gainNode = ctx.createGain();
    const volume = this.config.volume * 0.3; // Scale down to avoid harsh volume

    // Envelope: quick attack, sustain, quick release
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gainNode.gain.setValueAtTime(volume, endTime - 0.05);
    gainNode.gain.linearRampToValueAtTime(0, endTime);

    // Connect and play
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(startTime);
    oscillator.stop(endTime);
  }

  /**
   * Cleanup audio context
   */
  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.isInitialized = false;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let audioManagerInstance: AudioManager | null = null;

/**
 * Get or create the AudioManager singleton
 */
export function getAudioManager(): AudioManager {
  if (!audioManagerInstance) {
    audioManagerInstance = new AudioManager();
  }
  return audioManagerInstance;
}

/**
 * Reset the AudioManager singleton (for testing)
 */
export function resetAudioManager(): void {
  if (audioManagerInstance) {
    audioManagerInstance.destroy();
    audioManagerInstance = null;
  }
}
