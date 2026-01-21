<script lang="ts">
	import { exerciseHistory, type HistoryRow, clearHistory, toLocalDateString } from '$lib/stores/history';
	import { lbsToKg } from '$lib/types/user';

	interface Props {
		isOpen: boolean;
		unitSystem: 'imperial' | 'metric';
		onclose?: () => void;
	}

	let { isOpen, unitSystem, onclose }: Props = $props();

	// Sort state
	type SortField = 'date' | 'exercise_name' | 'weight' | 'reps' | 'rpe';
	type SortDirection = 'asc' | 'desc';
	let sortField: SortField = $state('date');
	let sortDirection: SortDirection = $state('desc');

	// Filter state
	let searchQuery = $state('');
	let dateFilter = $state<'all' | '7d' | '30d' | '90d'>('all');

	// Confirm clear state
	let showClearConfirm = $state(false);

	// Download history as CSV
	function handleDownload() {
		const rows = $exerciseHistory.filter(r => !r.is_compound_parent);
		if (rows.length === 0) return;

		// CSV header
		const headers = ['Date', 'Exercise', 'Set', 'Weight', 'Unit', 'Reps', 'RPE', 'Work Time (s)', 'Notes'];
		const csvRows = [headers.join(',')];

		// Convert rows to CSV
		for (const row of rows) {
			const csvRow = [
				row.date,
				`"${row.exercise_name.replace(/"/g, '""')}"`,
				row.set_number,
				row.weight ?? '',
				row.weight_unit ?? '',
				row.reps ?? '',
				row.rpe ?? '',
				row.work_time ?? '',
				row.notes ? `"${row.notes.replace(/"/g, '""')}"` : ''
			];
			csvRows.push(csvRow.join(','));
		}

		const csv = csvRows.join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		const today = new Date().toISOString().split('T')[0];
		a.download = `shredly-history-${today}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	// Reset state when modal opens
	$effect(() => {
		if (isOpen) {
			searchQuery = '';
			dateFilter = 'all';
			sortField = 'date';
			sortDirection = 'desc';
			showClearConfirm = false;
		}
	});

	// Filter and sort history
	let filteredHistory = $derived.by(() => {
		let rows = $exerciseHistory.filter(r => !r.is_compound_parent);

		// Apply date filter
		if (dateFilter !== 'all') {
			const now = new Date();
			const days = dateFilter === '7d' ? 7 : dateFilter === '30d' ? 30 : 90;
			const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
			const cutoffStr = toLocalDateString(cutoff);
			rows = rows.filter(r => r.date >= cutoffStr);
		}

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			rows = rows.filter(r => r.exercise_name.toLowerCase().includes(query));
		}

		// Apply sorting
		rows = [...rows].sort((a, b) => {
			let cmp = 0;
			switch (sortField) {
				case 'date':
					cmp = a.timestamp.localeCompare(b.timestamp);
					break;
				case 'exercise_name':
					cmp = a.exercise_name.localeCompare(b.exercise_name);
					break;
				case 'weight':
					cmp = (a.weight ?? 0) - (b.weight ?? 0);
					break;
				case 'reps':
					cmp = (a.reps ?? 0) - (b.reps ?? 0);
					break;
				case 'rpe':
					cmp = (a.rpe ?? 0) - (b.rpe ?? 0);
					break;
			}
			return sortDirection === 'asc' ? cmp : -cmp;
		});

		return rows;
	});

	// Format display values
	function formatDate(dateStr: string): string {
		const d = new Date(dateStr + 'T00:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function formatWeight(weight: number | null, unit: string | null): string {
		if (weight === null) return '-';
		const displayWeight = unitSystem === 'metric' ? Math.round(lbsToKg(weight)) : weight;
		return `${displayWeight}`;
	}

	function formatReps(reps: number | null): string {
		return reps !== null ? `${reps}` : '-';
	}

	function formatRpe(rpe: number | null): string {
		return rpe !== null ? `${rpe}` : '-';
	}

	function formatWorkTime(time: number | null): string {
		if (time === null) return '-';
		if (time >= 60) return `${Math.floor(time / 60)}m`;
		return `${time}s`;
	}

	// Sort handler
	function handleSort(field: SortField) {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'desc';
		}
	}

	function handleClose() {
		onclose?.();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			handleClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			if (showClearConfirm) {
				showClearConfirm = false;
			} else {
				handleClose();
			}
		}
	}

	function handleClearHistory() {
		clearHistory();
		showClearConfirm = false;
	}

	let weightUnit = $derived(unitSystem === 'imperial' ? 'lbs' : 'kg');

	// Summary stats
	let totalRows = $derived($exerciseHistory.filter(r => !r.is_compound_parent).length);
	let uniqueExercises = $derived(new Set($exerciseHistory.map(r => r.exercise_name)).size);
	let uniqueDays = $derived(new Set($exerciseHistory.map(r => r.date)).size);
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
	<!-- Modal backdrop - full screen on mobile -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70"
		onclick={handleBackdropClick}
	>
		<!-- Modal content - full screen on mobile, centered card on desktop -->
		<div
			class="bg-slate-900 w-full sm:w-[95vw] sm:max-w-4xl sm:rounded-2xl overflow-hidden flex flex-col
			       h-[100dvh] sm:h-auto sm:max-h-[90vh]"
			style="padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px);"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header - sticky -->
			<div class="flex-shrink-0 bg-slate-800 border-b border-slate-700">
				<div class="flex items-center justify-between px-4 py-3">
					<div class="flex items-center gap-3">
						<button
							onclick={handleClose}
							class="p-2 -ml-2 text-slate-400 hover:text-white transition-colors rounded-lg sm:hidden"
							aria-label="Close"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
							</svg>
						</button>
						<div>
							<h2 class="text-lg font-semibold text-white">Exercise History</h2>
							<p class="text-xs text-slate-400">
								{totalRows} sets | {uniqueExercises} exercises | {uniqueDays} days
							</p>
						</div>
					</div>
					<div class="flex items-center gap-1">
						{#if totalRows > 0}
							<button
								onclick={handleDownload}
								class="p-2 text-slate-400 hover:text-white transition-colors rounded-lg"
								aria-label="Download history"
								title="Download as CSV"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
								</svg>
							</button>
						{/if}
						<button
							onclick={handleClose}
							class="hidden sm:block p-2 text-slate-400 hover:text-white transition-colors rounded-lg"
							aria-label="Close"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					</div>
				</div>

				<!-- Filters -->
				<div class="px-4 pb-3 flex flex-wrap gap-2">
					<!-- Search -->
					<div class="relative flex-1 min-w-[150px]">
						<svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
						</svg>
						<input
							type="text"
							placeholder="Search exercises..."
							bind:value={searchQuery}
							class="w-full pl-9 pr-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
						/>
					</div>

					<!-- Date filter pills -->
					<div class="flex gap-1">
						{#each [['all', 'All'], ['7d', '7d'], ['30d', '30d'], ['90d', '90d']] as [value, label]}
							<button
								onclick={() => dateFilter = value as typeof dateFilter}
								class="px-3 py-2 text-xs font-medium rounded-lg transition-colors
								       {dateFilter === value
									       ? 'bg-indigo-600 text-white'
									       : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'}"
							>
								{label}
							</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Table container - scrollable -->
			<div class="flex-1 overflow-auto">
				{#if filteredHistory.length === 0}
					<div class="flex flex-col items-center justify-center h-full text-center p-8">
						<svg class="w-16 h-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
						</svg>
						<p class="text-slate-400 text-lg font-medium mb-1">No history found</p>
						<p class="text-slate-500 text-sm">
							{searchQuery ? `No exercises match "${searchQuery}"` : 'Complete workouts in Live view to see history here'}
						</p>
					</div>
				{:else}
					<!-- Desktop table -->
					<table class="w-full text-sm hidden sm:table">
						<thead class="bg-slate-800/80 sticky top-0 z-10">
							<tr class="text-left text-xs text-slate-400 uppercase tracking-wider">
								<th class="px-4 py-3 font-semibold">
									<button onclick={() => handleSort('date')} class="flex items-center gap-1 hover:text-white transition-colors">
										Date
										{#if sortField === 'date'}
											<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
												<path d={sortDirection === 'desc' ? 'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' : 'M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z'} />
											</svg>
										{/if}
									</button>
								</th>
								<th class="px-4 py-3 font-semibold">
									<button onclick={() => handleSort('exercise_name')} class="flex items-center gap-1 hover:text-white transition-colors">
										Exercise
										{#if sortField === 'exercise_name'}
											<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
												<path d={sortDirection === 'desc' ? 'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' : 'M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z'} />
											</svg>
										{/if}
									</button>
								</th>
								<th class="px-4 py-3 font-semibold text-right">Set</th>
								<th class="px-4 py-3 font-semibold text-right">
									<button onclick={() => handleSort('weight')} class="flex items-center gap-1 hover:text-white transition-colors ml-auto">
										{weightUnit}
										{#if sortField === 'weight'}
											<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
												<path d={sortDirection === 'desc' ? 'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' : 'M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z'} />
											</svg>
										{/if}
									</button>
								</th>
								<th class="px-4 py-3 font-semibold text-right">
									<button onclick={() => handleSort('reps')} class="flex items-center gap-1 hover:text-white transition-colors ml-auto">
										Reps
										{#if sortField === 'reps'}
											<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
												<path d={sortDirection === 'desc' ? 'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' : 'M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z'} />
											</svg>
										{/if}
									</button>
								</th>
								<th class="px-4 py-3 font-semibold text-right">
									<button onclick={() => handleSort('rpe')} class="flex items-center gap-1 hover:text-white transition-colors ml-auto">
										RPE
										{#if sortField === 'rpe'}
											<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
												<path d={sortDirection === 'desc' ? 'M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' : 'M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z'} />
											</svg>
										{/if}
									</button>
								</th>
								<th class="px-4 py-3 font-semibold text-right">Time</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-800">
							{#each filteredHistory as row, i (row.timestamp + row.exercise_name + row.set_number)}
								<tr class="hover:bg-slate-800/50 transition-colors {i % 2 === 0 ? 'bg-slate-900' : 'bg-slate-900/50'}">
									<td class="px-4 py-2.5 text-slate-300 whitespace-nowrap">{formatDate(row.date)}</td>
									<td class="px-4 py-2.5 text-white font-medium max-w-[200px] truncate" title={row.exercise_name}>{row.exercise_name}</td>
									<td class="px-4 py-2.5 text-slate-400 text-right tabular-nums">{row.set_number}</td>
									<td class="px-4 py-2.5 text-white text-right tabular-nums font-medium">{formatWeight(row.weight, row.weight_unit)}</td>
									<td class="px-4 py-2.5 text-white text-right tabular-nums">{formatReps(row.reps)}</td>
									<td class="px-4 py-2.5 text-right tabular-nums {row.rpe && row.rpe >= 9 ? 'text-red-400' : row.rpe && row.rpe >= 7 ? 'text-yellow-400' : 'text-slate-300'}">{formatRpe(row.rpe)}</td>
									<td class="px-4 py-2.5 text-slate-400 text-right tabular-nums">{formatWorkTime(row.work_time)}</td>
								</tr>
							{/each}
						</tbody>
					</table>

					<!-- Mobile card view -->
					<div class="sm:hidden divide-y divide-slate-800">
						{#each filteredHistory as row (row.timestamp + row.exercise_name + row.set_number)}
							<div class="px-4 py-3 bg-slate-900">
								<div class="flex items-start justify-between gap-2 mb-1.5">
									<div class="flex-1 min-w-0">
										<p class="text-white font-medium truncate">{row.exercise_name}</p>
										<p class="text-xs text-slate-400">{formatDate(row.date)} | Set {row.set_number}</p>
									</div>
									{#if row.rpe}
										<span class="flex-shrink-0 px-2 py-0.5 rounded text-xs font-medium
										            {row.rpe >= 9 ? 'bg-red-900/50 text-red-300' : row.rpe >= 7 ? 'bg-yellow-900/50 text-yellow-300' : 'bg-slate-700 text-slate-300'}">
											RPE {row.rpe}
										</span>
									{/if}
								</div>
								<div class="flex items-center gap-4 text-sm">
									{#if row.weight !== null}
										<span class="text-white font-medium">{formatWeight(row.weight, row.weight_unit)} {weightUnit}</span>
									{/if}
									{#if row.reps !== null}
										<span class="text-slate-300">{row.reps} reps</span>
									{/if}
									{#if row.work_time !== null}
										<span class="text-slate-400">{formatWorkTime(row.work_time)}</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Footer - sticky -->
			<div class="flex-shrink-0 px-4 py-3 bg-slate-800 border-t border-slate-700">
				<div class="flex items-center justify-between">
					<p class="text-xs text-slate-400">
						{filteredHistory.length} of {totalRows} sets
					</p>
					{#if totalRows > 0}
						{#if showClearConfirm}
							<div class="flex items-center gap-2">
								<span class="text-xs text-red-400">Clear all history?</span>
								<button
									onclick={() => showClearConfirm = false}
									class="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
								>
									Cancel
								</button>
								<button
									onclick={handleClearHistory}
									class="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
								>
									Confirm
								</button>
							</div>
						{:else}
							<button
								onclick={() => showClearConfirm = true}
								class="text-xs text-slate-400 hover:text-red-400 transition-colors"
							>
								Clear History
							</button>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}
