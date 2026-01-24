# Ticket #027: Feature - Complete Data Transferability (Backup/Restore)

**Status**: Open
**Priority**: High
**Type**: feature
**Estimated Points**: 13 (fibonacci scale - requires 5 phases)
**Phase**: 3-History

---

## Summary

Implement full backup and restore functionality enabling users to export all Shredly data as a single JSON bundle and import it on a new device or after app reinstall, ensuring complete data transferability.

## Background

Currently, Shredly stores all user data client-side across multiple storage mechanisms:

1. **IndexedDB** (`shredly-history`): Exercise history rows with UUID-based storage
2. **IndexedDB** (`shredly-schedules`): Workout schedules/programs
3. **localStorage** (`shredly_user`): User profile, preferences, and manually entered 1RMs
4. **localStorage** (`exercise_1rm_cache`): Calculated 1RM/TRM cache from exercise history
5. **localStorage** (`shredly_audio_config`): Audio preferences for Live tab
6. **localStorage** (`shredly_view_state`): Schedule tab navigation state
7. **localStorage** (`shredly_edit_preferences`): Edit scope preferences
8. **localStorage** (`shredly-active-schedule-id`): Quick-access active schedule reference

**Problem**: If a user reinstalls the app, clears browser data, or switches devices, all data is lost. While exercise history can be exported as CSV, there's no import functionality, and other data types (schedules, user profile, PRs) have no export/import at all.

**Solution**: Create a comprehensive backup bundle that captures all persistent data in a single JSON file, with a matching restore flow that validates and imports the data.

---

## Investigation Findings (2026-01-22)

### Complete Data Storage Map

| Storage | Key/Database | Typical Size | Backup Priority | Notes |
|---------|--------------|--------------|-----------------|-------|
| **IndexedDB** | `shredly-history` | 1-5 MB | CRITICAL | Exercise history rows (UUID-based, tombstone deletion) |
| **IndexedDB** | `shredly-schedules` | 150-750 KB | CRITICAL | Workout programs with full CRUD |
| **localStorage** | `shredly_user` | ~2 KB | CRITICAL | Profile, preferences, manual 1RMs |
| **localStorage** | `exercise_1rm_cache` | 10-30 KB | RECALCULATE | Rebuild from history on import |
| **localStorage** | `shredly_live_session` | ~5 KB | DISCARD | Discard if >24h old |
| **localStorage** | `shredly_audio_config` | ~1 KB | Optional | Chirp/chime preferences |
| **localStorage** | `shredly_view_state` | ~1 KB | Optional | Drill-down position |
| **localStorage** | `shredly_edit_preferences` | ~1 KB | Optional | Edit scope defaults |
| **localStorage** | `shredly-active-schedule-id` | ~100 bytes | REGENERATE | Set from imported schedules |
| **localStorage** | `shredly_history_backup_v1` | ~1 KB | INTERNAL | Don't export (integrity metadata) |
| **localStorage** | `shredly_history_migration_v1` | flag | INTERNAL | Don't export (one-time migration flag) |

### Existing Code Reuse Opportunities

| Opportunity | Current Location | Action |
|-------------|------------------|--------|
| Download utility | `ExerciseHistoryModal.svelte:27-62`, `ScheduleLibrary.svelte:34-48` | Extract to `src/lib/utils/download.ts` |
| CSV parsing | `historyDb.ts` migration code (lines 563-626) | Reuse pattern for CSV import |
| Batch insert | `appendHistoryRows()` in `history.ts` | Already exists, use directly |
| Cache rebuild | `fullRecalculateCache()` in `oneRMCache.ts` | Already exists, use directly |
| Schedule duplicate | `duplicateSchedule()` in `scheduleDb.ts` | Reference for ID generation |

### Identified Blind Spots (Must Address)

1. **No schema versioning** - `StoredSchedule.scheduleMetadata` has no `version` field
2. **dayConfigs migration** - Schedules from before ticket #025 won't have `dayConfigs` array
3. **Orphaned history** - No validation that `workout_program_id` references valid schedule
4. **Compound exercise validation** - Sub-exercises could reference missing parent rows
5. **Storage quota** - No check before large imports (could exceed IndexedDB limits)
6. **Live session staleness** - Restored session from days ago would be invalid

### Critical Import Order

Dependencies require this exact order:

```
1. UserData (no dependencies)
      ↓
2. Schedules (needs user context for validation)
      ↓
3. Set Active Schedule ID (validate exists in imported schedules)
      ↓
4. History (validate workout_program_id references valid schedules)
      ↓
5. RECALCULATE 1RM Cache (from history + user.oneRepMaxes overrides)
      ↓
6. UI State (optional, can fail gracefully)
      ↓
7. DISCARD Live Session if >24h old or references invalid schedule
```

