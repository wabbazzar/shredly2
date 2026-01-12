/**
 * Audio Manager Unit Tests
 *
 * Tests for:
 * - Audio initialization
 * - Configuration updates
 * - Sound playback calls
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AudioManager,
  getAudioManager,
  resetAudioManager,
  DEFAULT_AUDIO_CONFIG,
  type AudioConfig
} from '../../src/lib/utils/audioManager';

// Mock AudioContext
class MockOscillator {
  type: OscillatorType = 'sine';
  frequency = {
    setValueAtTime: vi.fn()
  };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class MockGainNode {
  gain = {
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn()
  };
  connect = vi.fn();
}

class MockAudioContext {
  state = 'running' as AudioContextState;
  currentTime = 0;
  destination = {};

  createOscillator = vi.fn(() => new MockOscillator());
  createGain = vi.fn(() => new MockGainNode());
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
}

// Store original values
let originalAudioContext: typeof AudioContext;
let originalWebkitAudioContext: unknown;

beforeEach(() => {
  // Store originals
  originalAudioContext = (window as unknown as { AudioContext: typeof AudioContext }).AudioContext;
  originalWebkitAudioContext = (window as unknown as { webkitAudioContext: unknown }).webkitAudioContext;

  // Mock AudioContext
  (window as unknown as { AudioContext: typeof MockAudioContext }).AudioContext = MockAudioContext as unknown as typeof AudioContext;
  (window as unknown as { webkitAudioContext: typeof MockAudioContext }).webkitAudioContext = MockAudioContext as unknown as typeof AudioContext;

  // Reset singleton
  resetAudioManager();
});

afterEach(() => {
  // Restore
  (window as unknown as { AudioContext: typeof AudioContext }).AudioContext = originalAudioContext;
  (window as unknown as { webkitAudioContext: unknown }).webkitAudioContext = originalWebkitAudioContext;

  resetAudioManager();
});

describe('AudioManager', () => {
  describe('initialization', () => {
    it('should start uninitialized', () => {
      const manager = new AudioManager();
      expect(manager.isAvailable()).toBe(false);
    });

    it('should initialize successfully with AudioContext', async () => {
      const manager = new AudioManager();
      const result = await manager.initialize();

      expect(result).toBe(true);
      expect(manager.isAvailable()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      const manager = new AudioManager();
      await manager.initialize();
      const result = await manager.initialize();

      expect(result).toBe(true);
    });

    it('should resume suspended audio context', async () => {
      // Create a class that returns suspended state
      class SuspendedMockAudioContext extends MockAudioContext {
        state = 'suspended' as AudioContextState;
      }

      (window as unknown as { AudioContext: typeof SuspendedMockAudioContext }).AudioContext = SuspendedMockAudioContext as unknown as typeof AudioContext;

      const manager = new AudioManager();
      await manager.initialize();

      // Get the context and check resume was called
      const ctx = (manager as unknown as { audioContext: MockAudioContext }).audioContext;
      expect(ctx.resume).toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should use default config', () => {
      const manager = new AudioManager();
      const config = manager.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.volume).toBe(0.7);
      expect(config.countdownEnabled).toBe(true);
    });

    it('should accept custom config', () => {
      const customConfig: AudioConfig = {
        enabled: false,
        volume: 0.5,
        countdownEnabled: false,
        workCompleteEnabled: true,
        blockCompleteEnabled: false,
        minuteMarkerEnabled: true
      };

      const manager = new AudioManager(customConfig);
      const config = manager.getConfig();

      expect(config.enabled).toBe(false);
      expect(config.volume).toBe(0.5);
      expect(config.countdownEnabled).toBe(false);
    });

    it('should update config', () => {
      const manager = new AudioManager();
      manager.updateConfig({ volume: 0.3, enabled: false });

      const config = manager.getConfig();
      expect(config.volume).toBe(0.3);
      expect(config.enabled).toBe(false);
      expect(config.countdownEnabled).toBe(true); // Unchanged
    });
  });

  describe('sound playback', () => {
    it('should not play when not initialized', async () => {
      const manager = new AudioManager();
      // Should not throw
      manager.playCountdown(3);
      manager.playWorkComplete();
      manager.playBlockComplete();
      manager.playMinuteMarker();
    });

    it('should not play when disabled', async () => {
      const manager = new AudioManager({ ...DEFAULT_AUDIO_CONFIG, enabled: false });
      await manager.initialize();

      // Create spy on internal method
      const playToneSpy = vi.spyOn(manager as unknown as { playTone: () => void }, 'playTone');

      manager.playCountdown(3);

      expect(playToneSpy).not.toHaveBeenCalled();
    });

    it('should play countdown for valid seconds', async () => {
      const manager = new AudioManager();
      await manager.initialize();

      // Should not throw for valid countdown values
      manager.playCountdown(3);
      manager.playCountdown(2);
      manager.playCountdown(1);
    });

    it('should not play countdown for invalid seconds', async () => {
      const manager = new AudioManager();
      await manager.initialize();

      // Get the mock context
      const ctx = (manager as unknown as { audioContext: MockAudioContext }).audioContext;

      // Reset the spy count
      ctx.createOscillator.mockClear();

      // These should not trigger sound
      manager.playCountdown(0);
      manager.playCountdown(4);
      manager.playCountdown(-1);

      expect(ctx.createOscillator).not.toHaveBeenCalled();
    });

    it('should respect individual sound toggles', async () => {
      const manager = new AudioManager({
        ...DEFAULT_AUDIO_CONFIG,
        countdownEnabled: false,
        workCompleteEnabled: false,
        blockCompleteEnabled: false,
        minuteMarkerEnabled: false
      });
      await manager.initialize();

      const ctx = (manager as unknown as { audioContext: MockAudioContext }).audioContext;

      manager.playCountdown(3);
      manager.playWorkComplete();
      manager.playBlockComplete();
      manager.playMinuteMarker();

      expect(ctx.createOscillator).not.toHaveBeenCalled();
    });

    it('should play work complete sound', async () => {
      const manager = new AudioManager();
      await manager.initialize();

      const ctx = (manager as unknown as { audioContext: MockAudioContext }).audioContext;
      ctx.createOscillator.mockClear();

      manager.playWorkComplete();

      // Work complete plays 2 notes
      expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    });

    it('should play block complete sound', async () => {
      const manager = new AudioManager();
      await manager.initialize();

      const ctx = (manager as unknown as { audioContext: MockAudioContext }).audioContext;
      ctx.createOscillator.mockClear();

      manager.playBlockComplete();

      // Block complete plays 3 notes
      expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
    });

    it('should play minute marker sound', async () => {
      const manager = new AudioManager();
      await manager.initialize();

      const ctx = (manager as unknown as { audioContext: MockAudioContext }).audioContext;
      ctx.createOscillator.mockClear();

      manager.playMinuteMarker();

      // Minute marker plays 3 notes (C5 -> E5 -> G5 ascending chord)
      expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
    });

    it('should play session complete sound', async () => {
      const manager = new AudioManager();
      await manager.initialize();

      const ctx = (manager as unknown as { audioContext: MockAudioContext }).audioContext;
      ctx.createOscillator.mockClear();

      manager.playSessionComplete();

      // Session complete plays 4 notes
      expect(ctx.createOscillator).toHaveBeenCalledTimes(4);
    });
  });

  describe('cleanup', () => {
    it('should close audio context on destroy', async () => {
      const manager = new AudioManager();
      await manager.initialize();

      const ctx = (manager as unknown as { audioContext: MockAudioContext }).audioContext;

      manager.destroy();

      expect(ctx.close).toHaveBeenCalled();
      expect(manager.isAvailable()).toBe(false);
    });
  });

  describe('singleton', () => {
    it('should return same instance from getAudioManager', () => {
      const manager1 = getAudioManager();
      const manager2 = getAudioManager();

      expect(manager1).toBe(manager2);
    });

    it('should reset singleton on resetAudioManager', async () => {
      const manager1 = getAudioManager();
      await manager1.initialize();

      resetAudioManager();

      const manager2 = getAudioManager();
      expect(manager2).not.toBe(manager1);
      expect(manager2.isAvailable()).toBe(false);
    });
  });
});
