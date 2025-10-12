import { requestUrl, Notice } from "obsidian";
import TaskNotesPlugin from "../main";
import { OAuthService } from "./OAuthService";
import { GoogleCalendar, GoogleCalendarEvent, ICSEvent } from "../types";
import { EventEmitter } from "../utils/EventEmitter";

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

	constructor(plugin: TaskNotesPlugin, oauthService: OAuthService) {
		super();
		this.plugin = plugin;
		this.oauthService = oauthService;
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
	 * Fetches list of user's calendars
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
			return data.items || [];
		} catch (error) {
			console.error("Failed to list calendars:", error);
			throw new Error(`Failed to fetch calendar list: ${error.message}`);
		}
	}

	/**
	 * Fetches events from a specific calendar
	 */
	async fetchCalendarEvents(
		calendarId: string,
		timeMin?: Date,
		timeMax?: Date
	): Promise<GoogleCalendarEvent[]> {
		try {
			const token = await this.oauthService.getValidToken("google");

			// Default to fetching events from 30 days ago to 90 days ahead
			const now = new Date();
			const defaultTimeMin = timeMin || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
			const defaultTimeMax = timeMax || new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

			const params = new URLSearchParams({
				timeMin: defaultTimeMin.toISOString(),
				timeMax: defaultTimeMax.toISOString(),
				singleEvents: "true", // Expand recurring events
				orderBy: "startTime",
				maxResults: "2500" // Maximum allowed by API
			});

			const response = await requestUrl({
				url: `${this.baseUrl}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
				method: "GET",
				headers: {
					"Authorization": `Bearer ${token}`,
					"Accept": "application/json"
				}
			});

			const data = response.json;
			return data.items || [];
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
			// Timed event
			start = googleEvent.start.dateTime!;
			end = googleEvent.end?.dateTime;
			allDay = false;
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
			url: googleEvent.htmlLink
		};
	}

	/**
	 * Refreshes all enabled Google calendars
	 */
	async refreshAllCalendars(): Promise<void> {
		try {
			const isConnected = await this.oauthService.isConnected("google");
			if (!isConnected) {
				return;
			}

			// Get list of calendars
			const calendars = await this.listCalendars();

			// Get user's selected calendar IDs from settings (if any)
			// For now, fetch from all calendars
			const calendarIds = calendars.map(cal => cal.id);

			// Fetch events from each calendar
			const allEvents: ICSEvent[] = [];
			for (const calendarId of calendarIds) {
				try {
					const googleEvents = await this.fetchCalendarEvents(calendarId);
					const icsEvents = googleEvents.map(event =>
						this.convertToICSEvent(event, calendarId)
					);
					allEvents.push(...icsEvents);
				} catch (error) {
					console.error(`Failed to fetch events from calendar ${calendarId}:`, error);
					// Continue with other calendars
				}
			}

			// Update cache
			this.cache.set("all", allEvents);

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
		return this.cache.get("all") || [];
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
	 * Cleanup method
	 */
	destroy(): void {
		this.stopRefreshTimer();
		this.cache.clear();
		this.removeAllListeners();
	}
}
