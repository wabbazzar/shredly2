/**
 * Exercise Database Browser - CLI Interactive UI
 *
 * Live filtering interface for browsing and selecting exercises from database
 * Features:
 * - Checkbox-based category/muscle/equipment filters
 * - Real-time filtered exercise list
 * - Terminal-responsive layout (stacked: filters on top, exercises below)
 */

import * as readline from 'readline';
import chalk from 'chalk';
import exerciseDatabase from '../../src/data/exercise_database.json' with { type: 'json' };

interface ExerciseData {
  name: string;
  category: string;
  muscle_groups: string[];
  equipment: string[];
  difficulty: string;
  external_load: string;
}

interface FilterState {
  categories: Set<string>;
  muscleGroups: Set<string>;
  equipment: Set<string>;
  difficulty: Set<string>;
}

interface BrowserState {
  filters: FilterState;
  selectedIndex: number; // index in filtered exercise list
  filterSectionExpanded: boolean;
  searchQuery: string;
}

export interface BrowserResult {
  selected: boolean;
  exerciseName?: string;
}

/**
 * Extract all exercises from database as flat list
 */
function getAllExercises(): ExerciseData[] {
  const exercises: ExerciseData[] = [];
  const categories = exerciseDatabase.exercise_database.categories as Record<string, { exercises: Record<string, any> }>;

  for (const categoryKey in categories) {
    const exercisesInCategory = categories[categoryKey].exercises;
    for (const exerciseName in exercisesInCategory) {
      const exData = exercisesInCategory[exerciseName];
      exercises.push({
        name: exerciseName,
        category: categoryKey,
        muscle_groups: Array.isArray(exData.muscle_groups) ? exData.muscle_groups : [],
        equipment: Array.isArray(exData.equipment) ? exData.equipment : [exData.equipment].filter(Boolean),
        difficulty: exData.difficulty || 'Unknown',
        external_load: exData.external_load || 'unknown'
      });
    }
  }

  return exercises.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get unique values for each filter dimension
 */
function getFilterOptions(allExercises: ExerciseData[]): {
  categories: string[];
  muscleGroups: string[];
  equipment: string[];
  difficulty: string[];
} {
  const categories = new Set<string>();
  const muscleGroups = new Set<string>();
  const equipment = new Set<string>();
  const difficulty = new Set<string>();

  for (const ex of allExercises) {
    categories.add(ex.category);
    ex.muscle_groups.forEach(mg => muscleGroups.add(mg));
    ex.equipment.forEach(eq => equipment.add(eq));
    difficulty.add(ex.difficulty);
  }

  return {
    categories: Array.from(categories).sort(),
    muscleGroups: Array.from(muscleGroups).sort(),
    equipment: Array.from(equipment).sort(),
    difficulty: Array.from(difficulty).sort()
  };
}

/**
 * Filter exercises based on active filters
 */
function filterExercises(allExercises: ExerciseData[], filters: FilterState, searchQuery: string): ExerciseData[] {
  return allExercises.filter(ex => {
    // Search query filter
    if (searchQuery && !ex.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Category filter
    if (filters.categories.size > 0 && !filters.categories.has(ex.category)) {
      return false;
    }

    // Muscle group filter (any match)
    if (filters.muscleGroups.size > 0) {
      const hasMatch = ex.muscle_groups.some(mg => filters.muscleGroups.has(mg));
      if (!hasMatch) return false;
    }

    // Equipment filter (any match)
    if (filters.equipment.size > 0) {
      const hasMatch = ex.equipment.some(eq => filters.equipment.has(eq));
      if (!hasMatch) return false;
    }

    // Difficulty filter
    if (filters.difficulty.size > 0 && !filters.difficulty.has(ex.difficulty)) {
      return false;
    }

    return true;
  });
}

/**
 * Render filter section with checkboxes
 */
function renderFilters(filters: FilterState, filterOptions: ReturnType<typeof getFilterOptions>, terminalWidth: number): string {
  const lines: string[] = [];
  const narrow = terminalWidth < 80;

  lines.push(chalk.cyan('=== EXERCISE FILTERS ==='));
  lines.push('');

  // Categories
  lines.push(chalk.yellow('[C]ategories:'));
  const catItems = filterOptions.categories.map(cat => {
    const checked = filters.categories.has(cat);
    return `${checked ? chalk.green('[x]') : '[ ]'} ${cat}`;
  });
  lines.push(narrow ? catItems.join('\n') : catItems.join('  '));
  lines.push('');

  // Muscle Groups
  lines.push(chalk.yellow('[M]uscle Groups:'));
  const mgItems = filterOptions.muscleGroups.map(mg => {
    const checked = filters.muscleGroups.has(mg);
    return `${checked ? chalk.green('[x]') : '[ ]'} ${mg}`;
  });
  if (narrow) {
    lines.push(mgItems.join('\n'));
  } else {
    // Split into chunks of 4 for wide screens
    for (let i = 0; i < mgItems.length; i += 4) {
      lines.push(mgItems.slice(i, i + 4).join('  '));
    }
  }
  lines.push('');

  // Equipment
  lines.push(chalk.yellow('[E]quipment:'));
  const eqItems = filterOptions.equipment.map(eq => {
    const checked = filters.equipment.has(eq);
    return `${checked ? chalk.green('[x]') : '[ ]'} ${eq}`;
  });
  if (narrow) {
    lines.push(eqItems.join('\n'));
  } else {
    for (let i = 0; i < eqItems.length; i += 3) {
      lines.push(eqItems.slice(i, i + 3).join('  '));
    }
  }
  lines.push('');

  lines.push(chalk.gray('Press C/M/E to toggle filter groups | [R]eset all | [/] to search'));

  return lines.join('\n');
}

/**
 * Render exercise list
 */
function renderExerciseList(
  exercises: ExerciseData[],
  selectedIndex: number,
  terminalHeight: number,
  showFilters: boolean
): string {
  const lines: string[] = [];

  lines.push(chalk.cyan(`=== EXERCISES (${exercises.length}) ===`));

  if (exercises.length === 0) {
    lines.push('');
    lines.push(chalk.gray('No exercises match current filters'));
    return lines.join('\n');
  }

  // Calculate available height for exercise list
  const headerLines = 1;
  const filterLines = showFilters ? 20 : 0; // approximate
  const statusLines = 2;
  const availableLines = Math.max(5, terminalHeight - headerLines - filterLines - statusLines);

  // Calculate visible range (scrolling)
  const visibleStart = Math.max(0, selectedIndex - Math.floor(availableLines / 2));
  const visibleEnd = Math.min(exercises.length, visibleStart + availableLines);

  for (let i = visibleStart; i < visibleEnd; i++) {
    const ex = exercises[i];
    const isSelected = i === selectedIndex;
    const prefix = isSelected ? chalk.green('> ') : '  ';
    const name = isSelected ? chalk.bold(ex.name) : ex.name;
    const category = chalk.gray(`[${ex.category}]`);
    const muscles = chalk.gray(ex.muscle_groups.slice(0, 2).join(', '));

    lines.push(`${prefix}${name} ${category} ${muscles}`);
  }

  if (visibleStart > 0) {
    lines.unshift(chalk.gray(`  ... ${visibleStart} more above`));
  }
  if (visibleEnd < exercises.length) {
    lines.push(chalk.gray(`  ... ${exercises.length - visibleEnd} more below`));
  }

  return lines.join('\n');
}

/**
 * Main browser entry point - returns selected exercise or null
 */
export async function browseExerciseDatabase(): Promise<BrowserResult> {
  const allExercises = getAllExercises();
  const filterOptions = getFilterOptions(allExercises);

  const state: BrowserState = {
    filters: {
      categories: new Set(),
      muscleGroups: new Set(),
      equipment: new Set(),
      difficulty: new Set()
    },
    selectedIndex: 0,
    filterSectionExpanded: true,
    searchQuery: ''
  };

  // Get terminal size
  const terminalWidth = process.stdout.columns || 80;
  const terminalHeight = process.stdout.rows || 24;

  // Setup readline for keyboard input
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  return new Promise((resolve) => {
    const render = () => {
      const filteredExercises = filterExercises(allExercises, state.filters, state.searchQuery);

      // Clear screen and render
      console.clear();

      if (state.filterSectionExpanded) {
        console.log(renderFilters(state.filters, filterOptions, terminalWidth));
        console.log('');
      }

      console.log(renderExerciseList(filteredExercises, state.selectedIndex, terminalHeight, state.filterSectionExpanded));
      console.log('');
      console.log(chalk.gray('↑↓: Navigate | Enter: Select | Esc/Q: Cancel | C/M/E: Toggle filters | R: Reset'));
    };

    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.removeListener('keypress', onKeypress);
    };

    const onKeypress = (str: string, key: any) => {
      if (!key) return;

      const filteredExercises = filterExercises(allExercises, state.filters, state.searchQuery);

      // Navigation
      if (key.name === 'up') {
        state.selectedIndex = Math.max(0, state.selectedIndex - 1);
        render();
      } else if (key.name === 'down') {
        state.selectedIndex = Math.min(filteredExercises.length - 1, state.selectedIndex + 1);
        render();
      } else if (key.name === 'pageup') {
        state.selectedIndex = Math.max(0, state.selectedIndex - 10);
        render();
      } else if (key.name === 'pagedown') {
        state.selectedIndex = Math.min(filteredExercises.length - 1, state.selectedIndex + 10);
        render();
      }

      // Selection
      else if (key.name === 'return') {
        cleanup();
        if (filteredExercises.length > 0) {
          resolve({ selected: true, exerciseName: filteredExercises[state.selectedIndex].name });
        } else {
          resolve({ selected: false });
        }
      }

      // Cancel
      else if (key.name === 'escape' || key.name === 'q') {
        cleanup();
        resolve({ selected: false });
      }

      // Filter toggles (simplified - just reset for now, can be enhanced)
      else if (str === 'c' || str === 'C') {
        // Toggle category filter section (for simplicity, just reset)
        state.filters.categories.clear();
        state.selectedIndex = 0;
        render();
      } else if (str === 'm' || str === 'M') {
        state.filters.muscleGroups.clear();
        state.selectedIndex = 0;
        render();
      } else if (str === 'e' || str === 'E') {
        state.filters.equipment.clear();
        state.selectedIndex = 0;
        render();
      } else if (str === 'r' || str === 'R') {
        // Reset all filters
        state.filters.categories.clear();
        state.filters.muscleGroups.clear();
        state.filters.equipment.clear();
        state.filters.difficulty.clear();
        state.searchQuery = '';
        state.selectedIndex = 0;
        render();
      }

      // Ctrl+C
      else if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit(0);
      }
    };

    process.stdin.on('keypress', onKeypress);

    // Initial render
    render();
  });
}
