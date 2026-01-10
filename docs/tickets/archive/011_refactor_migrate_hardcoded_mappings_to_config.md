# Ticket #011: Refactor - Migrate Hardcoded Mappings to Config

**Status**: Open
**Priority**: Medium
**Type**: refactor
**Estimated Points**: 7 (2 + 2 + 3)
**Phase**: 1-CLI

---

## Summary

Move 3 hardcoded mapping tables from `src/lib/engine/phase1-structure.ts` to `src/data/workout_generation_rules.json` to improve data-driven architecture and enable trainers/coaches to customize workout generation defaults without code changes.

## Background

The comprehensive codebase audit (docs/CODEBASE_AUDIT_2026-01-08.md) identified 3 TODO comments in phase1-structure.ts indicating hardcoded logic that should be config-driven. Currently, these mappings are embedded in TypeScript code, reducing flexibility for non-developers who want to adjust generation behavior.

**Current Situation:**
- Default split assignment (frequency → split type): Hardcoded if-else chain
- Default progression scheme (goal → progression type): Hardcoded object literal
- Intensity profile assignment (layer + category → intensity): Hardcoded object + scattered special-cases

**Why This Matters:**
- Data-driven architecture score improves from 8.5/10 to 9.5/10
- Trainers can adjust defaults via JSON without recompiling
- Consolidates scattered category-specific logic (cardio, interval, mobility) into one place
- Reduces cognitive load when reading phase1-structure.ts

**No Breaking Changes**: This is purely internal refactoring. All 251 existing tests must continue passing with identical output.

---

## Technical Requirements

### Data Structures

**Config File Changes**: `src/data/workout_generation_rules.json`

Add 3 new top-level sections:

1. **default_split_by_frequency**: Map training frequency (2-7 days) to default split type
2. **default_progression_by_goal**: Map primary goal to default progression scheme
3. **intensity_profile_by_layer_and_category**: Map (layer, category) to intensity profile

See Implementation Plan for exact JSON schemas.

### Code Locations

**Files to Modify**:
- `src/data/workout_generation_rules.json`: Add 3 new config sections (lines 820+)
- `src/lib/engine/types.ts`: Add TypeScript interfaces for new config structures
- `src/lib/engine/phase1-structure.ts`: Replace hardcoded lookups with config reads
  - Line 38-45: assignSplit() - remove frequency if-else, read from config
  - Line 164-173: assignProgressionScheme() - remove goalProgressionMap, read from config
  - Line 209-218: assignIntensityProfile() - remove layerIntensityMap, consolidate special-cases

**Files to Create**:
- `tests/unit/phase1-structure-config-driven.test.ts`: New unit tests for config-driven behavior

**Dependencies**:
- None (internal refactoring only)
- All existing tests must pass unchanged

### TypeScript Types

Add to `src/lib/engine/types.ts`:

```typescript
export interface DefaultSplitByFrequency {
  description: string;
  [frequency: string]: string; // "2" -> "full_body", etc.
}

export interface DefaultProgressionByGoal {
  description: string;
  muscle_gain: string;
  fat_loss: string;
  athletic_performance: string;
  general_fitness: string;
  rehabilitation: string;
  body_recomposition: string;
}

export interface IntensityProfileByLayerAndCategory {
  description: string;
  default: {
    first: string;
    primary: string;
    secondary: string;
    tertiary: string;
    finisher: string;
    last: string;
  };
  cardio?: {
    finisher: string;
    default: string;
  };
  interval?: {
    finisher: string;
    tertiary: string;
    default: string;
  };
  mobility?: {
    last: string;
    default: string;
  };
  flexibility?: {
    last: string;
    default: string;
  };
  emom?: {
    finisher: string;
    default: string;
  };
  amrap?: {
    finisher: string;
    default: string;
  };
  circuit?: {
    finisher: string;
    default: string;
  };
}

// Update GenerationRules interface
export interface GenerationRules {
  version: string;
  intensity_profiles: IntensityProfiles;
  progression_schemes: ProgressionSchemes;
  experience_modifiers: ExperienceModifiers;
  time_estimates: TimeEstimates;
  category_workout_structure: CategoryWorkoutStructure;
  duration_constraints: DurationConstraints;
  split_patterns: SplitPatterns;
  split_muscle_group_mapping: SplitMuscleGroupMapping;
  muscle_group_priority_mapping: MuscleGroupPriorityMapping;
  compound_exercise_construction: CompoundExerciseConstruction;
  exercise_count_constraints: ExerciseCountConstraints;
  equipment_quotas: EquipmentQuotas;
  exercise_selection_strategy: ExerciseSelectionStrategy;
  default_split_by_frequency: DefaultSplitByFrequency; // NEW
  default_progression_by_goal: DefaultProgressionByGoal; // NEW
  intensity_profile_by_layer_and_category: IntensityProfileByLayerAndCategory; // NEW
}
```

