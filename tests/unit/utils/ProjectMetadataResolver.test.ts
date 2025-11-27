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

  describe('buildMetadataRows', () => {
    const mockParseDisplayFieldsRow = (row: string) => {
      // Simple mock parser for testing
      if (row === '{title}') {
        return [{ property: 'title', showName: false }];
      }
      if (row === '{title|n(Title)}') {
        return [{ property: 'title', showName: true, displayName: 'Title' }];
      }
      if (row === 'Path: {file.path}') {
        return [
          { property: 'literal:Path: ', showName: false },
          { property: 'file.path', showName: false }
        ];
      }
      if (row === '{missing}') {
        return [{ property: 'missing', showName: false }];
      }
      if (row === 'invalid') {
        throw new Error('Parse error');
      }
      return [];
    };

    it('builds metadata rows from row configs', () => {
      const e = makeEntry();
      const rows = r.buildMetadataRows(['{title}'], e, mockParseDisplayFieldsRow);
      expect(rows).toEqual(['Titled']);
    });

    it('builds rows with showName flag', () => {
      const e = makeEntry();
      const rows = r.buildMetadataRows(['{title|n(Title)}'], e, mockParseDisplayFieldsRow);
      expect(rows).toEqual(['Title: Titled']);
    });

    it('handles literal prefixes', () => {
      const e = makeEntry();
      const rows = r.buildMetadataRows(['Path: {file.path}'], e, mockParseDisplayFieldsRow);
      expect(rows).toEqual(['Path:  Area/Note.md']);
    });

    it('skips rows with no resolved values', () => {
      const e = makeEntry();
      const rows = r.buildMetadataRows(['{missing}'], e, mockParseDisplayFieldsRow);
      expect(rows).toEqual([]);
    });

    it('limits to 3 rows maximum', () => {
      const e = makeEntry();
      const rows = r.buildMetadataRows(
        ['{title}', '{title}', '{title}', '{title}', '{title}'],
        e,
        mockParseDisplayFieldsRow
      );
      expect(rows).toHaveLength(3);
    });

    it('handles parse errors gracefully', () => {
      const e = makeEntry();
      const rows = r.buildMetadataRows(['invalid', '{title}'], e, mockParseDisplayFieldsRow);
      expect(rows).toEqual(['Titled']);
    });
  });
});

