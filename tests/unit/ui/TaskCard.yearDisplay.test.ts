/**
 * TaskCard Year Display Tests
 *
 * Tests for issue #1431: Display year on task cards if not current year
 *
 * When a task's due or scheduled date is in a different year than the current year,
 * the year should be displayed to avoid ambiguity (e.g., "Feb 27, 2027" instead of "Feb 27")
 */

import {
	createTaskCard,
	updateTaskCard,
} from '../../../src/ui/TaskCard';

import { TaskInfo } from '../../../src/types';
import { TaskFactory } from '../../helpers/mock-factories';
import { MockObsidian, App } from '../../__mocks__/obsidian';

// Mock external dependencies
jest.mock('obsidian');

// We do NOT mock date-fns here - we want real formatting behavior
// We do NOT mock dateUtils here - we want real date display logic

jest.mock('../../../src/utils/helpers', () => ({
	calculateTotalTimeSpent: jest.fn((entries) => entries?.length ? entries.length * 30 : 0),
	getEffectiveTaskStatus: jest.fn((task) => task.status || 'open'),
	shouldUseRecurringTaskUI: jest.fn((task) => !!task.recurrence),
	getRecurringTaskCompletionText: jest.fn(() => 'Not completed for this date'),
	getRecurrenceDisplayText: jest.fn((recurrence) => 'Daily'),
	filterEmptyProjects: jest.fn((projects) => projects?.filter((p: string) => p && p.trim()) || [])
}));

jest.mock('../../../src/components/TaskContextMenu', () => ({
	TaskContextMenu: jest.fn().mockImplementation(() => ({
		show: jest.fn()
	}))
}));

// Mock propertyMapping to make properties visible
jest.mock('../../../src/utils/propertyMapping', () => ({
	convertInternalToUserProperties: jest.fn((properties) => properties),
	isPropertyForField: jest.fn((propertyId, field) => propertyId === field)
}));