---

## Implementation Plan

### Phase 1: Migrate Default Split Assignment (2 points)

**Goal**: Replace frequency-based if-else logic with config lookup

**Steps**:
1. Add `default_split_by_frequency` to `workout_generation_rules.json` at end of file (after line 820)
2. Add `DefaultSplitByFrequency` interface to `types.ts`
3. Update `GenerationRules` interface to include new field
4. Update `assignSplit()` in `phase1-structure.ts` to read from `rules.default_split_by_frequency`
5. Remove hardcoded if-else logic (lines 38-45)
6. Add error handling for missing frequency keys in config

**Files**:
- Modify: `src/data/workout_generation_rules.json` (add after line 820)
- Modify: `src/lib/engine/types.ts` (add interface + update GenerationRules)
- Modify: `src/lib/engine/phase1-structure.ts` (lines 22-49)

**Config Structure**:
```json
"default_split_by_frequency": {
  "description": "Maps training frequency (days/week) to default split type when user selects 'no_preference'",
  "2": "full_body",
  "3": "full_body",
  "4": "upper_lower",
  "5": "push_pull_legs",
  "6": "push_pull_legs",
  "7": "push_pull_legs"
}
```

**Code Changes** (phase1-structure.ts):
```typescript
// OLD (DELETE):
const frequency = parseInt(training_frequency);
if (frequency <= 3) {
  return 'full_body';
} else if (frequency === 4) {
  return 'upper_lower';
} else if (frequency >= 5) {
  return 'push_pull_legs';
}

// NEW (REPLACE WITH):
const frequencyKey = training_frequency; // Already a string like "2", "3", etc.
const defaultSplit = rules.default_split_by_frequency[frequencyKey];

if (!defaultSplit) {
  throw new Error(
    `No default split configured for frequency: ${frequencyKey}. ` +
    `Check workout_generation_rules.json default_split_by_frequency section.`
  );
}

return defaultSplit;
```

**Testing**:
- [ ] All 251 existing tests pass
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Manual verification: Generate workout with frequency=3, verify full_body split assigned
- [ ] Manual verification: Generate workout with frequency=5, verify push_pull_legs split assigned

**Commit Message**:
```
refactor(engine): move default split assignment to config

- Add default_split_by_frequency to workout_generation_rules.json
- Replace hardcoded if-else logic with config lookup
- Add DefaultSplitByFrequency TypeScript interface
- Improve error handling with explicit config validation

Resolves TODO comment from phase1-structure.ts line 38
Part of codebase audit technical debt cleanup (Ticket #011 Phase 1)
```

**Agent Invocations**:
```bash
# Implementation (shredly-code-writer agent)
# "Implement Phase 1 for ticket #011: Add default_split_by_frequency config section
# and update assignSplit() to read from config instead of hardcoded if-else logic"

# Code Review (code-quality-assessor agent)
# "Review Phase 1 changes from ticket #011: Verify config migration is complete,
# no hardcoded split logic remains, and error handling is proper"
```

---

### Phase 2: Migrate Default Progression Assignment (2 points)

**Goal**: Replace goal-based progression mapping object with config lookup

