<script lang="ts">
	import { Users, Loader2 } from '@lucide/svelte';
	import type { DiscoverableGroup } from '@pico/types';

	interface Props {
		group: DiscoverableGroup;
		onJoin: (groupId: string) => Promise<void>;
		onRequestJoin: (groupId: string, message?: string) => Promise<void>;
	}

	let { group, onJoin, onRequestJoin }: Props = $props();

	let joining = $state(false);
	let showRequestDialog = $state(false);
	let requestMessage = $state('');

	async function handleJoin() {
		if (group.joinMethod === 'open') {
			joining = true;
			try {
				await onJoin(group.id);
			} finally {
				joining = false;
			}
		} else {
			showRequestDialog = true;
		}
	}

	async function handleRequestSubmit() {
		joining = true;
		try {
			await onRequestJoin(group.id, requestMessage.trim() || undefined);
			showRequestDialog = false;
			requestMessage = '';
		} finally {
			joining = false;
		}
	}

	function formatMemberCount(count: number): string {
		if (count >= 1000) {
			return `${(count / 1000).toFixed(1)}k`;
		}
		return count.toString();
	}
</script>

<div class="rounded-lg border border-white/10 bg-secondary/50 transition-colors hover:bg-secondary">
	<div class="p-4">
		<!-- Header -->
		<div class="flex items-start gap-3">
			<!-- Avatar -->
			{#if group.avatar}
				{#if group.avatar.startsWith('http') || group.avatar.startsWith('/uploads')}
					<img
						src={group.avatar}
						alt={group.name}
						class="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
					/>
				{:else}
					<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-white/10 text-2xl">
						{group.avatar}
					</div>
				{/if}
			{:else}
				<div class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
					<Users size={24} class="text-white/40" />
				</div>
			{/if}

			<!-- Info -->
			<div class="min-w-0 flex-1">
				<h3 class="truncate text-sm font-semibold text-white">{group.name}</h3>
				<div class="mt-0.5 flex items-center gap-2 text-xs text-white/50">
					<span>{formatMemberCount(group.memberCount)} members</span>
					{#if group.joinMethod === 'open'}
						<span class="rounded bg-success/20 px-1.5 py-0.5 text-success">Open</span>
					{:else}
						<span class="rounded bg-discord/20 px-1.5 py-0.5 text-discord">Request</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- Description -->
		{#if group.description}
			<p class="mt-3 line-clamp-2 text-sm text-white/60">{group.description}</p>
		{/if}

		<!-- Tags -->
		{#if group.tags && group.tags.length > 0}
			<div class="mt-3 flex flex-wrap gap-1">
				{#each group.tags.slice(0, 4) as tag (tag)}
					<span class="rounded bg-white/10 px-2 py-0.5 text-xs text-white/60">{tag}</span>
				{/each}
				{#if group.tags.length > 4}
					<span class="rounded bg-white/5 px-2 py-0.5 text-xs text-white/40">
						+{group.tags.length - 4}
					</span>
				{/if}
			</div>
		{/if}

		<!-- Actions -->
		<div class="mt-4">
			{#if group.isJoined}
				<button
					type="button"
					disabled
					class="w-full rounded-md bg-success/20 px-4 py-2 text-sm font-medium text-success cursor-default"
				>
					Joined
				</button>
			{:else if group.hasPendingRequest}
				<button
					type="button"
					disabled
					class="w-full rounded-md bg-discord/20 px-4 py-2 text-sm font-medium text-discord cursor-default"
				>
					Request Pending
				</button>
			{:else}
				<button
					type="button"
					onclick={handleJoin}
					disabled={joining}
					class="w-full rounded-md bg-discord px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-discord/80 disabled:opacity-50"
				>
					{#if joining}
						<Loader2 size={16} class="inline animate-spin mr-1" />
					{/if}
					{group.joinMethod === 'open' ? 'Join Group' : 'Request to Join'}
				</button>
			{/if}
		</div>
	</div>
</div>

<!-- Request Join Dialog -->
{#if showRequestDialog}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
	>
		<div class="mx-4 w-full max-w-md rounded-lg border border-white/10 bg-panel-dark p-6 shadow-xl">
			<h3 class="text-lg font-semibold text-white">Request to Join</h3>
			<p class="mt-1 text-sm text-white/60">
				Send a request to join <strong>{group.name}</strong>. The group admins will review your request.
			</p>

			<div class="mt-4">
				<label for="request-message" class="mb-2 block text-sm font-medium text-white/80">
					Message (optional)
				</label>
				<textarea
					id="request-message"
					bind:value={requestMessage}
					placeholder="Introduce yourself or explain why you'd like to join..."
					rows="3"
					maxlength="500"
					class="w-full resize-none rounded-md border border-white/10 bg-secondary px-3 py-2 text-sm text-white placeholder-white/30 transition-all focus:border-discord focus:ring-2 focus:ring-discord focus:outline-none"
				></textarea>
			</div>

			<div class="mt-6 flex justify-end gap-3">
				<button
					type="button"
					onclick={() => {
						showRequestDialog = false;
						requestMessage = '';
					}}
					class="rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/20"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleRequestSubmit}
					disabled={joining}
					class="rounded-md bg-discord px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-discord/80 disabled:opacity-50"
				>
					{#if joining}
						<Loader2 size={16} class="inline animate-spin mr-1" />
					{/if}
					Send Request
				</button>
			</div>
		</div>
	</div>
{/if}
