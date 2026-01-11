# Ticket #016: Feature - Navigation Shell with Bottom Tabs and Swipe Gestures

**Status**: Open
**Priority**: High
**Type**: feature
**Estimated Points**: 13 (across 5 phases)
**Phase**: 2-UI

---

## Summary

Initialize the SvelteKit frontend framework, configure Capacitor for PWA support, set up Tailwind CSS, and build a production-ready navigation shell with bottom tab bar, smooth slide transitions, and full swipe gesture navigation between the three main tabs (Profile, Schedule, Live).

## Background

This is the FIRST frontend ticket for Shredly 2.0. The CLI prototype and workout generation engine are complete and tested (279 tests passing). The project currently has:
- A working CLI with `npm run cli` commands
- A complete workout generation engine in `src/lib/engine/`
- No SvelteKit, Tailwind, or Capacitor installed

The navigation shell must feel production-ready with polished interactions even though tab content will be placeholder. This establishes the foundation for all subsequent UI development.

**User requirements:**
- Bottom tab bar navigation (thumb-friendly, always visible)
- Smooth horizontal slide animations between tabs (native iOS/Android feel)
- Full swipe gesture navigation (swipe left/right anywhere on screen)
- PWA-first, mobile-focused experience
- Must preserve existing CLI scripts functionality

---

## Technical Requirements

### Framework Stack

| Package | Version | Purpose |
|---------|---------|---------|
| @sveltejs/kit | ^2.x | Frontend framework |
| @sveltejs/adapter-static | ^3.x | Static site generation for Capacitor |
| svelte | ^5.x | Component framework |
| tailwindcss | ^3.x | Utility-first CSS |
| postcss | ^8.x | CSS processing |
| autoprefixer | ^10.x | CSS vendor prefixes |
| @capacitor/core | ^6.x | Native mobile wrapper |
| @capacitor/cli | ^6.x | Capacitor CLI tools |
| @vite-pwa/sveltekit | ^0.x | PWA manifest and service worker |

### Data Structures

**Navigation State** (Svelte store):

```typescript
// src/lib/stores/navigation.ts
import { writable, derived } from 'svelte/store';

export type TabId = 'profile' | 'schedule' | 'live';

export interface NavigationState {
  activeTab: TabId;
  previousTab: TabId | null;
  transitionDirection: 'left' | 'right' | null;
}

export const navigationStore = writable<NavigationState>({
  activeTab: 'schedule',  // Default to schedule tab
  previousTab: null,
  transitionDirection: null
});

// Tab order for swipe direction calculation
export const TAB_ORDER: TabId[] = ['profile', 'schedule', 'live'];

export function navigateToTab(tabId: TabId): void {
  navigationStore.update(state => {
    const currentIndex = TAB_ORDER.indexOf(state.activeTab);
    const targetIndex = TAB_ORDER.indexOf(tabId);
    return {
      activeTab: tabId,
      previousTab: state.activeTab,
      transitionDirection: targetIndex > currentIndex ? 'left' : 'right'
    };
  });
}

export function swipeLeft(): void {
  navigationStore.update(state => {
    const currentIndex = TAB_ORDER.indexOf(state.activeTab);
    if (currentIndex < TAB_ORDER.length - 1) {
      return {
        activeTab: TAB_ORDER[currentIndex + 1],
        previousTab: state.activeTab,
        transitionDirection: 'left'
      };
    }
    return state;
  });
}

export function swipeRight(): void {
  navigationStore.update(state => {
    const currentIndex = TAB_ORDER.indexOf(state.activeTab);
    if (currentIndex > 0) {
      return {
        activeTab: TAB_ORDER[currentIndex - 1],
        previousTab: state.activeTab,
        transitionDirection: 'right'
      };
    }
    return state;
  });
}
```

### Code Locations

