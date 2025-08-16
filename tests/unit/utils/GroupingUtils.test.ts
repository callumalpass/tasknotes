import { GroupingUtils } from '../../../src/utils/GroupingUtils';
import { TASK_LIST_VIEW_TYPE, SUBTASK_WIDGET_VIEW_TYPE } from '../../../src/types';

// Mock TaskNotesPlugin
const mockPlugin = {
    priorityManager: {
        getPriorityConfig: jest.fn((priority: string) => {
            if (priority === 'high') return { label: 'High' };
            if (priority === 'medium') return { label: 'Medium' };
            return null;
        })
    },
    statusManager: {
        getStatusConfig: jest.fn((status: string) => {
            if (status === 'todo') return { label: 'To Do' };
            if (status === 'done') return { label: 'Done' };
            return null;
        })
    },
    viewStateManager: {
        getViewPreferences: jest.fn(() => ({})),
        setViewPreferences: jest.fn()
    }
} as any;

describe('GroupingUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('formatGroupName', () => {
        it('should format priority group names', () => {
            const result = GroupingUtils.formatGroupName('high', mockPlugin);
            expect(result).toBe('High priority');
        });

        it('should format status group names', () => {
            const result = GroupingUtils.formatGroupName('todo', mockPlugin);
            expect(result).toBe('To Do');
        });

        it('should handle special group names', () => {
            expect(GroupingUtils.formatGroupName('all', mockPlugin)).toBe('All tasks');
            expect(GroupingUtils.formatGroupName('no-status', mockPlugin)).toBe('No status assigned');
            expect(GroupingUtils.formatGroupName('No Status', mockPlugin)).toBe('No Status');
        });

        it('should return original name for unknown groups', () => {
            const result = GroupingUtils.formatGroupName('custom-group', mockPlugin);
            expect(result).toBe('custom-group');
        });
    });

    describe('getGroupDisplayName', () => {
        it('should include task count in display name', () => {
            const result = GroupingUtils.getGroupDisplayName('high', 5, mockPlugin);
            expect(result).toBe('High priority (5)');
        });
    });

    describe('group collapse state management', () => {
        it('should check if group is collapsed', () => {
            mockPlugin.viewStateManager.getViewPreferences.mockReturnValue({
                collapsedGroups: {
                    'status': {
                        'todo': true
                    }
                }
            });

            const result = GroupingUtils.isGroupCollapsed(TASK_LIST_VIEW_TYPE, 'status', 'todo', mockPlugin);
            expect(result).toBe(true);
        });

        it('should return false for non-collapsed groups', () => {
            mockPlugin.viewStateManager.getViewPreferences.mockReturnValue({});

            const result = GroupingUtils.isGroupCollapsed(TASK_LIST_VIEW_TYPE, 'status', 'todo', mockPlugin);
            expect(result).toBe(false);
        });

        it('should set group collapsed state', () => {
            mockPlugin.viewStateManager.getViewPreferences.mockReturnValue({});

            GroupingUtils.setGroupCollapsed(SUBTASK_WIDGET_VIEW_TYPE, 'status', 'todo', true, mockPlugin);

            expect(mockPlugin.viewStateManager.setViewPreferences).toHaveBeenCalledWith(
                SUBTASK_WIDGET_VIEW_TYPE,
                {
                    collapsedGroups: {
                        'status': {
                            'todo': true
                        }
                    }
                }
            );
        });

        it('should expand all groups', () => {
            mockPlugin.viewStateManager.getViewPreferences.mockReturnValue({
                collapsedGroups: {
                    'status': {
                        'todo': true,
                        'done': true
                    }
                }
            });

            GroupingUtils.expandAllGroups(TASK_LIST_VIEW_TYPE, 'status', mockPlugin);

            expect(mockPlugin.viewStateManager.setViewPreferences).toHaveBeenCalledWith(
                TASK_LIST_VIEW_TYPE,
                {
                    collapsedGroups: {
                        'status': {}
                    }
                }
            );
        });

        it('should collapse all groups', () => {
            mockPlugin.viewStateManager.getViewPreferences.mockReturnValue({});

            GroupingUtils.collapseAllGroups(TASK_LIST_VIEW_TYPE, 'status', ['todo', 'done'], mockPlugin);

            expect(mockPlugin.viewStateManager.setViewPreferences).toHaveBeenCalledWith(
                TASK_LIST_VIEW_TYPE,
                {
                    collapsedGroups: {
                        'status': {
                            'todo': true,
                            'done': true
                        }
                    }
                }
            );
        });
    });
});
