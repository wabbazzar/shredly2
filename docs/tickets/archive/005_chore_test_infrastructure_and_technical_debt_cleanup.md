# Ticket #005: Chore - Test Infrastructure Setup and Technical Debt Cleanup

**Status**: Open
**Priority**: High
**Type**: chore
**Estimated Points**: 13 (fibonacci scale: 2+3+3+2+2+1 buffer)
**Phase**: 1-CLI

---

## Summary

Establish formal test infrastructure with Vitest (SvelteKit's recommended test framework), organize scattered test files into proper directory structure, formalize valuable diagnostic tests, clean up temporary compiled artifacts, and create critical path test coverage for workout generation engine.

## Background

The CLI/engine development phase has produced several valuable test scripts (end-to-end-test.ts, test-full-body-coverage.ts, diagnose-filtering.ts) scattered in tmp/ directory alongside compiled JS artifacts (tmp/src/, tmp/tmp/). Root-level test files (test-workout.js, test.json) and temporary workout files (.workout-temp-*.json) need organization. The project lacks formal test infrastructure, making it difficult for agents to validate changes without breaking existing functionality.

This ticket establishes testing foundations to enable confident autonomous development while the project architecture continues to solidify. Focus is on critical path coverage (not comprehensive), establishing patterns, and enabling safe refactoring.

## Technical Requirements

### Data Structures

Reference WORKOUT_SPEC.md, EXERCISE_HISTORY_SPEC.md, and exercise_database.json:
- Test fixtures must use valid QuestionnaireAnswers structure
- Generated workouts must validate against WORKOUT_SPEC.md schema
- Exercise selections must reference exercise_database.json exercises
- Test data should cover edge cases: bodyweight-only, limited equipment, various splits

### Code Locations

**Files to create:**
- /home/wabbazzar/code/shredly2/vitest.config.ts (Vitest configuration)
- /home/wabbazzar/code/shredly2/tests/unit/workout-generator.test.ts
- /home/wabbazzar/code/shredly2/tests/unit/exercise-selector.test.ts
- /home/wabbazzar/code/shredly2/tests/unit/phase2-parameters.test.ts
- /home/wabbazzar/code/shredly2/tests/integration/end-to-end-generation.test.ts
- /home/wabbazzar/code/shredly2/tests/fixtures/questionnaire-answers.ts
- /home/wabbazzar/code/shredly2/tests/helpers/validation.ts
- /home/wabbazzar/code/shredly2/tests/README.md

**Files to move/formalize:**
- tmp/end-to-end-test.ts → tests/integration/end-to-end-generation.test.ts (adapt to test framework)
- tmp/test-full-body-coverage.ts → tests/integration/muscle-group-coverage.test.ts (formalize)
- tmp/diagnose-filtering.ts → tests/diagnostics/exercise-filtering-diagnostics.ts (archive as diagnostic tool)

**Files to delete:**
- tmp/src/ (compiled JS artifacts)
- tmp/tmp/ (compiled JS artifacts)
- test-workout.js (obsolete root-level test)
- test.json (obsolete root-level test output)
- All .workout-temp-*.json files in root

**Files to modify:**
- /home/wabbazzar/code/shredly2/.gitignore (add .workout-temp-*.json pattern)
- /home/wabbazzar/code/shredly2/package.json (add test scripts)
- /home/wabbazzar/code/shredly2/tsconfig.json (potentially add test path configuration)
- /home/wabbazzar/code/shredly2/CLAUDE.md (update Testing Requirements, Project Structure, Common Development Tasks)
- /home/wabbazzar/code/shredly2/.claude/agents/shredly-code-writer.md (add test workflow integration)
- /home/wabbazzar/code/shredly2/.claude/agents/test-writer.md (already references Vitest - verify accuracy)
- /home/wabbazzar/code/shredly2/.claude/agents/ticket-writer.md (add test infrastructure requirements)

**Dependencies:**
- vitest (SvelteKit's official test framework, Jest-compatible API)
- happy-dom (fast DOM implementation for component testing)
- @vitest/ui (optional: browser-based test UI for better DX)

### TypeScript Types

All existing types from src/lib/engine/types.ts can be reused:

```typescript
// tests/fixtures/questionnaire-answers.ts
import type { QuestionnaireAnswers } from '../../src/lib/engine/types.js';

export const BEGINNER_FULL_BODY: QuestionnaireAnswers = {
  primary_goal: 'general_fitness',
  experience_level: 'beginner',
  training_frequency: '3',
  session_duration: '30-45',
  equipment_access: 'bodyweight_only',
  training_split_preference: 'full_body',
  program_duration: '3_weeks',
  progression_preference: 'linear'
};

export const EXPERT_ULPPL_GYM: QuestionnaireAnswers = {
  primary_goal: 'muscle_gain',
  experience_level: 'expert',
  training_frequency: '5',
  session_duration: '60-90',
  equipment_access: 'commercial_gym',
  training_split_preference: 'ulppl',
  program_duration: '3_weeks',
  progression_preference: 'volume'
};

// ... additional fixtures for edge cases
```

```typescript
// tests/helpers/validation.ts
import type { WorkoutProgram, WorkoutDay, Exercise } from '../../src/lib/engine/types.js';

export function validateWorkoutStructure(workout: WorkoutProgram): void {
  // Validates against WORKOUT_SPEC.md requirements
  // Throws descriptive errors if validation fails
}

export function validateExerciseReferences(
  exercises: Exercise[],
  exerciseDB: ExerciseDatabase
): void {
  // Ensures all exercise names exist in database
  // Validates muscle groups, equipment, difficulty
}

export function validateDurationConstraints(
  workout: WorkoutDay,
  maxMinutes: number
): void {
  // Calculates estimated duration
  // Validates it stays within bounds
}
```

---

## Implementation Plan

### Phase 1: Directory Structure and Cleanup (2 points)

**Goal**: Establish clean project structure with organized test directories and remove technical debt.

**Steps:**
1. Create tests/ directory structure:
   ```
   tests/
   +-- unit/                 # Unit tests for individual modules
   +-- integration/          # End-to-end generation tests
   +-- diagnostics/          # Debugging/analysis tools (not run in CI)
   +-- fixtures/             # Test data (questionnaire answers, expected outputs)
   +-- helpers/              # Shared test utilities
   +-- README.md            # Testing conventions and patterns
   ```
2. Delete compiled artifacts and obsolete files:
   - rm -rf tmp/src/ tmp/tmp/
   - rm test-workout.js test.json
   - rm .workout-temp-*.json
3. Update .gitignore to prevent future accumulation:
   - Add pattern: `.workout-temp-*.json`
   - Ensure tmp/ directory exclusions are correct
4. Verify tmp/ directory only contains legitimate test scripts and markdown notes

**Files:**
- Create: tests/ directory structure
- Delete: tmp/src/, tmp/tmp/, test-workout.js, test.json, .workout-temp-*.json
- Modify: .gitignore

**Testing:**
- [ ] Verify git status shows proper cleanup
- [ ] Verify .gitignore prevents .workout-temp-*.json from appearing in git status
- [ ] Verify tmp/ only contains .ts and .md files

**Commit Message:**
```
chore(tests): establish test directory structure and clean up technical debt

- Create tests/ directory with unit, integration, diagnostics, fixtures, helpers subdirectories
- Remove compiled JS artifacts from tmp/src/ and tmp/tmp/
- Delete obsolete root-level test files (test-workout.js, test.json)
- Delete temporary workout files (.workout-temp-*.json)
- Update .gitignore to exclude .workout-temp-*.json pattern
- Clean project structure for formal test infrastructure
```

**Agent Invocations:**
```bash
# Manual file operations for this phase
# No shredly-code-writer needed - just cleanup
```

---

### Phase 2: Test Framework Setup and Fixtures (3 points)

**Goal**: Install and configure Vitest, create reusable test fixtures covering critical scenarios.

**Steps:**
1. Install Vitest and dependencies:
   ```bash
   npm install -D vitest happy-dom @vitest/ui
   ```
2. Create vitest.config.ts:
   ```typescript
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     test: {
       globals: true,
       environment: 'happy-dom',
       include: ['tests/**/*.test.ts'],
       coverage: {
         provider: 'v8',
         reporter: ['text', 'json', 'html'],
         exclude: ['**/node_modules/**', '**/dist/**', '**/tmp/**']
       }
     }
   });
   ```
3. Update package.json scripts:
   ```json
   {
     "test": "vitest run",
     "test:unit": "vitest run tests/unit",
     "test:integration": "vitest run tests/integration",
     "test:watch": "vitest",
     "test:ui": "vitest --ui",
     "test:coverage": "vitest run --coverage"
   }
   ```
4. Create tests/fixtures/questionnaire-answers.ts with fixtures:
   - BEGINNER_FULL_BODY (bodyweight, 3 days, 30-45min)
   - INTERMEDIATE_PPL (home gym, 5 days, 45-60min)
   - ADVANCED_UPPER_LOWER (commercial gym, 4 days, 60-90min)
   - EXPERT_ULPPL_GYM (commercial gym, 5 days, 60-90min)
   - BODYWEIGHT_ONLY_EXPERT (bodyweight, 6 days, 45-60min) - edge case
   - MINIMAL_EQUIPMENT_BEGINNER (dumbbells, 3 days, 30-45min) - edge case
5. Create tests/helpers/validation.ts with validation functions:
   - validateWorkoutStructure() - checks WORKOUT_SPEC.md compliance
   - validateExerciseReferences() - checks exercise_database.json references
   - validateDurationConstraints() - checks time bounds
   - validateMuscleGroupCoverage() - checks split adherence
   - validateProgressionLogic() - checks week-to-week progression
6. Create tests/README.md documenting:
   - How to run tests (npm test, npm run test:unit, etc.)
   - How to write new tests (conventions, patterns)
   - Where to add test fixtures
   - How to use validation helpers
   - Critical path coverage strategy (what MUST be tested vs nice-to-have)

**Files:**
- Modify: package.json (add vitest dependency and test scripts)
- Create: vitest.config.ts (Vitest configuration)
- Create: tests/fixtures/questionnaire-answers.ts
- Create: tests/helpers/validation.ts
- Create: tests/README.md

**Testing:**
- [ ] npm test runs without errors (even if no tests yet)
- [ ] Fixtures export valid QuestionnaireAnswers objects
- [ ] Validation helpers can import types without errors
- [ ] TypeScript compilation succeeds for test files

**Commit Message:**
```
chore(tests): configure Vitest and create test fixtures

- Install vitest, happy-dom, and @vitest/ui dev dependencies
- Create vitest.config.ts with globals, happy-dom environment, and coverage
- Add test scripts to package.json (test, test:unit, test:integration, test:watch, test:ui)
- Create questionnaire answer fixtures for 6 critical scenarios
- Create validation helper functions for workout structure compliance
- Document testing conventions and patterns in tests/README.md
- Establish foundation for critical path test coverage using SvelteKit's official test framework
```

**Agent Invocations:**
```bash
# Use shredly-code-writer for fixture creation
# Invoke: shredly-code-writer agent with "Create test fixtures from ticket #005 Phase 2"

# Use shredly-code-writer for validation helpers
# Invoke: shredly-code-writer agent with "Create validation helpers from ticket #005 Phase 2"
```

---

### Phase 3: Critical Path Unit Tests (3 points)

**Goal**: Create unit tests for core workout generation functions covering parameter validation and exercise selection.

**Steps:**
1. Create tests/unit/workout-generator.test.ts:
   - Test: generateWorkout() produces valid WorkoutProgram structure
   - Test: generateWorkout() throws on invalid QuestionnaireAnswers
   - Test: Generated workout respects weeks/daysPerWeek constraints
   - Test: Generated workout metadata matches questionnaire inputs
   - Test: Determinism - same input produces same output (if shuffle disabled)
2. Create tests/unit/exercise-selector.test.ts:
   - Test: Exercise filtering respects equipment constraints
   - Test: Exercise filtering respects experience level (difficulty + external_load)
   - Test: Exercise selection matches split muscle group mapping
   - Test: Exercise count stays within duration constraints
   - Test: Bodyweight-only configurations don't select barbell exercises
   - Test: Edge case - expert + bodyweight-only doesn't throw empty pool errors
3. Create tests/unit/phase2-parameters.test.ts:
   - Test: Rest time calculations produce valid integers (seconds)
   - Test: Work time calculations handle time units correctly
   - Test: Weight progression calculates correctly week-to-week
   - Test: RPE/RIR values stay within valid ranges
   - Test: Floating point precision doesn't corrupt rest/work times

**Files:**
- Create: tests/unit/workout-generator.test.ts
- Create: tests/unit/exercise-selector.test.ts
- Create: tests/unit/phase2-parameters.test.ts

**Testing:**
- [ ] npm run test:unit passes all tests
- [ ] Tests use fixtures from tests/fixtures/
- [ ] Tests use validation helpers from tests/helpers/
- [ ] Test failures provide descriptive error messages
- [ ] Code coverage includes critical paths (not comprehensive, just critical)

**Commit Message:**
```
test(engine): add critical path unit tests for workout generation

- Add workout-generator tests: structure validation, determinism, metadata
- Add exercise-selector tests: filtering, equipment constraints, muscle group adherence
- Add phase2-parameters tests: rest/work time calculations, progression logic
- Cover edge cases: bodyweight-only expert, limited equipment scenarios
- Ensure parameter validation catches invalid inputs
```

**Agent Invocations:**
```bash
# Use test-writer for test creation
# Invoke: test-writer agent with "Write unit tests for workout-generator from ticket #005 Phase 3"
# Invoke: test-writer agent with "Write unit tests for exercise-selector from ticket #005 Phase 3"
# Invoke: test-writer agent with "Write unit tests for phase2-parameters from ticket #005 Phase 3"

# Use test-critic for review
# Invoke: test-critic agent with "Review unit tests from ticket #005 Phase 3"

# Use test-writer again for improvements
# Invoke: test-writer agent with "Implement test improvements from test-critic feedback"
```

---

### Phase 4: Integration Tests and Formalize Existing Tests (2 points)

**Goal**: Formalize existing tmp/ test scripts into proper integration tests and add end-to-end validation.

**Steps:**
1. Adapt tmp/end-to-end-test.ts → tests/integration/end-to-end-generation.test.ts:
   - Convert to Node.js test runner format (describe/it blocks)
   - Use fixtures from tests/fixtures/
   - Add validation using tests/helpers/validation.ts
   - Expand to cover all 6 fixture scenarios
2. Adapt tmp/test-full-body-coverage.ts → tests/integration/muscle-group-coverage.test.ts:
   - Convert to test framework format
   - Test Full Body, Push/Pull/Legs, Upper/Lower splits
   - Assert muscle group balance ratios meet thresholds
   - Validate coverage across different experience levels
3. Move tmp/diagnose-filtering.ts → tests/diagnostics/exercise-filtering-diagnostics.ts:
   - Keep as standalone diagnostic tool (not run in CI)
   - Update imports to reference test fixtures
   - Document usage in tests/README.md
4. Clean up tmp/ directory:
   - Remove or archive tmp/*.json test outputs
   - Keep only markdown notes and diagnostic tools
   - Update tmp/ directory structure documentation in CLAUDE.md if needed

**Files:**
- Create: tests/integration/end-to-end-generation.test.ts
- Create: tests/integration/muscle-group-coverage.test.ts
- Create: tests/diagnostics/exercise-filtering-diagnostics.ts
- Delete/Archive: tmp/end-to-end-test.ts, tmp/test-full-body-coverage.ts, tmp/diagnose-filtering.ts
- Modify: tests/README.md (document diagnostics usage)

**Testing:**
- [ ] npm run test:integration passes all tests
- [ ] Integration tests validate full generation pipeline
- [ ] Muscle group coverage tests assert balanced distribution
- [ ] Diagnostics tool runs independently (not in test suite)
- [ ] All tests run in <5 seconds total (fast feedback loop)

**Commit Message:**
```
test(integration): formalize end-to-end and muscle coverage tests

- Convert tmp/end-to-end-test.ts to formal integration test
- Convert tmp/test-full-body-coverage.ts to muscle group coverage test
- Move tmp/diagnose-filtering.ts to diagnostics/ directory
- Expand integration tests to cover all fixture scenarios
- Add muscle group balance assertions for different splits
- Clean up tmp/ directory of obsolete test scripts
```

**Agent Invocations:**
```bash
# Use shredly-code-writer for test conversion
# Invoke: shredly-code-writer agent with "Convert tmp tests to integration tests from ticket #005 Phase 4"

# Use test-critic for review
# Invoke: test-critic agent with "Review integration tests from ticket #005 Phase 4"

# Use code-quality-assessor for final check
# Invoke: code-quality-assessor agent with "Review test infrastructure setup from ticket #005"
```

---

### Phase 5: Documentation and Agent Integration (2 points)

**Goal**: Update project documentation and agent definitions to integrate test infrastructure into standard workflows.

**Steps:**
1. Update CLAUDE.md to reflect new test infrastructure:
   - Add tests/ directory to Project Structure section (lines 258-295)
   - Update Testing Requirements section (lines 154-160) to reference npm test commands
   - Add test commands to Common Development Tasks section (lines 299-325)
   - Update Current Development Status to reflect test infrastructure completion
2. Update .claude/agents/shredly-code-writer.md:
   - Add test workflow to "Before Committing" section (lines 231-242)
   - Add "Run tests after implementation" to Code Writing Process
   - Reference tests/ directory in validation commands
3. Verify .claude/agents/test-writer.md:
   - Confirm Vitest references are accurate and up-to-date
   - Verify test framework examples use correct Vitest syntax
   - Ensure Technology Stack section (lines 29-36) accurately reflects Vitest usage
   - No changes needed unless inaccuracies found
4. Update .claude/agents/ticket-writer.md:
   - Add test infrastructure requirements to phase templates
   - Ensure "Testing Strategy" sections reference npm test commands
   - Add guidance to include test creation in all implementation phases

**Files:**
- Modify: CLAUDE.md (Project Structure, Testing Requirements, Common Development Tasks)
- Modify: .claude/agents/shredly-code-writer.md (test workflow integration)
- Verify: .claude/agents/test-writer.md (already references Vitest - confirm accuracy)
- Modify: .claude/agents/ticket-writer.md (test requirements)

**Testing:**
- [ ] CLAUDE.md accurately documents test infrastructure
- [ ] Agent definitions reference correct test commands
- [ ] New tickets generated include test infrastructure requirements
- [ ] shredly-code-writer workflow includes test execution

**Commit Message:**
```
docs(tests): integrate Vitest infrastructure into project documentation and agent workflows

- Update CLAUDE.md with tests/ directory structure and Vitest commands
- Add test workflow to shredly-code-writer agent (run tests before commit)
- Verify test-writer agent accurately references Vitest (already does)
- Update ticket-writer agent to include test requirements in all phases
- Ensure consistent Vitest test infrastructure across all documentation
```

**Agent Invocations:**
```bash
# Manual documentation updates for this phase
# No agent invocation needed - straightforward doc edits
```

---

## Testing Strategy

### Unit Tests

- [ ] Test workout-generator core functions independently
- [ ] Test exercise-selector filtering logic in isolation
- [ ] Test phase2-parameters calculations without full generation
- [ ] Test edge cases: empty pools, invalid inputs, boundary conditions
- [ ] Test error handling: descriptive errors for debugging

### Integration Tests

- [ ] Test full generation pipeline: questionnaire → workout JSON
- [ ] Test muscle group coverage for different splits
- [ ] Test duration constraints stay within bounds
- [ ] Test equipment filtering across configurations
- [ ] Test progressive overload week-to-week

### Manual Testing

**CLI (Phase 1)**:
```bash
# Run all tests (single run)
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Watch mode for development
npm run test:watch

# UI mode (browser-based test viewer)
npm run test:ui

# Coverage report
npm run test:coverage

# Run diagnostic tools
tsx tests/diagnostics/exercise-filtering-diagnostics.ts
```

**Validation**:
1. All tests pass
2. Test output is clear and descriptive
3. Failures indicate exactly what went wrong
4. Tests run fast (<5 seconds total)

### Test Acceptance Criteria

- [ ] All unit tests pass (npm run test:unit)
- [ ] All integration tests pass (npm run test:integration)
- [ ] TypeScript compilation succeeds for test files (npm run typecheck)
- [ ] Test coverage includes critical paths (not comprehensive, just critical)
- [ ] Tests use fixtures and helpers (DRY principle)
- [ ] Test failures provide actionable debugging information
- [ ] Documentation (tests/README.md) enables future agents to add tests

---

## Success Criteria

- [ ] tests/ directory structure established with unit, integration, diagnostics, fixtures, helpers
- [ ] Vitest installed and configured with vitest.config.ts
- [ ] 6 questionnaire answer fixtures covering critical scenarios + edge cases
- [ ] Validation helpers for workout structure, exercise references, duration, muscle coverage
- [ ] Unit tests for workout-generator, exercise-selector, phase2-parameters
- [ ] Integration tests for end-to-end generation and muscle group coverage
- [ ] Technical debt cleaned up: tmp/ artifacts removed, .gitignore updated, root files deleted
- [ ] tests/README.md documents conventions and patterns
- [ ] All tests pass (npm test exits 0)
- [ ] Fast feedback loop (<5 seconds total test runtime)
- [ ] Agents can add new tests using established patterns
- [ ] Critical path coverage enables confident refactoring
- [ ] CLAUDE.md updated with test infrastructure documentation
- [ ] Agent definitions (.claude/agents/) updated with test workflow integration
- [ ] ticket-writer agent includes test requirements in generated tickets
- [ ] shredly-code-writer agent runs tests before committing

---

## Dependencies

### Blocked By
- None (can start immediately)

### Blocks
- Future UI development (Phase 2) - needs validated generation logic
- Future refactoring tickets - needs test safety net
- Future agent work - needs test infrastructure for autonomous changes

### External Dependencies
- Node.js 20.x+ (already required)
- tsx (already installed for running TypeScript tests)
- vitest (SvelteKit's official test framework - to be installed in Phase 2)
- happy-dom (DOM implementation for testing - to be installed in Phase 2)
- @vitest/ui (optional test UI - to be installed in Phase 2)

---

## Risks & Mitigations

### Risk 1: Test Framework Complexity
- **Impact**: Low
- **Probability**: Low
- **Mitigation**: Use Vitest - SvelteKit's official test framework, Jest-compatible API, excellent DX with watch and UI modes. Simple configuration, widely adopted in the ecosystem.

### Risk 2: Over-Testing Too Early
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**: Focus ONLY on critical path tests, not comprehensive coverage. Project is still evolving, so establish patterns without over-investing. Use test-critic agent to ensure tests are valuable.

### Risk 3: Test Fixtures Become Stale
- **Impact**: Low
- **Probability**: Medium
- **Mitigation**: Fixtures reference existing data structures (WORKOUT_SPEC.md, exercise_database.json). When specs change, tests will fail loudly, forcing fixture updates. Document fixture maintenance in tests/README.md.

### Risk 4: Slow Test Execution
- **Impact**: High
- **Probability**: Low
- **Mitigation**: Target <5 seconds total runtime. Use fast validation logic, avoid file I/O in unit tests, keep integration tests minimal. Monitor test performance and refactor if needed.

---

## Notes

**Testing Philosophy for Shredly 2.0:**
- Critical path only (not comprehensive) - project is still solidifying
- Fast feedback (<5 seconds) - enable rapid iteration
- Fail loudly with descriptive errors - speed up debugging
- Establish patterns for future agent work - enable autonomous development
- Use Vitest (SvelteKit's official framework) - excellent DX, Jest-compatible, supports component testing in Phase 2+

**Why Vitest?**
- **Official SvelteKit recommendation** - Standard for SvelteKit projects
- **Single framework for all testing** - Works for engine tests (Phase 1) AND component tests (Phase 2+)
- **No migration needed** - Write tests once, use throughout project lifecycle
- **Excellent DX** - Watch mode, UI mode, coverage reports, fast execution
- **Jest-compatible API** - Familiar to most developers (describe, it, expect)
- **Minimal overhead** - ~10MB node_modules, simple config, zero-config TypeScript support

**Future Enhancements (Post-Ticket):**
- Snapshot testing for generated workout JSON (Vitest has built-in snapshot support)
- Performance benchmarks (ensure <2 second generation time)
- Regression tests as bugs are discovered and fixed
- UI component tests (Phase 2 - Vitest + @testing-library/svelte integration)
- E2E tests for mobile app (Phase 4 - Playwright or Capacitor testing)

**Integration with Agent Workflow:**
Before implementing features, agents should:
1. Run npm test to ensure baseline passes
2. Add tests for new functionality (using established patterns)
3. Implement feature
4. Run npm test to validate changes
5. Use test-critic to review test quality
6. Commit with passing tests

**Agent Documentation Updates (Phase 5):**
This ticket updates agent definitions to enforce test-driven workflows:
- shredly-code-writer: Includes "npm test" in pre-commit validation
- test-writer: Already references Vitest correctly - verify accuracy
- ticket-writer: Ensures all generated tickets include test requirements
- CLAUDE.md: Documents Vitest test infrastructure as standard practice

**Diagnostic Tools:**
The tests/diagnostics/ directory contains standalone analysis scripts (not run in CI):
- exercise-filtering-diagnostics.ts - analyzes why exercise pools are empty for certain configurations
- Future: duration-analysis.ts - analyzes workout duration distributions
- Future: muscle-balance-heatmap.ts - visualizes muscle group coverage across splits

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: feat, fix, docs, style, refactor, test, chore
- Scopes: cli, engine, questionnaire, profile, schedule, live, workout-gen, exercise-selector, progression, ui, mobile, history, prs, tests
- **NEVER include "Generated with Claude Code" or "Co-Authored-By: Claude"**

---

## Definition of Done

- [ ] All phases (1-5) implemented and tested
- [ ] npm test passes (all unit + integration tests)
- [ ] TypeScript compilation succeeds (npm run typecheck)
- [ ] Technical debt cleaned up (tmp/ artifacts, root files, .gitignore)
- [ ] tests/README.md documents patterns and conventions
- [ ] Test fixtures cover 6 critical scenarios + edge cases
- [ ] Validation helpers enable reusable assertions
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met
- [ ] Documentation updated (tests/README.md, CLAUDE.md, agent definitions)
- [ ] Agent workflows integrate test infrastructure (Phase 5 complete)
- [ ] Committed with proper commit messages (one per phase)
- [ ] CLAUDE.md "Current Development Status" updated
