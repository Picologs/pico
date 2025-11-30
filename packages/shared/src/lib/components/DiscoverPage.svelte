<script lang="ts">
	import { Search, Filter, X, Loader2, Compass } from '@lucide/svelte';
	import PageLayout from './PageLayout.svelte';
	import DiscoverGroupCard from './DiscoverGroupCard.svelte';
	import { appState } from '../app.svelte.js';
	import { onDestroy } from 'svelte';

	// Derived state from appState
	const groups = $derived(appState.discoverableGroups);
	const pagination = $derived(appState.discoverPagination);
	const availableTags = $derived(appState.discoverTags);
	const loading = $derived(appState.discoverLoading);
	const selectedTags = $derived(appState.discoverSelectedTags);
	const sortBy = $derived(appState.discoverSortBy);

	// Local state
	let searchQuery = $state('');
	let showFilters = $state(false);
	let searchTimeout: ReturnType<typeof setTimeout> | null = null;
	let hasInitialized = $state(false);

	// Fetch initial data when WebSocket is connected
	$effect(() => {
		if (appState.connectionStatus === 'connected' && !hasInitialized) {
			hasInitialized = true;
			Promise.all([
				appState.fetchDiscoverTags(),
				appState.fetchDiscoverableGroups({ reset: true })
			]);
		}
	});

	// Cleanup on unmount
	onDestroy(() => {
		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}
		appState.clearDiscoverState();
	});

	// Debounced search
	function handleSearchInput(e: Event) {
		const value = (e.target as HTMLInputElement).value;
		searchQuery = value;

		if (searchTimeout) {
			clearTimeout(searchTimeout);
		}

		searchTimeout = setTimeout(() => {
			appState.fetchDiscoverableGroups({
				search: value,
				reset: true
			});
		}, 300);
	}

	// Clear search
	function clearSearch() {
		searchQuery = '';
		appState.fetchDiscoverableGroups({
			search: '',
			reset: true
		});
	}

	// Toggle tag selection
	function toggleTag(tag: string) {
		const newTags = selectedTags.includes(tag)
			? selectedTags.filter((t) => t !== tag)
			: [...selectedTags, tag];

		appState.fetchDiscoverableGroups({
			tags: newTags,
			reset: true
		});
	}

	// Clear all filters
	function clearFilters() {
		searchQuery = '';
		appState.fetchDiscoverableGroups({
			search: '',
			tags: [],
			sortBy: 'popular',
			reset: true
		});
	}

	// Change sort order
	function handleSortChange(e: Event) {
		const value = (e.target as HTMLSelectElement).value as 'popular' | 'recent' | 'name';
		appState.fetchDiscoverableGroups({
			sortBy: value,
			reset: true
		});
	}

	// Load more groups
	async function loadMore() {
		await appState.loadMoreDiscoverableGroups();
	}

	// Join handlers
	async function handleJoin(groupId: string) {
		await appState.joinOpenGroup(groupId);
	}

	async function handleRequestJoin(groupId: string, message?: string) {
		await appState.requestJoinGroup(groupId, message);
	}

	// Check if any filters are active
	const hasActiveFilters = $derived(searchQuery || selectedTags.length > 0 || sortBy !== 'popular');
</script>