**Files to create:**
- `svelte.config.js` - SvelteKit configuration
- `vite.config.ts` - Vite configuration with PWA plugin
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration
- `capacitor.config.ts` - Capacitor configuration
- `src/app.html` - SvelteKit HTML shell
- `src/app.css` - Global styles with Tailwind directives
- `src/routes/+layout.svelte` - Root layout with navigation shell
- `src/routes/+page.svelte` - Redirect to /schedule (default tab)
- `src/routes/profile/+page.svelte` - Profile tab placeholder
- `src/routes/schedule/+page.svelte` - Schedule tab placeholder
- `src/routes/live/+page.svelte` - Live tab placeholder
- `src/lib/stores/navigation.ts` - Navigation state store
- `src/lib/components/BottomTabBar.svelte` - Tab bar component
- `src/lib/components/SwipeContainer.svelte` - Swipe gesture container
- `src/lib/components/TabContent.svelte` - Tab content wrapper with transitions
- `static/favicon.png` - App favicon
- `static/manifest.json` - PWA manifest

**Files to modify:**
- `package.json` - Add SvelteKit dependencies and scripts
- `tsconfig.json` - Update for SvelteKit paths

### TypeScript Types

```typescript
// src/lib/types/navigation.ts
export type TabId = 'profile' | 'schedule' | 'live';

export interface TabConfig {
  id: TabId;
  label: string;
  icon: string;  // SVG path or icon name
  path: string;  // Route path
}

export const TABS: TabConfig[] = [
  { id: 'profile', label: 'Profile', icon: 'user', path: '/profile' },
  { id: 'schedule', label: 'Schedule', icon: 'calendar', path: '/schedule' },
  { id: 'live', label: 'Live', icon: 'play', path: '/live' }
];

export interface SwipeState {
  startX: number;
  startY: number;
  currentX: number;
  isDragging: boolean;
  direction: 'horizontal' | 'vertical' | null;
}
```

---

## Implementation Plan

### Phase 1: SvelteKit + Tailwind Installation (3 points)

**Goal**: Install and configure SvelteKit with Tailwind CSS, ensuring CLI scripts continue to work.

**Steps**:
1. Install SvelteKit and dependencies via npm
2. Create `svelte.config.js` with static adapter
3. Create `vite.config.ts` with proper configuration
4. Install and configure Tailwind CSS with PostCSS
5. Create `src/app.html` and `src/app.css` with Tailwind directives
6. Update `package.json` with SvelteKit scripts (dev, build, preview)
7. Update `tsconfig.json` for SvelteKit path aliases
8. Verify `npm run cli` still works
9. Verify `npm run dev` starts SvelteKit dev server

**Files**:
- Create: `svelte.config.js`
- Create: `vite.config.ts`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `src/app.html`
- Create: `src/app.css`
- Create: `static/favicon.png` (placeholder)
- Modify: `package.json`
- Modify: `tsconfig.json`

**Package Installation Commands**:
```bash
# SvelteKit core
npm install -D @sveltejs/kit @sveltejs/adapter-static svelte @sveltejs/vite-plugin-svelte

# Tailwind CSS
npm install -D tailwindcss postcss autoprefixer

# Initialize Tailwind
npx tailwindcss init -p
```

**Testing**:
- [ ] `npm run cli` executes successfully (existing CLI preserved)
- [ ] `npm run dev` starts SvelteKit dev server on localhost:5173
- [ ] `npm run build` completes without errors
- [ ] Tailwind classes work in components
- [ ] TypeScript compilation succeeds (`npm run typecheck`)

**Commit Message**:
```
chore(ui): install SvelteKit and Tailwind CSS

- Add SvelteKit 2.x with static adapter for Capacitor
- Configure Tailwind CSS with PostCSS
- Create app.html and app.css with Tailwind directives
- Preserve existing CLI scripts (npm run cli still works)
- Add dev, build, preview scripts for frontend
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 1 for ticket #016 - SvelteKit + Tailwind Installation"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review svelte.config.js, vite.config.ts, tailwind.config.js from ticket #016 Phase 1"
```

---

### Phase 2: Capacitor + PWA Configuration (2 points)

**Goal**: Initialize Capacitor for future native builds and configure PWA manifest.

