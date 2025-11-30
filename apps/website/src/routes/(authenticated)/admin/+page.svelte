<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Redirect to users page by default
	onMount(() => {
		goto('/admin/users', { replaceState: true });
	});
</script>

<div class="flex items-center justify-center h-full">
	<p class="text-white/40">Redirecting...</p>
</div>
