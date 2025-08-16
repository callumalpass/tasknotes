import { DEFAULT_SETTINGS } from '../../../src/settings/defaults';

describe('Settings defaults', () => {
  test('viewsButtonAlignment defaults to right', () => {
    expect(DEFAULT_SETTINGS.viewsButtonAlignment).toBe('right');
  });
});