### Storage Capacity Estimates

```
Typical 2-year user backup:
├─ User data:     ~2 KB
├─ Schedules:     ~200 KB (1-2 schedules)
├─ History:       ~2.5 MB (~10,000 rows)
├─ 1RM Cache:     ~20 KB
└─ UI State:      ~3 KB
────────────────────────
Total JSON:       ~2.7 MB
Gzipped:          ~400 KB
```

---

## Technical Requirements

### Data Structures

#### Backup Bundle Format

```typescript
interface ShredlyBackupBundle {
  // Metadata
  version: '1.0.0';
  exportedAt: string;          // ISO timestamp
  appVersion: string;          // Shredly version that created the backup

  // User Data (from localStorage: shredly_user)
  userData: UserData;

  // Exercise History (from IndexedDB: shredly-history)
  exerciseHistory: HistoryRow[];

  // Schedules (from IndexedDB: shredly-schedules)
  schedules: StoredSchedule[];
  activeScheduleId: string | null;

  // Derived/Cache Data (can be rebuilt but included for convenience)
  oneRMCache?: Exercise1RMCache;

  // User Preferences (from localStorage)
  audioConfig?: AudioConfig;

  // Statistics (for validation during import)
  stats: {
    historyRowCount: number;
    scheduleCount: number;
    exerciseNames: string[];      // Unique exercise names in history
    oldestHistoryDate: string | null;
    newestHistoryDate: string | null;
  };
}
```

#### Import Validation Result

```typescript
interface ImportValidationResult {
  isValid: boolean;
  warnings: string[];           // Non-blocking issues
  errors: string[];             // Blocking issues
  stats: {
    historyRows: number;
    schedules: number;
    exercises: number;
    dateRange: { start: string; end: string } | null;
  };
  requiresUserConfirmation: boolean;
  confirmationMessage?: string; // e.g., "This will replace 500 existing rows"
}
```

#### Import Strategy

```typescript
type ImportStrategy =
  | 'replace'     // Clear all existing data and import
  | 'merge'       // Merge with existing (deduplicate by date+exercise+set)
  | 'append';     // Append all, allowing duplicates
```

### UI Placement

**Location**: Profile tab → "App" section (lines 597-654 in `profile/+page.svelte`)

**Exact placement** within the App section:
1. Version number (`Shredly` / `Version X.X.X`)
2. Check for Updates / Update Now button
3. **→ Export Backup button** (NEW)
4. **→ Import Backup button** (NEW)
5. Force refresh link (existing)

**Visual layout**:
```
┌─────────────────────────────────────────────┐
│ App                                         │
├─────────────────────────────────────────────┤
│ Shredly                    [Check Updates]  │
│ Version 1.2.3                               │
├─────────────────────────────────────────────┤
│ [📤 Export Backup]     [📥 Import Backup]  │  ← NEW
├─────────────────────────────────────────────┤
│ Force refresh (clear cache)                 │
└─────────────────────────────────────────────┘
```

The backup buttons belong in "App" because:
- This is app-level data management, not user profile editing
- Groups with other app management (updates, cache clear)
- Clear separation from personal stats (weight, height, PRs)

### Code Locations

**Files to create**:
- `src/lib/utils/download.ts` - **Shared download utility** (extract from existing code)
- `src/lib/utils/validation.ts` - **Shared validation utilities** (history rows, schedules, etc.)
- `src/lib/backup/backup-types.ts` - Type definitions
- `src/lib/backup/export.ts` - Export functionality
- `src/lib/backup/import.ts` - Import and validation logic
- `src/lib/backup/merge.ts` - Merge/deduplication logic
- `src/lib/components/backup/BackupExportButton.svelte` - Export UI
- `src/lib/components/backup/BackupImportModal.svelte` - Import UI with preview
- `tests/unit/backup.test.ts` - Unit tests
- `tests/fixtures/backup/*.json` - Test fixtures (see Testing Strategy)

**Files to modify**:
- `src/lib/types/schedule.ts` - Add `version` field to ScheduleMetadata
- `src/routes/profile/+page.svelte` - Add backup/restore to "App" section
- `src/lib/stores/history.ts` - Add batch import function
- `src/lib/stores/historyDb.ts` - Add batch import to IndexedDB
- `src/lib/stores/scheduleDb.ts` - Add batch import/clear functions, add version migration
- `src/lib/stores/user.ts` - Add import function
- `src/lib/stores/oneRMCache.ts` - Add import function
- `src/lib/components/profile/ExerciseHistoryModal.svelte` - Refactor to use shared download utility
- `src/lib/components/schedule/ScheduleLibrary.svelte` - Refactor to use shared download utility

