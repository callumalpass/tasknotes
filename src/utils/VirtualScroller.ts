/**
 * Simple virtual scrolling implementation for large lists
 *
 * Renders only visible items plus a buffer to improve performance
 * with large datasets (1000+ items).
 */

export interface VirtualScrollerOptions<T> {
	/** Container element that will have overflow scroll */
	container: HTMLElement;
	/** Array of items to virtualize */
	items: T[];
	/**
	 * Initial estimated height of each item in pixels.
	 * If not provided, VirtualScroller will measure a sample of items to calculate average height.
	 * Actual heights are measured via ResizeObserver after rendering.
	 */
	itemHeight?: number;
	/** Number of items to render above/below viewport (buffer) */
	overscan?: number;
	/** Function to render an item */
	renderItem: (item: T, index: number) => HTMLElement;
	/** Optional function to get unique key for item */
	getItemKey?: (item: T, index: number) => string;
}

export interface VirtualScrollState {
	/** Index of first visible item */
	startIndex: number;
	/** Index of last visible item */
	endIndex: number;
	/** Total items */
	totalItems: number;
	/** Offset from top in pixels */
	offsetY: number;
}

export class VirtualScroller<T> {
	private container: HTMLElement;
	private scrollContainer: HTMLElement;
	private contentContainer: HTMLElement;
	private spacer: HTMLElement;

	private items: T[] = [];
	private estimatedHeight: number; // Default estimated height for unmeasured items
	private overscan: number;
	private renderItem: (item: T, index: number) => HTMLElement;
	private getItemKey: (item: T, index: number) => string;

	private state: VirtualScrollState = {
		startIndex: 0,
		endIndex: 0,
		totalItems: 0,
		offsetY: 0,
	};

	private renderedElements = new Map<string, HTMLElement>();
	private scrollRAF: number | null = null;

	// Variable height tracking
	private itemHeights = new Map<number, number>(); // index -> measured height
	private positionCache: number[] = []; // Cumulative positions [0, 60, 125, 200...]
	private totalHeight = 0;
	private resizeObserver: ResizeObserver | null = null;
	private measurementRAF: number | null = null;
	private pendingMeasurements = new Set<number>();

	constructor(options: VirtualScrollerOptions<T>) {
		this.container = options.container;
		this.items = options.items;
		this.estimatedHeight = options.itemHeight ?? 0; // Will be calculated if not provided
		this.overscan = options.overscan ?? 5;
		this.renderItem = options.renderItem;
		this.getItemKey = options.getItemKey ?? ((item, index) => String(index));

		this.setupDOM();
		this.attachScrollListener();
		this.setupResizeObserver();

		// If no itemHeight provided, calculate from sample
		if (!options.itemHeight && this.items.length > 0) {
			this.calculateEstimatedHeight();
		}

		this.rebuildPositionCache();
		this.updateVisibleRange();
	}

	private setupDOM(): void {
		// Clear existing content
		this.container.empty();

		// Container should just be relative, parent handles overflow
		this.container.style.position = 'relative';

		// Create spacer to maintain scroll height
		this.spacer = this.container.createDiv({
			cls: 'virtual-scroller__spacer',
		});
		this.spacer.style.cssText = `
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			pointer-events: none;
		`;
		this.updateSpacerHeight();

		// Create content container for rendered items
		this.contentContainer = this.container.createDiv({
			cls: 'virtual-scroller__content',
		});
		this.contentContainer.style.cssText = `
			position: relative;
		`;

		// Find the actual scrolling container by walking up the DOM
		this.scrollContainer = this.findScrollContainer(this.container);
	}

