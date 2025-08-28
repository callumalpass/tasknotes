import { splitListPreservingLinksAndQuotes } from '../../../src/utils/stringSplit';

describe('Settings defaults - projects with commas splitting', () => {
  it('should preserve commas within wikilinks when splitting defaults', () => {
    const input = '[[Money, Org & Adm]], [[Wellbeing|Health, Fitness & Mindset]]';
    const out = splitListPreservingLinksAndQuotes(input);
    expect(out).toEqual([
      '[[Money, Org & Adm]]',
      '[[Wellbeing|Health, Fitness & Mindset]]'
    ]);
  });
});

