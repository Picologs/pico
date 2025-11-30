<script lang="ts">
	import type { Log, LogEventType } from '@pico/types';
	import { ListFilter } from '@lucide/svelte';
	import { filterState, ALL_LOG_TYPES } from '../../filterState.svelte.js';
	import { appState } from '../../app.svelte.js';
	import { countLogsByEventType } from '../../utils/log-utils.js';

	interface Props {
		currentPlayer?: string | null;
		allLogs?: Log[];
	}

	let { currentPlayer = null, allLogs = [] }: Props = $props();

	// Map display labels to multiple event types (consolidated groups)
	const filterGroups: Record<string, LogEventType[]> = {
		Connections: ['connection'],
		'Ship Control': ['vehicle_control_flow', 'vehicle_control_group'],
		Deaths: ['actor_death', 'killing_spree'],
		Locations: ['location_change', 'inventory_group'],
		Destruction: ['destruction'],
		'Session End': ['system_quit'],
		Respawns: ['hospital_respawn', 'medical_bed', 'respawn_group'],
		Missions: ['mission_shared', 'mission_completed'],
		'Mission Objectives': ['mission_objective', 'mission_objective_group'],
		'Bounty Kills': ['bounty_marker', 'bounty_kill', 'bounty_kill_group'],
		Landing: ['landing_pad'],
		Medical: ['medical_bed'],
		Purchases: ['purchase'],
		Insurance: ['insurance_claim', 'insurance_group'],
		'Quantum Travel': ['quantum_travel', 'quantum_arrival'],
		Equipment: ['equipment_received', 'equipment_group'],
		'Environmental Hazards': ['environmental_hazard', 'environmental_hazard_group']
	};

	const filterMeta: Record<string, { emoji: string }> = {
		Connections: { emoji: '🔗' },
		'Ship Control': { emoji: '🚀' },
		Deaths: { emoji: '💀' },
		Locations: { emoji: '📍' },
		Destruction: { emoji: '💥' },
		'Session End': { emoji: '🔌' },
		Respawns: { emoji: '🏥' },
		Missions: { emoji: '📋' },
		'Mission Objectives': { emoji: '🎯' },
		'Bounty Kills': { emoji: '🎯' },
		Landing: { emoji: '🛬' },
		Medical: { emoji: '🛏️' },
		Purchases: { emoji: '🛒' },
		Insurance: { emoji: '📋' },
		'Quantum Travel': { emoji: '⚡' },
		Equipment: { emoji: '🎒' },
		'Environmental Hazards': { emoji: '⚠️' }
	};

	// Category groupings for better UX
	const categories = [
		{
			label: 'Combat',
			filters: ['Deaths', 'Destruction', 'Respawns', 'Environmental Hazards']
		},
		{
			label: 'Navigation',
			filters: ['Ship Control', 'Locations', 'Quantum Travel', 'Landing']
		},
		{
			label: 'Activities',
			filters: ['Missions', 'Mission Objectives', 'Bounty Kills', 'Purchases', 'Equipment']
		},
		{
			label: 'Services',
			filters: ['Medical', 'Insurance']
		},
		{
			label: 'Session',
			filters: ['Connections', 'Session End']
		}
	];

	// Compute counts for each filter group (sum of all related event types)
	const filterCounts = $derived.by(() => {
		const counts = countLogsByEventType(appState.logs);
		const grouped: Record<string, number> = {};

		Object.entries(filterGroups).forEach(([label, types]) => {
			grouped[label] = types.reduce((sum, type) => sum + (counts[type] || 0), 0);
		});

		return grouped;
	});

	// Count of enabled filter groups
	const enabledCount = $derived.by(() => {
		let count = 0;
		Object.entries(filterGroups).forEach(([_label, types]) => {
			if (types.every((t) => filterState.eventTypes.has(t))) {
				count++;
			}
		});
		return count;
	});

	// Count of disabled filter groups (active filters)
	const totalFilterCount = Object.keys(filterGroups).length;
	const disabledCount = $derived(totalFilterCount - enabledCount);

	// Button label - show "Events" or "Events (X)" where X = number of active filters
	const buttonLabel = $derived(
		disabledCount === 0 ? 'Events' : `Events (${disabledCount})`
	);


	// Handle checkbox change - toggles all related event types
	function handleToggle(filterLabel: string) {
		const eventTypes = filterGroups[filterLabel];
		const allEnabled = eventTypes.every((t) => filterState.eventTypes.has(t));

		eventTypes.forEach((t) => {
			if (allEnabled) {
				filterState.eventTypes.delete(t);
			} else {
				filterState.eventTypes.add(t);
			}
		});

		// Trigger reactivity and save
		filterState.eventTypes = new Set(filterState.eventTypes);
	}

	// Check if all filters in a category are enabled
	function isCategoryEnabled(category: (typeof categories)[0]): boolean {
		return category.filters.every((label) =>
			filterGroups[label].every((t) => filterState.eventTypes.has(t))
		);
	}

	// Toggle all filters in a category
	function handleCategoryToggle(category: (typeof categories)[0]) {
		const allEnabled = isCategoryEnabled(category);

		category.filters.forEach((label) => {
			const eventTypes = filterGroups[label];
			eventTypes.forEach((t) => {
				if (allEnabled) {
					filterState.eventTypes.delete(t);
				} else {
					filterState.eventTypes.add(t);
				}
			});
		});

		// Trigger reactivity and save
		filterState.eventTypes = new Set(filterState.eventTypes);
	}

	// Quick actions
	function selectAll() {
		filterState.enableAllEventTypes();
	}

	function selectNone() {
		filterState.disableAllEventTypes();
	}

	function selectCombatOnly() {
		filterState.setCombatOnly();
	}

