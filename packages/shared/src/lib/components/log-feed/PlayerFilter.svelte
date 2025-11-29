<script lang="ts">
	import { Users } from '@lucide/svelte';
	import { filterState } from '../../filterState.svelte.js';

	// Get all unique players from filterState (populated by appState effect)
	const allPlayers = $derived(filterState.availablePlayers);

	// Count of enabled/disabled players in current context
	const totalPlayerCount = $derived(allPlayers.length);

	// Count how many players are enabled
	// Empty set = all enabled, otherwise count matches
	const enabledInContext = $derived(
		filterState.players.size === 0
			? allPlayers.length
			: allPlayers.filter(player => filterState.players.has(player)).length
	);
	const disabledCount = $derived(totalPlayerCount - enabledInContext);

	// Button label - show "Players" or "Players (X)" where X = number of disabled players
	const buttonLabel = $derived(
		disabledCount === 0 ? 'Players' : `Players (${disabledCount})`
	);

	// Handle checkbox change
	function handleToggle(playerName: string) {
		filterState.togglePlayer(playerName);
	}

	// Quick actions
	function selectAll() {
		filterState.enableAllPlayers();
	}

	function selectNone() {
		filterState.disableAllPlayers();
	}
</script>

<div class="player-filter relative">
	<!-- Filter Button -->
	<button
		popovertarget="player-filter-popover"
		id="player-filter-button"
		class="flex items-center gap-1 rounded border border-white/5 px-2 py-1 text-sm font-medium text-white/70 transition-colors duration-200 hover:bg-white/10 hover:text-white md:px-3"
		aria-haspopup="true"
	>
		<Users size={16} />
		<span>{buttonLabel}</span>
	</button>

	<!-- Dropdown Panel -->
	<div
		id="player-filter-popover"
		popover="auto"
		class="w-80 bg-secondary border border-white/10 rounded-lg shadow-lg text-white"
	>
		<!-- Player Checkboxes -->
		<div class="max-h-[min(24rem,calc(100vh-200px))] overflow-y-auto scrollbar-custom flex flex-col">
			{#if allPlayers.length === 0}
				<div class="px-4 py-6 text-center text-sm text-muted">
					No players found in logs
				</div>
			{:else}
				{#each allPlayers as playerName (playerName)}
					{@const isEnabled = filterState.isPlayerEnabled(playerName)}
					<label
						class="flex items-center gap-3 px-3 py-1.5 hover:bg-white/5 cursor-pointer transition-colors"
					>
						<input
							type="checkbox"
							checked={isEnabled}
							onchange={() => handleToggle(playerName)}
							class="w-4 h-4 shrink-0 rounded border-white/10 bg-white/5 accent-discord focus:ring-2 focus:ring-discord focus:ring-offset-0 cursor-pointer"
						/>
						<span class="flex-1 text-sm font-medium text-white/90">
							{playerName}
						</span>
					</label>
				{/each}
			{/if}
		</div>

		<!-- Footer -->
		<div class="px-4 py-2 border-t border-white/10 text-xs text-muted">
			{#if totalPlayerCount === 0}
				No players available
			{:else if disabledCount === 0}
				Showing all {totalPlayerCount} players
			{:else}
				{disabledCount} {disabledCount === 1 ? 'player' : 'players'} hidden
			{/if}
		</div>
	</div>
</div>

<style>
	#player-filter-popover {
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
		transition:
			opacity 200ms,
			display 200ms allow-discrete,
			overlay 200ms allow-discrete;
	}

	/* Hide popover when closed to prevent it from taking up layout space */
	#player-filter-popover:not(:popover-open) {
		display: none;
	}

	#player-filter-popover:popover-open {
		opacity: 1;

		@starting-style {
			opacity: 0;
		}
	}
</style>
