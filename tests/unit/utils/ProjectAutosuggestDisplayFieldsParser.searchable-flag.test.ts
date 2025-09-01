import { parseDisplayFieldsRow, serializeDisplayFieldsRow } from '../../../src/utils/projectAutosuggestDisplayFieldsParser';

describe('ProjectAutosuggestDisplayFieldsParser - searchable flag', () => {
  it('parses |s flag', () => {
    const tokens = parseDisplayFieldsRow('{file.path|s}');
    expect(tokens).toEqual([{ property: 'file.path', showName: false, searchable: true } as any]);
  });

  it('parses combined flags n(Name)|s', () => {
    const tokens = parseDisplayFieldsRow('{tags|n(Tags)|s}');
    expect(tokens).toEqual([{ property: 'tags', showName: true, displayName: 'Tags', searchable: true } as any]);
  });

  it('serializes with |s when searchable is true', () => {
    const str = serializeDisplayFieldsRow([
      { property: 'file.path', showName: true, displayName: 'Path', searchable: true } as any
    ]);
    expect(str).toBe('{file.path|n(Path)|s}');
  });

  it('does not add |s when searchable is false/undefined', () => {
    const str = serializeDisplayFieldsRow([
      { property: 'title', showName: true, displayName: 'Title' } as any
    ]);
    expect(str).toBe('{title|n(Title)}');
  });
});

