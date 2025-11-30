<script lang="ts">
	import type { ScoreboardEntry } from '../../utils/log-utils.js';
	import { Info, X } from '@lucide/svelte';
	import Avatar from '../Avatar.svelte';

	interface Props {
		entries: ScoreboardEntry[];
		currentPlayer: string | null;
		playerKills?: number;
		aiKills?: number;
		playerShipsDestroyed?: number;
		aiShipsDestroyed?: number;
		deaths?: number;
		currentUserId?: string;
		currentUserDiscordId?: string;
		currentUserAvatar?: string;
	}

	let {
		entries = [],
		currentPlayer = null,
		playerKills = 0,
		aiKills = 0,
		playerShipsDestroyed = 0,
		aiShipsDestroyed = 0,
		deaths = 0,
		currentUserId = undefined,
		currentUserDiscordId = undefined,
		currentUserAvatar = undefined
	}: Props = $props();

	// Dialog reference
	let scoreboardDialog: HTMLDialogElement | undefined;

	// Export functions for parent to control dialog
	export function openScoreboard() {
		scoreboardDialog?.showModal();
	}

	export function closeScoreboard() {
		scoreboardDialog?.close();
	}

	function getScoreColor(score: number): string {
		if (score > 0) return 'text-green-400';
		if (score < 0) return 'text-red-400';
		return 'text-white/70';
	}

	// Calculate your session stats
	const yourScore = $derived(
		playerKills * 2 + playerShipsDestroyed * 2 + aiKills * 1 + aiShipsDestroyed * 1 + deaths * -2
	);
	const yourKdRatio = $derived(deaths > 0 ? (playerKills + aiKills) / deaths : playerKills + aiKills);

	// Tooltip popover reference
	let scoreTooltip: HTMLElement | undefined;

	// Show tooltip with fallback positioning
	function showTooltipWithFallback() {
		if (!scoreTooltip) return;

		try {
			scoreTooltip.showPopover();

			// Fallback positioning if CSS anchor positioning doesn't work
			const button = document.getElementById('score-info-icon');
			if (button && !CSS.supports('anchor-name', '--test')) {
				const rect = button.getBoundingClientRect();
				Object.assign(scoreTooltip.style, {
					left: `${rect.left + rect.width / 2}px`,
					top: `${rect.bottom + 8}px`,
					transform: 'translateX(-50%)'
				});
			}
		} catch (e) {
			// Silent fail
		}
	}

	function hideTooltipWithDebug() {
		try {
			scoreTooltip?.hidePopover();
		} catch (e) {
			// Silent fail
		}
	}
</script>

<!--
	Scoreboard dialog - auto-centers, no viewport overflow issues
	ESC key to close (built-in), click backdrop to close (built-in)
-->
<dialog
	bind:this={scoreboardDialog}
	id="scoreboard-dialog"
	class="fixed top-1/2 left-1/2 w-[min(90vw,800px)] max-h-[90vh] bg-secondary border border-white/10 rounded-lg shadow-lg text-white backdrop:bg-black/50 m-0 p-0"
