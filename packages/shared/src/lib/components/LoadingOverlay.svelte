<script lang="ts">
	import { Loader2 } from '@lucide/svelte';

	let { message = 'Loading...' }: { message?: string } = $props();
</script>

<div class="absolute inset-0 z-50 flex items-center justify-center bg-primary">
	<div class="flex flex-col items-center gap-3">
		<Loader2 class="h-8 w-8 animate-spin text-white/70" />
		<p class="text-white/60">{message}</p>
	</div>
</div>
