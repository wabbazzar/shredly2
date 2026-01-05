/**
 * CLI Workout Display Formatter
 *
 * Formats ParameterizedWorkout objects for human-readable terminal display
 * Used by cli/interactive-questionnaire.ts after workout generation
 */

import chalk from 'chalk';
import type { ParameterizedWorkout, ParameterizedDay, ParameterizedExercise, WeekParameters, WeightSpecification } from '../../src/lib/engine/types.js';
import exerciseDatabase from '../../src/data/exercise_database.json' with { type: 'json' };
import workoutGenerationRules from '../../src/data/workout_generation_rules.json' with { type: 'json' };

function getExerciseCategory(exerciseName: string): string | null {
  const categories = exerciseDatabase.exercise_database.categories as Record<string, { exercises: Record<string, any> }>;
  for (const categoryKey in categories) {
    if (categories[categoryKey].exercises[exerciseName]) {
      return categoryKey;
    }
  }
  return null;
}

function formatWeight(weight?: WeightSpecification): string {
  if (!weight) return '';
  if (typeof weight === 'string') return weight;
  if (weight.type === 'percent_tm') return `${weight.value}% TM`;
  if (weight.type === 'percent_bw') return `${weight.value}% BW`;
  if (weight.type === 'absolute') return `${weight.value} ${weight.unit}`;
  return '';
}

/**
 * Format entire workout for terminal display
 */