>
	<!-- Header with Title and Close Button -->
	<div class="flex items-center justify-between px-2 py-2 border-b border-white/10">
		<h2 class="text-lg font-semibold flex items-center gap-2">
			<span>🏆</span> Scoreboard
		</h2>
		<button
			onclick={closeScoreboard}
			class="p-1.5 rounded hover:bg-white/10 transition-colors text-white/70 hover:text-white"
			aria-label="Close scoreboard"
		>
			<X size={20} />
		</button>
	</div>

	<!-- Responsive wrapper for horizontal scroll on mobile -->
	<div class="overflow-x-auto">
		<table class="w-full border-collapse text-xs">
			<!-- Table Header -->
			<thead>
				<tr class="border-b border-white/10">
					<th class="px-3 py-2 text-left text-muted font-medium whitespace-nowrap">Rank</th>
					<th class="px-3 py-2 text-left text-muted font-medium whitespace-nowrap">Player</th>
					<th class="px-3 py-2 text-center text-muted font-medium whitespace-nowrap">⚔️ PKills</th>
					<th class="px-3 py-2 text-center text-muted font-medium whitespace-nowrap">🤖 AI Kills</th>
					<th class="px-3 py-2 text-center text-muted font-medium whitespace-nowrap">🚀 P.Ships</th>
					<th class="px-3 py-2 text-center text-muted font-medium whitespace-nowrap">💥 AI Ships</th>
					<th class="px-3 py-2 text-center text-muted font-medium whitespace-nowrap">💀 Deaths</th>
					<th class="px-3 py-2 text-center text-muted font-medium whitespace-nowrap">
					<div class="flex items-center justify-center gap-1">
						Score
						<button
							id="score-info-icon"
							class="inline-flex"
						>
							<Info size={14} class="text-muted hover:text-white cursor-help transition-colors" />
						</button>
					</div>
				</th>
					<th class="px-3 py-2 text-center text-muted font-medium whitespace-nowrap">K/D</th>
				</tr>
			</thead>

			<tbody>
				<!-- Your Session Row -->
				<tr class="bg-white/10 border-l-2 border-discord hover:bg-white/15 transition-colors">
					<td class="px-3 py-2">
						<div class="w-6 h-6 rounded-full bg-discord flex items-center justify-center text-white font-bold text-xs">
							★
						</div>
					</td>
					<td class="px-3 py-2 font-medium text-white whitespace-nowrap">
						<div class="flex items-center gap-2">
							<Avatar
								discordId={currentUserDiscordId}
								avatar={currentUserAvatar}
								userId={currentUserId}
								size={8}
								showOnline={false}
							/>
							<span>
								{#if currentPlayer && currentPlayer !== 'You'}
									{currentPlayer} <span class="text-xs text-muted ml-1">(You)</span>
								{:else}
									You
								{/if}
							</span>
						</div>
					</td>
					<td class="px-3 py-2 text-center text-white font-medium">{playerKills}</td>
					<td class="px-3 py-2 text-center text-white font-medium">{aiKills}</td>
					<td class="px-3 py-2 text-center text-white font-medium">{playerShipsDestroyed}</td>
					<td class="px-3 py-2 text-center text-white font-medium">{aiShipsDestroyed}</td>
					<td class="px-3 py-2 text-center text-white font-medium">{deaths}</td>
					<td class="px-3 py-2 text-center font-bold {getScoreColor(yourScore)}">
						{yourScore > 0 ? '+' : ''}{yourScore}
					</td>
					<td class="px-3 py-2 text-center text-white font-medium">{yourKdRatio.toFixed(2)}</td>
				</tr>

				<!-- Other Players -->
				{#if entries.length === 0}
					<tr>
						<td colspan="9" class="px-4 py-8 text-center text-muted">
							<p>No other players to display</p>
							<p class="text-xs mt-1">
								{#if currentPlayer}
									Waiting for combat activity...
								{:else}
									Player stats will appear here
								{/if}
							</p>
						</td>
					</tr>
				{:else}
					{#each entries as entry (entry.userId)}
						{@const isCurrentPlayer = entry.playerName === currentPlayer}
						<tr
							class="border-b border-white/5 hover:bg-white/5 transition-colors {isCurrentPlayer ? 'bg-white/10 border-l-2 border-discord' : ''}"
						>
							<!-- Rank Badge -->
							<td class="px-3 py-2">
								<div
									class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold {entry.rank === 1 ? 'bg-yellow-500 text-yellow-900' : entry.rank === 2 ? 'bg-gray-400 text-gray-900' : entry.rank === 3 ? 'bg-orange-600 text-orange-100' : 'bg-white/10 text-white/70'}"
								>
									#{entry.rank}
								</div>
							</td>

							<!-- Player Name -->
							<td class="px-3 py-2 font-medium {isCurrentPlayer ? 'text-white' : 'text-white/90'} whitespace-nowrap">
								<div class="flex items-center gap-2">
									<Avatar
										discordId={entry.discordId}
										avatar={entry.avatar}
										userId={entry.userId}
										size={8}
										showOnline={entry.isOnline}
										isOnline={entry.isOnline}
									/>
									<span>
										{entry.playerName}
										{#if isCurrentPlayer}
											<span class="text-xs text-muted ml-1">(You)</span>
										{/if}
									</span>
								</div>
							</td>

							<!-- Stats -->
							<td class="px-3 py-2 text-center text-white/90">{entry.playerKills}</td>
							<td class="px-3 py-2 text-center text-white/90">{entry.aiKills}</td>
							<td class="px-3 py-2 text-center text-white/90">{entry.playerShipsDestroyed}</td>
							<td class="px-3 py-2 text-center text-white/90">{entry.aiShipsDestroyed}</td>
							<td class="px-3 py-2 text-center text-white/90">{entry.deaths}</td>

							<!-- Score -->
							<td class="px-3 py-2 text-center font-bold {getScoreColor(entry.score)}">
								{entry.score > 0 ? '+' : ''}{entry.score}
							</td>

							<!-- K/D Ratio -->
							<td class="px-3 py-2 text-center text-white/90">{entry.kdRatio.toFixed(2)}</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<!-- Score Info Tooltip Popover -->
	<div
		id="score-info-tooltip"
		role="tooltip"
		class="score-tooltip"
	>
		<div class="font-semibold mb-2 text-white">Score Calculation:</div>
		<div class="space-y-1 text-left">
			<div>⚔️ Player Kills: <span class="text-green-400">+2 points</span></div>
			<div>🚀 Player Ships: <span class="text-green-400">+2 points</span></div>
			<div>🤖 AI Kills: <span class="text-green-400">+1 point</span></div>
			<div>💥 AI Ships: <span class="text-green-400">+1 point</span></div>
			<div>💀 Deaths: <span class="text-red-400">-2 points</span></div>
		</div>
	</div>
</dialog>

<style>
	/* Dialog styling - positioning handled by Tailwind */
	#scoreboard-dialog {
		position: absolute;
		/* Override default dialog border */
		border: 1px solid rgb(255 255 255 / 0.1);

		/* Animation */
		opacity: 0;
		transform: translate(-50%, -50%) scale(0.95);
		transition: opacity 200ms, transform 200ms, display 200ms allow-discrete, overlay 200ms allow-discrete;

		overflow: visible;
	}

	#scoreboard-dialog[open] {
		opacity: 1;
		transform: translate(-50%, -50%) scale(1);

		@starting-style {
			opacity: 0;
			transform: translate(-50%, -50%) scale(0.95);
		}
	}

	/* Backdrop */
	#scoreboard-dialog::backdrop {
		background: rgba(0, 0, 0, 0.5);
		opacity: 0;
		transition: opacity 200ms, display 200ms allow-discrete, overlay 200ms allow-discrete;
	}

	#scoreboard-dialog[open]::backdrop {
		opacity: 1;

		@starting-style {
			opacity: 0;
		}
	}


	#score-info-icon {
		anchor-name: --score-info-anchor;
		
	}

	/* Score tooltip popover */
	.score-tooltip {
		/* CSS Anchor Positioning */
		position: absolute;
		position-anchor: --score-info-anchor;
		position-area: end;

		/* Styling */
		padding: 1rem;
		background: rgb(15, 35, 47);
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 0.5rem;
		font-size: 0.875rem;
		color: white;
		white-space: nowrap;
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);

		display: none;

	}

	:has(#score-info-icon:hover) #score-info-tooltip {
		display: block;
	}

</style>
