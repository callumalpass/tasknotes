import { DEFAULT_SETTINGS } from '../../../src/settings/defaults';

describe('Settings defaults', () => {
  test('viewsButtonAlignment defaults to right', () => {
    expect(DEFAULT_SETTINGS.viewsButtonAlignment).toBe('right');
  });

  test('task-list project and tag drops replace unless Shift is held', () => {
    expect(DEFAULT_SETTINGS.taskListGroupDropBehavior).toBe('replace-shift-add');
  });
});

