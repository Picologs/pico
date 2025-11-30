<script lang="ts">
	import { getDiscordColor } from '../utils/discord-colors.js';
	import { getAvatarUrl, isEmoji } from '../utils/avatarUtils.js';

	interface Props {
		/** Avatar URL or hash */
		avatar: string | null | undefined;
		/** Discord user ID (required for CDN URL construction) */
		discordId: string | null | undefined;
		/** User ID for fallback color generation */
		userId?: string;
		/** Alt text for avatar image */
		alt?: string;
		/** Size in Tailwind units (e.g., 8 for w-8 h-8) */
		size?: number;
		/** Show online status indicator */
		showOnline?: boolean;
		/** Online status value */
		isOnline?: boolean;
		/** Additional CSS classes for the container */
		class?: string;
		/** Border color CSS classes */
		borderClass?: string;
		/** Discord CDN base URL (for environment-specific URLs) */
		discordCdnUrl?: string;
	}

	let {
		avatar = null,
		discordId = null,
		userId = '',
		alt = 'Avatar',
		size = 8,
		showOnline = false,
		isOnline = false,
		class: className = '',
		borderClass = '',
		discordCdnUrl = 'https://cdn.discordapp.com'
	}: Props = $props();

	// Size class map - predefined to ensure Tailwind generates these classes
	const sizeClassMap: Record<number, string> = {
		4: 'w-4 h-4',
		6: 'w-6 h-6',
		7: 'w-7 h-7',
		8: 'w-8 h-8',
		10: 'w-10 h-10',
		12: 'w-12 h-12',
		16: 'w-16 h-16',
		20: 'w-20 h-20',
		24: 'w-24 h-24',
		32: 'w-32 h-32'
	};

	let isEmojiAvatar = $derived(isEmoji(avatar));
	let avatarUrl = $derived(getAvatarUrl(discordId, avatar, size * 8, discordCdnUrl));
	let hasValidAvatar = $derived(avatarUrl !== null);
	let imageLoadFailed = $state(false);
	let sizeClass = $derived(sizeClassMap[size] || 'w-8 h-8');
	// Ensure alt is always a string (defensive against Symbol values from Svelte 5 proxies)
	function getSafeAlt(): string {
		if (typeof alt === 'string') return alt;
		if (typeof alt === 'symbol' || alt === null || alt === undefined) return 'Avatar';
		return String(alt);
	}
	let iconWidth = $derived(size * 2.25); // Scale SVG width
	let iconHeight = $derived((size * 2.25 * 55) / 71); // Scale SVG height maintaining aspect ratio
	let emojiSizeClass = $derived(
		size <= 6 ? 'text-lg' : size <= 10 ? 'text-2xl' : size <= 16 ? 'text-4xl' : 'text-6xl'
	);

	// Reset imageLoadFailed when avatarUrl changes
	$effect(() => {
		void avatarUrl; // Track dependency
		imageLoadFailed = false;
	});
</script>

<div class="relative flex-shrink-0 {className}">
	{#if isEmojiAvatar}
		<!-- Emoji avatar -->
		<div
			class="{sizeClass} flex items-center justify-center rounded-full bg-discord/20 {emojiSizeClass} {borderClass}"
			title={getSafeAlt()}
			data-testid="avatar-emoji"
		>
			{avatar}
		</div>
	{:else if hasValidAvatar && !imageLoadFailed}
		<!-- Image avatar -->
		<img
			src={avatarUrl}
			alt={getSafeAlt()}
			class="{sizeClass} rounded-full object-cover {borderClass}"
			onerror={() => (imageLoadFailed = true)}
			data-testid="avatar-image"
		/>
	{:else}
		<!-- Discord icon fallback -->
		<div
			class="{sizeClass} flex items-center justify-center rounded-full ring-2 ring-white/10 {borderClass}"
			style="background-color: {getDiscordColor(userId || 'default')};"
			data-testid="avatar-fallback"
		>
			<svg
				width={iconWidth}
				height={iconHeight}
				viewBox="0 0 71 55"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<path
					d="M60.1045 4.8978C55.5792 2.8214 50.7265 1.2916 45.6527 0.41542C45.5603 0.39851 45.468 0.440769 45.4204 0.525289C44.7963 1.6353 44.105 3.0834 43.6209 4.2216C38.1637 3.4046 32.7345 3.4046 27.3892 4.2216C26.905 3.0581 26.1886 1.6353 25.5617 0.525289C25.5141 0.443589 25.4218 0.40133 25.3294 0.41542C20.2584 1.2888 15.4057 2.8186 10.8776 4.8978C10.8384 4.9147 10.8048 4.9429 10.7825 4.9795C1.57795 18.7309 -0.943561 32.1443 0.293408 45.3914C0.299005 45.4562 0.335386 45.5182 0.385761 45.5576C6.45866 50.0174 12.3413 52.7249 18.1147 54.5195C18.2071 54.5477 18.305 54.5139 18.3638 54.4378C19.7295 52.5728 20.9469 50.6063 21.9907 48.5383C22.0523 48.4172 21.9935 48.2735 21.8676 48.2256C19.9366 47.4931 18.0979 46.6 16.3292 45.5858C16.1893 45.5041 16.1781 45.304 16.3068 45.2082C16.679 44.9293 17.0513 44.6391 17.4067 44.3461C17.471 44.2926 17.5606 44.2813 17.6362 44.3151C29.2558 49.6202 41.8354 49.6202 53.3179 44.3151C53.3935 44.2785 53.4831 44.2898 53.5502 44.3433C53.9057 44.6363 54.2779 44.9293 54.6529 45.2082C54.7816 45.304 54.7732 45.5041 54.6333 45.5858C52.8646 46.6197 51.0259 47.4931 49.0921 48.2228C48.9662 48.2707 48.9102 48.4172 48.9718 48.5383C50.038 50.6034 51.2554 52.5699 52.5959 54.435C52.6519 54.5139 52.7526 54.5477 52.845 54.5195C58.6464 52.7249 64.529 50.0174 70.6019 45.5576C70.6551 45.5182 70.6887 45.459 70.6943 45.3942C72.1747 30.0791 68.2147 16.7757 60.1968 4.9823C60.1772 4.9429 60.1437 4.9147 60.1045 4.8978ZM23.7259 37.3253C20.2276 37.3253 17.3451 34.1136 17.3451 30.1693C17.3451 26.225 20.1717 23.0133 23.7259 23.0133C27.308 23.0133 30.1626 26.2532 30.1066 30.1693C30.1066 34.1136 27.28 37.3253 23.7259 37.3253ZM47.3178 37.3253C43.8196 37.3253 40.9371 34.1136 40.9371 30.1693C40.9371 26.225 43.7636 23.0133 47.3178 23.0133C50.9 23.0133 53.7545 26.2532 53.6986 30.1693C53.6986 34.1136 50.9 37.3253 47.3178 37.3253Z"
					fill="white"
				/>
			</svg>
		</div>
	{/if}

	{#if showOnline && isOnline}
		<span
			class="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 bg-green-500"
			style="border-color: var(--color-bg-primary, rgb(10, 30, 42));"
			title="Online"
		>
		</span>
	{/if}
</div>
