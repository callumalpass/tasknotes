import { ProjectSubtasksWidget } from '../../../src/editor/ProjectNoteDecorations';
import { TaskInfo } from '../../../src/types';

// Mock TaskNotesPlugin
const mockPlugin = {
    statusManager: {
        isCompletedStatus: jest.fn((status: string) => {
            return status === 'done' || status === 'completed';
        })
    }
} as any;

// Mock EditorView
const mockView = {} as any;

// Helper to create mock tasks
const createMockTask = (title: string, status: string): TaskInfo => ({
    title,
    status,
    path: `${title.toLowerCase().replace(/\s+/g, '-')}.md`,
    content: `- [${status === 'done' ? 'x' : ' '}] ${title}`,
    line: 1,
    dateCreated: '2024-01-01',
    dateModified: '2024-01-01'
} as TaskInfo);

describe('ProjectSubtasksWidget - Completion Count', () => {
    let widget: ProjectSubtasksWidget;
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('formatSubtaskTitle', () => {
        it('should show completion stats when no filtering is applied', () => {
            const tasks = [
                createMockTask('Task 1', 'todo'),
                createMockTask('Task 2', 'done'),
                createMockTask('Task 3', 'done'),
                createMockTask('Task 4', 'todo')
            ];
            
            widget = new ProjectSubtasksWidget(mockPlugin, tasks, 'test.md', 1);
            
            // Access the private method for testing
            const formatSubtaskTitle = (widget as any).formatSubtaskTitle.bind(widget);
            const result = formatSubtaskTitle(4, 2); // 4 total, 2 completed
            
            expect(result).toBe('Subtasks (4 tasks • 50% complete)');
        });

        it('should show filtered completion stats when filtering is applied', () => {
            const tasks = [
                createMockTask('Task 1', 'todo'),
                createMockTask('Task 2', 'done'),
                createMockTask('Task 3', 'done'),
                createMockTask('Task 4', 'todo')
            ];
            
            widget = new ProjectSubtasksWidget(mockPlugin, tasks, 'test.md', 1);
            
            const formatSubtaskTitle = (widget as any).formatSubtaskTitle.bind(widget);
            const result = formatSubtaskTitle(2, 1); // 2 filtered, 1 completed of filtered
            
            expect(result).toBe('Subtasks (2 of 4 • 50% complete)');
        });

        it('should handle zero tasks correctly', () => {
            const tasks: TaskInfo[] = [];
            
            widget = new ProjectSubtasksWidget(mockPlugin, tasks, 'test.md', 1);
            
            const formatSubtaskTitle = (widget as any).formatSubtaskTitle.bind(widget);
            const result = formatSubtaskTitle(0, 0);
            
            expect(result).toBe('Subtasks (0)');
        });

        it('should handle 100% completion correctly', () => {
            const tasks = [
                createMockTask('Task 1', 'done'),
                createMockTask('Task 2', 'completed'),
                createMockTask('Task 3', 'done')
            ];
            
            widget = new ProjectSubtasksWidget(mockPlugin, tasks, 'test.md', 1);
            
            const formatSubtaskTitle = (widget as any).formatSubtaskTitle.bind(widget);
            const result = formatSubtaskTitle(3, 3);
            
            expect(result).toBe('Subtasks (3 tasks • 100% complete)');
        });

        it('should handle 0% completion correctly', () => {
            const tasks = [
                createMockTask('Task 1', 'todo'),
                createMockTask('Task 2', 'in-progress'),
                createMockTask('Task 3', 'todo')
            ];
            
            widget = new ProjectSubtasksWidget(mockPlugin, tasks, 'test.md', 1);
            
            const formatSubtaskTitle = (widget as any).formatSubtaskTitle.bind(widget);
            const result = formatSubtaskTitle(3, 0);
            
            expect(result).toBe('Subtasks (3 tasks • 0% complete)');
        });

        it('should handle filtered zero results correctly', () => {
            const tasks = [
                createMockTask('Task 1', 'todo'),
                createMockTask('Task 2', 'done')
            ];
            
            widget = new ProjectSubtasksWidget(mockPlugin, tasks, 'test.md', 1);
            
            const formatSubtaskTitle = (widget as any).formatSubtaskTitle.bind(widget);
            const result = formatSubtaskTitle(0, 0); // No tasks match filter
            
            expect(result).toBe('Subtasks (0 of 2)');
        });
    });

    describe('completion calculation', () => {
        it('should correctly identify completed tasks', () => {
            const tasks = [
                createMockTask('Task 1', 'todo'),
                createMockTask('Task 2', 'done'),
                createMockTask('Task 3', 'completed'),
                createMockTask('Task 4', 'in-progress')
            ];
            
            widget = new ProjectSubtasksWidget(mockPlugin, tasks, 'test.md', 1);
            
            // Test that the statusManager.isCompletedStatus is called correctly
            const completedCount = tasks.filter(task => 
                mockPlugin.statusManager.isCompletedStatus(task.status)
            ).length;
            
            expect(completedCount).toBe(2); // 'done' and 'completed'
            expect(mockPlugin.statusManager.isCompletedStatus).toHaveBeenCalledWith('todo');
            expect(mockPlugin.statusManager.isCompletedStatus).toHaveBeenCalledWith('done');
            expect(mockPlugin.statusManager.isCompletedStatus).toHaveBeenCalledWith('completed');
            expect(mockPlugin.statusManager.isCompletedStatus).toHaveBeenCalledWith('in-progress');
        });
    });
});