export function formatWorkoutForTerminal(workout: ParameterizedWorkout): string {
  const lines = [];
  lines.push(formatProgramOverview(workout));
  lines.push('');
  for (const dayKey in workout.days) {
    lines.push(formatDay(workout.days[dayKey], workout.weeks));
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Format program overview (metadata)
 */
export function formatProgramOverview(workout: ParameterizedWorkout): string {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push('WORKOUT PROGRAM GENERATED');
  lines.push('='.repeat(60));
  lines.push(`Program: ${workout.name}`);
  lines.push(`Description: ${workout.description}`);
  lines.push(`Version: ${workout.version}`);
  lines.push(`Weeks: ${workout.weeks}`);
  lines.push(`Days per Week: ${workout.daysPerWeek}`);
  lines.push(`Difficulty: ${workout.metadata.difficulty}`);
  lines.push(`Equipment: ${workout.metadata.equipment.join(', ')}`);
  lines.push(`Estimated Duration: ${workout.metadata.estimatedDuration} minutes`);
  lines.push('='.repeat(60));
  return lines.join('\n');
}

/**
 * Format a single day's workout
 */
export function formatDay(day: ParameterizedDay, weekCount: number): string {
  const lines = [];
  lines.push(`DAY ${day.dayNumber}: ${day.focus} (${day.type})`);
  lines.push('-'.repeat(50));
  const featuredExercises = selectFeaturedExercises(day.exercises);
  for (let i = 0; i < day.exercises.length; i++) {
    const isFeatured = featuredExercises.has(i);
    lines.push(formatExercise(day.exercises[i], i + 1, weekCount, isFeatured));
  }
  return lines.join('\n');
}

/**
 * Format a single exercise (standalone or compound)
 */
export function formatExercise(
  exercise: ParameterizedExercise,
  exerciseNumber: number,
  weekCount: number,
  isFeatured: boolean
): string {
  const category = exercise.category || getExerciseCategory(exercise.name) || 'unknown';
  const badge = formatCategoryBadge(category);
  const lines = [];
  lines.push(`${exerciseNumber}. ${badge} ${exercise.name}`);
  if (isFeatured && (!exercise.sub_exercises || exercise.sub_exercises.length === 0)) {
    lines.push(formatWeekProgression(exercise.name, exercise as any, weekCount));
  }
  if (exercise.sub_exercises && exercise.sub_exercises.length > 0) {
    lines.push(formatSubExercises(exercise.sub_exercises, weekCount, category));
  }
  return lines.join('\n');
}

/**
 * Format sub-exercises for compound exercises (EMOM, Circuit, etc.)
 */
export function formatSubExercises(
  subExercises: ParameterizedExercise[],
  weekCount: number,
  parentCategory: string
): string {
  const lines = [];
  for (const sub of subExercises) {
    const progression = [];
    for (let w = 1; w <= weekCount; w++) {
      const params = (sub as any)[`week${w}`];
      if (params && params.reps) {
        progression.push(`Week ${w}: ${params.reps} reps`);
      }
    }
    lines.push(`  - ${sub.name}: ${progression.join(' | ')}`);
  }
  return lines.join('\n');
}

/**
 * Format week-by-week progression for a single exercise
 */
export function formatWeekProgression(
  exerciseName: string,
  weekParams: { [key: string]: WeekParameters },
  weekCount: number
): string {
  const lines = [];
  for (let w = 1; w <= weekCount; w++) {
    const params = weekParams[`week${w}`];
    if (!params) continue;
    const sets = params.sets;
    const reps = params.reps;
    const weight = formatWeight(params.weight);
    const rest = params.rest_time_minutes ? `${params.rest_time_minutes}s rest` : '';
    const work = params.work_time_minutes ? `${params.work_time_minutes}min work` : '';
    const parts = [];
    if (sets && reps) {
      parts.push(`${sets} sets x ${reps} reps`);
    } else if (work) {
      parts.push(work);
    }
    if (weight) parts.push(`@ ${weight}`);
    if (rest) parts.push(rest);
    if (parts.length > 0) {
      lines.push(`    Week ${w}: ${parts.join(', ')}`);
    }
  }
  return lines.join('\n');
}

/**
 * Format category badge for exercise (e.g., [WARMUP], [STRENGTH], [EMOM])
 */
export function formatCategoryBadge(category: string): string {
  const upperCategory = category.toUpperCase();
  if (category === 'warmup') {
    return chalk.yellow(`[${upperCategory}]`);
  } else if (category === 'strength') {
    return chalk.green(`[${upperCategory}]`);
  } else if (['emom', 'amrap', 'circuit', 'interval'].includes(category)) {
    return chalk.magenta(`[${upperCategory}]`);
  } else {
    return chalk.blue(`[${upperCategory}]`);
  }
}

/**
 * Determine which exercises should be "featured" (show full progression)
 * Strategy: First 2-3 exercises in main_strength_categories per day
 */
export function selectFeaturedExercises(exercises: ParameterizedExercise[]): Set<number> {
  const featured = new Set<number>();
  let count = 0;
  for (let i = 0; i < exercises.length; i++) {
    const category = getExerciseCategory(exercises[i].name);
    if (category && workoutGenerationRules.category_workout_structure.main_strength_categories.includes(category)) {
      featured.add(i);
      count++;
      if (count >= 3) break;
    }
  }
  return featured;
}

/**
 * INTERACTIVE DISPLAY FUNCTIONS
 * These functions support the interactive workout editor with editable field highlighting
 */

export interface HighlightOptions {
  selectedFieldLocation?: string; // e.g., "day1.exercises[0].name"
  showAllEditable?: boolean; // highlight all editable fields
}

/**
 * Wrap editable value with brackets and color highlighting
 */
function highlightEditableValue(value: string, isSelected: boolean): string {
  if (isSelected) {
    return chalk.cyan.bold(`<${value}>`);
  }
  return chalk.yellow(`<${value}>`);
}

/**
 * Format entire workout for interactive terminal display with editable field highlighting
 */
export function formatWorkoutInteractive(
  workout: ParameterizedWorkout,
  options: HighlightOptions = {}
): string {
  const lines = [];
  lines.push(formatProgramOverview(workout));
  lines.push('');
  for (const dayKey in workout.days) {
    lines.push(formatDayInteractive(workout.days[dayKey], dayKey, workout.weeks, options));
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Format a single day for interactive display (Week view: all days)
 */
export function formatDayInteractive(
  day: ParameterizedDay,
  dayKey: string,
  weekCount: number,
  options: HighlightOptions = {}
): string {
  const lines = [];
  lines.push(`DAY ${day.dayNumber}: ${day.focus} (${day.type})`);
  lines.push('-'.repeat(50));
  const featuredExercises = selectFeaturedExercises(day.exercises);
  for (let i = 0; i < day.exercises.length; i++) {
    const isFeatured = featuredExercises.has(i);
    lines.push(formatExerciseInteractive(day.exercises[i], dayKey, i, weekCount, isFeatured, options));
  }
  return lines.join('\n');
}

/**
 * Format a single exercise for interactive display with editable field highlighting
 */
export function formatExerciseInteractive(
  exercise: ParameterizedExercise,
  dayKey: string,
  exerciseIndex: number,
  weekCount: number,
  isFeatured: boolean,
  options: HighlightOptions = {}
): string {
  const category = exercise.category || getExerciseCategory(exercise.name) || 'unknown';
  const badge = formatCategoryBadge(category);
  const lines = [];

  const baseLocation = `${dayKey}.exercises[${exerciseIndex}]`;
  const nameLocation = `${baseLocation}.name`;
  const nameIsSelected = options.selectedFieldLocation === nameLocation;

  const exerciseName = (options.showAllEditable || nameIsSelected)
    ? highlightEditableValue(exercise.name, nameIsSelected)
    : exercise.name;

  lines.push(`${exerciseIndex + 1}. ${badge} ${exerciseName}`);

  if (isFeatured && (!exercise.sub_exercises || exercise.sub_exercises.length === 0)) {
    lines.push(formatWeekProgressionInteractive(exercise as any, weekCount, baseLocation, options));
  }

  if (exercise.sub_exercises && exercise.sub_exercises.length > 0) {
    lines.push(formatSubExercisesInteractive(exercise.sub_exercises, weekCount, baseLocation, options));
  }

  return lines.join('\n');
}

/**
 * Format week-by-week progression with editable field highlighting
 */
export function formatWeekProgressionInteractive(
  weekParams: { [key: string]: WeekParameters },
  weekCount: number,
  baseLocation: string,
  options: HighlightOptions = {}
): string {
  const lines = [];
  for (let w = 1; w <= weekCount; w++) {
    const weekKey = `week${w}`;
    const params = weekParams[weekKey];
    if (!params) continue;

    const setsLocation = `${baseLocation}.${weekKey}.sets`;
    const repsLocation = `${baseLocation}.${weekKey}.reps`;
    const weightLocation = `${baseLocation}.${weekKey}.weight`;
    const restLocation = `${baseLocation}.${weekKey}.rest_time_minutes`;
    const workLocation = `${baseLocation}.${weekKey}.work_time_minutes`;

    const setsIsSelected = options.selectedFieldLocation === setsLocation;
    const repsIsSelected = options.selectedFieldLocation === repsLocation;
    const weightIsSelected = options.selectedFieldLocation === weightLocation;
    const restIsSelected = options.selectedFieldLocation === restLocation;
    const workIsSelected = options.selectedFieldLocation === workLocation;

    const sets = params.sets !== undefined
      ? (options.showAllEditable || setsIsSelected ? highlightEditableValue(String(params.sets), setsIsSelected) : params.sets)
      : null;

    const reps = params.reps !== undefined
      ? (options.showAllEditable || repsIsSelected ? highlightEditableValue(String(params.reps), repsIsSelected) : params.reps)
      : null;

    const weight = params.weight !== undefined
      ? (options.showAllEditable || weightIsSelected
        ? highlightEditableValue(formatWeight(params.weight), weightIsSelected)
        : formatWeight(params.weight))
      : null;

    const rest = params.rest_time_minutes !== undefined
      ? (options.showAllEditable || restIsSelected
        ? highlightEditableValue(`${params.rest_time_minutes}s rest`, restIsSelected)
        : `${params.rest_time_minutes}s rest`)
      : null;

    const work = params.work_time_minutes !== undefined
      ? (options.showAllEditable || workIsSelected
        ? highlightEditableValue(`${params.work_time_minutes}min work`, workIsSelected)
        : `${params.work_time_minutes}min work`)
      : null;

    const parts = [];
    if (sets && reps) {
      parts.push(`${sets} sets x ${reps} reps`);
    } else if (work) {
      parts.push(work);
    }
    if (weight) parts.push(`@ ${weight}`);
    if (rest) parts.push(rest);

    if (parts.length > 0) {
      lines.push(`    Week ${w}: ${parts.join(', ')}`);
    }
  }
  return lines.join('\n');
}

/**
 * Format sub-exercises with editable field highlighting
 */
export function formatSubExercisesInteractive(
  subExercises: ParameterizedExercise[],
  weekCount: number,
  baseLocation: string,
  options: HighlightOptions = {}
): string {
  const lines = [];
  for (let subIndex = 0; subIndex < subExercises.length; subIndex++) {
    const sub = subExercises[subIndex];
    const subLocation = `${baseLocation}.sub_exercises[${subIndex}]`;
    const nameLocation = `${subLocation}.name`;
    const nameIsSelected = options.selectedFieldLocation === nameLocation;

    const subName = (options.showAllEditable || nameIsSelected)
      ? highlightEditableValue(sub.name, nameIsSelected)
      : sub.name;

    const progression = [];
    for (let w = 1; w <= weekCount; w++) {
      const weekKey = `week${w}`;
      const params = (sub as any)[weekKey];
      if (params && params.reps) {
        const repsLocation = `${subLocation}.${weekKey}.reps`;
        const repsIsSelected = options.selectedFieldLocation === repsLocation;
        const repsValue = (options.showAllEditable || repsIsSelected)
          ? highlightEditableValue(`${params.reps}`, repsIsSelected)
          : params.reps;
        progression.push(`Week ${w}: ${repsValue} reps`);
      }
    }
    lines.push(`  - ${subName}: ${progression.join(' | ')}`);
  }
  return lines.join('\n');
}

/**
 * Format single day view (for Day mode - one day at a time)
 * Shows all exercises in detail with editable field highlighting
 */
export function formatSingleDayView(
  day: ParameterizedDay,
  dayKey: string,
  weekCount: number,
  options: HighlightOptions = {}
): string {
  const lines = [];
  lines.push('='.repeat(60));
  lines.push(`DAY ${day.dayNumber}: ${day.focus} (${day.type})`);
  lines.push('='.repeat(60));
  lines.push('');

  for (let i = 0; i < day.exercises.length; i++) {
    lines.push(formatExerciseInteractive(day.exercises[i], dayKey, i, weekCount, true, options));
    lines.push('');
  }

  return lines.join('\n');
}