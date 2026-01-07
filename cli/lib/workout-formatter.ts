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
 * Determine work mode for an exercise based on parameters
 * Returns 'reps' if reps are defined, 'work_time' if work_time is defined
 */
function determineWorkMode(params?: WeekParameters): 'reps' | 'work_time' | 'none' {
  if (!params) return 'none';
  if (params.reps !== undefined) return 'reps';
  if (params.work_time_minutes !== undefined) return 'work_time';
  return 'none';
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
    // Show parent parameters (work time, rest time, etc.) for compound exercises
    const parentParams = formatCompoundParentParams(exercise as any, weekCount);
    if (parentParams) {
      lines.push(parentParams);
    }
    lines.push(formatSubExercises(exercise.sub_exercises, weekCount, category));
  }
  return lines.join('\n');
}

/**
 * Format parent exercise parameters for compound exercises (non-interactive)
 * Displays any week-level parameters at the parent level (work_time, rest_time, sets, etc.)
 */
function formatCompoundParentParams(
  exercise: { [key: string]: any },
  weekCount: number
): string | null {
  // Collect all parent-level week parameters across all weeks
  const paramFields = new Set<string>();

  for (let w = 1; w <= weekCount; w++) {
    const weekKey = `week${w}`;
    const params = exercise[weekKey];
    if (params) {
      // Collect parameter names (excluding internal fields and unit fields)
      Object.keys(params).forEach(key => {
        if (!key.startsWith('_') && !key.endsWith('_unit')) {
          paramFields.add(key);
        }
      });
    }
  }

  if (paramFields.size === 0) {
    return null;
  }

  const lines: string[] = [];

  // For each parameter type found, show progression across weeks
  paramFields.forEach(fieldName => {
    const progression: string[] = [];

    for (let w = 1; w <= weekCount; w++) {
      const weekKey = `week${w}`;
      const params = exercise[weekKey];

      if (params && params[fieldName] !== undefined) {
        let displayValue: string;

        // Format based on field type
        if (fieldName === 'weight') {
          displayValue = formatWeight(params[fieldName]);
        } else if (fieldName === 'rest_time_minutes') {
          const unit = params.rest_time_unit || 'seconds';
          displayValue = `${params[fieldName]} ${unit}`;
        } else if (fieldName === 'work_time_minutes') {
          const unit = params.work_time_unit || 'minutes';
          displayValue = `${params[fieldName]} ${unit}`;
        } else if (fieldName === 'sets') {
          displayValue = `${params[fieldName]} sets`;
        } else if (fieldName === 'reps') {
          displayValue = `${params[fieldName]} reps`;
        } else {
          // Default: just show the value
          displayValue = String(params[fieldName]);
        }

        progression.push(`Week ${w}: ${displayValue}`);
      }
    }

    if (progression.length > 0) {
      // Capitalize field name for display (but clean up the name)
      const displayName = fieldName
        .replace('_minutes', '')  // Remove _minutes suffix since we're showing units now
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      lines.push(`   ${displayName}: ${progression.join(' | ')}`);
    }
  });

  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * Format sub-exercises for compound exercises (EMOM, Circuit, etc.)
 * Data-driven: automatically displays all parameter fields present in the JSON
 */
export function formatSubExercises(
  subExercises: ParameterizedExercise[],
  weekCount: number,
  parentCategory: string
): string {
  const lines = [];
  for (const sub of subExercises) {
    // Collect all parameter fields that exist across all weeks for this sub-exercise
    const paramFields = new Set<string>();
    for (let w = 1; w <= weekCount; w++) {
      const weekKey = `week${w}`;
      const params = (sub as any)[weekKey];
      if (params) {
        Object.keys(params).forEach(key => {
          // Filter out unit fields - they'll be combined with their base fields
          if (!key.startsWith('_') && !key.endsWith('_unit')) {
            paramFields.add(key);
          }
        });
      }
    }

    lines.push(`  - ${sub.name}:`);

    // For each parameter type found, show progression across weeks
    paramFields.forEach(fieldName => {
      const progression: string[] = [];

      for (let w = 1; w <= weekCount; w++) {
        const weekKey = `week${w}`;
        const params = (sub as any)[weekKey];

        if (params && params[fieldName] !== undefined) {
          let displayValue: string;

          // Format based on field type
          if (fieldName === 'weight') {
            displayValue = formatWeight(params[fieldName]);
          } else if (fieldName === 'rest_time_minutes') {
            const unit = params.rest_time_unit || 'seconds';
            displayValue = `${params[fieldName]} ${unit}`;
          } else if (fieldName === 'work_time_minutes') {
            const unit = params.work_time_unit || 'minutes';
            displayValue = `${params[fieldName]} ${unit}`;
          } else if (fieldName === 'sets') {
            displayValue = `${params[fieldName]} sets`;
          } else if (fieldName === 'reps') {
            displayValue = `${params[fieldName]} reps`;
          } else if (fieldName === 'tempo') {
            displayValue = params[fieldName];
          } else {
            // Default: just show the value
            displayValue = String(params[fieldName]);
          }

          progression.push(`Week ${w}: ${displayValue}`);
        }
      }

      if (progression.length > 0) {
        // Capitalize field name for display (but clean up the name)
        let displayName = fieldName
          .replace('_minutes', '')  // Remove _minutes suffix since we're showing units now
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        lines.push(`     ${displayName}: ${progression.join(' | ')}`);
      }
    });
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
    const restUnit = params.rest_time_unit || 'seconds';
    const rest = params.rest_time_minutes ? `${params.rest_time_minutes} ${restUnit} rest` : '';
    const workUnit = params.work_time_unit || 'minutes';
    const work = params.work_time_minutes ? `${params.work_time_minutes} ${workUnit} work` : '';
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

    // Add <add exercise> marker after each exercise
    const insertLocation = `${dayKey}.exercises[${i}]._insert_after`;
    const isSelected = options.selectedFieldLocation === insertLocation;
    if (options.showAllEditable || isSelected) {
      const marker = isSelected
        ? chalk.cyan.bold('<add exercise>')
        : chalk.yellow('<add exercise>');
      lines.push(`   ${marker}`);
    }
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
    // Show parent sets for compound exercises (how many times to do the circuit/EMOM)
    const parentSetsLine = formatCompoundParentSets(exercise as any, weekCount, baseLocation, options);
    if (parentSetsLine) {
      lines.push(parentSetsLine);
    }
    lines.push(formatSubExercisesInteractive(exercise.sub_exercises, weekCount, baseLocation, options));
  }

  return lines.join('\n');
}

/**
 * Format parent exercise parameters for compound exercises (CIRCUIT, EMOM, etc.)
 * Displays any week-level parameters that exist at the parent level (sets, reps, rest, work, etc.)
 */
function formatCompoundParentSets(
  exercise: { [key: string]: any },
  weekCount: number,
  baseLocation: string,
  options: HighlightOptions = {}
): string | null {
  // Collect all parent-level week parameters across all weeks
  const paramFields = new Set<string>();

  for (let w = 1; w <= weekCount; w++) {
    const weekKey = `week${w}`;
    const params = exercise[weekKey];
    if (params) {
      // Collect parameter names (excluding internal fields and unit fields)
      Object.keys(params).forEach(key => {
        if (!key.startsWith('_') && !key.endsWith('_unit')) {
          paramFields.add(key);
        }
      });
    }
  }

  if (paramFields.size === 0) {
    return null;
  }

  const lines: string[] = [];

  // Determine work mode from first week to apply consistent filtering
  const firstWeekParams = exercise.week1;
  const workMode = determineWorkMode(firstWeekParams);

  // Filter fields based on work mode
  const fieldsToShow = new Set<string>();
  paramFields.forEach(field => {
    if (workMode === 'reps') {
      // Show sets, reps, weight, rest (NOT work_time)
      if (field !== 'work_time_minutes') {
        fieldsToShow.add(field);
      }
    } else if (workMode === 'work_time') {
      // Show work_time, rest (NOT sets, reps, weight)
      if (field !== 'sets' && field !== 'reps' && field !== 'weight') {
        fieldsToShow.add(field);
      }
    } else {
      // Show all fields
      fieldsToShow.add(field);
    }
  });

  // For each parameter type found, show progression across weeks
  fieldsToShow.forEach(fieldName => {
    const progression: string[] = [];

    for (let w = 1; w <= weekCount; w++) {
      const weekKey = `week${w}`;
      const params = exercise[weekKey];

      if (params && params[fieldName] !== undefined) {
        const location = `${baseLocation}.${weekKey}.${fieldName}`;
        const isSelected = options.selectedFieldLocation === location;

        let displayValue: string;

        // Format based on field type
        if (fieldName === 'weight') {
          const formatted = formatWeight(params[fieldName]);
          displayValue = (options.showAllEditable || isSelected)
            ? highlightEditableValue(formatted, isSelected)
            : formatted;
        } else if (fieldName === 'rest_time_minutes') {
          const unit = params.rest_time_unit || 'seconds';
          const formatted = `${params[fieldName]} ${unit}`;
          displayValue = (options.showAllEditable || isSelected)
            ? highlightEditableValue(formatted, isSelected)
            : formatted;
        } else if (fieldName === 'work_time_minutes') {
          const unit = params.work_time_unit || 'minutes';
          const formatted = `${params[fieldName]} ${unit}`;
          displayValue = (options.showAllEditable || isSelected)
            ? highlightEditableValue(formatted, isSelected)
            : formatted;
        } else if (fieldName === 'sets') {
          displayValue = (options.showAllEditable || isSelected)
            ? highlightEditableValue(`${params[fieldName]} sets`, isSelected)
            : `${params[fieldName]} sets`;
        } else if (fieldName === 'reps') {
          displayValue = (options.showAllEditable || isSelected)
            ? highlightEditableValue(`${params[fieldName]} reps`, isSelected)
            : `${params[fieldName]} reps`;
        } else {
          // Default: just show the value
          displayValue = (options.showAllEditable || isSelected)
            ? highlightEditableValue(String(params[fieldName]), isSelected)
            : String(params[fieldName]);
        }

        progression.push(`Week ${w}: ${displayValue}`);
      }
    }

    if (progression.length > 0) {
      // Capitalize field name for display (but clean up the name)
      const displayName = fieldName
        .replace('_minutes', '')  // Remove _minutes suffix since we're showing units now
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      lines.push(`   ${chalk.gray(displayName + ':')} ${progression.join(' | ')}`);
    }
  });

  return lines.length > 0 ? lines.join('\n') : null;
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

    // Determine work mode to show EITHER reps OR work_time, not both
    const workMode = determineWorkMode(params);

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

    const parts = [];

    // Show EITHER reps-based OR work_time-based parameters (not both)
    if (workMode === 'reps') {
      // Rep-based mode: show sets, reps, weight, rest
      const sets = params.sets !== undefined
        ? (options.showAllEditable || setsIsSelected ? highlightEditableValue(String(params.sets), setsIsSelected) : params.sets)
        : null;

      const reps = params.reps !== undefined
        ? (options.showAllEditable || repsIsSelected ? highlightEditableValue(String(params.reps), repsIsSelected) : params.reps)
        : null;

      if (sets && reps) {
        parts.push(`${sets} sets x ${reps} reps`);
      } else if (reps) {
        parts.push(`${reps} reps`);
      }

      const weight = params.weight !== undefined
        ? (options.showAllEditable || weightIsSelected
          ? highlightEditableValue(formatWeight(params.weight), weightIsSelected)
          : formatWeight(params.weight))
        : null;

      if (weight) parts.push(`@ ${weight}`);

      const restUnit = params.rest_time_unit || 'seconds';
      const rest = params.rest_time_minutes !== undefined
        ? (options.showAllEditable || restIsSelected
          ? highlightEditableValue(`${params.rest_time_minutes} ${restUnit} rest`, restIsSelected)
          : `${params.rest_time_minutes} ${restUnit} rest`)
        : null;

      if (rest) parts.push(rest);

    } else if (workMode === 'work_time') {
      // Work-time based mode: show work_time, rest (NO reps/sets/weight)
      const workUnit = params.work_time_unit || 'minutes';
      const work = params.work_time_minutes !== undefined
        ? (options.showAllEditable || workIsSelected
          ? highlightEditableValue(`${params.work_time_minutes} ${workUnit} work`, workIsSelected)
          : `${params.work_time_minutes} ${workUnit} work`)
        : null;

      if (work) parts.push(work);

      const restUnit = params.rest_time_unit || 'seconds';
      const rest = params.rest_time_minutes !== undefined
        ? (options.showAllEditable || restIsSelected
          ? highlightEditableValue(`${params.rest_time_minutes} ${restUnit} rest`, restIsSelected)
          : `${params.rest_time_minutes} ${restUnit} rest`)
        : null;

      if (rest) parts.push(rest);
    }

    if (parts.length > 0) {
      lines.push(`    Week ${w}: ${parts.join(', ')}`);
    }
  }
  return lines.join('\n');
}

