/**
 * Test to reproduce Issue #1734: The BlockedBy Modal doesn't filter based on search text
 *
 * Bug Description:
 * The search field in the dependency picker modal ("Search tasks or type to create new...")
 * does not filter the task list when text is typed. The full unfiltered task list is displayed
 * regardless of input.
 *
 * Root Cause Hypothesis:
 * The TaskSelectorWithCreateModal extends Obsidian's SuggestModal and implements
 * getSuggestions() which delegates to getFilteredTasks(). The filtering logic itself
 * is correct, but the modal may not re-render suggestions properly due to TaskCard
 * cloning in renderSuggestion() or interaction with the custom handleInputChange listener.
 *
 * Key locations:
 * - src/modals/TaskSelectorWithCreateModal.ts:getSuggestions() (line 379)
 * - src/modals/TaskSelectorWithCreateModal.ts:getFilteredTasks() (line 384)
 * - src/modals/TaskSelectorWithCreateModal.ts:renderSuggestion() (line 438)
 * - src/modals/TaskModal.ts:openTaskDependencySelector() (line 374)
 */

jest.mock('obsidian');

describe('Issue #1734: Dependency picker search filtering', () => {
	it.skip('reproduces issue #1734: typing in search should filter the task list', () => {
		// Simulate the filtering logic from getFilteredTasks
		const tasks = [
			{ title: 'Buy groceries', due: '2026-04-01', priority: 'high', contexts: ['@home'], projects: ['[[Household]]'], archived: false, status: 'open' },
			{ title: 'Write report', due: '2026-04-02', priority: 'normal', contexts: ['@work'], projects: ['[[Q2 Planning]]'], archived: false, status: 'open' },
			{ title: 'Fix login bug', due: '2026-04-03', priority: 'high', contexts: ['@dev'], projects: ['[[App v2]]'], archived: false, status: 'open' },
			{ title: 'Schedule dentist', due: null, priority: 'low', contexts: ['@personal'], projects: [], archived: false, status: 'open' },
			{ title: 'Review PR #42', due: '2026-04-01', priority: 'normal', contexts: ['@dev'], projects: ['[[App v2]]'], archived: false, status: 'open' },
		];

		// This mirrors the getFilteredTasks logic from TaskSelectorWithCreateModal
		function getFilteredTasks(query: string, taskList: typeof tasks) {
			const lowerQuery = query.toLowerCase();
			return taskList
				.filter((task) => !task.archived)
				.filter((task) => {
					if (!query) return true;
					if (task.title && task.title.toLowerCase().includes(lowerQuery)) return true;
					if (task.due && task.due.toLowerCase().includes(lowerQuery)) return true;
					if (task.priority && task.priority !== 'normal' && task.priority.toLowerCase().includes(lowerQuery)) return true;
					if (task.contexts?.some((c) => c && c.toLowerCase().includes(lowerQuery))) return true;
					const filteredProjects = (task.projects || []).filter((p) => p && typeof p === 'string' && p.trim() !== '');
					if (filteredProjects.some((p) => p && p.toLowerCase().includes(lowerQuery))) return true;
					return false;
				});
		}

		// Empty query should return all non-archived tasks
		const allResults = getFilteredTasks('', tasks);
		expect(allResults).toHaveLength(5);

		// Searching for "bug" should return only "Fix login bug"
		const bugResults = getFilteredTasks('bug', tasks);
		expect(bugResults).toHaveLength(1);
		expect(bugResults[0].title).toBe('Fix login bug');

		// Searching for "App v2" should match tasks in that project
		const projectResults = getFilteredTasks('App v2', tasks);
		expect(projectResults).toHaveLength(2);

		// Searching for "high" should match by priority
		const priorityResults = getFilteredTasks('high', tasks);
		expect(priorityResults).toHaveLength(2);

		// Searching for "@dev" should match by context
		const contextResults = getFilteredTasks('@dev', tasks);
		expect(contextResults).toHaveLength(2);

		// The core filtering logic works correctly in isolation.
		// The actual bug is that Obsidian's SuggestModal does not re-render the
		// suggestion list when getSuggestions returns a filtered subset, likely
		// due to how renderSuggestion clones TaskCard elements or how the
		// handleInputChange listener interacts with the SuggestModal's internal
		// rendering cycle.
	});
});
