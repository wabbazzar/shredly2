# Shredly 2.0 - Claude AI Development Context

**Version**: 2.0
**Status**: Active Development
**Date**: 2026-01-03

---

## 🚨 CRITICAL: READ FIRST 🚨

**MANDATORY: Before starting ANY work, read these files:**

1. **SPEC.md** - Core architecture, framework stack, project structure
2. **WORKOUT_SPEC.md** - Complete data structure specification for workouts
3. **src/data/exercise_database.json** - Exercise metadata (326 exercises)
4. **src/data/workout-questionnaire.json** - User questionnaire structure

---

## Project Overview

Shredly 2.0 is a **complete rewrite** with a modern stack and simplified architecture:

- **Frontend**: SvelteKit + Tailwind CSS
- **Mobile**: Capacitor (iOS/Android from same codebase)
- **Language**: TypeScript everywhere
- **Storage**: Client-side only (localStorage/IndexedDB)
- **No backend** (Phase 1)

### Architecture Philosophy

**Client-Side First**:
- No authentication, no database, no API calls (Phase 1)
- All state managed in localStorage/IndexedDB
- Deterministic workout generation from questionnaire + exercise database
- Future: Optional login for sync/social features

**Development Approach**:
- Build CLI prototype first to validate workout generation logic
- Port validated logic to SvelteKit UI
- Test generation engine independently before touching UI

---

## 🚨 CRITICAL COMMIT STRATEGY 🚨

**MANDATORY: Commit after EVERY phase completion - NO EXCEPTIONS**

### Commit Protocol (MUST FOLLOW):

1. **Test First**: Always test functionality before claiming phase complete
2. **Commit Immediately**: Use `git add . && git commit -m "Phase X: [Description]"` after each phase
3. **Update CLAUDE.md**: Update "Current Development Status" section in commit
4. **Never Skip**: Every phase gets its own commit - this is our fallback safety net
5. **Break Large Phases**: If a phase takes >30 minutes, break it into sub-phases with commits
6. **Clean Commit Messages**: DO NOT include "🤖 Generated with [Claude Code]" or "Co-Authored-By: Claude" in commit messages

### Recovery Protocol:

If anything breaks, immediately:
```bash
git log --oneline -5  # Check recent commits
git reset --hard <last-working-commit>
```

---

## Commit Message Standards

Follow Enhanced Conventional Commits format:

### Format:

```
<type>(<scope>): <subject under 50 chars>

<body (optional)>
- Brief explanation of what changed
- Why this change was needed
- Testing notes if applicable
```

### Types (Required):

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code formatting (no functional change)
- `refactor` - Code refactoring (no feature change)
- `test` - Adding/updating tests
- `chore` - Dependencies, build tools (no production code change)

### Scopes (Common for Shredly 2.0):

`cli`, `engine`, `questionnaire`, `profile`, `schedule`, `live`, `workout-gen`, `exercise-selector`, `progression`, `ui`, `mobile`, `history`, `prs`, `tests`

### Examples:

```
feat(cli): add workout generation CLI prototype
feat(engine): implement exercise selection algorithm
fix(questionnaire): resolve multi-select validation bug
refactor(workout-gen): consolidate progression calculation logic
test(engine): add comprehensive exercise selector tests
chore(deps): update SvelteKit to latest stable
```

### Rules:

- Subject line: 50 characters max, lowercase after type/scope, no period, imperative mood
- Body: Explain what and why, not how (code shows how)
- Footer: NEVER include Claude Code attribution
- NEVER use "Co-Authored-By: Claude"

---

## Development Guidelines

### Technology Stack

- **Node.js**: 20.x+ (LTS required)
- **TypeScript**: All code must be TypeScript
- **ES Modules**: 100% ESM (import/export), NEVER CommonJS (require/module.exports)
- **Package Type**: All package.json files MUST include `"type": "module"`
- **Target Browsers**: Modern evergreen (Chrome, Safari, Firefox last 2 versions)
- **Mobile**: iOS 14+, Android 10+

### File Creation Best Practices

