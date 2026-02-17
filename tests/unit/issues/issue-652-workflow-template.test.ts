/**
 * Issue #652: [FR] Workflow template
 *
 * Feature Request: Users want to define "workflow templates" that, given a
 * single anchor date (e.g. a meeting date), automatically generate multiple
 * related tasks with dates computed relative to that anchor.
 *
 * Example use case — a meeting workflow:
 *   - Meeting poll:       anchor date − 21 days
 *   - Circulate agenda:   anchor date − 7 days
 *   - Day of meeting:     anchor date
 *   - Follow-up/minutes:  anchor date + 1 day
 *
 * Implementation considerations:
 * - A new "workflow template" concept that defines a list of tasks with
 *   relative date offsets from a user-supplied anchor date
 * - Each step in the workflow has its own title, date offset, and optional
 *   properties (priority, tags, contexts, etc.)
 * - The workflow should leverage existing TaskService.createTask() to
 *   create each task, and existing dateUtils for date arithmetic
 * - The template processor (templateProcessor.ts) already supports 50+
 *   variables; workflow templates would add anchor-date-relative variables
 * - Users need a way to define, store, and invoke workflow templates
 *   (settings UI, command palette, or template files)
 * - Generated tasks could optionally be linked via blockedBy/blocking
 *   dependencies to enforce ordering
 */

import { FileSystemFactory, PluginFactory } from '../../helpers/mock-factories';
import { MockObsidian, TFile } from '../../__mocks__/obsidian';
import { TaskCreationData, TaskService } from '../../../src/services/TaskService';
import { addDaysToDateString } from '../../../src/utils/dateUtils';

// Mock external dependencies
jest.mock('../../../src/utils/dateUtils', () => ({
	getCurrentTimestamp: jest.fn(() => '2025-01-01T12:00:00Z'),
	getCurrentDateString: jest.fn(() => '2025-01-01'),
	addDaysToDateString: jest.fn((dateStr: string, days: number) => {
		// Simple mock implementation for offset calculation
		const date = new Date(dateStr + 'T00:00:00');
		date.setDate(date.getDate() + days);
		return date.toISOString().split('T')[0];
	})
}));

jest.mock('../../../src/utils/filenameGenerator', () => ({
	generateTaskFilename: jest.fn((context) => `${context.title.toLowerCase().replace(/\s+/g, '-')}`),
	generateUniqueFilename: jest.fn((base) => base)
}));

jest.mock('../../../src/utils/helpers', () => ({
	ensureFolderExists: jest.fn().mockResolvedValue(undefined),
	calculateDefaultDate: jest.fn().mockReturnValue(undefined),
	addDTSTARTToRecurrenceRule: jest.fn(() => null),
	updateDTSTARTInRecurrenceRule: jest.fn((rule: string) => rule),
	updateToNextScheduledOccurrence: jest.fn(),
	splitFrontmatterAndBody: jest.fn(() => ({ frontmatter: {}, body: '' }))
}));

jest.mock('../../../src/utils/templateProcessor', () => ({
	processTemplate: jest.fn(() => ({
		frontmatter: {},
		body: ''
	})),
	mergeTemplateFrontmatter: jest.fn((base, template) => ({ ...base, ...template }))
}));

/**
 * Represents a single step in a workflow template.
 * This is the expected shape of the feature once implemented.
 */
interface WorkflowStep {
	title: string;
	dateOffset: number; // days relative to anchor date (negative = before, positive = after)
	dateField?: 'due' | 'scheduled'; // which date field to set (default: 'due')
	priority?: string;
	tags?: string[];
	contexts?: string[];
	status?: string;
}

/**
 * Represents a complete workflow template definition.
 */
interface WorkflowTemplate {
	name: string;
	description?: string;
	steps: WorkflowStep[];
}

