# Ticket #020: Feature - Enhanced Exercise Browser Modal with Smart Filtering

**Status**: Open
**Priority**: High
**Type**: feature
**Estimated Points**: 13
**Phase**: 2-UI

---

## Summary

Enhance the Exercise Database (EDB) modal in Schedule Day View to improve mobile usability by making exercise names directly clickable, auto-filtering to matching exercises, showing exercise descriptions, adding inclusive AND filters, moving shuffle functionality into the modal, and requiring explicit confirmation before applying changes.

## Background

**Current Pain Points**:
- Shuffle/info buttons too small for touch targets ("fat fingered friends" issue)
- User instinct is to click exercise name to edit, not small icons
- No preview of what exercise will be selected before confirming
- Filters are single-select only (cannot combine category + muscle group + equipment)
- No way to see exercise description before selecting replacement
- Shuffle button outside modal creates accidental taps
- Modal immediately closes on selection, no chance to review

**User Feedback**:
- "I always tap the exercise name expecting it to open the selector"
- "The shuffle/info buttons are way too small on mobile"
- "I want to see what an exercise is before I replace it"
- "Let me filter by both muscle group AND equipment"

**Why This Matters**:
- Schedule Day View is a primary user interaction point
- Mobile-first design requires larger touch targets (44x44px minimum)
- Better filtering = faster exercise discovery
- Exercise descriptions = confidence in replacement choices
- Confirmation step = fewer accidental changes

---

## Technical Requirements

### Data Structures

**Exercise Database** (`src/data/exercise_database.json`):
```typescript
{
  exercise_database: {
    categories: {
      strength: {
        exercises: {
          "Bench Press": {
            category: "strength",
            muscle_groups: ["Chest", "Shoulders", "Triceps"],
            equipment: ["Barbell", "Bench"],
            difficulty: 5,
            // ... other fields
          }
        }
      }
    }
  }
}
```

**Exercise Descriptions** (`src/data/exercise_descriptions.json`):
```typescript
{
  "Bench Press": {
    description: {
      overview: string,
      setup: string,
      movement: string,
      cues: string
    }
  }
}
```

### Code Locations

- **Files to modify**:
  - `/home/wabbazzar/code/shredly2/src/lib/components/schedule/DayView.svelte`
    - Update `handleExerciseNameClick()` to open EDB with auto-filters
    - Update `handleSubExerciseNameClick()` to open EDB with auto-filters
    - Remove shuffle/info buttons from exercise rows (lines 706-727)
    - Remove shuffle/info buttons from sub-exercise rows (lines 817-839)
  - `/home/wabbazzar/code/shredly2/src/lib/components/schedule/ExerciseBrowser.svelte`
    - Add "Current Selection" section showing selected exercise + description
    - Add shuffle button to randomly select from filtered list
    - Reconfigure filters for multi-select AND logic
    - Add filter chips display with remove capability
    - Add explicit confirmation (Enter/Save button) before closing
    - Auto-apply filters on modal open based on current exercise

- **Files to read for context**:
  - `/home/wabbazzar/code/shredly2/src/data/exercise_database.json`
  - `/home/wabbazzar/code/shredly2/src/data/exercise_descriptions.json`

### TypeScript Types

**Updated ExerciseBrowser Props**:
```typescript
export let isOpen: boolean;
export let currentExerciseName = '';
export let autoFilterCategory = ''; // NEW: auto-apply category filter
export let autoFilterMuscleGroups: string[] = []; // NEW: auto-apply muscle groups
export let autoFilterEquipment: string[] = []; // NEW: auto-apply equipment
```

**Filter State**:
```typescript
// Multi-select filters (AND logic)
let selectedCategories: string[] = []; // Multiple categories
let selectedMuscleGroups: string[] = []; // Multiple muscle groups
let selectedEquipment: string[] = []; // Multiple equipment types

// Active filter chips for display
type FilterChip = {
  type: 'category' | 'muscle' | 'equipment';
  value: string;
};
let activeFilters: FilterChip[] = [];
```