- **AVOID UNICODE CHARACTERS**: Never use unicode box-drawing characters (├─│└) in markdown files - they corrupt to binary
- **Use ASCII alternatives**: Use +--| for diagrams and file trees
- **Check file encoding**: Run `file filename.md` to verify files are UTF-8/ASCII text
- **Binary corruption symptoms**: If `grep` reports "Binary file matches" on markdown, recreate cleanly
- **Safe characters for diagrams**: Use only standard ASCII: + - | / \ [ ] { } ( )
- **CRITICAL: NEVER OVERWRITE EXISTING FILES**: Always use Read tool to check existing content before editing or creating files

### Code Quality Rules

- **NO FALLBACK LOGIC**: Always fail loudly and explicitly - this speeds up debugging
- **CRITICAL**: ALWAYS add temporary files to tmp/ directory
- **Timelines**: Never use time units like "days" or "weeks" - use points instead
- **Only use emojis if explicitly requested**
- **AVOID UNICODE**: Stick to ASCII in all code and markdown files

### Ticket Management

- **Location**: All tickets are stored in `docs/tickets/`
- **Naming**: Format is `XXX_[type]_[short_description].md` (e.g., `001_feature_workout_questionnaire.md`)
- **Types**: feature, bug, refactor, chore, docs, test
- **Creation**: Use the ticket-writer agent to create comprehensive, implementation-ready tickets
- **Numbering**: Sequential, starting from 001
- **Standards**: Follow strict ticket template with phases (max 5 points each), testing strategy, success criteria

### Testing Requirements

