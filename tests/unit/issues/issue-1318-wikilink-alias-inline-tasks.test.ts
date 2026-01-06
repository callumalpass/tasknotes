/**
 * Test for issue #1318: Ability to use aliases for inline tasks
 *
 * Feature Request:
 * Users want to be able to change the appearance of inline tasks using
 * Obsidian's alias syntax: [[Meeting with someone|someone]] should display
 * as "someone" instead of "Meeting with someone".
 *
 * The parsing infrastructure already extracts aliases correctly - the issue
 * is that TaskLinkWidget receives displayText but doesn't pass it to createTaskCard.
 *
 * Expected Behavior:
 * - [[TaskName|Alias]] should display "Alias" in the inline widget
 * - Without alias, should continue to show task title as before
 */

import { EditorState, EditorSelection } from '@codemirror/state';
import { buildTaskLinkDecorations } from '../../../src/editor/TaskLinkOverlay';
import { TaskLinkWidget } from '../../../src/editor/TaskLinkWidget';
import { createTaskCard } from '../../../src/ui/TaskCard';
import { PluginFactory, TaskFactory } from '../../helpers/mock-factories';
import { TaskNotesPlugin } from '../../../src/main';
import { TaskInfo } from '../../../src/types/TaskInfo';

// Mock the TaskLinkWidget
jest.mock('../../../src/editor/TaskLinkWidget');
const MockTaskLinkWidget = TaskLinkWidget as jest.MockedClass<typeof TaskLinkWidget>;

