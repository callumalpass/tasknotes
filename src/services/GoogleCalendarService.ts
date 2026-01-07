/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { requestUrl, Notice } from "obsidian";
import TaskNotesPlugin from "../main";
import { OAuthService } from "./OAuthService";
import { GoogleCalendarEvent, ICSEvent } from "../types";
import { GOOGLE_CALENDAR_CONSTANTS } from "./constants";
import { GoogleCalendarError, EventNotFoundError, CalendarNotFoundError, RateLimitError, TokenExpiredError } from "./errors";
import { validateCalendarId, validateEventId, validateRequired } from "./validation";
import { CalendarProvider, ProviderCalendar } from "./CalendarProvider";

/**
 * Google Calendar color palette mapping
 * These are the standard Google Calendar event colors
 */
const GOOGLE_CALENDAR_COLORS: Record<string, string> = {
	"1": "#a4bdfc", // Lavender
	"2": "#7ae7bf", // Sage
	"3": "#dbadff", // Grape
	"4": "#ff887c", // Flamingo
	"5": "#fbd75b", // Banana
	"6": "#ffb878", // Tangerine
	"7": "#46d6db", // Peacock
	"8": "#e1e1e1", // Graphite
	"9": "#5484ed", // Blueberry
	"10": "#51b749", // Basil
	"11": "#dc2127", // Tomato
};

/**
 * GoogleCalendarService handles Google Calendar API interactions.
 * Uses OAuth for authentication and provides calendar event access.
 * Implements the CalendarProvider interface for abstraction.
 */
export class GoogleCalendarService extends CalendarProvider {
	readonly providerId = "google";
	readonly providerName = "Google Calendar";
	private plugin: TaskNotesPlugin;
	private oauthService: OAuthService;
	private baseUrl = "https://www.googleapis.com/calendar/v3";
	private cache: Map<string, ICSEvent[]> = new Map();
	private refreshTimer: ReturnType<typeof setTimeout> | null = null;
	private availableCalendars: ProviderCalendar[] = [];
	private calendarColors: Map<string, string> = new Map(); // Map calendar ID to color
	private lastManualRefresh = 0; // Timestamp of last manual refresh for rate limiting

	constructor(plugin: TaskNotesPlugin, oauthService: OAuthService) {
		super();
		this.plugin = plugin;
		this.oauthService = oauthService;
	}

