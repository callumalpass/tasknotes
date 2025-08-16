/**
 * FilterBar Component Tests
 * - Badge toggles on search text and grouping
 * - Right-click on filter toggle clears filters and resets grouping
 */

import { FilterBar } from '../../../src/ui/FilterBar';
import { FilterQuery, FilterOptions } from '../../../src/types';

// Provide a focused manual mock for 'obsidian' UI APIs used by FilterBar
jest.mock('obsidian', () => {
  class App {}
  class Modal {}

  function setTooltip(el: HTMLElement, _tip: string) {
    // minimal noop; tests inspect classes, not tooltips
    el.setAttribute('data-has-tooltip', '1');
  }

  // Simple debounce that uses real timers
  function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
    let t: any;
    const wrapped = (...args: Parameters<T>) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
    return wrapped as T;
  }

  class ButtonComponent {
    buttonEl: HTMLButtonElement;
    constructor(parent: HTMLElement) {
      this.buttonEl = document.createElement('button');
      parent.appendChild(this.buttonEl);
    }
    setIcon(_icon: string) { return this; }
    setTooltip(_t: string) { return this; }
    setClass(cls: string) { this.buttonEl.classList.add(cls); return this; }
    setButtonText(text: string) { this.buttonEl.textContent = text; return this; }
    onClick(cb: () => void) { this.buttonEl.addEventListener('click', cb); return this; }
  }

  class TextComponent {
    inputEl: HTMLInputElement;
    constructor(parent: HTMLElement) {
      this.inputEl = document.createElement('input');
      this.inputEl.type = 'text';
      parent.appendChild(this.inputEl);
    }
    setPlaceholder(p: string) { this.inputEl.placeholder = p; return this; }
    onChange(cb: (value: string) => void) {
      this.inputEl.addEventListener('input', () => cb(this.inputEl.value));
      return this;
    }
    setValue(v: string) { this.inputEl.value = v; return this; }
    getValue() { return this.inputEl.value; }
  }

  class DropdownComponent {
    selectEl: HTMLSelectElement;
    constructor(parent: HTMLElement) {
      this.selectEl = document.createElement('select');
      parent.appendChild(this.selectEl);
    }
    addOption(value: string, label: string) { const opt = document.createElement('option'); opt.value = value; opt.textContent = label; this.selectEl.appendChild(opt); return this; }
    addOptions(opts: Record<string, string>) { Object.entries(opts).forEach(([v,l]) => this.addOption(v,l)); return this; }
    setValue(v: string) { this.selectEl.value = v; return this; }
    onChange(cb: (value: any) => void) { this.selectEl.addEventListener('change', () => cb(this.selectEl.value)); return this; }
  }

  return { App, Modal, ButtonComponent, TextComponent, DropdownComponent, setTooltip, debounce };
});

// Use fake timers to control debounce
beforeEach(() => {
  jest.useFakeTimers();
  document.body.innerHTML = '';
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

function createFilterOptions(): FilterOptions {
  return {
    statuses: [{ value: 'open', label: 'Open', color: '#000' } as any],
    priorities: [{ value: 'normal', label: 'Normal', color: '#000' } as any],
    tags: [],
    contexts: [],
    projects: [],
  } as FilterOptions;
}

function createDefaultQuery(): FilterQuery {
  return {
    type: 'group',
    id: 'root',
    conjunction: 'and',
    children: [],
    sortKey: 'due',
    sortDirection: 'asc',
    groupKey: 'none',
  } as any;
}

describe('FilterBar badge and clear behavior', () => {
  test('badge appears after typing in search box, disappears after right-click clear', () => {
    const container = document.createElement('div') as any;
    // Provide empty() shim used by FilterBar.render()
    container.empty = function() { this.innerHTML = ''; return this; };
    document.body.appendChild(container);

    const fb = new FilterBar(({} as any), container, createDefaultQuery(), createFilterOptions());

    const toggle = container.querySelector('.filter-bar__filter-toggle') as HTMLElement;
    expect(toggle).not.toBeNull();
    expect(toggle.classList.contains('has-active-filters')).toBe(false);

    // Type into search input
    const search = container.querySelector('.filter-bar__search-input') as HTMLInputElement;
    expect(search).toBeTruthy();
    search.value = 'alpha';
    search.dispatchEvent(new Event('input', { bubbles: true }));

    // Run debounce (800ms)
    jest.advanceTimersByTime(850);

    // Badge should be on
    expect(toggle.classList.contains('has-active-filters')).toBe(true);

    // Right-click to clear
    toggle.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));

    // Re-render is synchronous; badge should be off
    const toggle2 = container.querySelector('.filter-bar__filter-toggle') as HTMLElement;
    expect(toggle2.classList.contains('has-active-filters')).toBe(false);

    // Group should be None and no conditions
    const q = (fb as any).getCurrentQuery();
    expect(q.groupKey).toBe('none');
    expect(Array.isArray(q.children) && q.children.length === 0).toBe(true);
  });

  test('badge toggles with Group By changes and clears on right-click', () => {
    const container = document.createElement('div') as any;
    container.empty = function() { this.innerHTML = ''; return this; };
    document.body.appendChild(container);

    const fb = new FilterBar(({} as any), container, createDefaultQuery(), createFilterOptions());
    const toggle = container.querySelector('.filter-bar__filter-toggle') as HTMLElement;

    // Change group dropdown
    const groupSelect = container.querySelector('.filter-bar__group-container select') as HTMLSelectElement;
    expect(groupSelect).not.toBeNull();
    // Ensure option exists; add if missing
    if (![...groupSelect.options].some(o => o.value === 'project')) {
      const opt = document.createElement('option'); opt.value = 'project'; opt.textContent = 'Project'; groupSelect.appendChild(opt);
    }
    groupSelect.value = 'project';
    groupSelect.dispatchEvent(new Event('change', { bubbles: true }));

    // Run potential debounce of 300ms for emitQueryChange path
    jest.advanceTimersByTime(310);

    expect(toggle.classList.contains('has-active-filters')).toBe(true);

    // Right-click to clear resets grouping
    toggle.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    const q = (fb as any).getCurrentQuery();
    expect(q.groupKey).toBe('none');
    const toggle2 = container.querySelector('.filter-bar__filter-toggle') as HTMLElement;
    expect(toggle2.classList.contains('has-active-filters')).toBe(false);
  });
});

