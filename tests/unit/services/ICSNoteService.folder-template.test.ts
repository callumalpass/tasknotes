/**
 * ICSNoteService Folder Template Tests
 *
 * Tests for issue #816: Add {{year}} {{month}} {{date}} functionality for ICS Subscription note paths
 * Verifies that folder template variables are properly processed when creating notes from ICS events
 */

import { ICSNoteService } from '../../../src/services/ICSNoteService';
import { ICSEvent } from '../../../src/types';
import { PluginFactory } from '../../helpers/mock-factories';
import { MockObsidian } from '../../__mocks__/obsidian';

// Mock dependencies
jest.mock('../../../src/utils/dateUtils', () => ({
	getCurrentTimestamp: jest.fn(() => '2025-10-05T12:00:00Z'),
	formatDateForStorage: jest.fn((date) => date),
}));

jest.mock('../../../src/utils/filenameGenerator', () => ({
	generateICSNoteFilename: jest.fn(() => 'test-event'),
	generateUniqueFilename: jest.fn((base) => base),
}));

jest.mock('../../../src/utils/helpers', () => ({
	ensureFolderExists: jest.fn().mockResolvedValue(undefined),
	splitFrontmatterAndBody: jest.fn(() => ({ frontmatter: {}, body: '' })),
}));

jest.mock('../../../src/utils/templateProcessor', () => ({
	processTemplate: jest.fn(() => ({
		frontmatter: {},
		body: 'Note content',
	})),
}));

