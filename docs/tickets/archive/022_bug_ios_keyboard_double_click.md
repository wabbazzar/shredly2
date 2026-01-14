# Ticket #022: Bug - iOS Keyboard Requires Double-Click on Profile Tab Editable Fields

**Status**: Open
**Priority**: High
**Type**: bug
**Estimated Points**: 3
**Phase**: 4-Mobile

---

## Summary

On iOS Safari (iPhone), editable fields in the Profile tab require two clicks to bring up the keyboard instead of one. First click toggles editing mode but doesn't open keyboard, second click focuses and opens keyboard.

## Background

This is a known iOS Safari limitation: focus() must be called **synchronously** within a user interaction event (click/touch) to trigger the keyboard. When focus() is called asynchronously (via requestAnimationFrame, setTimeout, or after await tick()), iOS Safari treats it as non-user-initiated and blocks the keyboard from opening.

**Current Behavior**:
- User taps "Weight" field
- onclick handler sets `editing = true`
- Svelte re-renders to show input element
- requestAnimationFrame(() => inputEl?.focus()) executes (async)
- Input focuses but keyboard does NOT appear (iOS security restriction)
- User taps input again
- Second tap is synchronous focus event -> keyboard opens

**Root Cause Files**:
1. `/home/wabbazzar/code/shredly2/src/lib/components/EditableField.svelte` (lines 17-25)
   - Uses `requestAnimationFrame(() => inputEl?.focus())` - async focus
2. `/home/wabbazzar/code/shredly2/src/lib/components/EditableSelectField.svelte` (lines 18-21)
   - Uses `setTimeout(() => selectEl?.focus(), 0)` - async focus
3. `/home/wabbazzar/code/shredly2/src/lib/components/EditableHeightField.svelte` (lines 34-54)
   - Uses `await tick()` followed by `requestAnimationFrame(() => feetInput?.focus())` - async focus

**Why Async Focus Was Used**:
- Input element doesn't exist in DOM until `editing = true` triggers Svelte re-render
- Attempting to focus non-existent element has no effect
- requestAnimationFrame/setTimeout/tick used to wait for DOM update before focusing

## Technical Requirements

### Solution: Always-Rendered Hidden Inputs

Keep input elements always rendered but visually hidden when not editing. This allows synchronous focus in the click handler.

**Approach**:
1. Render input elements always (not conditional on `editing`)
2. Use CSS to visually hide/show instead of Svelte if-blocks
3. Call focus() synchronously in click handler (no requestAnimationFrame/setTimeout)
4. Use absolute positioning or visibility tricks to avoid layout shift

### Code Locations

**Files to Modify**:
- `/home/wabbazzar/code/shredly2/src/lib/components/EditableField.svelte`
- `/home/wabbazzar/code/shredly2/src/lib/components/EditableSelectField.svelte`
- `/home/wabbazzar/code/shredly2/src/lib/components/EditableHeightField.svelte`

**Dependencies**:
- None (CSS-only change)

### TypeScript Types

No new types needed. Existing component props remain unchanged.

## Implementation Plan

### Phase 1: Fix EditableField.svelte (1 point)

**Goal**: Single-click keyboard on text/number fields (Name, Weight, Age, 1RM)

**Steps**:
1. Replace `{#if editing}...{:else}...{/if}` block with always-rendered structure
2. Use CSS classes to toggle visibility (e.g., `class:hidden={!editing}` on input, `class:hidden={editing}` on button)
3. Replace `requestAnimationFrame(() => inputEl?.focus())` with synchronous `inputEl?.focus()`
4. Ensure no layout shift when toggling between button and input
5. Test that blur/keydown handlers still work correctly

**Files**:
- Modify: `/home/wabbazzar/code/shredly2/src/lib/components/EditableField.svelte` (lines 17-86)

**Testing**:
- [ ] Unit test: component mounts with input element in DOM (even when not editing)
- [ ] Unit test: clicking button calls focus() synchronously
- [ ] Manual iOS Safari: single-click opens keyboard for Name field
- [ ] Manual iOS Safari: single-click opens keyboard for Weight field
- [ ] Manual iOS Safari: single-click opens keyboard for Age field
- [ ] Manual iOS Safari: single-click opens keyboard for 1RM fields
- [ ] Manual Desktop Chrome: no regressions in edit/save/cancel behavior
- [ ] Visual: no layout shift when toggling editing mode

