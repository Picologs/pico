<script lang="ts">
	import { page } from '$app/stores';
	import Home from '@lucide/svelte/icons/home';
	import User from '@lucide/svelte/icons/user';
	import Users from '@lucide/svelte/icons/users';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import Compass from '@lucide/svelte/icons/compass';

	const navItems = [
		{ path: '/', label: 'Home', icon: Home },
		{ path: '/profile', label: 'Profile', icon: User },
		{ path: '/friends', label: 'Friends', icon: Users },
		{ path: '/groups', label: 'Groups', icon: FolderOpen },
		{ path: '/discover', label: 'Discover', icon: Compass }
	];

	function isActive(path: string): boolean {
		const currentPath = $page.url.pathname;
		if (path === '/') {
			return currentPath === '/';
		}
		return currentPath.startsWith(path);
	}
</script>

<nav class="w-64 border-r border-white/5 bg-secondary p-4">
	<div class="flex flex-col space-y-2">
		{#each navItems as item}
			<a
				href={item.path}
				class="flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {isActive(
					item.path
				)
					? 'bg-white/10 text-white'
					: 'text-white/70 hover:bg-white/10'}"
			>
				<svelte:component this={item.icon} class="h-5 w-5" />
				<span>{item.label}</span>
			</a>
		{/each}
	</div>
</nav>