### Reusing Existing Download Code

Two components already implement file downloads with identical patterns:

1. **ExerciseHistoryModal.svelte** (lines 27-62): CSV history export
2. **ScheduleLibrary.svelte** (lines 34-48): JSON schedule export

Both use: `Blob → URL.createObjectURL → anchor.click → revokeObjectURL`

**Action**: Extract shared utility:

```typescript
// src/lib/utils/download.ts
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  triggerDownload(blob, filename);
}

export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv' });
  triggerDownload(blob, filename);
}
```

Then refactor existing code to use these utilities.

### TypeScript Types

```typescript
// src/lib/backup/backup-types.ts

import type { UserData } from '$lib/types/user';
import type { HistoryRow } from '$lib/stores/history';
import type { StoredSchedule } from '$lib/types/schedule';
import type { Exercise1RMCache } from '$lib/stores/oneRMCache';
import type { AudioConfig } from '$lib/engine/types';

export const BACKUP_VERSION = '1.0.0' as const;

export interface BackupStats {
  historyRowCount: number;
  scheduleCount: number;
  exerciseNames: string[];
  oldestHistoryDate: string | null;
  newestHistoryDate: string | null;
}

export interface ShredlyBackupBundle {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  appVersion: string;
  userData: UserData;
  exerciseHistory: HistoryRow[];
  schedules: StoredSchedule[];
  activeScheduleId: string | null;
  oneRMCache?: Exercise1RMCache;
  audioConfig?: AudioConfig;
  stats: BackupStats;
}

export interface ImportValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  stats: {
    historyRows: number;
    schedules: number;
    exercises: number;
    dateRange: { start: string; end: string } | null;
  };
  requiresUserConfirmation: boolean;
  confirmationMessage?: string;
}

export type ImportStrategy = 'replace' | 'merge' | 'append';

export interface ImportOptions {
  strategy: ImportStrategy;
  includeHistory: boolean;
  includeSchedules: boolean;
  includeUserData: boolean;
  includePreferences: boolean;
}

export interface ImportResult {
  success: boolean;
  imported: {
    historyRows: number;
    schedules: number;
    userDataRestored: boolean;
    preferencesRestored: boolean;
  };
  errors: string[];
  warnings: string[];
}
```

---

## Implementation Plan

### Pre-requisite: Add Schema Versioning (included in Phase 1)

**Issue Identified**: `StoredSchedule.scheduleMetadata` has no `version` field, making future migrations difficult.

**Action**: Add version field to schedule metadata:

```typescript
// src/lib/types/schedule.ts
interface ScheduleMetadata {
  version: 1;  // ADD THIS - increment on schema changes
  isActive: boolean;
  startDate: string;
  createdAt: string;
  updatedAt: string;
  currentWeek: number;
  currentDay: number;
  dayMapping?: DayMapping;
}
```

**Migration on load**: If `version` is missing, assume version 1 and add it.

---

### Phase 1: Export Functionality (3 points)

**Goal**: Create a complete backup export that generates a downloadable JSON file

**Steps**:
1. **Extract shared download utility** (reuse existing code):
   - Create `src/lib/utils/download.ts` with `triggerDownload()`, `downloadJson()`, `downloadCsv()`
   - Refactor `ExerciseHistoryModal.svelte` to use `downloadCsv()`
   - Refactor `ScheduleLibrary.svelte` to use `downloadJson()`
2. Create `src/lib/backup/backup-types.ts` with all type definitions
3. Create `src/lib/backup/export.ts` with export logic:
   - `createBackupBundle()` - Collects all data from stores
   - `downloadBackupBundle()` - Uses shared `downloadJson()` utility
   - `calculateBackupStats()` - Computes validation statistics
4. Create `BackupExportButton.svelte` component with:
   - Loading state during data collection
   - File naming with timestamp (e.g., `shredly-backup-2026-01-21.json`)
   - Success feedback
5. Add export button to Profile tab → "App" section

**Files**:
- Create: `src/lib/utils/download.ts` (shared utility)
- Create: `src/lib/backup/backup-types.ts`
- Create: `src/lib/backup/export.ts`
- Create: `src/lib/components/backup/BackupExportButton.svelte`
- Modify: `src/routes/profile/+page.svelte` (add to "App" section)
- Refactor: `src/lib/components/profile/ExerciseHistoryModal.svelte`
- Refactor: `src/lib/components/schedule/ScheduleLibrary.svelte`

