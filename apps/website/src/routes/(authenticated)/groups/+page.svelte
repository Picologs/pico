<script lang="ts">
	import { GroupsPage, SubNav } from '@pico/shared';
</script>

<svelte:head>
	<title>Groups - Picologs</title>
</svelte:head>

<div class="flex h-full">
	<SubNav />
	<main class="flex-1 overflow-auto">
		<GroupsPage />
	</main>
</div>
