<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { Users, FolderOpen } from '@lucide/svelte';

	interface BottomItem {
		label: string;
		icon?: string;
		iconComponent?: unknown;
		onClick?: () => void;
		href?: string;
		external?: boolean;
	}

	interface FooterLink {
		label: string;
		href: string;
	}

	interface Props {
		showToggles?: boolean;
		showFriends?: boolean;
		showGroups?: boolean;
		onToggleFriends?: () => void;
		onToggleGroups?: () => void;
		bottomItems?: BottomItem[];
		footerLinks?: FooterLink[];
		appVersion?: string;
	}

	let {
		showToggles = true,
		showFriends = true,
		showGroups = true,
		onToggleFriends,
		onToggleGroups,
		bottomItems = [],
		footerLinks = [],
		appVersion
	}: Props = $props();
</script>

<div
	class="flex items-center {showToggles
		? 'justify-between'
		: 'justify-end'} gap-2 border-t border-white/5 bg-primary px-2 py-1 text-[0.8rem] text-white/70 shadow-[0_-2px_8px_rgba(0,0,0,0.15)]"
>
	{#if showToggles}
		<div class="flex items-center gap-2">
			<button
				onclick={onToggleGroups}
				class="flex cursor-pointer items-center justify-center text-white transition-opacity duration-200 {showGroups
					? 'opacity-100'
					: 'opacity-40 hover:opacity-70'}"
				title={showGroups ? 'Hide groups' : 'Show groups'}
				aria-label={showGroups ? 'Hide groups' : 'Show groups'}
			>
				<FolderOpen size={18} />
			</button>
			<button
				onclick={onToggleFriends}
				class="flex cursor-pointer items-center justify-center text-white transition-opacity duration-200 {showFriends
					? 'opacity-100'
					: 'opacity-40 hover:opacity-70'}"
				title={showFriends ? 'Hide friends' : 'Show friends'}
				aria-label={showFriends ? 'Hide friends' : 'Show friends'}
			>
				<Users size={18} />
			</button>
		</div>
	{/if}
	<div class="flex items-center gap-3 text-xs text-white/50">
		<!-- Bottom items links (Download App, Github) -->
		{#if bottomItems.length > 0}
			{#each bottomItems as item (item.label)}
				{#if item.href}
					<a
						href={item.href}
						target={item.external ? '_blank' : undefined}
						rel={item.external ? 'noopener noreferrer' : undefined}
						class="transition-colors hover:text-white/80"
					>
						{item.label === 'View Source' ? 'Github' : item.label}
					</a>
				{:else if item.onClick}
					<button onclick={item.onClick} class="text-left transition-colors hover:text-white/80">
						{item.label}
					</button>
				{/if}
			{/each}
		{/if}

		<!-- Regular footer links (Terms, Privacy) -->
		{#if footerLinks.length > 0}
			{#each footerLinks as link (link.href)}
				<a href={link.href} class="transition-colors hover:text-white/80">
					{link.label}
				</a>
			{/each}
		{/if}

		<!-- App version (desktop only) -->
		{#if appVersion}
			<span class="text-xs text-white/50">v{appVersion}</span>
		{/if}
	</div>
</div>
