import { App } from 'obsidian';
import { FilterBar } from '../../../src/ui/FilterBar';
import { FilterQuery, FilterOptions } from '../../../src/types';
import { makeContainer } from '../../helpers/dom-helpers';


const filterOptions: FilterOptions = { statuses: [], priorities: [], contexts: [], projects: [], tags: [] };

describe('FilterBar top controls', () => {
  let app: App;
  let container: HTMLElement;
  let fb: FilterBar;

  beforeEach(() => {
    document.body.innerHTML = '';
    app = new App();
    container = makeContainer();
  });

  it('renders collapse/expand buttons when grouped', () => {
    const query: FilterQuery = { type: 'group', id: 'root', conjunction: 'and', children: [], sortKey: 'due', sortDirection: 'asc', groupKey: 'status' };
    fb = new FilterBar(app, container, query, filterOptions);
    const top = container.querySelector('.filter-bar__top-controls') as HTMLElement;
    expect(top).toBeTruthy();
    // collapse then expand buttons exist in order
    const buttons = top.querySelectorAll('button');
    // Expect at least 3 buttons: filter, collapse, expand
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('does not render collapse/expand when grouping is none', () => {
    const query: FilterQuery = { type: 'group', id: 'root', conjunction: 'and', children: [], sortKey: 'due', sortDirection: 'asc', groupKey: 'none' };
    fb = new FilterBar(app, container, query, filterOptions);
    const top = container.querySelector('.filter-bar__top-controls') as HTMLElement;
    const collapse = top.querySelector('.filter-bar__collapse-groups');
    const expand = top.querySelector('.filter-bar__expand-groups');
    expect(collapse).toBeNull();
    expect(expand).toBeNull();
  });
});

