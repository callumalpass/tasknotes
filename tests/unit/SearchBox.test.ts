import { SearchBox } from '../../src/bases/components/SearchBox';

describe('SearchBox', () => {
	let container: HTMLElement;
	let searchBox: SearchBox;
	let onSearchMock: jest.Mock;

	beforeEach(() => {
		// Create a container element
		container = document.createElement('div');
		document.body.appendChild(container);
		
		// Create mock callback
		onSearchMock = jest.fn();
	});

	afterEach(() => {
		// Cleanup
		if (searchBox) {
			searchBox.destroy();
		}
		document.body.removeChild(container);
		jest.clearAllTimers();
	});

	describe('render', () => {
		it('should create search box container', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			const searchBoxEl = container.querySelector('.tn-search-box');
			expect(searchBoxEl).toBeTruthy();
		});

		it('should create input wrapper', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			const wrapper = container.querySelector('.tn-search-box__input-wrapper');
			expect(wrapper).toBeTruthy();
		});

		it('should create search input element', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;
			expect(input).toBeTruthy();
			expect(input.tagName).toBe('INPUT');
			expect(input.type).toBe('text');
		});

		it('should create clear button', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			const clearBtn = container.querySelector('.tn-search-box__clear');
			expect(clearBtn).toBeTruthy();
			expect(clearBtn?.tagName).toBe('BUTTON');
		});

		it('should create search icon', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			const icon = container.querySelector('.tn-search-box__icon');
			expect(icon).toBeTruthy();
		});

		it('should set placeholder text', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;
			expect(input.placeholder).toBe('Search tasks...');
		});

		it('should set ARIA label on input', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;
			expect(input.getAttribute('aria-label')).toBe('Search tasks');
		});

		it('should set ARIA label on clear button', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			const clearBtn = container.querySelector('.tn-search-box__clear') as HTMLButtonElement;
			expect(clearBtn.getAttribute('aria-label')).toBe('Clear search');
		});

		it('should hide clear button initially', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			const clearBtn = container.querySelector('.tn-search-box__clear') as HTMLElement;
			expect(clearBtn.classList.contains('is-visible')).toBe(false);
		});
	});

	describe('user interaction', () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('should call onSearch after debounce delay', () => {
			searchBox = new SearchBox(container, onSearchMock, 300);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;
			
			// Simulate typing
			input.value = 'test';
			input.dispatchEvent(new Event('input'));

			// Should not call immediately
			expect(onSearchMock).not.toHaveBeenCalled();

			// Fast-forward time
			jest.advanceTimersByTime(300);

			// Should call after debounce
			expect(onSearchMock).toHaveBeenCalledWith('test');
			expect(onSearchMock).toHaveBeenCalledTimes(1);
		});

		it('should not call onSearch before debounce delay', () => {
			searchBox = new SearchBox(container, onSearchMock, 300);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;
			
			input.value = 'test';
			input.dispatchEvent(new Event('input'));

			// Fast-forward only 200ms (less than 300ms debounce)
			jest.advanceTimersByTime(200);

			expect(onSearchMock).not.toHaveBeenCalled();
		});

		it('should debounce multiple rapid inputs', () => {
			searchBox = new SearchBox(container, onSearchMock, 300);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;
			
			// Simulate rapid typing
			input.value = 't';
			input.dispatchEvent(new Event('input'));
			jest.advanceTimersByTime(100);

			input.value = 'te';
			input.dispatchEvent(new Event('input'));
			jest.advanceTimersByTime(100);

			input.value = 'tes';
			input.dispatchEvent(new Event('input'));
			jest.advanceTimersByTime(100);

			input.value = 'test';
			input.dispatchEvent(new Event('input'));
			jest.advanceTimersByTime(300);

			// Should only call once with final value
			expect(onSearchMock).toHaveBeenCalledTimes(1);
			expect(onSearchMock).toHaveBeenCalledWith('test');
		});

		it('should show clear button when text is present', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;
			const clearBtn = container.querySelector('.tn-search-box__clear') as HTMLElement;

			input.value = 'test';
			input.dispatchEvent(new Event('input'));

			expect(clearBtn.classList.contains('is-visible')).toBe(true);
		});

		it('should hide clear button when text is empty', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;
			const clearBtn = container.querySelector('.tn-search-box__clear') as HTMLElement;

			// Add text first
			input.value = 'test';
			input.dispatchEvent(new Event('input'));
			expect(clearBtn.classList.contains('is-visible')).toBe(true);

			// Clear text
			input.value = '';
			input.dispatchEvent(new Event('input'));
			expect(clearBtn.classList.contains('is-visible')).toBe(false);
		});

		it('should clear input when clear button clicked', () => {
			searchBox = new SearchBox(container, onSearchMock, 300);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;
			const clearBtn = container.querySelector('.tn-search-box__clear') as HTMLButtonElement;

			// Add text
			input.value = 'test';
			input.dispatchEvent(new Event('input'));

			// Click clear button
			clearBtn.click();

			expect(input.value).toBe('');
		});

		it('should call onSearch with empty string when cleared', () => {
			searchBox = new SearchBox(container, onSearchMock, 300);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;
			const clearBtn = container.querySelector('.tn-search-box__clear') as HTMLButtonElement;

			// Add text
			input.value = 'test';
			input.dispatchEvent(new Event('input'));
			jest.advanceTimersByTime(300);

			// Clear
			clearBtn.click();
			jest.advanceTimersByTime(300);

			expect(onSearchMock).toHaveBeenCalledWith('');
		});

		it('should clear input when Escape key pressed', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;

			// Add text
			input.value = 'test';
			input.dispatchEvent(new Event('input'));

			// Press Escape
			const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
			input.dispatchEvent(escapeEvent);

			expect(input.value).toBe('');
		});

		it('should call onSearch with empty string when Escape pressed', () => {
			searchBox = new SearchBox(container, onSearchMock, 300);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;

			// Add text
			input.value = 'test';
			input.dispatchEvent(new Event('input'));
			jest.advanceTimersByTime(300);

			// Press Escape
			const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
			input.dispatchEvent(escapeEvent);
			jest.advanceTimersByTime(300);

			expect(onSearchMock).toHaveBeenCalledWith('');
		});
	});

	describe('getValue and setValue', () => {
		it('should get current input value', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;
			input.value = 'test value';

			expect(searchBox.getValue()).toBe('test value');
		});

		it('should set input value', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			searchBox.setValue('new value');

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;
			expect(input.value).toBe('new value');
		});

		it('should show clear button when setValue with non-empty value', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			searchBox.setValue('test');

			const clearBtn = container.querySelector('.tn-search-box__clear') as HTMLElement;
			expect(clearBtn.classList.contains('is-visible')).toBe(true);
		});
	});

	describe('clear', () => {
		it('should clear input value', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;
			input.value = 'test';

			searchBox.clear();

			expect(input.value).toBe('');
		});

		it('should hide clear button', () => {
			searchBox = new SearchBox(container, onSearchMock);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;
			input.value = 'test';
			input.dispatchEvent(new Event('input'));

			searchBox.clear();

			const clearBtn = container.querySelector('.tn-search-box__clear') as HTMLElement;
			expect(clearBtn.classList.contains('is-visible')).toBe(false);
		});
	});

	describe('destroy', () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			jest.useRealTimers();
		});

		it('should clear debounce timers', () => {
			searchBox = new SearchBox(container, onSearchMock, 300);
			searchBox.render();

			const input = container.querySelector('.tn-search-box__input') as HTMLInputElement;
			
			// Start typing
			input.value = 'test';
			input.dispatchEvent(new Event('input'));

			// Destroy before debounce completes
			searchBox.destroy();

			// Fast-forward time
			jest.advanceTimersByTime(300);

			// Should not call onSearch after destroy
			expect(onSearchMock).not.toHaveBeenCalled();
		});
	});
});