describe.skip('Issue #1318: Wikilink alias support for inline tasks', () => {
    let mockPlugin: TaskNotesPlugin;
    let mockTask: TaskInfo;
    let activeWidgets: Map<string, TaskLinkWidget>;
    let lastDisplayTextUsed: string | undefined;

    beforeEach(() => {
        jest.clearAllMocks();
        lastDisplayTextUsed = undefined;

        // Create mock task with a long title
        mockTask = TaskFactory.createTask({
            path: 'TaskNotes/Meeting with the marketing team.md',
            title: 'Meeting with the marketing team',
            status: 'todo'
        });

        // Create mock plugin
        mockPlugin = PluginFactory.createMockPlugin({
            settings: {
                enableTaskLinkOverlay: true
            },
            cacheManager: {
                ...PluginFactory.createMockPlugin().cacheManager,
                getCachedTaskInfoSync: jest.fn().mockImplementation((path: string) => {
                    if (path === 'TaskNotes/Meeting with the marketing team.md') return mockTask;
                    return null;
                })
            },
            app: {
                workspace: {
                    getActiveViewOfType: jest.fn().mockReturnValue({
                        file: {
                            path: 'notes/daily/2025-01-01.md'
                        }
                    })
                },
                metadataCache: {
                    getFirstLinkpathDest: jest.fn().mockImplementation((linkPath: string) => {
                        if (linkPath === 'Meeting with the marketing team') {
                            return { path: 'TaskNotes/Meeting with the marketing team.md' };
                        }
                        return null;
                    })
                }
            },
            detectionService: {
                findWikilinks: jest.fn().mockImplementation((text: string) => {
                    const wikilinkRegex = /\[\[([^\]]+)\]\]/g;
                    const links = [];
                    let match;

                    while ((match = wikilinkRegex.exec(text)) !== null) {
                        links.push({
                            match: match[0],
                            start: match.index,
                            end: match.index + match[0].length,
                            type: 'wikilink'
                        });
                    }

                    return links;
                })
            }
        });

        // Create active widgets map
        activeWidgets = new Map();

        // Setup TaskLinkWidget mock that captures displayText
        MockTaskLinkWidget.mockImplementation((taskInfo, plugin, originalText, displayText) => {
            lastDisplayTextUsed = displayText;
            return {
                toDOM: jest.fn().mockReturnValue(createMockOverlayElement(displayText || taskInfo.title)),
                eq: jest.fn().mockReturnValue(false),
                taskInfo: taskInfo,
                plugin: plugin,
                displayText: displayText
            } as any;
        });
    });

    function createMockOverlayElement(displayText: string): HTMLElement {
        const element = document.createElement('span');
        element.className = 'task-inline-preview';
        element.dataset.taskPath = mockTask.path;
        element.textContent = displayText;
        return element;
    }

    describe('Wikilink with alias syntax - parsing layer', () => {
        it('should pass alias as displayText when using pipe syntax [[Task|Alias]]', () => {
            // Using alias syntax: [[Meeting with the marketing team|Marketing mtg]]
            const docText = 'Attend [[Meeting with the marketing team|Marketing mtg]] at 2pm.';
            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            const decorations = buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            // Widget should be created
            expect(decorations.size).toBeGreaterThan(0);
            expect(MockTaskLinkWidget).toHaveBeenCalled();

            // The displayText should be the alias "Marketing mtg", not the task title
            expect(lastDisplayTextUsed).toBe('Marketing mtg');
        });

        it('should display alias text in the rendered widget', () => {
            const docText = 'Check [[Meeting with the marketing team|mtg]] status.';
            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            // The TaskLinkWidget constructor should receive 'mtg' as displayText
            expect(MockTaskLinkWidget).toHaveBeenCalledWith(
                expect.objectContaining({ title: 'Meeting with the marketing team' }),
                expect.anything(),
                expect.stringContaining('[[Meeting with the marketing team|mtg]]'),
                'mtg' // displayText should be the alias
            );
        });

        it('should work with single-word aliases', () => {
            const docText = 'Join [[Meeting with the marketing team|meeting]] now.';
            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            expect(lastDisplayTextUsed).toBe('meeting');
        });

        it('should work with multi-word aliases containing spaces', () => {
            const docText = 'Reminder: [[Meeting with the marketing team|quick sync meeting]] scheduled.';
            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            expect(lastDisplayTextUsed).toBe('quick sync meeting');
        });
    });

    describe('Wikilink without alias (backwards compatibility)', () => {
        it('should not pass displayText when no alias is provided', () => {
            // Standard wikilink without alias
            const docText = 'Attend [[Meeting with the marketing team]] at 2pm.';
            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            const decorations = buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            // Widget should be created
            expect(decorations.size).toBeGreaterThan(0);
            expect(MockTaskLinkWidget).toHaveBeenCalled();

            // Without alias, displayText should be undefined (use task title)
            expect(lastDisplayTextUsed).toBeUndefined();
        });

        it('should use task title when no alias is specified', () => {
            const docText = 'Check [[Meeting with the marketing team]] status.';
            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            // The constructor's 4th param (displayText) should be undefined
            expect(MockTaskLinkWidget).toHaveBeenCalledWith(
                expect.objectContaining({ title: 'Meeting with the marketing team' }),
                expect.anything(),
                expect.stringContaining('[[Meeting with the marketing team]]'),
                undefined // No displayText - will use task.title
            );
        });
    });

    describe('Edge cases', () => {
        it('should handle empty alias (pipe at end) gracefully', () => {
            // Edge case: [[Task|]] should probably use task title
            const docText = 'Task: [[Meeting with the marketing team|]]';
            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            // Empty alias should fallback to undefined (use task title)
            expect(lastDisplayTextUsed).toBeFalsy();
        });

        it('should handle alias with special characters', () => {
            const docText = 'Link: [[Meeting with the marketing team|@mtg (important!)]]';
            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            expect(lastDisplayTextUsed).toBe('@mtg (important!)');
        });

        it('should handle multiple pipes (only first one counts)', () => {
            // [[Task|Alias|Extra]] - "Alias|Extra" should be the full displayText
            const docText = 'Link: [[Meeting with the marketing team|part1|part2]]';
            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            // Everything after first pipe is the alias
            expect(lastDisplayTextUsed).toBe('part1|part2');
        });
    });

    describe('Multiple links in same document', () => {
        it('should handle mix of aliased and non-aliased links', () => {
            // Add another task
            const anotherTask = TaskFactory.createTask({
                path: 'TaskNotes/Review project proposal.md',
                title: 'Review project proposal',
                status: 'todo'
            });

            mockPlugin.cacheManager.getCachedTaskInfoSync = jest.fn().mockImplementation((path: string) => {
                if (path === 'TaskNotes/Meeting with the marketing team.md') return mockTask;
                if (path === 'TaskNotes/Review project proposal.md') return anotherTask;
                return null;
            });

            mockPlugin.app.metadataCache.getFirstLinkpathDest = jest.fn().mockImplementation((linkPath: string) => {
                if (linkPath === 'Meeting with the marketing team') {
                    return { path: 'TaskNotes/Meeting with the marketing team.md' };
                }
                if (linkPath === 'Review project proposal') {
                    return { path: 'TaskNotes/Review project proposal.md' };
                }
                return null;
            });

            const displayTexts: (string | undefined)[] = [];
            MockTaskLinkWidget.mockImplementation((taskInfo, plugin, originalText, displayText) => {
                displayTexts.push(displayText);
                return {
                    toDOM: jest.fn().mockReturnValue(createMockOverlayElement(displayText || taskInfo.title)),
                    eq: jest.fn().mockReturnValue(false),
                    taskInfo: taskInfo,
                    plugin: plugin
                } as any;
            });

            const docText = 'First [[Meeting with the marketing team|mtg]] then [[Review project proposal]].';
            const state = EditorState.create({
                doc: docText,
                selection: EditorSelection.single(0)
            });

            buildTaskLinkDecorations(state, mockPlugin, activeWidgets);

            expect(MockTaskLinkWidget).toHaveBeenCalledTimes(2);

            // First link has alias, second doesn't
            expect(displayTexts[0]).toBe('mtg');
            expect(displayTexts[1]).toBeUndefined();
        });
    });
});

