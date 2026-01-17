<script lang="ts">
	import {
		type EquipmentType,
		type WorkoutLocation,
		EQUIPMENT_CATEGORIES,
		ALL_EQUIPMENT_TYPES
	} from '$lib/types/user';

	interface Props {
		location: WorkoutLocation;
		equipment: EquipmentType[];
		expanded?: boolean;
		ontoggle?: (item: EquipmentType) => void;
		onselectAll?: () => void;
		onclearAll?: () => void;
	}

	let {
		location,
		equipment,
		expanded = $bindable(false),
		ontoggle,
		onselectAll,
		onclearAll
	}: Props = $props();

	// Track which categories are expanded
	let expandedCategories: Record<string, boolean> = $state({});

	// Get count of selected equipment
	let selectedCount = $derived(equipment.length);
	let totalCount = $derived(ALL_EQUIPMENT_TYPES.length);

	// Check if equipment is selected
	function isSelected(item: EquipmentType): boolean {
		return equipment.includes(item);
	}

	// Count selected in category
	function categorySelectedCount(items: EquipmentType[]): number {
		return items.filter((item) => equipment.includes(item)).length;
	}

	function handleToggle(item: EquipmentType) {
		ontoggle?.(item);
	}

	function handleSelectAll() {
		onselectAll?.();
	}

	function handleClearAll() {
		onclearAll?.();
	}

	function toggleCategory(category: string) {
		expandedCategories[category] = !expandedCategories[category];
	}

	// Location display info
	let locationIcon = $derived(location === 'gym' ? 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' : 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6');
	let locationLabel = $derived(location === 'gym' ? 'Gym Equipment' : 'Home Equipment');
	let locationColor = $derived(location === 'gym' ? 'indigo' : 'emerald');
</script>

<div class="bg-slate-800 rounded-lg overflow-hidden">
	<!-- Header - clickable to expand/collapse -->
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		class="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/50 transition-colors"
	>
		<div class="flex items-center gap-3">
			<div
				class="w-8 h-8 rounded-lg flex items-center justify-center
					   {locationColor === 'indigo' ? 'bg-indigo-600/20' : 'bg-emerald-600/20'}"
			>
				<svg
					class="w-4 h-4 {locationColor === 'indigo' ? 'text-indigo-400' : 'text-emerald-400'}"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d={locationIcon}
					/>
				</svg>
			</div>
			<div class="text-left">
				<h3 class="text-sm font-medium text-white">{locationLabel}</h3>
				<p class="text-xs text-slate-400">{selectedCount} of {totalCount} selected</p>
			</div>
		</div>
		<svg
			class="w-5 h-5 text-slate-400 transition-transform {expanded ? 'rotate-180' : ''}"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	<!-- Expanded content -->
	{#if expanded}
		<div class="border-t border-slate-700 px-4 py-3">
			<!-- Quick actions -->
			<div class="flex gap-2 mb-4">
				<button
					type="button"
					onclick={handleSelectAll}
					class="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
				>
					Select All
				</button>
				<button
					type="button"
					onclick={handleClearAll}
					class="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
				>
					Clear All
				</button>
			</div>

			<!-- Equipment categories -->
			<div class="space-y-2">
				{#each Object.entries(EQUIPMENT_CATEGORIES) as [category, items]}
					{@const catSelected = categorySelectedCount(items)}
					<div class="bg-slate-900/50 rounded-lg overflow-hidden">
						<!-- Category header -->
						<button
							type="button"
							onclick={() => toggleCategory(category)}
							class="w-full flex items-center justify-between px-3 py-2"
						>
							<span class="text-xs font-medium text-slate-300">{category}</span>
							<div class="flex items-center gap-2">
								<span class="text-xs text-slate-500">
									{catSelected}/{items.length}
								</span>
								<svg
									class="w-4 h-4 text-slate-500 transition-transform {expandedCategories[category]
										? 'rotate-180'
										: ''}"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							</div>
						</button>

						<!-- Category items -->
						{#if expandedCategories[category]}
							<div class="px-3 pb-3 grid grid-cols-2 gap-1.5">
								{#each items as item}
									<button
										type="button"
										onclick={() => handleToggle(item)}
										class="flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors
											   {isSelected(item)
											? locationColor === 'indigo'
												? 'bg-indigo-600/20 text-indigo-300'
												: 'bg-emerald-600/20 text-emerald-300'
											: 'bg-slate-800 text-slate-400 hover:bg-slate-700'}"
									>
										<!-- Checkbox indicator -->
										<div
											class="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center
												   {isSelected(item)
												? locationColor === 'indigo'
													? 'bg-indigo-600 border-indigo-600'
													: 'bg-emerald-600 border-emerald-600'
												: 'border-slate-600'}"
										>
											{#if isSelected(item)}
												<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
													<path
														fill-rule="evenodd"
														d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
														clip-rule="evenodd"
													/>
												</svg>
											{/if}
										</div>
										<span class="text-xs truncate">{item}</span>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
