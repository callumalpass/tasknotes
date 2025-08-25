import { parseDisplayFieldsRow, serializeDisplayFieldsRow } from '../../../src/utils/displayFieldsParser';

describe('displayFieldsParser', () => {
  it('parses empty string as []', () => {
    expect(parseDisplayFieldsRow('')).toEqual([]);
  });

  it('parses single token with n and d()', () => {
    const tokens = parseDisplayFieldsRow('{due|n|d(Due)}');
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toMatchObject({ property: 'due', showName: true, displayName: 'Due' });
  });

  it('supports escaping in d()', () => {
    const tokens = parseDisplayFieldsRow('{x|d(A\\|B)} {y|d(C\\))}');
    expect(tokens[0].displayName).toBe('A|B');
    expect(tokens[1].displayName).toBe('C)');
  });

  it('errors on stray characters between tokens', () => {
    expect(() => parseDisplayFieldsRow('{a} x {b}')).toThrow();
  });

  it('round-trips with serializer', () => {
    const src = '{alpha|n|d(Name)} {beta}';
    const tokens = parseDisplayFieldsRow(src);
    const out = serializeDisplayFieldsRow(tokens);
    // allow normalization differences
    expect(parseDisplayFieldsRow(out)).toEqual(tokens);
  });
});