describe('Issue #652 - Workflow template', () => {
	let taskService: TaskService;
	let mockPlugin: any;

	beforeEach(() => {
		jest.clearAllMocks();
		MockObsidian.reset();

		mockPlugin = PluginFactory.createMockPlugin({
			statusManager: {
				isCompletedStatus: jest.fn((status) => status === 'done'),
				getCompletedStatuses: jest.fn(() => ['done', 'completed'])
			},
			getActiveTimeSession: jest.fn(),
			cacheManager: {
				updateTaskInfoInCache: jest.fn().mockResolvedValue(undefined),
				getTaskInfo: jest.fn(),
				clearCacheEntry: jest.fn()
			}
		});

		mockPlugin.app.workspace.getActiveFile = jest.fn().mockReturnValue(null);

		taskService = new TaskService(mockPlugin);
	});

	it.skip('reproduces issue #652 - should generate multiple tasks from a workflow template with date offsets', async () => {
		/**
		 * Given a "Meeting" workflow template and an anchor date of 2025-03-15,
		 * the system should create 4 tasks with correct due dates:
		 *   - Meeting poll:      2025-02-22 (anchor − 21 days)
		 *   - Circulate agenda:  2025-03-08 (anchor − 7 days)
		 *   - Day of meeting:    2025-03-15 (anchor + 0 days)
		 *   - Follow-up/minutes: 2025-03-16 (anchor + 1 day)
		 */
		const meetingWorkflow: WorkflowTemplate = {
			name: 'Meeting Preparation',
			description: 'Standard meeting workflow with poll, agenda, meeting, and follow-up',
			steps: [
				{ title: 'Create meeting poll', dateOffset: -21, priority: 'medium', tags: ['meeting'] },
				{ title: 'Circulate agenda', dateOffset: -7, priority: 'high', tags: ['meeting'] },
				{ title: 'Day of meeting', dateOffset: 0, priority: 'high', tags: ['meeting'] },
				{ title: 'Follow-up and minutes', dateOffset: 1, priority: 'medium', tags: ['meeting'] }
			]
		};

		const anchorDate = '2025-03-15';

		// This would be the API call to create all tasks from a workflow
		// e.g., await taskService.createTasksFromWorkflow(meetingWorkflow, anchorDate);
		const createdTasks: any[] = [];
		for (const step of meetingWorkflow.steps) {
			const dueDate = (addDaysToDateString as jest.Mock)(anchorDate, step.dateOffset);
			const task = await taskService.createTask({
				title: step.title,
				due: dueDate,
				priority: step.priority,
				tags: step.tags
			});
			createdTasks.push(task);
		}

		expect(createdTasks).toHaveLength(4);
		expect(createdTasks[0].taskInfo.due).toBe('2025-02-22');
		expect(createdTasks[1].taskInfo.due).toBe('2025-03-08');
		expect(createdTasks[2].taskInfo.due).toBe('2025-03-15');
		expect(createdTasks[3].taskInfo.due).toBe('2025-03-16');
	});

	it.skip('reproduces issue #652 - workflow template should support both due and scheduled date fields', async () => {
		/**
		 * Some workflow steps may need the date set on 'scheduled' rather
		 * than 'due'. The template should allow specifying which field.
		 */
		const workflow: WorkflowTemplate = {
			name: 'Project Kickoff',
			steps: [
				{ title: 'Send invitations', dateOffset: -14, dateField: 'scheduled' },
				{ title: 'Kickoff meeting', dateOffset: 0, dateField: 'due' },
				{ title: 'Write summary', dateOffset: 1, dateField: 'scheduled' }
			]
		};

		const anchorDate = '2025-06-01';

		const createdTasks: any[] = [];
		for (const step of workflow.steps) {
			const dateValue = (addDaysToDateString as jest.Mock)(anchorDate, step.dateOffset);
			const taskData: TaskCreationData = { title: step.title };

			if (step.dateField === 'scheduled') {
				taskData.scheduled = dateValue;
			} else {
				taskData.due = dateValue;
			}

			const task = await taskService.createTask(taskData);
			createdTasks.push({ task, step });
		}

		expect(createdTasks).toHaveLength(3);

		// First task should have scheduled date, not due date
		expect(createdTasks[0].task.taskInfo.scheduled).toBe('2025-05-18');
		expect(createdTasks[0].task.taskInfo.due).toBeUndefined();

		// Second task should have due date
		expect(createdTasks[1].task.taskInfo.due).toBe('2025-06-01');

		// Third task should have scheduled date
		expect(createdTasks[2].task.taskInfo.scheduled).toBe('2025-06-02');
	});

	it.skip('reproduces issue #652 - workflow tasks should optionally be linked via dependencies', async () => {
		/**
		 * Generated workflow tasks may benefit from being linked via
		 * blockedBy/blocking dependencies so that earlier steps block
		 * later ones. This enforces the intended workflow order.
		 */
		const workflow: WorkflowTemplate = {
			name: 'Sequential Meeting Prep',
			steps: [
				{ title: 'Create meeting poll', dateOffset: -21 },
				{ title: 'Circulate agenda', dateOffset: -7 },
				{ title: 'Day of meeting', dateOffset: 0 },
				{ title: 'Follow-up and minutes', dateOffset: 1 }
			]
		};

		const anchorDate = '2025-04-10';

		const createdTasks: any[] = [];
		for (const step of workflow.steps) {
			const dueDate = (addDaysToDateString as jest.Mock)(anchorDate, step.dateOffset);
			const taskData: TaskCreationData = {
				title: step.title,
				due: dueDate
			};

			// Link to previous task in workflow
			if (createdTasks.length > 0) {
				const prevTask = createdTasks[createdTasks.length - 1];
				taskData.blockedBy = [{
					uid: prevTask.file.path,
					reltype: 'FINISHTOSTART' as any
				}];
			}

			const task = await taskService.createTask(taskData);
			createdTasks.push(task);
		}

		// Second task should be blocked by first
		expect(createdTasks[1].taskInfo.blockedBy).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ uid: createdTasks[0].file.path })
			])
		);

		// Last task should be blocked by the third
		expect(createdTasks[3].taskInfo.blockedBy).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ uid: createdTasks[2].file.path })
			])
		);
	});

	it.skip('reproduces issue #652 - workflow template should support custom properties per step', async () => {
		/**
		 * Each step in a workflow template should be able to carry
		 * custom properties (contexts, projects, etc.) that get passed
		 * through to the created task.
		 */
		const workflow: WorkflowTemplate = {
			name: 'Event Planning',
			steps: [
				{
					title: 'Book venue',
					dateOffset: -30,
					priority: 'high',
					contexts: ['work'],
					tags: ['event', 'venue']
				},
				{
					title: 'Send invitations',
					dateOffset: -14,
					priority: 'medium',
					contexts: ['work'],
					tags: ['event', 'communications']
				},
				{
					title: 'Event day',
					dateOffset: 0,
					priority: 'high',
					contexts: ['work'],
					tags: ['event']
				}
			]
		};

		const anchorDate = '2025-07-01';

		const createdTasks: any[] = [];
		for (const step of workflow.steps) {
			const dueDate = (addDaysToDateString as jest.Mock)(anchorDate, step.dateOffset);
			const task = await taskService.createTask({
				title: step.title,
				due: dueDate,
				priority: step.priority,
				contexts: step.contexts,
				tags: step.tags
			});
			createdTasks.push(task);
		}

		expect(createdTasks[0].taskInfo.tags).toContain('venue');
		expect(createdTasks[0].taskInfo.contexts).toContain('work');
		expect(createdTasks[1].taskInfo.tags).toContain('communications');
		expect(createdTasks[2].taskInfo.due).toBe('2025-07-01');
	});
});
