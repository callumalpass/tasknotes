import { requestUrl, Notice } from "obsidian";
import TaskNotesPlugin from "../main";
import { OAuthService } from "./OAuthService";
import { GoogleCalendar, GoogleCalendarEvent, ICSEvent, TaskInfo } from "../types";
import { EventEmitter } from "../utils/EventEmitter";
import { hasTimeComponent, getDatePart } from "../utils/dateUtils";

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
 */
export class GoogleCalendarService extends EventEmitter {
	private plugin: TaskNotesPlugin;
	private oauthService: OAuthService;
	private baseUrl = "https://www.googleapis.com/calendar/v3";
	private cache: Map<string, ICSEvent[]> = new Map();
	private refreshTimer: NodeJS.Timeout | null = null;
	private availableCalendars: GoogleCalendar[] = [];
	private calendarColors: Map<string, string> = new Map(); // Map calendar ID to color

	constructor(plugin: TaskNotesPlugin, oauthService: OAuthService) {
		super();
		this.plugin = plugin;
		this.oauthService = oauthService;
	}

	/**
	 * Gets the list of available Google Calendars
	 */
	getAvailableCalendars(): GoogleCalendar[] {
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
		console.log("[GoogleCalendarService] Initialize - connected:", isConnected);
		if (isConnected) {
			// Fetch initial data
			await this.refreshAllCalendars();
			console.log("[GoogleCalendarService] Initial refresh complete, cached events:", this.cache.get("all")?.length || 0);

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
		}, 15 * 60 * 1000);
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
	async listCalendars(): Promise<GoogleCalendar[]> {
		try {
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

			// Store calendar colors for later use
			for (const calendar of calendars) {
				if (calendar.backgroundColor) {
					this.calendarColors.set(calendar.id, calendar.backgroundColor);
				}
			}

			return calendars;
		} catch (error) {
			console.error("Failed to list calendars:", error);
			throw new Error(`Failed to fetch calendar list: ${error.message}`);
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

			console.log(`[GoogleCalendar] Fetching events for ${calendarId}, syncToken: ${syncToken ? "present" : "none"}, mode: ${isFullSync ? "full" : "incremental"}`);

			do {
				try {
					const params = new URLSearchParams({
						singleEvents: "true", // Expand recurring events
						maxResults: "2500" // Maximum allowed by API
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

					const response = await requestUrl({
						url: `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
						method: "GET",
						headers: {
							"Authorization": `Bearer ${token}`,
							"Accept": "application/json"
						}
					});

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

					console.log(`[GoogleCalendar] Fetched ${items.length} events, total: ${allEvents.length}, nextPage: ${!!nextPageToken}, syncToken: ${!!nextSyncToken}`);

				} catch (error) {
					// Check if syncToken expired (HTTP 410)
					if (error.status === 410) {
						console.log(`[GoogleCalendar] Sync token expired for ${calendarId}, performing full resync`);
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
				console.log(`[GoogleCalendar] Saved new sync token for ${calendarId}`);
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
					const { events: googleEvents, isFullSync, hasDeletes } = await this.fetchCalendarEvents(calendarId);

					console.log(`[GoogleCalendar] Processing ${googleEvents.length} events from ${calendarId}, full sync: ${isFullSync}, has deletes: ${hasDeletes}`);

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
						console.log(`[GoogleCalendar] Full sync: Added ${icsEvents.length} events for ${calendarId}`);
					} else {
						// Incremental sync: Update cache with changes
						let addedCount = 0;
						let updatedCount = 0;
						let deletedCount = 0;

						for (const googleEvent of googleEvents) {
							const eventId = `google-${calendarId}-${googleEvent.id}`;
							const existingIndex = cachedEvents.findIndex(e => e.id === eventId);

							if (googleEvent.status === "cancelled") {
								// Event was deleted
								if (existingIndex !== -1) {
									cachedEvents.splice(existingIndex, 1);
									deletedCount++;
								}
							} else {
								// Event was added or updated
								const icsEvent = this.convertToICSEvent(googleEvent, calendarId);

								if (existingIndex !== -1) {
									// Update existing event
									cachedEvents[existingIndex] = icsEvent;
									updatedCount++;
								} else {
									// Add new event
									cachedEvents.push(icsEvent);
									addedCount++;
								}
							}
						}

						console.log(`[GoogleCalendar] Incremental sync for ${calendarId}: +${addedCount}, ~${updatedCount}, -${deletedCount}`);
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
				new Notice("Google Calendar authentication expired. Please reconnect.");
			}
		}
	}

	/**
	 * Gets all cached events
	 */
	getAllEvents(): ICSEvent[] {
		const events = this.cache.get("all") || [];
		console.log("[GoogleCalendarService] getAllEvents called, returning:", events.length, "events");
		return events;
	}

	/**
	 * Manually triggers a refresh
	 */
	async refresh(): Promise<void> {
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
	 */
	async updateEvent(
		calendarId: string,
		eventId: string,
		updates: {
			summary?: string;
			description?: string;
			start?: { dateTime?: string; date?: string; timeZone?: string };
			end?: { dateTime?: string; date?: string; timeZone?: string };
			location?: string;
		}
	): Promise<void> {
		try {
			const token = await this.oauthService.getValidToken("google");

			// First, get the current event to merge with updates
			const getResponse = await requestUrl({
				url: `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
				method: "GET",
				headers: {
					"Authorization": `Bearer ${token}`,
					"Accept": "application/json"
				}
			});

			const currentEvent = getResponse.json;

			// Merge updates with current event
			const updatedEvent = {
				...currentEvent,
				...updates
			};

			// Update the event
			await requestUrl({
				url: `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
				method: "PUT",
				headers: {
					"Authorization": `Bearer ${token}`,
					"Content-Type": "application/json",
					"Accept": "application/json"
				},
				body: JSON.stringify(updatedEvent)
			});

			// Refresh events after update
			await this.refreshAllCalendars();

			new Notice("Google Calendar event updated successfully");

		} catch (error) {
			console.error("Failed to update Google Calendar event:", error);
			throw new Error(`Failed to update event: ${error.message}`);
		}
	}

	/**
	 * Creates a new Google Calendar event
	 */
	async createEvent(
		calendarId: string,
		event: {
			summary: string;
			description?: string;
			start: { dateTime?: string; date?: string; timeZone?: string };
			end: { dateTime?: string; date?: string; timeZone?: string };
			location?: string;
		}
	): Promise<string> {
		try {
			const token = await this.oauthService.getValidToken("google");

			const response = await requestUrl({
				url: `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events`,
				method: "POST",
				headers: {
					"Authorization": `Bearer ${token}`,
					"Content-Type": "application/json",
					"Accept": "application/json"
				},
				body: JSON.stringify(event)
			});

			const createdEvent = response.json;

			// Refresh events after creation
			await this.refreshAllCalendars();

			new Notice("Google Calendar event created successfully");

			return createdEvent.id;

		} catch (error) {
			console.error("Failed to create Google Calendar event:", error);
			throw new Error(`Failed to create event: ${error.message}`);
		}
	}

	/**
	 * Deletes a Google Calendar event
	 */
	async deleteEvent(calendarId: string, eventId: string): Promise<void> {
		try {
			const token = await this.oauthService.getValidToken("google");

			await requestUrl({
				url: `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
				method: "DELETE",
				headers: {
					"Authorization": `Bearer ${token}`
				}
			});

			// Refresh events after deletion
			await this.refreshAllCalendars();

			new Notice("Google Calendar event deleted successfully");

		} catch (error) {
			console.error("Failed to delete Google Calendar event:", error);
			throw new Error(`Failed to delete event: ${error.message}`);
		}
	}

	/**
	 * Creates a new calendar in Google Calendar
	 */
	async createCalendar(summary: string, description?: string): Promise<string> {
		try {
			const token = await this.oauthService.getValidToken("google");

			const response = await requestUrl({
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

			const calendar = response.json;

			// Refresh calendar list
			this.availableCalendars = await this.listCalendars();

			new Notice(`Calendar "${summary}" created successfully`);

			return calendar.id;

		} catch (error) {
			console.error("Failed to create calendar:", error);
			throw new Error(`Failed to create calendar: ${error.message}`);
		}
	}

	/**
	 * Converts a TaskNotes task to a Google Calendar event format
	 */
	private taskToGoogleEvent(task: TaskInfo): {
		summary: string;
		description?: string;
		start: { dateTime?: string; date?: string; timeZone?: string };
		end: { dateTime?: string; date?: string; timeZone?: string };
		location?: string;
	} {
		const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

		// Use scheduled date if available, otherwise due date
		const dateField = task.scheduled || task.due;
		if (!dateField) {
			throw new Error("Task must have a scheduled or due date to sync to Google Calendar");
		}

		const hasTime = hasTimeComponent(dateField);

		let start: { dateTime?: string; date?: string; timeZone?: string };
		let end: { dateTime?: string; date?: string; timeZone?: string };

		if (hasTime) {
			// Timed event
			const dateStr = dateField;
			// Convert to ISO format with timezone
			const startDate = new Date(dateStr);
			const startISO = startDate.toISOString();

			// Calculate end time based on time estimate or default 30 minutes
			const durationMinutes = task.timeEstimate || 30;
			const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
			const endISO = endDate.toISOString();

			start = { dateTime: startISO, timeZone };
			end = { dateTime: endISO, timeZone };
		} else {
			// All-day event
			const datePart = getDatePart(dateField);
			start = { date: datePart };

			// For all-day events, end date is the day after
			const nextDay = new Date(datePart);
			nextDay.setDate(nextDay.getDate() + 1);
			const endDate = nextDay.toISOString().split('T')[0];
			end = { date: endDate };
		}

		// Build description with task metadata and clear sync messaging
		let description = `📝 Managed by TaskNotes (one-way sync)`;
		description += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
		description += `\n\n⚠️  Changes made here will be overwritten by TaskNotes`;
		description += `\n✏️  Edit in Obsidian: obsidian://open?vault=${encodeURIComponent(this.plugin.app.vault.getName())}&file=${encodeURIComponent(task.path)}`;

		if (task.projects && task.projects.length > 0) {
			description += `\n\n📂 Projects: ${task.projects.join(", ")}`;
		}
		if (task.contexts && task.contexts.length > 0) {
			description += `\n🏷️  Contexts: ${task.contexts.join(", ")}`;
		}
		if (task.priority) {
			description += `\n⭐ Priority: ${task.priority}`;
		}
		if (task.status) {
			description += `\n📊 Status: ${task.status}`;
		}

		return {
			summary: `📋 ${task.title}`,
			description,
			start,
			end
		};
	}

	/**
	 * Syncs a task to Google Calendar (creates or updates)
	 * Returns the Google Calendar event ID
	 */
	async syncTaskToCalendar(task: TaskInfo, calendarId: string): Promise<string> {
		try {
			// Check if task already has a Google Calendar event ID
			const existingEventId = task.googleCalendarEventId;

			const eventData = this.taskToGoogleEvent(task);

			if (existingEventId) {
				// Update existing event
				await this.updateEvent(calendarId, existingEventId, eventData);
				return existingEventId;
			} else {
				// Create new event
				const eventId = await this.createEvent(calendarId, eventData);

				// Store event ID in task metadata
				await this.plugin.taskService.updateProperty(task, "googleCalendarEventId", eventId);

				return eventId;
			}

		} catch (error) {
			console.error("Failed to sync task to Google Calendar:", error);
			throw error;
		}
	}

	/**
	 * Removes a task from Google Calendar
	 */
	async removeTaskFromCalendar(task: TaskInfo, calendarId: string): Promise<void> {
		try {
			const eventId = task.googleCalendarEventId;
			if (!eventId) {
				return; // Task not synced to Google Calendar
			}

			await this.deleteEvent(calendarId, eventId);

			// Remove event ID from task metadata
			await this.plugin.taskService.updateProperty(task, "googleCalendarEventId", undefined);

		} catch (error) {
			console.error("Failed to remove task from Google Calendar:", error);
			throw error;
		}
	}

	/**
	 * Syncs all tasks to Google Calendar
	 */
	async syncAllTasks(calendarId: string): Promise<void> {
		try {
			const tasks = await this.plugin.cacheManager.getAllTasks();

			// Filter tasks that have scheduled or due dates
			const syncableTasks = tasks.filter((task: TaskInfo) => task.scheduled || task.due);

			let syncedCount = 0;
			let errorCount = 0;

			for (const task of syncableTasks) {
				try {
					await this.syncTaskToCalendar(task, calendarId);
					syncedCount++;
				} catch (error) {
					console.error(`Failed to sync task ${task.path}:`, error);
					errorCount++;
				}
			}

			new Notice(`Synced ${syncedCount} tasks to Google Calendar${errorCount > 0 ? ` (${errorCount} errors)` : ""}`);

		} catch (error) {
			console.error("Failed to sync tasks:", error);
			throw new Error(`Failed to sync tasks: ${error.message}`);
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
