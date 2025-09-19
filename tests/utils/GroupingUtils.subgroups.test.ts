import { GroupingUtils } from '../../src/utils/GroupingUtils';

// Minimal mock of plugin view state manager used by GroupingUtils
const createMockPlugin = () => {
  let prefs: any = {
    taskList: { collapsedGroups: {} },
    agenda: { collapsedGroups: {} },
  };
  return {
    viewStateManager: {
      getViewPreferences: jest.fn().mockImplementation((viewType: string) => {
        if (viewType === 'agenda') return prefs.agenda;
        return prefs.taskList;
      }),
      setViewPreferences: jest.fn().mockImplementation((viewType: string, next: any) => {
        if (viewType === 'agenda') prefs.agenda = next; else prefs.taskList = next;
      }),
    },
  } as any;
};

describe('GroupingUtils - subgroup collapsed state helpers', () => {
  const viewType = 'task-list';
  const subgroupKey = 'priority';
  const primary = 'Open';
  const subgroupA = 'high';
  const subgroupB = 'low';

  test('isSubgroupCollapsed defaults to false when no state', () => {
    const plugin = createMockPlugin();
    const collapsed = GroupingUtils.isSubgroupCollapsed(viewType, subgroupKey, primary, subgroupA, plugin);
    expect(collapsed).toBe(false);
  });

  test('setSubgroupCollapsed sets nested state and isSubgroupCollapsed reflects it', () => {
    const plugin = createMockPlugin();

    GroupingUtils.setSubgroupCollapsed(viewType, subgroupKey, primary, subgroupA, true, plugin);

    expect(plugin.viewStateManager.setViewPreferences).toHaveBeenCalled();

    const collapsed = GroupingUtils.isSubgroupCollapsed(viewType, subgroupKey, primary, subgroupA, plugin);
    expect(collapsed).toBe(true);

    // Toggling back to expanded
    GroupingUtils.setSubgroupCollapsed(viewType, subgroupKey, primary, subgroupA, false, plugin);
    const expandedNow = GroupingUtils.isSubgroupCollapsed(viewType, subgroupKey, primary, subgroupA, plugin);
    expect(expandedNow).toBe(false);
  });

  test('expandAllSubgroups and collapseAllSubgroups within a primary group', () => {
    const plugin = createMockPlugin();

    // Collapse two subgroups explicitly
    GroupingUtils.setSubgroupCollapsed(viewType, subgroupKey, primary, subgroupA, true, plugin);
    GroupingUtils.setSubgroupCollapsed(viewType, subgroupKey, primary, subgroupB, true, plugin);

    // Expand all within primary
    GroupingUtils.expandAllSubgroups(viewType, primary, subgroupKey, plugin);
    expect(GroupingUtils.isSubgroupCollapsed(viewType, subgroupKey, primary, subgroupA, plugin)).toBe(false);
    expect(GroupingUtils.isSubgroupCollapsed(viewType, subgroupKey, primary, subgroupB, plugin)).toBe(false);

    // Collapse a given set
    GroupingUtils.collapseAllSubgroups(viewType, primary, subgroupKey, [subgroupA, subgroupB], plugin);
    expect(GroupingUtils.isSubgroupCollapsed(viewType, subgroupKey, primary, subgroupA, plugin)).toBe(true);
    expect(GroupingUtils.isSubgroupCollapsed(viewType, subgroupKey, primary, subgroupB, plugin)).toBe(true);
  });

  test('global expand/collapse subgroup helpers', () => {
    const plugin = createMockPlugin();

    // Collapse various primaries/subgroups via global API
    GroupingUtils.collapseAllSubgroupsGlobally(viewType, subgroupKey, [
      { primaryGroup: primary, subgroupName: subgroupA },
      { primaryGroup: 'Done', subgroupName: 'blocked' },
    ], plugin);

    expect(GroupingUtils.isSubgroupCollapsed(viewType, subgroupKey, primary, subgroupA, plugin)).toBe(true);
    expect(GroupingUtils.isSubgroupCollapsed(viewType, subgroupKey, 'Done', 'blocked', plugin)).toBe(true);

    // Expand all globally for this subgroupKey
    GroupingUtils.expandAllSubgroupsGlobally(viewType, subgroupKey, plugin);
    expect(GroupingUtils.isSubgroupCollapsed(viewType, subgroupKey, primary, subgroupA, plugin)).toBe(false);
    expect(GroupingUtils.isSubgroupCollapsed(viewType, subgroupKey, 'Done', 'blocked', plugin)).toBe(false);
  });
});

