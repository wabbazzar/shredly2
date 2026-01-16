<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { WorkoutLocation } from '$lib/types/user';
	import DayCard from './DayCard.svelte';
	import rules from '$data/workout_generation_rules.json';

	export let goal: 'build_muscle' | 'tone' | 'lose_weight';
	export let dayConfigs: DayConfig[];
	export let homeEquipment: string[] = [];

	export interface DayConfig {
		focus: string;
		location: WorkoutLocation;
	}

	const dispatch = createEventDispatcher<{
		change: DayConfig[];
	}>();

	const MAX_DAYS = 7;
	const MIN_DAYS = 2;

	// Get prescriptive splits from config
	const prescriptiveSplits = (rules as Record<string, unknown>).prescriptive_splits as Record<
		string,
		Record<string, string[]>
	>;

	// Get gym priority order from config
	const gymPriorityOrder = ((rules as Record<string, unknown>).gym_priority_order as { order: string[] })?.order ?? [];

	// Get default gym days by goal from config
	const defaultGymDaysByGoal = (rules as Record<string, unknown>).default_gym_days_by_goal as Record<
		string,
		Record<string, number>
	>;

	// Initialize with defaults when goal changes
	export function initializeFromGoal(newGoal: string, frequency: number) {
		const splits = prescriptiveSplits[newGoal]?.[frequency.toString()] ?? ['Push', 'Pull', 'Legs'];
		const defaultGymDays = defaultGymDaysByGoal[newGoal]?.[frequency.toString()] ?? Math.min(3, frequency);

		// Create day configs with auto-assigned locations
		const configs: DayConfig[] = splits.map((focus) => ({
			focus,
			location: 'home' as WorkoutLocation
		}));

		// Assign gym days based on priority
		autoAssignLocations(configs, defaultGymDays);

		dayConfigs = configs;
		dispatch('change', dayConfigs);
	}

	function autoAssignLocations(configs: DayConfig[], gymDays: number) {
		// Sort indices by gym priority (lower index = needs gym more)
		const sortedIndices = configs
			.map((day, i) => ({
				index: i,
				priority: gymPriorityOrder.indexOf(day.focus)
			}))
			.filter((item) => item.priority !== -1)
			.sort((a, b) => a.priority - b.priority);

		// Add any focuses not in priority list at the end
		const unlistedIndices = configs
			.map((day, i) => ({
				index: i,
				priority: gymPriorityOrder.indexOf(day.focus)
			}))
			.filter((item) => item.priority === -1);

		const allSorted = [...sortedIndices, ...unlistedIndices];

		// Assign gym to top N priority days
		allSorted.forEach((item, rank) => {
			configs[item.index].location = rank < gymDays ? 'gym' : 'home';
		});
	}

	function handleFocusChange(index: number, newFocus: string) {
		dayConfigs = dayConfigs.map((day, i) => (i === index ? { ...day, focus: newFocus } : day));
		dispatch('change', dayConfigs);
	}

	function handleLocationToggle(index: number) {
		dayConfigs = dayConfigs.map((day, i) =>
			i === index ? { ...day, location: day.location === 'gym' ? 'home' : 'gym' } : day
		);
		dispatch('change', dayConfigs);
	}

	function handleRemoveDay(index: number) {
		if (dayConfigs.length <= MIN_DAYS) return;
		dayConfigs = dayConfigs.filter((_, i) => i !== index);
		dispatch('change', dayConfigs);
	}

	function handleAddDay() {
		if (dayConfigs.length >= MAX_DAYS) return;

		// Default new day to a recovery/mobility focus at home
		const newDay: DayConfig = {
			focus: 'FullBody-Mobility',
			location: 'home'
		};
		dayConfigs = [...dayConfigs, newDay];
		dispatch('change', dayConfigs);
	}

	// Calculate summary stats
	$: gymDays = dayConfigs.filter((d) => d.location === 'gym').length;
	$: homeDays = dayConfigs.filter((d) => d.location === 'home').length;
</script>

<div class="space-y-3">
	<!-- Header with summary -->
	<div class="flex items-center justify-between">
		<label class="block text-xs font-medium text-slate-400">Your Week</label>
		<div class="flex items-center gap-2 text-[10px]">
			<span class="px-1.5 py-0.5 rounded bg-indigo-600/20 text-indigo-300">
				{gymDays} gym
			</span>
			<span class="px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-300">
				{homeDays} home
			</span>
		</div>
	</div>

	<!-- Day cards container - horizontal scroll on mobile -->
	<div class="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
		{#each dayConfigs as day, index (index)}
			<DayCard
				dayNumber={index + 1}
				focus={day.focus}
				location={day.location}
				{homeEquipment}
				showRemove={dayConfigs.length > MIN_DAYS}
				on:focusChange={(e) => handleFocusChange(index, e.detail)}
				on:locationToggle={() => handleLocationToggle(index)}
				on:remove={() => handleRemoveDay(index)}
			/>
		{/each}

		<!-- Add day button -->
		{#if dayConfigs.length < MAX_DAYS}
			<button
				type="button"
				onclick={handleAddDay}
				class="flex-shrink-0 w-[120px] min-h-[100px] rounded-lg border-2 border-dashed border-slate-600
					   flex flex-col items-center justify-center gap-1 text-slate-500
					   hover:border-slate-500 hover:text-slate-400 transition-colors"
			>
				<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				<span class="text-xs">Add Day</span>
			</button>
		{/if}
	</div>

	<!-- Help text -->
	<p class="text-[10px] text-slate-500 text-center">
		Tap focus to change workout type, tap location to switch home/gym
	</p>
</div>