	/**
	 * Calculate estimated height by measuring a sample of items
	 * Renders up to 5 items, measures them, and calculates average
	 */
	private calculateEstimatedHeight(): void {
		const sampleSize = Math.min(5, this.items.length);
		const sampleHeights: number[] = [];

		// Temporarily render sample items for measurement
		const tempContainer = this.contentContainer.createDiv({
			cls: 'virtual-scroller__sample',
		});
		tempContainer.style.cssText = `
			position: absolute;
			visibility: hidden;
			pointer-events: none;
		`;

		for (let i = 0; i < sampleSize; i++) {
			const element = this.renderItem(this.items[i], i);
			tempContainer.appendChild(element);

			// Force layout and measure
			const height = element.getBoundingClientRect().height;
			if (height > 0) {
				sampleHeights.push(height);
			}
		}

		// Remove sample container
		tempContainer.remove();

		// Calculate average height
		if (sampleHeights.length > 0) {
			const sum = sampleHeights.reduce((a, b) => a + b, 0);
			this.estimatedHeight = Math.ceil(sum / sampleHeights.length);
		} else {
			// Fallback if measurement fails
			this.estimatedHeight = 60;
		}
	}

	private findScrollContainer(element: HTMLElement): HTMLElement {
		let current: HTMLElement | null = element;

		// Walk up the DOM tree to find an element with overflow scroll/auto
		while (current) {
			const style = window.getComputedStyle(current);
			const overflowY = style.overflowY;

			if (overflowY === 'scroll' || overflowY === 'auto') {
				return current;
			}

			current = current.parentElement;
		}

		// Fallback to container itself
		return element;
	}

	private updateSpacerHeight(): void {
		this.spacer.style.height = `${this.totalHeight}px`;
	}

	/**
	 * Binary search to find the index of the first item at or after the given scroll position
	 */
	private binarySearchPosition(scrollTop: number): number {
		if (this.positionCache.length === 0) return 0;

		let left = 0;
		let right = this.positionCache.length - 1;

		while (left < right) {
			const mid = Math.floor((left + right) / 2);
			if (this.positionCache[mid] < scrollTop) {
				left = mid + 1;
			} else {
				right = mid;
			}
		}

		return Math.max(0, left - 1);
	}

	/**
	 * Get the height of an item (measured or estimated)
	 */
	private getItemHeight(index: number): number {
		return this.itemHeights.get(index) ?? this.estimatedHeight;
	}

	/**
	 * Get the position (top offset) of an item
	 */
	private getItemPosition(index: number): number {
		if (index < 0 || index >= this.positionCache.length) return 0;
		return this.positionCache[index];
	}

	/**
	 * Rebuild the position cache from measured heights
	 */
	private rebuildPositionCache(): void {
		this.positionCache = [];
		let currentPosition = 0;

		for (let i = 0; i < this.items.length; i++) {
			this.positionCache[i] = currentPosition;
			currentPosition += this.getItemHeight(i);
		}

		this.totalHeight = currentPosition;
		this.updateSpacerHeight();
	}

	/**
	 * Setup ResizeObserver to detect height changes in rendered items
	 */
	private setupResizeObserver(): void {
		this.resizeObserver = new ResizeObserver((entries) => {
			// Collect indices that need remeasurement
			for (const entry of entries) {
				const element = entry.target as HTMLElement;
				const index = parseInt(element.dataset.virtualIndex || '-1', 10);

				if (index >= 0 && index < this.items.length) {
					this.pendingMeasurements.add(index);
				}
			}

			// Debounce the actual measurement update
			if (this.measurementRAF === null) {
				this.measurementRAF = window.requestAnimationFrame(() => {
					this.processPendingMeasurements();
					this.measurementRAF = null;
				});
			}
		});
	}

	/**
	 * Measure items and update position cache if heights changed
	 */
	private processPendingMeasurements(): void {
		if (this.pendingMeasurements.size === 0) return;

		let heightsChanged = false;

		for (const index of this.pendingMeasurements) {
			const element = this.contentContainer.querySelector(
				`[data-virtual-index="${index}"]`
			) as HTMLElement;

			if (element) {
				const newHeight = element.getBoundingClientRect().height;
				const oldHeight = this.itemHeights.get(index);

				if (oldHeight !== newHeight && newHeight > 0) {
					this.itemHeights.set(index, newHeight);
					heightsChanged = true;
				}
			}
		}

		this.pendingMeasurements.clear();

		if (heightsChanged) {
			this.rebuildPositionCache();
			// Don't force re-render here to avoid infinite loops
			// Just update the spacer height
		}
	}

