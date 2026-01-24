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

		// Regular exercise - show full description
		if (!currentExercise.isCompoundParent) {
			const desc = getDescription(currentExercise.exerciseName);
			if (!desc) return null;
			return {
				type: 'full' as const,
				exerciseName: currentExercise.exerciseName,
				description: desc
			};
		}

		// Compound exercise
		const subExercises = currentExercise.subExercises;
		if (subExercises.length === 0) return null;

		// EMOM/Interval - show active sub-exercise description
		if (exerciseType === 'emom' || exerciseType === 'interval') {
			const activeIndex = timerState.currentSubExercise;
			const activeSub = subExercises[activeIndex];
			if (!activeSub) return null;

			const desc = getDescription(activeSub.exerciseName);
			if (!desc) return null;

			return {
				type: 'full' as const,
				exerciseName: activeSub.exerciseName,
				description: desc
			};
		}

		// Circuit/AMRAP - show cues for all sub-exercises
		if (exerciseType === 'circuit' || exerciseType === 'amrap') {
			const subCues: Array<{ name: string; cues: string }> = [];
			for (const sub of subExercises) {
				const desc = getDescription(sub.exerciseName);
				if (desc?.cues) {
					subCues.push({ name: sub.exerciseName, cues: desc.cues });
				}
			}
			if (subCues.length === 0) return null;

			return {
				type: 'cues_list' as const,
				subCues
			};
		}

		return null;
	})();
</script>

{#if displayContent}
	<div
		class="border-t border-white/20"
		style="background-color: {phaseColor}"
	>
		<div class="px-5 landscape:px-3 py-4 landscape:py-2 overflow-y-auto max-h-72 landscape:max-h-32">
			{#if displayContent.type === 'full'}
				<!-- Full description for regular exercise or active sub-exercise -->
				<div class="space-y-3 landscape:space-y-1.5">
					{#if displayContent.description.overview}
						<div>
							<div class="text-white/70 text-xs landscape:text-[10px] font-semibold uppercase tracking-wide mb-1 landscape:mb-0.5">Overview</div>
							<p class="text-white/50 text-sm landscape:text-xs leading-relaxed landscape:leading-snug">{displayContent.description.overview}</p>
						</div>
					{/if}
					{#if displayContent.description.setup}
						<div>
							<div class="text-white/70 text-xs landscape:text-[10px] font-semibold uppercase tracking-wide mb-1 landscape:mb-0.5">Setup</div>
							<p class="text-white/50 text-sm landscape:text-xs leading-relaxed landscape:leading-snug">{displayContent.description.setup}</p>
						</div>
					{/if}
					{#if displayContent.description.movement}
						<div>
							<div class="text-white/70 text-xs landscape:text-[10px] font-semibold uppercase tracking-wide mb-1 landscape:mb-0.5">Movement</div>
							<p class="text-white/50 text-sm landscape:text-xs leading-relaxed landscape:leading-snug">{displayContent.description.movement}</p>
						</div>
					{/if}
					{#if displayContent.description.cues}
						<div>
							<div class="text-white/70 text-xs landscape:text-[10px] font-semibold uppercase tracking-wide mb-1 landscape:mb-0.5">Cues</div>
							<p class="text-white/50 text-sm landscape:text-xs leading-relaxed landscape:leading-snug">{displayContent.description.cues}</p>
						</div>
					{/if}
				</div>
			{:else if displayContent.type === 'cues_list'}
				<!-- Cues list for circuit/AMRAP -->
				<div class="space-y-2.5 landscape:space-y-1">
					{#each displayContent.subCues as { name, cues }}
						<div>
							<div class="text-white/70 text-xs landscape:text-[10px] font-semibold uppercase tracking-wide mb-0.5">{name}</div>
							<p class="text-white/50 text-sm landscape:text-xs leading-relaxed landscape:leading-snug">{cues}</p>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
{/if}
