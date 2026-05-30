import { requestUrl } from "obsidian";
import TaskNotesPlugin from "../main";
import { OAuthService } from "./OAuthService";
import { ICSEvent } from "../types";
import { MICROSOFT_CALENDAR_CONSTANTS } from "./constants";
import {
	GoogleCalendarError,
	EventNotFoundError,
	CalendarNotFoundError,
	RateLimitError,
	TokenExpiredError,
} from "./errors";
import { validateCalendarId, validateEventId, validateRequired } from "./validation";
import { CalendarProvider, ProviderCalendar } from "./CalendarProvider";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";
import { publishUserNotice } from "../core/userNotices";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/MicrosoftCalendarService" });

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
	type?: "singleInstance" | "occurrence" | "exception" | "seriesMaster";
	seriesMasterId?: string;
	"@removed"?: {
		reason?: string;
	};
}

type MicrosoftCalendarListResponse = {
	value?: MicrosoftCalendar[];
	"@odata.nextLink"?: string;
};

type MicrosoftEventPayload = {
	subject?: string;
	body?: {
		contentType: "text";
		content: string;
	};
	start?: {
		dateTime?: string;
		timeZone: string;
	};
	end?: {
		dateTime?: string;
		timeZone: string;
	};
	location?: {
		displayName: string;
	};
	isAllDay?: boolean;
};

export interface MicrosoftCalendarSyncError {
	calendarId?: string;
	calendarName?: string;
	message: string;
	status?: number;
	occurredAt: string;
}

export interface MicrosoftCalendarSyncStatus {
	lastAttempt: string | null;
	lastSuccess: string | null;
	lastError: string | null;
	calendarErrors: MicrosoftCalendarSyncError[];
	calendarsChecked: number;
	eventsLoaded: number;
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
	private refreshTimer: number | null = null;
	private availableCalendars: ProviderCalendar[] = [];
	private lastManualRefresh = 0; // Timestamp of last manual refresh for rate limiting
	private syncStatus: MicrosoftCalendarSyncStatus = {
		lastAttempt: null,
		lastSuccess: null,
		lastError: null,
		calendarErrors: [],
		calendarsChecked: 0,
		eventsLoaded: 0,
	};

	constructor(plugin: TaskNotesPlugin, oauthService: OAuthService) {
		super();
		this.plugin = plugin;
		this.oauthService = oauthService;
	}

	/**
	 * Sleep helper for exponential backoff
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => window.setTimeout(resolve, ms));
	}

	/**
	 * Executes an API call with exponential backoff retry on rate limit errors
	 * Implements retry logic for 429 (rate limit) and 5xx (server) errors
	 */
	private async withRetry<T>(fn: () => Promise<T>, context: string): Promise<T> {
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
					tasknotesLogger.error(
						`[MicrosoftCalendar] ${context} failed after ${MAX_RETRIES} retries`,
						{
							category: "provider",
							operation: "retry-microsoft-calendar-request",
							details: { context, attempts: MAX_RETRIES },
							error,
						}
					);
					throw error;
				}

				// Apply exponential backoff with jitter
				const jitter = Math.random() * 0.3 * backoffMs; // 0-30% jitter
				const delay = Math.min(backoffMs + jitter, MAX_BACKOFF_MS);

				tasknotesLogger.warn("Microsoft Calendar request failed and will be retried", {
					category: "provider",
					operation: "retry-microsoft-calendar-request",
					details: {
						context,
						status: error.status,
						delayMs: Math.round(delay),
						nextAttempt: attempt + 1,
						maxRetries: MAX_RETRIES,
					},
					error,
				});

				await this.sleep(delay);

