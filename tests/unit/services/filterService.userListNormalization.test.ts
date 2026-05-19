import type { UserMappedField } from '../../../src/types/settings';
import {
  coerceUserFieldTaskValue,
  compareUserFieldValues,
  findUserFieldById,
  findUserFieldByIdOrKey,
  getHierarchicalUserFieldGroupValues,
  getUserFieldGroupValue,
  normalizeUserListValue,
  sortUserFieldGroupKeys,
} from '../../../src/services/filter-service/userFieldValues';

function createUserField(overrides: Partial<UserMappedField>): UserMappedField {
  return {
    id: 'field',
    key: 'field',
    displayName: 'Field',
    type: 'text',
    ...overrides,
  };
}

describe('user field value helpers', () => {
  test('wikilink with comma stays single token list with human and raw tokens', () => {
    const tokens = normalizeUserListValue('[[Health, Fitness & Mindset]]');
    expect(tokens).toEqual([
      'Health, Fitness & Mindset',
      '[[Health, Fitness & Mindset]]'
    ]);
  });

  test('alias wikilink with comma yields alias and raw', () => {
    const tokens = normalizeUserListValue('[[Wellbeing|Health, Fitness & Mindset]]');
    expect(tokens).toEqual([
      'Health, Fitness & Mindset',
      '[[Wellbeing|Health, Fitness & Mindset]]'
    ]);
  });

  test('mixed string splits at top-level commas only', () => {
    const tokens = normalizeUserListValue('[[A,B]], [[C|X,Y]], Z');
    expect(tokens).toEqual([
      'A,B',
      '[[A,B]]',
      'X,Y',
      '[[C|X,Y]]',
      'Z'
    ]);
  });

  test('array input remains unaffected', () => {
    const tokens = normalizeUserListValue(['[[Health, Fitness & Mindset]]', 'Notes']);
    expect(tokens).toEqual([
      'Health, Fitness & Mindset',
      '[[Health, Fitness & Mindset]]',
      'Notes'
    ]);
  });

  test('finds user fields by stable id and by frontmatter key when needed', () => {
    const fields = [
      createUserField({ id: 'review-cycle', key: 'reviewCycle', displayName: 'Review cycle' }),
    ];

    expect(findUserFieldById(fields, 'review-cycle')).toBe(fields[0]);
    expect(findUserFieldById(fields, 'reviewCycle')).toBeUndefined();
    expect(findUserFieldByIdOrKey(fields, 'reviewCycle')).toBe(fields[0]);
  });

  test('coerces frontmatter values for user-field filtering', () => {
    expect(coerceUserFieldTaskValue(createUserField({ type: 'boolean' }), undefined)).toBe(false);
    expect(coerceUserFieldTaskValue(createUserField({ type: 'number' }), '10-High')).toBe(10);
    expect(coerceUserFieldTaskValue(createUserField({ type: 'list' }), '[[A,B]], C')).toEqual([
      'A,B',
      '[[A,B]]',
      'C',
    ]);
  });

  test('builds stable grouping buckets from custom-field values', () => {
    expect(getUserFieldGroupValue(createUserField({ type: 'boolean' }), 'false')).toBe('false');
    expect(getUserFieldGroupValue(createUserField({ type: 'number' }), '10-High')).toBe('10');
    expect(getUserFieldGroupValue(createUserField({ type: 'number' }), 'High')).toBe('non-numeric');
    expect(getUserFieldGroupValue(createUserField({ type: 'date' }), undefined)).toBe('no-date');
    expect(getUserFieldGroupValue(createUserField({ type: 'list' }), '[[People/Ada]], Bob')).toBe('Ada');
  });

  test('uses display tokens for hierarchical list grouping and a caller-provided missing label', () => {
    const field = createUserField({ type: 'list', displayName: 'Reviewers' });

    expect(
      getHierarchicalUserFieldGroupValues(field, '[[People/Ada]], [[People/Bob|Bobby]]', 'No Reviewers')
    ).toEqual(['Ada', 'Bobby']);
    expect(getHierarchicalUserFieldGroupValues(field, '', 'No Reviewers')).toEqual(['No Reviewers']);
  });

  test('sorts user-field group headings by field semantics', () => {
    expect(sortUserFieldGroupKeys(['no-value', '2', '10'], createUserField({ type: 'number' }))).toEqual([
      '10',
      '2',
      'no-value',
    ]);
    expect(sortUserFieldGroupKeys(['false', 'true', 'no-value'], createUserField({ type: 'boolean' }))).toEqual([
      'no-value',
      'true',
      'false',
    ]);
    expect(sortUserFieldGroupKeys(['invalid', '2025-01-02', '2025-01-01'], createUserField({ type: 'date' }))).toEqual([
      '2025-01-01',
      '2025-01-02',
      'invalid',
    ]);
  });

  test('compares user-field sort values without cache or plugin dependencies', () => {
    expect(compareUserFieldValues(createUserField({ type: 'number' }), '5', '10')).toBeLessThan(0);
    expect(compareUserFieldValues(createUserField({ type: 'boolean' }), true, false)).toBeLessThan(0);
    expect(compareUserFieldValues(createUserField({ type: 'list' }), '', 'Alpha')).toBeGreaterThan(0);
  });
});
