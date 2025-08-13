import { App } from 'obsidian';
import { ViewStateManager } from '../../../src/services/ViewStateManager';
import { TASK_LIST_VIEW_TYPE } from '../../../src/types';

describe('ViewStateManager collapsed groups persistence', () => {
  it('stores and retrieves collapsedGroups per view type', () => {
    const app = new App();
    const plugin: any = { settings: { savedViews: [] } };
    const vsm = new ViewStateManager(app, plugin);

    const key = TASK_LIST_VIEW_TYPE;
    const prefs1 = vsm.getViewPreferences<any>(key) || {};
    const next = { ...prefs1, collapsedGroups: { status: { Done: true } } };
    vsm.setViewPreferences(key, next);
    const prefs2 = vsm.getViewPreferences<any>(key) || {};
    expect(prefs2.collapsedGroups.status.Done).toBe(true);
  });
});

