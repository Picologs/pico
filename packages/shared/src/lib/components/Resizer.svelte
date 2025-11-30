<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { Snippet } from 'svelte';
	import { GripVertical, GripHorizontal } from '@lucide/svelte';

	// --- Props ---
	let {
		direction = 'horizontal',
		firstPanel,
		secondPanel,
		initialFirstSize = 230, // pixels for horizontal, percent for vertical
		initialSecondSize = 500, // only used for horizontal (pixels)
		storageKey = 'resizer'
	}: {
		direction?: 'horizontal' | 'vertical';
		firstPanel?: Snippet;
		secondPanel?: Snippet;
		initialFirstSize?: number;
		initialSecondSize?: number;
		storageKey?: string;
	} = $props();

	// --- Constants ---
	const resizerThickness = 3; // px
	const resizerThicknessCollapsed = 24; // px
	const minPanelSize = 50; // px
	const snapThreshold = 20; // px

	// --- localStorage Keys ---
	const FIRST_SIZE_KEY = `${storageKey}_firstPanelSize`;
	const SECOND_SIZE_KEY = `${storageKey}_secondPanelSize`;

	// --- localStorage Helpers ---
	function getJSON<T>(key: string, defaultValue: T): T {
		if (!browser) return defaultValue;
		try {
			const item = localStorage.getItem(key);
			return item ? JSON.parse(item) : defaultValue;
		} catch {
			return defaultValue;
		}
	}

	function setJSON<T>(key: string, value: T): void {
		if (!browser) return;
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch {
			// Silent failure
		}
	}

	// --- Derived State (defined early for use in initialization) ---
	const isHorizontal = $derived(direction === 'horizontal');
	const isVertical = $derived(direction === 'vertical');

	// --- State ---
	let containerRef: HTMLDivElement;
	let containerSize = $state<number>(0); // width for horizontal, height for vertical
	let isReady = $state<boolean>(false); // Hide until layout is loaded

	// Load saved sizes immediately to prevent FOUC
	// Use a function closure to capture the derived value reactively
	const savedFirstSize = (() => {
		const isHoriz = direction === 'horizontal';
		return browser && isHoriz
			? getJSON<number>(FIRST_SIZE_KEY, initialFirstSize)
			: initialFirstSize;
	})();
	const savedSecondSize = (() => {
		const isHoriz = direction === 'horizontal';
		return browser && isHoriz
			? getJSON<number>(SECOND_SIZE_KEY, initialSecondSize)
			: initialSecondSize;
	})();

	let firstPanelSize = $state<number>(savedFirstSize); // pixels
	let secondPanelSize = $state<number>(savedSecondSize); // pixels (only for horizontal)
	let isDragging = $state<boolean>(false);
	let initialMousePos = $state<number>(0);
	let initialFirstPanelSize = $state<number>(0);
	let initialSecondPanelSize = $state<number>(0);
	let resizeObserver: ResizeObserver | null = null;
	let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

	// For vertical, we work with percentages
	const firstPanelPercent = $derived(
		isVertical && containerSize > 0 ? (firstPanelSize / containerSize) * 100 : 0
	);

	const isFirstCollapsed = $derived(firstPanelSize <= 1);
	const isSecondCollapsed = $derived(
		isVertical
			? containerSize > 0 && firstPanelSize >= containerSize - resizerThicknessCollapsed
			: secondPanelSize < minPanelSize
	);
	const isAnyCollapsed = $derived(isFirstCollapsed || isSecondCollapsed);
	const currentResizerThickness = $derived(
		isAnyCollapsed ? resizerThicknessCollapsed : resizerThickness
	);

	// Grid styles
	const gridTemplateStyle = $derived(
		isHorizontal
			? `${firstPanelSize}px ${currentResizerThickness}px 1fr`
			: `${firstPanelPercent}% ${currentResizerThickness}px 1fr`
	);

	const cursorClass = $derived(isHorizontal ? 'cursor-ew-resize' : 'cursor-ns-resize');
	const dragCursorClass = $derived(
		isHorizontal
			? '[&_*]:cursor-ew-resize [&_*]:select-none [&_*]:!cursor-ew-resize [&_*]:!select-none'
			: '[&_*]:cursor-ns-resize [&_*]:select-none [&_*]:!cursor-ns-resize [&_*]:!select-none'
	);

	// --- Event Handlers ---
	function handleResizerPointerDown(event: PointerEvent): void {
		if (!browser) return;
		event.preventDefault();

		// Capture pointer to ensure we receive all subsequent events
		(event.target as HTMLElement)?.setPointerCapture(event.pointerId);

		isDragging = true;
		initialMousePos = isHorizontal ? event.clientX : event.clientY;
		initialFirstPanelSize = firstPanelSize;
		initialSecondPanelSize = secondPanelSize;

		window.addEventListener('pointermove', handleWindowPointerMove);
		window.addEventListener('pointerup', handleWindowPointerUp);
		window.addEventListener('pointercancel', handleWindowPointerUp);
	}

	function handleWindowPointerMove(event: PointerEvent): void {
		if (!isDragging || containerSize === 0) return;

		const currentMousePos = isHorizontal ? event.clientX : event.clientY;
		const delta = currentMousePos - initialMousePos;
		let newFirstSize = initialFirstPanelSize + delta;

		// Use current resizer thickness based on collapse state
		const activeResizerThickness = isAnyCollapsed ? resizerThicknessCollapsed : resizerThickness;

		const secondSize = containerSize - newFirstSize - activeResizerThickness;

		// Snap logic - always snap to collapsed resizer thickness for proper detection
		if (newFirstSize < snapThreshold && delta < 0) {
			// Attempting to collapse first panel
			newFirstSize = 0;
		} else if (secondSize < snapThreshold && delta > 0) {
			// Attempting to collapse second panel - use collapsed resizer thickness
			newFirstSize = containerSize - resizerThicknessCollapsed;
		} else {
			// Apply minimum size constraints if not snapping to zero
			if (newFirstSize < minPanelSize) {
				newFirstSize = minPanelSize;
			}
			if (secondSize < minPanelSize) {
				newFirstSize = containerSize - minPanelSize - activeResizerThickness;
			}
		}

		// Clamp newFirstSize to be within [0, containerSize - resizerThickness]
		// Use minimum resizer thickness for clamping to allow full collapse
		newFirstSize = Math.max(0, newFirstSize);
		newFirstSize = Math.min(newFirstSize, containerSize - resizerThickness);

		firstPanelSize = newFirstSize;

		if (isHorizontal) {
			secondPanelSize = containerSize - newFirstSize - resizerThickness;
			secondPanelSize = Math.max(0, secondPanelSize);
		}
	}

	function handleWindowPointerUp(event: PointerEvent): void {
		if (!isDragging || !browser) return;
		isDragging = false;

		// Release pointer capture
		(event.target as HTMLElement)?.releasePointerCapture?.(event.pointerId);

		window.removeEventListener('pointermove', handleWindowPointerMove);
		window.removeEventListener('pointerup', handleWindowPointerUp);
		window.removeEventListener('pointercancel', handleWindowPointerUp);

		// Persist to localStorage on pointer up
		saveLayout();
	}

	// Touch event handlers for mobile (with passive: false to prevent scrolling)
	function handleResizerTouchStart(event: TouchEvent): void {
		if (!browser || event.touches.length !== 1) return;
		event.preventDefault(); // Prevent default immediately

		isDragging = true;
		const touch = event.touches[0];
		initialMousePos = isHorizontal ? touch.clientX : touch.clientY;
		initialFirstPanelSize = firstPanelSize;
		initialSecondPanelSize = secondPanelSize;

		// Add touch listeners with passive: false to allow preventDefault
		document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false });
		document.addEventListener('touchend', handleDocumentTouchEnd);
		document.addEventListener('touchcancel', handleDocumentTouchEnd);
	}

	function handleDocumentTouchMove(event: TouchEvent): void {
		if (!isDragging || containerSize === 0 || event.touches.length !== 1) return;
		event.preventDefault(); // Critical: Prevents scrolling during drag

		const touch = event.touches[0];
		const currentMousePos = isHorizontal ? touch.clientX : touch.clientY;
		const delta = currentMousePos - initialMousePos;
		let newFirstSize = initialFirstPanelSize + delta;

		// Use current resizer thickness based on collapse state
		const activeResizerThickness = isAnyCollapsed ? resizerThicknessCollapsed : resizerThickness;

		const secondSize = containerSize - newFirstSize - activeResizerThickness;

		// Snap logic - always snap to collapsed resizer thickness for proper detection
		if (newFirstSize < snapThreshold && delta < 0) {
			// Attempting to collapse first panel
			newFirstSize = 0;
		} else if (secondSize < snapThreshold && delta > 0) {
			// Attempting to collapse second panel - use collapsed resizer thickness
			newFirstSize = containerSize - resizerThicknessCollapsed;
		} else {
			// Apply minimum size constraints if not snapping to zero
			if (newFirstSize < minPanelSize) {
				newFirstSize = minPanelSize;
			}
			if (secondSize < minPanelSize) {
				newFirstSize = containerSize - minPanelSize - activeResizerThickness;
			}
		}

		// Clamp newFirstSize to be within [0, containerSize - resizerThickness]
		newFirstSize = Math.max(0, newFirstSize);
		newFirstSize = Math.min(newFirstSize, containerSize - resizerThickness);

		firstPanelSize = newFirstSize;

		if (isHorizontal) {
			secondPanelSize = containerSize - newFirstSize - resizerThickness;
			secondPanelSize = Math.max(0, secondPanelSize);
		}
	}

	function handleDocumentTouchEnd(event: TouchEvent): void {
		if (!isDragging || !browser) return;
		isDragging = false;

		document.removeEventListener('touchmove', handleDocumentTouchMove);
		document.removeEventListener('touchend', handleDocumentTouchEnd);
		document.removeEventListener('touchcancel', handleDocumentTouchEnd);

		// Persist to localStorage on touch end
		saveLayout();
	}

	function saveLayout() {
		if (isVertical) {
			if (containerSize === 0) return;
			const percentToSave = (firstPanelSize / containerSize) * 100;
			setJSON(FIRST_SIZE_KEY, percentToSave);
		} else {
			// Horizontal
			setJSON(FIRST_SIZE_KEY, firstPanelSize);
			setJSON(SECOND_SIZE_KEY, secondPanelSize);
		}
	}

	function handleResizerDoubleClick(): void {
		if (isVertical && containerSize === 0) return;

		if (isHorizontal) {
			// Horizontal: Check if already at initial position (within 10px tolerance)
			const tolerance = 10;
			const isAtInitial = Math.abs(firstPanelSize - initialFirstSize) < tolerance;

			if (isAtInitial && !isFirstCollapsed) {
				// Already at default position, so collapse first panel
				firstPanelSize = 0;
			} else {
				// Reset to initial sizes
				firstPanelSize = initialFirstSize;
				secondPanelSize = initialSecondSize;
			}
		} else {
			// Vertical: Toggle behavior
			if (isFirstCollapsed) {
				// If top is collapsed, expand it to default
				firstPanelSize = (initialFirstSize / 100) * containerSize;
			} else if (!isSecondCollapsed) {
				// If bottom is visible, collapse it (maximize top)
				firstPanelSize = containerSize - resizerThicknessCollapsed;
			} else {
				// If bottom is already collapsed, reset to default
				firstPanelSize = (initialFirstSize / 100) * containerSize;
			}
		}
		saveLayout();
	}

	// Export methods (primarily for horizontal use)
	export function toggleFirstPanel() {
		if (isFirstCollapsed) {
			// Restore to default size
			if (isVertical) {
				firstPanelSize = (initialFirstSize / 100) * containerSize;
			} else {
				firstPanelSize = initialFirstSize;
			}
		} else {
			// Collapse
			firstPanelSize = 0;
		}
		saveLayout();
	}

	export function toggleSecondPanel() {
		if (isSecondCollapsed) {
			// Restore to default size
			if (isVertical) {
				firstPanelSize = (initialFirstSize / 100) * containerSize;
			} else {
				// For horizontal, restore both panels to initial sizes
				firstPanelSize = initialFirstSize;
				secondPanelSize = initialSecondSize;
			}
		} else {
			// Collapse second panel by maximizing first panel
			if (isVertical) {
				firstPanelSize = containerSize - resizerThicknessCollapsed;
			} else {
				secondPanelSize = 0;
			}
		}
		saveLayout();
	}

	export function isFirstPanelCollapsed(): boolean {
		return isFirstCollapsed;
	}

	export function isSecondPanelCollapsed(): boolean {
		return isSecondCollapsed;
	}

	// --- Lifecycle ---
	onDestroy(() => {
		if (browser) {
			window.removeEventListener('pointermove', handleWindowPointerMove);
			window.removeEventListener('pointerup', handleWindowPointerUp);
			window.removeEventListener('pointercancel', handleWindowPointerUp);

			// Clean up touch listeners
			document.removeEventListener('touchmove', handleDocumentTouchMove);
			document.removeEventListener('touchend', handleDocumentTouchEnd);
			document.removeEventListener('touchcancel', handleDocumentTouchEnd);

			if (resizeObserver) {
				resizeObserver.disconnect();
			}

			// Clear any pending resize timeout
			if (resizeTimeout !== null) {
				clearTimeout(resizeTimeout);
			}
		}
	});

	onMount(() => {
		if (!containerRef) return;

		// Initialize container size
		containerSize = isHorizontal ? containerRef.offsetWidth : containerRef.offsetHeight;

		if (isVertical) {
			// Load saved percentage from localStorage
			const savedPercent = getJSON<number>(FIRST_SIZE_KEY, initialFirstSize);

			// Apply saved percentage to current container height
			firstPanelSize = (savedPercent / 100) * containerSize;

			// Set up ResizeObserver to track container size changes
			// Debounce updates to prevent ResizeObserver loops
			resizeObserver = new ResizeObserver((entries) => {
				// Clear any pending timeout
				if (resizeTimeout !== null) {
					clearTimeout(resizeTimeout);
				}

				// Debounce state updates (~16ms for ~60fps)
				resizeTimeout = setTimeout(() => {
					for (const entry of entries) {
						const newSize = isHorizontal ? entry.contentRect.width : entry.contentRect.height;
						if (newSize !== containerSize && newSize > 0) {
							// Maintain percentage when container resizes
							const currentPercent = containerSize > 0 ? firstPanelPercent : savedPercent;
							containerSize = newSize;
							firstPanelSize = (currentPercent / 100) * newSize;
						}
					}
					resizeTimeout = null;
				}, 16);
			});

			resizeObserver.observe(containerRef);
		}
		// Note: Horizontal mode loads sizes immediately on component init (see state initialization above)

		// Mark as ready to show (prevents FOUC)
		isReady = true;
	});