**Steps**:
1. Add `default_progression_by_goal` to `workout_generation_rules.json`
2. Add `DefaultProgressionByGoal` interface to `types.ts`
3. Update `GenerationRules` interface to include new field
4. Update `assignProgressionScheme()` in `phase1-structure.ts` to read from config
5. Remove hardcoded goalProgressionMap object (lines 164-173)
6. Keep category-specific static progressions (mobility/flexibility/cardio) as is (these are NOT goal-dependent)

**Files**:
- Modify: `src/data/workout_generation_rules.json` (add after default_split_by_frequency)
- Modify: `src/lib/engine/types.ts` (add interface + update GenerationRules)
- Modify: `src/lib/engine/phase1-structure.ts` (lines 139-174)

**Config Structure**:
```json
"default_progression_by_goal": {
  "description": "Maps primary training goal to default progression scheme for strength/bodyweight exercises when user selects 'no_preference'",
  "muscle_gain": "linear",
  "fat_loss": "volume",
  "athletic_performance": "wave_loading",
  "general_fitness": "volume",
  "rehabilitation": "volume",
  "body_recomposition": "linear"
}
```

**Code Changes** (phase1-structure.ts):
```typescript
// Keep these category-specific checks (lines 154-161) - NOT goal-dependent:
if (exerciseCategory === 'mobility' || exerciseCategory === 'flexibility' || exerciseCategory === 'cardio') {
  return 'static';
}
if (['emom', 'amrap', 'circuit', 'interval'].includes(exerciseCategory)) {
  return 'density';
}

// OLD (DELETE lines 164-173):
const goalProgressionMap: { [key: string]: "linear" | "volume" | "wave_loading" } = {
  muscle_gain: 'linear',
  fat_loss: 'volume',
  athletic_performance: 'wave_loading',
  general_fitness: 'volume',
  rehabilitation: 'volume',
  body_recomposition: 'linear'
};
return goalProgressionMap[primary_goal] || 'linear';

// NEW (REPLACE WITH):
const defaultProgression = rules.default_progression_by_goal[primary_goal];

if (!defaultProgression) {
  throw new Error(
    `No default progression configured for goal: ${primary_goal}. ` +
    `Check workout_generation_rules.json default_progression_by_goal section.`
  );
}

return defaultProgression as "linear" | "density" | "wave_loading" | "volume";
```

**Testing**:
- [ ] All 251 existing tests pass
- [ ] TypeScript compilation succeeds
- [ ] Manual verification: Generate workout with goal=muscle_gain, verify linear progression
- [ ] Manual verification: Generate workout with goal=fat_loss, verify volume progression
- [ ] Manual verification: Mobility exercises still use static (not affected by config)

**Commit Message**:
```
refactor(engine): move default progression assignment to config

- Add default_progression_by_goal to workout_generation_rules.json
- Replace hardcoded goalProgressionMap with config lookup
- Add DefaultProgressionByGoal TypeScript interface
- Category-specific progressions (static, density) unchanged

Resolves TODO comment from phase1-structure.ts line 151
Part of codebase audit technical debt cleanup (Ticket #011 Phase 2)
```

**Agent Invocations**:
```bash
# Implementation (shredly-code-writer agent)
# "Implement Phase 2 for ticket #011: Add default_progression_by_goal config section
# and update assignProgressionScheme() to read from config. Keep category-specific
# static/density logic intact."

# Code Review (code-quality-assessor agent)
# "Review Phase 2 changes from ticket #011: Verify progression config migration complete,
# category-specific logic preserved, no hardcoded goal mappings remain"
```

---

### Phase 3: Migrate Intensity Profile Assignment (3 points)

**Goal**: Consolidate scattered intensity assignment logic into single config structure

**Steps**:
1. Add `intensity_profile_by_layer_and_category` to `workout_generation_rules.json`
2. Add `IntensityProfileByLayerAndCategory` interface to `types.ts`
3. Update `GenerationRules` interface to include new field
4. Refactor `assignIntensityProfile()` to use nested config lookup: `config[category]?[layer] || config.default[layer]`
5. Remove hardcoded layerIntensityMap (lines 209-218)
6. Remove scattered if-statements for cardio/interval/mobility/emom/amrap/circuit (lines 190-206)
7. Simplify function to single config lookup path

