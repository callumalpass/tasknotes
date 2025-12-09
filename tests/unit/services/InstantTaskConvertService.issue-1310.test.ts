/**
 * InstantTaskConvertService Issue #1310 Tests
 *
 * Bug: Inline Task Conversion deletes text when title is truncated
 *
 * When Inline Task Conversion is activated on a line of text that contains
 * too many words for TaskNotes to include in a filename, it cuts them off
 * AND deletes the excluded text from the active note.
 *
 * Expected behavior: Text that cannot fit in the filename should be preserved
 * in the task note's body, not deleted.
 */

import { InstantTaskConvertService } from '../../../src/services/InstantTaskConvertService';
import { PluginFactory } from '../../helpers/mock-factories';

// Mock external dependencies
jest.mock('../../../src/utils/dateUtils', () => ({
	getCurrentTimestamp: jest.fn(() => '2025-01-01T12:00:00Z'),
	getCurrentDateString: jest.fn(() => '2025-01-01'),
	parseDate: jest.fn((dateStr) => dateStr),
	parseDateToUTC: jest.fn((dateStr) => new Date(dateStr)),
	formatDateForStorage: jest.fn((date) => {
		if (typeof date === 'string') return date;
		return date.toISOString().split('T')[0];
	}),
	combineDateAndTime: jest.fn((date, time) => `${date}T${time}:00`),
}));

jest.mock('../../../src/utils/filenameGenerator', () => ({
	generateTaskFilename: jest.fn((context) => {
		// Simulate real behavior: truncate long filenames
		const title = context.title;
		if (title.length > 100) {
			return title.substring(0, 100);
		}
		return title;
	}),
	generateUniqueFilename: jest.fn((base) => base),
}));

