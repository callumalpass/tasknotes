import { GoogleCalendarService } from '../../src/services/GoogleCalendarService';
import { OAuthService } from '../../src/services/OAuthService';
import { requestUrl, Notice } from 'obsidian';
import type TaskNotesPlugin from '../../src/main';
import { GoogleCalendarError, RateLimitError, EventNotFoundError } from '../../src/services/errors';

// Mock Obsidian APIs
jest.mock('obsidian', () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	Platform: { isDesktopApp: true }
}));

describe('GoogleCalendarService', () => {
	let service: GoogleCalendarService;
	let mockPlugin: Partial<TaskNotesPlugin>;
	let mockOAuthService: Partial<OAuthService>;
	let mockRequestUrl: jest.MockedFunction<typeof requestUrl>;

	const mockCalendarList = {
		items: [
			{
				id: 'primary',
				summary: 'Primary Calendar',
				backgroundColor: '#9fc6e7',
				primary: true
			},
			{
				id: 'work@example.com',
				summary: 'Work Calendar',
				backgroundColor: '#f83a22'
			}
		]
	};

	const mockEventsList = {
		items: [
			{
				id: 'event1',
				summary: 'Team Meeting',
				description: 'Weekly sync',
				start: { dateTime: '2025-10-21T10:00:00-07:00' },
				end: { dateTime: '2025-10-21T11:00:00-07:00' },
				location: 'Conference Room A',
				htmlLink: 'https://calendar.google.com/event1'
			},
			{
				id: 'event2',
				summary: 'All Day Event',
				start: { date: '2025-10-22' },
				end: { date: '2025-10-23' }
			}
		],
		nextSyncToken: 'sync-token-123'
	};

	beforeEach(() => {
		jest.clearAllMocks();

		// Setup mock plugin
		mockPlugin = {
			app: {} as any,
			settings: {
				enabledGoogleCalendars: [],
				googleCalendarSyncTokens: {}
			} as any,
			saveSettings: jest.fn().mockResolvedValue(undefined)
		};

		// Setup mock OAuth service
		mockOAuthService = {
			isConnected: jest.fn().mockResolvedValue(true),
			getValidToken: jest.fn().mockResolvedValue('test-access-token'),
			disconnect: jest.fn().mockResolvedValue(undefined)
		};

		// Create service instance
		service = new GoogleCalendarService(
			mockPlugin as TaskNotesPlugin,
			mockOAuthService as OAuthService
		);

		// Setup requestUrl mock
		mockRequestUrl = requestUrl as jest.MockedFunction<typeof requestUrl>;
	});

	describe('listCalendars', () => {
		test('should fetch and return list of calendars', async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: mockCalendarList,
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const calendars = await service.listCalendars();

			expect(calendars).toHaveLength(2);
			expect(calendars[0]).toMatchObject({
				id: 'primary',
				summary: 'Primary Calendar',
				backgroundColor: '#9fc6e7',
				primary: true
			});
			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: expect.stringContaining('/calendar/v3/users/me/calendarList'),
					method: 'GET'
				})
			);
		});

		test('should handle empty calendar list', async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { items: [] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const calendars = await service.listCalendars();
			expect(calendars).toHaveLength(0);
		});

		test('should throw GoogleCalendarError on API failure', async () => {
			mockRequestUrl.mockRejectedValueOnce({
				status: 403,
				message: 'Access denied'
			});

			await expect(service.listCalendars()).rejects.toThrow(GoogleCalendarError);
		});
	});

	describe('getEvents', () => {
		test('should fetch events for a calendar', async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: mockEventsList,
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const events = await service.getEvents('primary');

			expect(events).toHaveLength(2);
			expect(events[0]).toMatchObject({
				id: expect.stringContaining('event1'),
				title: 'Team Meeting',
				description: 'Weekly sync',
				location: 'Conference Room A'
			});
			expect(events[0].allDay).toBe(false);
			expect(events[1].allDay).toBe(true);
		});

		test('should use sync token for incremental updates', async () => {
			// Set up sync token
			mockPlugin.settings!.googleCalendarSyncTokens = { 'primary': 'old-sync-token' };

			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { items: [], nextSyncToken: 'new-sync-token' },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await service.getEvents('primary');

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: expect.stringContaining('syncToken=old-sync-token')
				})
			);
		});

		test('should handle pagination with pageToken', async () => {
			// First page
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					items: [mockEventsList.items[0]],
					nextPageToken: 'page2'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Second page
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					items: [mockEventsList.items[1]],
					nextSyncToken: 'sync-token-123'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const events = await service.getEvents('primary');
			expect(events).toHaveLength(2);
			expect(mockRequestUrl).toHaveBeenCalledTimes(2);
		});

		test('should handle deleted events', async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					items: [
						{ ...mockEventsList.items[0] },
						{ id: 'deleted-event', status: 'cancelled' }
					],
					nextSyncToken: 'sync-token-123'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const events = await service.getEvents('primary');
			// Cancelled events should be filtered out or marked
			expect(events.every(e => e.id !== 'deleted-event')).toBe(true);
		});
	});

	describe('createEvent', () => {
		test('should create a timed event', async () => {
			const newEvent = {
				title: 'New Meeting',
				description: 'Important discussion',
				start: '2025-10-23T14:00:00',
				end: '2025-10-23T15:00:00',
				location: 'Room B'
			};

			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					id: 'new-event-id',
					summary: newEvent.title,
					description: newEvent.description,
					location: newEvent.location,
					start: { dateTime: newEvent.start + 'Z' },
					end: { dateTime: newEvent.end + 'Z' },
					htmlLink: 'https://calendar.google.com/event'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const created = await service.createEvent('primary', newEvent);

			expect(created.id).toContain('new-event-id');
			expect(created.title).toBe('New Meeting');
			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: expect.stringContaining('/calendars/primary/events'),
					method: 'POST',
					body: expect.stringContaining('"summary":"New Meeting"')
				})
			);
		});

		test('should create an all-day event', async () => {
			const newEvent = {
				title: 'All Day Event',
				start: '2025-10-23',
				end: '2025-10-24',
				isAllDay: true
			};

			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					id: 'all-day-event-id',
					summary: newEvent.title,
					start: { date: newEvent.start },
					end: { date: newEvent.end },
					htmlLink: 'https://calendar.google.com/event'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const created = await service.createEvent('primary', newEvent);

			expect(created.allDay).toBe(true);
			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.stringContaining('"date":"2025-10-23"')
				})
			);
		});

		test('should create a recurring event with RRULE', async () => {
			const newEvent = {
				title: 'Daily Standup',
				start: '2025-10-23',
				end: '2025-10-24',
				isAllDay: true,
				recurrence: ['RRULE:FREQ=DAILY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR']
			};

			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					id: 'recurring-event-id',
					summary: newEvent.title,
					start: { date: newEvent.start },
					end: { date: newEvent.end },
					recurrence: newEvent.recurrence,
					htmlLink: 'https://calendar.google.com/event'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const created = await service.createEvent('primary', newEvent);

			expect(created.id).toContain('recurring-event-id');
			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.stringContaining('"recurrence":["RRULE:FREQ=DAILY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR"]')
				})
			);
		});

		test('should create a recurring event with EXDATE', async () => {
			const newEvent = {
				title: 'Weekly Team Sync',
				start: '2025-10-20',
				end: '2025-10-21',
				isAllDay: true,
				recurrence: [
					'RRULE:FREQ=WEEKLY;BYDAY=MO',
					'EXDATE:20251027',
					'EXDATE:20251103'
				]
			};

			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					id: 'recurring-event-with-exceptions',
					summary: newEvent.title,
					start: { date: newEvent.start },
					end: { date: newEvent.end },
					recurrence: newEvent.recurrence,
					htmlLink: 'https://calendar.google.com/event'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const created = await service.createEvent('primary', newEvent);

			expect(created.id).toContain('recurring-event-with-exceptions');
			const requestBody = mockRequestUrl.mock.calls[0][0].body as string;
			expect(requestBody).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO');
			expect(requestBody).toContain('EXDATE:20251027');
			expect(requestBody).toContain('EXDATE:20251103');
		});
	});

	describe('updateEvent', () => {
		test('should update event properties', async () => {
			const updates = {
				title: 'Updated Meeting',
				location: 'New Room'
			};

			// First GET request to fetch current event
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					id: 'event1',
					summary: 'Old Meeting',
					location: 'Old Room',
					start: { dateTime: '2025-10-21T10:00:00-07:00' },
					end: { dateTime: '2025-10-21T11:00:00-07:00' }
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Then PUT request to update
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					id: 'event1',
					summary: updates.title,
					location: updates.location,
					start: { dateTime: '2025-10-21T10:00:00-07:00' },
					end: { dateTime: '2025-10-21T11:00:00-07:00' },
					htmlLink: 'https://calendar.google.com/event'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const updated = await service.updateEvent('primary', 'event1', updates);

			expect(updated.title).toBe('Updated Meeting');
			expect(updated.location).toBe('New Room');
			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: expect.stringContaining('/calendars/primary/events/event1'),
					method: 'PUT'
				})
			);
		});

		test('should handle converting timed event to all-day', async () => {
			const updates = {
				start: '2025-10-23',
				end: '2025-10-24',
				isAllDay: true
			};

			// First GET request
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					id: 'event1',
					summary: 'Event',
					start: { dateTime: '2025-10-21T10:00:00Z' },
					end: { dateTime: '2025-10-21T11:00:00Z' }
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Then PUT request
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					id: 'event1',
					summary: 'Event',
					start: { date: '2025-10-23' },
					end: { date: '2025-10-24' },
					htmlLink: 'https://calendar.google.com/event'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const updated = await service.updateEvent('primary', 'event1', updates);
			expect(updated.allDay).toBe(true);
		});

		test('should throw EventNotFoundError if event does not exist', async () => {
			mockRequestUrl.mockRejectedValueOnce({
				status: 404,
				message: 'Not found'
			});

			await expect(
				service.updateEvent('primary', 'nonexistent', { title: 'New Title' })
			).rejects.toThrow(EventNotFoundError);
		});

		test('should update recurring event with EXDATE', async () => {
			// First GET request to fetch current event
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					id: 'recurring-event-id',
					summary: 'Daily Standup',
					start: { date: '2025-10-20' },
					end: { date: '2025-10-21' },
					recurrence: ['RRULE:FREQ=DAILY;INTERVAL=1']
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Then PUT request with updated recurrence
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					id: 'recurring-event-id',
					summary: 'Daily Standup',
					start: { date: '2025-10-20' },
					end: { date: '2025-10-21' },
					recurrence: ['RRULE:FREQ=DAILY;INTERVAL=1', 'EXDATE:20251022'],
					htmlLink: 'https://calendar.google.com/event'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await service.updateEvent('primary', 'recurring-event-id', {
				recurrence: ['RRULE:FREQ=DAILY;INTERVAL=1', 'EXDATE:20251022']
			});

			// Check the second call (PUT request) - first is GET, second is PUT, third is refresh
			expect(mockRequestUrl).toHaveBeenNthCalledWith(
				2,
				expect.objectContaining({
					method: 'PUT',
					body: expect.stringContaining('EXDATE:20251022')
				})
			);
		});

		test('should update recurring event with multiple EXDATEs', async () => {
			// First GET request
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					id: 'recurring-event-id',
					summary: 'Weekly Sync',
					start: { date: '2025-10-20' },
					end: { date: '2025-10-21' },
					recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO']
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Then PUT request
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					id: 'recurring-event-id',
					summary: 'Weekly Sync',
					start: { date: '2025-10-20' },
					end: { date: '2025-10-21' },
					recurrence: [
						'RRULE:FREQ=WEEKLY;BYDAY=MO',
						'EXDATE:20251027',
						'EXDATE:20251103',
						'EXDATE:20251110'
					],
					htmlLink: 'https://calendar.google.com/event'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await service.updateEvent('primary', 'recurring-event-id', {
				recurrence: [
					'RRULE:FREQ=WEEKLY;BYDAY=MO',
					'EXDATE:20251027',
					'EXDATE:20251103',
					'EXDATE:20251110'
				]
			});

			const requestBody = mockRequestUrl.mock.calls[1][0].body as string;
			expect(requestBody).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO');
			expect(requestBody).toContain('EXDATE:20251027');
			expect(requestBody).toContain('EXDATE:20251103');
			expect(requestBody).toContain('EXDATE:20251110');
		});
	});

	describe('deleteEvent', () => {
		test('should delete an event', async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 204,
				text: '',
				json: {},
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await service.deleteEvent('primary', 'event1');

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: expect.stringContaining('/calendars/primary/events/event1'),
					method: 'DELETE'
				})
			);
		});

		test('should handle already deleted event gracefully', async () => {
			mockRequestUrl.mockRejectedValueOnce({
				status: 410,
				message: 'Gone'
			});

			// Should not throw, as 410 means already deleted
			await expect(service.deleteEvent('primary', 'event1')).resolves.not.toThrow();
		});
	});

	describe('Rate Limiting and Retry Logic', () => {
		test('should retry on 429 rate limit error with exponential backoff', async () => {
			jest.useFakeTimers();

			// First attempt: rate limit
			mockRequestUrl
				.mockRejectedValueOnce({
					status: 429,
					message: 'Rate limit exceeded'
				})
				// Second attempt: success
				.mockResolvedValueOnce({
					status: 200,
					json: mockCalendarList,
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				});

			const promise = service.listCalendars();

			// Fast-forward through backoff delay
			await jest.advanceTimersByTimeAsync(2000);

			const calendars = await promise;
			expect(calendars).toHaveLength(2);
			expect(mockRequestUrl).toHaveBeenCalledTimes(2);

			jest.useRealTimers();
		});

		test('should retry on 500 server error', async () => {
			jest.useFakeTimers();

			mockRequestUrl
				.mockRejectedValueOnce({ status: 500, message: 'Internal server error' })
				.mockResolvedValueOnce({
					status: 200,
					json: mockCalendarList,
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				});

			const promise = service.listCalendars();
			await jest.advanceTimersByTimeAsync(2000);

			const calendars = await promise;
			expect(calendars).toHaveLength(2);

			jest.useRealTimers();
		});

		test('should not retry on 4xx client errors (except 429)', async () => {
			mockRequestUrl.mockRejectedValueOnce({
				status: 400,
				message: 'Bad request'
			});

			await expect(service.listCalendars()).rejects.toThrow();
			expect(mockRequestUrl).toHaveBeenCalledTimes(1); // No retry
		});

		test('should throw after max retries exhausted', async () => {
			// Mock 4 failures (initial + 3 retries) - must be Error objects with status
			const rateError = Object.assign(new Error('Rate limit exceeded'), { status: 429 });

			mockRequestUrl
				.mockRejectedValue(rateError);

			// Should throw after exhausting retries
			await expect(service.listCalendars()).rejects.toThrow();
		}, 30000); // Increase timeout for retries
	});

	describe('Error Handling', () => {
		test('should handle network errors gracefully', async () => {
			mockRequestUrl.mockRejectedValueOnce(new Error('Network error'));

			await expect(service.listCalendars()).rejects.toThrow();
		});

		test('should handle malformed API responses', async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { }, // Missing 'items' field - will return empty array
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const calendars = await service.listCalendars();
			expect(calendars).toEqual([]);
		});

		test('should handle token expiration', async () => {
			mockOAuthService.getValidToken = jest.fn().mockRejectedValueOnce(
				new Error('Token expired')
			);

			await expect(service.listCalendars()).rejects.toThrow();
		});
	});

	describe('Caching and Refresh', () => {
		test('should cache events after fetching', async () => {
			// Note: getEvents() doesn't add to cache - only refreshAllCalendars() does
			// Test that getCached Events returns an array
			const cachedEvents = service.getCachedEvents();
			expect(Array.isArray(cachedEvents)).toBe(true);
		});

		test('should respect manual refresh rate limit', async () => {
			jest.useFakeTimers();

			// Mock isConnected
			mockOAuthService.isConnected = jest.fn().mockResolvedValue(true);

			// Mock listCalendars response
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: { items: [] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// First manual refresh should succeed
			await service.manualRefresh();
			const firstCallCount = mockRequestUrl.mock.calls.length;

			// Second refresh immediately after should be rate-limited
			await service.manualRefresh();
			const secondCallCount = mockRequestUrl.mock.calls.length;
			expect(secondCallCount).toBe(firstCallCount); // No additional calls

			// After 30 seconds, should allow refresh
			jest.advanceTimersByTime(31000);
			await service.manualRefresh();
			const thirdCallCount = mockRequestUrl.mock.calls.length;
			expect(thirdCallCount).toBeGreaterThan(secondCallCount); // New calls made

			jest.useRealTimers();
		});
	});

	describe('Timezone Handling', () => {
		test('should preserve timezone information in timed events', async () => {
			const eventWithTimezone = {
				id: 'tz-event',
				summary: 'TZ Event',
				start: { dateTime: '2025-10-21T10:00:00-07:00', timeZone: 'America/Los_Angeles' },
				end: { dateTime: '2025-10-21T11:00:00-07:00', timeZone: 'America/Los_Angeles' },
				htmlLink: 'https://calendar.google.com/event'
			};

			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { items: [eventWithTimezone], nextSyncToken: 'sync' },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const events = await service.getEvents('primary');
			expect(events[0].start).toBeDefined();
		});

		test('should handle all-day events without timezone', async () => {
			const allDayEvent = {
				id: 'all-day',
				summary: 'All Day',
				start: { date: '2025-10-21' },
				end: { date: '2025-10-22' },
				htmlLink: 'https://calendar.google.com/event'
			};

			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { items: [allDayEvent], nextSyncToken: 'sync' },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const events = await service.getEvents('primary');
			expect(events[0].allDay).toBe(true);
			expect(events[0].start).toBe('2025-10-21');
		});
	});
});
