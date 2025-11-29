<script lang="ts">
	import { page } from '$app/stores';
	import { Users, BarChart3, Settings, Shield, GitCompare } from '@lucide/svelte';

	let { children } = $props();

	const navItems = [
		{ href: '/admin/users', label: 'Users', icon: Users },
		{ href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
		{ href: '/admin/settings', label: 'Settings', icon: Settings }
	];

	const logSchemaItems = [{ href: '/admin/patterns', label: 'Gap Analysis', icon: GitCompare }];
</script>

<div class="flex h-full">
	<!-- Admin Sidebar -->
	<aside class="w-56 border-r border-white/10 bg-black/20 flex flex-col">
		<div class="p-4 border-b border-white/10">
			<div class="flex items-center gap-2 text-amber-400">
				<Shield size={20} />
				<span class="font-semibold">Admin Panel</span>
			</div>
		</div>
		<nav class="flex-1 p-2 overflow-y-auto">
			{#each navItems as item}
				{@const isActive = $page.url.pathname.startsWith(item.href)}
				<a
					href={item.href}
					class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors {isActive
						? 'bg-white/10 text-white'
						: 'text-white/60 hover:text-white hover:bg-white/5'}"
				>
					<item.icon size={18} />
					<span>{item.label}</span>
				</a>
			{/each}

			<!-- Log Schema Section -->
			<div class="mt-4 pt-4 border-t border-white/10">
				<p class="px-3 py-1 text-xs font-medium text-white/40 uppercase tracking-wider">
					Log Schema
				</p>
				{#each logSchemaItems as item}
					{@const isActive = $page.url.pathname.startsWith(item.href)}
					<a
						href={item.href}
						class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors {isActive
							? 'bg-white/10 text-white'
							: 'text-white/60 hover:text-white hover:bg-white/5'}"
					>
						<item.icon size={18} />
						<span>{item.label}</span>
					</a>
				{/each}
			</div>
		</nav>
		<div class="p-4 border-t border-white/10">
			<a href="/dashboard" class="text-sm text-white/40 hover:text-white/60 transition-colors">
				&larr; Back to Dashboard
			</a>
		</div>
	</aside>

	<!-- Admin Content -->
	<main class="flex-1 overflow-auto">
		{@render children()}
	</main>
</div>
