# Ticket #025: Feature - TV Display Mode for Screen Mirroring

**Status**: Backlog
**Priority**: Medium
**Type**: feature
**Estimated Points**: 8
**Phase**: 4-Mobile

---

## Summary

Add a "TV Mode" optimized display for the Live workout view that's designed for screen mirroring to TVs via AirPlay (iOS/Roku) or Miracast (Android). The mode shows a simplified, large-format timer display optimized for viewing from across a room.

## Background

Users want to see their workout timer on a TV while exercising. Rather than building custom casting receivers for each platform (Chromecast requires custom receiver app, Roku requires BrightScript native channel, AirPlay requires native iOS code), we leverage OS-level screen mirroring which works today:

- **iOS**: AirPlay to Apple TV, AirPlay-enabled Roku devices, AirPlay-enabled smart TVs
- **Android**: Miracast/Screen Cast to Chromecast, Android TV, Miracast-enabled TVs
- **Desktop**: Browser tab casting, HDMI output

The current Live view is optimized for phone interaction with controls, exercise lists, and modals. When mirrored to a TV, users need:
1. Much larger timer text (readable from 10+ feet away)
2. Higher contrast colors
3. Simplified display (no small buttons or detailed lists)
4. Essential info only (timer, exercise, set, weight)

---

## Technical Requirements

### User Experience

**TV Mode Activation**:
- Toggle button in Live view header (TV icon)
- Persist preference in localStorage
- Auto-detect external display connection (if browser API available)

**TV Mode Display**:
- Timer: 200px+ font size, centered
- Phase indicator: Large text with background color
- Exercise name: 48px+ font size
- Set counter: "Set 3 of 5" in 32px+ font
- Weight prescription: "145 lbs" in 32px+ font
- Sub-exercise (compound blocks): Current sub highlighted
- Hide: Exercise list, description panel, small control buttons
- Show: Large Play/Pause button (touch-friendly for phone interaction while mirrored)

**Audio Cues**: Already implemented - countdown beeps, completion chimes work via phone speaker

### Code Locations

**Files to modify:**
- `src/routes/live/+page.svelte` - Add TV mode toggle and conditional rendering
- `src/lib/components/live/TimerDisplay.svelte` - Add TV mode variant with larger sizing
- `src/lib/components/live/TimerControls.svelte` - Simplify controls for TV mode

**Files to create:**
- `src/lib/components/live/TVModeDisplay.svelte` - Dedicated TV-optimized component
- `src/lib/stores/displayMode.ts` - Store for TV mode preference

**No files needed for:**
- Casting SDK integration (using OS-level mirroring)
- Native platform code (pure web implementation)

### TypeScript Types

```typescript
// src/lib/stores/displayMode.ts

export type DisplayMode = 'normal' | 'tv';

export interface DisplayModeState {
  mode: DisplayMode;
  autoDetectEnabled: boolean;
}

// localStorage key: 'shredly_display_mode'
```

---

## Implementation Plan

### Phase 1: Display Mode Store (1 point)

**Goal**: Create store for TV mode preference with localStorage persistence.

**Steps**:
1. Create `src/lib/stores/displayMode.ts` with:
   - Writable store for display mode ('normal' | 'tv')
   - localStorage persistence
   - `toggleTVMode()` function
   - `setDisplayMode()` function
2. Add store initialization to app startup

**Files**:
- Create: `src/lib/stores/displayMode.ts`
- Modify: `src/routes/+layout.svelte` (initialize store)

**Testing**:
- [ ] Unit test: Store toggles between modes
- [ ] Unit test: localStorage persistence works
- [ ] Run: `npm run test:unit`

**Commit Message**:
```
feat(live): add display mode store for TV mode preference
```

---

### Phase 2: TV Mode Toggle UI (2 points)

**Goal**: Add TV mode toggle button to Live view header.

**Steps**:
1. Add TV icon button to Live view header (next to audio toggle)
2. Wire button to displayMode store toggle
3. Show visual indicator when TV mode is active
4. Style button consistently with existing header controls