**Exercise Selection State**:
```typescript
// Current exercise (pre-selected on modal open)
let currentExercise: FlatExercise | null = null;

// Preview exercise (hover/tap to preview)
let previewExercise: FlatExercise | null = null;

// Selected exercise (confirmed selection, shown in "Current Selection" section)
let selectedExercise: FlatExercise | null = null;
```

---

## Implementation Plan

### Phase 1: Update DayView - Remove Shuffle/Info Buttons, Pass Auto-Filters (3 points)

**Goal**: Make exercise names directly clickable and pass filtering context to EDB modal.

**Steps**:
1. Remove shuffle/info button HTML from regular exercise rows (lines 706-727)
2. Remove shuffle/info button HTML from sub-exercise rows (lines 817-839)
3. Update `handleExerciseNameClick()` to lookup exercise metadata and pass to EDB:
   ```typescript
   function handleExerciseNameClick(exerciseIndex: number, exerciseName: string) {
     const exerciseData = findExerciseInDatabase(exerciseName);
     replacingExerciseIndex = exerciseIndex;
     replacingSubExerciseIndex = -1;
     replacingExerciseName = exerciseName;

     // Set auto-filters for EDB
     autoFilterCategory = exerciseData?.category || '';
     autoFilterMuscleGroups = exerciseData?.muscle_groups || [];
     autoFilterEquipment = exerciseData?.equipment || [];

     showExerciseBrowser = true;
   }
   ```
4. Update `handleSubExerciseNameClick()` similarly
5. Add new props to ExerciseBrowser invocation in DayView template
6. Remove `handleShuffleClick()`, `handleSubExerciseShuffleClick()`, `handleInfoClick()` functions

**Files**:
- Modify: `src/lib/components/schedule/DayView.svelte`

**Testing**:
- [ ] Click exercise name opens EDB modal
- [ ] Click sub-exercise name opens EDB modal
- [ ] No shuffle/info buttons visible on exercise rows
- [ ] Modal receives correct auto-filter values

**Commit Message**:
```
feat(schedule): make exercise names clickable to open EDB

- Remove small shuffle/info buttons from exercise rows
- Exercise name now opens Exercise Database modal
- Pass auto-filter context (category, muscle groups, equipment)
- Improves mobile usability with larger touch target
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 1 for ticket #020"
```

---

### Phase 2: ExerciseBrowser - Auto-Filter Application (3 points)

**Goal**: Auto-apply filters when modal opens based on current exercise context.

**Steps**:
1. Add new props to ExerciseBrowser.svelte:
   ```typescript
   export let autoFilterCategory = '';
   export let autoFilterMuscleGroups: string[] = [];
   export let autoFilterEquipment: string[] = [];
   ```
2. Update filter initialization logic:
   ```typescript
   $: if (isOpen) {
     // Auto-apply filters on modal open
     if (autoFilterCategory) {
       selectedCategories = [autoFilterCategory];
     }
     if (autoFilterMuscleGroups.length > 0) {
       selectedMuscleGroups = [...autoFilterMuscleGroups];
     }
     if (autoFilterEquipment.length > 0) {
       selectedEquipment = [...autoFilterEquipment];
     }

     // Find current exercise and set as selected
     const current = allExercises.find(ex => ex.name === currentExerciseName);
     if (current) {
       currentExercise = current;
       selectedExercise = current;
     }

     // Sync active filter chips
     syncFilterChips();
   }
   ```
3. Create `syncFilterChips()` helper:
   ```typescript
   function syncFilterChips() {
     activeFilters = [
       ...selectedCategories.map(cat => ({ type: 'category', value: cat })),
       ...selectedMuscleGroups.map(mg => ({ type: 'muscle', value: mg })),
       ...selectedEquipment.map(eq => ({ type: 'equipment', value: eq }))
     ];
   }
   ```
