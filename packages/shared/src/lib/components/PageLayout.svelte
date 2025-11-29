<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		children: Snippet;
	}

	let { title, description, children }: Props = $props();
</script>

<div class="mx-auto w-full max-w-2xl p-4 sm:p-6 md:p-8">
	<div class="mb-6">
		<h1 class="mb-2 text-2xl font-bold text-white">{title}</h1>
		{#if description}
			<p class="text-white/60">{description}</p>
		{/if}
	</div>

	{@render children()}
</div>