	/**
	 * Measure all currently rendered items
	 */
	private measureRenderedItems(): void {
		const elements = this.contentContainer.querySelectorAll('[data-virtual-index]');
		let heightsChanged = false;

		for (const element of elements) {
			const index = parseInt((element as HTMLElement).dataset.virtualIndex || '-1', 10);
			if (index >= 0 && index < this.items.length) {
				const newHeight = element.getBoundingClientRect().height;
				const oldHeight = this.itemHeights.get(index);

				if (oldHeight !== newHeight && newHeight > 0) {
					this.itemHeights.set(index, newHeight);
					heightsChanged = true;
				}
			}
		}

		if (heightsChanged) {
			this.rebuildPositionCache();
		}
	}

	private attachScrollListener(): void {
		this.scrollContainer.addEventListener('scroll', this.handleScroll);
	}

	private handleScroll = (): void => {
		// Use RAF to throttle scroll updates
		if (this.scrollRAF !== null) {
			return;
		}

		this.scrollRAF = window.requestAnimationFrame(() => {
			this.updateVisibleRange();
			this.scrollRAF = null;
		});
	};

	private updateVisibleRange(): void {
		const scrollTop = this.scrollContainer.scrollTop;
		let containerHeight = this.scrollContainer.clientHeight;

		// If container height is 0, try to get a better estimate
		if (containerHeight === 0) {
			// Try parent element height
			containerHeight = this.scrollContainer.parentElement?.clientHeight || 0;
		}
		if (containerHeight === 0) {
			// Fall back to window height as last resort
			containerHeight = window.innerHeight;
			console.warn('[VirtualScroller] Using window height as fallback:', containerHeight);
		}

		// Use binary search to find visible range based on actual positions
		const startIndex = Math.max(0, this.binarySearchPosition(scrollTop) - this.overscan);

		// Find end index by searching from startIndex
		let endIndex = startIndex;
		const viewportBottom = scrollTop + containerHeight;

		while (endIndex < this.items.length - 1) {
			const itemBottom = this.getItemPosition(endIndex) + this.getItemHeight(endIndex);
			if (itemBottom > viewportBottom) {
				break;
			}
			endIndex++;
		}

		// Add overscan to end
		endIndex = Math.min(this.items.length - 1, endIndex + this.overscan);

		const offsetY = this.getItemPosition(startIndex);

		// Only update if range changed
		if (
			startIndex !== this.state.startIndex ||
			endIndex !== this.state.endIndex ||
			this.items.length !== this.state.totalItems
		) {
			this.state = {
				startIndex,
				endIndex,
				totalItems: this.items.length,
				offsetY,
			};
			this.renderVisibleItems();
		}
	}

	private renderVisibleItems(): void {
		const { startIndex, endIndex, offsetY } = this.state;

		// Track which items are currently visible
		const visibleKeys = new Set<string>();

		// Position the content container
		this.contentContainer.style.transform = `translateY(${offsetY}px)`;

		// Build map of currently rendered elements by key
		const currentElements = new Map<string, HTMLElement>();
		for (const [key, element] of this.renderedElements) {
			if (element.parentElement === this.contentContainer) {
				currentElements.set(key, element);
			}
		}

		// Render visible items in order
		let previousElement: HTMLElement | null = null;
		for (let i = startIndex; i <= endIndex; i++) {
			const item = this.items[i];
			const key = this.getItemKey(item, i);
			visibleKeys.add(key);

			let element = this.renderedElements.get(key);

			if (!element) {
				// Create new element
				element = this.renderItem(item, i);

				// Add data attribute for measurement tracking
				element.dataset.virtualIndex = String(i);

				this.renderedElements.set(key, element);

				// Observe for size changes
				if (this.resizeObserver) {
					this.resizeObserver.observe(element);
				}
			} else {
				// Update index for existing element
				element.dataset.virtualIndex = String(i);
			}

			// Only manipulate DOM if element is not in correct position
			if (previousElement) {
				// Element should come after previousElement
				if (element.previousElementSibling !== previousElement) {
					// Insert after previousElement
					previousElement.after(element);
				}
			} else {
				// Element should be first
				if (this.contentContainer.firstChild !== element) {
					this.contentContainer.prepend(element);
				}
			}

			previousElement = element;
		}

		// Remove elements that are no longer visible
		for (const [key, element] of this.renderedElements) {
			if (!visibleKeys.has(key)) {
				if (this.resizeObserver) {
					this.resizeObserver.unobserve(element);
				}
				element.remove();
				this.renderedElements.delete(key);
			}
		}

		// Schedule measurement after render
		window.requestAnimationFrame(() => {
			this.measureRenderedItems();
		});
	}