**Testing**:
- [ ] Unit tests for `createBackupBundle()`
- [ ] Unit tests for `calculateBackupStats()`
- [ ] Manual test: export generates valid JSON
- [ ] Manual test: downloaded file contains all data types

**Commit Message**:
```
feat(backup): add complete data export functionality

- Create backup bundle type definitions
- Implement createBackupBundle() to collect all data
- Add BackupExportButton component to Profile tab
- Export includes history, schedules, user data, preferences
```

**Agent Invocations**:
```bash
# Implement Phase 1
# Invoke: shredly-code-writer agent with "Implement Phase 1 for ticket #027 - Export Functionality"

# Write tests
# Invoke: test-writer agent with "Write unit tests for backup export from ticket #027 Phase 1"

# Review
# Invoke: code-quality-assessor agent with "Review backup export implementation from ticket #027 Phase 1"
```

---

### Phase 2: Import Validation (3 points)

**Goal**: Create robust validation for imported backup files before any data modification

**Steps**:
1. Create `src/lib/backup/import.ts` with validation logic:
   - `validateBackupBundle()` - Type checking and schema validation
   - `checkVersionCompatibility()` - Version migration handling
   - `analyzeImportImpact()` - Compare with existing data
   - `generateImportPreview()` - Human-readable summary
   - `checkStorageQuota()` - Verify space available before import
2. Create `src/lib/utils/validation.ts` for reusable validators:
   - `validateHistoryRow()` - Single row validation
   - `validateSchedule()` - Schedule structure validation
   - `validateUserData()` - User profile validation