**Commit Message**:
```
fix(profile): single-click keyboard on iOS for text/number fields

- Always render input element (hidden when not editing)
- Use CSS visibility toggle instead of Svelte if-blocks
- Call focus() synchronously in click handler (no requestAnimationFrame)
- Fixes iOS Safari keyboard requiring double-click

Testing:
- Verified on iPhone Safari (iOS 14+)
- Desktop Chrome/Safari regression tested
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 1 for ticket #022"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write unit tests for EditableField iOS keyboard fix from ticket #022"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review EditableField.svelte from ticket #022 Phase 1"
```

---

### Phase 2: Fix EditableSelectField.svelte (1 point)

**Goal**: Single-click keyboard on select fields (Goal, Duration, Experience, etc.)

**Steps**:
1. Replace `{#if editing}...{:else}...{/if}` block with always-rendered structure
2. Use CSS classes to toggle visibility
3. Replace `setTimeout(() => selectEl?.focus(), 0)` with synchronous `selectEl?.focus()`
4. Ensure select dropdown opens immediately on first click
5. Test that onchange/onblur/onkeydown handlers still work

**Files**:
- Modify: `/home/wabbazzar/code/shredly2/src/lib/components/EditableSelectField.svelte` (lines 18-83)

**Testing**:
- [ ] Unit test: select element always in DOM
- [ ] Unit test: clicking button calls focus() synchronously
- [ ] Manual iOS Safari: single-click opens dropdown for Goal field
- [ ] Manual iOS Safari: single-click opens dropdown for all preference fields
- [ ] Manual Desktop: dropdown behavior unchanged
- [ ] Visual: no layout shift when toggling editing mode

**Commit Message**:
```
fix(profile): single-click keyboard on iOS for select fields

- Always render select element (hidden when not editing)
- Remove setTimeout from focus call (synchronous focus)
- Fixes iOS Safari dropdown requiring double-click

Testing:
- Verified on iPhone Safari
- Desktop regression tested
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 2 for ticket #022"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write unit tests for EditableSelectField iOS keyboard fix from ticket #022"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review EditableSelectField.svelte from ticket #022 Phase 2"
```

---

### Phase 3: Fix EditableHeightField.svelte (1 point)

**Goal**: Single-click keyboard on height field (imperial feet/inches OR metric cm)

**Steps**:
1. Replace `{#if editing}...{:else}...{/if}` block with always-rendered structure
2. Handle both imperial (two inputs) and metric (one input) visibility states
3. Remove `await tick()` followed by `requestAnimationFrame(() => feetInput?.focus())`
4. Call focus() synchronously in startEdit() function
5. Ensure blur handling for multi-input (feet/inches) still works correctly
6. Test unit system toggle doesn't break keyboard behavior

**Files**:
- Modify: `/home/wabbazzar/code/shredly2/src/lib/components/EditableHeightField.svelte` (lines 34-164)

**Testing**:
- [ ] Unit test: imperial inputs always in DOM
- [ ] Unit test: metric input always in DOM
- [ ] Unit test: synchronous focus call on click
- [ ] Manual iOS Safari: single-click opens keyboard for Height (imperial)
- [ ] Manual iOS Safari: single-click opens keyboard for Height (metric)
- [ ] Manual iOS Safari: toggling units from lbs/ft to kg/cm works correctly
- [ ] Manual Desktop: blur handling for feet->inches transition works
- [ ] Visual: no layout shift for multi-input (feet + inches)

**Commit Message**:
```
fix(profile): single-click keyboard on iOS for height field

- Always render imperial and metric inputs (hidden when not active)
- Remove async tick + requestAnimationFrame (synchronous focus)
- Handle multi-input blur behavior correctly

Testing:
- Verified on iPhone Safari (imperial and metric)
- Desktop regression tested
- Unit system toggle tested
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 3 for ticket #022"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write unit tests for EditableHeightField iOS keyboard fix from ticket #022"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review EditableHeightField.svelte from ticket #022 Phase 3"
```

---

## Testing Strategy

### Unit Tests

