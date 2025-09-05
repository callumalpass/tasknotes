import { parseDisplayFieldsRow, serializeDisplayFieldsRow } from '../../../src/utils/projectAutosuggestDisplayFieldsParser';

describe('ProjectAutosuggestDisplayFieldsParser', () => {
  it('parses a single token with name flag n', () => {
    const tokens = parseDisplayFieldsRow('{file.path|n}');
    expect(tokens).toEqual([
      { property: 'file.path', showName: true }
    ]);
  });

  it('parses a token with custom label n(Name)', () => {
    const tokens = parseDisplayFieldsRow('{title|n(Title)}');
    expect(tokens).toEqual([
      { property: 'title', showName: true, displayName: 'Title' }
    ]);
  });

  it('keeps literal text around tokens', () => {
    const tokens = parseDisplayFieldsRow('Path: {file.path}');
    expect(tokens).toEqual([
      { property: 'literal:Path: ', showName: false },
      { property: 'file.path', showName: false }
    ]);
  });

  it('serializes tokens back to a string', () => {
    const str = serializeDisplayFieldsRow([
      { property: 'literal:Path: ', showName: false },
      { property: 'file.path', showName: true, displayName: 'Location' }
    ]);
    expect(str).toBe('Path: {file.path|n(Location)}');
  });
});