/**
 * Tests for the RENDERING layer - verifying that createTaskCard actually uses
 * the displayText option when provided.
 *
 * THESE TESTS ARE CURRENTLY FAILING because createTaskCard doesn't have
 * a displayText option yet. The fix requires:
 * 1. Add displayText to TaskCardOptions interface
 * 2. Use it to override task.title in the rendered output
 */

// Mock external dependencies for createTaskCard tests
jest.mock('obsidian');
jest.mock('../../../src/utils/helpers', () => ({
    calculateTotalTimeSpent: jest.fn(() => 0),
    getEffectiveTaskStatus: jest.fn((task) => task.status || 'open'),
    shouldUseRecurringTaskUI: jest.fn((task) => !!task.recurrence),
    getRecurringTaskCompletionText: jest.fn(() => 'Not completed'),
    getRecurrenceDisplayText: jest.fn(() => 'Daily'),
    filterEmptyProjects: jest.fn((projects) => projects?.filter((p: string) => p && p.trim()) || [])
}));

jest.mock('../../../src/utils/dateUtils', () => ({
    isTodayTimeAware: jest.fn(() => false),
    isOverdueTimeAware: jest.fn(() => false),
    formatDateTimeForDisplay: jest.fn(() => 'Jan 15, 2025'),
    getDatePart: jest.fn((date) => date?.split('T')[0] || ''),
    getTimePart: jest.fn(() => null),
    formatDateForStorage: jest.fn((value: Date | string) => {
        if (value instanceof Date) return value.toISOString().split('T')[0];
        return value?.split('T')[0] || '';
    })
}));

jest.mock('../../../src/components/TaskContextMenu', () => ({
    TaskContextMenu: jest.fn().mockImplementation(() => ({
        show: jest.fn()
    }))
}));

