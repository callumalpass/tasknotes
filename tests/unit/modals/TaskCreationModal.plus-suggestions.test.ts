import { FieldMapper } from '../../../src/services/FieldMapper';
import { DEFAULT_FIELD_MAPPING } from '../../../src/settings/defaults';

describe('FieldMapper title normalization', () => {
  const mapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
  const path = 'Folder/Note.md';

  it('returns string as-is', () => {
    const fm = { title: 'Hello' } as any;
    const mapped = mapper.mapFromFrontmatter(fm, path);
    expect(mapped.title).toBe('Hello');
  });

  it('flattens array titles by joining with comma + space', () => {
    const fm = { title: ['Alpha', 'Beta'] } as any;
    const mapped = mapper.mapFromFrontmatter(fm, path);
    expect(mapped.title).toBe('Alpha, Beta');
  });

  it('converts number and boolean to strings', () => {
    const num = mapper.mapFromFrontmatter({ title: 123 }, path);
    const boolT = mapper.mapFromFrontmatter({ title: true }, path);
    const boolF = mapper.mapFromFrontmatter({ title: false }, path);
    expect(num.title).toBe('123');
    expect(boolT.title).toBe('true');
    expect(boolF.title).toBe('false');
  });

  it('returns empty string for object titles', () => {
    const fm = { title: { name: 'Charlie' } } as any;
    const mapped = mapper.mapFromFrontmatter(fm, path);
    expect(mapped.title).toBe('');
  });

  it('falls back to filename when storeTitleInFilename is true and no title present', () => {
    const mapped = mapper.mapFromFrontmatter({}, 'Tasks/My Task.md', true);
    expect(mapped.title).toBe('My Task');
  });

  it('does not set title when missing and storeTitleInFilename is false', () => {
    const mapped = mapper.mapFromFrontmatter({}, 'Tasks/My Task.md', false);
    expect(mapped.title).toBeUndefined();
  });
});

