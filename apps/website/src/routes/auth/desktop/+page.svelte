<script lang="ts">
	import { AuthDesktop } from '@pico/shared';

	let { data } = $props();
</script>

{#if data.error && !data.sessionId}
	<div class="flex min-h-screen items-center justify-center bg-primary">
		<div class="rounded-lg border border-white/10 bg-secondary p-6 text-white">
			<h2 class="mb-2 text-xl font-bold text-danger">Error</h2>
			<p class="text-white/70">{data.error}</p>
		</div>
	</div>
{:else if data.needsAuth && data.sessionId}
	<!-- User not logged in - redirect to Discord OAuth -->
	<AuthDesktop sessionId={data.sessionId} />
{/if}