3. Validation checks (from investigation):
   - Required fields present
   - Data types match TypeScript interfaces
   - **Orphan detection**: All `history.workout_program_id` exist in imported schedules
   - **Compound integrity**: Sub-exercises have matching parent rows
   - **Equipment types**: All values in `ALL_EQUIPMENT_TYPES` constant
   - Date formats are valid ISO strings (YYYY-MM-DD)
   - History row schema matches EXERCISE_HISTORY_SPEC.md (20 columns)
   - Schedule has valid day structure
   - **dayConfigs migration**: Auto-generate if missing (ticket #025 compatibility)
4. Generate warnings for:
   - Unknown exercise names (not in exercise-database.json)
   - Future-dated history entries
   - Very old data (> 1 year)
   - Large dataset (> 10,000 history rows)
   - Orphaned history rows (workout_program_id not in schedules)
   - **Storage quota** > 50% of available space
5. Generate errors for:
   - Invalid JSON
   - Missing required fields
   - Type mismatches
   - Unsupported backup version
   - **Storage quota exceeded** (would fail import)

**Files**:
- Create: `src/lib/backup/import.ts`
- Create: `src/lib/utils/validation.ts` (shared validators)
- Modify: `src/lib/backup/backup-types.ts` (add validation types)

**Testing**:
- [ ] Unit tests for `validateBackupBundle()` with valid data
- [ ] Unit tests for `validateBackupBundle()` with invalid data
- [ ] Unit tests for version compatibility
- [ ] Unit tests for orphan detection (history → schedule refs)
- [ ] Unit tests for compound parent/sub-exercise integrity
- [ ] Unit tests for storage quota check
- [ ] Test edge cases: empty arrays, null values, missing fields
- [ ] Test dayConfigs migration for old schedules

**Commit Message**:
```
feat(backup): add import validation and preview

- Implement backup bundle schema validation
- Add version compatibility checking
- Generate warnings for data quality issues
- Create import impact analysis
```

**Agent Invocations**:
```bash
# Implement Phase 2
# Invoke: shredly-code-writer agent with "Implement Phase 2 for ticket #027 - Import Validation"

# Write tests
# Invoke: test-writer agent with "Write unit tests for backup import validation from ticket #027 Phase 2"

# Review tests
# Invoke: test-critic agent with "Review test coverage for backup validation from ticket #027 Phase 2"
```

---

### Phase 3: Data Import and Merge Logic (5 points)

**Goal**: Implement the actual data import with support for replace, merge, and append strategies

**Steps**:
1. Create `src/lib/backup/merge.ts` with merge logic:
   - `deduplicateHistoryRows()` - Match by date + exercise_name + set_number
   - `mergeSchedules()` - Match by ID, handle conflicts
   - `resolveConflicts()` - Strategy for duplicate data
2. Add batch import functions to stores:
   - `historyDb.ts`: `importRows()` - Batch insert with transaction
   - `scheduleDb.ts`: `importSchedules()` - Batch insert, `clearAllSchedules()`
   - `user.ts`: `importUserData()` - Replace user data
   - `oneRMCache.ts`: Already has `fullRecalculateCache()`
3. Create main import orchestrator in `import.ts`:
   - `importBackupBundle()` - Coordinates all store imports
   - Transaction-like behavior: rollback on failure
   - Progress callbacks for UI feedback
4. Import order (to handle dependencies):
   1. User data (needed for equipment profiles)
   2. Schedules (workout templates)
   3. Exercise history (references schedule IDs)
   4. Recalculate 1RM cache from imported history
   5. Restore preferences

**Files**:
- Create: `src/lib/backup/merge.ts`
- Modify: `src/lib/backup/import.ts` (add import orchestration)
- Modify: `src/lib/stores/historyDb.ts` (add `importRows()`, `clearAllRows()` if not exists)
- Modify: `src/lib/stores/scheduleDb.ts` (add `importSchedules()`, `clearAllSchedules()`)
- Modify: `src/lib/stores/user.ts` (add `importUserData()`)

**Testing**:
- [ ] Unit tests for `deduplicateHistoryRows()`
- [ ] Unit tests for `importBackupBundle()` with replace strategy
- [ ] Unit tests for `importBackupBundle()` with merge strategy
- [ ] Integration test: full import cycle
- [ ] Test rollback on partial failure

**Commit Message**:
```
feat(backup): implement data import with merge strategies

- Add batch import functions to history, schedule, user stores
- Implement deduplication for merge strategy
- Create import orchestrator with proper dependency order
- Recalculate 1RM cache after history import
```

**Agent Invocations**:
```bash
# Implement Phase 3
# Invoke: shredly-code-writer agent with "Implement Phase 3 for ticket #027 - Data Import Logic"

# Write tests
# Invoke: test-writer agent with "Write unit and integration tests for data import from ticket #027 Phase 3"

# Review
# Invoke: code-quality-assessor agent with "Review import implementation from ticket #027 Phase 3"
```

---

### Phase 4: Import UI Modal (3 points)

**Goal**: Create a user-friendly import modal with file selection, preview, and confirmation

**Steps**:
1. Create `BackupImportModal.svelte` with:
   - File input (accept `.json`)
   - Drag-and-drop zone
   - Validation feedback (errors/warnings display)
   - Import preview (what will be imported)
   - Strategy selector (Replace/Merge/Append)
   - Selective import checkboxes:
     - [ ] Exercise History (X rows)
     - [ ] Workout Schedules (X schedules)
     - [ ] User Profile & 1RMs
     - [ ] Preferences (audio, edit scope)
   - Confirmation step with impact warning
   - Progress indicator during import
   - Success/error result display
2. Follow modal header action button pattern (per CLAUDE.md):
   - X button (cancel) on left
   - Import button on right
   - Title centered
3. Mobile-responsive design:
   - Touch-friendly file input
   - Scrollable preview section
   - Avoid footer buttons

**Files**:
- Create: `src/lib/components/backup/BackupImportModal.svelte`
- Modify: `src/routes/profile/+page.svelte` (add import button, modal trigger)

**Testing**:
- [ ] Manual test: file selection works
- [ ] Manual test: validation errors display correctly
- [ ] Manual test: import preview shows accurate counts
- [ ] Manual test: progress indicator during import
- [ ] Manual test: mobile viewport usability

**Commit Message**:
```
feat(backup): add import modal with preview and confirmation

- Create BackupImportModal with file selection
- Display validation results and warnings
- Add strategy selector and selective import options
- Show progress and result feedback
```

**Agent Invocations**:
```bash
# Implement Phase 4
# Invoke: shredly-code-writer agent with "Implement Phase 4 for ticket #027 - Import UI Modal"

# Review UI
# Invoke: code-quality-assessor agent with "Review import modal UI from ticket #027 Phase 4"
```

---

### Phase 5: Profile Tab Integration and Polish (2 points)

**Goal**: Integrate backup/restore into Profile tab "App" section with proper UX

**Steps**:
1. Add backup controls to "App" section in Profile tab:
   - Export backup button (with icon)
   - Import backup button (opens modal)
   - Last backup timestamp (stored in localStorage)
   - Data statistics (history rows, schedules, etc.)
2. Add localStorage tracking:
   - `shredly_last_backup`: ISO timestamp of last export
   - `shredly_backup_reminder`: Flag for backup reminder
3. Add backup reminder logic:
   - Prompt after 30 days without backup
   - Prompt when history exceeds 1000 rows and no recent backup
4. Handle edge cases:
   - Empty database (nothing to export)
   - Import to fresh install vs existing data
   - Large file handling (> 5MB warning)
5. Export existing CSV export (keep for backward compatibility)

**Files**:
- Modify: `src/routes/profile/+page.svelte` (complete Data Management section)
- Modify: `src/lib/backup/export.ts` (add last backup tracking)

**Testing**:
- [ ] Manual test: Profile tab shows backup controls in "App" section
- [ ] Manual test: Export/Import buttons work correctly
- [ ] Manual test: Last backup timestamp updates
- [ ] Manual test: Edge case handling (empty data, large files)

**Commit Message**:
```
feat(backup): complete Profile tab data management section

- Add Data Management section with export/import UI
- Track last backup timestamp
- Add data statistics display
- Handle edge cases and large file warnings
```

**Agent Invocations**:
```bash
# Implement Phase 5
# Invoke: shredly-code-writer agent with "Implement Phase 5 for ticket #027 - Profile Integration"

# Final review
# Invoke: code-quality-assessor agent with "Final review of backup/restore feature from ticket #027"
```

---

## Testing Strategy

### Unit Tests (Vitest)

- [ ] Test `createBackupBundle()` returns correct structure
- [ ] Test `calculateBackupStats()` computes accurate statistics
- [ ] Test `validateBackupBundle()` with valid backup
- [ ] Test `validateBackupBundle()` rejects invalid data
- [ ] Test `validateBackupBundle()` with missing optional fields
- [ ] Test `deduplicateHistoryRows()` identifies duplicates correctly
- [ ] Test `importBackupBundle()` with replace strategy
- [ ] Test `importBackupBundle()` with merge strategy (new data)
- [ ] Test `importBackupBundle()` with merge strategy (existing data)
- [ ] Test version compatibility handling
- [ ] Run: `npm run test:unit`

### Integration Tests (Vitest)

- [ ] Test full export -> import cycle preserves all data
- [ ] Test export from populated database
- [ ] Test import to empty database
- [ ] Test import to populated database (merge)
- [ ] Test large dataset handling (10,000+ rows)
- [ ] Run: `npm run test:integration`

### Manual Testing

**Export Testing**:
1. Navigate to Profile tab
2. Click Export Backup
3. Verify JSON file downloads with correct name
4. Open JSON and verify structure matches spec
5. Verify all data types present (history, schedules, user, preferences)

**Import Testing - Fresh Install**:
1. Clear all browser data for shredly.me
2. Navigate to Profile tab
3. Click Import Backup
4. Select valid backup file
5. Verify preview shows correct counts
6. Confirm import with Replace strategy
7. Verify all data restored (check Schedule, Live, Profile tabs)

**Import Testing - Merge**:
1. Use app for a few days (generate new data)
2. Import an older backup with Merge strategy
3. Verify no duplicates in history
4. Verify both old and new schedules present
5. Verify user data uses imported values (configurable)

**Mobile Testing**:
- Test on iOS Safari (file input behavior)
- Test on Android Chrome
- Verify modal scrolls correctly
- Verify touch targets are 44px minimum

### Test Fixtures to Create

Based on investigation, create these test fixtures in `tests/fixtures/backup/`:

| Fixture | Purpose |
|---------|---------|
| `valid-backup-v1.json` | Complete valid backup for happy path |
| `backup-no-schedules.json` | History-only backup (orphaned rows) |
| `backup-old-format.json` | Pre-ticket-#025 schedule (no dayConfigs) |
| `backup-legacy-equipment.json` | Old `equipment_access` field format |
| `backup-orphaned-history.json` | History refs non-existent schedule IDs |
| `backup-corrupt-compound.json` | Sub-exercises without parent rows |
| `backup-future-dates.json` | History with future timestamps |
| `backup-large.json` | 15,000+ history rows for stress test |
| `history-only.csv` | CSV import test file |

### Test Acceptance Criteria

- [ ] All unit tests pass (`npm run test:unit`)
- [ ] All integration tests pass (`npm run test:integration`)
- [ ] All tests pass together (`npm test`)
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual testing checklist complete
- [ ] Storage quota warning displays for large imports
- [ ] Orphaned history warning displays and preserves data
- [ ] dayConfigs auto-generated for old schedules

---

## Success Criteria

### Core Functionality
- [ ] User can export all data as single JSON file
- [ ] User can import backup file on fresh install
- [ ] User can merge backup with existing data (no duplicates)
- [ ] User can selectively import (just history, just schedules, etc.)
- [ ] Import validates data before modifying database
- [ ] Import shows clear progress and error messages
- [ ] 1RM cache recalculates correctly after history import
- [ ] Active schedule correctly set after import

### Validation (from investigation)
- [ ] Orphaned history rows detected and warned (not blocked)
- [ ] Compound parent/sub-exercise integrity validated
- [ ] Storage quota checked before large imports
- [ ] dayConfigs auto-generated for old schedules
- [ ] Stale live sessions (>24h) discarded with prompt
- [ ] Schema version field added to schedules

### Code Quality
- [ ] Code follows CLAUDE.md standards
- [ ] Data structures comply with EXERCISE_HISTORY_SPEC.md
- [ ] TypeScript types properly defined
- [ ] Tests provide >80% coverage of new code
- [ ] Works on both desktop and mobile browsers
- [ ] Shared download utility extracted and reused

---

## Dependencies

### Blocked By
- None (all required stores and types already exist)

### Blocks
- **Ticket #028**: Google Drive Manual Backup (Phase B-1)
- **Ticket #029**: Google Drive Auto-Backup (Phase B-2)
- **Ticket #030**: Multi-Device Sync (Phase B-3)
- Future: Device-to-device transfer (QR code or local network)

### External Dependencies
- None (uses browser built-in File API)

---

## Risks & Mitigations

### Risk 1: IndexedDB Transaction Failures During Large Import
- **Impact**: High (partial data import corrupts database)
- **Probability**: Medium
- **Mitigation**:
  - Batch imports into smaller transactions (500 rows per batch)
  - Implement rollback by tracking imported IDs
  - Backup existing data before import (optional user choice)

### Risk 2: Version Incompatibility with Future Backup Formats
- **Impact**: Medium (old backups won't import)
- **Probability**: Low
- **Mitigation**:
  - Include version field in backup bundle
  - Implement migration functions for each version bump
  - Maintain backward compatibility for at least 2 major versions

### Risk 3: Large File Handling on Mobile
- **Impact**: Medium (iOS Safari memory limits)
- **Probability**: Medium
- **Mitigation**:
  - Stream JSON parsing for large files
  - Warn user if file > 5MB
  - Provide progress feedback during import
  - Use Web Workers for heavy processing if needed

### Risk 4: Schedule ID Conflicts During Merge
- **Impact**: Low (wrong schedule associated with history)
- **Probability**: Low
- **Mitigation**:
  - Generate new IDs for imported schedules if conflict exists
  - Update history rows to reference new schedule IDs
  - Offer "keep both" vs "replace" option for schedule conflicts

### Risk 5: Orphaned History Rows (from investigation)
- **Impact**: Medium (exercises display incorrectly, no program context)
- **Probability**: Medium (user deletes schedule, imports old history)
- **Mitigation**:
  - Validate all `workout_program_id` values exist in schedule library
  - Option A: Warn user, preserve data (recommended)
  - Option B: Strip orphaned rows (data loss)
  - Option C: Create "Imported Workouts" placeholder schedule

### Risk 6: Compound Exercise Corruption (from investigation)
- **Impact**: Medium (sub-exercises without parent rows)
- **Probability**: Low (only from malformed imports)
- **Mitigation**:
  - Validate each sub-exercise has corresponding parent row
  - Check: same date, same exercise_order, is_compound_parent=true
  - If missing: warn user, create synthetic parent OR skip sub-exercise

### Risk 7: dayConfigs Missing (from investigation)
- **Impact**: Low (equipment filtering won't work per-day)
- **Probability**: High (all pre-ticket-#025 schedules)
- **Mitigation**:
  - Auto-generate dayConfigs from preferences on import
  - Use training_frequency → day count
  - Default all days to gym location

### Risk 8: Stale Live Session Restored (from investigation)
- **Impact**: Low (confusing UX, invalid exercise references)
- **Probability**: Medium (backup from days/weeks ago)
- **Mitigation**:
  - Check if session.scheduleId exists in imported schedules
  - Check if currentExerciseIndex is valid
  - If (now - session.startedAt) > 24 hours → discard
  - Prompt user: "Incomplete workout from {date} - discard?"

---

## Notes

### Data Relationships

The following data dependencies must be respected during import:

1. **Exercise History -> Schedule**: History rows reference `workout_program_id` which maps to `schedule.id`
2. **1RM Cache -> History**: Cache is calculated FROM history, not stored independently
3. **User Store -> Equipment**: homeEquipment/gymEquipment arrays affect workout generation

### Import Order

For correct data restoration, import must follow this order:
1. User data (creates equipment profiles)
2. Schedules (creates schedule IDs)
3. History (references schedule IDs)
4. Recalculate 1RM cache
5. Set active schedule
6. Restore preferences

### Backward Compatibility

- Existing CSV export (`exportHistoryCsv()`) remains functional
- New JSON export is additive, not replacement
- CSV import could be added as separate feature (lower priority)

### Storage Considerations

**localStorage Limitations**:
- ~5-10MB limit per origin
- Currently: ~200KB for typical user data
- Export file size: ~1MB for 10,000 history rows

**IndexedDB Capacity**:
- 50MB+ on most browsers
- Sufficient for 100,000+ history rows

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: feat, fix, docs, style, refactor, test, chore
- Scopes: backup, history, schedule, profile, ui
- **NEVER include "Generated with [Claude Code]" or "Co-Authored-By: Claude"**

---

## Definition of Done

- [ ] All phases implemented and tested
- [ ] All tests passing
- [ ] TypeScript compilation succeeds
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met
- [ ] Documentation updated
- [ ] Committed with proper commit messages
- [ ] CLAUDE.md "Current Development Status" updated

---

## Future Extensibility: Cloud Sync (Phase B)

**This ticket is designed to be extensible to cloud backup/sync.** After ticket #027 is complete, follow-up tickets should implement cloud features incrementally:

### Phased Approach for Google Drive (Recommended)

| Phase | Ticket | Description | Complexity |
|-------|--------|-------------|------------|
| **B-1** | #028 | Manual cloud backup | Low |
| **B-2** | #029 | Auto-backup after workouts | Medium |
| **B-3** | #030 | Multi-device sync | High |

---

### Phase B-1: Manual Cloud Backup (Ticket #028)

**Goals**:
- "Backup to Drive" button (one-click upload)
- "Restore from Drive" button (list backups, pick one)
- No auto-sync yet

**User Flow**:
1. User clicks "Backup to Drive" in App section
2. OAuth popup (Google Identity Services)
3. Backup uploaded to `Shredly Backups/` folder in user's Drive
4. Success message with link to view in Drive

**Technical Approach**:
```typescript
interface CloudBackupConfig {
  provider: 'google-drive';
  lastBackupTimestamp: string | null;
  backupFolderId: string | null;  // Drive folder ID
}
```

---

### Phase B-2: Auto-Backup (Ticket #029)

**Goals**:
- Background sync after each workout completion
- Configurable interval: daily/weekly/manual
- Last backup timestamp shown in App section

**User Flow**:
1. User enables "Auto-backup to Drive" toggle
2. After completing workout in Live view, backup uploads in background
3. App section shows "Last backed up: 2 hours ago"

---

### Phase B-3: Multi-Device Sync (Ticket #030)

**Goals**:
- Conflict detection (same schedule edited on 2 devices)
- Merge strategy for history (append, dedupe)
- Real-time sync indicator
- "Sync Now" manual trigger

**Conflict Resolution**:
- `updatedAt` timestamp comparison - last write wins for user/prefs
- MERGE for history (deduplicate by date + exercise + set_number)
- Keep-both for schedule conflicts (append "-copy" to name)

---

### Why Regular Folder Instead of appDataFolder

**Recommendation**: Use `Shredly Backups/` in user's Drive root, NOT `appDataFolder`.

| appDataFolder | Regular folder (Recommended) |
|---------------|------------------------------|
| Hidden from user | User can see/manage backups |
| Can't share backups | Can export backup link |
| **Deleted when app uninstalled** | **Persists after uninstall** |
| No web UI to manage | User can manage in drive.google.com |

**Key benefit**: If user uninstalls Shredly and reinstalls later, their backups are still in Drive.

---

### Technical Architecture

```typescript
// Future: src/lib/backup/cloud-sync.ts
interface CloudSyncConfig {
  provider: 'google-drive';  // Future: 'icloud' | 'dropbox'
  autoBackupInterval: 'daily' | 'weekly' | 'manual' | 'after_workout';
  lastSyncTimestamp: string | null;
  syncEnabled: boolean;
  backupFolderId: string | null;
}

// Uses same ShredlyBackupBundle format from ticket #027
// No changes to backup format needed
```

**Why This Works**:
- The `ShredlyBackupBundle` JSON format from ticket #027 is cloud-agnostic
- Same validation and import logic applies
- Just need to add upload/download transport layer
- Merge strategy handles multi-device conflicts

**Google Drive Integration Requirements**:
- Google Identity Services (GIS) library (NOT raw OAuth - handles token refresh)
- Google Drive API v3
- No backend needed (OAuth tokens stored in localStorage)
- File versioning via Drive's built-in version history

**This extensibility was intentional**: The `ShredlyBackupBundle` format, validation logic, and merge strategies from ticket #027 are designed to work identically for local file import OR cloud sync. Phase B only adds the transport layer.
