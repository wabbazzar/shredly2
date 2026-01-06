# Shredly 2.0 Test Infrastructure

This directory contains the test infrastructure for the Shredly 2.0 workout generation engine using Vitest.

## Directory Structure

```
tests/
+-- unit/                 # Unit tests for individual modules
+-- integration/          # End-to-end generation tests
+-- diagnostics/          # Debugging/analysis tools (not run in CI)
+-- fixtures/             # Test data (questionnaire answers, expected outputs)
+-- helpers/              # Shared test utilities
+-- README.md            # This file
```

## Running Tests

### Basic Commands

```bash
# Run all tests (single run)
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Watch mode for development (re-runs on file changes)
npm run test:watch

# UI mode (browser-based test viewer)
npm run test:ui

# Coverage report
npm run test:coverage
```

### Running Diagnostic Tools

Diagnostic tools are standalone scripts in `tests/diagnostics/` that are NOT run as part of the test suite. They're used for debugging and analysis:

```bash
# Run exercise filtering diagnostics (using npm script)
npm run test:diagnostics

# Or run directly with tsx
tsx tests/diagnostics/exercise-filtering-diagnostics.ts
```

**What the diagnostics tool does:**
- Tests problematic equipment + experience combinations
- Breaks down filtering steps to identify bottlenecks
- Shows which exercises almost match (fail on one criterion)
- Provides suggestions for fixing filtering issues

## Writing Tests

### Test File Naming

- Unit tests: `tests/unit/<module-name>.test.ts`
- Integration tests: `tests/integration/<feature-name>.test.ts`
- All test files MUST end with `.test.ts` to be discovered by Vitest

### Test Structure

Use Vitest's Jest-compatible API (describe, it, expect):

```typescript
import { describe, it, expect } from 'vitest';
import { generateWorkout } from '../../src/lib/engine/workout-generator.js';
import { BEGINNER_FULL_BODY } from '../fixtures/questionnaire-answers.js';
import { validateWorkoutStructure } from '../helpers/validation.js';

describe('workout-generator', () => {
  it('should generate valid workout structure', () => {
    const workout = generateWorkout(BEGINNER_FULL_BODY);

    // Use validation helper
    expect(() => validateWorkoutStructure(workout)).not.toThrow();
  });

  it('should respect weeks constraint', () => {
    const workout = generateWorkout(BEGINNER_FULL_BODY);

    expect(workout.metadata.weeks).toBe(3);
  });
});
```

### Using Test Fixtures

Import fixtures from `tests/fixtures/questionnaire-answers.ts`:

```typescript
import {
  BEGINNER_FULL_BODY,
  INTERMEDIATE_PPL,
  ADVANCED_UPPER_LOWER,
  EXPERT_ULPPL_GYM,
  BODYWEIGHT_ONLY_EXPERT,
  MINIMAL_EQUIPMENT_BEGINNER,
  ALL_FIXTURES,
  FIXTURE_NAMES
} from '../fixtures/questionnaire-answers.js';

// Test with a specific fixture
const workout = generateWorkout(BEGINNER_FULL_BODY);

// Test with all fixtures
for (let i = 0; i < ALL_FIXTURES.length; i++) {
  const fixture = ALL_FIXTURES[i];
  const name = FIXTURE_NAMES[i];

  it(`should generate workout for ${name}`, () => {
    const workout = generateWorkout(fixture);
    expect(workout).toBeDefined();
  });
}
```

### Using Validation Helpers

Import validation helpers from `tests/helpers/validation.ts`:

```typescript
import {
  validateWorkoutStructure,
  validateExerciseReferences,
  validateDurationConstraints,
  validateMuscleGroupCoverage,
  validateProgressionLogic
} from '../helpers/validation.js';
import exerciseDB from '../../src/data/exercise_database.json';

// Validate workout structure
validateWorkoutStructure(workout);

// Validate exercise references exist in database
validateExerciseReferences(workout, exerciseDB);

// Validate duration constraints for a day
const day = workout.days['1'];
validateDurationConstraints(day, 45, 1); // 45 min max, week 1

// Validate muscle group coverage
validateMuscleGroupCoverage(day, exerciseDB, ['Chest', 'Triceps']);

// Validate progression logic
const exercise = workout.days['1'].exercises[0];
validateProgressionLogic(exercise, 3); // 3 weeks
```

