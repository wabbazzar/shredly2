<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import type { QuestionnaireAnswers } from '$lib/engine/types';
	import { userStore } from '$lib/stores/user';
	import DaySplitCustomizer, { type DayConfig } from '$lib/components/questionnaire/DaySplitCustomizer.svelte';
	import rules from '$data/workout_generation_rules.json';

	export let answers: QuestionnaireAnswers;
	export let startDate: string;

	const dispatch = createEventDispatcher<{
		change: QuestionnaireAnswers;
		startDateChange: string;
	}>();

	// Get prescriptive splits from config for initialization
	const prescriptiveSplits = (rules as Record<string, unknown>).prescriptive_splits as Record<
		string,
		Record<string, string[]>
	>;
	const defaultGymDaysByGoal = (rules as Record<string, unknown>).default_gym_days_by_goal as Record<
		string,
		Record<string, number>
	>;
	const gymPriorityOrder = ((rules as Record<string, unknown>).gym_priority_order as { order: string[] })?.order ?? [];

	// Reference to DaySplitCustomizer for initialization
	let daySplitCustomizer: DaySplitCustomizer;

	// Get home equipment from user store
	$: homeEquipment = $userStore.preferences.homeEquipment ?? [];

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
		{ value: '45', label: '45 min' },
		{ value: '60', label: '60 min' }
	] as const;

	// Experience options
	const experienceOptions = [
		{ value: 'beginner', label: 'Beginner' },
		{ value: 'intermediate', label: 'Intermediate' },
		{ value: 'advanced', label: 'Advanced' }
	] as const;

	// Program duration options
	const programDurationOptions = [
		{ value: '3', label: '3 weeks' },
		{ value: '4', label: '4 weeks' },
		{ value: '6', label: '6 weeks' }
	] as const;

	// Initialize dayConfigs if not present
	function initializeDayConfigs(goal: string, frequency: number): DayConfig[] {
		const splits = prescriptiveSplits[goal]?.[frequency.toString()] ?? ['Push', 'Pull', 'Legs'];
		const defaultGymDays = defaultGymDaysByGoal[goal]?.[frequency.toString()] ?? Math.min(3, frequency);

		const configs: DayConfig[] = splits.map((focus) => ({
			focus,
			location: 'home' as const
		}));

		// Auto-assign gym days based on priority
		const sortedIndices = configs
			.map((day, i) => ({
				index: i,
				priority: gymPriorityOrder.indexOf(day.focus)
			}))
			.filter((item) => item.priority !== -1)
			.sort((a, b) => a.priority - b.priority);

		const unlistedIndices = configs
			.map((day, i) => ({
				index: i,
				priority: gymPriorityOrder.indexOf(day.focus)
			}))
			.filter((item) => item.priority === -1);

		const allSorted = [...sortedIndices, ...unlistedIndices];
		allSorted.forEach((item, rank) => {
			configs[item.index].location = rank < defaultGymDays ? 'gym' : 'home';
		});

		return configs;
	}

	// Initialize on mount if dayConfigs is missing
	onMount(() => {
		if (!answers.dayConfigs || answers.dayConfigs.length === 0) {
			const frequency = parseInt(answers.training_frequency ?? '4', 10);
			answers.dayConfigs = initializeDayConfigs(answers.goal, frequency);
			dispatch('change', answers);
		}
	});

	function updateField<K extends keyof QuestionnaireAnswers>(field: K, value: QuestionnaireAnswers[K]) {
		answers = { ...answers, [field]: value };
		dispatch('change', answers);
	}

	function handleGoalChange(newGoal: typeof answers.goal) {
		// When goal changes, reinitialize the day configs with the new goal's defaults
		const frequency = answers.dayConfigs?.length ?? parseInt(answers.training_frequency ?? '4', 10);
		const newDayConfigs = initializeDayConfigs(newGoal, frequency);

		answers = {
			...answers,
			goal: newGoal,
			dayConfigs: newDayConfigs,
			training_frequency: frequency.toString() as typeof answers.training_frequency
		};
		dispatch('change', answers);
	}

	function handleFrequencyChange(days: number) {
		// Reinitialize day configs from prescriptive_splits for the new frequency
		const newDayConfigs = initializeDayConfigs(answers.goal, days);

		answers = {
			...answers,
			dayConfigs: newDayConfigs,
			training_frequency: days.toString() as typeof answers.training_frequency
		};
		dispatch('change', answers);
	}

	function handleDayConfigsChange(e: CustomEvent<DayConfig[]>) {
		answers = {
			...answers,
			dayConfigs: e.detail,
			// Keep training_frequency in sync with dayConfigs length
			training_frequency: e.detail.length.toString() as typeof answers.training_frequency
		};
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
					on:click={() => handleGoalChange(option.value)}
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
		<div class="grid grid-cols-4 gap-1.5">
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

	<!-- Training Frequency Selector -->
	<div>
		<label class="block text-xs font-medium text-slate-400 mb-1.5">Days / Week</label>
		<div class="grid grid-cols-6 gap-1.5">
			{#each [2, 3, 4, 5, 6, 7] as days}
				<button
					type="button"
					on:click={() => handleFrequencyChange(days)}
					class="py-1.5 px-2 text-xs rounded-md transition-colors
						   {(answers.dayConfigs?.length ?? 0) === days
						? 'bg-indigo-600 text-white'
						: 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
				>
					{days}
				</button>
			{/each}
		</div>
	</div>

	<!-- Day/Split Customizer -->
	<DaySplitCustomizer
		bind:this={daySplitCustomizer}
		goal={answers.goal}
		dayConfigs={answers.dayConfigs ?? []}
		{homeEquipment}
		on:change={handleDayConfigsChange}
	/>

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
