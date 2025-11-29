<script lang="ts">
	import { ProfilePage, SubNav } from '@pico/shared';
</script>

<svelte:head>
	<title>Profile - Picologs</title>
</svelte:head>

<div class="flex h-full">
	<SubNav />
	<main class="flex-1 overflow-auto">
		<ProfilePage />
	</main>
</div>
