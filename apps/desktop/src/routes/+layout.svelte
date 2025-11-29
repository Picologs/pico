<script lang="ts">
	import '../app.css';

	// Import test helpers only in dev/test builds (tree-shaken in production)
	// This import is a no-op in production due to the conditional check inside the module
	import '$lib/test-helpers';

	let { children } = $props();
</script>

{@render children?.()}