</script>

<!-- Component HTML Template -->
<div
	class="grid h-full w-full gap-0 overflow-hidden {isDragging ? dragCursorClass : ''} {isReady
		? ''
		: 'opacity-0'}"
	bind:this={containerRef}
	style={isHorizontal
		? `grid-template-columns: ${gridTemplateStyle}`
		: `grid-template-rows: ${gridTemplateStyle}`}
>
	<!-- First Panel -->
	<div
		class="overflow-auto {isHorizontal && isFirstCollapsed
			? '!p-0 !text-[0px] transition-[padding,font-size] duration-100 ease-out'
			: ''}"
	>
		{#if !(isHorizontal && isFirstCollapsed) && firstPanel}
			{@render firstPanel()}
		{/if}
	</div>

	<!-- Resizer -->
	<button
		class="{cursorClass} relative z-10 flex items-center justify-center transition-all duration-200 select-none {isAnyCollapsed
			? 'bg-white/5 hover:bg-white/10'
			: 'bg-white/5 hover:bg-white/40'} {isVertical ? 'w-full' : ''}"
		style="touch-action: none;"
		onpointerdown={handleResizerPointerDown}
		ontouchstart={handleResizerTouchStart}
		ondblclick={handleResizerDoubleClick}
		aria-label="Resize panels (double-click to reset)"
	>
		{#if isAnyCollapsed}
			{#if isHorizontal}
				<GripVertical size={16} class="text-white/40" />
			{:else}
				<GripHorizontal size={16} class="relative z-10 text-white/40" />
			{/if}
		{/if}
	</button>

	<!-- Second Panel -->
	<div class="overflow-auto">
		{#if secondPanel}
			{@render secondPanel()}
		{/if}
	</div>
</div>
