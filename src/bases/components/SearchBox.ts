import { setIcon } from 'obsidian';
import { debounce } from '../../settings/components/settingHelpers';

/**
 * SearchBox - UI component for task search functionality
 *
 * Renders a search input with debouncing, clear button, and keyboard support.
 * Follows Single Responsibility Principle - only handles UI rendering and user interaction.
 */
export class SearchBox {
	private container: HTMLElement;
	private onSearch: (term: string) => void;
	private debounceMs: number;
	
	private searchBoxEl: HTMLElement | null = null;
	private inputEl: HTMLInputElement | null = null;
	private clearBtnEl: HTMLElement | null = null;

	private debouncedSearch: ((term: string) => void) | null = null;
	private destroyed = false;

	/**
	 * @param container - Parent container element
	 * @param onSearch - Callback function called when search term changes
	 * @param debounceMs - Debounce delay in milliseconds (default: 300)
	 */
	constructor(
		container: HTMLElement,
		onSearch: (term: string) => void,
		debounceMs: number = 300
	) {
		this.container = container;
		this.onSearch = onSearch;
		this.debounceMs = debounceMs;

		// Create debounced search handler with destroyed check
		this.debouncedSearch = debounce(
			(term: string) => {
				// Don't execute if component has been destroyed
				if (!this.destroyed) {
					this.onSearch(term);
				}
			},
			this.debounceMs,
			false // trailing debounce
		);
	}

	/**
	 * Render the search box UI
	 */
	render(): HTMLElement {
		// Create main container
		this.searchBoxEl = document.createElement('div');
		this.searchBoxEl.className = 'tn-search-box';

		// Create input wrapper
		const inputWrapper = document.createElement('div');
		inputWrapper.className = 'tn-search-box__input-wrapper';

		// Create search icon using Lucide icon (like Obsidian)
		const icon = document.createElement('div');
		icon.className = 'tn-search-box__icon';
		setIcon(icon, 'search');

		// Create input element
		this.inputEl = document.createElement('input');
		this.inputEl.type = 'text';
		this.inputEl.className = 'tn-search-box__input';
		this.inputEl.placeholder = 'Search tasks...';
		this.inputEl.setAttribute('aria-label', 'Search tasks');

		// Create clear button
		const clearBtn = document.createElement('button');
		clearBtn.type = 'button';
		clearBtn.className = 'tn-search-box__clear';
		clearBtn.textContent = '×';
		clearBtn.setAttribute('aria-label', 'Clear search');
		this.clearBtnEl = clearBtn;

		// Assemble elements
		inputWrapper.appendChild(icon);
		inputWrapper.appendChild(this.inputEl);
		inputWrapper.appendChild(this.clearBtnEl);
		this.searchBoxEl.appendChild(inputWrapper);
		this.container.appendChild(this.searchBoxEl);

		// Attach event listeners
		this.attachEventListeners();

		return this.searchBoxEl;
	}

	/**
	 * Attach event listeners to input and clear button
	 */
	private attachEventListeners(): void {
		if (!this.inputEl || !this.clearBtnEl) return;

		// Input event - debounced search
		this.inputEl.addEventListener('input', this.handleInput);

		// Keydown event - handle Escape key
		this.inputEl.addEventListener('keydown', this.handleKeydown);

		// Clear button click
		this.clearBtnEl.addEventListener('click', this.handleClear);
	}

	/**
	 * Handle input event
	 */
	private handleInput = (): void => {
		if (!this.inputEl) return;

		const value = this.inputEl.value;
		
		// Update clear button visibility
		this.updateClearButtonVisibility();

		// Call debounced search
		if (this.debouncedSearch) {
			this.debouncedSearch(value);
		}
	};

	/**
	 * Handle keydown event
	 */
	private handleKeydown = (e: KeyboardEvent): void => {
		if (e.key === 'Escape') {
			this.clear();
			// Trigger search with empty term
			if (this.debouncedSearch) {
				this.debouncedSearch('');
			}
		}
	};

	/**
	 * Handle clear button click
	 */
	private handleClear = (): void => {
		this.clear();
		// Trigger search with empty term
		if (this.debouncedSearch) {
			this.debouncedSearch('');
		}
		// Focus input after clearing
		this.inputEl?.focus();
	};

	/**
	 * Update clear button visibility based on input value
	 */
	private updateClearButtonVisibility(): void {
		if (!this.inputEl || !this.clearBtnEl) return;

		const hasValue = this.inputEl.value.length > 0;
		
		if (hasValue) {
			this.clearBtnEl.classList.add('is-visible');
		} else {
			this.clearBtnEl.classList.remove('is-visible');
		}
	}

	/**
	 * Get current input value
	 */
	getValue(): string {
		return this.inputEl?.value || '';
	}

	/**
	 * Set input value programmatically
	 */
	setValue(value: string): void {
		if (!this.inputEl) return;
		
		this.inputEl.value = value;
		this.updateClearButtonVisibility();
	}

	/**
	 * Clear the input
	 */
	clear(): void {
		if (!this.inputEl) return;
		
		this.inputEl.value = '';
		this.updateClearButtonVisibility();
	}

	/**
	 * Clean up event listeners and timers
	 */
	destroy(): void {
		// Mark as destroyed to prevent debounced callbacks from executing
		this.destroyed = true;

		// Remove event listeners
		if (this.inputEl) {
			this.inputEl.removeEventListener('input', this.handleInput);
			this.inputEl.removeEventListener('keydown', this.handleKeydown);
		}

		if (this.clearBtnEl) {
			this.clearBtnEl.removeEventListener('click', this.handleClear);
		}

		// Clear references
		this.inputEl = null;
		this.clearBtnEl = null;
		this.searchBoxEl = null;
		this.debouncedSearch = null;
	}
}