**Files**:
- Modify: `src/data/workout_generation_rules.json` (add after default_progression_by_goal)
- Modify: `src/lib/engine/types.ts` (add interface + update GenerationRules)
- Modify: `src/lib/engine/phase1-structure.ts` (lines 176-219)

**Config Structure**:
```json
"intensity_profile_by_layer_and_category": {
  "description": "Maps workout layer + exercise category to intensity profile. Falls back to 'default' if category not specified.",
  "default": {
    "first": "light",
    "primary": "heavy",
    "secondary": "moderate",
    "tertiary": "moderate",
    "finisher": "heavy",
    "last": "light"
  },
  "cardio": {
    "finisher": "hiit",
    "default": "liss"
  },
  "interval": {
    "finisher": "tabata",
    "tertiary": "heavy",
    "default": "moderate"
  },
  "mobility": {
    "last": "extended",
    "default": "light"
  },
  "flexibility": {
    "last": "extended",
    "default": "light"
  },
  "emom": {
    "finisher": "heavy",
    "default": "moderate"
  },
  "amrap": {
    "finisher": "heavy",
    "default": "moderate"
  },
  "circuit": {
    "finisher": "heavy",
    "default": "moderate"
  }
}
```

**Code Changes** (phase1-structure.ts):
```typescript
// OLD (DELETE ENTIRE FUNCTION BODY lines 190-218):
export function assignIntensityProfile(
  layer: string,
  exerciseCategory: string
): "light" | "moderate" | "moderate_heavy" | "heavy" | "max" | "tabata" | "liss" | "hiit" | "amrap" | "extended" {
  // Future enhancement: Move to workout_generation_rules.json as intensity_profile_by_layer

  // [50+ lines of scattered if-statements and special-cases]

  return layerIntensityMap[layer] || 'moderate';
}

// NEW (REPLACE WITH SIMPLIFIED VERSION):
export function assignIntensityProfile(
  layer: string,
  exerciseCategory: string,
  rules: GenerationRules // ADD parameter
): "light" | "moderate" | "moderate_heavy" | "heavy" | "max" | "tabata" | "liss" | "hiit" | "amrap" | "extended" {
  const intensityConfig = rules.intensity_profile_by_layer_and_category;

  // Try category-specific mapping first
  const categoryConfig = intensityConfig[exerciseCategory];
  if (categoryConfig) {
    // Check if layer has specific override
    if (categoryConfig[layer]) {
      return categoryConfig[layer];
    }
    // Otherwise use category's default
    if (categoryConfig.default) {
      return categoryConfig.default;
    }
  }

  // Fall back to default layer mapping
  const defaultConfig = intensityConfig.default;
  if (defaultConfig && defaultConfig[layer]) {
    return defaultConfig[layer];
  }

  // Ultimate fallback
  return 'moderate';
}
```

**CRITICAL**: Update all callsites of `assignIntensityProfile()` to pass `rules` parameter:
- `phase1-structure.ts` line 242 (applyProgressionAndIntensity function)

**Testing**:
- [ ] All 251 existing tests pass
- [ ] TypeScript compilation succeeds
- [ ] Manual verification: Strength exercise in primary layer → heavy
- [ ] Manual verification: Cardio exercise in finisher layer → hiit
- [ ] Manual verification: Mobility exercise in last layer → extended
- [ ] Manual verification: EMOM exercise in finisher layer → heavy
- [ ] Manual verification: Interval exercise in tertiary layer → heavy

**Commit Message**:
```
refactor(engine): move intensity profile assignment to config

- Add intensity_profile_by_layer_and_category to rules.json
- Consolidate 50+ lines of scattered category logic into config
- Simplify assignIntensityProfile() to single lookup path
- Add IntensityProfileByLayerAndCategory TypeScript interface

Resolves TODO comment from phase1-structure.ts line 187
Part of codebase audit technical debt cleanup (Ticket #011 Phase 3)
```