				// Increase backoff for next iteration
				backoffMs = Math.min(backoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
			}
		}

		// Should never reach here, but TypeScript needs it
		throw lastError instanceof Error ? lastError : new Error(String(lastError));
	}

	/**
	 * Gets the list of available Microsoft Calendars
	 */
	getAvailableCalendars(): ProviderCalendar[] {
		return this.availableCalendars;
	}

	getSyncStatus(): MicrosoftCalendarSyncStatus {
		return {
			...this.syncStatus,
			calendarErrors: this.syncStatus.calendarErrors.map((error) => ({ ...error })),
		};
	}

	/**
	 * Gets the list of enabled calendar IDs from settings
	 */
	private getEnabledCalendarIds(): string[] {
		// If empty, show all calendars
		if (this.plugin.settings.enabledMicrosoftCalendars.length === 0) {
			return this.availableCalendars.map((cal) => cal.id);
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
		if (this.plugin.settings.microsoftCalendarSyncTokens[calendarId] === syncToken) {
			return;
		}
		this.plugin.settings.microsoftCalendarSyncTokens[calendarId] = syncToken;
		await this.persistSettingsDataOnly();
	}

	/**
	 * Clears the sync token for a calendar (forces full resync)
	 */
	private async clearSyncToken(calendarId: string): Promise<void> {
		if (!this.plugin.settings.microsoftCalendarSyncTokens) {
			return;
		}
		if (!(calendarId in this.plugin.settings.microsoftCalendarSyncTokens)) {
			return;
		}
		delete this.plugin.settings.microsoftCalendarSyncTokens[calendarId];
		await this.persistSettingsDataOnly();
	}

	private async persistSettingsDataOnly(): Promise<void> {
		const saveSettingsDataOnly = (
			this.plugin as unknown as { saveSettingsDataOnly?: () => Promise<void> }
		).saveSettingsDataOnly;
		if (typeof saveSettingsDataOnly === "function") {
			await saveSettingsDataOnly.call(this.plugin);
		}
	}

	private getErrorMessage(error: unknown): string {
		if (error instanceof Error) {
			return error.message;
		}
		if (typeof error === "object" && error !== null && "message" in error) {
			const message = (error as { message?: unknown }).message;
			if (typeof message === "string") {
				return message;
			}
		}
		return String(error);
	}

	private getErrorStatus(error: unknown): number | undefined {
		if (typeof error !== "object" || error === null) {
			return undefined;
		}

		const status = (error as { status?: unknown }).status;
		if (typeof status === "number") {
			return status;
		}

		const statusCode = (error as { statusCode?: unknown }).statusCode;
		return typeof statusCode === "number" ? statusCode : undefined;
	}

	private createSyncError(
		error: unknown,
		calendar?: ProviderCalendar
	): MicrosoftCalendarSyncError {
		return {
			calendarId: calendar?.id,
			calendarName: calendar?.summary,
			message: this.getErrorMessage(error),
			status: this.getErrorStatus(error),
			occurredAt: new Date().toISOString(),
		};
	}

	private formatSyncErrorSummary(errors: MicrosoftCalendarSyncError[]): string | null {
		if (errors.length === 0) {
			return null;
		}

		const firstError = errors[0];
		const label = firstError.calendarName || firstError.calendarId || "Microsoft calendar";
		if (errors.length === 1) {
			return `${label}: ${firstError.message}`;
		}

		return `${errors.length} Microsoft calendars failed to refresh. First error: ${label}: ${firstError.message}`;
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
			window.clearTimeout(this.refreshTimer);
		}

		this.refreshTimer = window.setTimeout(() => {
			this.refreshTimer = null;
			this.refreshAllCalendars()
				.catch((error) => {
					tasknotesLogger.error("Microsoft Calendar refresh failed:", {
						category: "provider",
						operation: "microsoft-calendar-refresh",
						error: error,
					});
				})
				.finally(() => {
					void this.oauthService.isConnected("microsoft").then((isConnected) => {
						if (isConnected) {
							this.startRefreshTimer();
						}
					});
				});
		}, MICROSOFT_CALENDAR_CONSTANTS.REFRESH_INTERVAL_MS);
	}

	/**
	 * Stops the refresh timer
	 */
	private stopRefreshTimer(): void {
		if (this.refreshTimer) {
			window.clearTimeout(this.refreshTimer);
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
					const response = await requestUrl({
						url: nextLink,
						method: "GET",
						headers: {
							Authorization: `Bearer ${token}`,
							Accept: "application/json",
						},
					});

					const data = response.json as MicrosoftCalendarListResponse;
					const calendars: MicrosoftCalendar[] = data.value || [];
					allCalendars.push(...calendars);
					nextLink = data["@odata.nextLink"];
				}

				// Convert to ProviderCalendar format
				return allCalendars.map((cal) => ({
					id: cal.id,
					summary: cal.name,
					name: cal.name,
					color: cal.hexColor || undefined,
					backgroundColor: cal.hexColor || undefined,
					primary: cal.isDefaultCalendar || false,
					isDefault: cal.isDefaultCalendar || false,
				}));
			}, "List calendars");
		} catch (error) {
			tasknotesLogger.error("Failed to list calendars:", {
				category: "provider",
				operation: "list-calendars",
				error: error,
			});
			throw new GoogleCalendarError(
				`Failed to fetch calendar list: ${error.message}`,
				error.status
			);
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
				const defaultTimeMin =
					timeMin || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
				const defaultTimeMax =
					timeMax || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

				const params = new URLSearchParams({
					startDateTime: defaultTimeMin.toISOString(),
					endDateTime: defaultTimeMax.toISOString(),
					$top: MICROSOFT_CALENDAR_CONSTANTS.MAX_RESULTS_PER_REQUEST.toString(),
				});

				url = `${this.baseUrl}/me/calendars/${encodeURIComponent(calendarId)}/calendarView?${params.toString()}`;
			}

			do {
				try {
					const response = await this.withRetry(async () => {
						const preferValues: string[] = [
							`odata.maxpagesize=${MICROSOFT_CALENDAR_CONSTANTS.MAX_RESULTS_PER_REQUEST}`,
							`outlook.timezone="UTC"`,
						];

						return await requestUrl({
							url: nextLink || url,
							method: "GET",
							headers: {
								Authorization: `Bearer ${token}`,
								Accept: "application/json",
								Prefer: preferValues.join(", "),
							},
						});
					}, `Fetch events for ${calendarId}`);

					const data = response.json;
					const items: MicrosoftCalendarEvent[] = data.value || [];

					// Check for deleted events
					if (
						!isFullSync &&
						items.some((event) => event.isCancelled || event["@removed"])
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
				hasDeletes,
			};
		} catch (error) {
			tasknotesLogger.error(`Failed to fetch events from calendar ${calendarId}:`, {
				category: "provider",
				operation: "fetch-events-calendar",
				error: error,
			});
			const wrappedError = new Error(
				`Failed to fetch calendar events: ${this.getErrorMessage(error)}`
			) as Error & { status?: number; statusCode?: number };
			const status = this.getErrorStatus(error);
			wrappedError.status = status;
			wrappedError.statusCode = status;
			throw wrappedError;
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
			// eslint-disable-next-line @typescript-eslint/no-require-imports -- date-fns is lazy-loaded inside Microsoft all-day event conversion.
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
		const recurringEventId = msEvent.seriesMasterId
			? `microsoft-${calendarId}-${msEvent.seriesMasterId}`
			: undefined;

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
			recurringEventId,
			color: color,
		};
	}

	/**
	 * Refreshes all enabled Microsoft calendars using delta sync when possible
	 */
	async refreshAllCalendars(): Promise<void> {
		const attemptStartedAt = new Date().toISOString();
		this.syncStatus = {
			...this.syncStatus,
			lastAttempt: attemptStartedAt,
			lastError: null,
			calendarErrors: [],
			calendarsChecked: 0,
			eventsLoaded: this.cache.get("all")?.length || 0,
		};

		try {
			const isConnected = await this.oauthService.isConnected("microsoft");
			if (!isConnected) {
				return;
			}

			// Get list of calendars and store them
			this.availableCalendars = await this.listCalendars();

			// Get enabled calendar IDs from settings
			const enabledCalendarIds = this.getEnabledCalendarIds();
			const calendarsById = new Map(
				this.availableCalendars.map((calendar) => [calendar.id, calendar])
			);
			const calendarErrors: MicrosoftCalendarSyncError[] = [];

			// Get current cached events
			let cachedEvents = this.cache.get("all") || [];

			// Fetch events from each enabled calendar
			for (const calendarId of enabledCalendarIds) {
				try {
					const { events: msEvents, isFullSync } =
						await this.fetchCalendarEvents(calendarId);

					if (isFullSync) {
						// Full sync: Replace all events from this calendar
						cachedEvents = cachedEvents.filter(
							(event) => event.subscriptionId !== `microsoft-${calendarId}`
						);

						// Add new events from this calendar (filter out cancelled events)
						const icsEvents = msEvents
							.filter((event) => !event.isCancelled && !event["@removed"])
							.map((event) => this.convertToICSEvent(event, calendarId));

						cachedEvents.push(...icsEvents);
					} else {
						// Incremental sync: Update cache with changes
						for (const msEvent of msEvents) {
							const removedInfo = msEvent["@removed"];
							const eventId = `microsoft-${calendarId}-${msEvent.id}`;
							const existingIndex = cachedEvents.findIndex((e) => e.id === eventId);

							if (removedInfo) {
								if (existingIndex !== -1) {
									cachedEvents.splice(existingIndex, 1);
								}
								continue;
							}

							if (msEvent.isCancelled) {
								// Event was deleted
								if (existingIndex !== -1) {
									cachedEvents.splice(existingIndex, 1);
								}
							} else {
								// Event was added or updated
								try {
									const icsEvent = this.convertToICSEvent(msEvent, calendarId);

									if (existingIndex !== -1) {
										// Update existing event
										cachedEvents[existingIndex] = icsEvent;
									} else {
										// Add new event
										cachedEvents.push(icsEvent);
									}
								} catch (conversionError) {
									tasknotesLogger.warn(
										"[MicrosoftCalendar] Failed to convert event during refresh",
										{
											category: "provider",
											operation: "convert-event-refresh",
											details: { value: msEvent.id },
											error: conversionError,
										}
									);
								}
							}
						}
					}
				} catch (error) {
					tasknotesLogger.error(`Failed to fetch events from calendar ${calendarId}:`, {
						category: "provider",
						operation: "fetch-events-calendar",
						error: error,
					});
					calendarErrors.push(this.createSyncError(error, calendarsById.get(calendarId)));
					// Continue with other calendars
				}
			}

			// Update cache
			this.cache.set("all", cachedEvents);
			this.syncStatus = {
				lastAttempt: attemptStartedAt,
				lastSuccess:
					calendarErrors.length === 0
						? new Date().toISOString()
						: this.syncStatus.lastSuccess,
				lastError: this.formatSyncErrorSummary(calendarErrors),
				calendarErrors,
				calendarsChecked: enabledCalendarIds.length,
				eventsLoaded: cachedEvents.length,
			};

			// Emit data-changed event
			this.emit("data-changed");
		} catch (error) {
			tasknotesLogger.error("Failed to refresh Microsoft calendars:", {
				category: "provider",
				operation: "refresh-microsoft-calendars",
				error: error,
			});
			const syncError = this.createSyncError(error);
			this.syncStatus = {
				...this.syncStatus,
				lastAttempt: attemptStartedAt,
				lastError: syncError.message,
				calendarErrors: [syncError],
				calendarsChecked: 0,
				eventsLoaded: this.cache.get("all")?.length || 0,
			};

			// If it's an auth error, show notice to reconnect
			const errorMessage = this.getErrorMessage(error);
			if (errorMessage.includes("401")) {
				tasknotesLogger.warn(
					"[MicrosoftCalendar] Authentication expired - caller should handle re-authentication",
					{
						category: "provider",
						operation: "authentication-expired-caller-should-handle-re-authentication",
					}
				);
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
				tasknotesLogger.warn(
					"[MicrosoftCalendar] Skipping event due to conversion failure",
					{
						category: "provider",
						operation: "skipping-event-due-conversion",
						details: { value: event.id },
						error: conversionError,
					}
				);
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
			publishUserNotice(this.plugin.emitter, `Please wait ${Math.ceil(remainingMs / 1000)}s before refreshing again`);
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
			const payload: MicrosoftEventPayload = {};

			// Support both 'title' and 'summary'
			if (updates.title !== undefined || updates.summary !== undefined) {
				payload.subject = updates.summary || updates.title;
			}

			if (updates.description !== undefined) {
				payload.body = {
					contentType: "text",
					content: updates.description,
				};
			}

			// Handle start/end - could be string or object
			// FIXED: Only set isAllDay when explicitly provided or when changing start/end times
			// Otherwise, updating just the title would incorrectly change all-day events to timed events
			let shouldSetIsAllDay = false;
			let isAllDay = false;

			if (updates.start !== undefined) {
				shouldSetIsAllDay = true;
				if (typeof updates.start === "string") {
					// Determine if all-day based on format
					isAllDay =
						updates.isAllDay !== undefined
							? updates.isAllDay
							: !/T/.test(updates.start);
					payload.start = {
						dateTime: updates.start,
						timeZone: "UTC",
					};
				} else {
					payload.start = {
						dateTime: updates.start.dateTime || updates.start.date,
						timeZone: updates.start.timeZone || "UTC",
					};
					if (updates.start.date && !updates.start.dateTime) {
						isAllDay = true;
					}
				}
			}

			if (updates.end !== undefined) {
				shouldSetIsAllDay = true;
				if (typeof updates.end === "string") {
					payload.end = {
						dateTime: updates.end,
						timeZone: "UTC",
					};
				} else {
					payload.end = {
						dateTime: updates.end.dateTime || updates.end.date,
						timeZone: updates.end.timeZone || "UTC",
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
					displayName: updates.location,
				};
			}

			// Update the event
			const response = await this.withRetry(async () => {
				return await requestUrl({
					url: `${this.baseUrl}/me/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
					method: "PATCH",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					body: JSON.stringify(payload),
				});
			}, `Update event ${eventId}`);

			const updatedEvent = response.json;

			// Convert to ICSEvent for return
			const icsEvent = this.convertToICSEvent(updatedEvent, calendarId);

			// Refresh events after update
			await this.refreshAllCalendars();

			return icsEvent;
		} catch (error) {
			tasknotesLogger.error("Failed to update Microsoft Calendar event:", {
				category: "provider",
				operation: "update-microsoft-calendar-event",
				error: error,
			});
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
			const payload: MicrosoftEventPayload = {
				subject: summary,
			};

			if (event.description) {
				payload.body = {
					contentType: "text",
					content: event.description,
				};
			}

			if (event.location) {
				payload.location = {
					displayName: event.location,
				};
			}

			// Handle start/end - could be string or object
			if (typeof event.start === "string") {
				// Determine if all-day based on format
				const isAllDay = event.isAllDay || !/T/.test(event.start);
				payload.start = {
					dateTime: event.start,
					timeZone: "UTC",
				};
				payload.end = {
					dateTime:
						typeof event.end === "string"
							? event.end
							: event.end.dateTime || event.end.date,
					timeZone: "UTC",
				};
				payload.isAllDay = isAllDay;
			} else {
				const eventEnd = event.end;
				payload.start = {
					dateTime: event.start.dateTime || event.start.date,
					timeZone: event.start.timeZone || "UTC",
				};
				payload.end = {
					dateTime:
						typeof eventEnd === "string"
							? eventEnd
							: eventEnd.dateTime || eventEnd.date,
					timeZone: typeof eventEnd === "string" ? "UTC" : eventEnd.timeZone || "UTC",
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
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					body: JSON.stringify(payload),
				});
			}, `Create event in ${calendarId}`);

			const createdEvent = response.json;

			// Convert to ICSEvent for return
			const icsEvent = this.convertToICSEvent(createdEvent, calendarId);

			// Refresh events after creation
			await this.refreshAllCalendars();

			return icsEvent;
		} catch (error) {
			tasknotesLogger.error("Failed to create Microsoft Calendar event:", {
				category: "provider",
				operation: "create-microsoft-calendar-event",
				error: error,
			});
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
						Authorization: `Bearer ${token}`,
					},
				});
			}, `Delete event ${eventId}`);

			// Refresh events after deletion
			await this.refreshAllCalendars();
		} catch (error) {
			// Don't throw on 404 - event already deleted is fine
			if (error.status === 404) {
				throw new EventNotFoundError(eventId);
			}

			tasknotesLogger.error("Failed to delete Microsoft Calendar event:", {
				category: "provider",
				operation: "delete-microsoft-calendar-event",
				error: error,
			});
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
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
						Accept: "application/json",
					},
					body: JSON.stringify({
						name: summary,
					}),
				});
			}, "Create calendar");

			const calendar = response.json;

			// Refresh calendar list
			this.availableCalendars = await this.listCalendars();

			return calendar.id;
		} catch (error) {
			tasknotesLogger.error("Failed to create calendar:", {
				category: "provider",
				operation: "create-calendar",
				error: error,
			});
			if (error.status === 401 || error.status === 403) {
				throw new TokenExpiredError("microsoft");
			}
			if (error.status === 429) {
				throw new RateLimitError();
			}
			throw new GoogleCalendarError(
				`Failed to create calendar: ${error.message}`,
				error.status
			);
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
			tasknotesLogger.warn(
				`[MicrosoftCalendar] Falling back to UTC conversion for timezone "${timeZone}"`,
				{ category: "provider", operation: "falling-back-utc-conversion-timezone" }
			);
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
