import { ProjectMetadataResolver } from '../../../src/utils/projectMetadataResolver';

const makeEntry = (over: Partial<any> = {}) => ({
  basename: 'Note',
  name: 'Note.md',
  path: 'Area/Note.md',
  parent: 'Area',
  title: 'Titled',
  aliases: ['Alias A', 'Alias B'],
  frontmatter: { custom: 'Value' },
  ...over,
});

describe('ProjectMetadataResolver', () => {
  const r = new ProjectMetadataResolver({
    getFrontmatter: (e) => e.frontmatter,
  });

  it('resolves file.* placeholders', () => {
    const e = makeEntry();
    expect(r.resolve('file.basename', e)).toBe('Note');
    expect(r.resolve('file.name', e)).toBe('Note.md');
    expect(r.resolve('file.path', e)).toBe('Area/Note.md');
    expect(r.resolve('file.parent', e)).toBe('Area');
  });

  it('resolves title and aliases', () => {
    const e = makeEntry();
    expect(r.resolve('title', e)).toBe('Titled');
    expect(r.resolve('aliases', e)).toBe('Alias A, Alias B');
  });

  it('resolves frontmatter property without prefix and with explicit prefix', () => {
    const e = makeEntry();
    expect(r.resolve('custom', e)).toBe('Value');
    expect(r.resolve('frontmatter:custom', e)).toBe('Value');
    expect(r.resolve('missing', e)).toBe('');
  });

  it('returns empty for unknown keys', () => {
    const e = makeEntry();
    expect(r.resolve('unknown', e)).toBe('');
  });
});