**Steps**:
1. Install Capacitor core and CLI
2. Create `capacitor.config.ts` with app configuration
3. Install @vite-pwa/sveltekit plugin
4. Create PWA manifest (`static/manifest.json`)
5. Configure vite.config.ts with PWA plugin
6. Add PWA meta tags to app.html
7. Create app icons in static/ directory (192x192, 512x512 placeholders)
8. Test PWA installability in Chrome DevTools

**Files**:
- Create: `capacitor.config.ts`
- Create: `static/manifest.json`
- Create: `static/icon-192.png` (placeholder)
- Create: `static/icon-512.png` (placeholder)
- Modify: `vite.config.ts` (add PWA plugin)
- Modify: `src/app.html` (add PWA meta tags)
- Modify: `package.json` (add capacitor dependencies)

**Package Installation Commands**:
```bash
# Capacitor
npm install @capacitor/core
npm install -D @capacitor/cli

# PWA plugin
npm install -D @vite-pwa/sveltekit
```

**capacitor.config.ts**:
```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shredly.app',
  appName: 'Shredly',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
```

**static/manifest.json**:
```json
{
  "name": "Shredly",
  "short_name": "Shredly",
  "description": "Personalized workout generation and tracking",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#6366f1",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Testing**:
- [ ] `npx cap init` completes without errors (if not using config file)
- [ ] PWA manifest loads correctly (Chrome DevTools > Application > Manifest)
- [ ] App is installable as PWA (install prompt appears)
- [ ] Icons display correctly in PWA mode
- [ ] Build succeeds with PWA plugin (`npm run build`)

**Commit Message**:
```
chore(mobile): configure Capacitor and PWA manifest

- Initialize Capacitor 6.x for future iOS/Android builds
- Add PWA manifest with app icons
- Configure @vite-pwa/sveltekit plugin
- Add PWA meta tags to app.html
- App installable as PWA in Chrome
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 2 for ticket #016 - Capacitor + PWA Configuration"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review capacitor.config.ts and manifest.json from ticket #016 Phase 2"
```

---

### Phase 3: Navigation Store + Tab Routes (3 points)

**Goal**: Create navigation state management and the three tab route pages with placeholder content.

**Steps**:
1. Create `src/lib/stores/navigation.ts` with tab state management
2. Create `src/lib/types/navigation.ts` with TypeScript types
3. Create `src/routes/+layout.svelte` with basic shell structure
4. Create `src/routes/+page.svelte` that redirects to /schedule
5. Create `src/routes/profile/+page.svelte` with placeholder
6. Create `src/routes/schedule/+page.svelte` with placeholder
7. Create `src/routes/live/+page.svelte` with placeholder
8. Style placeholders with Tailwind (centered text, distinct background colors)
9. Test route navigation works

**Files**:
- Create: `src/lib/stores/navigation.ts`
- Create: `src/lib/types/navigation.ts`
- Create: `src/routes/+layout.svelte`
- Create: `src/routes/+page.svelte`
- Create: `src/routes/profile/+page.svelte`
- Create: `src/routes/schedule/+page.svelte`
- Create: `src/routes/live/+page.svelte`

**Placeholder Content Example** (`src/routes/profile/+page.svelte`):
```svelte
<script lang="ts">
  // Profile tab placeholder
</script>

<div class="flex flex-col items-center justify-center h-full bg-slate-900">
  <div class="text-6xl mb-4">User Icon SVG</div>
  <h1 class="text-2xl font-bold text-white mb-2">Profile</h1>
  <p class="text-slate-400 text-center px-8">
    User stats, PRs, and workout history will appear here
  </p>
</div>
```

**Testing**:
- [ ] Navigating to `/profile` shows Profile placeholder
- [ ] Navigating to `/schedule` shows Schedule placeholder
- [ ] Navigating to `/live` shows Live placeholder
- [ ] Root `/` redirects to `/schedule`
- [ ] Navigation store updates correctly on route change
- [ ] No console errors on any route
- [ ] TypeScript compilation succeeds

**Commit Message**:
```
feat(ui): create navigation store and tab routes