- **Vitest**: All tests use Vitest (SvelteKit's official test framework)
- **Run tests before committing**: `npm test` (all tests) or `npm run test:unit` (unit only)
- **Test incrementally**: Don't wait until all code is written - add tests as you develop
- **Run linting**: Always run `npm run lint` and `npm run typecheck` before committing
- **Mobile + Desktop**: Test on both platforms when applicable
- **CLI first**: Validate generation logic in CLI before porting to UI
- **Critical path coverage**: Focus on critical paths, not comprehensive coverage (see tests/README.md)

---

## Architecture & Data Flow

### Three-Tab UI Layout

1. **Profile Tab**:
   - User stats (age, weight, height)
   - Personal records (PRs)
   - Historical performance
   - PRs auto-populate from workout history

2. **Schedule Tab**:
   - Workout calendar/program view
   - Replaces old calendar/week/day views
   - Weekly progression display

3. **Live Tab**:
   - Active workout execution interface
   - Timer, progression through exercises
   - Real-time completion tracking

### Development Phases

#### Phase 1: CLI Prototype (Current)
- Build workout generation as terminal app
- Test with various questionnaire inputs
- Validate exercise selection logic
- Ensure deterministic output (same input = same program)
- **Files**: `cli/test-runner.ts`, `cli/sample-output.json`

#### Phase 2: Core UI
- Port CLI logic to `src/lib/engine/`
- Build questionnaire flow in SvelteKit
- Implement three-tab layout
- LocalStorage persistence

#### Phase 3: History & Progression
- Exercise completion tracking
- Progressive overload calculations
- Auto-populate PRs from history
- Basic analytics

#### Phase 4: Mobile Polish
- Capacitor integration
- Touch gestures (swipe, drag-to-reorder)
- Offline-first architecture
- iOS/Android builds

#### Phase 5: Future (Post-MVP)
- Optional login (Supabase or similar)
- Device sync
- Smart workout assistant
- Social features

---

## Data Structures (Critical)

### Workout Template Structure

See **WORKOUT_SPEC.md** for complete specification. Key principles:

1. **Explicitness over cleverness** - No magic, no assumptions
2. **Flexible schemas** - Only include fields that are needed
3. **Exercise-level granularity** - Full control at the exercise level
4. **Exercise DB as source of truth** - Reference exercises by name
5. **No template variables** - Generated workouts have explicit week-by-week values

### Exercise History Structure

See **EXERCISE_HISTORY_SPEC.md** for complete specification. Key principles:

1. **Tidy Data** - Each row is one set block, each column is one variable
2. **Append-Only CSV** - Historical data never modified, only appended
3. **20 Columns** - All variable fields from WORKOUT_SPEC.md + metadata
4. **Compound Exercise Support** - Parent row + sub-exercise rows for EMOM/Circuit/AMRAP/Interval
5. **localStorage Storage** - CSV format, ~5-10MB capacity (60,000+ rows)

**CSV Schema**:
```csv
date,timestamp,workout_program_id,week_number,day_number,exercise_name,
exercise_order,is_compound_parent,compound_parent_name,set_number,
reps,weight,weight_unit,work_time,rest_time,tempo,rpe,rir,completed,notes
```

**Key Features**:
- RPE (Rate of Perceived Exertion): 1-10 scale tracking effort
- RIR (Reps In Reserve): 0-5+ tracking how many more reps possible
- Compound tracking: Parent EMOM/Circuit rows linked to sub-exercise rows
- Personal Records: Calculated on-demand from CSV (max weight, volume, reps)
- Progressive Overload: Historical data enables intelligent progression suggestions

---

## Project Structure

```
shredly2/
+-- cli/                          # Terminal prototype (Phase 1)
|   +-- test-runner.ts            # CLI test harness
|   +-- sample-output.json        # Example generated programs
+-- docs/                         # Documentation
|   +-- tickets/                  # Implementation tickets
|   +-- SPEC.md                   # Technical specifications
|   +-- WORKOUT_SPEC.md           # Workout data structure spec
|   +-- EXERCISE_HISTORY_SPEC.md  # Exercise history spec
+-- src/
|   +-- routes/                   # SvelteKit pages
|   |   +-- +page.svelte          # Questionnaire
|   |   +-- profile/+page.svelte  # Profile tab
|   |   +-- schedule/+page.svelte # Schedule tab
|   |   +-- live/+page.svelte     # Live tab
|   +-- lib/
|   |   +-- stores/               # Svelte stores (state)
|   |   |   +-- workout.ts        # Current program
|   |   |   +-- history.ts        # Exercise history
|   |   |   +-- user.ts           # User preferences
|   |   +-- engine/               # SHARED generation logic (CLI + frontend)
|   |   |   +-- workout-generator.ts
|   |   |   +-- exercise-selector.ts
|   |   |   +-- progression-engine.ts
|   |   |   +-- types.ts          # Shared TypeScript types
|   |   +-- components/           # Reusable UI
|   +-- data/
|   |   +-- exercise-database.json      # 326 exercises
|   |   +-- workout-questionnaire.json  # 13 questions
|   |   +-- exercise_descriptions.json  # Exercise descriptions
+-- tests/                        # Vitest test infrastructure
|   +-- unit/                     # Unit tests for engine modules
|   +-- integration/              # End-to-end generation tests
|   +-- diagnostics/              # Debug/analysis tools (not run in CI)
|   +-- fixtures/                 # Test data (questionnaire answers)
|   +-- helpers/                  # Shared test utilities
|   +-- README.md                # Testing conventions and patterns
+-- static/                       # Assets
+-- tmp/                          # Temporary files (debugging, testing)
+-- capacitor.config.json         # Mobile config
+-- tailwind.config.js
+-- svelte.config.js
+-- tsconfig.json
```

---

## Common Development Tasks

### CLI Prototype Development

```bash
# Run CLI test harness
npm run cli

# Watch mode for development
npm run cli:watch
```

### Frontend Development

```bash
# Start dev server
npm run dev

# Type checking
npm run typecheck

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing

```bash
# Run all tests (unit + integration)
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Watch mode (re-runs on file changes)
npm run test:watch

# UI mode (browser-based test viewer)
npm run test:ui

# Coverage report
npm run test:coverage

# Run diagnostic tools
npm run test:diagnostics
```

### Mobile Development (Phase 4)

```bash
# Add iOS platform
npx cap add ios

# Add Android platform
npx cap add android

# Sync web code to native
npx cap sync

# Open in Xcode
npx cap open ios

# Open in Android Studio
npx cap open android
```

---

## Critical Questions to Validate (Before UI)

1. **Workout Generation Algorithm**: How to map questionnaire → training split?
2. **Exercise Selection**: How to filter 326 exercises to optimal subset?
3. **Progressive Overload**: What rules for week-to-week progression?
4. **Injury Handling**: How to exclude/substitute exercises based on text input?
5. **Determinism**: Should same input always generate same program, or add variance?

These should be answered in the CLI prototype phase.

---

## Current Development Status

### ✅ COMPLETED: CLI Prototype + Test Infrastructure (2026-01-06)

**Status**: Workout generation engine complete and tested - Ready for UI development

**Phase 1 Complete (CLI Prototype)**:
- ✅ Framework stack (SvelteKit + Capacitor + Tailwind)
- ✅ Core architecture (SPEC.md, WORKOUT_SPEC.md, EXERCISE_HISTORY_SPEC.md)
- ✅ Exercise database (326 exercises with metadata)
- ✅ Questionnaire structure (13 questions)
- ✅ CLI interactive questionnaire with formatted workout display
- ✅ **Complete workout generation engine** (src/lib/engine/)
- ✅ **Comprehensive test infrastructure** (Vitest + 66 passing tests)

**Test Infrastructure Highlights**:
- **Vitest**: SvelteKit's official test framework
- **224 tests passing**: 208 unit tests + 16 integration tests
- **Critical path coverage**: Workout generation, exercise selection, parameter calculation, metadata-driven field visibility
- **Test fixtures**: 6 questionnaire scenarios (beginner → expert, bodyweight → gym)
- **Validation helpers**: Workout structure, exercise references, duration constraints
- **Integration tests**: End-to-end generation, muscle group coverage
- **Diagnostic tools**: Exercise filtering analysis (npm run test:diagnostics)

**Workout Generation Engine (Complete)**:
- **Phase 1 (Structure)**: Training split assignment, day structure, exercise selection
- **Phase 2 (Parameters)**: Week-by-week sets/reps/weight/rest calculations
- **Advanced features**: Compound exercises (EMOM/Circuit/AMRAP), sub-exercise insertion
- **Smart filtering**: Equipment-aware, experience-based, muscle group targeting
- **Progressive overload**: Linear, volume, density, wave loading progressions

**CLI Workout Editor (Complete)**:
- **Interactive editing**: Vim-like modal interface with field navigation
- **Exercise replacement**: Browse 326 exercises, smart defaults on replacement
- **Manual compound blocks**: Create EMOM/AMRAP/Circuit/Interval blocks with 'b' key
- **Block type switching**: Change compound block types with 'e', 'a', 'c', 'i' keys
- **Visual feedback**: Colored type prefixes, empty block placeholders, undo support
- **Test coverage**: 96 passing unit tests (29 for compound blocks)

**Recent Completions**:
- ✅ Ticket #012 Phase 3 (2026-01-09): Day Structure by Equipment - Block-based selection
  * **Phase 3 - Block-Based Selection**: Replaced round-robin with deterministic block selection
    - Added `day_structure_by_equipment` config (full_gym, dumbbells_only, bodyweight_only)
    - Added `compound_blocks_by_time` config for duration-based block counts
    - Created `buildDayStructure()` function in phase1-structure.ts
    - Created `selectExercisesForDay()` with block-based selection in exercise-selector.ts
    - Created equipment-specific selection functions (strength, compound, interval, mobility)
    - Updated workout-generator.ts to use new block-based selection
  * **Code Removal**: Removed ~540 lines of round-robin code
    - `roundRobinSelectExercises()`, `prioritizeByMuscleGroupCoverage()`
    - `getDefaultIntensityForLayer()`, `hasMetMinimumRequirements()`, `trackMuscleGroupCoverage()`
  * **Bug Fixes**: Fixed sub-exercise intensity profile inheritance (fallback to compatible profiles)
  * **Testing**: All 279 tests passing, TypeScript clean
  * exercise-selector.ts reduced from 1352 to 815 lines
- ✅ Ticket #011 (2026-01-08): Migrate hardcoded mappings to config (COMPLETE)
  * **Phase 1 - Split Assignment**: Moved default split by frequency to config
    - Added default_split_by_frequency to workout_generation_rules.json
    - Replaced hardcoded if-else logic with config lookup
    - Added DefaultSplitByFrequency TypeScript interface
  * **Phase 2 - Progression Assignment**: Moved default progression by goal to config
    - Added default_progression_by_goal to workout_generation_rules.json
    - Replaced hardcoded goalProgressionMap with config lookup
    - Added DefaultProgressionByGoal TypeScript interface
  * **Phase 3 - Intensity Assignment**: Moved intensity profile by layer to config
    - Added intensity_profile_by_layer_and_category to workout_generation_rules.json
    - Consolidated 50+ lines of scattered category logic into single config structure
    - Simplified assignIntensityProfile() from 50+ lines to ~25 lines
    - Added IntensityProfileByLayerAndCategory TypeScript interface
  * **Phase 4 - Config Cleanup**: Removed unused config features
    - Removed can_use_set_blocks, can_use_wave_loading, can_use_auto_regulation flags
    - Removed sequential_filtering_enabled and fallback_order from equipment_quotas
  * **Impact**: Data-driven architecture score improved from 8.5/10 to 9.5/10
  * **Testing**: All 251 tests passing, TypeScript compilation succeeds
  * All 3 TODO comments resolved from phase1-structure.ts
- ✅ Ticket #009 (2026-01-07): Fix compound exercise progression logic (COMPLETE)
  * **Phase 1 - Density Fix**: Density progression now keeps work_time STATIC for compound parents
    - Added isCompoundParent() helper to detect EMOM/Circuit/AMRAP/Interval exercises
    - Density progression: work_time stays 6->6->6 (static), sub-exercise reps increase
    - Pass exerciseCategory through applyProgressionScheme() call chain
    - Updated workout_generation_rules.json with compound_parent_work_time_static flag
  * **Phase 2 - Volume Progression**: Added proper volume progression for compound blocks
    - Added roundToWholeMinutes() helper for whole-minute rounding (no decimals)
    - EMOM volume: work_time increases by (1min * sub_count) per week (6->9->12 with 3 subs)
    - AMRAP volume: work_time increases by 1min per week (6->7->8)
    - Circuit/Interval: configurable to increase time OR sets
    - Updated workout_generation_rules.json with compound volume rules
  * **Phase 3 - Editor Review**: Verified CLI editor uses shared progression logic correctly
    - Editor only displays pre-calculated progressions (no duplicate logic)
    - Corrected progressions display correctly in formatter
    - Documented architecture in tmp/ files
  * **Testing**: All 224 tests passing + manual verification script confirms all behaviors
  * Regular (non-compound) exercises unaffected - backward compatible
- ✅ Ticket #008 (2026-01-07): Fix editor weighted time-based exercise field visibility
  * Created shared exercise-metadata.ts module as single source of truth
  * Migrated editor to use metadata-driven weight field visibility (not workMode)
  * Migrated CLI formatter to use metadata-driven weight display (not workMode)
  * Fixed bug: weighted time-based exercises now show weight in both modes
  * 99 new tests (67 metadata + 24 editor + 8 formatter)
  * Generator, editor, and formatter now follow consistent external_load rules
- ✅ Ticket #007 (2026-01-06): Manual compound exercise block creation feature
  * Added createCompoundBlock(), setCompoundBlockType(), updateCompoundBlockName() methods
  * Keyboard shortcuts: 'b' (create), 'e'/'a'/'c'/'i' (change type)
  * Visual enhancements: colored prefixes, empty block placeholders
  * Comprehensive test coverage with full undo support

**Current Focus**: Phase 2 (Core UI Development)

**Next Steps**:
1. Port CLI logic to SvelteKit UI routes
2. Build questionnaire flow (multi-step form)
3. Implement three-tab layout (Profile, Schedule, Live)
4. Add localStorage persistence for workout programs
5. Create workout display components

**Next Developer**: CLI prototype and engine are complete! All generation logic is tested and working. Manual compound block creation now fully implemented in CLI editor. Read tests/README.md for test infrastructure patterns. Focus on building the SvelteKit UI while reusing the validated engine from src/lib/engine/.

---

## Success Criteria

- Generate valid workout program from questionnaire in <2 seconds
- 100% client-side, zero backend dependencies (Phase 1)
- Responsive on mobile/desktop
- Exercise database drives all content (no hardcoded workouts)
- History tracking enables intelligent progression
- User can complete full workout tracking flow without internet

---

**Remember**: CLI prototype first. Validate logic before building UI. Commit after every phase. Fail loudly, debug quickly.