**Agent Invocations**:
```bash
# Implementation (shredly-code-writer agent)
# "Implement Phase 3 for ticket #011: Add intensity_profile_by_layer_and_category
# config section and refactor assignIntensityProfile() to use nested config lookup.
# Update all callsites to pass rules parameter."

# Code Review (code-quality-assessor agent)
# "Review Phase 3 changes from ticket #011: Verify intensity config migration complete,
# all callsites updated with rules parameter, scattered category logic consolidated"
```

---

### Phase 4: Add Unit Tests for Config-Driven Behavior (Included in Phases 1-3)

**Goal**: Verify config-driven lookups work correctly and provide clear error messages

**Note**: Tests should be added incrementally during each phase, not as separate phase.

**Testing Strategy**:

**Unit Tests** (add to existing test files or create new):
- [ ] Test default split lookup: Verify frequency 2 → full_body, 5 → push_pull_legs
- [ ] Test default progression lookup: Verify muscle_gain → linear, fat_loss → volume
- [ ] Test intensity profile lookup: Verify (primary, strength) → heavy, (finisher, cardio) → hiit
- [ ] Test config fallback: Verify unknown category falls back to default layer mapping
- [ ] Test error handling: Verify missing config keys throw descriptive errors

**Backward Compatibility Test** (CRITICAL):
```typescript
// tests/unit/phase1-structure-backward-compatibility.test.ts
import { describe, it, expect } from 'vitest';
import { generateWorkoutProgram } from '../../src/lib/engine/workout-generator.js';

describe('Config Migration Backward Compatibility', () => {
  it('should generate identical output before and after config migration', () => {
    // Use a fixed seed and questionnaire to ensure deterministic output
    const questionnaire = {
      primary_goal: 'muscle_gain',
      experience_level: 'intermediate',
      training_frequency: '4',
      session_duration: '45-60',
      equipment_access: 'commercial_gym'
    };

    const workout = generateWorkoutProgram(questionnaire);

    // Verify structure matches expected output (from before migration)
    expect(workout.days['1'].focus).toBe('Upper'); // frequency=4 → upper_lower
    expect(workout.days['1'].exercises[0].progressionScheme).toBe('linear'); // muscle_gain → linear
    expect(workout.days['1'].exercises[0].intensityProfile).toBe('heavy'); // primary layer → heavy
  });
});
```

**Integration Tests** (verify end-to-end):
- [ ] Run full generation with all 6 questionnaire fixtures
- [ ] Verify output matches pre-migration baselines (no functional changes)
- [ ] Verify all 251 tests pass

**Manual Testing**:
```bash
# Generate workout before migration (save output)
npm run cli
# Answer questionnaire: muscle_gain, intermediate, 4 days, 45-60 min, commercial_gym
# Save output to tmp/before-migration.json

# Apply all 3 phases of config migration

# Generate workout after migration (compare output)
npm run cli
# Answer same questionnaire
# Save output to tmp/after-migration.json

# Compare outputs (should be identical)
diff tmp/before-migration.json tmp/after-migration.json
# Expected: No differences
```

---

## Testing Strategy

### Unit Tests

**Existing Tests** (must pass unchanged):
- [ ] All 208 unit tests pass (`npm run test:unit`)
- [ ] All 16 integration tests pass (`npm run test:integration`)
- [ ] Total: 224 tests passing (no regressions)

**New Tests** (add during implementation):
- [ ] Test default_split_by_frequency config lookup (6 frequencies)
- [ ] Test default_progression_by_goal config lookup (6 goals)
- [ ] Test intensity_profile_by_layer_and_category config lookup (default + 7 categories)
- [ ] Test missing config key error handling (3 tests)
- [ ] Test backward compatibility (identical output before/after)

**Estimated New Test Count**: 12 tests

### Integration Tests