**EditableField.svelte**:
- [ ] Input element exists in DOM when editing=false
- [ ] Input element is hidden via CSS when editing=false
- [ ] Button element is hidden via CSS when editing=true
- [ ] Clicking button calls focus() synchronously (no async delay)
- [ ] Blur handler saves value correctly
- [ ] Enter key saves, Escape key cancels
- [ ] No visual layout shift between editing states

**EditableSelectField.svelte**:
- [ ] Select element exists in DOM when editing=false
- [ ] Select element is hidden via CSS when editing=false
- [ ] Button element is hidden via CSS when editing=true
- [ ] Clicking button calls focus() synchronously (no setTimeout)
- [ ] onchange handler dispatches event correctly
- [ ] Escape key cancels editing

**EditableHeightField.svelte**:
- [ ] Both imperial and metric inputs exist in DOM always
- [ ] Correct inputs shown based on unitSystem prop
- [ ] Clicking button calls focus() synchronously (no tick + requestAnimationFrame)
- [ ] Blur handling for feet->inches transition works (doesn't close on internal focus move)
- [ ] Unit system change updates visible inputs correctly
- [ ] Enter/Escape keyboard shortcuts work

### Integration Tests

**Profile Page Integration**:
- [ ] All EditableField instances render correctly
- [ ] All EditableSelectField instances render correctly
- [ ] EditableHeightField renders correctly
- [ ] Unit toggle doesn't break field editing
- [ ] onChange handlers dispatch to userStore correctly

### Manual Testing

**iOS Safari (Real Device or Simulator - iOS 14+)**:

**Profile Tab - Stats Section**:
1. Tap "Name" field -> keyboard appears immediately (single tap)
2. Enter text -> blur or press Enter -> value saves
3. Tap "Height" field (imperial) -> keyboard appears (single tap, focuses feet input)
4. Enter feet value -> tab to inches input -> keyboard stays open
5. Tap "Height" field (metric) -> keyboard appears (single tap, focuses cm input)
6. Tap "Weight" field -> keyboard appears (single tap)
7. Tap "Age" field -> keyboard appears (single tap)

**Profile Tab - 1RM Section**:
1. Tap "Squat" 1RM field -> keyboard appears (single tap)
2. Tap "Bench Press" 1RM field -> keyboard appears (single tap)
3. Tap "Deadlift" 1RM field -> keyboard appears (single tap)
4. Tap "Overhead Press" 1RM field -> keyboard appears (single tap)

**Profile Tab - Workout Preferences Section**:
1. Tap "Goal" field -> dropdown opens immediately (single tap)
2. Select option -> value saves, dropdown closes
3. Tap "Session Duration" field -> dropdown opens (single tap)
4. Tap "Experience" field -> dropdown opens (single tap)
5. Tap "Equipment" field -> dropdown opens (single tap)
6. Tap "Training Days" field -> dropdown opens (single tap)
7. Tap "Program Length" field -> dropdown opens (single tap)

**Desktop Chrome/Safari (Regression Testing)**:
1. Click any text field -> input focuses, can type immediately
2. Click any select field -> dropdown opens immediately
3. Press Enter -> saves value
4. Press Escape -> cancels editing
5. Click outside (blur) -> saves value
6. No visual layout shift when toggling between display and edit modes

**Unit System Toggle**:
1. Start in imperial (lbs/ft) mode
2. Edit Weight field -> verify value displays correctly
3. Toggle to metric (kg/cm) mode
4. Edit Weight field again -> verify conversion and keyboard behavior
5. Edit Height field in metric mode -> verify cm input keyboard
6. Toggle back to imperial -> Edit Height field -> verify feet/inches keyboard

### Test Acceptance Criteria

- [ ] All unit tests pass
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] iOS Safari manual testing checklist 100% complete (all single-click)
- [ ] Desktop manual testing checklist 100% complete (no regressions)
- [ ] No visual layout shifts observed
- [ ] Unit system toggle tested with all fields

---

## Success Criteria

- [ ] Single-click brings up keyboard on ALL Profile tab editable fields on iOS Safari
- [ ] No double-click required on any text, number, or select field
- [ ] Desktop Chrome/Safari behavior unchanged (no regressions)
- [ ] No visual layout shifts when toggling editing mode
- [ ] blur/keydown/change handlers continue working correctly
- [ ] Unit system toggle doesn't break keyboard behavior
- [ ] Code follows CLAUDE.md standards (no requestAnimationFrame/setTimeout for focus)
- [ ] All tests passing