**Files**:
- Modify: `src/routes/live/+page.svelte` (add toggle button)

**Testing**:
- [ ] Manual test: Toggle button visible in Live view
- [ ] Manual test: Button toggles TV mode state
- [ ] Manual test: Visual indicator shows active state
- [ ] Run: `npm run build`

**Commit Message**:
```
feat(live): add TV mode toggle button to header
```

---

### Phase 3: TV Mode Display Component (3 points)

**Goal**: Create dedicated TV-optimized display component with large, high-contrast visuals.

**Steps**:
1. Create `TVModeDisplay.svelte` with:
   - Full-screen dark background (#000 or very dark gray)
   - Timer: 200px font, white text, centered vertically
   - Phase label: 48px font, colored background strip
   - Exercise name: 48px font, white text
   - Set counter: 32px font, gray text
   - Weight prescription: 32px font, accent color
   - Sub-exercise display for compound blocks
2. Use flexbox for vertical centering
3. Apply high contrast color scheme (WCAG AAA compliant)
4. Hide all interactive elements except large pause button

**Design Specs**:
```
+------------------------------------------+
|                                          |
|              [WORKING]                   |  <- Phase (48px, colored bg)
|                                          |
|               1:45                       |  <- Timer (200px, white)
|                                          |
|          Barbell Back Squat              |  <- Exercise (48px, white)
|            Set 3 of 5                    |  <- Sets (32px, gray)
|             185 lbs                      |  <- Weight (32px, accent)
|                                          |
|              [ II ]                      |  <- Large pause button
|                                          |
+------------------------------------------+
```

**Files**:
- Create: `src/lib/components/live/TVModeDisplay.svelte`

**Testing**:
- [ ] Manual test: Component renders with correct sizing
- [ ] Manual test: Timer updates correctly
- [ ] Manual test: Phase colors match normal mode
- [ ] Manual test: Compound block sub-exercises display
- [ ] Run: `npm run build`

**Commit Message**:
```
feat(live): add TVModeDisplay component with large format visuals
```

---

### Phase 4: Live View Integration (2 points)

**Goal**: Wire TV mode display into Live view with seamless switching.

**Steps**:
1. Conditionally render TVModeDisplay vs normal components based on displayMode store
2. Ensure timer state flows correctly to TV mode component
3. Wire pause/resume to large button in TV mode
4. Handle data entry modal in TV mode (show over TV display)
5. Test transitions between modes mid-workout

**Files**:
- Modify: `src/routes/live/+page.svelte`
- Modify: `src/lib/components/live/TVModeDisplay.svelte`

**Testing**:
- [ ] Manual test: Toggle mid-workout preserves state
- [ ] Manual test: Timer continues correctly after toggle
- [ ] Manual test: Data entry modal appears correctly in TV mode
- [ ] Manual test: Pause/resume works in TV mode
- [ ] Run: `npm run test:unit`

**Commit Message**:
```
feat(live): integrate TV mode display with seamless switching
```

---

## Testing Strategy

### Unit Tests (Vitest)

**Display Mode Store** (`tests/unit/stores/displayMode.test.ts`):
- [ ] `toggleTVMode()` - switches between 'normal' and 'tv'
- [ ] `setDisplayMode('tv')` - sets mode directly
- [ ] localStorage persistence - saves and loads correctly
- [ ] Default mode is 'normal'

Run: `npm run test:unit`

### Manual Testing

**TV Mode Display**:
1. Start Live workout
2. Tap TV mode toggle
3. Verify large timer display renders
4. Verify phase colors are visible
5. Verify exercise name and weight display
6. Tap pause button, verify it works
7. Toggle back to normal mode
8. Verify workout state preserved

**Screen Mirroring (iOS)**:
1. Connect iPhone to AirPlay TV/Roku
2. Start Shredly Live workout
3. Enable TV mode
4. Verify TV shows large timer
5. Complete a set, verify data entry works
6. Verify phone controls work while mirrored

**Screen Mirroring (Android)**:
1. Cast screen to Chromecast/TV
2. Start Shredly Live workout
3. Enable TV mode
4. Verify TV shows large timer
5. Verify audio cues play from phone

### Test Acceptance Criteria

- [ ] All unit tests pass (`npm run test:unit`)
- [ ] All tests pass together (`npm test`)
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Manual testing checklist complete

---

## Success Criteria

- [ ] TV mode toggle button visible in Live view header
- [ ] TV mode preference persists across sessions
- [ ] Timer text is 200px+ and readable from 10+ feet
- [ ] Phase indicator has colored background
- [ ] Exercise name, set counter, weight clearly visible
- [ ] Compound block sub-exercises display correctly
- [ ] Large pause button works for phone interaction
- [ ] Data entry modal works in TV mode
- [ ] Toggle mid-workout preserves timer state
- [ ] Works with iOS AirPlay mirroring
- [ ] Works with Android screen casting
- [ ] Code follows CLAUDE.md standards

---

## Dependencies

### Blocked By
- None (builds on existing Live view infrastructure)

### Blocks
- None

### External Dependencies
- None (uses OS-level screen mirroring, no SDK integration)

---

## Risks & Mitigations

### Risk 1: Different TV aspect ratios cause layout issues
- **Impact**: Low
- **Probability**: Medium
- **Mitigation**: Use flexbox centering and relative sizing. Test on 16:9 and wider aspect ratios. Content is vertically centered so letterboxing is acceptable.

### Risk 2: Screen mirroring latency affects timer accuracy
- **Impact**: Low
- **Probability**: Low
- **Mitigation**: Timer runs on phone (source of truth). TV display may lag by ~100ms but this is acceptable for workout timing. Audio cues play from phone speaker which is the primary timing signal.

### Risk 3: Data entry modal hard to use while phone is mirroring
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**: Modal shows on both screens - user looks at phone to enter data. This is expected behavior and matches Peloton/other fitness apps.

---

## Notes

### Why Not Custom Casting (Chromecast/Roku)?

We evaluated custom casting solutions and determined screen mirroring is the pragmatic choice:

| Approach | Effort | Benefit |
|----------|--------|---------|
| Screen Mirroring | None (works today) | Covers iOS + Android + Desktop |
| Chromecast Custom Receiver | Medium (3-5 phases) | Only Chromecast devices |
| Roku Native Channel | High (5+ phases, new language) | Only Roku devices |
| AirPlay Custom | Very High (native iOS code) | Only Apple TV |

Screen mirroring provides 80% of the value with 0% of the development effort. TV Mode optimizes the display for this use case.

### Supported Screen Mirroring Methods

**iOS (AirPlay)**:
- Apple TV (all generations)
- Roku devices with AirPlay support (most 2019+ models)
- Samsung/LG/Vizio smart TVs with AirPlay 2
- Mac computers with AirPlay receiver

**Android (Miracast/Cast)**:
- Chromecast devices
- Android TV devices
- Smart TVs with built-in Chromecast
- Miracast-enabled TVs and dongles

**Desktop**:
- Chrome tab casting to Chromecast
- HDMI cable to TV/monitor
- Wireless display (Windows)

### User Documentation

Consider adding a help tooltip or FAQ entry explaining how to use TV mode:

> "To display your workout on a TV, use your device's built-in screen mirroring:
> - iPhone/iPad: Swipe down, tap Screen Mirroring, select your TV
> - Android: Settings > Connected Devices > Cast, select your TV
> - Then tap the TV icon in Shredly to optimize the display"

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: feat, fix, docs, style, refactor, test, chore
- Scopes: cli, engine, questionnaire, profile, schedule, live, workout-gen, exercise-selector, progression, ui, mobile, history, prs, tests
- **NEVER include "Generated with [Claude Code]" or "Co-Authored-By: Claude"**

---

## Definition of Done

- [ ] All phases implemented and tested
- [ ] All tests passing
- [ ] TypeScript compilation succeeds
- [ ] Success criteria met
- [ ] Committed with proper commit messages
- [ ] CLAUDE.md "Current Development Status" updated