4. Update `filteredExercises` reactive to use multi-select AND logic:
   ```typescript
   $: filteredExercises = allExercises.filter((exercise) => {
     // Search query
     if (searchQuery && !exercise.name.toLowerCase().includes(searchQuery.toLowerCase())) {
       return false;
     }

     // Categories filter (OR within categories, if multiple selected)
     if (selectedCategories.length > 0 && !selectedCategories.includes(exercise.category)) {
       return false;
     }

     // Muscle groups filter (AND - exercise must have ALL selected muscle groups)
     if (selectedMuscleGroups.length > 0) {
       const hasAll = selectedMuscleGroups.every(mg => exercise.muscle_groups.includes(mg));
       if (!hasAll) return false;
     }

     // Equipment filter (AND - exercise must have ALL selected equipment)
     if (selectedEquipment.length > 0) {
       const hasAll = selectedEquipment.every(eq => exercise.equipment.includes(eq));
       if (!hasAll) return false;
     }

     return true;
   });
   ```

**Files**:
- Modify: `src/lib/components/schedule/ExerciseBrowser.svelte`

**Testing**:
- [ ] Modal opens with filters pre-applied based on current exercise
- [ ] Filtered list shows only exercises matching current exercise criteria
- [ ] Multi-select AND logic works correctly for muscle groups
- [ ] Multi-select AND logic works correctly for equipment

**Commit Message**:
```
feat(schedule): auto-filter EDB by current exercise criteria

- Add auto-filter props to ExerciseBrowser component
- Apply category/muscle/equipment filters on modal open
- Use AND logic for multi-select filters
- Pre-select current exercise in modal
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 2 for ticket #020"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for auto-filter logic from ticket #020 Phase 2"

# Use test-critic for test review
# Invoke: test-critic agent with "Review auto-filter tests from ticket #020 Phase 2"
```

---

### Phase 3: Multi-Select Filter UI with Chips (3 points)

**Goal**: Replace single-select dropdowns with multi-select + filter chip display.

**Steps**:
1. Replace single-select dropdowns with multi-select checkboxes or tag inputs
2. Create filter chips UI section:
   ```svelte
   <!-- Filter Chips Display -->
   {#if activeFilters.length > 0}
     <div class="flex flex-wrap gap-1.5 px-4 py-2 border-b border-slate-700">
       {#each activeFilters as filter}
         <button
           class="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded-full
                  hover:bg-indigo-700 transition-colors"
           on:click={() => removeFilter(filter.type, filter.value)}
         >
           <span>{filter.value}</span>
           <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
           </svg>
         </button>
       {/each}
       <button
         class="px-2 py-1 text-slate-400 hover:text-white text-xs transition-colors"
         on:click={clearAllFilters}
       >
         Clear all
       </button>
     </div>
   {/if}
   ```
3. Implement `removeFilter()`:
   ```typescript
   function removeFilter(type: 'category' | 'muscle' | 'equipment', value: string) {
     if (type === 'category') {
       selectedCategories = selectedCategories.filter(c => c !== value);
     } else if (type === 'muscle') {
       selectedMuscleGroups = selectedMuscleGroups.filter(mg => mg !== value);
     } else if (type === 'equipment') {
       selectedEquipment = selectedEquipment.filter(eq => eq !== value);
     }
     syncFilterChips();
   }
   ```
4. Implement `clearAllFilters()`:
   ```typescript
   function clearAllFilters() {
     selectedCategories = [];
     selectedMuscleGroups = [];
     selectedEquipment = [];
     searchQuery = '';
     syncFilterChips();
   }
   ```
5. Update filter section UI with multi-select dropdowns or expandable sections
6. Ensure all touch targets are minimum 44x44px

**Files**:
- Modify: `src/lib/components/schedule/ExerciseBrowser.svelte`

