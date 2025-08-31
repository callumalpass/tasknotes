import { ProjectSubtasksWidget } from '../../../src/editor/ProjectNoteDecorations';
import { TaskInfo } from '../../../src/types';

// Mock TaskNotesPlugin
const mockPlugin = {
    statusManager: {
        isCompletedStatus: jest.fn((status: string) => {
            return status === 'done' || status === 'completed';
        })
    },
    viewStateManager: {
        getFilterState: jest.fn(() => null),
        setFilterState: jest.fn()
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

describe('ProjectSubtasksWidget', () => {
    let widget: ProjectSubtasksWidget;
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('initialization', () => {
        it('should create widget with tasks and plugin', () => {
            const tasks = [
                createMockTask('Task 1', 'todo'),
                createMockTask('Task 2', 'done')
            ];
            
            widget = new ProjectSubtasksWidget(mockPlugin, tasks, 'test.md', 1);
            
            expect(widget).toBeDefined();
            expect(mockPlugin.viewStateManager.getFilterState).toHaveBeenCalled();
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
            
            // Test that the statusManager.isCompletedStatus works correctly
            const completedCount = tasks.filter(task => 
                mockPlugin.statusManager.isCompletedStatus(task.status)
            ).length;
            
            expect(completedCount).toBe(2); // 'done' and 'completed'
        });
    });
});
