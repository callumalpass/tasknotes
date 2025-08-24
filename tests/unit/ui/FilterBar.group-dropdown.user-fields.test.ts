import { FilterBar } from '../../../src/ui/FilterBar';
import { FilterQuery, FilterOptions } from '../../../src/types';

/**
 * FilterBar Group By dropdown - user fields integration
 */

describe('FilterBar Group By dropdown - user fields', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = '';
    (HTMLElement.prototype as any).empty = function() { this.innerHTML=''; return this; };
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  function createQuery(): FilterQuery {
    return { type: 'group', id: 'root', conjunction: 'and', children: [], sortKey: 'due', sortDirection: 'asc', groupKey: 'none' } as any;
  }

  function createOptions(): FilterOptions {
    return {
      statuses: [], priorities: [], contexts: [], projects: [], tags: [], folders: [],
      userProperties: [
        { id: 'user:assignee', label: 'Assignee' },
        { id: 'user:effort', label: 'Effort' }
      ] as any
    } as any;
  }

  test('renders user fields in Group By dropdown and preserves selection after re-render', () => {
    const container: any = document.createElement('div');
    container.empty = function(){ this.innerHTML=''; return this; };
    document.body.appendChild(container);

    const fb = new FilterBar(({} as any), container, createQuery(), createOptions());

    // Find the group select
    const select = container.querySelector('.filter-bar__group-container select') as HTMLSelectElement;
    expect(select).toBeTruthy();

    // Ensure options include user fields
    const opts = Array.from(select.options).map(o => ({ value: o.value, text: o.textContent }));
    const hasAssignee = opts.some(o => o.value === 'user:assignee' && o.text === 'Assignee');
    const hasEffort = opts.some(o => o.value === 'user:effort' && o.text === 'Effort');
    expect(hasAssignee).toBe(true);
    expect(hasEffort).toBe(true);

    // Change selection to a user field
    select.value = 'user:assignee';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    jest.advanceTimersByTime(310);

    // Force filter options update (simulates settings change) and verify selection persists
    (fb as any).updateFilterOptions(createOptions());
    const select2 = container.querySelector('.filter-bar__group-container select') as HTMLSelectElement;
    expect(select2.value).toBe('user:assignee');
  });
});

