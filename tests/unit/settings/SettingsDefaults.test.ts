import { DEFAULT_SETTINGS } from '../../../src/settings/defaults';

describe('Settings defaults', () => {
  test('viewsButtonAlignment defaults to right', () => {
    expect(DEFAULT_SETTINGS.viewsButtonAlignment).toBe('right');
  });

  test('occurrence filename templates are opt-in', () => {
    expect(DEFAULT_SETTINGS.occurrenceFilenameTemplate).toBe('');
  });
});
