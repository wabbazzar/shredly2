<script lang="ts">
	import { userStore } from '$lib/stores/user';
	import { pwaStore, APP_VERSION } from '$lib/stores/pwa';
	import { activeSchedule } from '$lib/stores/schedule';
	import { exerciseHistory } from '$lib/stores/history';
	import { getPRDisplayData, setUserOverride, clearUserOverride, oneRMCacheStore, type ExercisePRDisplay } from '$lib/stores/oneRMCache';
	import EditableField from '$lib/components/EditableField.svelte';
	import EditableHeightField from '$lib/components/EditableHeightField.svelte';
	import EditableBirthdayField from '$lib/components/EditableBirthdayField.svelte';
	import EditableSelectField from '$lib/components/EditableSelectField.svelte';
	import PRCard from '$lib/components/profile/PRCard.svelte';
	import EquipmentEditor from '$lib/components/profile/EquipmentEditor.svelte';
	import AddPRModal from '$lib/components/profile/AddPRModal.svelte';
	import ExerciseHistoryModal from '$lib/components/profile/ExerciseHistoryModal.svelte';
	import { lbsToKg, kgToLbs, ALL_EQUIPMENT_TYPES, type EquipmentType } from '$lib/types/user';
	import { usesExternalLoad } from '$lib/engine/exercise-metadata';

	// PWA update state
	$: pwaState = $pwaStore;

	async function handleCheckForUpdates() {
		const hasUpdate = await pwaStore.checkForUpdates();
		// Only show "up to date" if no update found AND no error occurred
		if (!hasUpdate && !$pwaStore.updateAvailable && !$pwaStore.error) {
			alert('App is up to date!');
		}
	}

	function handleApplyUpdate() {
		pwaStore.applyUpdate();
	}

	function handleForceRefresh() {
		pwaStore.forceHardRefresh();
	}

	// Reactive user data
	$: userData = $userStore;
	$: profile = userData.profile;
	$: preferences = userData.preferences;
	$: oneRepMaxes = userData.oneRepMaxes;
	$: unitSystem = profile.unitSystem;

	// Reactive display values - explicit dependencies on unitSystem
	$: displayWeight = unitSystem === 'imperial' ? profile.weightLbs : lbsToKg(profile.weightLbs);
	$: weightUnit = unitSystem === 'imperial' ? 'lbs' : 'kg';

	// Reactive 1RM display values - map of exercise name to display weight
	$: oneRepMaxDisplayValues = oneRepMaxes.reduce(
		(acc, orm) => {
			acc[orm.exerciseName] =
				unitSystem === 'imperial' ? orm.weightLbs : lbsToKg(orm.weightLbs);
			return acc;
		},
		{} as Record<string, number>
	);

	// Extract exercises from current program for PR display
	$: currentProgramExercises = extractProgramExercises($activeSchedule);

	// Compute PR data - must be a function that takes the cache to create proper reactive dependency
	function computePRData(cache: typeof $oneRMCacheStore, exercises: string[]): ExercisePRDisplay[] {
		// The cache parameter ensures this re-runs when cache changes
		return exercises.map(name => getPRDisplayData(name)).filter((pr): pr is ExercisePRDisplay => pr !== null);
	}
	$: programPRData = computePRData($oneRMCacheStore, currentProgramExercises);

	function extractProgramExercises(schedule: typeof $activeSchedule): string[] {
		if (!schedule) return [];

		const exerciseNames = new Set<string>();
		for (const day of Object.values(schedule.days)) {
			for (const exercise of day.exercises) {
				// Skip compound parent names (EMOM, Circuit, etc.) - they're not real exercises
				if (!exercise.name.match(/^(EMOM|AMRAP|Circuit|Interval)/i)) {
					// Only include exercises that use external load (for PR tracking)
					if (usesExternalLoad(exercise.name)) {
						exerciseNames.add(exercise.name);
					}
				}
				// Include sub-exercises from compound blocks
				if (exercise.sub_exercises) {
					for (const sub of exercise.sub_exercises) {
						if (usesExternalLoad(sub.name)) {
							exerciseNames.add(sub.name);
						}
					}
				}
			}
		}
		return Array.from(exerciseNames).sort();
	}

	function handlePROverride(e: CustomEvent<{ exerciseName: string; value: number }>) {
		const { exerciseName, value } = e.detail;
		setUserOverride(exerciseName, value);
		// Always update user store so override persists across app restarts
		userStore.updateOneRepMax(exerciseName, value, true);
	}

	// Add PR modal state (for Current Program PRs)
	let showAddPRModal = false;
	// Add 1RM modal state (for 1RM section)
	let show1RMModal = false;
	// Exercise history modal state
	let showHistoryModal = false;

	// History stats for display
	$: historyRowCount = $exerciseHistory.filter(r => !r.is_compound_parent).length;

	// PR display state - sorted by 1RM descending, limited to top 5 by default
	let showAllPRs = false;
	$: sortedPRData = [...programPRData].sort((a, b) => b.estimated1RM - a.estimated1RM);
	$: displayedPRData = showAllPRs ? sortedPRData : sortedPRData.slice(0, 5);

	// Legacy search state (kept for compatibility but not used in new UI)
	let prSearchQuery = '';

	function handleAddPR(exerciseName: string, weightLbs: number) {
		setUserOverride(exerciseName, weightLbs);
		// Also update user store so override persists across app restarts
		userStore.updateOneRepMax(exerciseName, weightLbs, true);
		showAddPRModal = false;
	}

	function handleAdd1RM(exerciseName: string, weightLbs: number) {
		userStore.updateOneRepMax(exerciseName, weightLbs, true);
		setUserOverride(exerciseName, weightLbs);
		show1RMModal = false;
	}

	function handleRemove1RM(exerciseName: string) {
		userStore.removeOneRepMax(exerciseName);
		// Also clear cache entry so DayView updates (falls back to history if available)
		clearUserOverride(exerciseName);
	}

	// Preference options from questionnaire
	const goalOptions = [
		{ value: 'build_muscle', label: 'Build Muscle' },
		{ value: 'tone', label: 'Tone / Get Fit' },
		{ value: 'lose_weight', label: 'Lose Weight' }
	];

	const durationOptions = [
		{ value: '20', label: '20 minutes' },
		{ value: '30', label: '30 minutes' },
		{ value: '60', label: '60 minutes' }
	];

	const experienceOptions = [
		{ value: 'beginner', label: 'Beginner' },
		{ value: 'intermediate', label: 'Intermediate' },
		{ value: 'advanced', label: 'Advanced' }
	];

	const frequencyOptions = [
		{ value: '2', label: '2 days/week' },
		{ value: '3', label: '3 days/week' },
		{ value: '4', label: '4 days/week' },
		{ value: '5', label: '5 days/week' },
		{ value: '6', label: '6 days/week' },
		{ value: '7', label: '7 days/week' }
	];

	const programDurationOptions = [
		{ value: '3', label: '3 weeks' },
		{ value: '4', label: '4 weeks' },
		{ value: '6', label: '6 weeks' }
	];

	// Handlers
	function handleNameChange(e: CustomEvent<string | number>) {
		userStore.updateProfile({ name: String(e.detail) });
	}

	function handleHeightChange(e: CustomEvent<number>) {
		userStore.updateProfile({ heightInches: e.detail });
	}

	function handleWeightChange(e: CustomEvent<string | number>) {
		let weightLbs = Number(e.detail);
		// Convert from kg if metric
		if (unitSystem === 'metric') {
			weightLbs = kgToLbs(weightLbs);
		}
		userStore.updateProfile({ weightLbs });
	}

	function handleBirthdayChange(e: CustomEvent<string>) {
		userStore.updateProfile({ birthday: e.detail });
	}

	function handleGoalChange(e: CustomEvent<string>) {
		userStore.updatePreferences({
			goal: e.detail as 'build_muscle' | 'tone' | 'lose_weight'
		});
	}

	function handleDurationChange(e: CustomEvent<string>) {
		userStore.updatePreferences({ session_duration: e.detail as '20' | '30' | '60' });
	}

	function handleExperienceChange(e: CustomEvent<string>) {
		userStore.updatePreferences({
			experience_level: e.detail as 'beginner' | 'intermediate' | 'advanced'
		});
	}

	function handleFrequencyChange(e: CustomEvent<string>) {
		userStore.updatePreferences({
			training_frequency: e.detail as '2' | '3' | '4' | '5' | '6' | '7'
		});
	}

	function handleProgramDurationChange(e: CustomEvent<string>) {
		userStore.updatePreferences({ program_duration: e.detail as '3' | '4' | '6' });
	}

	function handleOneRepMaxChange(exerciseName: string, e: CustomEvent<string | number>) {
		let weightLbs = Number(e.detail);
		// Convert from kg if metric
		if (unitSystem === 'metric') {
			weightLbs = kgToLbs(weightLbs);
		}
		userStore.updateOneRepMax(exerciseName, weightLbs, true);
	}

	function toggleUnits() {
		userStore.setUnitSystem(unitSystem === 'imperial' ? 'metric' : 'imperial');
	}

	// Equipment editor state
	let homeEquipmentExpanded = false;
	let gymEquipmentExpanded = false;

	// Equipment undo state - tracks previous values for undo functionality
	let previousHomeEquipment: EquipmentType[] | null = null;
	let previousGymEquipment: EquipmentType[] | null = null;

	// Reactive equipment lists
	$: homeEquipment = preferences.homeEquipment ?? [];
	$: gymEquipment = preferences.gymEquipment ?? [];

	// Equipment handlers
	function handleHomeEquipmentToggle(item: EquipmentType) {
		previousHomeEquipment = [...homeEquipment];
		userStore.toggleEquipment('home', item);
	}

	function handleGymEquipmentToggle(item: EquipmentType) {
		previousGymEquipment = [...gymEquipment];
		userStore.toggleEquipment('gym', item);
	}

	function handleHomeSelectAll() {
		previousHomeEquipment = [...homeEquipment];
		userStore.updateHomeEquipment([...ALL_EQUIPMENT_TYPES]);
	}

	function handleHomeClearAll() {
		previousHomeEquipment = [...homeEquipment];
		userStore.updateHomeEquipment([]);
	}

	function handleGymSelectAll() {
		previousGymEquipment = [...gymEquipment];
		userStore.updateGymEquipment([...ALL_EQUIPMENT_TYPES]);
	}

	function handleGymClearAll() {
		previousGymEquipment = [...gymEquipment];
		userStore.updateGymEquipment([]);
	}

	function handleHomeUndo() {
		if (previousHomeEquipment !== null) {
			const current = [...homeEquipment];
			userStore.updateHomeEquipment(previousHomeEquipment);
			previousHomeEquipment = current;
		}
	}

	function handleGymUndo() {
		if (previousGymEquipment !== null) {
			const current = [...gymEquipment];
			userStore.updateGymEquipment(previousGymEquipment);
			previousGymEquipment = current;
		}
	}
