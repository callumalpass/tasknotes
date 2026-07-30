import { DEFAULT_SETTINGS } from '../../../src/settings/defaults';

describe('Settings defaults', () => {
  test('viewsButtonAlignment defaults to right', () => {
    expect(DEFAULT_SETTINGS.viewsButtonAlignment).toBe('right');
  });

  test('task-list list-property drops move unless the copy modifier is held', () => {
    expect(DEFAULT_SETTINGS.taskListGroupDropBehavior).toBe('replace-modifier-add');
  });
});

