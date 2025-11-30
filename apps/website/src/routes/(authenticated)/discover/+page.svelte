<script lang="ts">
	import { DiscoverPage, SubNav } from '@pico/shared';
</script>

<svelte:head>
	<title>Discover - Picologs</title>
</svelte:head>

<div class="flex h-full">
	<SubNav />
	<main class="flex-1 overflow-auto">
		<DiscoverPage />
	</main>
</div>