**Testing**:
- [ ] Filter chips display when filters are active
- [ ] Clicking chip removes that filter
- [ ] "Clear all" button removes all filters and search query
- [ ] Multi-select dropdowns allow multiple selections
- [ ] Touch targets meet 44x44px minimum size

**Commit Message**:
```
feat(schedule): add multi-select filters with chip display

- Replace single-select dropdowns with multi-select UI
- Add filter chips showing active filters
- Clicking chip removes individual filter
- Clear all button removes all filters
- All touch targets meet 44px minimum
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 3 for ticket #020"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review ExerciseBrowser.svelte from ticket #020 Phase 3"
```

---

### Phase 4: Current Selection Section with Description (2 points)

**Goal**: Show currently selected exercise with full description at top of modal.

**Steps**:
1. Add "Current Selection" section below header:
   ```svelte
   <!-- Current Selection Section -->
   {#if selectedExercise}
     <div class="p-4 bg-slate-800 border-b border-slate-700">
       <div class="flex items-center justify-between mb-2">
         <h3 class="text-sm font-medium text-indigo-400">Current Selection</h3>
         {#if selectedExercise.name !== currentExerciseName}
           <span class="text-xs text-amber-400">Changed</span>
         {/if}
       </div>
       <p class="text-lg font-semibold text-white mb-2">{selectedExercise.name}</p>

       {#if exerciseDescriptions[selectedExercise.name]?.description}
         {@const desc = exerciseDescriptions[selectedExercise.name].description}
         <div class="space-y-2 text-sm">
           <div>
             <h4 class="text-xs font-medium text-slate-400 mb-1">Overview</h4>
             <p class="text-slate-300 leading-relaxed">{desc.overview}</p>
           </div>
           <div>
             <h4 class="text-xs font-medium text-slate-400 mb-1">Setup</h4>
             <p class="text-slate-300 leading-relaxed">{desc.setup}</p>
           </div>
           <div>
             <h4 class="text-xs font-medium text-slate-400 mb-1">Movement</h4>
             <p class="text-slate-300 leading-relaxed">{desc.movement}</p>
           </div>
           <div>
             <h4 class="text-xs font-medium text-slate-400 mb-1">Cues</h4>
             <p class="text-slate-300 italic">{desc.cues}</p>
           </div>
         </div>
       {:else}
         <p class="text-sm text-slate-400 italic">No description available</p>
       {/if}
     </div>
   {/if}
   ```
2. Import exercise descriptions:
   ```typescript
   import exerciseDescriptions from '../../../data/exercise_descriptions.json';
   ```
3. Update exercise list item click to update `selectedExercise` (not immediately dispatch):
   ```typescript
   function handleExerciseClick(exercise: FlatExercise) {
     selectedExercise = exercise; // Update preview, don't close modal
   }
   ```
4. Add collapsible/expandable toggle if description is too long (optional)

**Files**:
- Modify: `src/lib/components/schedule/ExerciseBrowser.svelte`

**Testing**:
- [ ] Current Selection section displays selected exercise
- [ ] Description shows all four fields (overview, setup, movement, cues)
- [ ] "Changed" badge appears when selection differs from original
- [ ] Falls back gracefully if description not available
- [ ] Section is scrollable if content exceeds screen height

**Commit Message**:
```
feat(schedule): add current selection preview in EDB

- Show selected exercise with full description
- Display overview, setup, movement, and cues
- Highlight when selection differs from original
- Graceful fallback for missing descriptions
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 4 for ticket #020"
```

---

### Phase 5: Shuffle Button + Confirmation Required (2 points)

**Goal**: Add shuffle button inside modal and require explicit confirmation before applying changes.

**Steps**:
1. Add shuffle button in header or near filter chips:
   ```svelte
   <div class="flex items-center justify-between p-4 border-b border-slate-700">
     <h2 class="text-lg font-semibold text-white">Select Exercise</h2>
     <div class="flex items-center gap-2">
       <!-- Shuffle button -->
       <button
         on:click={handleShuffle}
         class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg
                transition-colors flex items-center gap-2"
         disabled={filteredExercises.length === 0}
       >
         <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                 d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
         </svg>
         <span class="text-sm">Shuffle</span>
       </button>
       <!-- Close button -->
       <button on:click={handleCancel} class="p-1 text-slate-400 hover:text-white transition-colors">
         <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
         </svg>
       </button>
     </div>
   </div>
   ```