<PageLayout title="Discover" description="Find and join public groups">
	<div class="space-y-6">
		<!-- Search and Filters -->
		<div class="rounded-lg border border-white/10 bg-secondary p-4">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
				<!-- Search Input -->
				<div class="relative flex-1">
					<Search size={16} class="absolute top-1/2 left-3 -translate-y-1/2 text-white/40" />
					<input
						type="text"
						value={searchQuery}
						oninput={handleSearchInput}
						placeholder="Search groups by name..."
						class="w-full rounded-md border border-white/10 bg-panel-dark py-2 pr-9 pl-9 text-sm text-white placeholder-white/30 transition-all focus:border-discord focus:ring-2 focus:ring-discord focus:outline-none"
					/>
					{#if searchQuery}
						<button
							type="button"
							onclick={clearSearch}
							class="absolute top-1/2 right-3 -translate-y-1/2 text-white/40 hover:text-white"
						>
							<X size={16} />
						</button>
					{/if}
				</div>

				<!-- Sort Dropdown -->
				<div class="flex items-center gap-2">
					<select
						value={sortBy}
						onchange={handleSortChange}
						class="rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white transition-all focus:border-discord focus:ring-2 focus:ring-discord focus:outline-none"
					>
						<option value="popular">Most Popular</option>
						<option value="recent">Recently Created</option>
						<option value="name">Name (A-Z)</option>
					</select>

					<!-- Filter Toggle -->
					<button
						type="button"
						onclick={() => (showFilters = !showFilters)}
						class="flex items-center gap-2 rounded-md border border-white/10 bg-panel-dark px-3 py-2 text-sm text-white transition-colors hover:bg-white/10 {showFilters || selectedTags.length > 0 ? 'border-discord text-discord' : ''}"
					>
						<Filter size={16} />
						{#if selectedTags.length > 0}
							<span class="rounded-full bg-discord px-1.5 text-xs text-white">
								{selectedTags.length}
							</span>
						{/if}
					</button>
				</div>
			</div>

			<!-- Tag Filters -->
			{#if showFilters && availableTags.length > 0}
				<div class="mt-4 border-t border-white/10 pt-4">
					<div class="mb-2 flex items-center justify-between">
						<span class="text-xs font-medium text-white/60 uppercase">Filter by Tags</span>
						{#if selectedTags.length > 0}
							<button
								type="button"
								onclick={() => appState.fetchDiscoverableGroups({ tags: [], reset: true })}
								class="text-xs text-discord hover:text-discord/80"
							>
								Clear tags
							</button>
						{/if}
					</div>
					<div class="flex flex-wrap gap-2">
						{#each availableTags as tag (tag)}
							{@const isSelected = selectedTags.includes(tag)}
							<button
								type="button"
								onclick={() => toggleTag(tag)}
								class="rounded-full px-3 py-1 text-xs transition-colors {isSelected
									? 'bg-discord text-white'
									: 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'}"
							>
								{tag}
							</button>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Active Filters Summary -->
			{#if hasActiveFilters}
				<div class="mt-4 flex items-center gap-2 border-t border-white/10 pt-4">
					<span class="text-xs text-white/40">Active filters:</span>
					{#if searchQuery}
						<span class="rounded bg-white/10 px-2 py-0.5 text-xs text-white/60">
							Search: "{searchQuery}"
						</span>
					{/if}
					{#each selectedTags as tag (tag)}
						<span class="rounded bg-discord/20 px-2 py-0.5 text-xs text-discord">
							{tag}
						</span>
					{/each}
					{#if sortBy !== 'popular'}
						<span class="rounded bg-white/10 px-2 py-0.5 text-xs text-white/60">
							Sort: {sortBy === 'recent' ? 'Recent' : 'Name'}
						</span>
					{/if}
					<button
						type="button"
						onclick={clearFilters}
						class="ml-auto text-xs text-white/40 hover:text-white"
					>
						Clear all
					</button>
				</div>
			{/if}
		</div>

		<!-- Results Header -->
		<div class="flex items-center justify-between">
			<h2 class="text-sm font-medium text-white/60">
				{#if loading && groups.length === 0}
					Loading groups...
				{:else if groups.length === 0}
					No groups found
				{:else}
					{pagination.total} group{pagination.total === 1 ? '' : 's'} found
				{/if}
			</h2>
		</div>

		<!-- Groups Grid -->
		{#if loading && groups.length === 0}
			<!-- Loading skeleton -->
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each Array(6) as _, i (i)}
					<div class="animate-pulse rounded-lg border border-white/10 bg-secondary/50 p-4">
						<div class="flex items-start gap-3">
							<div class="h-12 w-12 rounded-lg bg-white/10"></div>
							<div class="flex-1 space-y-2">
								<div class="h-4 w-3/4 rounded bg-white/10"></div>
								<div class="h-3 w-1/2 rounded bg-white/10"></div>
							</div>
						</div>
						<div class="mt-3 space-y-2">
							<div class="h-3 w-full rounded bg-white/10"></div>
							<div class="h-3 w-2/3 rounded bg-white/10"></div>
						</div>
						<div class="mt-4 h-9 rounded bg-white/10"></div>
					</div>
				{/each}
			</div>
		{:else if groups.length === 0}
			<!-- Empty state -->
			<div class="rounded-lg border border-white/10 bg-secondary/50 py-12 text-center">
				<Compass size={48} class="mx-auto mb-4 text-white/20" />
				<h3 class="text-lg font-semibold text-white">No groups found</h3>
				<p class="mt-1 text-sm text-white/60">
					{#if hasActiveFilters}
						Try adjusting your search or filters
					{:else}
						No public groups are available yet. Be the first to create one!
					{/if}
				</p>
				{#if hasActiveFilters}
					<button
						type="button"
						onclick={clearFilters}
						class="mt-4 inline-flex items-center gap-2 rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
					>
						Clear filters
					</button>
				{/if}
			</div>
		{:else}
			<!-- Groups grid -->
			<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each groups as group (group.id)}
					<DiscoverGroupCard {group} onJoin={handleJoin} onRequestJoin={handleRequestJoin} />
				{/each}
			</div>

			<!-- Load More -->
			{#if pagination.hasMore}
				<div class="flex justify-center pt-4">
					<button
						type="button"
						onclick={loadMore}
						disabled={loading}
						class="inline-flex items-center gap-2 rounded-md bg-white/10 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20 disabled:opacity-50"
					>
						{#if loading}
							<Loader2 size={16} class="animate-spin" />
							Loading...
						{:else}
							Load More
						{/if}
					</button>
				</div>
			{/if}
		{/if}
	</div>
</PageLayout>
