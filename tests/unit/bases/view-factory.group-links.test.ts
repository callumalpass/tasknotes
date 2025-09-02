import { renderTextWithLinks } from '../../../src/ui/renderers/linkRenderer';

// Smoke test for link rendering in group headers: ensure wikilinks/markdown are converted to anchors
// We don't unit-test view-factory's whole DOM flow here; we test the renderer used by it.

describe('Bases Task List group header link rendering', () => {
  const deps = {
    metadataCache: { getFirstLinkpathDest: jest.fn(() => ({ path: 'X.md' })) } as any,
    workspace: { getLeaf: jest.fn(() => ({ openFile: jest.fn() })), trigger: jest.fn() } as any
  };

  it('renders wikilink as internal link', () => {
    const el = document.createElement('div');
    renderTextWithLinks(el, '[[Sample Project A]]', deps);
    const a = el.querySelector('a.internal-link') as HTMLAnchorElement;
    expect(a).toBeTruthy();
    expect(a.textContent).toBe('Sample Project A');
    expect(a.getAttribute('data-href')).toBe('Sample Project A');
  });

  it('renders markdown link as internal or external accordingly', () => {
    const el = document.createElement('div');
    renderTextWithLinks(el, '[Docs](docs/README)', deps);
    const internal = el.querySelector('a.internal-link') as HTMLAnchorElement;
    expect(internal).toBeTruthy();
    expect(internal.textContent).toBe('Docs');

    const el2 = document.createElement('div');
    renderTextWithLinks(el2, '[External](https://example.com)', deps);
    const external = el2.querySelector('a.external-link') as HTMLAnchorElement;
    expect(external).toBeTruthy();
    expect(external.textContent).toBe('External');
  });
});

