import { requestUrl, Notice } from "obsidian";
import TaskNotesPlugin from "../main";
import { OAuthService } from "./OAuthService";
import { ICSEvent, OAuthProvider } from "../types";
import { MICROSOFT_CALENDAR_CONSTANTS } from "./constants";
import { GoogleCalendarError, EventNotFoundError, CalendarNotFoundError, RateLimitError, NetworkError, TokenExpiredError } from "./errors";
import { validateCalendarId, validateEventId, validateRequired } from "./validation";
import { CalendarProvider, ProviderCalendar } from "./CalendarProvider";

/**
 * Microsoft Graph API Calendar type
 */
interface MicrosoftCalendar {
	id: string;
	name: string;
	color?: string;
	hexColor?: string;
	isDefaultCalendar?: boolean;
	canEdit?: boolean;
	owner?: {
		name?: string;
		address?: string;
	};
}

/**
 * Microsoft Graph API Event type
 */
interface MicrosoftCalendarEvent {
	id: string;
	subject: string;
	bodyPreview?: string;
	body?: {
		contentType: string;
		content: string;
	};
	start?: {
		dateTime: string;
		timeZone: string;
	};
	end?: {
		dateTime: string;
		timeZone: string;
	};
	location?: {
		displayName?: string;
	};
	webLink?: string;
	isAllDay?: boolean;
	isCancelled?: boolean;
	showAs?: string;
	"@removed"?: {
		reason?: string;
	};
}

/**
 * MicrosoftCalendarService handles Microsoft Graph Calendar API interactions.
 * Uses OAuth for authentication and provides calendar event access.
 * Implements the CalendarProvider interface for abstraction.
 */
