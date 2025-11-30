<script lang="ts">
	import '../../app.css';

	let { children } = $props();
</script>

<!-- Minimal layout for splash screen - no titlebar, no window controls, just content -->
{@render children()}