	/**
	 * Sleep helper for exponential backoff
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Executes an API call with exponential backoff retry on rate limit errors
	 * Implements retry logic for 429 (rate limit) and 5xx (server) errors
	 */
	private async withRetry<T>(
		fn: () => Promise<T>,
		context: string
	): Promise<T> {
		const { MAX_RETRIES, INITIAL_BACKOFF_MS, MAX_BACKOFF_MS, BACKOFF_MULTIPLIER } =
			GOOGLE_CALENDAR_CONSTANTS.RATE_LIMIT;

		let lastError: Error | null = null;
		let backoffMs: number = INITIAL_BACKOFF_MS;

		for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
			try {
				return await fn();
			} catch (error) {
				lastError = error;

				// Check if this is a retryable error
				const isRateLimitError = error.status === 429;
				const isServerError = error.status >= 500 && error.status < 600;
				const isLastAttempt = attempt === MAX_RETRIES;

				if (!isRateLimitError && !isServerError) {
					// Non-retryable error (4xx except 429) - throw immediately
					throw error;
				}

				if (isLastAttempt) {
					// Max retries exhausted - throw
					console.error(`[GoogleCalendar] ${context} failed after ${MAX_RETRIES} retries`);
					throw error;
				}

				// Apply exponential backoff with jitter
				const jitter = Math.random() * 0.3 * backoffMs; // 0-30% jitter
				const delay = Math.min(backoffMs + jitter, MAX_BACKOFF_MS);

				console.warn(
					`[GoogleCalendar] ${context} failed (${error.status}), ` +
					`retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
				);

				await this.sleep(delay);

				// Increase backoff for next iteration
				backoffMs = Math.min(backoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
			}
		}

		// Should never reach here, but TypeScript needs it
		throw lastError;
	}

	/**
	 * Gets the list of available Google Calendars
	 */
	getAvailableCalendars(): ProviderCalendar[] {
		return this.availableCalendars;
	}

	/**
	 * Gets the list of enabled calendar IDs from settings
	 */
	private getEnabledCalendarIds(): string[] {
		// If empty, show all calendars
		if (this.plugin.settings.enabledGoogleCalendars.length === 0) {
			return this.availableCalendars.map(cal => cal.id);
		}
		return this.plugin.settings.enabledGoogleCalendars;
	}

	/**
	 * Gets the sync token for a calendar from settings
	 */
	private getSyncToken(calendarId: string): string | undefined {
		return this.plugin.settings.googleCalendarSyncTokens[calendarId];
	}

	/**
	 * Saves a sync token for a calendar to settings
	 */
	private async saveSyncToken(calendarId: string, syncToken: string): Promise<void> {
		this.plugin.settings.googleCalendarSyncTokens[calendarId] = syncToken;
		await this.plugin.saveSettings();
	}

	/**
	 * Clears the sync token for a calendar (forces full resync)
	 */
	private async clearSyncToken(calendarId: string): Promise<void> {
		delete this.plugin.settings.googleCalendarSyncTokens[calendarId];
		await this.plugin.saveSettings();
	}

	async initialize(): Promise<void> {
		// Check if connected
		const isConnected = await this.oauthService.isConnected("google");
		if (isConnected) {
			// Fetch initial data
			await this.refreshAllCalendars();

			// Set up periodic refresh (every 15 minutes)
			this.startRefreshTimer();
		}
	}

	/**
	 * Starts periodic refresh timer
	 */
	private startRefreshTimer(): void {
		if (this.refreshTimer) {
			clearInterval(this.refreshTimer);
		}

		// Refresh every 15 minutes
		this.refreshTimer = setInterval(() => {
			this.refreshAllCalendars().catch(error => {
				console.error("Google Calendar refresh failed:", error);
			});
		}, GOOGLE_CALENDAR_CONSTANTS.REFRESH_INTERVAL_MS);
	}

	/**
	 * Stops the refresh timer
	 */
	private stopRefreshTimer(): void {
		if (this.refreshTimer) {
			clearInterval(this.refreshTimer);
			this.refreshTimer = null;
		}
	}

	/**
	 * Fetches list of user's calendars and stores their colors
	 */
	async listCalendars(): Promise<ProviderCalendar[]> {
		try {
			return await this.withRetry(async () => {
				const token = await this.oauthService.getValidToken("google");

				const response = await requestUrl({
					url: `${this.baseUrl}/users/me/calendarList`,
					method: "GET",
					headers: {
						"Authorization": `Bearer ${token}`,
						"Accept": "application/json"
					}
				});

				const data = response.json;
				const calendars = data.items || [];

				// Store calendar colors for later use and convert to ProviderCalendar format
				const providerCalendars: ProviderCalendar[] = [];
				for (const calendar of calendars) {
					if (calendar.backgroundColor) {
						this.calendarColors.set(calendar.id, calendar.backgroundColor);
					}
					providerCalendars.push({
						id: calendar.id,
						summary: calendar.summary,
						description: calendar.description,
						backgroundColor: calendar.backgroundColor,
						primary: calendar.primary || false
					});
				}

				return providerCalendars;
			}, "List calendars");
		} catch (error) {
			console.error("Failed to list calendars:", error);
			throw new GoogleCalendarError(`Failed to fetch calendar list: ${error.message}`, error.status);
		}
	}

	/**
	 * Fetches events from a specific calendar using incremental sync when possible
	 * @returns Object containing events, whether this was a full sync, and if there were deletions
	 */
	async fetchCalendarEvents(
		calendarId: string,
		timeMin?: Date,
		timeMax?: Date
	): Promise<{
		events: GoogleCalendarEvent[];
		isFullSync: boolean;
		hasDeletes: boolean;
	}> {
		try {
			const token = await this.oauthService.getValidToken("google");
			const syncToken = this.getSyncToken(calendarId);

			let allEvents: GoogleCalendarEvent[] = [];
			let nextPageToken: string | undefined;
			let nextSyncToken: string | undefined;
			let isFullSync = !syncToken;
			let hasDeletes = false;

			do {
				try {
					const params = new URLSearchParams({
						singleEvents: "true", // Expand recurring events
						maxResults: GOOGLE_CALENDAR_CONSTANTS.MAX_RESULTS_PER_REQUEST.toString()
					});

					if (syncToken && !nextPageToken) {
						// Incremental sync mode - use syncToken
						// NOTE: Cannot use timeMin/timeMax with syncToken
						params.set("syncToken", syncToken);
					} else if (nextPageToken) {
						// Pagination mode - use pageToken
						params.set("pageToken", nextPageToken);
					} else {
						// Full sync mode - use time range and orderBy
						const now = new Date();
						const defaultTimeMin = timeMin || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
						const defaultTimeMax = timeMax || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
						params.set("timeMin", defaultTimeMin.toISOString());
						params.set("timeMax", defaultTimeMax.toISOString());
						params.set("orderBy", "startTime");
					}

					// Wrap the API call with retry logic
					const response = await this.withRetry(async () => {
						return await requestUrl({
							url: `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
							method: "GET",
							headers: {
								"Authorization": `Bearer ${token}`,
								"Accept": "application/json"
							}
						});
					}, `Fetch events for ${calendarId}`);

					const data = response.json;
					const items = data.items || [];

					// Check for deleted events (status === "cancelled")
					if (!isFullSync && items.some((event: GoogleCalendarEvent) => event.status === "cancelled")) {
						hasDeletes = true;
					}

					allEvents.push(...items);
					nextPageToken = data.nextPageToken;

					// Store syncToken when available (only on last page)
					if (data.nextSyncToken) {
						nextSyncToken = data.nextSyncToken;
					}

				} catch (error) {
					// Check if syncToken expired (HTTP 410)
					if (error.status === 410) {
						await this.clearSyncToken(calendarId);
						// Retry with full sync
						return await this.fetchCalendarEvents(calendarId, timeMin, timeMax);
					}
					throw error;
				}
			} while (nextPageToken);

			// Save the new sync token
			if (nextSyncToken) {
				await this.saveSyncToken(calendarId, nextSyncToken);
			}

			return {
				events: allEvents,
				isFullSync,
				hasDeletes
			};

		} catch (error) {
			console.error(`Failed to fetch events from calendar ${calendarId}:`, error);
			throw new Error(`Failed to fetch calendar events: ${error.message}`);
		}
	}

	/**
	 * Converts a Google Calendar event to TaskNotes ICSEvent format
	 */
	private convertToICSEvent(googleEvent: GoogleCalendarEvent, calendarId: string): ICSEvent {
		// Determine start and end times
		let start: string;
		let end: string | undefined;
		let allDay: boolean;

		if (googleEvent.start.date) {
			// All-day event
			start = googleEvent.start.date; // YYYY-MM-DD format
			end = googleEvent.end?.date;
			allDay = true;
		} else {
			// Timed event - parse and convert to local time without timezone offset
			// FullCalendar expects YYYY-MM-DDTHH:mm:ss format (no timezone) for timed events
			const startDate = new Date(googleEvent.start.dateTime!);
			const endDate = googleEvent.end?.dateTime ? new Date(googleEvent.end.dateTime) : undefined;

			// Format as YYYY-MM-DDTHH:mm:ss (local time, no timezone offset)
			const { format } = require("date-fns");
			start = format(startDate, "yyyy-MM-dd'T'HH:mm:ss");
			end = endDate ? format(endDate, "yyyy-MM-dd'T'HH:mm:ss") : undefined;
			allDay = false;
		}

		// Determine color for the event
		let color: string | undefined;

		// Priority 1: Event-specific color (if colorId is set on the event)
		if (googleEvent.colorId) {
			color = GOOGLE_CALENDAR_COLORS[googleEvent.colorId];
		}

		// Priority 2: Calendar-level color (from calendar metadata)
		if (!color) {
			color = this.calendarColors.get(calendarId);
		}

		// Priority 3: Default Google Calendar blue
		if (!color) {
			color = "#4285F4";
		}

		return {
			id: `google-${calendarId}-${googleEvent.id}`,
			subscriptionId: `google-${calendarId}`,
			title: googleEvent.summary || "Untitled Event",
			description: googleEvent.description,
			start: start,
			end: end,
			allDay: allDay,
			location: googleEvent.location,
			url: googleEvent.htmlLink,
			color: color
		};
	}

	/**
	 * Refreshes all enabled Google calendars using incremental sync when possible
	 */
	async refreshAllCalendars(): Promise<void> {
		try {
			const isConnected = await this.oauthService.isConnected("google");
			if (!isConnected) {
				return;
			}

			// Get list of calendars and store them
			this.availableCalendars = await this.listCalendars();

			// Get enabled calendar IDs from settings
			const enabledCalendarIds = this.getEnabledCalendarIds();

			// Get current cached events
			let cachedEvents = this.cache.get("all") || [];

			// Fetch events from each enabled calendar
			for (const calendarId of enabledCalendarIds) {
				try {
					const { events: googleEvents, isFullSync } = await this.fetchCalendarEvents(calendarId);


					if (isFullSync) {
						// Full sync: Replace all events from this calendar
						// Remove old events from this calendar
						cachedEvents = cachedEvents.filter(
							event => event.subscriptionId !== `google-${calendarId}`
						);

						// Add new events from this calendar (filter out cancelled events)
						const icsEvents = googleEvents
							.filter(event => event.status !== "cancelled")
							.map(event => this.convertToICSEvent(event, calendarId));

						cachedEvents.push(...icsEvents);
					} else {
						// Incremental sync: Update cache with changes
						for (const googleEvent of googleEvents) {
							const eventId = `google-${calendarId}-${googleEvent.id}`;
							const existingIndex = cachedEvents.findIndex(e => e.id === eventId);

							if (googleEvent.status === "cancelled") {
								// Event was deleted
								if (existingIndex !== -1) {
									cachedEvents.splice(existingIndex, 1);
								}
							} else {
								// Event was added or updated
								const icsEvent = this.convertToICSEvent(googleEvent, calendarId);

								if (existingIndex !== -1) {
									// Update existing event
									cachedEvents[existingIndex] = icsEvent;
								} else {
									// Add new event
									cachedEvents.push(icsEvent);
								}
							}
						}

					}
				} catch (error) {
					console.error(`Failed to fetch events from calendar ${calendarId}:`, error);
					// Continue with other calendars
				}
			}

			// Update cache
			this.cache.set("all", cachedEvents);

			// Emit data-changed event
			this.emit("data-changed");

		} catch (error) {
			console.error("Failed to refresh Google calendars:", error);

			// If it's an auth error, show notice to reconnect
			if (error.message && error.message.includes("401")) {
				console.warn("[GoogleCalendar] Authentication expired - caller should handle re-authentication");
			}
		}
	}

	/**
	 * Gets all cached events
	 */
	getAllEvents(): ICSEvent[] {
		const events = this.cache.get("all") || [];
		return events;
	}

	/**
	 * Alias for getAllEvents() - for test compatibility
	 */
	getCachedEvents(): ICSEvent[] {
		return this.getAllEvents();
	}

	/**
	 * Gets events for a specific calendar (wrapper for fetchCalendarEvents)
	 * Returns just the events array for easier consumption
	 */
	async getEvents(calendarId: string, timeMin?: Date, timeMax?: Date): Promise<ICSEvent[]> {
		const { events } = await this.fetchCalendarEvents(calendarId, timeMin, timeMax);
		// Convert to ICS events
		return events
			.filter(event => event.status !== "cancelled")
			.map(event => this.convertToICSEvent(event, calendarId));
	}

	/**
	 * Alias for refresh() - for test compatibility
	 */
	async manualRefresh(): Promise<void> {
		return this.refresh();
	}

	/**
	 * Manually triggers a refresh
	 * Rate-limited to prevent API abuse
	 */
	async refresh(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRefresh = now - this.lastManualRefresh;
		const minInterval = GOOGLE_CALENDAR_CONSTANTS.MIN_MANUAL_REFRESH_INTERVAL_MS;

		if (timeSinceLastRefresh < minInterval) {
			const remainingMs = minInterval - timeSinceLastRefresh;
			new Notice(`Please wait ${Math.ceil(remainingMs / 1000)}s before refreshing again`);
			return;
		}

		this.lastManualRefresh = now;
		await this.refreshAllCalendars();
	}

	/**
	 * Clears the cache
	 */
	clearCache(): void {
		this.cache.clear();
	}

	/**
	 * Updates a Google Calendar event (for moving or resizing events)
	 * Returns the updated event as ICSEvent for test compatibility
	 */
	async updateEvent(
		calendarId: string,
		eventId: string,
		updates: {
			title?: string;
			summary?: string;
			description?: string;
			start?: string | { dateTime?: string; date?: string; timeZone?: string };
			end?: string | { dateTime?: string; date?: string; timeZone?: string };
			location?: string;
			isAllDay?: boolean;
			reminders?: {
				useDefault: boolean;
				overrides?: Array<{ method: string; minutes: number }>;
			};
			colorId?: string;
			recurrence?: string[];
		}
	): Promise<ICSEvent> {
		// Validate inputs
		validateCalendarId(calendarId);
		validateEventId(eventId);
		validateRequired(updates, "updates");

		try {
			const token = await this.oauthService.getValidToken("google");

			// First, get the current event to merge with updates
			const getResponse = await this.withRetry(async () => {
				return await requestUrl({
					url: `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
					method: "GET",
					headers: {
						"Authorization": `Bearer ${token}`,
						"Accept": "application/json"
					}
				});
			}, `Get event ${eventId}`);

			const currentEvent = getResponse.json;

			// Build update payload
			const payload: any = { ...currentEvent };

			// Support both 'title' and 'summary'
			if (updates.title !== undefined || updates.summary !== undefined) {
				payload.summary = updates.summary || updates.title;
			}
			if (updates.description !== undefined) {
				payload.description = updates.description;
			}
			if (updates.location !== undefined) {
				payload.location = updates.location;
			}
			if (updates.reminders !== undefined) {
				payload.reminders = updates.reminders;
			}
			if (updates.colorId !== undefined) {
				payload.colorId = updates.colorId;
			}
			if (updates.recurrence !== undefined) {
				payload.recurrence = updates.recurrence;
			}

			// Handle start/end updates
			if (updates.start !== undefined) {
				if (typeof updates.start === 'string') {
					const isAllDay = updates.isAllDay || !/T/.test(updates.start);
					if (isAllDay) {
						payload.start = { date: updates.start };
					} else {
						payload.start = { dateTime: updates.start, timeZone: 'UTC' };
					}
				} else {
					payload.start = updates.start;
				}
			}

			if (updates.end !== undefined) {
				if (typeof updates.end === 'string') {
					const isAllDay = updates.isAllDay || !/T/.test(updates.end as string);
					if (isAllDay) {
						payload.end = { date: updates.end };
					} else {
						payload.end = { dateTime: updates.end, timeZone: 'UTC' };
					}
				} else {
					payload.end = updates.end;
				}
			}

			// Clean up format conversion: ensure only one date format exists in start/end
			if (payload.start) {
				if (payload.start.date) {
					delete payload.start.dateTime;
					delete payload.start.timeZone;
				} else if (payload.start.dateTime) {
					delete payload.start.date;
				}
			}

			if (payload.end) {
				if (payload.end.date) {
					delete payload.end.dateTime;
					delete payload.end.timeZone;
				} else if (payload.end.dateTime) {
					delete payload.end.date;
				}
			}

			// Update the event with retry logic
			const updateResponse = await this.withRetry(async () => {
				return await requestUrl({
					url: `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
					method: "PUT",
					headers: {
						"Authorization": `Bearer ${token}`,
						"Content-Type": "application/json",
						"Accept": "application/json"
					},
					body: JSON.stringify(payload)
				});
			}, `Update event ${eventId}`);

			const updatedEvent = updateResponse.json;

			// Convert to ICSEvent for return
			const icsEvent = this.convertToICSEvent(updatedEvent, calendarId);

			// Refresh events after update
			await this.refreshAllCalendars();

			return icsEvent;

		} catch (error) {
			console.error("Failed to update Google Calendar event:", error);
			// Check for specific error types
			if (error.status === 404) {
				throw new EventNotFoundError(eventId);
			}
			if (error.status === 401 || error.status === 403) {
				throw new TokenExpiredError("google");
			}
			if (error.status === 429) {
				throw new RateLimitError();
			}
			throw new GoogleCalendarError(`Failed to update event: ${error.message}`, error.status);
		}
	}

	/**
	 * Creates a new Google Calendar event
	 * For tests, accepts simplified event format and returns ICSEvent
	 */
	async createEvent(
		calendarId: string,
		event: {
			title?: string;
			summary?: string;
			description?: string;
			start: string | { dateTime?: string; date?: string; timeZone?: string };
			end: string | { dateTime?: string; date?: string; timeZone?: string };
			location?: string;
			isAllDay?: boolean;
			reminders?: {
				useDefault: boolean;
				overrides?: Array<{ method: string; minutes: number }>;
			};
			colorId?: string;
			recurrence?: string[];
		}
	): Promise<ICSEvent> {
		// Validate inputs
		validateCalendarId(calendarId);
		validateRequired(event, "event");

		// Support both 'title' and 'summary' for test compatibility
		const summary = event.summary || event.title;
		validateRequired(summary, "event.summary");
		validateRequired(event.start, "event.start");
		validateRequired(event.end, "event.end");

		try {
			const token = await this.oauthService.getValidToken("google");

			// Build Google Calendar API payload
			const payload: any = {
				summary: summary,
				description: event.description,
				location: event.location
			};

			// Add reminders if provided
			if (event.reminders) {
				payload.reminders = event.reminders;
			}

			// Add color if provided
			if (event.colorId) {
				payload.colorId = event.colorId;
			}

			// Add recurrence rules if provided (for recurring events)
			if (event.recurrence && event.recurrence.length > 0) {
				payload.recurrence = event.recurrence;
			}

			// Handle start/end - could be string or object
			if (typeof event.start === 'string') {
				// Determine if all-day based on format (YYYY-MM-DD vs YYYY-MM-DDTHH:mm:ss)
				const isAllDay = event.isAllDay || !/T/.test(event.start);
				if (isAllDay) {
					payload.start = { date: event.start };
					payload.end = { date: event.end as string };
				} else {
					payload.start = { dateTime: event.start, timeZone: 'UTC' };
					payload.end = { dateTime: event.end as string, timeZone: 'UTC' };
				}
			} else {
				payload.start = event.start;
				payload.end = event.end;
			}

			const response = await this.withRetry(async () => {
				return await requestUrl({
					url: `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events`,
					method: "POST",
					headers: {
						"Authorization": `Bearer ${token}`,
						"Content-Type": "application/json",
						"Accept": "application/json"
					},
					body: JSON.stringify(payload)
				});
			}, `Create event in ${calendarId}`);

			const createdEvent = response.json;

			// Convert to ICSEvent for return
			const icsEvent = this.convertToICSEvent(createdEvent, calendarId);

			// Refresh events after creation
			await this.refreshAllCalendars();

			return icsEvent;

		} catch (error) {
			console.error("Failed to create Google Calendar event:", error);
			if (error.status === 404) {
				throw new CalendarNotFoundError(calendarId);
			}
			if (error.status === 401 || error.status === 403) {
				throw new TokenExpiredError("google");
			}
			if (error.status === 429) {
				throw new RateLimitError();
			}
			throw new GoogleCalendarError(`Failed to create event: ${error.message}`, error.status);
		}
	}

	/**
	 * Deletes a Google Calendar event
	 */
	async deleteEvent(calendarId: string, eventId: string): Promise<void> {
		// Validate inputs
		validateCalendarId(calendarId);
		validateEventId(eventId);

		try {
			const token = await this.oauthService.getValidToken("google");

			await this.withRetry(async () => {
				return await requestUrl({
					url: `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
					method: "DELETE",
					headers: {
						"Authorization": `Bearer ${token}`
					}
				});
			}, `Delete event ${eventId}`);

			// Refresh events after deletion
			await this.refreshAllCalendars();

		} catch (error) {
			// 410 Gone means event was already deleted - treat as success
			if (error.status === 410) {
				return;
			}

			console.error("Failed to delete Google Calendar event:", error);
			if (error.status === 404) {
				throw new EventNotFoundError(eventId);
			}
			if (error.status === 401 || error.status === 403) {
				throw new TokenExpiredError("google");
			}
			if (error.status === 429) {
				throw new RateLimitError();
			}
			throw new GoogleCalendarError(`Failed to delete event: ${error.message}`, error.status);
		}
	}

	/**
	 * Creates a new calendar in Google Calendar
	 */
	async createCalendar(summary: string, description?: string): Promise<string> {
		try {
			const token = await this.oauthService.getValidToken("google");

			const response = await this.withRetry(async () => {
				return await requestUrl({
					url: `${this.baseUrl}/calendars`,
					method: "POST",
					headers: {
						"Authorization": `Bearer ${token}`,
						"Content-Type": "application/json",
						"Accept": "application/json"
					},
					body: JSON.stringify({
						summary,
						description,
						timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
					})
				});
			}, "Create calendar");

			const calendar = response.json;

			// Refresh calendar list
			this.availableCalendars = await this.listCalendars();


			return calendar.id;

		} catch (error) {
			console.error("Failed to create calendar:", error);
			if (error.status === 401 || error.status === 403) {
				throw new TokenExpiredError("google");
			}
			if (error.status === 429) {
				throw new RateLimitError();
			}
			throw new GoogleCalendarError(`Failed to create calendar: ${error.message}`, error.status);
		}
	}

	/**
	 * Cleanup method
	 */
	destroy(): void {
		this.stopRefreshTimer();
		this.cache.clear();
		this.removeAllListeners();
	}
}