jest.mock('../../../src/utils/helpers', () => ({
	ensureFolderExists: jest.fn().mockResolvedValue(undefined),
	sanitizeFileName: jest.fn((name) => name.replace(/[<>:"|?*]/g, '')),
	calculateDefaultDate: jest.fn(() => undefined),
}));

jest.mock('../../../src/utils/templateProcessor', () => ({
	processTemplate: jest.fn(() => ({
		frontmatter: {},
		body: '',
	})),
	mergeTemplateFrontmatter: jest.fn((base, template) => ({ ...base, ...template })),
}));

describe('InstantTaskConvertService - Issue #1310: Truncated Text Preservation', () => {
	let service: InstantTaskConvertService;
	let mockPlugin: any;
	let createdTaskData: any;

	beforeEach(() => {
		createdTaskData = null;

		// Mock plugin with settings
		mockPlugin = PluginFactory.createMockPlugin({
			settings: {
				taskTag: 'task',
				tasksFolder: 'tasks',
				taskIdentificationMethod: 'tag',
				enableNaturalLanguageInput: false,
				useDefaultsOnInstantConvert: false,
				storeTitleInFilename: true,
				taskFilenameFormat: 'title',
				taskCreationDefaults: {
					defaultContexts: '',
					defaultTags: '',
					defaultPriority: 'none',
					defaultTaskStatus: 'none',
					defaultTimeEstimate: 0,
					defaultRecurrence: 'none',
					defaultReminders: [],
				},
			},
		});

		// Add missing workspace mock methods
		mockPlugin.app.workspace.getActiveFile = jest.fn().mockReturnValue(null);
		mockPlugin.app.metadataCache.getFirstLinkpathDest = jest.fn().mockReturnValue(null);
		mockPlugin.app.metadataCache.fileToLinktext = jest.fn().mockReturnValue('');
		mockPlugin.app.fileManager.generateMarkdownLink = jest.fn().mockReturnValue('[[link]]');

		// Capture task data when createTask is called
		mockPlugin.taskService = {
			createTask: jest.fn().mockImplementation((taskData) => {
				createdTaskData = taskData;
				return Promise.resolve({
					file: { path: 'tasks/test-task.md', basename: 'test-task' },
					taskInfo: { title: taskData.title },
				});
			}),
		};

		// Create service instance
		service = new InstantTaskConvertService(
			mockPlugin,
			mockPlugin.statusManager,
			mockPlugin.priorityManager
		);
	});

	describe('Title truncation due to sanitizeTitle (200 char limit)', () => {
		it('should preserve text beyond 200 characters in the task body', async () => {
			// Create a title that exceeds 200 characters
			const shortPart = 'This is the beginning of a very long task title that will need to be truncated because it exceeds the maximum allowed length for a task title in the system';
			const overflowPart = ' and this additional text should be preserved in the body instead of being deleted';
			const fullText = shortPart + overflowPart;

			expect(fullText.length).toBeGreaterThan(200);

			// Call the private createTaskFile method
			const parsedData = {
				title: fullText,
				isCompleted: false,
			};

			await (service as any).createTaskFile(parsedData, '');

			// The overflow text should be added to details/body
			// Note: The word-boundary logic may cut at a space before position 200,
			// so we check that the critical ending is preserved
			expect(createdTaskData).not.toBeNull();
			expect(createdTaskData.details).toBeTruthy();
			// At minimum, the ending of the overflow should be preserved
			expect(createdTaskData.details).toContain('being deleted');
		});

		it('should not modify body when title is under 200 characters', async () => {
			const shortTitle = 'This is a short task title';

			expect(shortTitle.length).toBeLessThan(200);

			const parsedData = {
				title: shortTitle,
				isCompleted: false,
			};

			await (service as any).createTaskFile(parsedData, '');

			expect(createdTaskData).not.toBeNull();
			// Details should be empty or undefined when no truncation occurs
			expect(createdTaskData.details || '').toBe('');
		});
	});

	describe('Filename truncation due to path length limits', () => {
		it('should preserve text that exceeds filename length in the task body', async () => {
			// Simulate a title that will be truncated in the filename
			const titlePart = 'Finish putting the desk into the car You might need to take the drawers out Alex can help';
			const overflowPart = ' on Tuesday but you need to call her back';
			const fullText = titlePart + overflowPart;

			const parsedData = {
				title: fullText,
				isCompleted: false,
			};

			await (service as any).createTaskFile(parsedData, '');

			expect(createdTaskData).not.toBeNull();
			// The full original text should be preserved somewhere
			// Either in the title (if it fits) or overflow in details
			const preservedText = (createdTaskData.title || '') + (createdTaskData.details || '');
			expect(preservedText).toContain('call her back');
		});
	});

	describe('Original line content preservation', () => {
		it('should include full original text in task body when filename is shorter', async () => {
			// This tests the scenario from the issue where the user's full text
			// should be preserved even if the filename is truncated
			const originalText =
				'Finish putting the desk into the car. You might need to take the drawers out. Alex can help on Tuesday but you need to call her back.';

			const parsedData = {
				title: originalText,
				isCompleted: false,
			};

			// Existing details that should be preserved
			const existingDetails = 'Some existing notes';

			await (service as any).createTaskFile(parsedData, existingDetails);

			expect(createdTaskData).not.toBeNull();

			// The full original text should be accessible in the created task
			// Either as the title (if short enough) or the overflow should be in details
			const allContent = [
				createdTaskData.title,
				createdTaskData.details,
			]
				.filter(Boolean)
				.join(' ');

			expect(allContent).toContain('call her back');
			// Existing details should also be preserved
			expect(createdTaskData.details).toContain(existingDetails);
		});

		it('should prepend overflow text before existing details', async () => {
			const longTitle = 'A'.repeat(150) + ' ' + 'B'.repeat(100); // 251 chars
			const existingDetails = 'User provided notes';

			const parsedData = {
				title: longTitle,
				isCompleted: false,
			};

			await (service as any).createTaskFile(parsedData, existingDetails);

			expect(createdTaskData).not.toBeNull();
			expect(createdTaskData.details).not.toBeNull();

			// Overflow text should come before existing details
			const detailsContent = createdTaskData.details;
			const overflowIndex = detailsContent.indexOf('B'.repeat(50)); // Some of the B's
			const existingIndex = detailsContent.indexOf('User provided notes');

			expect(overflowIndex).toBeLessThan(existingIndex);
		});
	});

	describe('Edge cases', () => {
		it('should handle title that is exactly 200 characters', async () => {
			const exactTitle = 'A'.repeat(200);

			const parsedData = {
				title: exactTitle,
				isCompleted: false,
			};

			await (service as any).createTaskFile(parsedData, '');

			expect(createdTaskData).not.toBeNull();
			expect(createdTaskData.title.length).toBe(200);
			// No overflow expected
			expect(createdTaskData.details || '').toBe('');
		});

		it('should handle title that is 201 characters (just over limit)', async () => {
			const slightlyOverTitle = 'A'.repeat(200) + 'B';

			const parsedData = {
				title: slightlyOverTitle,
				isCompleted: false,
			};

			await (service as any).createTaskFile(parsedData, '');

			expect(createdTaskData).not.toBeNull();
			expect(createdTaskData.title.length).toBe(200);
			// The 'B' should be in details
			expect(createdTaskData.details).toContain('B');
		});

		it('should preserve word boundaries when truncating', async () => {
			// Create a title where truncation would cut a word in half
			const title = 'A'.repeat(195) + ' wonderful day';

			const parsedData = {
				title: title,
				isCompleted: false,
			};

			await (service as any).createTaskFile(parsedData, '');

			expect(createdTaskData).not.toBeNull();
			// "wonderful day" should be preserved in details since it would be cut off
			expect(createdTaskData.details).toContain('wonderful day');
		});
	});
});