2. Implement `handleShuffle()`:
   ```typescript
   function handleShuffle() {
     if (filteredExercises.length === 0) return;

     // Exclude current selection from shuffle pool
     const shufflePool = filteredExercises.filter(ex => ex.name !== selectedExercise?.name);
     if (shufflePool.length === 0) return;

     // Random selection
     const randomIndex = Math.floor(Math.random() * shufflePool.length);
     selectedExercise = shufflePool[randomIndex];
   }
   ```
3. Add footer with Cancel/Confirm buttons:
   ```svelte
   <!-- Footer with confirmation buttons -->
   <div class="sticky bottom-0 p-4 bg-slate-800 border-t border-slate-700 flex gap-2">
     <button
       on:click={handleCancel}
       class="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg
              transition-colors font-medium"
     >
       Cancel
     </button>
     <button
       on:click={handleConfirm}
       disabled={!selectedExercise}
       class="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg
              transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
     >
       Confirm
     </button>
   </div>
   ```
4. Update `handleConfirm()` to only dispatch if selection is different:
   ```typescript
   function handleConfirm() {
     if (selectedExercise && selectedExercise.name !== currentExerciseName) {
       dispatch('select', {
         name: selectedExercise.name,
         exercise: selectedExercise
       });
     } else {
       // No change, just close
       handleCancel();
     }
   }
   ```
5. Remove double-tap logic (no longer needed with explicit confirmation)
6. Update keyboard handlers (Enter = confirm, Escape = cancel)

**Files**:
- Modify: `src/lib/components/schedule/ExerciseBrowser.svelte`

**Testing**:
- [ ] Shuffle button randomly selects exercise from filtered list
- [ ] Shuffle excludes currently selected exercise
- [ ] Shuffle button disabled when no filtered exercises available
- [ ] Confirm button dispatches selection event
- [ ] Cancel button closes modal without changes
- [ ] Enter key confirms selection
- [ ] Escape key cancels modal
- [ ] Modal doesn't close until user explicitly confirms/cancels

**Commit Message**:
```
feat(schedule): add shuffle + confirmation to EDB

- Add shuffle button to randomly select from filtered list
- Require explicit confirmation before applying change
- Add Cancel/Confirm footer buttons
- Remove auto-close on selection
- Keyboard support (Enter/Escape)
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 5 for ticket #020"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for shuffle and confirmation logic from ticket #020 Phase 5"

# Use code-quality-assessor for final review
# Invoke: code-quality-assessor agent with "Final review of ticket #020 implementation"
```

---

## Testing Strategy

### Unit Tests

- [ ] Test auto-filter application logic
- [ ] Test multi-select AND filter logic
- [ ] Test filter chip removal
- [ ] Test clear all filters
- [ ] Test shuffle random selection
- [ ] Test shuffle pool exclusion (current exercise)
- [ ] Test confirmation dispatches correct event
- [ ] Test cancel closes without changes

### Integration Tests

- [ ] Test DayView opens EDB with correct auto-filters
- [ ] Test selecting exercise updates DayView
- [ ] Test shuffle + confirm updates exercise
- [ ] Test cancel leaves exercise unchanged
- [ ] Test filter chips sync with filter state
- [ ] Test description display for exercises with/without descriptions

### Manual Testing

**Desktop**:
1. Navigate to Schedule Day View
2. Click exercise name
3. Verify EDB opens with filters matching current exercise
4. Verify Current Selection shows exercise description
5. Click filter chip to remove filter
6. Click Shuffle, verify random selection
7. Click Confirm, verify exercise updates in Day View
8. Click another exercise, click Cancel, verify no change

