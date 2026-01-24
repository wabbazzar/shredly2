<script lang="ts">
	import type { TimerState, LiveExercise } from '$lib/engine/types';
	import exerciseDescriptions from '../../../data/exercise_descriptions.json';

	export let currentExercise: LiveExercise | null = null;
	export let timerState: TimerState;
	export let phaseColor: string = '#334155'; // slate-700 default

	interface ExerciseDescriptionData {
		overview?: string;
		setup?: string;
		movement?: string;
		cues?: string;
	}

	type DescriptionRecord = Record<string, { description: ExerciseDescriptionData }>;

	const descriptions = exerciseDescriptions as DescriptionRecord;

	function getDescription(exerciseName: string): ExerciseDescriptionData | null {
		const data = descriptions[exerciseName];
		return data?.description || null;
	}

	$: displayContent = (() => {
		if (!currentExercise) return null;

		const exerciseType = timerState.exerciseType;

		// Regular exercise - show cues only
		if (!currentExercise.isCompoundParent) {
			const desc = getDescription(currentExercise.exerciseName);
			if (!desc?.cues) return null;
			return {
				exerciseName: currentExercise.exerciseName,
				cues: desc.cues
			};
		}

		// Compound exercise
		const subExercises = currentExercise.subExercises;
		if (subExercises.length === 0) return null;

		// EMOM/Interval - show cues for active sub-exercise only
		if (exerciseType === 'emom' || exerciseType === 'interval') {
			const activeIndex = timerState.currentSubExercise;
			const activeSub = subExercises[activeIndex];
			if (!activeSub) return null;

			const desc = getDescription(activeSub.exerciseName);
			if (!desc?.cues) return null;

			return {
				exerciseName: activeSub.exerciseName,
				cues: desc.cues
			};
		}

		// AMRAP/Circuit - no cues shown (user cycles through exercises freely)
		if (exerciseType === 'amrap' || exerciseType === 'circuit') {
			return null;
		}

		return null;
	})();
</script>

{#if displayContent}
	<div
		class="border-t border-white/20"
		style="background-color: {phaseColor}"
	>
		<div class="px-5 landscape:px-3 py-4 landscape:py-2 pb-8 landscape:pb-4 overflow-y-auto max-h-72 landscape:max-h-32">
			<div class="text-white/70 text-xs landscape:text-[10px] font-semibold uppercase tracking-wide mb-1 landscape:mb-0.5">{displayContent.exerciseName}</div>
			<p class="text-white/50 text-sm landscape:text-xs leading-relaxed landscape:leading-snug">{displayContent.cues}</p>
		</div>
	</div>
{/if}
