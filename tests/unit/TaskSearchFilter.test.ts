import { TaskSearchFilter } from '../../src/bases/TaskSearchFilter';
import { TaskInfo } from '../../src/types';

describe('TaskSearchFilter', () => {
	let filter: TaskSearchFilter;
	let mockTasks: TaskInfo[];

	beforeEach(() => {
		filter = new TaskSearchFilter();
		
		// Create mock tasks for testing
		mockTasks = [
			{
				title: 'Implement search feature',
				status: 'in-progress',
				priority: 'high',
				path: 'tasks/task1.md',
				archived: false,
				tags: ['feature', 'ui'],
				contexts: ['@work'],
				projects: ['TaskNotes'],
			},
			{
				title: 'Fix bug in parser',
				status: 'open',
				priority: 'normal',
				path: 'tasks/task2.md',
				archived: false,
				tags: ['bug'],
				contexts: ['@home'],
				projects: ['Parser'],
			},
			{
				title: 'Write documentation',
				status: 'done',
				priority: 'low',
				path: 'tasks/task3.md',
				archived: false,
				tags: ['docs'],
				contexts: [],
				projects: [],
			},
			{
				title: 'Review pull request',
				status: 'open',
				priority: 'high',
				path: 'tasks/task4.md',
				archived: false,
				customProperties: {
					assignee: 'John Doe',
					department: 'Engineering',
				},
			},
		] as TaskInfo[];
	});

	describe('filterTasks', () => {
		it('should return all tasks when search term is empty', () => {
			const result = filter.filterTasks(mockTasks, '');
			expect(result).toEqual(mockTasks);
			expect(result.length).toBe(4);
		});

		it('should return all tasks when search term is only whitespace', () => {
			const result = filter.filterTasks(mockTasks, '   ');
			expect(result).toEqual(mockTasks);
			expect(result.length).toBe(4);
		});

		it('should filter tasks by title (case-insensitive)', () => {
			const result = filter.filterTasks(mockTasks, 'search');
			expect(result.length).toBe(1);
			expect(result[0].title).toBe('Implement search feature');
		});

		it('should filter tasks by title with different case', () => {
			const result = filter.filterTasks(mockTasks, 'SEARCH');
			expect(result.length).toBe(1);
			expect(result[0].title).toBe('Implement search feature');
		});

		it('should filter tasks by status', () => {
			const result = filter.filterTasks(mockTasks, 'in-progress');
			expect(result.length).toBe(1);
			expect(result[0].status).toBe('in-progress');
		});

		it('should filter tasks by priority', () => {
			const result = filter.filterTasks(mockTasks, 'high');
			expect(result.length).toBe(2);
			expect(result.every(t => t.priority === 'high')).toBe(true);
		});

		it('should filter tasks by tags', () => {
			const result = filter.filterTasks(mockTasks, 'bug');
			expect(result.length).toBe(1);
			expect(result[0].tags).toContain('bug');
		});

		it('should filter tasks by contexts', () => {
			const result = filter.filterTasks(mockTasks, '@work');
			expect(result.length).toBe(1);
			expect(result[0].contexts).toContain('@work');
		});

		it('should filter tasks by projects', () => {
			const result = filter.filterTasks(mockTasks, 'Parser');
			expect(result.length).toBe(1);
			expect(result[0].projects).toContain('Parser');
		});

		it('should filter tasks by custom properties when visible', () => {
			const filterWithProps = new TaskSearchFilter(['assignee', 'department']);
			const result = filterWithProps.filterTasks(mockTasks, 'John Doe');
			expect(result.length).toBe(1);
			expect(result[0].customProperties?.assignee).toBe('John Doe');
		});

		it('should filter tasks by custom properties (department)', () => {
			const filterWithProps = new TaskSearchFilter(['assignee', 'department']);
			const result = filterWithProps.filterTasks(mockTasks, 'Engineering');
			expect(result.length).toBe(1);
			expect(result[0].customProperties?.department).toBe('Engineering');
		});

		it('should not search custom properties when not in visible properties', () => {
			const filterWithoutProps = new TaskSearchFilter([]);
			const result = filterWithoutProps.filterTasks(mockTasks, 'John Doe');
			expect(result.length).toBe(0);
		});

		it('should return empty array when no matches', () => {
			const result = filter.filterTasks(mockTasks, 'nonexistent');
			expect(result).toEqual([]);
			expect(result.length).toBe(0);
		});

		it('should handle tasks with missing optional fields', () => {
			const tasksWithMissing: TaskInfo[] = [
				{
					title: 'Minimal task',
					status: 'open',
					priority: 'normal',
					path: 'tasks/minimal.md',
					archived: false,
					// No tags, contexts, projects
				},
			] as TaskInfo[];

			const result = filter.filterTasks(tasksWithMissing, 'minimal');
			expect(result.length).toBe(1);
			expect(result[0].title).toBe('Minimal task');
		});

		it('should match partial words', () => {
			const result = filter.filterTasks(mockTasks, 'doc');
			expect(result.length).toBe(1);
			expect(result[0].title).toBe('Write documentation');
		});

		it('should trim whitespace from search term', () => {
			const result = filter.filterTasks(mockTasks, '  search  ');
			expect(result.length).toBe(1);
			expect(result[0].title).toBe('Implement search feature');
		});

		it('should match across multiple fields', () => {
			// "feature" appears in both title and tags
			const result = filter.filterTasks(mockTasks, 'feature');
			expect(result.length).toBe(1);
			expect(result[0].title).toContain('feature');
			expect(result[0].tags).toContain('feature');
		});

		it('should handle undefined tags gracefully', () => {
			const tasksWithUndefined: TaskInfo[] = [
				{
					title: 'Task without tags',
					status: 'open',
					priority: 'normal',
					path: 'tasks/notags.md',
					archived: false,
					tags: undefined,
				},
			] as TaskInfo[];

			const result = filter.filterTasks(tasksWithUndefined, 'Task');
			expect(result.length).toBe(1);
		});

		it('should handle undefined contexts gracefully', () => {
			const tasksWithUndefined: TaskInfo[] = [
				{
					title: 'Task without contexts',
					status: 'open',
					priority: 'normal',
					path: 'tasks/nocontexts.md',
					archived: false,
					contexts: undefined,
				},
			] as TaskInfo[];

			const result = filter.filterTasks(tasksWithUndefined, 'Task');
			expect(result.length).toBe(1);
		});

		it('should handle undefined projects gracefully', () => {
			const tasksWithUndefined: TaskInfo[] = [
				{
					title: 'Task without projects',
					status: 'open',
					priority: 'normal',
					path: 'tasks/noprojects.md',
					archived: false,
					projects: undefined,
				},
			] as TaskInfo[];

			const result = filter.filterTasks(tasksWithUndefined, 'Task');
			expect(result.length).toBe(1);
		});
	});

	describe('extractSearchableText', () => {
		it('should extract text from all core fields', () => {
			const task: TaskInfo = {
				title: 'Test Task',
				status: 'open',
				priority: 'high',
				path: 'tasks/test.md',
				archived: false,
				tags: ['tag1', 'tag2'],
				contexts: ['@work'],
				projects: ['Project1'],
			};

			const searchableText = (filter as any).extractSearchableText(task);
			
			expect(searchableText).toContain('test task');
			expect(searchableText).toContain('open');
			expect(searchableText).toContain('high');
			expect(searchableText).toContain('tag1');
			expect(searchableText).toContain('tag2');
			expect(searchableText).toContain('@work');
			expect(searchableText).toContain('project1');
		});

		it('should handle null/undefined values gracefully', () => {
			const task: TaskInfo = {
				title: 'Test Task',
				status: 'open',
				priority: 'normal',
				path: 'tasks/test.md',
				archived: false,
				tags: undefined,
				contexts: undefined,
				projects: undefined,
			};

			const searchableText = (filter as any).extractSearchableText(task);
			
			expect(searchableText).toContain('test task');
			expect(searchableText).toContain('open');
			expect(searchableText).toContain('normal');
		});

		it('should join array fields with spaces', () => {
			const task: TaskInfo = {
				title: 'Test',
				status: 'open',
				priority: 'normal',
				path: 'tasks/test.md',
				archived: false,
				tags: ['alpha', 'beta', 'gamma'],
			};

			const searchableText = (filter as any).extractSearchableText(task);
			
			expect(searchableText).toContain('alpha');
			expect(searchableText).toContain('beta');
			expect(searchableText).toContain('gamma');
		});

		it('should extract text from visible custom properties', () => {
			const filterWithProps = new TaskSearchFilter(['assignee']);
			const task: TaskInfo = {
				title: 'Test',
				status: 'open',
				priority: 'normal',
				path: 'tasks/test.md',
				archived: false,
				customProperties: {
					assignee: 'Jane Smith',
					hidden: 'Should not appear',
				},
			};

			const searchableText = (filterWithProps as any).extractSearchableText(task);
			
			expect(searchableText).toContain('jane smith');
			expect(searchableText).not.toContain('should not appear');
		});
	});
});