**Mobile**:
1. Test all desktop scenarios on mobile device
2. Verify all buttons meet 44x44px touch target minimum
3. Verify filter chips are easily tappable
4. Verify modal scrolls correctly on small screens
5. Verify Current Selection section doesn't overflow
6. Test shuffle button on filtered list
7. Test Cancel/Confirm buttons on mobile keyboard

### Test Acceptance Criteria

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual testing checklist complete
- [ ] Mobile touch targets verified >= 44x44px
- [ ] No console errors during modal interactions

---

## Success Criteria

- [ ] Exercise names are clickable and open EDB modal
- [ ] EDB opens with current exercise pre-selected
- [ ] Filters auto-applied based on current exercise criteria
- [ ] Multi-select AND filters work correctly
- [ ] Filter chips display and are removable
- [ ] Shuffle button selects random exercise from filtered list
- [ ] Current Selection section shows exercise description
- [ ] User must confirm before changes apply
- [ ] Cancel button exits without changes
- [ ] All touch targets meet 44x44px minimum (mobile usability)
- [ ] Code follows CLAUDE.md standards
- [ ] TypeScript types properly defined
- [ ] Modal works on mobile and desktop viewports

---

## Dependencies

### Blocked By
- None

### Blocks
- None

### External Dependencies
- None (all data already exists in exercise_database.json and exercise_descriptions.json)

---

## Risks & Mitigations

### Risk 1: Filter chip UI too cluttered on mobile with many active filters
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**: Use horizontal scrolling for filter chips, limit initial auto-filters to most relevant (category only), provide "Clear all" escape hatch

### Risk 2: Exercise descriptions missing for many exercises
- **Impact**: Low
- **Probability**: High
- **Mitigation**: Graceful fallback with "No description available" message, prioritize adding descriptions for most popular exercises

### Risk 3: Shuffle pool too small after aggressive filtering
- **Impact**: Low
- **Probability**: Medium
- **Mitigation**: Disable shuffle button when filtered list has 0-1 exercises, show message "Adjust filters to enable shuffle"

### Risk 4: Modal performance with 326 exercises
- **Impact**: Low
- **Probability**: Low
- **Mitigation**: Filtering happens reactively in Svelte, already performant. Virtual scrolling not needed for <500 items.

---

## Notes

### Design Decisions

1. **Auto-filters vs Manual filters**: Auto-apply filters on modal open to show relevant exercises immediately, but allow user to remove/modify filters via chips
2. **AND vs OR logic**: Use AND logic for multi-select filters to narrow results (more useful than OR which expands results)
3. **Shuffle inside modal**: Keeps all exercise replacement functionality in one place, reduces accidental taps
4. **Explicit confirmation**: Prevents accidental exercise changes, gives user chance to review description before committing

### Future Enhancements (Out of Scope)

- Add "Favorites" filter to show user's frequently selected exercises
- Add exercise video previews (requires video assets)
- Add muscle group heatmap visualization
- Add "Similar exercises" recommendation engine
- Add keyboard navigation (arrow keys to move through list)

### Mobile-First Considerations

- Filter chips use horizontal scroll to prevent vertical space consumption
- Current Selection section collapses description if >200px height (expandable)
- Confirm/Cancel buttons fixed at bottom for easy thumb access
- Shuffle button positioned in header for easy reach

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: feat, fix, docs, style, refactor, test, chore
- Scopes: schedule, ui, mobile, tests
- **NEVER include "🤖 Generated with [Claude Code]" or "Co-Authored-By: Claude"**

---

## Definition of Done

- [ ] All 5 phases implemented and tested
- [ ] All tests passing
- [ ] TypeScript compilation succeeds
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met
- [ ] Manual testing on mobile device completed
- [ ] Touch target sizes verified >= 44x44px
- [ ] Committed with proper commit messages
- [ ] CLAUDE.md "Current Development Status" updated
