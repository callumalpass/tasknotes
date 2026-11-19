import { DEFAULT_SETTINGS } from '../../../src/settings/defaults';

describe('Settings defaults', () => {
  test('occurrence filename templates are opt-in', () => {
    expect(DEFAULT_SETTINGS.occurrenceFilenameTemplate).toBe('');
  });
});
