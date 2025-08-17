/**
 * FilterBar Badge and Quick-Clear tests (focused)
 */

import { FilterBar } from '../../../src/ui/FilterBar';
import { FilterQuery, FilterOptions } from '../../../src/types';

// Focused lightweight mock for obsidian UI pieces FilterBar uses
jest.mock('obsidian', () => {
  class App {}
  class Modal {}
  const setTooltip = (el: HTMLElement, _t: string) => { el.setAttribute('data-tip', '1'); };
  const debounce = (fn: any, delay: number) => {
    let t: any; return (...args: any[]) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  };
  class ButtonComponent {
    buttonEl: HTMLButtonElement;
    constructor(parent: HTMLElement) { this.buttonEl = document.createElement('button'); parent.appendChild(this.buttonEl); }
    setIcon(_i: string) { return this; }
    setTooltip(_t: string) { return this; }
    setClass(c: string) { this.buttonEl.classList.add(c); return this; }
    setButtonText(t: string) { this.buttonEl.textContent = t; return this; }
    onClick(cb: () => void) { this.buttonEl.addEventListener('click', cb); return this; }
  }
  class TextComponent {
    inputEl: HTMLInputElement;
    constructor(parent: HTMLElement) { this.inputEl = document.createElement('input'); this.inputEl.type = 'text'; parent.appendChild(this.inputEl); }
    setPlaceholder(p: string) { this.inputEl.placeholder = p; return this; }
    onChange(cb: (v: string)=>void) { this.inputEl.addEventListener('input', ()=>cb(this.inputEl.value)); return this; }
    setValue(v: string) { this.inputEl.value = v; return this; }
    getValue() { return this.inputEl.value; }
  }
  class DropdownComponent {
    selectEl: HTMLSelectElement;
    constructor(parent: HTMLElement) { this.selectEl = document.createElement('select'); parent.appendChild(this.selectEl); }
    addOption(v: string, l: string) { const o = document.createElement('option'); o.value=v; o.textContent=l; this.selectEl.appendChild(o); return this; }
    addOptions(o: Record<string,string>) { Object.entries(o).forEach(([v,l])=>this.addOption(v,l)); return this; }
    setValue(v: string) { this.selectEl.value = v; return this; }
    onChange(cb: (v: any)=>void) { this.selectEl.addEventListener('change', ()=>cb(this.selectEl.value)); return this; }
  }
  return { App, Modal, ButtonComponent, TextComponent, DropdownComponent, setTooltip, debounce };
});

beforeEach(() => {
  jest.useFakeTimers();
  document.body.innerHTML = '';
  // Shim Obsidian-style .empty() available on HTMLElement
  // so that all created elements support it during render/update
  (HTMLElement.prototype as any).empty = function() { this.innerHTML=''; return this; };
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

function opts(): FilterOptions {
  return {
    statuses: [{ value: 'open', label: 'Open', color: '#000' } as any],
    priorities: [{ value: 'normal', label: 'Normal', color: '#000' } as any],
    tags: [], contexts: [], projects: [],
  } as FilterOptions;
}
function q(): FilterQuery {
  return { type:'group', id:'root', conjunction:'and', children:[], sortKey:'due', sortDirection:'asc', groupKey:'none' } as any;
}

describe('FilterBar badge + right-click clear (focused)', () => {
  it('search shows badge; right-click clears filters and badge', () => {
    const container: any = document.createElement('div');
    container.empty = function(){ this.innerHTML=''; return this; };
    document.body.appendChild(container);

    const fb = new FilterBar(({} as any), container, q(), opts());

    const toggle = container.querySelector('.filter-bar__filter-toggle') as HTMLElement;
    expect(toggle).not.toBeNull();
    expect(toggle.classList.contains('has-active-filters')).toBe(false);

    const search = container.querySelector('.filter-bar__search-input') as HTMLInputElement;
    search.value = 'alpha';
    search.dispatchEvent(new Event('input', { bubbles: true }));

    jest.advanceTimersByTime(850);
    expect(toggle.classList.contains('has-active-filters')).toBe(true);

    toggle.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    const q1 = (fb as any).getCurrentQuery();
    expect(q1.groupKey).toBe('none');
    const toggle2 = container.querySelector('.filter-bar__filter-toggle') as HTMLElement;
    expect(toggle2.classList.contains('has-active-filters')).toBe(false);
  });

  it('grouping shows badge; right-click resets grouping to none and clears badge', () => {
    const container: any = document.createElement('div');
    container.empty = function(){ this.innerHTML=''; return this; };
    document.body.appendChild(container);

    const fb = new FilterBar(({} as any), container, q(), opts());
    const toggle = container.querySelector('.filter-bar__filter-toggle') as HTMLElement;

    // Directly set grouping on the query (avoids relying on DOM drop-down rendering in tests)
    (fb as any).currentQuery.groupKey = 'project';
    (fb as any).updateFilterToggleBadge();

    jest.advanceTimersByTime(10);
    expect(toggle.classList.contains('has-active-filters')).toBe(true);

    toggle.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    const q2 = (fb as any).getCurrentQuery();
    expect(q2.groupKey).toBe('none');
    const toggle2 = container.querySelector('.filter-bar__filter-toggle') as HTMLElement;
    expect(toggle2.classList.contains('has-active-filters')).toBe(false);
  });
});