export class MicrosoftCalendarService extends CalendarProvider {
	readonly providerId = "microsoft";
	readonly providerName = "Microsoft Calendar";
	private plugin: TaskNotesPlugin;
	private oauthService: OAuthService;
	private baseUrl = "https://graph.microsoft.com/v1.0";
	private cache: Map<string, ICSEvent[]> = new Map();
	private refreshTimer: NodeJS.Timeout | null = null;
	private availableCalendars: ProviderCalendar[] = [];
	private lastManualRefresh: number = 0; // Timestamp of last manual refresh for rate limiting

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
			MICROSOFT_CALENDAR_CONSTANTS.RATE_LIMIT;

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
					console.error(`[MicrosoftCalendar] ${context} failed after ${MAX_RETRIES} retries`);
					throw error;
				}

				// Apply exponential backoff with jitter
				const jitter = Math.random() * 0.3 * backoffMs; // 0-30% jitter
				const delay = Math.min(backoffMs + jitter, MAX_BACKOFF_MS);

				console.warn(
					`[MicrosoftCalendar] ${context} failed (${error.status}), ` +
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
	 * Gets the list of available Microsoft Calendars
	 */
	getAvailableCalendars(): ProviderCalendar[] {
		return this.availableCalendars;
	}

	/**
	 * Gets the list of enabled calendar IDs from settings
	 */
	private getEnabledCalendarIds(): string[] {
		// If empty, show all calendars
		if (this.plugin.settings.enabledMicrosoftCalendars.length === 0) {
			return this.availableCalendars.map(cal => cal.id);
		}
		return this.plugin.settings.enabledMicrosoftCalendars;
	}

	/**
	 * Gets the sync token for a calendar from settings (delta link)
	 */
	private getSyncToken(calendarId: string): string | undefined {
		return this.plugin.settings.microsoftCalendarSyncTokens?.[calendarId];
	}

	/**
	 * Saves a sync token (delta link) for a calendar to settings
	 */
	private async saveSyncToken(calendarId: string, syncToken: string): Promise<void> {
		if (!this.plugin.settings.microsoftCalendarSyncTokens) {
			this.plugin.settings.microsoftCalendarSyncTokens = {};
		}
		this.plugin.settings.microsoftCalendarSyncTokens[calendarId] = syncToken;
		await this.plugin.saveSettings();
	}

	/**
	 * Clears the sync token for a calendar (forces full resync)
	 */
	private async clearSyncToken(calendarId: string): Promise<void> {
		if (this.plugin.settings.microsoftCalendarSyncTokens) {
			delete this.plugin.settings.microsoftCalendarSyncTokens[calendarId];
			await this.plugin.saveSettings();
		}
	}

	async initialize(): Promise<void> {
		// Check if connected
		const isConnected = await this.oauthService.isConnected("microsoft");
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
				console.error("Microsoft Calendar refresh failed:", error);
			});
		}, MICROSOFT_CALENDAR_CONSTANTS.REFRESH_INTERVAL_MS);
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
	 * Fetches list of user's calendars
	 */
	async listCalendars(): Promise<ProviderCalendar[]> {
		try {
			return await this.withRetry(async () => {
				const token = await this.oauthService.getValidToken("microsoft");

				let allCalendars: MicrosoftCalendar[] = [];
				let nextLink: string | undefined = `${this.baseUrl}/me/calendars`;

				// Handle pagination
				while (nextLink) {
					const response: any = await requestUrl({
						url: nextLink,
						method: "GET",
						headers: {
							"Authorization": `Bearer ${token}`,
							"Accept": "application/json"
						}
					});

					const data: any = response.json;
					const calendars: MicrosoftCalendar[] = data.value || [];
					allCalendars.push(...calendars);
					nextLink = data["@odata.nextLink"];
				}

				// Convert to ProviderCalendar format
				return allCalendars.map(cal => ({
					id: cal.id,
					summary: cal.name,
					name: cal.name,
					color: cal.hexColor || undefined,
					backgroundColor: cal.hexColor || undefined,
					primary: cal.isDefaultCalendar || false,
					isDefault: cal.isDefaultCalendar || false
				}));
			}, "List calendars");
		} catch (error) {
			console.error("Failed to list calendars:", error);
			throw new GoogleCalendarError(`Failed to fetch calendar list: ${error.message}`, error.status);
		}
	}

	/**
	 * Fetches events from a specific calendar using delta sync when possible
	 * Microsoft Graph uses delta links for incremental sync
	 */
	async fetchCalendarEvents(
		calendarId: string,
		timeMin?: Date,
		timeMax?: Date
	): Promise<{
		events: MicrosoftCalendarEvent[];
		isFullSync: boolean;
		hasDeletes: boolean;
	}> {
		try {
			const token = await this.oauthService.getValidToken("microsoft");
			const deltaLink = this.getSyncToken(calendarId);

			let allEvents: MicrosoftCalendarEvent[] = [];
			let nextLink: string | undefined;
			let newDeltaLink: string | undefined;
			let isFullSync = !deltaLink;
			let hasDeletes = false;


			// Build initial URL
			let url: string;
			if (deltaLink) {
				// Use delta link for incremental sync
				url = deltaLink;
			} else {
				// Full sync with time range
				// NOTE: Use regular /calendarView (NOT /delta) for initial sync with time filtering
				// The /delta endpoint does NOT support startDateTime/endDateTime parameters
				// After first sync, we'll get @odata.deltaLink for subsequent incremental syncs
				const now = new Date();
				const defaultTimeMin = timeMin || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
				const defaultTimeMax = timeMax || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

				const params = new URLSearchParams({
					startDateTime: defaultTimeMin.toISOString(),
					endDateTime: defaultTimeMax.toISOString(),
					$top: MICROSOFT_CALENDAR_CONSTANTS.MAX_RESULTS_PER_REQUEST.toString()
				});

				url = `${this.baseUrl}/me/calendars/${encodeURIComponent(calendarId)}/calendarView?${params.toString()}`;
			}

			do {
				try {
					const response = await this.withRetry(async () => {
						const preferValues: string[] = [
							`odata.maxpagesize=${MICROSOFT_CALENDAR_CONSTANTS.MAX_RESULTS_PER_REQUEST}`,
							`outlook.timezone="UTC"`
						];

						return await requestUrl({
							url: nextLink || url,
							method: "GET",
							headers: {
								"Authorization": `Bearer ${token}`,
								"Accept": "application/json",
								"Prefer": preferValues.join(", ")
							}
						});
					}, `Fetch events for ${calendarId}`);

					const data = response.json;
					const items: MicrosoftCalendarEvent[] = data.value || [];

					// Check for deleted events
					if (
						!isFullSync &&
						items.some(event => event.isCancelled || event["@removed"])
					) {
						hasDeletes = true;
					}

					allEvents.push(...items);
					nextLink = data["@odata.nextLink"];

					// Store delta link when available (only on last page)
					if (data["@odata.deltaLink"]) {
						newDeltaLink = data["@odata.deltaLink"];
					}


				} catch (error) {
					// Check if delta link expired (HTTP 410)
					if (error.status === 410) {
						await this.clearSyncToken(calendarId);
						// Retry with full sync
						return await this.fetchCalendarEvents(calendarId, timeMin, timeMax);
					}
					throw error;
				}
			} while (nextLink);

			// Save the new delta link
			if (newDeltaLink) {
				await this.saveSyncToken(calendarId, newDeltaLink);
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
	 * Converts a Microsoft Calendar event to TaskNotes ICSEvent format
	 */
	private convertToICSEvent(msEvent: MicrosoftCalendarEvent, calendarId: string): ICSEvent {
		if (!msEvent.start || !msEvent.end) {
			throw new Error("Event missing start/end");
		}

		// Determine start and end times
		let start: string;
		let end: string | undefined;
		const allDay: boolean = msEvent.isAllDay || false;

		if (allDay) {
			// All-day events are represented as dates in the event's timezone.
			// Use the original date component to avoid off-by-one errors when converting to local time.
			start = msEvent.start.dateTime.split("T")[0];
			end = msEvent.end.dateTime.split("T")[0];
		} else {
			const { format, parseISO } = require("date-fns");

			const startIso = this.ensureUtcDateTime(msEvent.start.dateTime, msEvent.start.timeZone);
			const endIso = this.ensureUtcDateTime(msEvent.end.dateTime, msEvent.end.timeZone);

			const startDate = parseISO(startIso);
			const endDate = parseISO(endIso);

			start = format(startDate, "yyyy-MM-dd'T'HH:mm:ss");
			end = format(endDate, "yyyy-MM-dd'T'HH:mm:ss");
		}

		// Microsoft doesn't provide event-level colors in the same way as Google
		// Use a default blue color
		const color = "#0078D4"; // Microsoft blue

		return {
			id: `microsoft-${calendarId}-${msEvent.id}`,
			subscriptionId: `microsoft-${calendarId}`,
			title: msEvent.subject || "Untitled Event",
			description: msEvent.bodyPreview || msEvent.body?.content,
			start: start,
			end: end,
			allDay: allDay,
			location: msEvent.location?.displayName,
			url: msEvent.webLink,
			color: color
		};
	}

	/**
	 * Refreshes all enabled Microsoft calendars using delta sync when possible
	 */
	async refreshAllCalendars(): Promise<void> {
		try {
			const isConnected = await this.oauthService.isConnected("microsoft");
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
					const { events: msEvents, isFullSync, hasDeletes } = await this.fetchCalendarEvents(calendarId);


					if (isFullSync) {
						// Full sync: Replace all events from this calendar
						cachedEvents = cachedEvents.filter(
							event => event.subscriptionId !== `microsoft-${calendarId}`
						);

						// Add new events from this calendar (filter out cancelled events)
						const icsEvents = msEvents
							.filter(event => !event.isCancelled && !event["@removed"])
							.map(event => this.convertToICSEvent(event, calendarId));

						cachedEvents.push(...icsEvents);
					} else {
						// Incremental sync: Update cache with changes
						let addedCount = 0;
						let updatedCount = 0;
						let deletedCount = 0;

						for (const msEvent of msEvents) {
							const removedInfo = msEvent["@removed"];
							const eventId = `microsoft-${calendarId}-${msEvent.id}`;
							const existingIndex = cachedEvents.findIndex(e => e.id === eventId);

							if (removedInfo) {
								if (existingIndex !== -1) {
									cachedEvents.splice(existingIndex, 1);
									deletedCount++;
								}
								continue;
							}

							if (msEvent.isCancelled) {
								// Event was deleted
								if (existingIndex !== -1) {
									cachedEvents.splice(existingIndex, 1);
									deletedCount++;
								}
							} else {
								// Event was added or updated
								try {
									const icsEvent = this.convertToICSEvent(msEvent, calendarId);

									if (existingIndex !== -1) {
										// Update existing event
										cachedEvents[existingIndex] = icsEvent;
										updatedCount++;
									} else {
										// Add new event
										cachedEvents.push(icsEvent);
										addedCount++;
									}
								} catch (conversionError) {
									console.warn("[MicrosoftCalendar] Failed to convert event during refresh", msEvent.id, conversionError);
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
			console.error("Failed to refresh Microsoft calendars:", error);

			// If it's an auth error, show notice to reconnect
			if (error.message && error.message.includes("401")) {
				console.warn("[MicrosoftCalendar] Authentication expired - caller should handle re-authentication");
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
		const results: ICSEvent[] = [];

		for (const event of events) {
			if (event["@removed"] || event.isCancelled) {
				continue;
			}

			try {
				results.push(this.convertToICSEvent(event, calendarId));
			} catch (conversionError) {
				console.warn("[MicrosoftCalendar] Skipping event due to conversion failure", event.id, conversionError);
			}
		}

		return results;
	}

	/**
	 * Alias for refresh() - for test compatibility
	 */
	async manualRefresh(): Promise<void> {
		return this.refresh();
	}

	/**
	 * Disconnects and clears cache - for test compatibility
	 */
	async disconnect(): Promise<void> {
		this.clearCache();
		this.stopRefreshTimer();
	}

	/**
	 * Manually triggers a refresh
	 * Rate-limited to prevent API abuse
	 */
	async refresh(): Promise<void> {
		const now = Date.now();
		const timeSinceLastRefresh = now - this.lastManualRefresh;
		const minInterval = MICROSOFT_CALENDAR_CONSTANTS.MIN_MANUAL_REFRESH_INTERVAL_MS;

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
	 * Updates a Microsoft Calendar event
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
		}
	): Promise<ICSEvent> {
		// Validate inputs
		validateCalendarId(calendarId);
		validateEventId(eventId);
		validateRequired(updates, "updates");

		try {
			const token = await this.oauthService.getValidToken("microsoft");

			// Build Microsoft Graph update payload
			const payload: any = {};

			// Support both 'title' and 'summary'
			if (updates.title !== undefined || updates.summary !== undefined) {
				payload.subject = updates.summary || updates.title;
			}

			if (updates.description !== undefined) {
				payload.body = {
					contentType: "text",
					content: updates.description
				};
			}

			// Handle start/end - could be string or object
			// FIXED: Only set isAllDay when explicitly provided or when changing start/end times
			// Otherwise, updating just the title would incorrectly change all-day events to timed events
			let shouldSetIsAllDay = false;
			let isAllDay = false;

			if (updates.start !== undefined) {
				shouldSetIsAllDay = true;
				if (typeof updates.start === 'string') {
					// Determine if all-day based on format
					isAllDay = updates.isAllDay !== undefined ? updates.isAllDay : !/T/.test(updates.start);
					payload.start = {
						dateTime: updates.start,
						timeZone: "UTC"
					};
				} else {
					payload.start = {
						dateTime: updates.start.dateTime || updates.start.date,
						timeZone: updates.start.timeZone || "UTC"
					};
					if (updates.start.date && !updates.start.dateTime) {
						isAllDay = true;
					}
				}
			}

			if (updates.end !== undefined) {
				shouldSetIsAllDay = true;
				if (typeof updates.end === 'string') {
					payload.end = {
						dateTime: updates.end,
						timeZone: "UTC"
					};
				} else {
					payload.end = {
						dateTime: updates.end.dateTime || updates.end.date,
						timeZone: updates.end.timeZone || "UTC"
					};
				}
			}

			// FIXED: Only include isAllDay when explicitly provided or when we're changing start/end
			if (updates.isAllDay !== undefined) {
				payload.isAllDay = updates.isAllDay;
			} else if (shouldSetIsAllDay) {
				// We're changing start/end, so set isAllDay based on what we determined above
				payload.isAllDay = isAllDay;
			}
			// Otherwise, don't include isAllDay in the payload at all

			if (updates.location !== undefined) {
				payload.location = {
					displayName: updates.location
				};
			}

			// Update the event
			const response = await this.withRetry(async () => {
				return await requestUrl({
					url: `${this.baseUrl}/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
					method: "PATCH",
					headers: {
						"Authorization": `Bearer ${token}`,
						"Content-Type": "application/json",
						"Accept": "application/json"
					},
					body: JSON.stringify(payload)
				});
			}, `Update event ${eventId}`);

			const updatedEvent = response.json;

			// Convert to ICSEvent for return
			const icsEvent = this.convertToICSEvent(updatedEvent, calendarId);

			// Refresh events after update
			await this.refreshAllCalendars();

			return icsEvent;

		} catch (error) {
			console.error("Failed to update Microsoft Calendar event:", error);
			if (error.status === 404) {
				throw new EventNotFoundError(eventId);
			}
			if (error.status === 401 || error.status === 403) {
				throw new TokenExpiredError("microsoft");
			}
			if (error.status === 429) {
				throw new RateLimitError();
			}
			throw new GoogleCalendarError(`Failed to update event: ${error.message}`, error.status);
		}
	}

	/**
	 * Creates a new Microsoft Calendar event
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
			const token = await this.oauthService.getValidToken("microsoft");

			// Build Microsoft Graph payload
			const payload: any = {
				subject: summary
			};

			if (event.description) {
				payload.body = {
					contentType: "text",
					content: event.description
				};
			}

			if (event.location) {
				payload.location = {
					displayName: event.location
				};
			}

			// Handle start/end - could be string or object
			if (typeof event.start === 'string') {
				// Determine if all-day based on format
				const isAllDay = event.isAllDay || !/T/.test(event.start);
				payload.start = {
					dateTime: event.start,
					timeZone: "UTC"
				};
				payload.end = {
					dateTime: event.end as string,
					timeZone: "UTC"
				};
				payload.isAllDay = isAllDay;
			} else {
				payload.start = {
					dateTime: event.start.dateTime || event.start.date,
					timeZone: event.start.timeZone || "UTC"
				};
				payload.end = {
					dateTime: typeof event.end === "string" ? event.end : event.end.dateTime || (event.end as any).date,
					timeZone: (event.end as any).timeZone || "UTC"
				};
				// If using 'date' field, it's all-day
				if (event.start.date && !event.start.dateTime) {
					payload.isAllDay = true;
				}
			}

			const response = await this.withRetry(async () => {
				return await requestUrl({
					url: `${this.baseUrl}/me/calendars/${encodeURIComponent(calendarId)}/events`,
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
			console.error("Failed to create Microsoft Calendar event:", error);
			if (error.status === 404) {
				throw new CalendarNotFoundError(calendarId);
			}
			if (error.status === 401 || error.status === 403) {
				throw new TokenExpiredError("microsoft");
			}
			if (error.status === 429) {
				throw new RateLimitError();
			}
			throw new GoogleCalendarError(`Failed to create event: ${error.message}`, error.status);
		}
	}

	/**
	 * Deletes a Microsoft Calendar event
	 */
	async deleteEvent(calendarId: string, eventId: string): Promise<void> {
		// Validate inputs
		validateCalendarId(calendarId);
		validateEventId(eventId);

		try {
			const token = await this.oauthService.getValidToken("microsoft");

			await this.withRetry(async () => {
				return await requestUrl({
					url: `${this.baseUrl}/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
					method: "DELETE",
					headers: {
						"Authorization": `Bearer ${token}`
					}
				});
			}, `Delete event ${eventId}`);

			// Refresh events after deletion
			await this.refreshAllCalendars();

		} catch (error) {
			// Don't throw on 404 - event already deleted is fine
			if (error.status === 404) {
				throw new EventNotFoundError(eventId);
			}

			console.error("Failed to delete Microsoft Calendar event:", error);
			if (error.status === 401 || error.status === 403) {
				throw new TokenExpiredError("microsoft");
			}
			if (error.status === 429) {
				throw new RateLimitError();
			}
			throw new GoogleCalendarError(`Failed to delete event: ${error.message}`, error.status);
		}
	}

	/**
	 * Creates a new calendar in Microsoft Calendar
	 */
	async createCalendar(summary: string, description?: string): Promise<string> {
		try {
			const token = await this.oauthService.getValidToken("microsoft");

			const response = await this.withRetry(async () => {
				return await requestUrl({
					url: `${this.baseUrl}/me/calendars`,
					method: "POST",
					headers: {
						"Authorization": `Bearer ${token}`,
						"Content-Type": "application/json",
						"Accept": "application/json"
					},
					body: JSON.stringify({
						name: summary
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
				throw new TokenExpiredError("microsoft");
			}
			if (error.status === 429) {
				throw new RateLimitError();
			}
			throw new GoogleCalendarError(`Failed to create calendar: ${error.message}`, error.status);
		}
	}

	private ensureUtcDateTime(dateTime: string, timeZone?: string): string {
		if (!dateTime) {
			throw new Error("Missing dateTime value");
		}

		// Already includes an explicit offset or Z suffix
		if (/[+-]\d{2}:\d{2}$/.test(dateTime) || dateTime.endsWith("Z")) {
			return dateTime;
		}

		if (timeZone && timeZone.toUpperCase() !== "UTC") {
			console.warn(`[MicrosoftCalendar] Falling back to UTC conversion for timezone "${timeZone}"`);
		}

		// Append Z (UTC) and trim trailing fractional seconds to keep parseISO happy
		const normalized = dateTime.replace(/\.\d+$/, "");
		return `${normalized}Z`;
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