- Add navigation store with tab state management
- Create TypeScript types for navigation
- Add root layout with shell structure
- Create Profile, Schedule, Live route pages
- Root path redirects to /schedule (default tab)
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 3 for ticket #016 - Navigation Store + Tab Routes"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write unit tests for navigation store from ticket #016"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review navigation.ts store and route pages from ticket #016 Phase 3"
```

---

### Phase 4: Bottom Tab Bar Component (3 points)

**Goal**: Create a polished bottom tab bar with icons, active state indication, and smooth transitions.

**Steps**:
1. Create `src/lib/components/BottomTabBar.svelte`
2. Design tab icons using inline SVG (user, calendar, play-circle)
3. Implement active tab highlighting with animated indicator
4. Add haptic feedback class for touch (visual feedback)
5. Integrate tab bar into +layout.svelte
6. Make tab bar fixed at bottom, always visible
7. Add safe area padding for iOS notch/home indicator
8. Style for both mobile and desktop (responsive sizing)
9. Implement click handlers that update navigation store and route

**Files**:
- Create: `src/lib/components/BottomTabBar.svelte`
- Modify: `src/routes/+layout.svelte` (integrate tab bar)

**BottomTabBar.svelte Structure**:
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { TABS, type TabConfig } from '$lib/types/navigation';
  import { navigateToTab } from '$lib/stores/navigation';

  function handleTabClick(tab: TabConfig) {
    navigateToTab(tab.id);
    goto(tab.path);
  }

  $: activeTab = $page.url.pathname;
</script>

<nav class="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 pb-safe">
  <div class="flex justify-around items-center h-16 max-w-md mx-auto">
    {#each TABS as tab}
      <button
        on:click={() => handleTabClick(tab)}
        class="flex flex-col items-center justify-center w-full h-full
               transition-colors duration-200
               {activeTab === tab.path ? 'text-indigo-400' : 'text-slate-500'}"
      >
        <!-- SVG Icon -->
        <svg class="w-6 h-6 mb-1">...</svg>
        <span class="text-xs font-medium">{tab.label}</span>

        <!-- Active indicator dot -->
        {#if activeTab === tab.path}
          <div class="absolute bottom-1 w-1 h-1 bg-indigo-400 rounded-full"></div>
        {/if}
      </button>
    {/each}
  </div>
</nav>
```

**Tailwind Safe Area Support** (add to app.css):
```css
@layer utilities {
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
}
```

**Testing**:
- [ ] Tab bar visible at bottom on all routes
- [ ] Clicking tabs navigates to correct route
- [ ] Active tab is visually highlighted (different color)
- [ ] Icons display correctly for each tab
- [ ] Tab bar respects safe area on iOS devices
- [ ] Tab bar is responsive (works on desktop and mobile widths)
- [ ] No layout shift when switching tabs
- [ ] Touch targets are minimum 44x44px (accessibility)

**Commit Message**:
```
feat(ui): add bottom tab bar navigation component

- Create BottomTabBar with Profile/Schedule/Live tabs
- Add SVG icons for each tab
- Implement active state highlighting
- Add iOS safe area padding support
- Integrate tab bar into root layout
- Responsive design for mobile and desktop
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 4 for ticket #016 - Bottom Tab Bar Component"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write component tests for BottomTabBar from ticket #016"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review BottomTabBar.svelte from ticket #016 Phase 4"
```

---

### Phase 5: Swipe Gestures + Slide Transitions (2 points)

**Goal**: Implement full swipe gesture navigation and smooth horizontal slide transitions between tabs.

**Steps**:
1. Create `src/lib/components/SwipeContainer.svelte` with touch event handling
2. Implement touch start/move/end handlers for horizontal swipe detection
3. Add velocity calculation for natural gesture feel
4. Create CSS transitions for slide animation (transform + opacity)
5. Integrate SwipeContainer into +layout.svelte wrapping tab content
6. Connect swipe events to navigation store (swipeLeft/swipeRight)
7. Add transition direction awareness (slide left vs right)
8. Test on mobile browsers (Safari, Chrome)
9. Add threshold for swipe activation (prevent accidental swipes)

**Files**:
- Create: `src/lib/components/SwipeContainer.svelte`
- Create: `src/lib/components/TabContent.svelte` (transition wrapper)
- Modify: `src/routes/+layout.svelte` (integrate swipe container)