**End-to-End Generation**:
- [ ] Generate workout with frequency=2 (verify full_body)
- [ ] Generate workout with frequency=5 (verify push_pull_legs)
- [ ] Generate workout with goal=muscle_gain (verify linear progression)
- [ ] Generate workout with goal=fat_loss (verify volume progression)
- [ ] Generate workout with cardio finisher (verify hiit intensity)
- [ ] Generate workout with mobility cooldown (verify extended intensity)

### Manual Testing

**CLI Validation**:
```bash
# Start CLI and generate workout
npm run cli

# Test Case 1: Frequency-based split assignment
# Input: training_frequency=3, training_split_preference=no_preference
# Expected: Full Body split assigned
# Verify: Check day focus in output

# Test Case 2: Goal-based progression assignment
# Input: primary_goal=athletic_performance, progression_preference=no_preference
# Expected: Wave loading progression assigned to strength exercises
# Verify: Check progressionScheme in output

# Test Case 3: Category-specific intensity assignment
# Input: Include cardio finisher exercise
# Expected: HIIT intensity profile assigned
# Verify: Check intensityProfile in output
```

**Verification Script**:
```bash
# Create temporary verification script
cat > tmp/verify-config-migration.sh << 'EOF'
#!/bin/bash
echo "Verifying config migration..."

# Check config file has new sections
grep -q "default_split_by_frequency" src/data/workout_generation_rules.json
echo "✓ default_split_by_frequency found in config"

grep -q "default_progression_by_goal" src/data/workout_generation_rules.json
echo "✓ default_progression_by_goal found in config"

grep -q "intensity_profile_by_layer_and_category" src/data/workout_generation_rules.json
echo "✓ intensity_profile_by_layer_and_category found in config"

# Check phase1-structure.ts has no hardcoded mappings
! grep -q "if (frequency <=" src/lib/engine/phase1-structure.ts
echo "✓ No hardcoded frequency logic in phase1-structure.ts"

! grep -q "goalProgressionMap" src/lib/engine/phase1-structure.ts
echo "✓ No hardcoded goal progression map in phase1-structure.ts"

! grep -q "layerIntensityMap" src/lib/engine/phase1-structure.ts
echo "✓ No hardcoded layer intensity map in phase1-structure.ts"

# Check types.ts has new interfaces
grep -q "DefaultSplitByFrequency" src/lib/engine/types.ts
echo "✓ DefaultSplitByFrequency interface added to types.ts"

grep -q "DefaultProgressionByGoal" src/lib/engine/types.ts
echo "✓ DefaultProgressionByGoal interface added to types.ts"

grep -q "IntensityProfileByLayerAndCategory" src/lib/engine/types.ts
echo "✓ IntensityProfileByLayerAndCategory interface added to types.ts"

echo ""
echo "All verification checks passed!"
EOF

chmod +x tmp/verify-config-migration.sh
./tmp/verify-config-migration.sh
```

### Test Acceptance Criteria

- [ ] All 224 existing tests pass (`npm test`)
- [ ] All 12 new tests pass
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual CLI verification complete (3 test cases)
- [ ] Verification script passes (6 checks)
- [ ] No hardcoded mappings remain in phase1-structure.ts

---

## Success Criteria

- [ ] All 3 TODO comments removed from phase1-structure.ts
- [ ] Config file contains 3 new top-level sections (default_split_by_frequency, default_progression_by_goal, intensity_profile_by_layer_and_category)
- [ ] types.ts contains 3 new interfaces matching config structure
- [ ] phase1-structure.ts has zero hardcoded mapping logic (verified by grep)
- [ ] All 224 existing tests pass (no regressions)
- [ ] 12 new tests added and passing
- [ ] Generated workout output identical before/after migration (backward compatible)
- [ ] Code follows CLAUDE.md standards
- [ ] TypeScript compilation succeeds
- [ ] assignIntensityProfile() simplified from 50+ lines to <30 lines

**Quality Metrics**:
- Data-driven architecture score: 8.5/10 → 9.5/10
- Lines of code reduced: phase1-structure.ts ~40 lines shorter
- Config coverage: 100% of assignment logic now config-driven
- Maintainability: Non-developers can adjust defaults via JSON