	/**
	 * Update the items list and re-render
	 */
	updateItems(items: T[]): void {
		// Save current scroll position
		const currentScrollTop = this.scrollContainer.scrollTop;

		this.items = items;
		this.state.totalItems = items.length;

		// Keep existing height measurements - they're usually still valid
		// Only clear measurements for indices beyond the new length
		const maxIndex = this.itemHeights.size;
		for (let i = items.length; i < maxIndex; i++) {
			this.itemHeights.delete(i);
		}

		// Rebuild position cache with existing measurements
		this.rebuildPositionCache();

		// Clear rendered elements cache since items changed
		// This forces fresh cards to be created with updated data
		for (const element of this.renderedElements.values()) {
			if (this.resizeObserver) {
				this.resizeObserver.unobserve(element);
			}
		}
		this.renderedElements.clear();
		this.contentContainer.empty();

		// Force state reset to trigger re-render at current scroll position
		this.state.startIndex = -1;
		this.state.endIndex = -1;

		// IMPORTANT: Restore scroll position BEFORE updateVisibleRange
		// so it calculates the right visible range
		this.scrollContainer.scrollTop = currentScrollTop;

		this.updateVisibleRange();
	}

	/**
	 * Scroll to a specific item index
	 */
	scrollToIndex(index: number, behavior: ScrollBehavior = 'smooth'): void {
		const targetScroll = this.getItemPosition(index);
		this.scrollContainer.scrollTo({
			top: targetScroll,
			behavior,
		});
	}

	/**
	 * Force recalculation of visible range (useful after container resize)
	 */
	recalculate(): void {
		// Force a fresh calculation by resetting state
		this.state.startIndex = -1;
		this.state.endIndex = -1;
		this.updateVisibleRange();
	}

	/**
	 * Invalidate a specific item by key, forcing it to re-render
	 */
	invalidateItem(key: string): void {
		const element = this.renderedElements.get(key);
		if (element) {
			// Get the index from the element
			const index = parseInt(element.dataset.virtualIndex || '-1', 10);

			// Clear height measurement for this index
			if (index >= 0) {
				this.itemHeights.delete(index);
			}

			// Remove from cache - will be recreated on next render
			this.renderedElements.delete(key);
			element.remove();
		}
		// Rebuild position cache and force re-render
		this.rebuildPositionCache();
		this.updateVisibleRange();
	}

	/**
	 * Invalidate height measurements for specific indices
	 * Useful when items change but you're about to call updateItems anyway
	 */
	invalidateHeights(indices: number[]): void {
		for (const index of indices) {
			this.itemHeights.delete(index);
		}
		this.rebuildPositionCache();
	}

	/**
	 * Get current scroll state (for debugging)
	 */
	getState(): VirtualScrollState {
		return { ...this.state };
	}

	/**
	 * Clean up event listeners
	 */
	destroy(): void {
		if (this.scrollRAF !== null) {
			cancelAnimationFrame(this.scrollRAF);
		}
		if (this.measurementRAF !== null) {
			cancelAnimationFrame(this.measurementRAF);
		}
		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
		this.scrollContainer.removeEventListener('scroll', this.handleScroll);
		this.renderedElements.clear();
		this.contentContainer.empty();
		this.itemHeights.clear();
		this.positionCache = [];
		this.pendingMeasurements.clear();
	}
}
