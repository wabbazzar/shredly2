<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { LiveExercise, WeightPrescription, PreviousWeekPerformance } from '$lib/engine/types';
	import { getExerciseMetadata } from '$lib/engine/exercise-metadata';
	import { getPersonalRecords, getLastPerformance, type PersonalRecord } from '$lib/stores/history';
	import { userStore } from '$lib/stores/user';

	export let exercise: LiveExercise;

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	// Get exercise metadata
	$: metadata = getExerciseMetadata(exercise.exerciseName);
	$: personalRecords = getPersonalRecords(exercise.exerciseName);
	$: lastPerformance = getLastPerformance(exercise.exerciseName);

	// Weight guidance data
	$: weightPrescription = exercise.prescription.weightPrescription;
	$: previousWeek = exercise.prescription.previousWeek;
	$: hasWeightGuidance = weightPrescription !== null || previousWeek !== null;

	// Get 1RM and calculate TM for % TM prescriptions
	$: oneRepMax = userStore.getOneRepMax(exercise.exerciseName);
	$: trainingMax = oneRepMax && oneRepMax.weightLbs > 0 ? Math.round(oneRepMax.weightLbs * 0.9) : null;
	$: isPercentTMPrescription = weightPrescription?.type === 'percent_tm';

	function handleClose() {
		dispatch('close');
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	// Format weight prescription for detailed display
	function formatWeightPrescriptionDetailed(prescription: WeightPrescription | null): { type: string; value: string } | null {
		if (!prescription) return null;

		switch (prescription.type) {
			case 'qualitative':
				return {
					type: 'Intensity',
					value: String(prescription.value).charAt(0).toUpperCase() + String(prescription.value).slice(1)
				};
			case 'percent_tm':
				return {
					type: '% of Training Max',
					value: `${prescription.value}%`
				};
			case 'absolute':
				return {
					type: 'Target Weight',
					value: `${prescription.value} ${prescription.unit || 'lbs'}`
				};
			default:
				return null;
		}
	}

	$: prescriptionFormatted = formatWeightPrescriptionDetailed(weightPrescription);
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
	on:click|self={handleClose}
	on:keydown={(e) => e.key === 'Escape' && handleClose()}
	role="dialog"
	aria-modal="true"
	aria-labelledby="exercise-info-title"
	tabindex="-1"
>
	<div class="w-full max-w-md bg-slate-800 rounded-xl shadow-xl overflow-hidden max-h-[80vh] flex flex-col">
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
			<h2 id="exercise-info-title" class="text-lg font-semibold text-white truncate pr-4">{exercise.exerciseName}</h2>
			<button
				class="p-2 text-slate-400 hover:text-white transition-colors flex-shrink-0"
				on:click={handleClose}
				aria-label="Close"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto p-4 space-y-6">
			<!-- Exercise Type Badge -->
			{#if exercise.exerciseType !== 'strength'}
				<div class="flex items-center gap-2">
					<span class="px-3 py-1 rounded-full text-sm font-medium uppercase
						{exercise.exerciseType === 'emom' ? 'bg-orange-500/20 text-orange-400' : ''}
						{exercise.exerciseType === 'amrap' ? 'bg-pink-500/20 text-pink-400' : ''}
						{exercise.exerciseType === 'circuit' ? 'bg-cyan-500/20 text-cyan-400' : ''}
						{exercise.exerciseType === 'interval' ? 'bg-rose-500/20 text-rose-400' : ''}
						{exercise.exerciseType === 'bodyweight' ? 'bg-teal-500/20 text-teal-400' : ''}"
					>
						{exercise.exerciseType}
					</span>
				</div>
			{/if}

			<!-- Metadata -->
			{#if metadata}
				<div class="space-y-3">
					{#if metadata.muscleGroups && metadata.muscleGroups.length > 0}
						<div>
							<h3 class="text-sm font-medium text-slate-400 mb-1">Muscle Groups</h3>
							<div class="flex flex-wrap gap-1">
								{#each metadata.muscleGroups as muscle}
									<span class="px-2 py-0.5 bg-slate-700 rounded text-sm text-white">
										{muscle}
									</span>
								{/each}
							</div>
						</div>
					{/if}

					{#if metadata.equipment && metadata.equipment.length > 0}
						<div>
							<h3 class="text-sm font-medium text-slate-400 mb-1">Equipment</h3>
							<div class="flex flex-wrap gap-1">
								{#each metadata.equipment as item}
									<span class="px-2 py-0.5 bg-slate-700 rounded text-sm text-white">
										{item}
									</span>
								{/each}
							</div>
						</div>
					{/if}

					{#if metadata.difficulty}
						<div>
							<h3 class="text-sm font-medium text-slate-400 mb-1">Difficulty</h3>
							<span class="text-white">{metadata.difficulty}</span>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Weight Guidance (NEW) -->
			{#if hasWeightGuidance || isPercentTMPrescription}
				<div>
					<h3 class="text-sm font-medium text-slate-400 mb-2">Weight Guidance</h3>
					<div class="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 rounded-lg p-3 border border-indigo-500/30">
						<div class="space-y-2">
							<!-- Prescription -->
							{#if prescriptionFormatted}
								<div class="flex justify-between items-center">
									<span class="text-slate-300 text-sm">{prescriptionFormatted.type}:</span>
									<span class="text-white font-semibold text-lg">{prescriptionFormatted.value}</span>
								</div>
							{/if}

							<!-- 1RM and TM breakdown for % TM prescriptions -->
							{#if isPercentTMPrescription && oneRepMax}
								<div class="pt-2 mt-2 border-t border-slate-600/50 space-y-1">
									<div class="flex justify-between items-center text-sm">
										<span class="text-slate-400">Your 1RM:</span>
										<span class="text-slate-200">{oneRepMax.weightLbs} lbs</span>
									</div>
									{#if trainingMax}
										<div class="flex justify-between items-center text-sm">
											<span class="text-slate-400">Training Max (90%):</span>
											<span class="text-slate-200">{trainingMax} lbs</span>
										</div>
									{/if}
								</div>
							{:else if isPercentTMPrescription && !oneRepMax}
								<div class="pt-2 mt-2 border-t border-slate-600/50">
									<p class="text-amber-400 text-xs">
										No 1RM recorded for this exercise. Add it in Profile to see calculated weight.
									</p>
								</div>
							{/if}

							<!-- Calculated Target Weight -->
							{#if exercise.prescription.weight}
								<div class="flex justify-between items-center pt-2 mt-2 border-t border-slate-600/50">
									<span class="text-slate-300 text-sm">Target Weight:</span>
									<span class="text-green-400 font-bold text-lg">
										{exercise.prescription.weight} {exercise.prescription.weightUnit || 'lbs'}
									</span>
								</div>
							{/if}

							<!-- Previous Week Performance -->
							{#if previousWeek && previousWeek.weight !== null}
								<div class="pt-2 mt-2 border-t border-slate-600/50">
									<div class="flex justify-between items-center">
										<span class="text-slate-400 text-sm">
											Week {previousWeek.weekNumber}:
										</span>
										<span class="text-slate-200">
											{previousWeek.weight} {previousWeek.weightUnit || 'lbs'}
											{#if previousWeek.reps}
												<span class="text-slate-400">x{previousWeek.reps}</span>
											{/if}
											{#if previousWeek.rpe}
												<span class="text-amber-400 ml-1">@RPE {previousWeek.rpe}</span>
											{/if}
										</span>
									</div>
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/if}

			<!-- Today's Prescription -->
			<div>
				<h3 class="text-sm font-medium text-slate-400 mb-2">Today's Prescription</h3>
				<div class="bg-slate-700/50 rounded-lg p-3">
					<div class="grid grid-cols-2 gap-2 text-sm">
						{#if exercise.prescription.sets > 1}
							<div>
								<span class="text-slate-400">Sets:</span>
								<span class="text-white ml-2">{exercise.prescription.sets}</span>
							</div>
						{/if}
						{#if exercise.prescription.reps}
							<div>
								<span class="text-slate-400">Reps:</span>
								<span class="text-white ml-2">{exercise.prescription.reps}</span>
							</div>
						{/if}
						{#if exercise.prescription.weight}
							<div>
								<span class="text-slate-400">Weight:</span>
								<span class="text-white ml-2">
									{exercise.prescription.weight} {exercise.prescription.weightUnit || 'lbs'}
								</span>
							</div>
						{/if}
						{#if exercise.prescription.weightPrescription && !exercise.prescription.weight}
							<div>
								<span class="text-slate-400">Intensity:</span>
								<span class="text-white ml-2">
									{#if exercise.prescription.weightPrescription.type === 'qualitative'}
										{String(exercise.prescription.weightPrescription.value).charAt(0).toUpperCase() + String(exercise.prescription.weightPrescription.value).slice(1)}
									{:else if exercise.prescription.weightPrescription.type === 'percent_tm'}
										{exercise.prescription.weightPrescription.value}% TM
									{/if}
								</span>
							</div>
						{/if}
						{#if exercise.prescription.workTimeSeconds}
							<div>
								<span class="text-slate-400">Time:</span>
								<span class="text-white ml-2">
									{Math.floor(exercise.prescription.workTimeSeconds / 60)}:{(exercise.prescription.workTimeSeconds % 60).toString().padStart(2, '0')}
								</span>
							</div>
						{/if}
						{#if exercise.prescription.restTimeSeconds}
							<div>
								<span class="text-slate-400">Rest:</span>
								<span class="text-white ml-2">{exercise.prescription.restTimeSeconds}s</span>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Personal Records -->
			{#if personalRecords.maxWeight || personalRecords.maxReps}
				<div>
					<h3 class="text-sm font-medium text-slate-400 mb-2">Personal Records</h3>
					<div class="bg-slate-700/50 rounded-lg p-3 space-y-2">
						{#if personalRecords.maxWeight}
							<div class="flex justify-between text-sm">
								<span class="text-slate-400">Max Weight:</span>
								<span class="text-white">
									{personalRecords.maxWeight} {personalRecords.maxWeightUnit}
									<span class="text-slate-500 text-xs ml-1">
										({formatDate(personalRecords.maxWeightDate)})
									</span>
								</span>
							</div>
						{/if}
						{#if personalRecords.maxReps}
							<div class="flex justify-between text-sm">
								<span class="text-slate-400">Max Reps:</span>
								<span class="text-white">
									{personalRecords.maxReps}
									<span class="text-slate-500 text-xs ml-1">
										({formatDate(personalRecords.maxRepsDate)})
									</span>
								</span>
							</div>
						{/if}
						{#if personalRecords.maxVolume}
							<div class="flex justify-between text-sm">
								<span class="text-slate-400">Max Volume:</span>
								<span class="text-white">
									{personalRecords.maxVolume}
									<span class="text-slate-500 text-xs ml-1">
										({formatDate(personalRecords.maxVolumeDate)})
									</span>
								</span>
							</div>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Last Performance -->
			{#if lastPerformance}
				<div>
					<h3 class="text-sm font-medium text-slate-400 mb-2">Last Performance</h3>
					<div class="bg-slate-700/50 rounded-lg p-3">
						<div class="text-sm text-slate-400 mb-1">
							{formatDate(lastPerformance.date)}
						</div>
						<div class="text-white">
							{#if lastPerformance.weight}
								{lastPerformance.weight} {lastPerformance.weight_unit}
							{/if}
							{#if lastPerformance.reps}
								{lastPerformance.weight ? ' x ' : ''}{lastPerformance.reps} reps
							{/if}
							{#if lastPerformance.rpe}
								<span class="text-slate-400 ml-2">@ RPE {lastPerformance.rpe}</span>
							{/if}
						</div>
					</div>
				</div>
			{:else}
				<div class="text-center text-slate-500 py-4">
					No history for this exercise yet
				</div>
			{/if}

			<!-- Sub-exercises for compound blocks -->
			{#if exercise.isCompoundParent && exercise.subExercises.length > 0}
				<div>
					<h3 class="text-sm font-medium text-slate-400 mb-2">Sub-exercises</h3>
					<div class="space-y-2">
						{#each exercise.subExercises as subEx}
							{@const subMetadata = getExerciseMetadata(subEx.exerciseName)}
							{@const showSubWeight = subMetadata?.external_load !== 'never' && (subEx.prescription.weight || subEx.prescription.weightPrescription)}
							<div class="bg-slate-700/50 rounded-lg p-3">
								<div class="font-medium text-white">{subEx.exerciseName}</div>
								<div class="text-sm text-slate-400">
									{#if exercise.exerciseType === 'interval'}
										<!-- Interval: show work/rest times -->
										{#if subEx.prescription.workTimeSeconds}
											{subEx.prescription.workTimeSeconds}s work
										{/if}
										{#if subEx.prescription.restTimeSeconds}
											<span class="mx-1">/</span>
											{subEx.prescription.restTimeSeconds}s rest
										{/if}
									{:else}
										<!-- EMOM/AMRAP/Circuit: show reps or work time -->
										{#if subEx.prescription.reps}
											{subEx.prescription.reps} reps
										{/if}
										{#if subEx.prescription.workTimeSeconds}
											{subEx.prescription.workTimeSeconds}s work
										{/if}
									{/if}
									<!-- Weight prescription for sub-exercises -->
									{#if showSubWeight}
										<span class="mx-1">@</span>
										{#if subEx.prescription.weight}
											{subEx.prescription.weight} {subEx.prescription.weightUnit || 'lbs'}
										{:else if subEx.prescription.weightPrescription}
											{#if subEx.prescription.weightPrescription.type === 'qualitative'}
												{String(subEx.prescription.weightPrescription.value)}
											{:else if subEx.prescription.weightPrescription.type === 'percent_tm'}
												{subEx.prescription.weightPrescription.value}% TM
											{:else if subEx.prescription.weightPrescription.type === 'absolute'}
												{subEx.prescription.weightPrescription.value} {subEx.prescription.weightPrescription.unit || 'lbs'}
											{/if}
										{/if}
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
