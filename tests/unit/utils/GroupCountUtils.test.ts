import { GroupCountUtils, GroupCountOptions } from '../../../src/utils/GroupCountUtils';
import { TaskInfo } from '../../../src/types';

// Mock TaskNotesPlugin
const mockPlugin = {
    statusManager: {
        isCompletedStatus: jest.fn((status: string) => {
            return status === 'done' || status === 'completed';
        })
    }
} as any;

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

describe('GroupCountUtils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('formatGroupCount', () => {
        it('should format basic completed/total count', () => {
            const result = GroupCountUtils.formatGroupCount(3, 8);
            
            expect(result.text).toBe('3 / 8');
            expect(result.classes).toContain('agenda-view__item-count');
            expect(result.completed).toBe(3);
            expect(result.total).toBe(8);
            expect(result.percentage).toBe(38); // 3/8 = 37.5% rounded to 38%
        });

        it('should handle zero completed tasks', () => {
            const result = GroupCountUtils.formatGroupCount(0, 5);
            
            expect(result.text).toBe('0 / 5');
            expect(result.completed).toBe(0);
            expect(result.total).toBe(5);
            expect(result.percentage).toBe(0);
        });

        it('should handle 100% completion', () => {
            const result = GroupCountUtils.formatGroupCount(4, 4);
            
            expect(result.text).toBe('4 / 4');
            expect(result.completed).toBe(4);
            expect(result.total).toBe(4);
            expect(result.percentage).toBe(100);
        });

        it('should handle zero total tasks', () => {
            const result = GroupCountUtils.formatGroupCount(0, 0);
            
            expect(result.text).toBe('0 / 0');
            expect(result.completed).toBe(0);
            expect(result.total).toBe(0);
            expect(result.percentage).toBe(0);
        });

        it('should include additional CSS classes when provided', () => {
            const options: GroupCountOptions = {
                additionalClasses: ['custom-class', 'another-class']
            };
            
            const result = GroupCountUtils.formatGroupCount(2, 6, options);
            
            expect(result.classes).toEqual(['agenda-view__item-count', 'custom-class', 'another-class']);
        });
    });

    describe('calculateGroupStats', () => {
        it('should correctly calculate completion stats', () => {
            const tasks = [
                createMockTask('Task 1', 'todo'),
                createMockTask('Task 2', 'done'),
                createMockTask('Task 3', 'completed'),
                createMockTask('Task 4', 'in-progress'),
                createMockTask('Task 5', 'done')
            ];
            
            const stats = GroupCountUtils.calculateGroupStats(tasks, mockPlugin);
            
            expect(stats.total).toBe(5);
            expect(stats.completed).toBe(3); // 'done', 'completed', 'done'
            expect(mockPlugin.statusManager.isCompletedStatus).toHaveBeenCalledTimes(5);
        });

        it('should handle empty task list', () => {
            const tasks: TaskInfo[] = [];
            
            const stats = GroupCountUtils.calculateGroupStats(tasks, mockPlugin);
            
            expect(stats.total).toBe(0);
            expect(stats.completed).toBe(0);
        });
    });

    describe('createCountElement', () => {
        let container: HTMLElement;
        
        beforeEach(() => {
            container = document.createElement('div');
        });

        it('should create count element with correct content and classes', () => {
            const countEl = GroupCountUtils.createCountElement(container, 2, 7);
            
            expect(countEl.textContent).toBe('2 / 7');
            expect(countEl.classList.contains('agenda-view__item-count')).toBe(true);
            expect(countEl.getAttribute('data-completed')).toBe('2');
            expect(countEl.getAttribute('data-total')).toBe('7');
            expect(countEl.getAttribute('data-percentage')).toBe('29'); // 2/7 = 28.57% rounded to 29%
            expect(container.contains(countEl)).toBe(true);
        });
    });

    describe('updateCountElement', () => {
        let element: HTMLElement;
        
        beforeEach(() => {
            element = document.createElement('div');
            element.textContent = 'old content';
            element.className = 'old-class';
        });

        it('should update element content and attributes', () => {
            GroupCountUtils.updateCountElement(element, 5, 10);
            
            expect(element.textContent).toBe('5 / 10');
            expect(element.classList.contains('agenda-view__item-count')).toBe(true);
            expect(element.getAttribute('data-completed')).toBe('5');
            expect(element.getAttribute('data-total')).toBe('10');
            expect(element.getAttribute('data-percentage')).toBe('50');
        });
    });

    describe('percentage calculation', () => {
        it('should round percentages correctly', () => {
            // Test various rounding scenarios
            expect(GroupCountUtils.formatGroupCount(1, 3).percentage).toBe(33); // 33.33% -> 33%
            expect(GroupCountUtils.formatGroupCount(2, 3).percentage).toBe(67); // 66.67% -> 67%
            expect(GroupCountUtils.formatGroupCount(1, 6).percentage).toBe(17); // 16.67% -> 17%
            expect(GroupCountUtils.formatGroupCount(5, 6).percentage).toBe(83); // 83.33% -> 83%
        });
    });
});
