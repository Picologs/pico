<script lang="ts">
	import { Settings, Server, Globe, Zap, UserPlus, Loader2 } from '@lucide/svelte';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let signupsEnabled = $state(data.signupsEnabled);
	let isToggling = $state(false);

	// Update local state when form result comes back
	$effect(() => {
		if (form?.signupsEnabled !== undefined) {
			signupsEnabled = form.signupsEnabled;
		}
	});
</script>

<div class="p-6 space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold text-white">System Settings</h1>
		<p class="text-white/60 mt-1">View system configuration and info</p>
	</div>

	<!-- System Info -->
	<div>
		<h2 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
			<Server size={18} class="text-blue-400" />
			System Information
		</h2>
		<div class="bg-white/5 rounded-lg border border-white/10 divide-y divide-white/10">
			<div class="flex justify-between items-center px-4 py-3">
				<span class="text-white/60">Environment</span>
				<span
					class="text-white font-medium px-2 py-0.5 rounded bg-{data.systemInfo.environment ===
					'production'
						? 'green'
						: 'amber'}-500/20 text-{data.systemInfo.environment === 'production'
						? 'green'
						: 'amber'}-400"
				>
					{data.systemInfo.environment}
				</span>
			</div>
			<div class="flex justify-between items-center px-4 py-3">
				<span class="text-white/60">Node.js Version</span>
				<code class="text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded text-sm">
					{data.systemInfo.nodeVersion}
				</code>
			</div>
			<div class="flex justify-between items-center px-4 py-3">
				<span class="text-white/60">Platform</span>
				<span class="text-white">{data.systemInfo.platform}</span>
			</div>
		</div>
	</div>

	<!-- URLs -->
	<div>
		<h2 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
			<Globe size={18} class="text-green-400" />
			Endpoints
		</h2>
		<div class="bg-white/5 rounded-lg border border-white/10 divide-y divide-white/10">
			<div class="flex justify-between items-center px-4 py-3">
				<span class="text-white/60">Public URL</span>
				<a href={data.systemInfo.publicUrl} target="_blank" class="text-blue-400 hover:underline">
					{data.systemInfo.publicUrl}
				</a>
			</div>
			<div class="flex justify-between items-center px-4 py-3">
				<span class="text-white/60">WebSocket URL</span>
				<code class="text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded text-sm">
					{data.systemInfo.wsUrl}
				</code>
			</div>
		</div>
	</div>

	<!-- Registration Controls -->
	<div>
		<h2 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
			<UserPlus size={18} class="text-amber-400" />
			Registration Controls
		</h2>
		<div class="bg-white/5 rounded-lg border border-white/10 divide-y divide-white/10">
			<div class="flex justify-between items-center px-4 py-4">
				<div>
					<p class="text-white font-medium">New User Sign-ups</p>
					<p class="text-white/40 text-sm mt-0.5">
						{signupsEnabled
							? 'New users can register via Discord OAuth'
							: 'Registration is disabled - only existing users can log in'}
					</p>
				</div>
				<form
					method="POST"
					action="?/toggleSignups"
					use:enhance={() => {
						isToggling = true;
						return async ({ update }) => {
							await update();
							isToggling = false;
						};
					}}
				>
					<input type="hidden" name="enabled" value={signupsEnabled ? 'false' : 'true'} />
					<button
						type="submit"
						disabled={isToggling}
						class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 {signupsEnabled
							? 'bg-green-500'
							: 'bg-white/20'}"
					>
						{#if isToggling}
							<span class="absolute inset-0 flex items-center justify-center">
								<Loader2 size={14} class="animate-spin text-white" />
							</span>
						{:else}
							<span
								class="inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform {signupsEnabled
									? 'translate-x-6'
									: 'translate-x-1'}"
							></span>
						{/if}
					</button>
				</form>
			</div>
		</div>
		{#if !signupsEnabled}
			<p class="text-amber-400 text-sm mt-2 flex items-center gap-2">
				<Zap size={14} />
				Sign-ups are currently disabled. New users will see an error when trying to register.
			</p>
		{/if}
	</div>

	<!-- Quick Actions -->
	<div>
		<h2 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
			<Settings size={18} class="text-purple-400" />
			Quick Actions
		</h2>
		<div class="grid grid-cols-2 gap-4">
			<a
				href="https://fly.io/apps/picologs-website-dry-forest-1113"
				target="_blank"
				class="bg-white/5 rounded-lg border border-white/10 p-4 hover:bg-white/10 transition-colors group"
			>
				<p class="text-white font-medium group-hover:text-blue-400 transition-colors">
					Fly.io Dashboard
				</p>
				<p class="text-sm text-white/40 mt-1">Monitor deployments and logs</p>
			</a>
			<a
				href="https://console.neon.tech"
				target="_blank"
				class="bg-white/5 rounded-lg border border-white/10 p-4 hover:bg-white/10 transition-colors group"
			>
				<p class="text-white font-medium group-hover:text-green-400 transition-colors">
					Neon Console
				</p>
				<p class="text-sm text-white/40 mt-1">Database management</p>
			</a>
		</div>
	</div>
</div>
