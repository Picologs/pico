<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { env } from '$env/dynamic/public';
	import { enhance } from '$app/forms';
	import {
		ChevronRight,
		Loader2,
		Radio,
		Users,
		Monitor,
		Smartphone,
		Download
	} from '@lucide/svelte';
	import { DiscordIcon, LogFeed } from '@pico/shared';
	import type { Log } from '@pico/shared';
	import fleetData from '@pico/shared/data/fleet.json';
	import { getTrackedEvents } from './events.remote';

	// FAQ state for lazy loading
	let eventsOpen = $state(false);

	// Fake user data for demo
	const fakeUserMap: Record<string, string> = {
		'fake-user-1': 'SkyRunner42',
		'fake-user-2': 'VoidPilot',
		'fake-user-3': 'StarHunter',
		'fake-user-4': 'NovaExplorer',
		'fake-user-5': 'CosmicTrader'
	};

	// Function to get fake display names
	function getUserDisplayName(userId: string): string | null {
		return fakeUserMap[userId] || null;
	}

	// WebSocket and demo state
	let ws: WebSocket | null = $state(null);
	let logs: Log[] = $state([]);
	let isConnecting = $state(true);
	let connectionError = $state(false);

	// Props for LogFeed component (typed to avoid component prop type errors)
	const logFeedProps: any = $derived({
		logs: logs,
		getUserDisplayName: getUserDisplayName,
		fleet: fleetData,
		autoScroll: true,
		showJumpToPresent: false,
		showScoreboard: false,
		showFilterBar: false
	});

	// Reconnection state
	let reconnectAttempts = 0;
	let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
	let isManualDisconnect = false;
	const MAX_RECONNECT_ATTEMPTS = 10;
	const MAX_LOGS = 100; // Memory limit for demo logs

	/**
	 * Calculate exponential backoff delay
	 * 1s → 2s → 4s → 8s → 16s → max 30s
	 */
	function getReconnectDelay(): number {
		const baseDelay = 1000;
		const maxDelay = 30000;
		const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts), maxDelay);
		return delay;
	}

	/**
	 * Connect or reconnect to WebSocket
	 */
	async function connect() {
		if (!browser) return;

		// Use /demo endpoint (auto-subscribes, no auth required)
		const baseUrl = env.PUBLIC_WS_URL || 'ws://localhost:8080';
		const wsUrl = baseUrl.replace(/\/ws$/, '') + '/demo';

		// Clear any pending reconnect
		if (reconnectTimeout) {
			clearTimeout(reconnectTimeout);
			reconnectTimeout = null;
		}

		// Close existing connection
		if (ws) {
			ws.close();
			ws = null;
		}

		isConnecting = true;
		connectionError = false;

		// Start mock service before connecting (silent - fire and forget)
		const apiUrl = baseUrl.replace(/^ws/, 'http').replace(/\/ws$/, '');
		fetch(`${apiUrl}/api/mock/start`, { method: 'POST' }).catch(() => {
			// Ignore errors - mock service might already be running
		});

		try {
			ws = new WebSocket(wsUrl);

			ws.onopen = () => {
				console.log('[Demo] WebSocket connected to demo endpoint');
				isConnecting = false;
				connectionError = false;
				reconnectAttempts = 0; // Reset on successful connection
				// No need to send subscribe_demo - auto-subscribed on connection
			};

			ws.onmessage = (event) => {
				try {
					const message = JSON.parse(event.data);

					// Handle ping/pong for keepalive
					if (message.type === 'ping') {
						ws?.send(JSON.stringify({ type: 'pong' }));
						return;
					}

					if (message.type === 'receive_logs') {
						console.log('[Demo] Adding logs:', message.data.logs.length);
						// Add new logs, keep last MAX_LOGS (no hard limit, but prevent memory issues)
						logs = [...logs, ...message.data.logs].slice(-MAX_LOGS);
						console.log('[Demo] Total logs now:', logs.length);
					} else if (message.type === 'demo_subscribed') {
						console.log('[Demo] Successfully subscribed to demo logs');
					}
				} catch (error) {
					console.error('[Demo] Error parsing WebSocket message:', error);
				}
			};

			ws.onerror = (error) => {
				console.error('[Demo] WebSocket error:', error);
				connectionError = true;
			};

			ws.onclose = () => {
				console.log('[Demo] WebSocket closed');
				isConnecting = false;
				ws = null;

				// Attempt reconnection if not manual disconnect
				if (!isManualDisconnect) {
					attemptReconnect();
				}
			};
		} catch (error) {
			console.error('[Demo] Failed to create WebSocket:', error);
			isConnecting = false;
			connectionError = true;
			attemptReconnect();
		}
	}

	/**
	 * Attempt to reconnect with exponential backoff
	 */
	function attemptReconnect() {
		if (isManualDisconnect) {
			return;
		}

		if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
			console.error('[Demo] Max reconnection attempts reached');
			connectionError = true;
			return;
		}

		const delay = getReconnectDelay();
		reconnectAttempts++;

		console.log(
			`[Demo] Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
		);

		reconnectTimeout = setTimeout(() => {
			connect();
		}, delay);
	}

	onMount(() => {
		// Initial connection
		connect();

		// Cleanup on unmount
		return () => {
			isManualDisconnect = true;
			if (reconnectTimeout) {
				clearTimeout(reconnectTimeout);
			}
			if (ws) {
				ws.close();
			}
		};
	});
</script>

<div class="flex min-h-svh flex-col bg-primary">
	<!-- Header -->
	<header
		class="flex w-full items-center justify-between border-b border-white/5 bg-black/30 px-4 py-3 sm:px-6"
	>
		<h1 class="flex items-center gap-2 text-xl font-medium sm:text-2xl">
			<img src="/pico-icon.png" alt="Picologs" class="h-7 w-7 sm:h-8 sm:w-8" />
			Picologs
		</h1>

		<form method="POST" use:enhance>
			<button
				type="submit"
				class="flex items-center gap-2 rounded-md border border-discord-hover bg-discord px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-discord-hover sm:px-4 sm:text-base"
			>
				<DiscordIcon />
				<span class="hidden sm:inline">Sign in with Discord</span>
				<span class="sm:hidden">Sign in</span>
			</button>
		</form>
	</header>

	<!-- Main Content - Centered Layout -->
	<div class="flex flex-1 items-center justify-center px-6 py-12">
		<div
			class="flex w-full max-w-6xl flex-col items-center gap-8 lg:flex-row lg:items-center lg:justify-between"
		>
			<!-- Hero Content -->
			<div class="flex max-w-xl flex-col gap-6 text-center lg:text-left">
				<h2
					class="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl"
				>
					Star Citizen<br />Logs Synced
				</h2>

				<p class="text-base leading-relaxed text-white/80 sm:text-lg md:text-xl">
					See real-time updates of your friends' online status, ships, kill feeds, deaths and more.
				</p>

				<!-- CTA Buttons -->
				<div class="flex justify-center lg:justify-start">
					<a
						href="/download"
						data-sveltekit-reload
						class="flex items-center justify-center gap-2 rounded-md border border-discord-hover bg-discord px-6 py-3 text-base font-medium text-white transition-colors hover:bg-discord-hover sm:text-lg"
					>
						<Download class="h-5 w-5" />
						Download App
					</a>
				</div>

				<!-- Feature Highlights -->
				<div class="mt-8 grid grid-cols-1 gap-4 text-left sm:grid-cols-3">
					<div class="rounded-lg border border-white/10 bg-white/5 p-4">
						<div class="mb-2 flex items-center gap-2">
							<Radio size={16} class="text-white" />
							<h3 class="text-sm font-semibold text-white">Real-Time Sync</h3>
						</div>
						<p class="text-xs text-white/60">Watch your friends' game activity as it happens</p>
					</div>
					<div class="rounded-lg border border-white/10 bg-white/5 p-4">
						<div class="mb-2 flex items-center gap-2">
							<Users size={16} class="text-white" />
							<h3 class="text-sm font-semibold text-white">Group Features</h3>
						</div>
						<p class="text-xs text-white/60">Create groups and share logs with your org</p>
					</div>
					<div class="rounded-lg border border-white/10 bg-white/5 p-4">
						<div class="mb-2 flex items-center gap-2">
							<Monitor size={16} class="text-white" />
							<h3 class="text-sm font-semibold text-white">Desktop & Web</h3>
						</div>
						<p class="text-xs text-white/60">Check in with friends and groups via the web</p>
					</div>
				</div>
			</div>

			<!-- Log Feed Preview -->
			<div class="relative w-full max-w-xl lg:w-full">
				<!-- Browser Shell -->
				<div class="overflow-hidden rounded-lg border border-white/10 bg-secondary/50">
					<!-- Title Bar with Windows Controls -->
					<div
						class="flex items-center justify-between gap-2 border-b border-white/10 bg-black/40 px-3 py-2.5"
					>
						<div class="flex items-center gap-2">
							<img src="/pico-icon.png" alt="Picologs" class="h-4 w-4" />
							<span class="text-xs text-white/70">Picologs</span>
						</div>
						<div class="flex gap-1">
							<!-- Minimize -->
							<div class="flex h-5 w-7 items-center justify-center">
								<div class="h-px w-2.5 bg-white/10"></div>
							</div>
							<!-- Maximize -->
							<div class="flex h-5 w-7 items-center justify-center">
								<div class="h-2.5 w-2.5 border border-white/10"></div>
							</div>
							<!-- Close -->
							<div class="flex h-5 w-7 items-center justify-center">
								<svg class="h-2.5 w-2.5" viewBox="0 0 10 10" fill="none">
									<path
										d="M1 1L9 9M9 1L1 9"
										stroke="currentColor"
										stroke-width="1.5"
										class="text-white/10"
									/>
								</svg>
							</div>
						</div>
					</div>

					<!-- Content Area -->
					<div class="relative h-[28rem]">
						{#if isConnecting}
							<div class="flex h-full flex-col items-center justify-center gap-3 text-white/60">
								<Loader2 class="h-6 w-6 animate-spin" />
								<p class="text-xs">Connecting...</p>
							</div>
						{:else if connectionError}
							<div class="flex h-full flex-col items-center justify-center gap-2 text-white/60">
								<p class="text-xs">Unable to connect</p>
								<p class="text-xs text-white/40">Try again later</p>
							</div>
						{:else}
							<LogFeed {...logFeedProps} />
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Social Features Section -->
	<section class="bg-stars border-t border-white/5 px-6 py-20">
		<div class="mx-auto max-w-5xl">
			<div class="mb-12 text-center">
				<h2 class="mb-4 text-3xl font-bold text-white sm:text-4xl">Find Your Crew</h2>
				<p class="mx-auto max-w-2xl text-lg text-white/70">
					Connect with other pilots, join active communities, and never fly alone again.
				</p>
			</div>

			<div class="grid gap-6 sm:grid-cols-3">
				<div class="rounded-xl border border-white/20 bg-white/10 p-6 text-center backdrop-blur-md">
					<div
						class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-discord/20"
					>
						<Users size={24} class="text-discord" />
					</div>
					<h3 class="mb-2 text-lg font-semibold text-white">Discoverable Groups</h3>
					<p class="text-sm text-white/60">
						Browse public groups to find orgs and communities looking for new members.
					</p>
				</div>

				<div class="rounded-xl border border-white/20 bg-white/10 p-6 text-center backdrop-blur-md">
					<div
						class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-discord/20"
					>
						<Radio size={24} class="text-discord" />
					</div>
					<h3 class="mb-2 text-lg font-semibold text-white">Live Activity Feed</h3>
					<p class="text-sm text-white/60">
						See when friends come online, what ships they're flying, and where they are.
					</p>
				</div>

				<div class="rounded-xl border border-white/20 bg-white/10 p-6 text-center backdrop-blur-md">
					<div
						class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-discord/20"
					>
						<Monitor size={24} class="text-discord" />
					</div>
					<h3 class="mb-2 text-lg font-semibold text-white">Play Sessions</h3>
					<p class="text-sm text-white/60">
						Coordinate with your crew and jump into the verse together.
					</p>
				</div>
			</div>
		</div>
	</section>

	<!-- FAQ Section -->
	<section class="border-t border-white/5 px-6 py-16">
		<div class="mx-auto max-w-3xl">
			<h2 class="mb-8 text-center text-2xl font-bold text-white sm:text-3xl">
				Frequently Asked Questions
			</h2>

			<div class="space-y-3">
				<details class="group rounded-lg border border-white/10 bg-white/5">
					<summary
						class="flex cursor-pointer items-center justify-between px-5 py-4 text-left text-white transition-colors hover:bg-white/5"
					>
						<span class="font-medium">What is Picologs?</span>
						<ChevronRight
							size={18}
							class="text-white/60 transition-transform group-open:rotate-90"
						/>
					</summary>
					<div class="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-white/70">
						Picologs is a real-time log sharing tool for Star Citizen. It lets you see what your
						friends are doing in-game (kills, deaths, ship changes, location updates) as it happens.
					</div>
				</details>

				<details class="group rounded-lg border border-white/10 bg-white/5">
					<summary
						class="flex cursor-pointer items-center justify-between px-5 py-4 text-left text-white transition-colors hover:bg-white/5"
					>
						<span class="font-medium">Is Picologs free?</span>
						<ChevronRight
							size={18}
							class="text-white/60 transition-transform group-open:rotate-90"
						/>
					</summary>
					<div class="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-white/70">
						Yes, 100% free. No ads, no premium tiers, no hidden costs. Picologs is a passion project
						built for the Star Citizen community.
					</div>
				</details>

				<details class="group rounded-lg border border-white/10 bg-white/5">
					<summary
						class="flex cursor-pointer items-center justify-between px-5 py-4 text-left text-white transition-colors hover:bg-white/5"
					>
						<span class="font-medium">How can I support Picologs?</span>
						<ChevronRight
							size={18}
							class="text-white/60 transition-transform group-open:rotate-90"
						/>
					</summary>
					<div class="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-white/70">
						Picologs is free. If you'd like to help out with server costs, you can
						<a
							href="https://buymeacoffee.com/picologs"
							target="_blank"
							rel="noopener noreferrer"
							class="text-blue-400 hover:underline">buy me a coffee</a
						>. Totally optional but hugely appreciated!
					</div>
				</details>

				<details class="group rounded-lg border border-white/10 bg-white/5">
					<summary
						class="flex cursor-pointer items-center justify-between px-5 py-4 text-left text-white transition-colors hover:bg-white/5"
					>
						<span class="font-medium">How does it work?</span>
						<ChevronRight
							size={18}
							class="text-white/60 transition-transform group-open:rotate-90"
						/>
					</summary>
					<div class="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-white/70">
						The desktop app watches your Star Citizen log file and parses gameplay events. When
						you're signed in, these events are shared with your friends and groups in real-time.
					</div>
				</details>

				<details class="group rounded-lg border border-white/10 bg-white/5">
					<summary
						class="flex cursor-pointer items-center justify-between px-5 py-4 text-left text-white transition-colors hover:bg-white/5"
					>
						<span class="font-medium">Is this a cheat or exploit?</span>
						<ChevronRight
							size={18}
							class="text-white/60 transition-transform group-open:rotate-90"
						/>
					</summary>
					<div class="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-white/70">
						No. Picologs only reads your game's log file. It doesn't modify the game, inject code,
						or give you any in-game advantage. It's purely an observation tool.
					</div>
				</details>

				<details class="group rounded-lg border border-white/10 bg-white/5">
					<summary
						class="flex cursor-pointer items-center justify-between px-5 py-4 text-left text-white transition-colors hover:bg-white/5"
					>
						<span class="font-medium">Is my data private?</span>
						<ChevronRight
							size={18}
							class="text-white/60 transition-transform group-open:rotate-90"
						/>
					</summary>
					<div class="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-white/70">
						Yes. Only friends you've added and groups you've joined can see your logs. Your game
						logs aren't stored on our servers, they're streamed directly to your connections in
						real-time.
					</div>
				</details>

				<details class="group rounded-lg border border-white/10 bg-white/5">
					<summary
						class="flex cursor-pointer items-center justify-between px-5 py-4 text-left text-white transition-colors hover:bg-white/5"
					>
						<span class="font-medium">Does this work offline?</span>
						<ChevronRight
							size={18}
							class="text-white/60 transition-transform group-open:rotate-90"
						/>
					</summary>
					<div class="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-white/70">
						Yes. The desktop app works fully offline for personal log monitoring. You only need to
						sign in to share logs with friends.
					</div>
				</details>

				<details class="group rounded-lg border border-white/10 bg-white/5">
					<summary
						class="flex cursor-pointer items-center justify-between px-5 py-4 text-left text-white transition-colors hover:bg-white/5"
					>
						<span class="font-medium">Do I need to use the desktop app?</span>
						<ChevronRight
							size={18}
							class="text-white/60 transition-transform group-open:rotate-90"
						/>
					</summary>
					<div class="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-white/70">
						The desktop app is required to share your own logs, but you can use the website to check
						in with friends and groups, see who's online, and view activity feeds without having the
						app running.
					</div>
				</details>

				<details class="group rounded-lg border border-white/10 bg-white/5">
					<summary
						class="flex cursor-pointer items-center justify-between px-5 py-4 text-left text-white transition-colors hover:bg-white/5"
					>
						<span class="font-medium">Who made this?</span>
						<ChevronRight
							size={18}
							class="text-white/60 transition-transform group-open:rotate-90"
						/>
					</summary>
					<div class="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-white/70">
						Picologs is built by a developer with over 20 years of web development experience. The
						Windows app is signed with a Microsoft certificate, so you can trust it's safe to
						install.
					</div>
				</details>

				<details class="group rounded-lg border border-white/10 bg-white/5">
					<summary
						class="flex cursor-pointer items-center justify-between px-5 py-4 text-left text-white transition-colors hover:bg-white/5"
					>
						<span class="font-medium">Is Picologs affiliated with Star Citizen?</span>
						<ChevronRight
							size={18}
							class="text-white/60 transition-transform group-open:rotate-90"
						/>
					</summary>
					<div class="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-white/70">
						No. Picologs is an independent fan project. Star Citizen is a trademark of Cloud
						Imperium Games.
					</div>
				</details>

				<details class="group rounded-lg border border-white/10 bg-white/5" bind:open={eventsOpen}>
					<summary
						class="flex cursor-pointer items-center justify-between px-5 py-4 text-left text-white transition-colors hover:bg-white/5"
					>
						<span class="font-medium">What events does Picologs track?</span>
						<ChevronRight
							size={18}
							class="text-white/60 transition-transform group-open:rotate-90"
						/>
					</summary>
					<div class="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-white/70">
						{#if eventsOpen}
							{#await getTrackedEvents()}
								<span class="flex items-center gap-2">
									<Loader2 class="h-4 w-4 animate-spin" />
									Loading...
								</span>
							{:then { current, deprecated }}
								<p>
									<strong class="text-white/90">Currently tracking:</strong>
									{current.join(', ')}.
								</p>
								{#if deprecated.length > 0}
									<p class="mt-2 text-white/50">
										<strong>Previously supported:</strong>
										{deprecated.join(', ')}.
									</p>
								{/if}
								<p class="mt-3 text-xs italic text-white/40">
									Star Citizen's log format evolves with each patch, so we continuously refine our
									event detection.
								</p>
							{:catch}
								Unable to load event list.
							{/await}
						{/if}
					</div>
				</details>
			</div>
		</div>
	</section>

	<!-- Footer -->
	<footer class="border-t border-white/5 bg-black/30 px-4 py-6">
		<div class="flex justify-center gap-4 text-xs text-white/60">
			<a
				href="/download"
				data-sveltekit-reload
				data-sveltekit-preload-data="off"
				class="transition-colors hover:text-white/80">Download App</a
			>
			<span>•</span>
			<a href="/terms" class="transition-colors hover:text-white/80">Terms of Service</a>
			<span>•</span>
			<a href="/privacy" class="transition-colors hover:text-white/80">Privacy Policy</a>
		</div>
		<p
			class="mt-4 flex flex-wrap items-center justify-center gap-x-1 text-center text-xs text-white/40"
		>
			<span>❤️ to my org mates at</span>
			<a
				href="https://discord.gg/perfectfleet"
				target="_blank"
				rel="noopener noreferrer"
				class="hover:text-white/60">Perfect Fleet</a
			>
			<span>for their patient alpha testing!</span>
			<span>Ship images sourced from the amazing</span>
			<a
				href="https://fleetyards.net"
				target="_blank"
				rel="noopener noreferrer"
				class="hover:text-white/60">Fleetyards</a
			>
		</p>
	</footer>
</div>
