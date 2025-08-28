import { scoreMultiword } from '../../../src/utils/fuzzyMatch';

describe('scoreMultiword', () => {
  it('returns 0 for no match', () => {
    expect(scoreMultiword('alpha beta', 'gamma')).toBe(0);
  });

  it('matches single token', () => {
    expect(scoreMultiword('alpha', 'project alpha')).toBeGreaterThan(0);
  });

  it('requires all tokens present', () => {
    expect(scoreMultiword('alpha beta', 'project alpha')).toBe(0);
  });

  it('rewards earlier positions', () => {
    const early = scoreMultiword('alpha', 'alpha project');
    const late = scoreMultiword('alpha', 'project alpha');
    expect(early).toBeGreaterThan(late);
  });

  it('handles multiple tokens', () => {
    const s = scoreMultiword('proj alp', 'project alpha');
    expect(s).toBeGreaterThan(0);
  });
});

