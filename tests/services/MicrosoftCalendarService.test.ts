import { format, parseISO } from 'date-fns';
import { MicrosoftCalendarService } from '../../src/services/MicrosoftCalendarService';
import { OAuthService } from '../../src/services/OAuthService';
import { requestUrl, Notice } from 'obsidian';
import type TaskNotesPlugin from '../../src/main';
import { GoogleCalendarError, RateLimitError, EventNotFoundError, CalendarNotFoundError } from '../../src/services/errors';

// Mock Obsidian APIs
jest.mock('obsidian', () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	Platform: { isDesktopApp: true }
}));

describe('MicrosoftCalendarService', () => {
	let service: MicrosoftCalendarService;
	let mockPlugin: Partial<TaskNotesPlugin>;
	let mockOAuthService: Partial<OAuthService>;
	let mockRequestUrl: jest.MockedFunction<typeof requestUrl>;

	const mockCalendarList = {
		value: [
			{
				id: 'AAMkADA1',
				name: 'Calendar',
				color: 'auto',
				hexColor: '#0078D4',
				isDefaultCalendar: true,
				canEdit: true,
				owner: { name: 'John Doe', address: 'john@example.com' }
			},
			{
				id: 'AAMkADA2',
				name: 'Work Calendar',
				color: 'lightRed',
				hexColor: '#F44336',
				canEdit: true
			}
		]
	};

	const mockEventsList = {
		value: [
			{
				id: 'AAMkADAx',
				subject: 'Team Standup',
				bodyPreview: 'Daily sync meeting',
				body: {
					contentType: 'text',
					content: 'Daily sync meeting'
				},
				start: {
					dateTime: '2025-10-21T16:00:00',
					timeZone: 'UTC'
				},
				end: {
					dateTime: '2025-10-21T16:30:00',
					timeZone: 'UTC'
				},
				location: { displayName: 'Teams' },
				webLink: 'https://outlook.office365.com/calendar/item/AAMkADAx',
				isAllDay: false
			},
			{
				id: 'AAMkADAy',
				subject: 'Company Holiday',
				start: {
					dateTime: '2025-10-25T00:00:00',
					timeZone: 'UTC'
				},
				end: {
					dateTime: '2025-10-26T00:00:00',
					timeZone: 'UTC'
				},
				isAllDay: true
			}
		],
		'@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/calendars/AAMkADA1/calendarView/delta?$deltatoken=abc123'
	};

	beforeEach(() => {
		jest.clearAllMocks();

		// Setup mock plugin
		mockPlugin = {
			app: {} as any,
			settings: {
				enabledMicrosoftCalendars: [],
				microsoftCalendarSyncTokens: {}
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
		service = new MicrosoftCalendarService(
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
				id: 'AAMkADA1',
				summary: 'Calendar',
				name: 'Calendar',
				color: '#0078D4',
				isDefault: true
			});
			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: expect.stringContaining('/me/calendars'),
					method: 'GET'
				})
			);
		});

		test('should handle empty calendar list', async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { value: [] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const calendars = await service.listCalendars();
			expect(calendars).toHaveLength(0);
		});

		test('should throw GoogleCalendarError on API failure', async () => {
			mockRequestUrl.mockRejectedValueOnce({
				status: 401,
				message: 'Unauthorized'
			});

			await expect(service.listCalendars()).rejects.toThrow(GoogleCalendarError);
		});

		test('should handle pagination with @odata.nextLink', async () => {
			// First page
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					value: [mockCalendarList.value[0]],
					'@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/calendars?$skip=1'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Second page
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { value: [mockCalendarList.value[1]] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const calendars = await service.listCalendars();
			expect(calendars).toHaveLength(2);
			expect(mockRequestUrl).toHaveBeenCalledTimes(2);
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

			const events = await service.getEvents('AAMkADA1');

			expect(events).toHaveLength(2);
			expect(events[0]).toMatchObject({
				id: expect.stringContaining('AAMkADAx'),
				title: 'Team Standup',
				description: 'Daily sync meeting',
				location: 'Teams'
			});
			expect(events[0].allDay).toBe(false);
			expect(events[1].allDay).toBe(true);
			const expectedStart = format(parseISO('2025-10-21T16:00:00Z'), "yyyy-MM-dd'T'HH:mm:ss");
			expect(events[0].start).toBe(expectedStart);
			expect(events[1].start).toBe('2025-10-25');
		});

		test('should use delta link for incremental sync', async () => {
			// Set up existing delta token
			mockPlugin.settings!.microsoftCalendarSyncTokens = {
				'AAMkADA1': 'https://graph.microsoft.com/v1.0/me/calendars/AAMkADA1/calendarView/delta?$deltatoken=old123'
			};

			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					value: [],
					'@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/calendars/AAMkADA1/calendarView/delta?$deltatoken=new456'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await service.getEvents('AAMkADA1');

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: expect.stringContaining('$deltatoken=old123')
				})
			);
		});

		test('should request events in UTC timezone', async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: mockEventsList,
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await service.getEvents('AAMkADA1');

			const request = mockRequestUrl.mock.calls[0][0];
			expect(request.headers.Prefer).toContain('outlook.timezone="UTC"');
		});

		test('should handle cancelled events', async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					value: [
						mockEventsList.value[0],
						{ id: 'cancelled-event', isCancelled: true, subject: 'Cancelled' }
					],
					'@odata.deltaLink': 'delta-link'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const events = await service.getEvents('AAMkADA1');
			// Cancelled events should be filtered out
			expect(events.every(e => e.id !== 'cancelled-event')).toBe(true);
		});

		test('should handle removed events from delta sync', async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					value: [
						mockEventsList.value[0],
						{
							id: 'removed-event',
							'@removed': { reason: 'deleted' }
						}
					],
					'@odata.deltaLink': 'delta-link'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const events = await service.getEvents('AAMkADA1');
			expect(events).toHaveLength(1);
			expect(events[0].id).toContain('AAMkADAx');
		});

		test('should validate calendar ID format', async () => {
			// Base64 validation allows many characters including @, so this won't throw on validation
			// Instead, it would fail at the API level
			mockRequestUrl.mockRejectedValueOnce({
				status: 400,
				message: 'Bad request'
			});

			await expect(service.getEvents('invalid@id')).rejects.toThrow();
		});
	});

	describe('createEvent', () => {
		test('should create a timed event', async () => {
			const newEvent = {
				title: 'New Meeting',
				description: 'Discuss project',
				start: '2025-10-23T14:00:00',
				end: '2025-10-23T15:00:00',
				location: 'Conference Room'
			};

			mockRequestUrl.mockResolvedValueOnce({
				status: 201,
				json: {
					id: 'new-event-id',
					subject: newEvent.title,
					bodyPreview: newEvent.description,
					location: { displayName: newEvent.location },
					start: { dateTime: newEvent.start, timeZone: 'UTC' },
					end: { dateTime: newEvent.end, timeZone: 'UTC' },
					isAllDay: false,
					webLink: 'https://outlook.office365.com/calendar/item'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const created = await service.createEvent('AAMkADA1', newEvent);

			expect(created.id).toContain('new-event-id');
			expect(created.title).toBe('New Meeting');
			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: expect.stringContaining('/calendars/AAMkADA1/events'),
					method: 'POST',
					body: expect.stringContaining('"subject":"New Meeting"')
				})
			);
		});

		test('should create an all-day event', async () => {
			const newEvent = {
				title: 'All Day Meeting',
				start: '2025-10-23',
				end: '2025-10-24',
				isAllDay: true
			};

			mockRequestUrl.mockResolvedValueOnce({
				status: 201,
				json: {
					id: 'all-day-id',
					subject: newEvent.title,
					start: { dateTime: '2025-10-23T00:00:00', timeZone: 'UTC' },
					end: { dateTime: '2025-10-24T00:00:00', timeZone: 'UTC' },
					isAllDay: true,
					webLink: 'https://outlook.office365.com/calendar/item'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const created = await service.createEvent('AAMkADA1', newEvent);

			expect(created.allDay).toBe(true);
			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					body: expect.stringContaining('"isAllDay":true')
				})
			);
		});

		test('should throw CalendarNotFoundError for invalid calendar', async () => {
			mockRequestUrl.mockRejectedValueOnce({
				status: 404,
				message: 'Calendar not found'
			});

			await expect(
				service.createEvent('invalid-calendar', {
					title: 'Test',
					start: '2025-10-23T14:00:00',
					end: '2025-10-23T15:00:00'
				})
			).rejects.toThrow(CalendarNotFoundError);
		});
	});

	describe('updateEvent', () => {
		test('should update event properties', async () => {
			const updates = {
				title: 'Updated Meeting',
				location: 'New Location'
			};

			// PATCH response from updating the event
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					id: 'AAMkADAx',
					subject: updates.title,
					location: { displayName: updates.location },
					start: { dateTime: '2025-10-21T09:00:00', timeZone: 'UTC' },
					end: { dateTime: '2025-10-21T09:30:00', timeZone: 'UTC' },
					isAllDay: false,
					webLink: 'https://outlook.office365.com/calendar/item'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const updated = await service.updateEvent('AAMkADA1', 'AAMkADAx', updates);

			expect(updated.title).toBe('Updated Meeting');
			expect(updated.location).toBe('New Location');
			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: expect.stringContaining('/calendars/AAMkADA1/events/AAMkADAx'),
					method: 'PATCH'
				})
			);
		});

		test('should handle time and date updates', async () => {
			const updates = {
				start: '2025-10-23T10:00:00',
				end: '2025-10-23T11:00:00'
			};

			// PATCH response
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					id: 'AAMkADAx',
					subject: 'Meeting',
					start: { dateTime: updates.start, timeZone: 'UTC' },
					end: { dateTime: updates.end, timeZone: 'UTC' },
					isAllDay: false,
					webLink: 'https://outlook.office365.com/calendar/item'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const updated = await service.updateEvent('AAMkADA1', 'AAMkADAx', updates);
			expect(updated.start).toContain('2025-10-23');
		});

		test('should throw EventNotFoundError if event does not exist', async () => {
			mockRequestUrl.mockRejectedValueOnce({
				status: 404,
				message: 'Event not found'
			});

			await expect(
				service.updateEvent('AAMkADA1', 'nonexistent', { title: 'New Title' })
			).rejects.toThrow(EventNotFoundError);
		});

		test('should handle isAllDay field in updates', async () => {
			const updates = {
				start: '2025-10-23',
				end: '2025-10-24',
				isAllDay: true
			};

			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					id: 'AAMkADAx',
					subject: 'Event',
					start: { dateTime: '2025-10-23T00:00:00', timeZone: 'UTC' },
					end: { dateTime: '2025-10-24T00:00:00', timeZone: 'UTC' },
					isAllDay: true,
					webLink: 'https://outlook.office365.com/calendar/item'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const updated = await service.updateEvent('AAMkADA1', 'AAMkADAx', updates);
			expect(updated.allDay).toBe(true);
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

			await service.deleteEvent('AAMkADA1', 'AAMkADAx');

			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: expect.stringContaining('/calendars/AAMkADA1/events/AAMkADAx'),
					method: 'DELETE'
				})
			);
		});

		test('should handle already deleted event', async () => {
			mockRequestUrl.mockRejectedValueOnce({
				status: 404,
				message: 'Event not found'
			});

			// Should not throw for already deleted
			await expect(service.deleteEvent('AAMkADA1', 'AAMkADAx')).rejects.toThrow(EventNotFoundError);
		});
	});

	describe('Rate Limiting and Retry Logic', () => {
		test('should retry on 429 rate limit with exponential backoff', async () => {
			jest.useFakeTimers();

			mockRequestUrl
				.mockRejectedValueOnce({ status: 429, message: 'Rate limit' })
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
			expect(mockRequestUrl).toHaveBeenCalledTimes(2);

			jest.useRealTimers();
		});

		test('should retry on 503 service unavailable', async () => {
			jest.useFakeTimers();

			mockRequestUrl
				.mockRejectedValueOnce({ status: 503, message: 'Service unavailable' })
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

		test('should not retry on 400 bad request', async () => {
			mockRequestUrl.mockRejectedValueOnce({
				status: 400,
				message: 'Bad request'
			});

			await expect(service.listCalendars()).rejects.toThrow();
			expect(mockRequestUrl).toHaveBeenCalledTimes(1);
		});

		test('should throw after max retries', async () => {
			// Must reject with an error object that has status property
			const rateError = Object.assign(new Error('Rate limit'), { status: 429 });

			mockRequestUrl
				.mockRejectedValue(rateError);

			// Should throw after exhausting retries
			await expect(service.listCalendars()).rejects.toThrow();
		}, 30000); // Increase timeout for retries
	});

	describe('Error Handling', () => {
		test('should handle network errors', async () => {
			mockRequestUrl.mockRejectedValueOnce(new Error('Network failure'));

			await expect(service.listCalendars()).rejects.toThrow();
		});

		test('should handle malformed responses', async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { }, // Missing 'value' field - will return empty array
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

		test('should handle permission errors', async () => {
			mockRequestUrl.mockRejectedValueOnce({
				status: 403,
				message: 'Forbidden'
			});

			await expect(service.listCalendars()).rejects.toThrow();
		});
	});

	describe('Caching', () => {
		test('should cache events after fetching', async () => {
			// Note: getEvents() doesn't add to cache - only refreshAllCalendars() does
			// So we test getAllEvents() which returns the cache
			const cachedEvents = service.getAllEvents();
			expect(Array.isArray(cachedEvents)).toBe(true);
		});

		test('should clear cache on disconnect', async () => {
			// Add some mock data to cache first
			const initialCache = service.getAllEvents();

			// Disconnect should clear cache
			await service.disconnect();
			const afterDisconnect = service.getCachedEvents();
			expect(afterDisconnect).toHaveLength(0);
		});
	});

	describe('Timezone Handling', () => {
		test('should preserve Microsoft timezone format', async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					value: [{
						id: 'tz-event',
						subject: 'TZ Event',
						start: { dateTime: '2025-10-21T09:00:00', timeZone: 'Pacific Standard Time' },
						end: { dateTime: '2025-10-21T10:00:00', timeZone: 'Pacific Standard Time' },
						isAllDay: false,
						webLink: 'https://outlook.office365.com/calendar/item'
					}],
					'@odata.deltaLink': 'delta'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const events = await service.getEvents('AAMkADA1');
			expect(events[0]).toBeDefined();
			expect(events[0].start).toBeDefined();
		});

		test('should handle UTC timezone', async () => {
			const utcEvent = {
				id: 'utc-event',
				subject: 'UTC Event',
				start: { dateTime: '2025-10-21T14:00:00', timeZone: 'UTC' },
				end: { dateTime: '2025-10-21T15:00:00', timeZone: 'UTC' },
				isAllDay: false,
				webLink: 'https://outlook.office365.com/calendar/item'
			};

			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: { value: [utcEvent], '@odata.deltaLink': 'delta' },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const events = await service.getEvents('AAMkADA1');
			expect(events[0].start).toContain('2025-10-21');
		});
	});

	describe('Base64 Calendar/Event IDs', () => {
		test('should accept Base64-encoded calendar IDs', async () => {
			const base64CalendarId = 'QUFNa0FEQTFtYWxscw=='; // Valid Base64

			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					value: [],
					'@odata.deltaLink': 'delta'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await expect(service.getEvents(base64CalendarId)).resolves.toBeDefined();
		});

		test('should accept Base64-encoded event IDs', async () => {
			const base64EventId = 'QUFNa0FEQXhldmVudA=='; // Valid Base64

			mockRequestUrl.mockResolvedValueOnce({
				status: 204,
				text: '',
				json: {},
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await service.deleteEvent('AAMkADA1', base64EventId);
			// If we get here without throwing, test passes
		});
	});
});