---

## Dependencies

### Blocked By
- None

### Blocks
- None

### External Dependencies
- None (CSS-only solution)

---

## Risks & Mitigations

### Risk 1: CSS visibility tricks cause layout shift or accessibility issues
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**: Use `position: absolute` with `opacity: 0` and `pointer-events: none` for hidden state, OR use `visibility: hidden` (maintains layout space). Test with screen readers to ensure accessibility. Use visual regression testing.

### Risk 2: Always-rendered inputs affect performance
- **Impact**: Low
- **Probability**: Low
- **Mitigation**: Profile page has ~15 editable fields total - negligible performance impact. Modern browsers optimize hidden DOM elements.

### Risk 3: Desktop keyboard shortcuts (Tab navigation) affected
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**: Ensure hidden inputs have `tabindex="-1"` or `disabled` attribute when not editing, so Tab key skips them. Test Tab navigation thoroughly.

### Risk 4: Blur handling breaks for multi-input fields (height feet/inches)
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**: Maintain existing `editContainer` + `relatedTarget` blur logic in EditableHeightField. Test feet->inches focus transition doesn't trigger save. Add unit test for this edge case.

---

## Notes

### iOS Safari Focus Behavior References

Apple's iOS Safari has strict focus() security policies:
- focus() called within user interaction event (click/touchstart) -> keyboard opens
- focus() called asynchronously (setTimeout/requestAnimationFrame/Promise) -> input focuses but keyboard stays hidden
- This is intentional to prevent autofocus spam/ads from opening keyboards

### Alternative Solutions Considered

1. **Use autofocus attribute**: Doesn't work - autofocus only triggers on page load, not when element becomes visible
2. **Touch event instead of click**: Doesn't help - still requires synchronous focus
3. **User activation API**: Not widely supported, same restrictions apply
4. **Modal/overlay approach**: Over-engineered for this use case

### CSS Visibility Options

**Option A - Display Toggle (Current)**:
```svelte
{#if editing}
  <input />
{:else}
  <button />
{/if}
```
Problem: Input doesn't exist when button clicked -> can't focus synchronously

**Option B - CSS Hidden (Recommended)**:
```svelte
<input class:hidden={!editing} />
<button class:hidden={editing} />
```
Solution: Input always exists -> can focus synchronously

**Option C - Opacity + Pointer Events**:
```svelte
<input class="absolute" class:opacity-0={!editing} class:pointer-events-none={!editing} />
<button class:opacity-0={editing} class:pointer-events-none={editing} />
```
Solution: More complex, but avoids layout shift completely

### Accessibility Considerations

- Ensure hidden inputs have `aria-hidden="true"` when not editing
- Consider adding `tabindex="-1"` to hidden inputs to skip in Tab navigation
- Screen readers should announce "editable" state on button click
- Verify VoiceOver on iOS Safari works correctly

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Type: `fix` (bug fix)
- Scope: `profile` (Profile tab components)
- **NEVER include "🤖 Generated with [Claude Code]" or "Co-Authored-By: Claude"**

**Example**:
```
fix(profile): single-click keyboard on iOS for all fields

- Always render inputs (hidden when not editing)
- Remove async focus calls (requestAnimationFrame/setTimeout/tick)
- Use CSS visibility toggle instead of Svelte if-blocks
- Fixes iOS Safari keyboard requiring double-click

Testing:
- Verified on iPhone 12 (iOS 16.4) and iPhone SE (iOS 14.8)
- Desktop Chrome/Safari regression tested
- 18 new unit tests for synchronous focus behavior
```

---

## Definition of Done

- [ ] Phase 1 implemented and tested (EditableField)
- [ ] Phase 2 implemented and tested (EditableSelectField)
- [ ] Phase 3 implemented and tested (EditableHeightField)
- [ ] All unit tests passing
- [ ] TypeScript compilation succeeds
- [ ] Manual iOS Safari testing 100% complete (all fields single-click)
- [ ] Desktop regression testing 100% complete
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met
- [ ] Committed with proper commit messages
- [ ] CLAUDE.md "Current Development Status" updated
