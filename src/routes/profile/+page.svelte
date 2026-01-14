<script lang="ts">
	import { onMount } from 'svelte';
	import { navigationStore } from '$lib/stores/navigation';
	import { userStore } from '$lib/stores/user';
	import { pwaStore, APP_VERSION } from '$lib/stores/pwa';
	import EditableField from '$lib/components/EditableField.svelte';
	import EditableHeightField from '$lib/components/EditableHeightField.svelte';
	import EditableSelectField from '$lib/components/EditableSelectField.svelte';
	import { lbsToKg, kgToLbs, BIG_4_LIFTS } from '$lib/types/user';

	onMount(() => {
		navigationStore.setActiveTab('profile');
	});

	// PWA update state
	$: pwaState = $pwaStore;

	async function handleCheckForUpdates() {
		const hasUpdate = await pwaStore.checkForUpdates();
		if (!hasUpdate && !pwaState.updateAvailable) {
			// No update found, show brief feedback
			alert('App is up to date!');
		}
	}

	function handleApplyUpdate() {
		pwaStore.applyUpdate();
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

	const equipmentOptions = [
		{ value: 'full_gym', label: 'Full Gym' },
		{ value: 'dumbbells_only', label: 'Dumbbells Only' },
		{ value: 'bodyweight_only', label: 'Bodyweight / Basic' }
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

	function handleAgeChange(e: CustomEvent<string | number>) {
		userStore.updateProfile({ age: Number(e.detail) });
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

	function handleEquipmentChange(e: CustomEvent<string>) {
		userStore.updatePreferences({
			equipment_access: e.detail as 'full_gym' | 'dumbbells_only' | 'bodyweight_only'
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

				<EditableField
					value={profile.age}
					label="Age"
					type="number"
					suffix="years"
					min={13}
					max={100}
					on:change={handleAgeChange}
				/>
			</section>

			<!-- 1RM Section (Big 4) -->
			<section class="bg-slate-800 rounded-lg px-4 divide-y divide-slate-700 h-fit">
				<h2 class="text-xs font-semibold text-slate-500 uppercase tracking-wider py-3">
					1RM (One Rep Max)
				</h2>

				{#each BIG_4_LIFTS as lift}
					<EditableField
						value={oneRepMaxDisplayValues[lift] ?? 0}
						label={lift}
						type="number"
						suffix={weightUnit}
						min={0}
						max={unitSystem === 'imperial' ? 1000 : 454}
						on:change={(e) => handleOneRepMaxChange(lift, e)}
					/>
				{/each}
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
					value={preferences.equipment_access}
					label="Equipment"
					options={equipmentOptions}
					on:change={handleEquipmentChange}
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
		</section>
	</div>
</div>