**SwipeContainer.svelte Core Logic**:
```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { swipeLeft, swipeRight, navigationStore, TAB_ORDER, type TabId } from '$lib/stores/navigation';

  const SWIPE_THRESHOLD = 50;  // Minimum px to trigger swipe
  const VELOCITY_THRESHOLD = 0.3;  // Minimum velocity (px/ms)

  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let isDragging = false;
  let deltaX = 0;

  function handleTouchStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
    isDragging = true;
    deltaX = 0;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    deltaX = currentX - startX;
    const deltaY = currentY - startY;

    // If vertical scroll is dominant, cancel swipe
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      isDragging = false;
      return;
    }

    // Prevent default to avoid scrolling during horizontal swipe
    if (Math.abs(deltaX) > 10) {
      e.preventDefault();
    }
  }

  function handleTouchEnd(e: TouchEvent) {
    if (!isDragging) return;
    isDragging = false;

    const duration = Date.now() - startTime;
    const velocity = Math.abs(deltaX) / duration;

    // Check if swipe meets threshold
    if (Math.abs(deltaX) > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      if (deltaX > 0) {
        // Swipe right -> go to previous tab
        swipeRight();
        const currentIndex = TAB_ORDER.indexOf($navigationStore.activeTab);
        if (currentIndex > 0) {
          goto(getTabPath(TAB_ORDER[currentIndex - 1]));
        }
      } else {
        // Swipe left -> go to next tab
        swipeLeft();
        const currentIndex = TAB_ORDER.indexOf($navigationStore.activeTab);
        if (currentIndex < TAB_ORDER.length - 1) {
          goto(getTabPath(TAB_ORDER[currentIndex + 1]));
        }
      }
    }

    deltaX = 0;
  }

  function getTabPath(tabId: TabId): string {
    const paths: Record<TabId, string> = {
      profile: '/profile',
      schedule: '/schedule',
      live: '/live'
    };
    return paths[tabId];
  }
</script>

<div
  class="flex-1 overflow-hidden touch-pan-y"
  on:touchstart={handleTouchStart}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
>
  <slot />
</div>
```

**Slide Transition CSS** (add to app.css):
```css
/* Slide transitions */
.slide-left-enter {
  transform: translateX(100%);
  opacity: 0;
}
.slide-left-enter-active {
  transform: translateX(0);
  opacity: 1;
  transition: transform 300ms ease-out, opacity 300ms ease-out;
}
.slide-right-enter {
  transform: translateX(-100%);
  opacity: 0;
}
.slide-right-enter-active {
  transform: translateX(0);
  opacity: 1;
  transition: transform 300ms ease-out, opacity 300ms ease-out;
}
```

**Testing**:
- [ ] Swipe right on Profile tab does nothing (already at start)
- [ ] Swipe left on Profile tab navigates to Schedule
- [ ] Swipe left on Schedule tab navigates to Live
- [ ] Swipe right on Live tab navigates to Schedule
- [ ] Swipe left on Live tab does nothing (already at end)
- [ ] Vertical scrolling still works (swipe detection ignores vertical)
- [ ] Fast flick gesture triggers navigation (velocity threshold)
- [ ] Slow drag requires more distance (distance threshold)
- [ ] Slide animation direction matches swipe direction
- [ ] Transitions feel smooth (60fps, no jank)
- [ ] Works on mobile Safari
- [ ] Works on mobile Chrome
- [ ] No interference with tab content interactions (buttons, links)

**Commit Message**:
```
feat(ui): add swipe gesture navigation and transitions

- Create SwipeContainer with touch event handling
- Implement velocity-based swipe detection
- Add horizontal slide transitions between tabs
- Direction-aware animations (left vs right)
- Prevent vertical scroll interference
- Tested on mobile Safari and Chrome
```

**Agent Invocations**:
```bash
# Use shredly-code-writer for implementation
# Invoke: shredly-code-writer agent with "Implement Phase 5 for ticket #016 - Swipe Gestures + Slide Transitions"

# Use test-writer for test creation
# Invoke: test-writer agent with "Write tests for SwipeContainer gestures from ticket #016"

# Use code-quality-assessor after implementation
# Invoke: code-quality-assessor agent with "Review SwipeContainer.svelte and transitions from ticket #016 Phase 5"
```