</script>

<div class="log-type-filter relative">
	<!-- Filter Button -->
	<button
		popovertarget="log-filter-popover"
		id="filter-button"
		class="flex items-center gap-1 rounded border border-white/5 px-2 py-1 text-sm font-medium text-white/70 transition-colors duration-200 hover:bg-white/10 hover:text-white md:px-3"
		aria-haspopup="true"
	>
		<ListFilter size={16} />
		<span>{buttonLabel}</span>
	</button>

	<!-- Dropdown Panel -->
	<div
		id="log-filter-popover"
		popover="auto"
		class="w-80 bg-secondary border border-white/10 rounded-lg shadow-lg text-white"
	>
			<!-- Log Type Checkboxes with Categories -->
			<div class="max-h-[min(24rem,calc(100vh-200px))] overflow-y-auto scrollbar-custom flex flex-col gap-3">
				{#each categories as category, index (category.label)}
					{@const categoryEnabled = isCategoryEnabled(category)}
				<div class="flex flex-col gap-1">
						<!-- Category Label with Checkbox -->
						<label
							class="sticky top-0 z-10 flex items-center gap-3 px-3 py-2 bg-[#273944] text-xs font-semibold text-muted uppercase tracking-wider cursor-pointer hover:text-white/80 transition-colors"
						>
							<input
								type="checkbox"
								checked={categoryEnabled}
								onchange={() => handleCategoryToggle(category)}
								class="w-4 h-4 rounded border-white/10 bg-white/5 accent-discord focus:ring-2 focus:ring-discord focus:ring-offset-0 cursor-pointer"
							/>
							{category.label}
						</label>

						<!-- Filters in this category -->
						{#each category.filters as label (label)}
							{@const meta = filterMeta[label]}
							{@const count = filterCounts[label] || 0}
							{@const isEnabled = filterGroups[label].every((t) => filterState.eventTypes.has(t))}
							<label
								class="flex items-center gap-3 px-3 py-1.5 hover:bg-white/5 cursor-pointer transition-colors"
							>
								<input
									type="checkbox"
									checked={isEnabled}
									onchange={() => handleToggle(label)}
									class="w-4 h-4 shrink-0 rounded border-white/10 bg-white/5 accent-discord focus:ring-2 focus:ring-discord focus:ring-offset-0 cursor-pointer"
								/>
								<span class="text-xl">{meta.emoji}</span>
								<span class="flex-1 text-sm font-medium text-white/90">
									{label}
								</span>
								<span
									class="px-2 py-0.5 text-xs font-semibold text-muted bg-overlay-light rounded-full"
								>
									{count}
								</span>
							</label>
						{/each}

					</div>
				{/each}
			</div>

			<!-- Footer -->
			<div
				class="px-4 py-2 border-t border-white/10 text-xs text-muted"
			>
				Showing {enabledCount} of {totalFilterCount} types
			</div>
	</div>
</div>

<style>
	#log-filter-popover {
		/* Reset default popover centering - CRITICAL! */
		inset: auto;
		margin: 0;

		/* Anchor positioning using implicit anchor from popovertarget */
		position: fixed;
		top: anchor(bottom);
		left: anchor(left);
		margin-top: 0.25rem;

		/* Animations - overlay keeps anchor during close animation */
		opacity: 0;
		transition: opacity 200ms, display 200ms allow-discrete, overlay 200ms allow-discrete;
	}

	/* Hide popover when closed to prevent it from taking up layout space */
	#log-filter-popover:not(:popover-open) {
		display: none;
	}

	#log-filter-popover:popover-open {
		opacity: 1;

		@starting-style {
			opacity: 0;
		}
	}
</style>
