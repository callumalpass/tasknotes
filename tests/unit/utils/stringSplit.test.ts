import { splitListPreservingLinksAndQuotes } from '../../../src/utils/stringSplit';

describe('splitListPreservingLinksAndQuotes', () => {
  test('splits plain CSV at commas', () => {
    expect(splitListPreservingLinksAndQuotes('John, Mary,  Bob'))
      .toEqual(['John', 'Mary', 'Bob']);
  });

  test('does not split inside wikilinks', () => {
    expect(splitListPreservingLinksAndQuotes('[[Health, Fitness & Mindset]]'))
      .toEqual(['[[Health, Fitness & Mindset]]']);
  });

  test('does not split inside alias wikilinks', () => {
    expect(splitListPreservingLinksAndQuotes('[[Wellbeing|Health, Fitness & Mindset]]'))
      .toEqual(['[[Wellbeing|Health, Fitness & Mindset]]']);
  });

  test('handles mixed items', () => {
    expect(splitListPreservingLinksAndQuotes('[[A,B]], [[C|X,Y]], Z'))
      .toEqual(['[[A,B]]', '[[C|X,Y]]', 'Z']);
  });

  test('does not split inside double quotes', () => {
    expect(splitListPreservingLinksAndQuotes('"Focus, Deep Work", Notes'))
      .toEqual(['"Focus, Deep Work"', 'Notes']);
  });

  test('does not split inside single quotes', () => {
    expect(splitListPreservingLinksAndQuotes("'Alpha, Beta', Gamma"))
      .toEqual(["'Alpha, Beta'", 'Gamma']);
  });

  test('trims tokens and ignores empties', () => {
    expect(splitListPreservingLinksAndQuotes(' A , , B '))
      .toEqual(['A', 'B']);
  });
});

