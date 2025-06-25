/**
 * DOM Reconciler for efficient incremental updates
 * 
 * This class provides virtual DOM-like diffing capabilities to minimize
 * DOM manipulation and maintain UI state during updates.
 */
export class DOMReconciler {
    private updateQueue: (() => void)[] = [];
    private isProcessing = false;
    private activeTimeouts: Set<number> = new Set();
    
    /**
     * Schedule a DOM update to be processed in the next animation frame
     */
    scheduleUpdate(updateFn: () => void): void {
        this.updateQueue.push(updateFn);
        
        if (!this.isProcessing) {
            this.isProcessing = true;
            requestAnimationFrame(() => {
                this.processUpdates();
            });
        }
    }
    
    /**
     * Process all queued updates in a single animation frame
     */
    private processUpdates(): void {
        const updates = [...this.updateQueue];
        this.updateQueue = [];
        
        try {
            // Execute all updates together
            updates.forEach(update => {
                try {
                    update();
                } catch (error) {
                    console.error('Error processing DOM update:', error);
                }
            });
        } finally {
            this.isProcessing = false;
            
            // If more updates were queued during processing, schedule another frame
            if (this.updateQueue.length > 0) {
                requestAnimationFrame(() => {
                    this.processUpdates();
                });
            }
        }
    }
    
    /**
     * Update element attributes efficiently
     */
    updateAttributes(element: HTMLElement, attributes: Record<string, string | null>): void {
        for (const [key, value] of Object.entries(attributes)) {
            if (value === null) {
                element.removeAttribute(key);
            } else if (element.getAttribute(key) !== value) {
                element.setAttribute(key, value);
            }
        }
    }
    
    /**
     * Update element classes efficiently
     */
    updateClasses(element: HTMLElement, classUpdates: Record<string, boolean>): void {
        for (const [className, shouldAdd] of Object.entries(classUpdates)) {
            if (shouldAdd) {
                element.classList.add(className);
            } else {
                element.classList.remove(className);
            }
        }
    }
    
    /**
     * Update element text content if it has changed
     */
    updateTextContent(element: HTMLElement, newText: string): void {
        if (element.textContent !== newText) {
            element.textContent = newText;
        }
    }
    
    /**
     * Update element styles efficiently
     */
    updateStyles(element: HTMLElement, styles: Record<string, string | null>): void {
        for (const [property, value] of Object.entries(styles)) {
            if (value === null) {
                element.style.removeProperty(property);
            } else {
                element.style.setProperty(property, value);
            }
        }
    }
    
    /**
     * Preserve user interaction state during updates
     */
    preserveState(element: HTMLElement): {
        scrollTop: number;
        scrollLeft: number;
        focused: boolean;
        selection: { start: number; end: number } | null;
    } {
        const state = {
            scrollTop: element.scrollTop,
            scrollLeft: element.scrollLeft,
            focused: document.activeElement === element,
            selection: null as { start: number; end: number } | null
        };
        
        // Preserve text selection for input elements
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            state.selection = {
                start: element.selectionStart || 0,
                end: element.selectionEnd || 0
            };
        }
        
        return state;
    }
    
    /**
     * Restore user interaction state after updates
     */
    restoreState(element: HTMLElement, state: {
        scrollTop: number;
        scrollLeft: number;
        focused: boolean;
        selection: { start: number; end: number } | null;
    }): void {
        // Restore scroll position
        element.scrollTop = state.scrollTop;
        element.scrollLeft = state.scrollLeft;
        
        // Restore focus
        if (state.focused) {
            element.focus();
        }
        
        // Restore text selection for input elements
        if (state.selection && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
            element.setSelectionRange(state.selection.start, state.selection.end);
        }
    }
    
    /**
     * Animate element updates for better user perception
     */
    animateUpdate(element: HTMLElement, animation: 'flash' | 'pulse' | 'fade-in', duration = 1500): void {
        element.classList.add(`task-${animation}`);
        
        const timeout = setTimeout(() => {
            element.classList.remove(`task-${animation}`);
            this.activeTimeouts.delete(timeout as unknown as number);
        }, duration);
        
        this.activeTimeouts.add(timeout as unknown as number);
    }
    
    /**
     * Update a list of items efficiently by comparing against existing items
     */
    updateList<T>(
        container: HTMLElement,
        newItems: T[],
        getKey: (item: T) => string,
        renderItem: (item: T) => HTMLElement,
        updateItem?: (element: HTMLElement, item: T) => void
    ): void {
        const existingElements = new Map<string, HTMLElement>();
        const existingKeys = new Set<string>();
        
        // Map existing elements by their data keys
        Array.from(container.children).forEach(child => {
            const key = (child as HTMLElement).dataset.key;
            if (key) {
                existingElements.set(key, child as HTMLElement);
                existingKeys.add(key);
            }
        });
        
        const newKeys = new Set(newItems.map(getKey));
        const fragment = document.createDocumentFragment();
        
        // Process new items
        newItems.forEach(item => {
            const key = getKey(item);
            const existingElement = existingElements.get(key);
            
            if (existingElement) {
                // Update existing element
                if (updateItem) {
                    updateItem(existingElement, item);
                }
                fragment.appendChild(existingElement);
            } else {
                // Create new element
                const newElement = renderItem(item);
                newElement.dataset.key = key;
                fragment.appendChild(newElement);
            }
        });
        
        // Remove elements that are no longer needed
        existingKeys.forEach(key => {
            if (!newKeys.has(key)) {
                const element = existingElements.get(key);
                if (element && element.parentNode) {
                    element.remove();
                }
            }
        });
        
        // Replace container contents with the fragment
        // This preserves the order and only updates what's necessary
        container.replaceChildren(fragment);
    }
    
    /**
     * Create optimistic updates that can be reverted on error
     */
    createOptimisticUpdate(
        element: HTMLElement,
        updateFn: (element: HTMLElement) => void,
        revertFn: (element: HTMLElement) => void
    ): {
        commit: () => void;
        revert: () => void;
    } {
        // Apply optimistic update immediately
        updateFn(element);
        
        return {
            commit: () => {
                // Optimistic update was successful, no action needed
            },
            revert: () => {
                // Revert the optimistic update
                revertFn(element);
            }
        };
    }

    /**
     * Clean up all resources
     */
    destroy(): void {
        // Clear update queue
        this.updateQueue = [];
        this.isProcessing = false;
        
        // Clear all active timeouts
        for (const timeout of this.activeTimeouts) {
            clearTimeout(timeout);
        }
        this.activeTimeouts.clear();
    }
}

/**
 * State management for preserving UI state across updates
 */
export class UIStateManager {
    private stateMap = new Map<string, any>();
    
    /**
     * Save UI state for a specific element
     */
    saveState(key: string, element: HTMLElement): void {
        const reconciler = new DOMReconciler();
        this.stateMap.set(key, reconciler.preserveState(element));
    }
    
    /**
     * Restore UI state for a specific element
     */
    restoreState(key: string, element: HTMLElement): void {
        const state = this.stateMap.get(key);
        if (state) {
            const reconciler = new DOMReconciler();
            reconciler.restoreState(element, state);
        }
    }
    
    /**
     * Clear saved state
     */
    clearState(key?: string): void {
        if (key) {
            this.stateMap.delete(key);
        } else {
            this.stateMap.clear();
        }
    }

    /**
     * Clean up all resources
     */
    destroy(): void {
        this.stateMap.clear();
    }
}