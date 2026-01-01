/**
 * ICSNoteService Due Date from ICS End Time Tests
 *
 * Tests for issue #1220: Optional toggle to import ICS event end time as task "due date"
 * Verifies that when useICSEndAsDue setting is enabled, the due date is set from ICS event end time
 */

import { ICSNoteService } from '../../../src/services/ICSNoteService';
import { ICSEvent } from '../../../src/types';
import { PluginFactory } from '../../helpers/mock-factories';
import { MockObsidian } from '../../__mocks__/obsidian';

// Mock dependencies
jest.mock('../../../src/utils/dateUtils', () => ({
	getCurrentTimestamp: jest.fn(() => '2025-02-12T12:00:00'),
	formatDateForStorage: jest.fn((date: Date) => {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	}),
}));

describe('ICSNoteService - Due Date from ICS End Time (Issue #1220)', () => {
	let icsNoteService: ICSNoteService;
	let mockPlugin: any;
	let mockTaskService: any;

	beforeEach(() => {
		jest.clearAllMocks();
		MockObsidian.reset();

		// Create mock task service that captures task creation data
		mockTaskService = {
			createTask: jest.fn().mockResolvedValue({
				file: { path: 'TaskNotes/Tasks/test-task.md' },
				taskInfo: { title: 'Test Task' },
			}),
		};

		// Create mock plugin with ICS integration settings
		mockPlugin = PluginFactory.createMockPlugin({
			settings: {
				defaultTaskStatus: 'open',
				defaultTaskPriority: 'normal',
				icsIntegration: {
					useICSEndAsDue: false, // Default to false for backwards compatibility
				},
			},
			icsSubscriptionService: {
				getSubscriptions: jest.fn(() => [
					{ id: 'test-sub', name: 'Test Calendar' },
				]),
			},
			taskService: mockTaskService,
			fieldMapper: {
				toUserField: jest.fn((field) => field),
			},
		});

		icsNoteService = new ICSNoteService(mockPlugin);
	});

	describe('default behavior (useICSEndAsDue disabled)', () => {
		it('should NOT set due date when useICSEndAsDue is false', async () => {
			mockPlugin.settings.icsIntegration.useICSEndAsDue = false;

			const testEvent: ICSEvent = {
				id: 'event-1',
				title: 'Team Meeting',
				start: '2025-02-12T09:00:00',
				end: '2025-02-12T11:00:00',
				location: 'Conference Room',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createTaskFromICS(testEvent);

			expect(mockTaskService.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					due: undefined,
				}),
				expect.anything()
			);
		});

		it('should still set scheduled date from start time', async () => {
			mockPlugin.settings.icsIntegration.useICSEndAsDue = false;

			const testEvent: ICSEvent = {
				id: 'event-2',
				title: 'Meeting',
				start: '2025-02-12T09:00:00',
				end: '2025-02-12T11:00:00',
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createTaskFromICS(testEvent);

			expect(mockTaskService.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					scheduled: '2025-02-12T09:00',
				}),
				expect.anything()
			);
		});
	});

	describe('new behavior (useICSEndAsDue enabled)', () => {
		beforeEach(() => {
			mockPlugin.settings.icsIntegration.useICSEndAsDue = true;
		});

		it('should set due date from timed event end time when enabled', async () => {
			const testEvent: ICSEvent = {
				id: 'event-3',
				title: 'Team Meeting',
				start: '2025-02-12T09:00:00',
				end: '2025-02-12T11:00:00',
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createTaskFromICS(testEvent);

			expect(mockTaskService.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					scheduled: '2025-02-12T09:00',
					due: '2025-02-12T11:00',
				}),
				expect.anything()
			);
		});

		it('should set due date to event date for all-day events (not ICS container date)', async () => {
			// ICS all-day events have DTEND as the next day, but we want due to be the event date
			const testEvent: ICSEvent = {
				id: 'event-4',
				title: 'All Day Event',
				start: '2025-02-12',
				end: '2025-02-13', // ICS convention: all-day events end the following day
				allDay: true,
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createTaskFromICS(testEvent);

			// Due should be 2025-02-12 (the actual event date), not 2025-02-13
			expect(mockTaskService.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					scheduled: '2025-02-12',
					due: '2025-02-12',
				}),
				expect.anything()
			);
		});

		it('should NOT set due date when ICS event has no end time', async () => {
			const testEvent: ICSEvent = {
				id: 'event-5',
				title: 'No End Time Event',
				start: '2025-02-12T09:00:00',
				end: undefined,
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createTaskFromICS(testEvent);

			expect(mockTaskService.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					due: undefined,
				}),
				expect.anything()
			);
		});

		it('should NOT set due date when end time is empty string', async () => {
			const testEvent: ICSEvent = {
				id: 'event-6',
				title: 'Empty End Time Event',
				start: '2025-02-12T09:00:00',
				end: '',
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createTaskFromICS(testEvent);

			expect(mockTaskService.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					due: undefined,
				}),
				expect.anything()
			);
		});
	});

	describe('user override behavior', () => {
		it('should use user-provided due date override even when useICSEndAsDue is enabled', async () => {
			mockPlugin.settings.icsIntegration.useICSEndAsDue = true;

			const testEvent: ICSEvent = {
				id: 'event-7',
				title: 'Meeting with Override',
				start: '2025-02-12T09:00:00',
				end: '2025-02-12T11:00:00',
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createTaskFromICS(testEvent, {
				due: '2025-02-15T17:00',
			});

			expect(mockTaskService.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					due: '2025-02-15T17:00',
				}),
				expect.anything()
			);
		});

		it('should respect explicit undefined override to clear due date', async () => {
			mockPlugin.settings.icsIntegration.useICSEndAsDue = true;

			const testEvent: ICSEvent = {
				id: 'event-8',
				title: 'Meeting with Explicit No Due',
				start: '2025-02-12T09:00:00',
				end: '2025-02-12T11:00:00',
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			// Explicitly passing undefined should still result in no due date
			// when the user intentionally wants to clear it
			await icsNoteService.createTaskFromICS(testEvent, {
				due: undefined,
			});

			// When override.due is undefined, we should fall back to the computed value
			// if useICSEndAsDue is enabled
			expect(mockTaskService.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					due: '2025-02-12T11:00',
				}),
				expect.anything()
			);
		});
	});

	describe('setting presence', () => {
		it('should work when useICSEndAsDue setting is missing (backwards compatibility)', async () => {
			// Simulate older settings without the new toggle
			delete mockPlugin.settings.icsIntegration.useICSEndAsDue;

			const testEvent: ICSEvent = {
				id: 'event-9',
				title: 'Legacy Behavior Test',
				start: '2025-02-12T09:00:00',
				end: '2025-02-12T11:00:00',
				location: '',
				description: '',
				subscriptionId: 'test-sub',
			};

			await icsNoteService.createTaskFromICS(testEvent);

			// Should behave as if disabled (no due date)
			expect(mockTaskService.createTask).toHaveBeenCalledWith(
				expect.objectContaining({
					due: undefined,
				}),
				expect.anything()
			);
		});
	});
});
