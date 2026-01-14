/**
 * Svelte action that shifts a modal up when the virtual keyboard appears on mobile.
 * Uses the visualViewport API to detect keyboard presence.
 *
 * Usage: <div use:keyboardAware>...</div>
 */
export function keyboardAware(node: HTMLElement) {
	const viewport = window.visualViewport;
	if (!viewport) {
		// visualViewport not supported, no-op
		return { destroy: () => {} };
	}

	// Capture viewport in a const so TypeScript knows it's non-null in callbacks
	const vp = viewport;

	// Store the initial viewport height to detect keyboard
	let initialHeight = vp.height;
	let rafId: number | null = null;

	function handleResize() {
		// Cancel any pending animation frame
		if (rafId) {
			cancelAnimationFrame(rafId);
		}

		rafId = requestAnimationFrame(() => {
			const currentHeight = vp.height;
			const heightDiff = initialHeight - currentHeight;

			// If viewport shrunk significantly (keyboard appeared), shift modal up
			// Threshold of 100px to avoid false positives from address bar changes
			if (heightDiff > 100) {
				// Calculate offset: shift up by the keyboard height minus some padding
				// We want the modal to be visible above the keyboard
				const offset = Math.min(heightDiff - 20, node.offsetHeight * 0.4);
				node.style.transform = `translateY(-${offset}px)`;
				node.style.transition = 'transform 0.2s ease-out';
			} else {
				// Keyboard closed, reset position
				node.style.transform = '';
				node.style.transition = 'transform 0.2s ease-out';
			}
		});
	}

	// Also handle scroll to keep focused input visible
	function handleScroll() {
		// visualViewport scroll events happen when keyboard pushes content
		handleResize();
	}

	// Update initial height on orientation change
	function handleOrientationChange() {
		// Wait for resize to complete
		setTimeout(() => {
			initialHeight = vp.height;
			node.style.transform = '';
		}, 300);
	}

	vp.addEventListener('resize', handleResize);
	vp.addEventListener('scroll', handleScroll);
	window.addEventListener('orientationchange', handleOrientationChange);

	return {
		destroy() {
			if (rafId) {
				cancelAnimationFrame(rafId);
			}
			vp.removeEventListener('resize', handleResize);
			vp.removeEventListener('scroll', handleScroll);
			window.removeEventListener('orientationchange', handleOrientationChange);
			node.style.transform = '';
			node.style.transition = '';
		}
	};
}