</script>

<div class="overflow-auto bg-slate-900 px-4 py-6 pb-20 lg:px-8" style="height: calc(100dvh - 4rem - env(safe-area-inset-bottom, 0px))">
	<div class="max-w-6xl mx-auto">
		<!-- Header with name and unit toggle -->
		<div class="flex items-center justify-between mb-6 lg:mb-8">
			<div class="flex items-center gap-3 lg:gap-4">
				<!-- Avatar placeholder -->
				<div
					class="w-14 h-14 lg:w-20 lg:h-20 rounded-full bg-slate-700 flex items-center justify-center
                  text-2xl lg:text-4xl font-bold text-indigo-400"
				>
					{profile.name.charAt(0).toUpperCase()}
				</div>
				<div>
					<h1 class="text-xl lg:text-3xl font-bold text-white">{profile.name}</h1>
					<p class="text-slate-400 text-sm lg:text-base">Tap any field to edit</p>
				</div>
			</div>

			<!-- Unit toggle -->
			<button
				onclick={toggleUnits}
				class="px-3 py-1 lg:px-4 lg:py-2 rounded-full text-xs lg:text-sm font-medium transition-colors
               {unitSystem === 'imperial'
					? 'bg-indigo-600 text-white'
					: 'bg-slate-700 text-slate-300 hover:bg-slate-600'}"
			>
				{unitSystem === 'imperial' ? 'lbs/ft' : 'kg/cm'}
			</button>
		</div>

		<!-- Main content grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
			<!-- Stats Section -->
			<section class="bg-slate-800 rounded-lg px-4 divide-y divide-slate-700 h-fit">
				<h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3">Stats</h2>

				<EditableField
					value={profile.name}
					label="Name"
					type="text"
					on:change={handleNameChange}
				/>

				<EditableHeightField
					heightInches={profile.heightInches}
					{unitSystem}
					on:change={handleHeightChange}
				/>

				<EditableField
					value={displayWeight}
					label="Weight"
					type="number"
					suffix={weightUnit}
					min={unitSystem === 'imperial' ? 50 : 23}
					max={unitSystem === 'imperial' ? 500 : 227}
					on:change={handleWeightChange}
				/>

				<EditableBirthdayField
					birthday={profile.birthday}
					on:change={handleBirthdayChange}
				/>
			</section>

			<!-- 1RM Section -->
			<section class="bg-slate-800 rounded-lg px-4 divide-y divide-slate-700 h-fit">
				<div class="flex items-center justify-between py-3">
					<h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
						1RM (One Rep Max)
					</h2>
					<button
						onclick={() => (show1RMModal = true)}
						class="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
						aria-label="Add 1RM"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
					</button>
				</div>

				{#if oneRepMaxes.length === 0}
					<div class="py-6 text-center text-slate-400">
						<p class="text-sm">No lifts tracked yet.</p>
						<p class="text-xs mt-1">Add your first 1RM using the + button above.</p>
					</div>
				{:else}
					{#each oneRepMaxes as orm (orm.exerciseName)}
						<div class="flex items-center gap-2">
							<div class="flex-1">
								<EditableField
									value={oneRepMaxDisplayValues[orm.exerciseName] ?? 0}
									label={orm.exerciseName}
									type="number"
									suffix={weightUnit}
									min={0}
									max={unitSystem === 'imperial' ? 1000 : 454}
									on:change={(e) => handleOneRepMaxChange(orm.exerciseName, e)}
								/>
							</div>
							<button
								onclick={() => handleRemove1RM(orm.exerciseName)}
								class="p-2 text-slate-500 hover:text-red-400 transition-colors"
								aria-label="Remove {orm.exerciseName}"
							>
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
								</svg>
							</button>
						</div>
					{/each}
				{/if}
			</section>

			<!-- Workout Preferences Section -->
			<section class="bg-slate-800 rounded-lg px-4 divide-y divide-slate-700 h-fit md:col-span-2 lg:col-span-1">
				<h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3">
					Workout Preferences
				</h2>

				<EditableSelectField
					value={preferences.goal}
					label="Goal"
					options={goalOptions}
					on:change={handleGoalChange}
				/>

				<EditableSelectField
					value={preferences.session_duration}
					label="Session Duration"
					options={durationOptions}
					on:change={handleDurationChange}
				/>

				<EditableSelectField
					value={preferences.experience_level}
					label="Experience"
					options={experienceOptions}
					on:change={handleExperienceChange}
				/>

				<EditableSelectField
					value={preferences.training_frequency}
					label="Training Days"
					options={frequencyOptions}
					on:change={handleFrequencyChange}
				/>

				<EditableSelectField
					value={preferences.program_duration}
					label="Program Length"
					options={programDurationOptions}
					on:change={handleProgramDurationChange}
				/>
			</section>
		</div>

		<!-- Equipment Profiles Section -->
		<section class="mt-6">
			<h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
				Equipment Profiles
			</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<EquipmentEditor
					location="home"
					equipment={homeEquipment}
					bind:expanded={homeEquipmentExpanded}
					ontoggle={handleHomeEquipmentToggle}
					onselectAll={handleHomeSelectAll}
					onclearAll={handleHomeClearAll}
					onundo={handleHomeUndo}
					canUndo={previousHomeEquipment !== null}
				/>
				<EquipmentEditor
					location="gym"
					equipment={gymEquipment}
					bind:expanded={gymEquipmentExpanded}
					ontoggle={handleGymEquipmentToggle}
					onselectAll={handleGymSelectAll}
					onclearAll={handleGymClearAll}
					onundo={handleGymUndo}
					canUndo={previousGymEquipment !== null}
				/>
			</div>
		</section>

		<!-- Data & History Section -->
		<section class="mt-6 bg-slate-800 rounded-lg p-4">
			<h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Data & History</h2>

			<button
				onclick={() => showHistoryModal = true}
				class="w-full flex items-center justify-between p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors group"
			>
				<div class="flex items-center gap-3">
					<div class="p-2 bg-indigo-600/20 rounded-lg">
						<svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
						</svg>
					</div>
					<div class="text-left">
						<p class="text-white font-medium">Exercise History</p>
						<p class="text-slate-400 text-sm">{historyRowCount} logged sets</p>
					</div>
				</div>
				<svg class="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
				</svg>
			</button>
		</section>

		<!-- Current Program PRs Section -->
		{#if currentProgramExercises.length > 0}
			<section class="mt-6 bg-slate-800 rounded-lg p-4">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
						Current Program PRs
					</h2>
					<div class="flex items-center gap-2">
						<span class="text-xs text-slate-500">
							{programPRData.length} of {currentProgramExercises.length} tracked
						</span>
						<button
							onclick={() => (showAddPRModal = true)}
							class="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
							aria-label="Add PR"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
							</svg>
						</button>
					</div>
				</div>

				{#if programPRData.length > 0}
					{#if displayedPRData.length > 0}
						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
							{#each displayedPRData as prData (prData.exerciseName)}
								<PRCard
									{prData}
									{unitSystem}
									on:override={handlePROverride}
								/>
							{/each}
						</div>
						{#if !showAllPRs && sortedPRData.length > 5}
							<button
								onclick={() => showAllPRs = true}
								class="w-full mt-3 py-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex items-center justify-center gap-1"
							>
								See all {sortedPRData.length} exercises
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							</button>
						{:else if showAllPRs && sortedPRData.length > 5}
							<button
								onclick={() => showAllPRs = false}
								class="w-full mt-3 py-2 text-sm text-slate-400 hover:text-slate-300 transition-colors flex items-center justify-center gap-1"
							>
								Show less
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
								</svg>
							</button>
						{/if}
					{:else}
						<div class="text-center py-6 text-slate-400">
							<p class="text-sm">No exercises match "{prSearchQuery}"</p>
						</div>
					{/if}
				{:else}
					<div class="text-center py-8 text-slate-400">
						<p>No exercise history yet.</p>
						<p class="text-sm mt-1">Complete workouts in Live view to see your PRs here,</p>
						<p class="text-sm">or manually add PRs using the + button above.</p>
					</div>
				{/if}
			</section>
		{:else if !$activeSchedule}
			<section class="mt-6 bg-slate-800 rounded-lg p-4">
				<div class="flex items-center justify-between mb-4">
					<h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider">
						Current Program PRs
					</h2>
					<button
						onclick={() => (showAddPRModal = true)}
						class="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
						aria-label="Add PR"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
						</svg>
					</button>
				</div>
				<div class="text-center py-8 text-slate-400">
					<p>No active schedule.</p>
					<p class="text-sm mt-1">Create a schedule in the Schedule tab to see your PRs here,</p>
					<p class="text-sm">or manually add PRs using the + button above.</p>
				</div>
			</section>
		{/if}

		<!-- App Info Section -->
		<section class="mt-6 bg-slate-800 rounded-lg p-4">
			<h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">App</h2>

			<div class="flex items-center justify-between">
				<div>
					<p class="text-white font-medium">Shredly</p>
					<p class="text-slate-400 text-sm">Version {APP_VERSION}</p>
				</div>

				<div class="flex items-center gap-2">
					{#if pwaState.updateAvailable}
						<button
							onclick={handleApplyUpdate}
							class="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
							</svg>
							Update Now
						</button>
					{:else}
						<button
							onclick={handleCheckForUpdates}
							disabled={pwaState.checking}
							class="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
						>
							{#if pwaState.checking}
								<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								Checking...
							{:else}
								<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
								</svg>
								Check for Updates
							{/if}
						</button>
					{/if}
				</div>
			</div>

			{#if pwaState.error}
				<p class="mt-2 text-red-400 text-sm">{pwaState.error}</p>
			{/if}

			<!-- Force refresh option -->
			<div class="mt-3 pt-3 border-t border-slate-700">
				<button
					onclick={handleForceRefresh}
					class="text-slate-400 hover:text-white text-sm underline"
				>
					Force refresh (clear cache)
				</button>
			</div>
		</section>
	</div>
</div>

<!-- Add PR Modal (for Current Program PRs) -->
<AddPRModal
	isOpen={showAddPRModal}
	{unitSystem}
	onconfirm={handleAddPR}
	oncancel={() => (showAddPRModal = false)}
/>

<!-- Add 1RM Modal -->
<AddPRModal
	isOpen={show1RMModal}
	{unitSystem}
	onconfirm={handleAdd1RM}
	oncancel={() => (show1RMModal = false)}
/>

<!-- Exercise History Modal -->
<ExerciseHistoryModal
	isOpen={showHistoryModal}
	{unitSystem}
	onclose={() => (showHistoryModal = false)}
/>
