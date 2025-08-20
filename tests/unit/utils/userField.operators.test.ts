import { getOperatorsForUserField, isOperatorValidForUserField } from '../../../src/utils/userFieldUtils';

describe('User Field operator mapping', () => {
  test('text operators', () => {
    expect(getOperatorsForUserField('text')).toEqual([
      'is','is-not','contains','does-not-contain','is-empty','is-not-empty'
    ]);
    expect(isOperatorValidForUserField('contains', 'text')).toBe(true);
    expect(isOperatorValidForUserField('is-checked', 'text')).toBe(false);
  });

  test('number operators', () => {
    expect(getOperatorsForUserField('number')).toEqual([
      'is','is-not','is-greater-than','is-less-than','is-empty','is-not-empty'
    ]);
    expect(isOperatorValidForUserField('is-greater-than', 'number')).toBe(true);
    expect(isOperatorValidForUserField('contains', 'number')).toBe(false);
  });

  test('date operators', () => {
    expect(getOperatorsForUserField('date')).toEqual([
      'is','is-not','is-before','is-after','is-on-or-before','is-on-or-after','is-empty','is-not-empty'
    ]);
    expect(isOperatorValidForUserField('is-before', 'date')).toBe(true);
    expect(isOperatorValidForUserField('is-checked', 'date')).toBe(false);
  });

  test('boolean operators', () => {
    expect(getOperatorsForUserField('boolean')).toEqual([
      'is-checked','is-not-checked'
    ]);
    expect(isOperatorValidForUserField('is-checked', 'boolean')).toBe(true);
    expect(isOperatorValidForUserField('is', 'boolean')).toBe(false);
  });

  test('list operators', () => {
    expect(getOperatorsForUserField('list')).toEqual([
      'contains','does-not-contain','is-empty','is-not-empty'
    ]);
    expect(isOperatorValidForUserField('contains', 'list')).toBe(true);
    expect(isOperatorValidForUserField('is-greater-than', 'list')).toBe(false);
  });
});

