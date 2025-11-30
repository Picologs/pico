<script lang="ts">
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { Minus, X } from '@lucide/svelte';

	async function minimize() {
		try {
			const window = getCurrentWindow();
			await window.minimize();
		} catch (error) {
			console.error('[WindowControls] Failed to minimize:', error);
		}
	}

	async function close() {
		try {
			const window = getCurrentWindow();
			await window.close();
		} catch (error) {
			console.error('[WindowControls] Failed to close:', error);
		}
	}
</script>

<div class="flex items-center gap-1">
	<!-- Minimize -->
	<button
		onclick={minimize}
		class="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-white/10"
		aria-label="Minimize"
	>
		<Minus size={16} class="text-white/70" />
	</button>

	<!-- Close -->
	<button
		onclick={close}
		class="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-red-600"
		aria-label="Close"
	>
		<X size={16} class="text-white/70" />
	</button>
</div>
