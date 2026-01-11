/**
 * Timer Engine Unit Tests
 *
 * Tests for:
 * - Timer state machine transitions
 * - Work duration calculation (tempo-based)
 * - Phase transitions (idle -> work -> rest -> complete)
 * - Timer configuration per exercise type
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TimerEngine,
  createInitialTimerState,
  getTimerConfigForExercise,
  calculateWorkDuration,
  parseTempoToSeconds,
  calculateRestDuration,
  formatTimeDisplay,
  getPhaseColor,
  getTimerExerciseType,
  getTimerEngine,
  resetTimerEngine
} from '../../src/lib/engine/timer-engine';
import type { LiveExercise, TimerState, TimerConfig, TimerEvent } from '../../src/lib/engine/types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createMockStrengthExercise(): LiveExercise {
  return {
    exerciseName: 'Bench Press',
    exerciseType: 'strength',
    isCompoundParent: false,
    subExercises: [],
    prescription: {
      sets: 4,
      reps: 8,
      weight: 135,
      weightUnit: 'lbs',
      workTimeSeconds: null,
      restTimeSeconds: 90,
      tempo: '3-1-2'
    },
    completed: false,
    completedSets: 0
  };
}

function createMockBodyweightExercise(): LiveExercise {
  return {
    exerciseName: 'Push-ups',
    exerciseType: 'bodyweight',
    isCompoundParent: false,
    subExercises: [],
    prescription: {
      sets: 3,
      reps: 15,
      weight: null,
      weightUnit: null,
      workTimeSeconds: null,
      restTimeSeconds: 60,
      tempo: null
    },
    completed: false,
    completedSets: 0
  };
}

function createMockEMOMExercise(): LiveExercise {
  return {
    exerciseName: 'EMOM Block',
    exerciseType: 'emom',
    isCompoundParent: true,
    subExercises: [
      {
        exerciseName: 'Kettlebell Swings',
        exerciseType: 'strength',
        isCompoundParent: false,
        subExercises: [],
        prescription: {
          sets: 1,
          reps: 10,
          weight: 35,
          weightUnit: 'lbs',
          workTimeSeconds: null,
          restTimeSeconds: null,
          tempo: null
        },
        completed: false,
        completedSets: 0
      },
      {
        exerciseName: 'Burpees',
        exerciseType: 'bodyweight',
        isCompoundParent: false,
        subExercises: [],
        prescription: {
          sets: 1,
          reps: 8,
          weight: null,
          weightUnit: null,
          workTimeSeconds: null,
          restTimeSeconds: null,
          tempo: null
        },
        completed: false,
        completedSets: 0
      }
    ],
    prescription: {
      sets: 1,
      reps: null,
      weight: null,
      weightUnit: null,
      workTimeSeconds: 420, // 7 minutes
      restTimeSeconds: null,
      tempo: null
    },
    completed: false,
    completedSets: 0
  };
}

function createMockCircuitExercise(): LiveExercise {
  return {
    exerciseName: 'Circuit Block',
    exerciseType: 'circuit',
    isCompoundParent: true,
    subExercises: [],
    prescription: {
      sets: 3,
      reps: null,
      weight: null,
      weightUnit: null,
      workTimeSeconds: null,
      restTimeSeconds: null,
      tempo: null
    },
    completed: false,
    completedSets: 0
  };
}

function createMockIntervalExercise(): LiveExercise {
  return {
    exerciseName: 'Interval Block',
    exerciseType: 'interval',
    isCompoundParent: true,
    subExercises: [],
    prescription: {
      sets: 4,
      reps: null,
      weight: null,
      weightUnit: null,
      workTimeSeconds: 40,
      restTimeSeconds: 20,
      tempo: null
    },
    completed: false,
    completedSets: 0
  };
}

// ============================================================================
// HELPER FUNCTION TESTS
// ============================================================================

describe('createInitialTimerState', () => {
  it('should return default idle state', () => {
    const state = createInitialTimerState();

    expect(state.phase).toBe('idle');
    expect(state.mode).toBe('countdown');
    expect(state.exerciseType).toBe('strength');
    expect(state.currentSet).toBe(1);
    expect(state.totalSets).toBe(1);
    expect(state.remainingSeconds).toBe(0);
    expect(state.audioEnabled).toBe(true);
  });
});

describe('getTimerConfigForExercise', () => {
  it('should return strength config for strength exercises', () => {
    const config = getTimerConfigForExercise('strength');

    expect(config.exerciseType).toBe('strength');
    expect(config.mode).toBe('countdown');
    expect(config.phases).toContain('work');
    expect(config.phases).toContain('rest');
    expect(config.workCalculation).toBe('tempo_based');
    expect(config.logTiming).toBe('after_each_set');
  });

  it('should return bodyweight config for bodyweight exercises', () => {
    const config = getTimerConfigForExercise('bodyweight');

    expect(config.exerciseType).toBe('bodyweight');
    expect(config.mode).toBe('countdown');
    expect(config.workCalculation).toBe('tempo_based');
  });

  it('should return emom config for EMOM exercises', () => {
    const config = getTimerConfigForExercise('emom');

    expect(config.exerciseType).toBe('emom');
    expect(config.mode).toBe('countdown');
    expect(config.phases).toContain('continuous');
    expect(config.minuteMarkers).toBe(true);
    expect(config.logTiming).toBe('after_block');
    expect(config.countdownAtMinuteEnd).toBe(true);
  });

  it('should return amrap config for AMRAP exercises', () => {
    const config = getTimerConfigForExercise('amrap');

    expect(config.exerciseType).toBe('amrap');
    expect(config.minuteMarkers).toBe(true);
    expect(config.logTiming).toBe('after_block');
  });

  it('should return interval config for interval exercises', () => {
    const config = getTimerConfigForExercise('interval');

    expect(config.exerciseType).toBe('interval');
    expect(config.mode).toBe('countdown');
    expect(config.phases).toContain('work');
    expect(config.phases).toContain('rest');
    expect(config.workCalculation).toBe('from_prescription');
    expect(config.logTiming).toBe('after_block');
  });

  it('should return circuit config for circuit exercises', () => {
    const config = getTimerConfigForExercise('circuit');

    expect(config.exerciseType).toBe('circuit');
    expect(config.mode).toBe('count_up');
    expect(config.phases).toContain('continuous');
    expect(config.minuteMarkers).toBe(true);
    expect(config.logTiming).toBe('after_block');
  });
});

describe('parseTempoToSeconds', () => {
  it('should parse standard tempo string', () => {
    expect(parseTempoToSeconds('3-1-2')).toBe(6);
    expect(parseTempoToSeconds('4-0-2')).toBe(6);
    expect(parseTempoToSeconds('2-1-1')).toBe(4);
  });

  it('should return default for invalid tempo', () => {
    expect(parseTempoToSeconds('')).toBe(4);
    expect(parseTempoToSeconds('abc')).toBe(4);
    expect(parseTempoToSeconds('3-1')).toBe(4);
  });
});

describe('calculateWorkDuration', () => {
  it('should calculate tempo-based work duration for strength', () => {
    const exercise = createMockStrengthExercise();
    const config = getTimerConfigForExercise('strength');

    // 8 reps * 6 seconds (3-1-2 tempo) = 48 seconds
    const duration = calculateWorkDuration(exercise, config);
    expect(duration).toBe(48);
  });

  it('should use default tempo for bodyweight without prescription', () => {
    const exercise = createMockBodyweightExercise();
    const config = getTimerConfigForExercise('bodyweight');

    // 15 reps * 4 seconds (default tempo) = 60 seconds
    const duration = calculateWorkDuration(exercise, config);
    expect(duration).toBe(60);
  });

  it('should use prescribed work time for EMOM', () => {
    const exercise = createMockEMOMExercise();
    const config = getTimerConfigForExercise('emom');

    // Uses workTimeSeconds from prescription
    const duration = calculateWorkDuration(exercise, config);
    expect(duration).toBe(420);
  });

  it('should use prescribed work time for interval', () => {
    const exercise = createMockIntervalExercise();
    const config = getTimerConfigForExercise('interval');

    const duration = calculateWorkDuration(exercise, config);
    expect(duration).toBe(40);
  });
});

describe('calculateRestDuration', () => {
  it('should return prescribed rest time', () => {
    const exercise = createMockStrengthExercise();
    expect(calculateRestDuration(exercise)).toBe(90);
  });

  it('should use default rest time when not prescribed', () => {
    const exercise = createMockEMOMExercise();
    expect(calculateRestDuration(exercise)).toBe(60); // Default
  });

  it('should enforce minimum rest time', () => {
    const exercise = createMockStrengthExercise();
    exercise.prescription.restTimeSeconds = 5; // Below minimum
    expect(calculateRestDuration(exercise)).toBe(10); // MIN_REST_SECONDS
  });
});

describe('formatTimeDisplay', () => {
  it('should format seconds as MM:SS', () => {
    expect(formatTimeDisplay(0)).toBe('00:00');
    expect(formatTimeDisplay(30)).toBe('00:30');
    expect(formatTimeDisplay(60)).toBe('01:00');
    expect(formatTimeDisplay(90)).toBe('01:30');
    expect(formatTimeDisplay(125)).toBe('02:05');
    expect(formatTimeDisplay(3661)).toBe('61:01');
  });

  it('should handle negative values', () => {
    expect(formatTimeDisplay(-30)).toBe('-00:30');
  });

  it('should handle decimal values', () => {
    expect(formatTimeDisplay(30.7)).toBe('00:30');
    expect(formatTimeDisplay(30.3)).toBe('00:30');
  });
});

describe('getPhaseColor', () => {
  it('should return correct colors for each phase', () => {
    expect(getPhaseColor('work')).toBe('#22c55e'); // green
    expect(getPhaseColor('rest')).toBe('#3b82f6'); // blue
    expect(getPhaseColor('countdown')).toBe('#eab308'); // yellow
    expect(getPhaseColor('complete')).toBe('#a855f7'); // purple
    expect(getPhaseColor('paused')).toBe('#6b7280'); // gray
  });

  it('should return idle color for unknown phase', () => {
    expect(getPhaseColor('unknown' as any)).toBe('#374151');
  });
});

describe('getTimerExerciseType', () => {
  it('should detect compound exercise types from category', () => {
    expect(getTimerExerciseType('emom')).toBe('emom');
    expect(getTimerExerciseType('EMOM')).toBe('emom');
    expect(getTimerExerciseType('amrap')).toBe('amrap');
    expect(getTimerExerciseType('circuit')).toBe('circuit');
    expect(getTimerExerciseType('interval')).toBe('interval');
  });

  it('should return strength by default', () => {
    expect(getTimerExerciseType(undefined)).toBe('strength');
    expect(getTimerExerciseType('')).toBe('strength');
    expect(getTimerExerciseType('Strength')).toBe('strength');
  });

  it('should return bodyweight when flagged', () => {
    expect(getTimerExerciseType(undefined, true)).toBe('bodyweight');
    expect(getTimerExerciseType('', true)).toBe('bodyweight');
  });
});

// ============================================================================
// TIMER ENGINE TESTS
// ============================================================================

describe('TimerEngine', () => {
  let engine: TimerEngine;

  beforeEach(() => {
    resetTimerEngine();
    engine = new TimerEngine();
    vi.useFakeTimers();
  });

  afterEach(() => {
    engine.stop();
    vi.useRealTimers();
    resetTimerEngine();
  });

  describe('initialization', () => {
    it('should start in idle state', () => {
      const state = engine.getState();
      expect(state.phase).toBe('idle');
    });

    it('should initialize for strength exercise', () => {
      const exercise = createMockStrengthExercise();
      engine.initializeForExercise(exercise);

      const state = engine.getState();
      expect(state.exerciseType).toBe('strength');
      expect(state.totalSets).toBe(4);
      expect(state.phase).toBe('idle');
    });

    it('should initialize for EMOM exercise with minutes', () => {
      const exercise = createMockEMOMExercise();
      engine.initializeForExercise(exercise);

      const state = engine.getState();
      expect(state.exerciseType).toBe('emom');
      expect(state.totalMinutes).toBe(7);
      expect(state.totalSubExercises).toBe(2);
    });

    it('should initialize for circuit with count-up mode', () => {
      const exercise = createMockCircuitExercise();
      engine.initializeForExercise(exercise);

      const state = engine.getState();
      const config = engine.getConfig();
      expect(config.mode).toBe('count_up');
    });
  });

  describe('phase transitions', () => {
    it('should transition from idle to countdown to work (strength)', () => {
      const exercise = createMockStrengthExercise();
      engine.initializeForExercise(exercise);

      engine.start();

      // Should be in countdown (strength has countdown_before: work)
      expect(engine.getState().phase).toBe('countdown');

      // Advance timer past countdown
      vi.advanceTimersByTime(3500);

      // Should now be in work phase
      expect(engine.getState().phase).toBe('work');
    });

    it('should transition work -> rest -> next set', () => {
      const exercise = createMockStrengthExercise();
      engine.initializeForExercise(exercise);
      engine.start();

      // Skip countdown
      vi.advanceTimersByTime(3500);
      expect(engine.getState().phase).toBe('work');

      // Complete work phase (48 seconds for 8 reps @ 6s tempo)
      vi.advanceTimersByTime(50000);

      // Strength exercises go to data entry after each set
      expect(engine.getState().phase).toBe('entry');
    });

    it('should pause and resume correctly', () => {
      const exercise = createMockStrengthExercise();
      engine.initializeForExercise(exercise);
      engine.start();

      // Skip countdown
      vi.advanceTimersByTime(3500);
      expect(engine.getState().phase).toBe('work');

      // Pause
      engine.pause();
      expect(engine.getState().phase).toBe('paused');

      const remainingBeforeResume = engine.getState().remainingSeconds;

      // Advance time while paused (should not affect timer)
      vi.advanceTimersByTime(10000);

      // Resume
      engine.resume();
      expect(engine.getState().phase).toBe('work');

      // Remaining should be same as before pause
      expect(engine.getState().remainingSeconds).toBeCloseTo(remainingBeforeResume, 0);
    });

    it('should skip current phase correctly', () => {
      const exercise = createMockStrengthExercise();
      engine.initializeForExercise(exercise);
      engine.start();

      // Skip countdown
      engine.skip();
      expect(engine.getState().phase).toBe('work');

      // Skip work
      engine.skip();
      expect(engine.getState().phase).toBe('entry');
    });

    it('should stop timer and reset state', () => {
      const exercise = createMockStrengthExercise();
      engine.initializeForExercise(exercise);
      engine.start();

      engine.stop();

      const state = engine.getState();
      expect(state.phase).toBe('idle');
      expect(state.currentSet).toBe(1);
    });
  });

  describe('event emission', () => {
    it('should emit phase_change events', () => {
      const exercise = createMockStrengthExercise();
      engine.initializeForExercise(exercise);

      const events: TimerEvent[] = [];
      engine.subscribe((event) => events.push(event));

      engine.start();

      const phaseChanges = events.filter(e => e.type === 'phase_change');
      expect(phaseChanges.length).toBeGreaterThan(0);
      expect(phaseChanges[0].state.phase).toBe('countdown');
    });

    it('should emit tick events', () => {
      const exercise = createMockStrengthExercise();
      engine.initializeForExercise(exercise);

      const events: TimerEvent[] = [];
      engine.subscribe((event) => events.push(event));

      engine.start();
      vi.advanceTimersByTime(500);

      const ticks = events.filter(e => e.type === 'tick');
      expect(ticks.length).toBeGreaterThan(0);
    });

    it('should emit countdown_tick at 3, 2, 1', () => {
      const exercise = createMockStrengthExercise();
      engine.initializeForExercise(exercise);

      const countdownTicks: number[] = [];
      engine.subscribe((event) => {
        if (event.type === 'countdown_tick' && event.countdownValue !== undefined) {
          countdownTicks.push(event.countdownValue);
        }
      });

      engine.start();

      // Run through countdown phase
      vi.advanceTimersByTime(3500);

      // Should have captured 3, 2, 1
      expect(countdownTicks).toContain(3);
      expect(countdownTicks).toContain(2);
      expect(countdownTicks).toContain(1);
    });

    it('should allow unsubscribing', () => {
      const exercise = createMockStrengthExercise();
      engine.initializeForExercise(exercise);

      const events: TimerEvent[] = [];
      const unsubscribe = engine.subscribe((event) => events.push(event));

      engine.start();
      vi.advanceTimersByTime(200);

      const countBefore = events.length;

      unsubscribe();

      vi.advanceTimersByTime(200);

      // Should not receive more events after unsubscribe
      expect(events.length).toBe(countBefore);
    });
  });

  describe('set tracking', () => {
    it('should track current set number', () => {
      const exercise = createMockStrengthExercise();
      engine.initializeForExercise(exercise);

      expect(engine.getState().currentSet).toBe(1);
      expect(engine.getState().totalSets).toBe(4);

      engine.advanceSet();
      expect(engine.getState().currentSet).toBe(2);

      engine.advanceSet();
      expect(engine.getState().currentSet).toBe(3);
    });

    it('should not advance beyond total sets', () => {
      const exercise = createMockStrengthExercise();
      engine.initializeForExercise(exercise);

      // Advance to max
      engine.advanceSet();
      engine.advanceSet();
      engine.advanceSet();
      expect(engine.getState().currentSet).toBe(4);

      // Should not go beyond
      engine.advanceSet();
      expect(engine.getState().currentSet).toBe(4);
    });
  });

  describe('audio control', () => {
    it('should toggle audio enabled state', () => {
      expect(engine.getState().audioEnabled).toBe(true);

      engine.setAudioEnabled(false);
      expect(engine.getState().audioEnabled).toBe(false);

      engine.setAudioEnabled(true);
      expect(engine.getState().audioEnabled).toBe(true);
    });

    it('should preserve audio setting across exercise changes', () => {
      engine.setAudioEnabled(false);

      const exercise = createMockStrengthExercise();
      engine.initializeForExercise(exercise);

      expect(engine.getState().audioEnabled).toBe(false);
    });
  });

  describe('data entry phase', () => {
    it('should enter and exit data entry phase', () => {
      const exercise = createMockStrengthExercise();
      engine.initializeForExercise(exercise);
      engine.start();

      // Skip to work
      vi.advanceTimersByTime(3500);

      engine.enterDataEntry();
      expect(engine.getState().phase).toBe('entry');

      engine.exitDataEntry();
      // After data entry on first set (not last), should start next set
      expect(engine.getState().phase).toBe('countdown');
    });

    it('should complete exercise when exiting data entry on last set', () => {
      const exercise = createMockStrengthExercise();
      engine.initializeForExercise(exercise);

      // Manually set to last set
      engine.advanceSet();
      engine.advanceSet();
      engine.advanceSet();
      expect(engine.getState().currentSet).toBe(4);

      engine.start();
      vi.advanceTimersByTime(3500);

      engine.enterDataEntry();
      engine.exitDataEntry();

      expect(engine.getState().phase).toBe('complete');
    });
  });

  describe('EMOM sub-exercise tracking', () => {
    it('should track current sub-exercise for EMOM', () => {
      const exercise = createMockEMOMExercise();
      engine.initializeForExercise(exercise);

      expect(engine.getState().currentSubExercise).toBe(0);
      expect(engine.getState().totalSubExercises).toBe(2);

      engine.setCurrentSubExercise(1);
      expect(engine.getState().currentSubExercise).toBe(1);
    });

    it('should not set invalid sub-exercise index', () => {
      const exercise = createMockEMOMExercise();
      engine.initializeForExercise(exercise);

      engine.setCurrentSubExercise(5); // Invalid
      expect(engine.getState().currentSubExercise).toBe(0);

      engine.setCurrentSubExercise(-1); // Invalid
      expect(engine.getState().currentSubExercise).toBe(0);
    });
  });
});

// ============================================================================
// SINGLETON TESTS
// ============================================================================

describe('Timer Engine Singleton', () => {
  afterEach(() => {
    resetTimerEngine();
  });

  it('should return same instance', () => {
    const instance1 = getTimerEngine();
    const instance2 = getTimerEngine();

    expect(instance1).toBe(instance2);
  });

  it('should reset instance correctly', () => {
    const instance1 = getTimerEngine();
    instance1.setAudioEnabled(false);

    resetTimerEngine();

    const instance2 = getTimerEngine();
    expect(instance2).not.toBe(instance1);
    expect(instance2.getState().audioEnabled).toBe(true);
  });
});