## Testing Philosophy

### Critical Path Coverage

**Focus on critical paths, not comprehensive coverage.** The project is still evolving, so we establish patterns and test the most important functionality:

#### MUST Test (Critical Path):
- ✅ Workout generation produces valid structure
- ✅ Exercise filtering respects equipment constraints
- ✅ Exercise filtering respects experience level
- ✅ Duration constraints are honored
- ✅ Progressive overload calculations are correct
- ✅ Compound exercises (EMOM/Circuit/AMRAP) work correctly
- ✅ Edge cases: expert + bodyweight-only, limited equipment

#### NICE to Test (Future):
- Snapshot testing for generated workout JSON
- Performance benchmarks (<2 second generation time)
- Regression tests as bugs are discovered
- UI component tests (Phase 2+)
- E2E mobile app tests (Phase 4+)

### Fast Feedback Loop

**Target: <5 seconds total test runtime**

- Use fast validation logic
- Avoid file I/O in unit tests
- Keep integration tests minimal
- Mock external dependencies if needed

### Fail Loudly

**Tests should provide descriptive error messages:**

❌ Bad:
```typescript
expect(workout.metadata).toBeTruthy();
```

✅ Good:
```typescript
expect(workout.metadata).toBeDefined();
expect(workout.metadata.programId).toBeDefined();
expect(workout.metadata.weeks).toBeGreaterThan(0);
```

## Adding New Tests

### When to Add Tests

Add tests when:
1. Adding new features to the generation engine
2. Fixing bugs (regression test)
3. Refactoring existing code (ensure no breakage)
4. Adding edge case handling

### Test Template

```typescript
import { describe, it, expect } from 'vitest';

describe('module-name', () => {
  describe('function-name', () => {
    it('should handle standard case', () => {
      // Arrange
      const input = ...;

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toBeDefined();
    });

    it('should handle edge case', () => {
      // Test edge case
    });

    it('should throw on invalid input', () => {
      expect(() => functionName(null)).toThrow();
    });
  });
});
```

## Maintenance

### When Specs Change

If WORKOUT_SPEC.md or exercise_database.json changes:

1. Tests will fail loudly (this is good!)
2. Update test fixtures in `tests/fixtures/`
3. Update validation helpers in `tests/helpers/`
4. Fix failing tests

### When Adding New Fixtures

Add new fixtures to `tests/fixtures/questionnaire-answers.ts`:

```typescript
export const NEW_FIXTURE: QuestionnaireAnswers = {
  primary_goal: 'muscle_gain',
  experience_level: 'intermediate',
  // ... other fields
};

// Add to ALL_FIXTURES array
export const ALL_FIXTURES: QuestionnaireAnswers[] = [
  // ... existing fixtures
  NEW_FIXTURE
];

// Add to FIXTURE_NAMES array
export const FIXTURE_NAMES = [
  // ... existing names
  'NEW_FIXTURE'
];
```

## Troubleshooting

### Tests Not Running

Check that:
- File ends with `.test.ts`
- File is in `tests/unit/` or `tests/integration/`
- TypeScript compiles without errors (`npm run typecheck`)

### TypeScript Import Errors

- Use `.js` extensions in imports (ESM requirement)
- Use relative paths: `../../src/lib/engine/types.js`
- Check tsconfig.json includes test files

### Slow Tests

- Check for file I/O operations (move to integration tests)
- Use `npm run test:ui` to identify slow tests
- Consider mocking expensive operations

## CI Integration (Future)

When setting up CI/CD:

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: npm test

- name: Check coverage
  run: npm run test:coverage
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [WORKOUT_SPEC.md](../docs/WORKOUT_SPEC.md) - Data structure specification
- [EXERCISE_HISTORY_SPEC.md](../docs/EXERCISE_HISTORY_SPEC.md) - History format
- [exercise_database.json](../src/data/exercise_database.json) - Exercise metadata
