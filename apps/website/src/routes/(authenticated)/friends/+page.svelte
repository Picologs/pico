<script lang="ts">
	import { FriendsPage, SubNav } from '@pico/shared';
</script>

<svelte:head>
	<title>Friends - Picologs</title>
</svelte:head>

<div class="flex h-full">
	<SubNav />
	<main class="flex-1 overflow-auto">
		<FriendsPage />
	</main>
</div>
