import { parseDisplayFieldsRow, serializeDisplayFieldsRow } from '../../../src/utils/displayFieldsParser';

describe('displayFieldsParser', () => {
  it('parses empty string as []', () => {
    expect(parseDisplayFieldsRow('')).toEqual([]);
  });

  it('parses n and n(Name)', () => {
    const t1 = parseDisplayFieldsRow('{due|n}');
    expect(t1).toHaveLength(1);
    expect(t1[0]).toMatchObject({ property: 'due', showName: true });

    const t2 = parseDisplayFieldsRow('{due|n(Due)}');
    expect(t2).toHaveLength(1);
    expect(t2[0]).toMatchObject({ property: 'due', showName: true, displayName: 'Due' });
  });

  it('maintains back-compat with d()', () => {
    const tokens = parseDisplayFieldsRow('{x|n|d(A)} {y|d(B)|n}');
    const nonLiteral = tokens.filter(t => !(typeof t.property === 'string' && t.property.startsWith('literal:')));
    expect(nonLiteral[0]).toMatchObject({ property: 'x', showName: true, displayName: 'A' });
    expect(nonLiteral[1]).toMatchObject({ property: 'y', showName: true, displayName: 'B' });
  });

  it('supports escaping in n(Name)', () => {
    const tokens = parseDisplayFieldsRow('{x|n(A\\|B)} {y|n(C\\))}');
    const nonLiteral = tokens.filter(t => !(typeof t.property === 'string' && t.property.startsWith('literal:')));
    expect(nonLiteral[0].displayName).toBe('A|B');
    expect(nonLiteral[1].displayName).toBe('C)');
  });

  it('handles stray characters between tokens as literal segments', () => {
    const tokens = parseDisplayFieldsRow('{a} x {b}');
    expect(tokens).toEqual([
      { property: 'a', showName: false },
      { property: 'literal: x ', showName: false },
      { property: 'b', showName: false }
    ]);
  });

  it('round-trips with serializer (normalizes to n(Name))', () => {
    const src = '{alpha|n|d(Name)} {beta}';
    const tokens = parseDisplayFieldsRow(src);
    const out = serializeDisplayFieldsRow(tokens);
    expect(out).toContain('{alpha|n(Name)}');
    expect(parseDisplayFieldsRow(out)).toEqual(tokens);
  });
});

