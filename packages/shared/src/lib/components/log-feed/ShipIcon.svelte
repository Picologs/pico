<script lang="ts">
	/**
	 * ShipIcon - SVG icon for ship/vehicle events
	 *
	 * Displays a simplified ship icon for vehicle-related log events.
	 * Used in log items to provide visual indication of ship events.
	 */

	let {
		size = 24,
		class: className = ''
	}: {
		/** Icon size in pixels */
		size?: number;
		/** Additional CSS classes */
		class?: string;
	} = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	class={className}
>
	<!-- Simple spaceship icon -->
	<path
		d="M12 2L4 20L12 17L20 20L12 2Z"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		fill="none"
	/>
	<path
		d="M12 17V2"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
	/>
	<circle cx="12" cy="12" r="2" fill="currentColor" />
</svg>
