# Ticket #010: CLI Editor - Advanced Editing Features

**Type**: Feature
**Priority**: P2 - High (Quality of Life Improvements)
**Created**: 2026-01-07
**Status**: In Progress

---

## Problem Statement

The CLI workout editor needs several quality-of-life improvements to make editing faster and more intuitive:

1. **No swap mode**: Can't visually confirm which exercises are being swapped
2. **No exercise descriptions**: Can't view exercise details from exercise_descriptions.json
3. **Single-digit jump only**: Can only jump to exercises 1-9, not 10+
4. **No bulk value broadcast**: Must edit each week individually for same values
5. **Replace ('r') not vim-like**: Requires manual deletion before replacement

These missing features slow down workout editing and make the editor less intuitive for vim users.

---

## Solution Overview

Add five advanced editing features to the CLI workout editor:

1. **Swap Mode** - Visual exercise swapping with confirmation
2. **Exercise Info Viewer** - Display descriptions from exercise_descriptions.json
3. **Double-Digit Navigation** - Support jumping to exercises 10, 11, 12, etc.
4. **Broadcast to All Weeks** - Copy current field value to same field in all weeks
5. **Vim-like Replace** - Auto-delete on 'r' key (more vim-like)

---

## Technical Implementation Plan

### Phase 1: Swap Mode (5 points)

**Behavior**:
- Tap 'x' once → mark first exercise
- Tap 'x' again → mark second exercise, show confirmation prompt
- User confirms → swap exercises
- User cancels → clear marks

**Note**: Originally planned to use 'a' key, but changed to 'x' (eXchange) because 'a' is already used to change compound blocks to AMRAP type.

**Implementation**:
- Add `swapModeState` to EditorState:
  ```typescript
  swapModeState: {
    active: boolean;
    firstFieldIndex?: number;
    secondFieldIndex?: number;
  }
  ```
- Modify `handleViewModeKey` to detect double-tap 'x'
- Add visual highlights in `formatWorkoutInteractive` (yellow border around marked exercises)
- Add confirmation prompt: "Swap Exercise A with Exercise B? (y/n)"
- Call `editor.swapExercises(dayKey, indexA, indexB)`
- Add `swapExercises()` method to WorkoutEditor class

**Files Modified**:
- `cli/lib/interactive-workout-editor.ts` - Add swap mode state and handling
- `cli/lib/workout-formatter.ts` - Add visual highlights for marked exercises
- `src/lib/engine/workout-editor.ts` - Add swapExercises() method

---

### Phase 2: Exercise Info Viewer (3 points)

**Behavior**:
- User navigates to an exercise name field
- Tap 'i' → show exercise description overlay
- Display: overview, setup, movement, cues (from exercise_descriptions.json)
- Any key → close overlay and return to editor

**Implementation**:
- Load exercise_descriptions.json
- Add `showExerciseInfo()` method to InteractiveWorkoutEditor
- Render description in temporary overlay (similar to help screen)
- Check if exercise exists in descriptions database
- Fallback message if description not found

**Files Modified**:
- `cli/lib/interactive-workout-editor.ts` - Add info viewer

**Data Source**:
- `src/data/exercise_descriptions.json` (already exists)

---

### Phase 3: Double-Digit Navigation (2 points)

**Behavior**:
- User types "1" → buffer starts: "1..."
- User types "5" within 500ms → buffer becomes "15", jump to exercise 15
- Timeout after 500ms → execute jump with buffered number

**Implementation**:
- Add `numberInputBuffer` and `numberInputTimeout` to EditorState
- Modify jump logic in `handleViewModeKey`:
  ```typescript
  else if (str && /^[0-9]$/.test(str)) {
    clearTimeout(this.state.numberInputTimeout);
    this.state.numberInputBuffer += str;

    this.state.numberInputTimeout = setTimeout(() => {
      const exerciseNum = parseInt(this.state.numberInputBuffer);
      this.jumpToExerciseNumber(exerciseNum - 1);
      this.state.numberInputBuffer = '';
    }, 500);
  }
  ```
- Refactor existing single-digit jump to use shared `jumpToExerciseNumber()` method

**Files Modified**:
- `cli/lib/interactive-workout-editor.ts` - Add number buffer and timeout logic

---

### Phase 4: Broadcast to All Weeks (3 points)

**Behavior**:
- User edits a field (e.g., Week 1: 10 reps)
- Press Enter once → save to current week only
- Press Enter twice quickly (<500ms) → broadcast same value to all weeks

**Implementation**:
- Add `lastEnterPressTime` to EditorState
- Detect double-enter in `handleEditModeKey`:
  ```typescript
  else if (key.name === 'return') {
    const now = Date.now();
    const timeSinceLastEnter = now - (this.state.lastEnterPressTime || 0);

    if (timeSinceLastEnter < 500) {
      // Double-enter detected - broadcast to all weeks
      this.confirmEditAndBroadcast();
    } else {
      // Single enter - normal behavior
      this.confirmEdit();
    }

    this.state.lastEnterPressTime = now;
    this.state.mode = 'view';
  }
  ```
- Add `confirmEditAndBroadcast()` method
- Call `editor.broadcastFieldToAllWeeks(field, value)` for each week
- Add `broadcastFieldToAllWeeks()` method to WorkoutEditor

**Limitations**:
- Only works for week-specific fields (sets, reps, weight, rest_time, work_time)
- Does NOT work for exercise names, categories, or structural fields
- Shows confirmation message: "Broadcasted {fieldName}={value} to all 3 weeks"