/**
 * Format sub-exercises with editable field highlighting
 * Data-driven: automatically displays all parameter fields present in the JSON
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

    // Collect all parameter fields that exist across all weeks for this sub-exercise
    const paramFields = new Set<string>();
    for (let w = 1; w <= weekCount; w++) {
      const weekKey = `week${w}`;
      const params = (sub as any)[weekKey];
      if (params) {
        Object.keys(params).forEach(key => {
          // Filter out unit fields - they'll be combined with their base fields
          if (!key.startsWith('_') && !key.endsWith('_unit')) {
            paramFields.add(key);
          }
        });
      }
    }

    lines.push(`  - ${subName}:`);

    // Determine work mode from first week to apply consistent filtering
    const firstWeekParams = (sub as any).week1;
    const workMode = determineWorkMode(firstWeekParams);

    // Filter fields based on work mode
    const fieldsToShow = new Set<string>();
    paramFields.forEach(field => {
      if (workMode === 'reps') {
        // Show sets, reps, weight, rest, tempo (NOT work_time)
        if (field !== 'work_time_minutes') {
          fieldsToShow.add(field);
        }
      } else if (workMode === 'work_time') {
        // Show work_time, rest (NOT sets, reps, weight, tempo)
        if (field !== 'sets' && field !== 'reps' && field !== 'weight' && field !== 'tempo') {
          fieldsToShow.add(field);
        }
      } else {
        // Show all fields
        fieldsToShow.add(field);
      }
    });

    // For each parameter type found, show progression across weeks
    fieldsToShow.forEach(fieldName => {
      const progression: string[] = [];

      for (let w = 1; w <= weekCount; w++) {
        const weekKey = `week${w}`;
        const params = (sub as any)[weekKey];

        if (params && params[fieldName] !== undefined) {
          const location = `${subLocation}.${weekKey}.${fieldName}`;
          const isSelected = options.selectedFieldLocation === location;

          let displayValue: string;

          // Format based on field type
          if (fieldName === 'weight') {
            const formatted = formatWeight(params[fieldName]);
            displayValue = (options.showAllEditable || isSelected)
              ? highlightEditableValue(formatted, isSelected)
              : formatted;
          } else if (fieldName === 'rest_time_minutes') {
            const unit = params.rest_time_unit || 'seconds';
            const formatted = `${params[fieldName]} ${unit}`;
            displayValue = (options.showAllEditable || isSelected)
              ? highlightEditableValue(formatted, isSelected)
              : formatted;
          } else if (fieldName === 'work_time_minutes') {
            const unit = params.work_time_unit || 'minutes';
            const formatted = `${params[fieldName]} ${unit}`;
            displayValue = (options.showAllEditable || isSelected)
              ? highlightEditableValue(formatted, isSelected)
              : formatted;
          } else if (fieldName === 'sets') {
            displayValue = (options.showAllEditable || isSelected)
              ? highlightEditableValue(`${params[fieldName]} sets`, isSelected)
              : `${params[fieldName]} sets`;
          } else if (fieldName === 'reps') {
            displayValue = (options.showAllEditable || isSelected)
              ? highlightEditableValue(`${params[fieldName]} reps`, isSelected)
              : `${params[fieldName]} reps`;
          } else if (fieldName === 'tempo') {
            displayValue = (options.showAllEditable || isSelected)
              ? highlightEditableValue(`${params[fieldName]}`, isSelected)
              : params[fieldName];
          } else {
            // Default: just show the value
            displayValue = (options.showAllEditable || isSelected)
              ? highlightEditableValue(String(params[fieldName]), isSelected)
              : String(params[fieldName]);
          }

          progression.push(`Week ${w}: ${displayValue}`);
        }
      }

      if (progression.length > 0) {
        // Capitalize field name for display (but clean up the name)
        const displayName = fieldName
          .replace('_minutes', '')  // Remove _minutes suffix since we're showing units now
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        lines.push(`     ${chalk.gray(displayName + ':')} ${progression.join(' | ')}`);
      }
    });
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

    // Add <add exercise> marker after each exercise
    const insertLocation = `${dayKey}.exercises[${i}]._insert_after`;
    const isSelected = options.selectedFieldLocation === insertLocation;
    if (options.showAllEditable || isSelected) {
      const marker = isSelected
        ? chalk.cyan.bold('<add exercise>')
        : chalk.yellow('<add exercise>');
      lines.push(`   ${marker}`);
    }

    lines.push('');
  }

  return lines.join('\n');
}