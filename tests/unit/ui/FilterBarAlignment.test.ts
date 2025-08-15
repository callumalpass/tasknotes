import { App } from '../../__mocks__/obsidian';
import { FilterBar } from '../../../src/ui/FilterBar';

describe('FilterBar top controls alignment', () => {
  const emptyQuery: any = { type: 'group', id: 'g', conjunction: 'and', children: [] };
  const emptyOptions: any = { statuses: [], priorities: [], tags: [], contexts: [], projects: [] };

  function setupContainer() {
    document.body.innerHTML = '';
    const container = document.createElement('div');
    document.body.appendChild(container);
    return container;
  }

  test('right alignment: Filter -> Search -> Views ordering', () => {
    const container = setupContainer();
    const fb = new FilterBar(new App(), container, emptyQuery, emptyOptions, 'right');
    const row = container.querySelector('.filter-bar__top-controls') as HTMLElement;
    expect(row).toBeTruthy();

    const filterBtn = row.querySelector('.filter-bar__filter-toggle') as HTMLElement;
    const searchInput = row.querySelector('.filter-bar__search-input') as HTMLElement;
    const viewsBtn = row.querySelector('.filter-bar__templates-button') as HTMLElement;

    expect(filterBtn).toBeTruthy();
    expect(searchInput).toBeTruthy();
    expect(viewsBtn).toBeTruthy();

    // Relative order: filter before search before views
    expect(filterBtn.compareDocumentPosition(searchInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(searchInput.compareDocumentPosition(viewsBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('left alignment: Views -> Filter -> Search ordering', () => {
    const container = setupContainer();
    const fb = new FilterBar(new App(), container, emptyQuery, emptyOptions, 'left');
    const row = container.querySelector('.filter-bar__top-controls') as HTMLElement;
    expect(row).toBeTruthy();

    const viewsBtn = row.querySelector('.filter-bar__templates-button') as HTMLElement;
    const filterBtn = row.querySelector('.filter-bar__filter-toggle') as HTMLElement;
    const searchInput = row.querySelector('.filter-bar__search-input') as HTMLElement;

    expect(viewsBtn).toBeTruthy();
    expect(filterBtn).toBeTruthy();
    expect(searchInput).toBeTruthy();

    // Relative order: views before filter before search
    expect(viewsBtn.compareDocumentPosition(filterBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(filterBtn.compareDocumentPosition(searchInput) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('dropdown alignment class toggles', () => {
    const container = setupContainer();
    new FilterBar(new App(), container, emptyQuery, emptyOptions, 'left');
    const ddLeft = container.querySelector('.filter-bar__view-selector-dropdown') as HTMLElement;
    expect(ddLeft.className).toMatch(/filter-bar__view-selector-dropdown--left/);

    const container2 = setupContainer();
    new FilterBar(new App(), container2, emptyQuery, emptyOptions, 'right');
    const ddRight = container2.querySelector('.filter-bar__view-selector-dropdown') as HTMLElement;
    expect(ddRight.className).not.toMatch(/filter-bar__view-selector-dropdown--left/);
  });
});

