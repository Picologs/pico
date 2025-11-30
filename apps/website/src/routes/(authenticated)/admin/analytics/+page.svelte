<script lang="ts">
	import {
		Users,
		UserPlus,
		UsersRound,
		FolderOpen,
		FileSearch,
		Clock,
		TrendingUp,
		Activity
	} from '@lucide/svelte';

	let { data } = $props();

	function formatDate(date: Date | string): string {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getAvatarUrl(user: { discordId: string; avatar: string | null }): string {
		if (user.avatar) {
			return `https://cdn.discordapp.com/avatars/${user.discordId}/${user.avatar}.png?size=64`;
		}
		return `https://cdn.discordapp.com/embed/avatars/${Number(user.discordId) % 5}.png`;
	}
</script>

<div class="p-6 space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold text-white">Analytics Dashboard</h1>
		<p class="text-white/60 mt-1">Platform usage statistics and metrics</p>
	</div>

	<!-- User Growth Stats -->
	<div>
		<h2 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
			<TrendingUp size={18} class="text-green-400" />
			User Growth
		</h2>
		<div class="grid grid-cols-4 gap-4">
			<div class="bg-white/5 rounded-lg p-4 border border-white/10">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-blue-500/20 rounded-lg">
						<Users size={20} class="text-blue-400" />
					</div>
					<div>
						<p class="text-2xl font-bold text-white">{data.userStats.totalUsers}</p>
						<p class="text-sm text-white/60">Total Users</p>
					</div>
				</div>
			</div>
			<div class="bg-white/5 rounded-lg p-4 border border-white/10">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-green-500/20 rounded-lg">
						<UserPlus size={20} class="text-green-400" />
					</div>
					<div>
						<p class="text-2xl font-bold text-white">{data.userStats.usersToday}</p>
						<p class="text-sm text-white/60">Today</p>
					</div>
				</div>
			</div>
			<div class="bg-white/5 rounded-lg p-4 border border-white/10">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-cyan-500/20 rounded-lg">
						<Clock size={20} class="text-cyan-400" />
					</div>
					<div>
						<p class="text-2xl font-bold text-white">{data.userStats.usersThisWeek}</p>
						<p class="text-sm text-white/60">This Week</p>
					</div>
				</div>
			</div>
			<div class="bg-white/5 rounded-lg p-4 border border-white/10">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-purple-500/20 rounded-lg">
						<Activity size={20} class="text-purple-400" />
					</div>
					<div>
						<p class="text-2xl font-bold text-white">{data.userStats.usersThisMonth}</p>
						<p class="text-sm text-white/60">This Month</p>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Social & Groups -->
	<div class="grid grid-cols-2 gap-6">
		<!-- Friends Stats -->
		<div>
			<h2 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
				<UsersRound size={18} class="text-pink-400" />
				Friendships
			</h2>
			<div class="bg-white/5 rounded-lg border border-white/10 p-4 space-y-4">
				<div class="flex justify-between items-center">
					<span class="text-white/60">Total Friendships</span>
					<span class="text-white font-semibold">{data.friendStats.acceptedFriendships}</span>
				</div>
				<div class="flex justify-between items-center">
					<span class="text-white/60">Pending Requests</span>
					<span class="text-amber-400 font-semibold">{data.friendStats.pendingRequests}</span>
				</div>
				<div class="flex justify-between items-center">
					<span class="text-white/60">Total Records</span>
					<span class="text-white/40 text-sm">{data.friendStats.totalFriendships}</span>
				</div>
			</div>
		</div>

		<!-- Groups Stats -->
		<div>
			<h2 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
				<FolderOpen size={18} class="text-orange-400" />
				Groups
			</h2>
			<div class="bg-white/5 rounded-lg border border-white/10 p-4 space-y-4">
				<div class="flex justify-between items-center">
					<span class="text-white/60">Total Groups</span>
					<span class="text-white font-semibold">{data.groupStats.totalGroups}</span>
				</div>
			</div>
		</div>
	</div>

	<!-- Log Pattern Stats -->
	{#if data.logPatternStats.totalPatterns > 0}
		<div>
			<h2 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
				<FileSearch size={18} class="text-indigo-400" />
				Log Pattern Discovery
			</h2>
			<div class="grid grid-cols-3 gap-4">
				<div class="bg-white/5 rounded-lg p-4 border border-white/10">
					<p class="text-2xl font-bold text-white">{data.logPatternStats.totalPatterns}</p>
					<p class="text-sm text-white/60">Total Patterns</p>
				</div>
				<div class="bg-white/5 rounded-lg p-4 border border-white/10">
					<p class="text-2xl font-bold text-green-400">{data.logPatternStats.handledPatterns}</p>
					<p class="text-sm text-white/60">Handled</p>
				</div>
				<div class="bg-white/5 rounded-lg p-4 border border-white/10">
					<p class="text-2xl font-bold text-amber-400">{data.logPatternStats.unhandledPatterns}</p>
					<p class="text-sm text-white/60">Unhandled</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Recent Signups -->
	<div>
		<h2 class="text-lg font-semibold text-white mb-3">Recent Signups</h2>
		<div class="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
			<table class="w-full">
				<thead class="bg-white/5">
					<tr>
						<th class="text-left px-4 py-3 text-sm font-medium text-white/60">User</th>
						<th class="text-left px-4 py-3 text-sm font-medium text-white/60">Joined</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-white/5">
					{#each data.recentSignups as user}
						<tr class="hover:bg-white/5 transition-colors">
							<td class="px-4 py-3">
								<div class="flex items-center gap-3">
									<img src={getAvatarUrl(user)} alt={user.username} class="w-8 h-8 rounded-full" />
									<span class="text-white">{user.username}</span>
								</div>
							</td>
							<td class="px-4 py-3 text-white/60 text-sm">
								{formatDate(user.createdAt)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