---

## Testing Strategy

### Unit Tests (Vitest)

- [ ] Test navigation store state management in `tests/unit/navigation-store.test.ts`
  - `navigateToTab()` updates activeTab correctly
  - `swipeLeft()` moves to next tab (or stays if at end)
  - `swipeRight()` moves to previous tab (or stays if at start)
  - `transitionDirection` is set correctly based on tab order
- [ ] Test swipe threshold calculations in `tests/unit/swipe-utils.test.ts`
  - Distance threshold detection
  - Velocity threshold detection
  - Horizontal vs vertical movement detection

### Component Tests (Vitest + Testing Library)

- [ ] Test BottomTabBar in `tests/unit/components/BottomTabBar.test.ts`
  - Renders three tabs
  - Active tab has correct styling
  - Click events call navigation functions
- [ ] Test SwipeContainer in `tests/unit/components/SwipeContainer.test.ts`
  - Touch events are captured
  - Swipe threshold is respected
  - Navigation functions are called on valid swipe

### Integration Tests

- [ ] Test full navigation flow in `tests/integration/navigation.test.ts`
  - Tab click navigates and updates URL
  - Swipe gesture navigates and updates URL
  - Browser back/forward works correctly
  - Deep linking to tabs works

### Manual Testing

**Desktop Browser**:
1. Open `http://localhost:5173`
2. Verify redirect to `/schedule`
3. Click Profile tab - verify URL changes to `/profile`
4. Click Live tab - verify URL changes to `/live`
5. Verify active tab indicator updates correctly
6. Test browser back/forward buttons

**Mobile Browser (Required)**:
1. Open dev server on mobile device (or use Chrome DevTools device mode)
2. Test swipe left from Profile -> Schedule -> Live
3. Test swipe right from Live -> Schedule -> Profile
4. Verify swipe at edges does nothing (no error)
5. Test vertical scrolling is not blocked
6. Verify slide animations are smooth (no jank)
7. Test on iOS Safari
8. Test on Android Chrome

**PWA Testing**:
1. Open Chrome DevTools > Application > Manifest
2. Verify manifest loads correctly
3. Click "Install" and verify PWA installs
4. Open installed PWA and verify navigation works
5. Test on iOS (Add to Home Screen)

### Test Acceptance Criteria

- [ ] All unit tests pass (`npm run test:unit`)
- [ ] All integration tests pass (`npm run test:integration`)
- [ ] All tests pass together (`npm test`)
- [ ] TypeScript compilation succeeds (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] CLI still works (`npm run cli`)
- [ ] Manual testing checklist complete

---

## Success Criteria

- [ ] SvelteKit dev server runs with `npm run dev`
- [ ] Existing CLI scripts still work (`npm run cli`, `npm run cli:interactive`)
- [ ] Bottom tabs show Profile, Schedule, Live with icons
- [ ] Swiping left/right switches tabs with smooth horizontal slide animation
- [ ] Tapping tabs also works (click navigation)
- [ ] Active tab is visually indicated (highlighted color, indicator dot)
- [ ] Tab transitions feel native (300ms ease-out, no jank)
- [ ] Works smoothly on mobile Safari (iOS 14+)
- [ ] Works smoothly on mobile Chrome (Android 10+)
- [ ] PWA manifest configured and app installable
- [ ] Capacitor initialized for future native builds
- [ ] Safe area padding works on iOS devices with notch
- [ ] Code follows CLAUDE.md standards
- [ ] TypeScript types are properly defined
- [ ] Tests provide coverage of navigation logic
- [ ] Build output is production-ready

---

## Dependencies

### Blocked By
- None (this is the first frontend ticket)

### Blocks
- All future UI tickets (questionnaire form, workout display, profile page, etc.)
- Ticket #017 (if created): Questionnaire Flow UI
- Any ticket requiring SvelteKit routes