**Files Modified**:
- `cli/lib/interactive-workout-editor.ts` - Add double-enter detection
- `src/lib/engine/workout-editor.ts` - Add broadcastFieldToAllWeeks() method

---

### Phase 5: Vim-like Replace (1 point)

**Behavior**:
- Old: Press 'r' → enter edit mode with current value, must backspace manually
- New: Press 'r' → enter edit mode with empty buffer (auto-deleted)

**Implementation**:
- Modify `enterEditMode()` to clear editBuffer when 'r' is pressed:
  ```typescript
  private async enterEditMode(autoClear: boolean = false): Promise<void> {
    const field = this.editableFields[this.state.selectedFieldIndex];
    if (!field) return;

    this.state.mode = 'edit';

    // Auto-clear for vim-like replace behavior
    this.state.editBuffer = autoClear ? '' : String(field.currentValue || '');

    this.setStatus(`Editing ${field.fieldName} - Press Enter to confirm, Esc to cancel`, 'info');
  }
  ```
- Update 'r' key handler:
  ```typescript
  else if (str === hotkeys.actions.replace_current_field) {
    await this.enterEditMode(true); // Pass true for auto-clear
  }
  ```

**Files Modified**:
- `cli/lib/interactive-workout-editor.ts` - Modify enterEditMode() signature

---

## Testing Strategy

### Unit Tests
- None required (interactive UI, manual testing sufficient)

### Integration Tests
- Manual testing with generated workout

### Test Cases
1. **Swap Mode**:
   - Tap 'x' once → verify first exercise marked (visual highlight)
   - Tap 'x' second time → verify confirmation prompt appears
   - Confirm swap → verify exercises swapped positions
   - Cancel swap → verify marks cleared, no changes
   - Tap 'x' then navigate away → verify marks cleared

2. **Exercise Info Viewer**:
   - Navigate to exercise name field
   - Tap 'i' → verify description overlay appears
   - Verify description contains: overview, setup, movement, cues
   - Press any key → verify overlay closes, editor returns
   - Test with exercise not in descriptions.json → verify fallback message

3. **Double-Digit Navigation**:
   - Type "1" → verify no immediate jump (waiting for second digit)
   - Type "5" within 500ms → verify jump to exercise 15
   - Type "1" then wait 600ms → verify jump to exercise 1 (timeout)
   - Type "2" "3" → verify jump to exercise 23
   - Test boundary: type "9" "9" → verify jump to exercise 99 (or max available)

4. **Broadcast to All Weeks**:
   - Edit a field (e.g., Week 1 reps)
   - Press Enter once → verify only Week 1 updated
   - Edit same field again
   - Press Enter twice quickly → verify all weeks updated with same value
   - Verify confirmation message shows: "Broadcasted reps=12 to all 3 weeks"
   - Test with exercise name field → verify broadcast does NOT work (structural field)

5. **Vim-like Replace**:
   - Navigate to field with value "10"
   - Press 'r' → verify edit buffer is empty (not "10")
   - Type "15" + Enter → verify value updated to "15"
   - Compare old behavior: would require backspace twice before typing "15"

---

## Success Criteria

- ✅ Swap mode allows visual confirmation before swapping exercises
- ✅ Exercise info viewer displays descriptions from exercise_descriptions.json
- ✅ Can jump to exercises 10, 11, 12, etc. using multi-digit input
- ✅ Double-enter broadcasts field value to all weeks (week-specific fields only)
- ✅ 'r' key auto-clears field for immediate replacement (vim-like)
- ✅ All features work in both Week view and Day view
- ✅ No regressions to existing editor functionality
- ✅ Help screen updated to document new features

---

## Dependencies

- `src/data/exercise_descriptions.json` - Already exists ✅
- `src/lib/engine/workout-editor.ts` - Existing class, needs new methods
- `cli/lib/interactive-workout-editor.ts` - Main UI logic
- `cli/lib/workout-formatter.ts` - Visual highlighting for swap mode

---

## Follow-up Work (Future Tickets)

- Add exercise filtering/search in exercise database browser
- Add multi-exercise selection for bulk operations
- Add workout templates/presets
- Add workout comparison tool (before/after editing)

---

## Implementation Notes

**Swap Mode Design Considerations**:
- Use timeout to detect double-tap 'a' (similar to double-click)
- Visual highlights must be distinct from current selection highlight
- Confirmation prompt should show exercise names, not just indices
- Allow cancellation at any point (Esc key)

**Exercise Info Viewer Design Considerations**:
- Overlay should be full-screen for readability
- Use chalk colors for section headers (overview, setup, movement, cues)
- Fallback gracefully if exercise not in descriptions database
- Consider adding "Category: strength | Difficulty: Intermediate" metadata

**Double-Digit Navigation Design Considerations**:
- 500ms timeout is standard for multi-key input
- Visual feedback: show number buffer in status line ("Jumping to: 1...")
- Handle edge cases: typing "00" → jump to exercise 0 (invalid, show error)
- Clear buffer on Esc key

**Broadcast Design Considerations**:
- ONLY broadcast week-specific fields (sets, reps, weight, rest_time, work_time, tempo, rpe, rir)
- DO NOT broadcast structural fields (name, category, progressionScheme)
- Show clear confirmation message with field name and value
- Add undo support for broadcast operations

**Vim-like Replace Design Considerations**:
- More intuitive for vim users (matches vim's 'r' command behavior)
- Reduces keystrokes: old flow = r + backspace×N + type + enter, new flow = r + type + enter
- Preserve existing edit behavior for other entry points (e.g., insertion points)

---

## Change Log

- 2026-01-07: Ticket created, implementation in progress
