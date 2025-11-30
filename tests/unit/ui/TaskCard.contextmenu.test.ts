import { createTaskCard } from '../../../src/ui/TaskCard';
import { TaskNotesPlugin } from '../../../src/main';
import { TaskInfo } from '../../../src/types/TaskInfo';
import { PluginFactory, TaskFactory } from '../../helpers/mock-factories';

describe('TaskCard Context Menu Event Handling', () => {
    let mockPlugin: TaskNotesPlugin;
    let parentTask: TaskInfo;
    let subtask: TaskInfo;
    let container: HTMLElement;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup DOM
        document.body.innerHTML = '';
        container = document.createElement('div');
        document.body.appendChild(container);

        // Setup test tasks using factory first
        parentTask = TaskFactory.createTask({
            path: 'parent-task.md',
            title: 'Parent Task',
            status: 'todo',
            projects: []
        });

        subtask = TaskFactory.createTask({
            path: 'subtask.md',
            title: 'Subtask',
            status: 'todo',
            projects: ['[[parent-task]]']
        });

        // Create mock plugin using factory
        mockPlugin = PluginFactory.createMockPlugin({
            priorityManager: {
                getPriorityConfig: jest.fn().mockReturnValue({ color: '#666666' })
            },
            statusManager: {
                isCompletedStatus: jest.fn().mockReturnValue(false),
                getStatusConfig: jest.fn().mockReturnValue({ color: '#666666' }),
                getStatusIcon: jest.fn().mockReturnValue('circle'),
                getStatusColor: jest.fn().mockReturnValue('#666666'),
                getNextStatus: jest.fn().mockReturnValue('done')
            },
            expandedProjectsService: {
                isExpanded: jest.fn().mockReturnValue(false)
            },
            projectSubtasksService: {
                getSubtasks: jest.fn().mockResolvedValue([]),
                sortTasks: jest.fn().mockReturnValue([]),
                isTaskUsedAsProject: jest.fn().mockResolvedValue(false),
                isTaskUsedAsProjectSync: jest.fn().mockReturnValue(false)
            },
            domReconciler: {
                updateList: jest.fn()
            },
            cacheManager: {
                ...PluginFactory.createMockPlugin().cacheManager,
                getTaskInfo: jest.fn().mockImplementation((path: string) => {
                    if (path === 'parent-task.md') return Promise.resolve(parentTask);
                    if (path === 'subtask.md') return Promise.resolve(subtask);
                    return Promise.resolve(null);
                })
            }
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    describe('Event Propagation Prevention', () => {
        it('should prevent context menu event bubbling from subtask to parent', async () => {
            // Create parent task card
            const parentCard = createTaskCard(parentTask, mockPlugin, undefined, {
                showDueDate: true,
                showCheckbox: true,
                showArchiveButton: true,
                showTimeTracking: true,
                showRecurringControls: true,
                groupByDate: false
            });
            container.appendChild(parentCard);

            // Create subtask card and append to parent
            const subtaskCard = createTaskCard(subtask, mockPlugin, undefined, {
                showDueDate: true,
                showCheckbox: false,
                showArchiveButton: false,
                showTimeTracking: false,
                showRecurringControls: true,
                groupByDate: false
            });
            subtaskCard.classList.add('task-card--subtask');
            parentCard.appendChild(subtaskCard);

            // Verify dataset.taskPath is set correctly
            expect(parentCard.dataset.taskPath).toBe('parent-task.md');
            expect(subtaskCard.dataset.taskPath).toBe('subtask.md');

            // Track which handlers are called
            let parentHandlerCalled = false;
            let subtaskHandlerCalled = false;
            let subtaskHandlerPath = '';
            let parentHandlerPath = '';

            // Add event listeners to track which handlers are called
            parentCard.addEventListener('contextmenu', (e) => {
                parentHandlerCalled = true;
                parentHandlerPath = (e.currentTarget as HTMLElement).dataset.taskPath || '';
            });

            subtaskCard.addEventListener('contextmenu', (e) => {
                subtaskHandlerCalled = true;
                subtaskHandlerPath = (e.currentTarget as HTMLElement).dataset.taskPath || '';
            });

            // Create and dispatch contextmenu event on subtask
            const contextMenuEvent = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true
            });

            // Spy on event methods
            const preventDefaultSpy = jest.spyOn(contextMenuEvent, 'preventDefault');
            const stopPropagationSpy = jest.spyOn(contextMenuEvent, 'stopPropagation');

            // Dispatch event on subtask
            subtaskCard.dispatchEvent(contextMenuEvent);

            // Wait for async handlers
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify event handling
            expect(preventDefaultSpy).toHaveBeenCalled();
            expect(stopPropagationSpy).toHaveBeenCalled();

            // Verify that only the subtask handler was called due to stopPropagation
            expect(subtaskHandlerCalled).toBe(true);
            expect(subtaskHandlerPath).toBe('subtask.md');

            // The parent handler should NOT be called due to stopPropagation
            expect(parentHandlerCalled).toBe(false);
        });

        it('should handle context menu on parent task correctly', async () => {
            // Create parent task card
            const parentCard = createTaskCard(parentTask, mockPlugin, undefined, {
                showDueDate: true,
                showCheckbox: true,
                showArchiveButton: true,
                showTimeTracking: true,
                showRecurringControls: true,
                groupByDate: false
            });
            container.appendChild(parentCard);

            // Verify dataset.taskPath is set correctly
            expect(parentCard.dataset.taskPath).toBe('parent-task.md');

            // Track which handler is called
            let parentHandlerCalled = false;
            let parentHandlerPath = '';

            // Add event listener to track which handler is called
            parentCard.addEventListener('contextmenu', (e) => {
                parentHandlerCalled = true;
                parentHandlerPath = (e.currentTarget as HTMLElement).dataset.taskPath || '';
            });

            // Create and dispatch contextmenu event on parent
            const contextMenuEvent = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true
            });

            // Dispatch event on parent
            parentCard.dispatchEvent(contextMenuEvent);

            // Wait for async handlers
            await new Promise(resolve => setTimeout(resolve, 100));

            // Verify that the parent handler was called with correct path
            expect(parentHandlerCalled).toBe(true);
            expect(parentHandlerPath).toBe('parent-task.md');
        });
    });

    describe('Dataset Path Verification', () => {
        it('should set correct dataset.taskPath for both parent and subtask cards', () => {
            // Create parent task card
            const parentCard = createTaskCard(parentTask, mockPlugin, undefined, {
                showDueDate: true,
                showCheckbox: true,
                showArchiveButton: true,
                showTimeTracking: true,
                showRecurringControls: true,
                groupByDate: false
            });

            // Create subtask card
            const subtaskCard = createTaskCard(subtask, mockPlugin, undefined, {
                showDueDate: true,
                showCheckbox: false,
                showArchiveButton: false,
                showTimeTracking: false,
                showRecurringControls: true,
                groupByDate: false
            });

            // Verify dataset.taskPath is set correctly for both cards
            expect(parentCard.dataset.taskPath).toBe('parent-task.md');
            expect(subtaskCard.dataset.taskPath).toBe('subtask.md');

            // Verify they are different
            expect(parentCard.dataset.taskPath).not.toBe(subtaskCard.dataset.taskPath);
        });

        it('should prevent event bubbling with stopPropagation', () => {
            const taskCard = createTaskCard(subtask, mockPlugin, undefined, {
                showDueDate: true,
                showCheckbox: false,
                showArchiveButton: false,
                showTimeTracking: false,
                showRecurringControls: true,
                groupByDate: false
            });
            container.appendChild(taskCard);

            // Create a contextmenu event
            const contextMenuEvent = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true
            });

            // Spy on event methods
            const preventDefaultSpy = jest.spyOn(contextMenuEvent, 'preventDefault');
            const stopPropagationSpy = jest.spyOn(contextMenuEvent, 'stopPropagation');

            // Dispatch event
            taskCard.dispatchEvent(contextMenuEvent);

            // Verify both preventDefault and stopPropagation are called
            expect(preventDefaultSpy).toHaveBeenCalled();
            expect(stopPropagationSpy).toHaveBeenCalled();
        });
    });
});