### External Dependencies
- @sveltejs/kit ^2.x
- @sveltejs/adapter-static ^3.x
- svelte ^5.x
- tailwindcss ^3.x
- @capacitor/core ^6.x
- @capacitor/cli ^6.x
- @vite-pwa/sveltekit ^0.x

---

## Risks & Mitigations

### Risk 1: SvelteKit Installation Conflicts with Existing Config
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**:
  - Carefully preserve existing `package.json` scripts
  - Test `npm run cli` after every phase
  - Keep Vitest configuration compatible with SvelteKit
  - Use separate tsconfig paths for CLI vs frontend if needed

### Risk 2: Swipe Gestures Conflict with Content Scrolling
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**:
  - Implement horizontal vs vertical movement detection
  - Only trigger swipe when horizontal movement dominates
  - Use `touch-pan-y` CSS to allow vertical scrolling
  - Test thoroughly on real mobile devices

### Risk 3: PWA Service Worker Caching Issues
- **Impact**: Low
- **Probability**: Medium
- **Mitigation**:
  - Start with minimal service worker (no aggressive caching)
  - Add cache busting for development
  - Document how to clear PWA cache during development

### Risk 4: iOS Safari Swipe Gesture Conflicts
- **Impact**: Medium
- **Probability**: Medium
- **Mitigation**:
  - iOS Safari has native swipe-back gesture on left edge
  - Keep swipe zone away from left 20px edge
  - Test extensively on iOS Safari
  - Consider adding edge exclusion zones if needed

### Risk 5: Svelte 5 vs Svelte 4 API Differences
- **Impact**: Medium
- **Probability**: Low
- **Mitigation**:
  - Use Svelte 5 runes syntax if available
  - Fall back to Svelte 4 syntax if issues arise
  - Document which Svelte version is used

---

## Notes

### Design Decisions

1. **Default Tab**: Schedule tab is the default because it's the central hub for viewing workouts. Users returning to the app most often want to see their current program.

2. **Tab Order**: Profile | Schedule | Live - This follows a logical flow from setup (profile) to planning (schedule) to execution (live).

3. **Swipe Direction**: Swipe left = move right in tab order (next), Swipe right = move left in tab order (previous). This matches iOS/Android native conventions.

4. **Transition Duration**: 300ms is the sweet spot for feeling responsive but smooth. Faster feels jarring, slower feels sluggish.

5. **Bottom Tab Bar vs Sidebar**: Bottom tabs chosen for thumb-friendly mobile UX. Sidebar would require top-of-screen or awkward reaching on mobile.

6. **No Hamburger Menu**: Three tabs are few enough to always show. Hamburger menus hide navigation and increase friction.

### Future Considerations

- **Haptic Feedback**: When Capacitor native builds are added, consider adding haptic feedback on tab changes.
- **Tab Badges**: Schedule tab could show badge with number of workouts this week.
- **Animation Polish**: Could add parallax effect where content slightly shifts before transition completes.
- **Gesture Indicator**: Could add subtle visual feedback during swipe drag (e.g., next tab peeking in).

### Color Scheme Reference

Using Tailwind's slate and indigo palette:
- Background: `slate-900` (#0f172a)
- Tab bar: `slate-900` with `slate-700` border
- Inactive tab: `slate-500` (#64748b)
- Active tab: `indigo-400` (#818cf8)
- Text: `white` for primary, `slate-400` for secondary

---

## Commit Standards Reminder

**MANDATORY**: Follow CLAUDE.md commit message standards:
- Format: `type(scope): description under 50 chars`
- Types: feat, fix, docs, style, refactor, test, chore
- Scopes: ui, mobile, navigation
- **NEVER include "Generated with Claude Code" or "Co-Authored-By: Claude"**

---

## Definition of Done

- [ ] All 5 phases implemented and tested
- [ ] All tests passing
- [ ] TypeScript compilation succeeds
- [ ] Code reviewed (by code-quality-assessor agent)
- [ ] Success criteria met
- [ ] Manual testing on mobile devices completed
- [ ] Committed with proper commit messages
- [ ] CLAUDE.md "Current Development Status" updated to reflect Phase 2 started
