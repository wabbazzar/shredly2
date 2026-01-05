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

type BrowserMode = 'normal' | 'search' | 'filter-category' | 'filter-muscle' | 'filter-equipment';

interface BrowserState {
  filters: FilterState;
  selectedIndex: number; // index in filtered exercise list
  filterSectionExpanded: boolean;
  mode: BrowserMode;
  inputBuffer: string;
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
 * Render filter section showing active filters
 */
function renderFilters(filters: FilterState, terminalWidth: number): string {
  const lines: string[] = [];

  lines.push(chalk.cyan('=== ACTIVE FILTERS ==='));
  lines.push('');

  const activeFilters: string[] = [];

  // Show active categories
  if (filters.categories.size > 0) {
    const cats = Array.from(filters.categories).join(', ');
    activeFilters.push(chalk.yellow('Categories: ') + chalk.green(cats));
  }

  // Show active muscle groups
  if (filters.muscleGroups.size > 0) {
    const muscles = Array.from(filters.muscleGroups).join(', ');
    activeFilters.push(chalk.yellow('Muscles: ') + chalk.green(muscles));
  }

  // Show active equipment
  if (filters.equipment.size > 0) {
    const equip = Array.from(filters.equipment).join(', ');
    activeFilters.push(chalk.yellow('Equipment: ') + chalk.green(equip));
  }

  if (activeFilters.length === 0) {
    lines.push(chalk.gray('No active filters'));
  } else {
    lines.push(activeFilters.join('\n'));
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Render mode indicator and input buffer
 */
function renderModeIndicator(state: BrowserState): string {
  const lines: string[] = [];

  if (state.mode === 'search') {
    lines.push(chalk.cyan('SEARCH MODE: ') + chalk.yellow(`/${state.inputBuffer}`));
    lines.push(chalk.gray('Type to filter exercises, Enter to exit search mode'));
  } else if (state.mode === 'filter-category') {
    lines.push(chalk.cyan('FILTER CATEGORIES: ') + chalk.yellow(`c/${state.inputBuffer}`));
    lines.push(chalk.gray('Type to find categories, Space to toggle, Enter to finish'));
  } else if (state.mode === 'filter-muscle') {
    lines.push(chalk.cyan('FILTER MUSCLES: ') + chalk.yellow(`m/${state.inputBuffer}`));
    lines.push(chalk.gray('Type to find muscles, Space to toggle, Enter to finish'));
  } else if (state.mode === 'filter-equipment') {
    lines.push(chalk.cyan('FILTER EQUIPMENT: ') + chalk.yellow(`e/${state.inputBuffer}`));
    lines.push(chalk.gray('Type to find equipment, Space to toggle, Enter to finish'));
  } else {
    lines.push(chalk.gray('/ search | c filter categories | m filter muscles | e filter equipment | r reset'));
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Get matching options for filter selection based on input buffer
 */
function getMatchingOptions(options: string[], inputBuffer: string): string[] {
  if (!inputBuffer) return options;
  const lower = inputBuffer.toLowerCase();
  return options.filter(opt => opt.toLowerCase().includes(lower));
}

/**
 * Render filter selection list (for c, m, e modes)
 */
function renderFilterSelection(
  options: string[],
  activeFilters: Set<string>,
  inputBuffer: string,
  selectedIndex: number
): string {
  const lines: string[] = [];
  const matching = getMatchingOptions(options, inputBuffer);

  if (matching.length === 0) {
    lines.push(chalk.gray('No matches found'));
    return lines.join('\n');
  }

  const visibleStart = Math.max(0, selectedIndex - 5);
  const visibleEnd = Math.min(matching.length, visibleStart + 10);

  for (let i = visibleStart; i < visibleEnd; i++) {
    const opt = matching[i];
    const isActive = activeFilters.has(opt);
    const isSelected = i === selectedIndex;
    const checkbox = isActive ? chalk.green('[x]') : '[ ]';
    const prefix = isSelected ? chalk.green('> ') : '  ';
    const text = isSelected ? chalk.bold(opt) : opt;
    lines.push(`${prefix}${checkbox} ${text}`);
  }

  if (visibleStart > 0) {
    lines.unshift(chalk.gray(`  ... ${visibleStart} more above`));
  }
  if (visibleEnd < matching.length) {
    lines.push(chalk.gray(`  ... ${matching.length - visibleEnd} more below`));
  }

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
    mode: 'normal',
    inputBuffer: ''
  };

  // Get terminal size
  const terminalWidth = process.stdout.columns || 80;
  const terminalHeight = process.stdout.rows || 24;

  // Setup readline for keyboard input
  // Note: emitKeypressEvents can be called multiple times safely
  readline.emitKeypressEvents(process.stdin);
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }

  // Small delay to let any buffered keypresses clear
  await new Promise(res => setTimeout(res, 50));

  return new Promise((resolve) => {
    const render = () => {
      console.clear();

      // Show mode indicator
      console.log(renderModeIndicator(state));

      if (state.mode === 'filter-category') {
        // Show category selection list
        console.log(renderFilterSelection(filterOptions.categories, state.filters.categories, state.inputBuffer, state.selectedIndex));
      } else if (state.mode === 'filter-muscle') {
        // Show muscle group selection list
        console.log(renderFilterSelection(filterOptions.muscleGroups, state.filters.muscleGroups, state.inputBuffer, state.selectedIndex));
      } else if (state.mode === 'filter-equipment') {
        // Show equipment selection list
        console.log(renderFilterSelection(filterOptions.equipment, state.filters.equipment, state.inputBuffer, state.selectedIndex));
      } else {
        // Normal or search mode - show filters and exercises
        const searchQuery = state.mode === 'search' ? state.inputBuffer : '';
        const filteredExercises = filterExercises(allExercises, state.filters, searchQuery);

        if (state.filterSectionExpanded) {
          console.log(renderFilters(state.filters, terminalWidth));
          console.log('');
        }

        console.log(renderExerciseList(filteredExercises, state.selectedIndex, terminalHeight, state.filterSectionExpanded));
        console.log('');
        console.log(chalk.gray('↑↓: Navigate | Enter: Select | Esc/Q: Cancel'));
      }
    };

    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.removeListener('keypress', onKeypress);
    };

    const onKeypress = (str: string, key: any) => {
      if (!key) return;

      // Ctrl+C - always exit
      if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit(0);
      }

      // Handle different modes
      if (state.mode === 'normal') {
        handleNormalMode(str, key);
      } else if (state.mode === 'search') {
        handleSearchMode(str, key);
      } else if (state.mode === 'filter-category' || state.mode === 'filter-muscle' || state.mode === 'filter-equipment') {
        handleFilterMode(str, key);
      }
    };

    const handleNormalMode = (str: string, key: any) => {
      const filteredExercises = filterExercises(allExercises, state.filters, '');

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
      else if (key.name === 'escape' || str === 'q' || str === 'Q') {
        cleanup();
        resolve({ selected: false });
      }

      // Enter search mode
      else if (str === '/') {
        state.mode = 'search';
        state.inputBuffer = '';
        state.selectedIndex = 0;
        render();
      }

      // Enter filter modes
      else if (str === 'c') {
        state.mode = 'filter-category';
        state.inputBuffer = '';
        state.selectedIndex = 0;
        render();
      } else if (str === 'm') {
        state.mode = 'filter-muscle';
        state.inputBuffer = '';
        state.selectedIndex = 0;
        render();
      } else if (str === 'e') {
        state.mode = 'filter-equipment';
        state.inputBuffer = '';
        state.selectedIndex = 0;
        render();
      }

      // Reset all filters
      else if (str === 'r' || str === 'R') {
        state.filters.categories.clear();
        state.filters.muscleGroups.clear();
        state.filters.equipment.clear();
        state.filters.difficulty.clear();
        state.selectedIndex = 0;
        render();
      }
    };

    const handleSearchMode = (str: string, key: any) => {
      const filteredExercises = filterExercises(allExercises, state.filters, state.inputBuffer);

      // Exit search mode
      if (key.name === 'escape' || key.name === 'return') {
        state.mode = 'normal';
        render();
      }

      // Backspace
      else if (key.name === 'backspace') {
        state.inputBuffer = state.inputBuffer.slice(0, -1);
        state.selectedIndex = 0;
        render();
      }

      // Navigation
      else if (key.name === 'up') {
        state.selectedIndex = Math.max(0, state.selectedIndex - 1);
        render();
      } else if (key.name === 'down') {
        state.selectedIndex = Math.min(filteredExercises.length - 1, state.selectedIndex + 1);
        render();
      }

      // Character input
      else if (str && str.length === 1 && !key.ctrl && !key.meta) {
        state.inputBuffer += str;
        state.selectedIndex = 0;
        render();
      }
    };

    const handleFilterMode = (str: string, key: any) => {
      let options: string[] = [];
      let activeFilters: Set<string>;

      if (state.mode === 'filter-category') {
        options = filterOptions.categories;
        activeFilters = state.filters.categories;
      } else if (state.mode === 'filter-muscle') {
        options = filterOptions.muscleGroups;
        activeFilters = state.filters.muscleGroups;
      } else {
        options = filterOptions.equipment;
        activeFilters = state.filters.equipment;
      }

      const matching = getMatchingOptions(options, state.inputBuffer);

      // Exit filter mode
      if (key.name === 'escape' || key.name === 'return') {
        state.mode = 'normal';
        state.selectedIndex = 0;
        render();
      }

      // Backspace
      else if (key.name === 'backspace') {
        state.inputBuffer = state.inputBuffer.slice(0, -1);
        state.selectedIndex = 0;
        render();
      }

      // Navigation
      else if (key.name === 'up') {
        state.selectedIndex = Math.max(0, state.selectedIndex - 1);
        render();
      } else if (key.name === 'down') {
        state.selectedIndex = Math.min(matching.length - 1, state.selectedIndex + 1);
        render();
      }

      // Toggle selection with space
      else if (key.name === 'space') {
        if (matching.length > 0) {
          const selected = matching[state.selectedIndex];
          if (activeFilters.has(selected)) {
            activeFilters.delete(selected);
          } else {
            activeFilters.add(selected);
          }
          render();
        }
      }

      // Character input
      else if (str && str.length === 1 && !key.ctrl && !key.meta && str !== ' ') {
        state.inputBuffer += str;
        state.selectedIndex = 0;
        render();
      }
    };

    process.stdin.on('keypress', onKeypress);

    // Initial render
    render();
  });
}