---

## Dependencies

### Blocked By
- None (independent refactoring)

### Blocks
- None (internal improvement, no downstream impact)

### External Dependencies
- None (uses existing infrastructure)

---

## Risks & Mitigations

### Risk 1: Config typo breaks all generation
- **Impact**: High
- **Probability**: Low
- **Mitigation**:
  - Add JSON schema validation for new config sections
  - TypeScript interfaces enforce type safety at compile time
  - Unit tests verify all config keys are present and valid
  - Manual testing before committing each phase
  - If config malformed, engine throws explicit error with config section name

### Risk 2: Backward compatibility broken (output changes)
- **Impact**: High
- **Probability**: Low
- **Mitigation**:
  - Save baseline workout output BEFORE starting migration
  - Compare output after each phase to baseline
  - All existing tests verify no regressions
  - Manual diff check of sample outputs (tmp/before-migration.json vs tmp/after-migration.json)
  - If output differs, revert phase and debug

### Risk 3: Missed callsite for assignIntensityProfile()
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**:
  - TypeScript compiler will error if parameter missing
  - Grep for all usages of assignIntensityProfile() before modifying signature
  - Unit tests verify function works with new signature
  - Code review by code-quality-assessor agent checks all callsites

### Risk 4: Config file becomes too large/complex
- **Impact**: Low
- **Probability**: Low
- **Mitigation**:
  - New sections add ~60 lines total (~7% increase from 820 to 880 lines)
  - JSON structure remains flat and readable
  - Consider splitting into multiple files if exceeds 1500 lines (future)
  - Config file is already large (820 lines) and well-structured

---

## Notes

**Design Decisions**:
1. **Keep category-specific static progressions in code**: Mobility/flexibility/cardio always use 'static' progression regardless of goal. This is fundamental to exercise physiology, not a tunable parameter, so keeping in code is appropriate.

2. **Nested config for intensity profiles**: Using `config[category][layer]` with fallback to `config.default[layer]` provides maximum flexibility while maintaining simple defaults.

3. **Explicit error messages**: When config keys are missing, throw errors that include the config section name and expected key to aid debugging.

4. **Incremental migration**: Breaking into 3 phases allows testing and committing after each mapping migration, reducing risk.

**Future Enhancements** (out of scope for this ticket):
- JSON schema validation for config file structure
- Config file versioning and migration tooling
- Split workout_generation_rules.json into multiple files by domain (intensity, progression, splits, etc.)

**References**:
- Codebase Audit: docs/CODEBASE_AUDIT_2026-01-08.md (Section 2: TODO Triage)
- Current Implementation: src/lib/engine/phase1-structure.ts (lines 38-218)
- Config File: src/data/workout_generation_rules.json

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: feat, fix, docs, style, refactor, test, chore
- Scopes: cli, engine, questionnaire, profile, schedule, live, workout-gen, exercise-selector, progression, ui, mobile, history, prs, tests
- **NEVER include "Generated with [Claude Code]" or "Co-Authored-By: Claude"**

**Example Commit Messages for This Ticket**:
```
refactor(engine): move default split assignment to config
refactor(engine): move default progression assignment to config
refactor(engine): move intensity profile assignment to config
test(engine): add config-driven assignment unit tests
```

---

## Definition of Done

- [ ] All 3 phases implemented and tested
- [ ] Phase 1: default_split_by_frequency migration complete
- [ ] Phase 2: default_progression_by_goal migration complete
- [ ] Phase 3: intensity_profile_by_layer_and_category migration complete
- [ ] All 3 TODO comments removed from phase1-structure.ts
- [ ] All 224 existing tests passing
- [ ] 12 new unit tests added and passing
- [ ] TypeScript compilation succeeds
- [ ] Backward compatibility verified (output identical before/after)
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met
- [ ] Verification script passes
- [ ] Committed with proper commit messages (3 commits, one per phase)
- [ ] CLAUDE.md "Current Development Status" updated
