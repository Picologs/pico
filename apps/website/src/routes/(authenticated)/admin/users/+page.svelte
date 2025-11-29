<script lang="ts">
	import {
		Users,
		Shield,
		UserPlus,
		ChevronLeft,
		ChevronRight,
		FlaskConical,
		Ban,
		ShieldOff,
		Loader2,
		X
	} from '@lucide/svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let blockingUserId = $state<string | null>(null);
	let unblockingUserId = $state<string | null>(null);
	let showBlockModal = $state(false);
	let blockTargetUser = $state<(typeof data.users)[0] | null>(null);
	let blockReason = $state('');

	function formatDate(date: Date | string): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function getAvatarUrl(user: { discordId: string; avatar: string | null }): string {
		if (user.avatar) {
			return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64`;
		}
		return `https://cdn.discordapp.com/embed/avatars/${Number(user.discordId) % 5}.png`;
	}

	function openBlockModal(user: (typeof data.users)[0]) {
		blockTargetUser = user;
		blockReason = '';
		showBlockModal = true;
	}

	function closeBlockModal() {
		showBlockModal = false;
		blockTargetUser = null;
		blockReason = '';
	}
</script>

<div class="p-6 space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold text-white">User Management</h1>
		<p class="text-white/60 mt-1">View and manage all registered users</p>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-5 gap-4">
		<div class="bg-white/5 rounded-lg p-4 border border-white/10">
			<div class="flex items-center gap-3">
				<div class="p-2 bg-blue-500/20 rounded-lg">
					<Users size={20} class="text-blue-400" />
				</div>
				<div>
					<p class="text-2xl font-bold text-white">{data.stats.totalUsers}</p>
					<p class="text-sm text-white/60">Total Users</p>
				</div>
			</div>
		</div>
		<div class="bg-white/5 rounded-lg p-4 border border-white/10">
			<div class="flex items-center gap-3">
				<div class="p-2 bg-amber-500/20 rounded-lg">
					<Shield size={20} class="text-amber-400" />
				</div>
				<div>
					<p class="text-2xl font-bold text-white">{data.stats.adminCount}</p>
					<p class="text-sm text-white/60">Admins</p>
				</div>
			</div>
		</div>
		<div class="bg-white/5 rounded-lg p-4 border border-white/10">
			<div class="flex items-center gap-3">
				<div class="p-2 bg-purple-500/20 rounded-lg">
					<FlaskConical size={20} class="text-purple-400" />
				</div>
				<div>
					<p class="text-2xl font-bold text-white">{data.stats.betaTesterCount}</p>
					<p class="text-sm text-white/60">Beta Testers</p>
				</div>
			</div>
		</div>
		<div class="bg-white/5 rounded-lg p-4 border border-white/10">
			<div class="flex items-center gap-3">
				<div class="p-2 bg-green-500/20 rounded-lg">
					<UserPlus size={20} class="text-green-400" />
				</div>
				<div>
					<p class="text-2xl font-bold text-white">{data.stats.recentSignups}</p>
					<p class="text-sm text-white/60">Last 7 Days</p>
				</div>
			</div>
		</div>
		<div class="bg-white/5 rounded-lg p-4 border border-white/10">
			<div class="flex items-center gap-3">
				<div class="p-2 bg-red-500/20 rounded-lg">
					<Ban size={20} class="text-red-400" />
				</div>
				<div>
					<p class="text-2xl font-bold text-white">{data.stats.blockedCount}</p>
					<p class="text-sm text-white/60">Blocked</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Users Table -->
	<div class="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
		<table class="w-full">
			<thead class="bg-white/5">
				<tr>
					<th class="text-left px-4 py-3 text-sm font-medium text-white/60">User</th>
					<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Player</th>
					<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Role</th>
					<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Status</th>
					<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Friend Code</th>
					<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Joined</th>
					<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-white/5">
				{#each data.users as user}
					<tr
						class="hover:bg-white/5 transition-colors {user.blockedAt ? 'bg-red-500/5' : ''}"
					>
						<td class="px-4 py-3">
							<div class="flex items-center gap-3">
								<img
									src={getAvatarUrl(user)}
									alt={user.username}
									class="w-8 h-8 rounded-full"
									class:opacity-50={user.blockedAt}
								/>
								<div>
									<p class="text-white font-medium" class:line-through={user.blockedAt}>
										{user.username}
									</p>
									<p class="text-xs text-white/40">{user.discordId}</p>
								</div>
							</div>
						</td>
						<td class="px-4 py-3 text-white/80">
							{user.player || '-'}
						</td>
						<td class="px-4 py-3">
							{#if user.role === 'admin'}
								<span
									class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400"
								>
									<Shield size={12} />
									Admin
								</span>
							{:else if user.betaTester}
								<span
									class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400"
								>
									<FlaskConical size={12} />
									Beta
								</span>
							{:else}
								<span class="text-white/60 text-sm">User</span>
							{/if}
						</td>
						<td class="px-4 py-3">
							{#if user.blockedAt}
								<span
									class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400"
									title={user.blockReason || 'No reason provided'}
								>
									<Ban size={12} />
									Blocked
								</span>
							{:else}
								<span class="text-green-400 text-sm">Active</span>
							{/if}
						</td>
						<td class="px-4 py-3">
							{#if user.friendCode}
								<code class="text-sm text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
									{user.friendCode}
								</code>
							{:else}
								<span class="text-white/40">-</span>
							{/if}
						</td>
						<td class="px-4 py-3 text-white/60 text-sm">
							{formatDate(user.createdAt)}
						</td>
						<td class="px-4 py-3">
							{#if user.role === 'admin'}
								<span class="text-white/30 text-sm">-</span>
							{:else if user.blockedAt}
								<form
									method="POST"
									action="?/unblockUser"
									use:enhance={() => {
										unblockingUserId = user.id;
										return async ({ update }) => {
											await update();
											unblockingUserId = null;
										};
									}}
								>
									<input type="hidden" name="userId" value={user.id} />
									<button
										type="submit"
										disabled={unblockingUserId === user.id}
										class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
									>
										{#if unblockingUserId === user.id}
											<Loader2 size={12} class="animate-spin" />
										{:else}
											<ShieldOff size={12} />
										{/if}
										Unblock
									</button>
								</form>
							{:else}
								<button
									onclick={() => openBlockModal(user)}
									class="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
								>
									<Ban size={12} />
									Block
								</button>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Pagination -->
	{#if data.pagination.totalPages > 1}
		<div class="flex items-center justify-between">
			<p class="text-sm text-white/60">
				Showing {(data.pagination.page - 1) * data.pagination.limit + 1} to
				{Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of
				{data.pagination.total} users
			</p>
			<div class="flex items-center gap-2">
				<a
					href="?page={data.pagination.page - 1}"
					class="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
					class:pointer-events-none={data.pagination.page <= 1}
					class:opacity-50={data.pagination.page <= 1}
				>
					<ChevronLeft size={16} class="text-white" />
				</a>
				<span class="text-white/60 text-sm px-3">
					Page {data.pagination.page} of {data.pagination.totalPages}
				</span>
				<a
					href="?page={data.pagination.page + 1}"
					class="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
					class:pointer-events-none={data.pagination.page >= data.pagination.totalPages}
					class:opacity-50={data.pagination.page >= data.pagination.totalPages}
				>
					<ChevronRight size={16} class="text-white" />
				</a>
			</div>
		</div>
	{/if}
</div>

<!-- Block User Modal -->
{#if showBlockModal && blockTargetUser}
	<div
		class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
		onclick={closeBlockModal}
		onkeydown={(e) => e.key === 'Escape' && closeBlockModal()}
		role="dialog"
		aria-modal="true"
		tabindex="-1"
	>
		<div
			class="bg-slate-900 rounded-lg border border-white/10 p-6 w-full max-w-md shadow-xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="document"
		>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-lg font-semibold text-white">Block User</h2>
				<button onclick={closeBlockModal} class="text-white/40 hover:text-white">
					<X size={20} />
				</button>
			</div>

			<div class="flex items-center gap-3 mb-4 p-3 bg-white/5 rounded-lg">
				<img
					src={getAvatarUrl(blockTargetUser)}
					alt={blockTargetUser.username}
					class="w-10 h-10 rounded-full"
				/>
				<div>
					<p class="text-white font-medium">{blockTargetUser.username}</p>
					<p class="text-xs text-white/40">{blockTargetUser.discordId}</p>
				</div>
			</div>

			<form
				method="POST"
				action="?/blockUser"
				use:enhance={() => {
					blockingUserId = blockTargetUser?.id ?? null;
					return async ({ update }) => {
						await update();
						blockingUserId = null;
						closeBlockModal();
					};
				}}
			>
				<input type="hidden" name="userId" value={blockTargetUser.id} />

				<div class="mb-4">
					<label for="reason" class="block text-sm font-medium text-white/60 mb-2">
						Reason (optional)
					</label>
					<textarea
						id="reason"
						name="reason"
						bind:value={blockReason}
						placeholder="Enter a reason for blocking this user..."
						class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
						rows="3"
					></textarea>
				</div>

				<div class="flex items-center gap-2 text-amber-400 text-sm mb-4">
					<Ban size={14} />
					<span>This will immediately disconnect the user from all active sessions.</span>
				</div>

				<div class="flex gap-3">
					<button
						type="button"
						onclick={closeBlockModal}
						class="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={blockingUserId === blockTargetUser.id}
						class="flex-1 px-4 py-2 bg-red-500 rounded-lg text-white hover:bg-red-600 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
					>
						{#if blockingUserId === blockTargetUser.id}
							<Loader2 size={16} class="animate-spin" />
							Blocking...
						{:else}
							<Ban size={16} />
							Block User
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
