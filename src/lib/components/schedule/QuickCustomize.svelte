<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { QuestionnaireAnswers } from '$lib/engine/types';

	export let answers: QuestionnaireAnswers;
	export let startDate: string;

	const dispatch = createEventDispatcher<{
		change: QuestionnaireAnswers;
		startDateChange: string;
	}>();

	// Goal options
	const goalOptions = [
		{ value: 'build_muscle', label: 'Build Muscle' },
		{ value: 'tone', label: 'Tone & Define' },
		{ value: 'lose_weight', label: 'Lose Weight' }
	] as const;

	// Duration options
	const durationOptions = [
		{ value: '20', label: '20 min' },
		{ value: '30', label: '30 min' },
		{ value: '60', label: '60 min' }
	] as const;

	// Experience options
	const experienceOptions = [
		{ value: 'beginner', label: 'Beginner' },
		{ value: 'intermediate', label: 'Intermediate' },
		{ value: 'advanced', label: 'Advanced' }
	] as const;

	// Equipment options
	const equipmentOptions = [
		{ value: 'full_gym', label: 'Full Gym' },
		{ value: 'dumbbells_only', label: 'Dumbbells Only' },
		{ value: 'bodyweight_only', label: 'Bodyweight Only' }
	] as const;

	// Frequency options
	const frequencyOptions = [
		{ value: '2', label: '2 days' },
		{ value: '3', label: '3 days' },
		{ value: '4', label: '4 days' },
		{ value: '5', label: '5 days' },
		{ value: '6', label: '6 days' },
		{ value: '7', label: '7 days' }
	] as const;

	// Program duration options
	const programDurationOptions = [
		{ value: '3', label: '3 weeks' },
		{ value: '4', label: '4 weeks' },
		{ value: '6', label: '6 weeks' }
	] as const;

	function updateField<K extends keyof QuestionnaireAnswers>(field: K, value: QuestionnaireAnswers[K]) {
		answers = { ...answers, [field]: value };
		dispatch('change', answers);
	}

	function updateStartDate(e: Event) {
		const target = e.target as HTMLInputElement;
		startDate = target.value;
		dispatch('startDateChange', startDate);
	}
</script>

<div class="space-y-3">
	<!-- Goal -->
	<div>
		<label class="block text-xs font-medium text-slate-400 mb-1.5">Goal</label>
		<div class="grid grid-cols-3 gap-1.5">
			{#each goalOptions as option}
				<button
					type="button"
					on:click={() => updateField('goal', option.value)}
					class="py-1.5 px-2 text-xs rounded-md transition-colors
						   {answers.goal === option.value
						? 'bg-indigo-600 text-white'
						: 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Session Duration -->
	<div>
		<label class="block text-xs font-medium text-slate-400 mb-1.5">Duration</label>
		<div class="grid grid-cols-3 gap-1.5">
			{#each durationOptions as option}
				<button
					type="button"
					on:click={() => updateField('session_duration', option.value)}
					class="py-1.5 px-2 text-xs rounded-md transition-colors
						   {answers.session_duration === option.value
						? 'bg-indigo-600 text-white'
						: 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Experience Level -->
	<div>
		<label class="block text-xs font-medium text-slate-400 mb-1.5">Experience</label>
		<div class="grid grid-cols-3 gap-1.5">
			{#each experienceOptions as option}
				<button
					type="button"
					on:click={() => updateField('experience_level', option.value)}
					class="py-1.5 px-2 text-xs rounded-md transition-colors
						   {answers.experience_level === option.value
						? 'bg-indigo-600 text-white'
						: 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Equipment -->
	<div>
		<label class="block text-xs font-medium text-slate-400 mb-1.5">Equipment</label>
		<div class="grid grid-cols-3 gap-1.5">
			{#each equipmentOptions as option}
				<button
					type="button"
					on:click={() => updateField('equipment_access', option.value)}
					class="py-1.5 px-2 text-xs rounded-md transition-colors
						   {answers.equipment_access === option.value
						? 'bg-indigo-600 text-white'
						: 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Training Frequency -->
	<div>
		<label class="block text-xs font-medium text-slate-400 mb-1.5">Days/Week</label>
		<div class="grid grid-cols-6 gap-1">
			{#each frequencyOptions as option}
				<button
					type="button"
					on:click={() => updateField('training_frequency', option.value)}
					class="py-1.5 text-xs rounded-md transition-colors
						   {answers.training_frequency === option.value
						? 'bg-indigo-600 text-white'
						: 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
				>
					{option.value}
				</button>
			{/each}
		</div>
	</div>

	<!-- Program Duration -->
	<div>
		<label class="block text-xs font-medium text-slate-400 mb-1.5">Program</label>
		<div class="grid grid-cols-3 gap-1.5">
			{#each programDurationOptions as option}
				<button
					type="button"
					on:click={() => updateField('program_duration', option.value)}
					class="py-1.5 px-2 text-xs rounded-md transition-colors
						   {answers.program_duration === option.value
						? 'bg-indigo-600 text-white'
						: 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
				>
					{option.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Start Date -->
	<div class="overflow-hidden">
		<label class="block text-xs font-medium text-slate-400 mb-1.5">Start Date</label>
		<input
			type="date"
			value={startDate}
			on:change={updateStartDate}
			class="w-full max-w-full py-1.5 px-2 text-sm bg-slate-700 border border-slate-600 rounded-md
				   text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
		/>
	</div>
</div>