describe('ICSNoteService - Folder Template Processing (Issue #816)', () => {
	let icsNoteService: ICSNoteService;
	let mockPlugin: any;
	let mockEnsureFolderExists: jest.Mock;

	beforeEach(() => {
		jest.clearAllMocks();
		MockObsidian.reset();

		// Import the mocked ensureFolderExists to verify calls
		mockEnsureFolderExists = require('../../../src/utils/helpers').ensureFolderExists;

		// Create mock plugin with ICS integration settings
		mockPlugin = PluginFactory.createMockPlugin({
			settings: {
				icsIntegration: {
					defaultNoteFolder: 'Daily/{{year}}/{{month}}/',
					filenameFormat: 'custom',
					customFilenameTemplate: '{{date}} {{title}}',
				},
			},
			icsSubscriptionService: {
				getSubscriptions: jest.fn(() => [
					{ id: 'test-sub', name: 'Test Calendar' },
					{ id: 'user-calendar', name: 'User Calendar' },
				]),
			},
		});

		icsNoteService = new ICSNoteService(mockPlugin);
	});

	describe('folder template variable processing', () => {
		it('should process {{year}} {{month}} {{day}} in default note folder', async () => {
			const testEvent: ICSEvent = {
				id: 'test-event-1',
				title: 'Test Event',
				start: '2025-10-02T10:00:00Z',
				end: '2025-10-02T11:00:00Z',
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createNoteFromICS(testEvent);

			// Verify that ensureFolderExists was called with the processed path
			expect(mockEnsureFolderExists).toHaveBeenCalledWith(
				expect.anything(),
				'Daily/2025/10/'
			);
		});

		it('should process {{date}} template variable', async () => {
			mockPlugin.settings.icsIntegration.defaultNoteFolder = 'Events/{{date}}/';

			const testEvent: ICSEvent = {
				id: 'test-event-2',
				title: 'Meeting',
				start: '2025-10-05T00:00:00Z',
				end: '2025-10-05T01:00:00Z',
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createNoteFromICS(testEvent);

			expect(mockEnsureFolderExists).toHaveBeenCalledWith(
				expect.anything(),
				'Events/2025-10-05/'
			);
		});

		it('should process {{monthName}} and {{dayName}} template variables', async () => {
			mockPlugin.settings.icsIntegration.defaultNoteFolder = '{{monthName}}/{{dayName}}/';

			const testEvent: ICSEvent = {
				id: 'test-event-3',
				title: 'Conference',
				start: '2025-10-05T09:00:00Z',
				end: '2025-10-05T17:00:00Z',
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createNoteFromICS(testEvent);

			expect(mockEnsureFolderExists).toHaveBeenCalledWith(
				expect.anything(),
				'October/Sunday/'
			);
		});

		it('should process {{icsEventTitle}} template variable', async () => {
			mockPlugin.settings.icsIntegration.defaultNoteFolder = 'Events/{{year}}/{{icsEventTitle}}/';

			const testEvent: ICSEvent = {
				id: 'test-event-4',
				title: 'Team Standup',
				start: '2025-10-05T10:00:00Z',
				end: '2025-10-05T10:30:00Z',
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createNoteFromICS(testEvent);

			expect(mockEnsureFolderExists).toHaveBeenCalledWith(
				expect.anything(),
				'Events/2025/Team Standup/'
			);
		});

		it('should process {{icsEventLocation}} template variable', async () => {
			mockPlugin.settings.icsIntegration.defaultNoteFolder = 'Meetings/{{icsEventLocation}}/';

			const testEvent: ICSEvent = {
				id: 'test-event-5',
				title: 'Board Meeting',
				start: '2025-10-05T14:00:00Z',
				end: '2025-10-05T16:00:00Z',
				location: 'Conference Room A',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createNoteFromICS(testEvent);

			expect(mockEnsureFolderExists).toHaveBeenCalledWith(
				expect.anything(),
				'Meetings/Conference Room A/'
			);
		});

		it('should sanitize special characters in ICS event title', async () => {
			mockPlugin.settings.icsIntegration.defaultNoteFolder = 'Events/{{icsEventTitle}}/';

			const testEvent: ICSEvent = {
				id: 'test-event-6',
				title: 'Test<>:"/\\|?*Event',
				start: '2025-10-05T10:00:00Z',
				end: '2025-10-05T11:00:00Z',
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createNoteFromICS(testEvent);

			expect(mockEnsureFolderExists).toHaveBeenCalledWith(
				expect.anything(),
				'Events/Test_________Event/'
			);
		});

		it('should handle combination of date and ICS event variables', async () => {
			mockPlugin.settings.icsIntegration.defaultNoteFolder =
				'Daily/{{year}}/{{month}}/{{date}}-{{icsEventTitle}}/';

			const testEvent: ICSEvent = {
				id: 'test-event-7',
				title: 'Quarterly Review',
				start: '2025-10-02T13:00:00Z',
				end: '2025-10-02T15:00:00Z',
				location: 'Main Office',
				description: 'Q3 review meeting',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createNoteFromICS(testEvent);

			expect(mockEnsureFolderExists).toHaveBeenCalledWith(
				expect.anything(),
				'Daily/2025/10/2025-10-02-Quarterly Review/'
			);
		});

		it('should handle empty folder template', async () => {
			mockPlugin.settings.icsIntegration.defaultNoteFolder = '';

			const testEvent: ICSEvent = {
				id: 'test-event-8',
				title: 'Simple Event',
				start: '2025-10-05T10:00:00Z',
				end: '2025-10-05T11:00:00Z',
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createNoteFromICS(testEvent);

			// Should not call ensureFolderExists when folder is empty
			expect(mockEnsureFolderExists).not.toHaveBeenCalled();
		});

		it('should handle static folder path without variables', async () => {
			mockPlugin.settings.icsIntegration.defaultNoteFolder = 'Static/ICS/Events/';

			const testEvent: ICSEvent = {
				id: 'test-event-9',
				title: 'Static Event',
				start: '2025-10-05T10:00:00Z',
				end: '2025-10-05T11:00:00Z',
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createNoteFromICS(testEvent);

			expect(mockEnsureFolderExists).toHaveBeenCalledWith(
				expect.anything(),
				'Static/ICS/Events/'
			);
		});
	});

	describe('folder override handling', () => {
		it('should use overridden folder and process its template variables', async () => {
			const testEvent: ICSEvent = {
				id: 'test-event-10',
				title: 'Override Test',
				start: '2025-10-05T10:00:00Z',
				end: '2025-10-05T11:00:00Z',
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createNoteFromICS(testEvent, {
				folder: 'Custom/{{year}}/{{icsEventTitle}}/',
			});

			expect(mockEnsureFolderExists).toHaveBeenCalledWith(
				expect.anything(),
				'Custom/2025/Override Test/'
			);
		});
	});

	describe('user-reported use case from issue #816', () => {
		it('should create notes in Daily/YYYY/MM/ structure as reported by user', async () => {
			// Exact use case from issue #816
			mockPlugin.settings.icsIntegration.defaultNoteFolder = 'Daily/{{year}}/{{month}}/';
			mockPlugin.settings.icsIntegration.filenameFormat = 'custom';
			mockPlugin.settings.icsIntegration.customFilenameTemplate = '{{date}} {{title}}';

			const testEvent: ICSEvent = {
				id: 'aangifte-test',
				title: 'Aangifte Omzetbelasting',
				start: '2025-10-02T10:00:00Z',
				end: '2025-10-02T11:00:00Z',
				location: '',
				description: '',
				subscriptionId: 'user-calendar',
			};

			await icsNoteService.createNoteFromICS(testEvent);

			// Should create folder: Daily/2025/10/
			expect(mockEnsureFolderExists).toHaveBeenCalledWith(
				expect.anything(),
				'Daily/2025/10/'
			);
		});
	});
});