describe.skip('Issue #1318: createTaskCard displayText support', () => {
    let mockPlugin: any;
    let mockTask: TaskInfo;

    beforeEach(() => {
        mockTask = TaskFactory.createTask({
            path: 'TaskNotes/Meeting with the marketing team.md',
            title: 'Meeting with the marketing team',
            status: 'todo'
        });

        // Create a complete mock plugin with all required properties
        mockPlugin = {
            app: {
                vault: {
                    getAbstractFileByPath: jest.fn()
                },
                workspace: {
                    getLeaf: jest.fn().mockReturnValue({
                        openFile: jest.fn()
                    })
                },
                metadataCache: {
                    getFirstLinkpathDest: jest.fn()
                }
            },
            selectedDate: new Date('2025-01-15'),
            fieldMapper: {
                isPropertyForField: jest.fn(() => false),
                toUserField: jest.fn((field: string) => field),
                toInternalField: jest.fn((field: string) => field),
                getMapping: jest.fn(() => ({
                    status: 'status',
                    priority: 'priority',
                    due: 'due',
                    scheduled: 'scheduled',
                    title: 'title',
                    tags: 'tags',
                    contexts: 'contexts',
                    projects: 'projects',
                })),
            },
            statusManager: {
                isCompletedStatus: jest.fn((status: string) => status === 'done'),
                getStatusConfig: jest.fn((status: string) => ({
                    value: status,
                    label: status,
                    color: '#666666'
                })),
                getAllStatuses: jest.fn(() => [
                    { value: 'open', label: 'Open' },
                    { value: 'done', label: 'Done' }
                ]),
                getNonCompletionStatuses: jest.fn(() => [
                    { value: 'open', label: 'Open' }
                ]),
                getNextStatus: jest.fn(() => 'done')
            },
            priorityManager: {
                getPriorityConfig: jest.fn((priority: string) => ({
                    value: priority,
                    label: priority,
                    color: '#ff0000'
                })),
                getPrioritiesByWeight: jest.fn(() => [
                    { value: 'high', label: 'High' },
                    { value: 'normal', label: 'Normal' }
                ])
            },
            getActiveTimeSession: jest.fn(() => null),
            toggleTaskStatus: jest.fn(),
            toggleRecurringTaskComplete: jest.fn(),
            updateTaskProperty: jest.fn(),
            openTaskEditModal: jest.fn(),
            openDueDateModal: jest.fn(),
            openScheduledDateModal: jest.fn(),
            startTimeTracking: jest.fn(),
            stopTimeTracking: jest.fn(),
            toggleTaskArchive: jest.fn(),
            formatTime: jest.fn((minutes: number) => `${minutes}m`),
            cacheManager: {
                getTaskInfo: jest.fn()
            },
            taskService: {
                deleteTask: jest.fn()
            },
            projectSubtasksService: {
                isTaskUsedAsProject: jest.fn().mockResolvedValue(false),
                isTaskUsedAsProjectSync: jest.fn().mockReturnValue(false)
            },
            settings: {
                enableTaskLinkOverlay: true,
                singleClickAction: 'edit',
                doubleClickAction: 'none',
                showExpandableSubtasks: true,
                subtaskChevronPosition: 'right',
                calendarViewSettings: {
                    timeFormat: '12'
                }
            }
        };
    });

    describe('displayText option in createTaskCard', () => {
        it('should display alias text instead of task title when displayText is provided', () => {
            // FAILING: createTaskCard doesn't support displayText option yet
            const card = createTaskCard(
                mockTask,
                mockPlugin,
                ['status'],
                {
                    layout: 'inline',
                    displayText: 'Marketing mtg' // This option doesn't exist yet
                } as any
            );

            // The rendered card should show "Marketing mtg" not "Meeting with the marketing team"
            const titleElement = card.querySelector('.task-card__title, .task-inline-preview__title');
            expect(titleElement?.textContent).toBe('Marketing mtg');
        });

        it('should use task.title when displayText is not provided', () => {
            const card = createTaskCard(
                mockTask,
                mockPlugin,
                ['status'],
                { layout: 'inline' }
            );

            // Without displayText, should use task.title
            const titleElement = card.querySelector('.task-card__title, .task-inline-preview__title');
            expect(titleElement?.textContent).toBe('Meeting with the marketing team');
        });

        it('should use task.title when displayText is empty string', () => {
            const card = createTaskCard(
                mockTask,
                mockPlugin,
                ['status'],
                {
                    layout: 'inline',
                    displayText: '' // Empty string should fallback to task.title
                } as any
            );

            const titleElement = card.querySelector('.task-card__title, .task-inline-preview__title');
            expect(titleElement?.textContent).toBe('Meeting with the marketing team');
        });
    });
});