describe.skip('TaskCard Year Display (#1431)', () => {
	let mockPlugin: any;
	let mockApp: any;
	let container: HTMLElement;

	// Use a fixed "current" date for testing
	const CURRENT_YEAR = 2025;
	const FIXED_NOW = new Date(`${CURRENT_YEAR}-06-15T12:00:00Z`);

	beforeEach(() => {
		jest.clearAllMocks();
		MockObsidian.reset();

		// Set fixed time for consistent test behavior
		jest.useFakeTimers();
		jest.setSystemTime(FIXED_NOW);

		// Create DOM container
		document.body.innerHTML = '';
		container = document.createElement('div');
		document.body.appendChild(container);

		// Mock plugin
		mockApp = new App();
		mockPlugin = {
			app: mockApp,
			selectedDate: FIXED_NOW,
			fieldMapper: {
				isPropertyForField: jest.fn((prop: string, field: string) => prop === field),
				toUserField: jest.fn((field: string) => field),
				toInternalField: jest.fn((field: string) => field),
				lookupMappingKey: jest.fn((propertyId: string) => propertyId), // Return property as-is
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
				isCompletedStatus: jest.fn((status) => status === 'done'),
				getStatusConfig: jest.fn((status) => ({
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
				getPriorityConfig: jest.fn((priority) => ({
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
			formatTime: jest.fn((minutes) => `${minutes}m`),
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
				singleClickAction: 'edit',
				doubleClickAction: 'none',
				showExpandableSubtasks: false,
				subtaskChevronPosition: 'right',
				hideCompletedFromOverdue: true,
				calendarViewSettings: {
					timeFormat: '24'
				}
			}
		};

		mockApp.vault = mockApp.vault || {};
		mockApp.vault.getAbstractFileByPath = jest.fn();
		mockApp.workspace = mockApp.workspace || {};
		mockApp.workspace.getLeaf = jest.fn().mockReturnValue({ openFile: jest.fn() });
		mockApp.workspace.openLinkText = jest.fn();
		mockApp.workspace.trigger = jest.fn();
		mockApp.metadataCache = mockApp.metadataCache || {};
		mockApp.metadataCache.getFirstLinkpathDest = jest.fn();

		jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.spyOn(console, 'warn').mockImplementation(() => {});
		jest.spyOn(console, 'debug').mockImplementation(() => {});
	});

	afterEach(() => {
		jest.useRealTimers();
		jest.restoreAllMocks();
		document.body.innerHTML = '';
	});

	// Properties to show for date display tests
	const visibleProperties = ['due', 'scheduled'];

	describe('Due date year display', () => {
		it('should NOT display year for due dates in the current year', () => {
			// Current year is 2025, due date is Feb 27, 2025
			const task = TaskFactory.createTask({
				title: 'Task with current year due date',
				due: '2025-02-27',
				status: 'open'
			});

			const card = createTaskCard(task, mockPlugin, visibleProperties);
			const metadataText = card.querySelector('.task-card__metadata')?.textContent || '';

			// Should show "Feb 27" without year for current year dates
			expect(metadataText).toContain('Due:');
			expect(metadataText).toContain('Feb 27');
			// Should NOT contain the year for current year
			expect(metadataText).not.toMatch(/Feb 27.*2025/);
		});

		it('should display year for due dates in a future year', () => {
			// Current year is 2025, due date is Feb 27, 2027
			const task = TaskFactory.createTask({
				title: 'Task with future year due date',
				due: '2027-02-27',
				status: 'open'
			});

			const card = createTaskCard(task, mockPlugin, visibleProperties);
			const metadataText = card.querySelector('.task-card__metadata')?.textContent || '';

			// Should show "Feb 27, 2027" with year for future dates
			expect(metadataText).toContain('Due:');
			expect(metadataText).toMatch(/Feb 27.*2027/);
		});

		it('should display year for due dates in a past year', () => {
			// Current year is 2025, due date is Feb 27, 2024 (overdue)
			const task = TaskFactory.createTask({
				title: 'Task with past year due date',
				due: '2024-02-27',
				status: 'open'
			});

			const card = createTaskCard(task, mockPlugin, visibleProperties);
			const metadataText = card.querySelector('.task-card__metadata')?.textContent || '';

			// Should show "Feb 27, 2024" with year for past dates
			expect(metadataText).toContain('Due:');
			expect(metadataText).toMatch(/Feb 27.*2024/);
		});

		it('should display year for due dates with time in a future year', () => {
			// Current year is 2025, due date is Feb 27, 2027 at 14:30
			const task = TaskFactory.createTask({
				title: 'Task with future datetime due',
				due: '2027-02-27T14:30:00',
				status: 'open'
			});

			const card = createTaskCard(task, mockPlugin, visibleProperties);
			const metadataText = card.querySelector('.task-card__metadata')?.textContent || '';

			// Should show date with year and time
			expect(metadataText).toContain('Due:');
			expect(metadataText).toMatch(/Feb 27.*2027/);
			expect(metadataText).toContain('14:30');
		});
	});

	describe('Scheduled date year display', () => {
		it('should NOT display year for scheduled dates in the current year', () => {
			// Current year is 2025, scheduled date is Mar 15, 2025
			const task = TaskFactory.createTask({
				title: 'Task with current year scheduled date',
				scheduled: '2025-03-15',
				status: 'open'
			});

			const card = createTaskCard(task, mockPlugin, visibleProperties);
			const metadataText = card.querySelector('.task-card__metadata')?.textContent || '';

			// Should show "Mar 15" without year for current year dates
			expect(metadataText).toContain('Scheduled:');
			expect(metadataText).toContain('Mar 15');
			// Should NOT contain the year for current year
			expect(metadataText).not.toMatch(/Mar 15.*2025/);
		});

		it('should display year for scheduled dates in a future year', () => {
			// Current year is 2025, scheduled date is Mar 15, 2026
			const task = TaskFactory.createTask({
				title: 'Task with future year scheduled date',
				scheduled: '2026-03-15',
				status: 'open'
			});

			const card = createTaskCard(task, mockPlugin, visibleProperties);
			const metadataText = card.querySelector('.task-card__metadata')?.textContent || '';

			// Should show "Mar 15, 2026" with year for future dates
			expect(metadataText).toContain('Scheduled:');
			expect(metadataText).toMatch(/Mar 15.*2026/);
		});

		it('should display year for scheduled dates in a past year', () => {
			// Current year is 2025, scheduled date is Mar 15, 2024
			const task = TaskFactory.createTask({
				title: 'Task with past year scheduled date',
				scheduled: '2024-03-15',
				status: 'open'
			});

			const card = createTaskCard(task, mockPlugin, visibleProperties);
			const metadataText = card.querySelector('.task-card__metadata')?.textContent || '';

			// Should show "Mar 15, 2024" with year for past dates
			expect(metadataText).toContain('Scheduled:');
			expect(metadataText).toMatch(/Mar 15.*2024/);
		});

		it('should display year for scheduled dates with time in a future year', () => {
			// Current year is 2025, scheduled date is Mar 15, 2026 at 09:00
			const task = TaskFactory.createTask({
				title: 'Task with future datetime scheduled',
				scheduled: '2026-03-15T09:00:00',
				status: 'open'
			});

			const card = createTaskCard(task, mockPlugin, visibleProperties);
			const metadataText = card.querySelector('.task-card__metadata')?.textContent || '';

			// Should show date with year and time
			expect(metadataText).toContain('Scheduled:');
			expect(metadataText).toMatch(/Mar 15.*2026/);
			expect(metadataText).toContain('09:00');
		});
	});

	describe('Edge cases', () => {
		it('should handle tasks with both due and scheduled dates in different years', () => {
			const task = TaskFactory.createTask({
				title: 'Task with multi-year dates',
				due: '2027-06-01',      // Future year
				scheduled: '2025-05-15', // Current year
				status: 'open'
			});

			const card = createTaskCard(task, mockPlugin, visibleProperties);
			const metadataText = card.querySelector('.task-card__metadata')?.textContent || '';

			// Due date should show year (future)
			expect(metadataText).toMatch(/Due:.*Jun 1.*2027/);
			// Scheduled date should NOT show year (current)
			expect(metadataText).toContain('Scheduled:');
			expect(metadataText).toContain('May 15');
			expect(metadataText).not.toMatch(/May 15.*2025/);
		});

		it('should handle New Years Eve transition gracefully', () => {
			// Test date that's Dec 31 of current year - should NOT show year
			const task = TaskFactory.createTask({
				title: 'End of year task',
				due: '2025-12-31',
				status: 'open'
			});

			const card = createTaskCard(task, mockPlugin, visibleProperties);
			const metadataText = card.querySelector('.task-card__metadata')?.textContent || '';

			expect(metadataText).toContain('Dec 31');
			expect(metadataText).not.toMatch(/Dec 31.*2025/);
		});

		it('should handle Jan 1 of next year correctly', () => {
			// Test date that's Jan 1 of next year - SHOULD show year
			const task = TaskFactory.createTask({
				title: 'New Year task',
				due: '2026-01-01',
				status: 'open'
			});

			const card = createTaskCard(task, mockPlugin, visibleProperties);
			const metadataText = card.querySelector('.task-card__metadata')?.textContent || '';

			expect(metadataText).toContain('Jan 1');
			expect(metadataText).toMatch(/Jan 1.*2026/);
		});
	});
});
