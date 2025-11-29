<script lang="ts">
	/* eslint-disable svelte/no-navigation-without-resolve */
	import { enhance } from '$app/forms';
	import { ChevronRight } from '@lucide/svelte';
	import DiscordIcon from './DiscordIcon.svelte';
</script>

<div
	class="flex min-h-svh flex-col bg-primary bg-cover bg-center bg-no-repeat p-4 sm:p-6 md:p-10"
	style="background-image: linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.3)), url('/welcome.webp');"
>
	<header
		class="mb-8 flex w-full flex-col items-start justify-between gap-4 sm:mb-0 sm:flex-row sm:items-center"
	>
		<h1 class="flex items-center gap-2 text-xl font-medium sm:text-2xl">
			<img src="/pico-icon.png" alt="Picologs" class="h-7 w-7 sm:h-8 sm:w-8" />
			Picologs
		</h1>

		<form method="POST" use:enhance>
			<button
				type="submit"
				class="flex w-fit items-center gap-2 rounded-md border border-discord-hover bg-discord px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-discord-hover sm:px-4 sm:text-base"
			>
				<DiscordIcon />
				<span class="hidden sm:inline">Sign in with Discord</span>
				<span class="sm:hidden">Sign in</span>
			</button>
		</form>
	</header>

	<div
		class="mx-auto flex max-w-4xl flex-1 flex-col items-center justify-center gap-6 text-center sm:gap-8"
	>
		<h2
			class="pb-4 text-6xl leading-[0.8] font-extrabold tracking-tighter text-balance text-white drop-shadow-lg sm:pb-6 sm:text-8xl md:text-9xl lg:text-[10rem]"
		>
			Star Citizen<br />logs<br />Synced
		</h2>
		<h3
			class="text-base tracking-tight text-balance text-white drop-shadow-lg sm:text-xl md:text-2xl"
		>
			See real-time updates of your friends' online status, ships, kill feeds, deaths and more.
		</h3>
		<form method="POST" use:enhance>
			<button
				type="submit"
				class="flex w-fit items-center gap-2 rounded-md border border-discord-hover bg-discord px-4 py-2 text-base font-medium text-white transition-colors hover:bg-discord-hover sm:px-6 sm:py-3 sm:text-lg md:text-xl"
			>
				Get Started
				<ChevronRight class="h-5 w-5 sm:h-6 sm:w-6" />
			</button>
		</form>
	</div>

	<footer class="mt-auto w-full px-4 py-4 text-center">
		<div class="flex justify-center gap-4 text-xs text-white/60">
			<a href="/terms" class="transition-colors hover:text-white/80">Terms of Service</a>
			<span>•</span>
			<a href="/privacy" class="transition-colors hover:text-white/80">Privacy Policy</a>
		</div>
	</footer>
</div>
