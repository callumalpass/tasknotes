/**
 * Calendar Provider Abstraction
 *
 * Provides a common interface for different calendar services (Google, Microsoft, etc.)
 * This allows the codebase to interact with any calendar provider through a unified API.
 */

import { ICSEvent } from "../types";
import { EventEmitter } from "../utils/EventEmitter";

/**
 * Represents a calendar from any provider
 */
export interface ProviderCalendar {
	id: string;
	summary: string;
	description?: string;
	backgroundColor?: string;
	primary?: boolean;
}

/**
 * Event date/time configuration
 * Supports both all-day events (date) and timed events (dateTime)
 */
export interface EventDateTime {
	/** For all-day events: YYYY-MM-DD format */
	date?: string;
	/** For timed events: ISO 8601 format with timezone */
	dateTime?: string;
	/** Timezone (IANA format, e.g., "America/New_York") */
	timeZone?: string;
}

/**
 * Event data structure for creating/updating events
 */
export interface CalendarEventData {
	summary: string;
	description?: string;
	start: EventDateTime;
	end: EventDateTime;
	location?: string;
}

/**
 * Abstract base class for calendar providers
 * Provides common functionality and enforces the contract
 */
export abstract class CalendarProvider extends EventEmitter {
	/** Provider identifier (e.g., "google", "microsoft") */
	abstract readonly providerId: string;

	/** Human-readable provider name (e.g., "Google Calendar", "Microsoft Calendar") */
	abstract readonly providerName: string;

	/**
	 * Initializes the calendar service
	 * Fetches initial data and starts refresh timers
	 */
	abstract initialize(): Promise<void>;

	/**
	 * Lists all calendars available to the user
	 */
	abstract listCalendars(): Promise<ProviderCalendar[]>;

	/**
	 * Gets all cached calendar events in TaskNotes ICSEvent format
	 */
	abstract getAllEvents(): ICSEvent[];

	/**
	 * Gets the list of available calendars
	 */
	abstract getAvailableCalendars(): ProviderCalendar[];

	/**
	 * Refreshes calendar data from the provider
	 * Typically uses incremental sync when available
	 */
	abstract refresh(): Promise<void>;

	/**
	 * Updates an existing calendar event
	 * @param calendarId The calendar containing the event
	 * @param eventId The event to update
	 * @param updates Partial event data to update
	 */
	abstract updateEvent(
		calendarId: string,
		eventId: string,
		updates: Partial<CalendarEventData>
	): Promise<void>;

	/**
	 * Creates a new calendar event
	 * @param calendarId The calendar to create the event in
	 * @param event The event data
	 * @returns The ID of the created event
	 */
	abstract createEvent(
		calendarId: string,
		event: CalendarEventData
	): Promise<string>;

	/**
	 * Deletes a calendar event
	 * @param calendarId The calendar containing the event
	 * @param eventId The event to delete
	 */
	abstract deleteEvent(calendarId: string, eventId: string): Promise<void>;

	/**
	 * Creates a new calendar
	 * @param summary The calendar name
	 * @param description Optional calendar description
	 * @returns The ID of the created calendar
	 */
	abstract createCalendar(summary: string, description?: string): Promise<string>;

	/**
	 * Clears all cached data
	 */
	abstract clearCache(): void;

	/**
	 * Cleanup method called when the service is destroyed
	 */
	abstract destroy(): void;

	/**
	 * Checks if an ICS event belongs to this provider
	 * Used by calendar views to determine which provider to use
	 * @param icsEvent The ICS event to check
	 * @returns true if this provider owns the event
	 */
	ownsEvent(icsEvent: ICSEvent): boolean {
		// Default implementation: check if subscriptionId starts with provider ID
		return icsEvent.subscriptionId?.startsWith(`${this.providerId}-`) ?? false;
	}

	/**
	 * Extracts the provider-specific calendar ID and event ID from an ICS event
	 * @param icsEvent The ICS event
	 * @returns Object with calendarId and eventId
	 */
	extractEventIds(icsEvent: ICSEvent): { calendarId: string; eventId: string } {
		// Default implementation for standard format: "providerId-calendarId" and "providerId-calendarId-eventId"
		const calendarId = icsEvent.subscriptionId.replace(`${this.providerId}-`, "");
		const eventId = icsEvent.id.replace(`${this.providerId}-${calendarId}-`, "");
		return { calendarId, eventId };
	}
}

/**
 * Registry for managing multiple calendar providers
 * Allows calendar views to work with any provider through a common interface
 */
export class CalendarProviderRegistry {
	private providers: Map<string, CalendarProvider> = new Map();

	/**
	 * Registers a calendar provider
	 * @param provider The provider to register
	 */
	register(provider: CalendarProvider): void {
		this.providers.set(provider.providerId, provider);
	}

	/**
	 * Unregisters a calendar provider
	 * @param providerId The provider ID to unregister
	 */
	unregister(providerId: string): void {
		this.providers.delete(providerId);
	}

	/**
	 * Gets a provider by ID
	 * @param providerId The provider ID
	 * @returns The provider, or undefined if not found
	 */
	getProvider(providerId: string): CalendarProvider | undefined {
		return this.providers.get(providerId);
	}

	/**
	 * Gets all registered providers
	 */
	getAllProviders(): CalendarProvider[] {
		return Array.from(this.providers.values());
	}

	/**
	 * Finds the provider that owns an ICS event
	 * @param icsEvent The ICS event
	 * @returns The provider that owns the event, or undefined if none found
	 */
	findProviderForEvent(icsEvent: ICSEvent): CalendarProvider | undefined {
		for (const provider of this.providers.values()) {
			if (provider.ownsEvent(icsEvent)) {
				return provider;
			}
		}
		return undefined;
	}

	/**
	 * Gets all cached events from all providers
	 */
	getAllEvents(): ICSEvent[] {
		const allEvents: ICSEvent[] = [];
		for (const provider of this.providers.values()) {
			allEvents.push(...provider.getAllEvents());
		}
		return allEvents;
	}

	/**
	 * Refreshes all registered providers
	 */
	async refreshAll(): Promise<void> {
		const refreshPromises = Array.from(this.providers.values()).map(provider =>
			provider.refresh().catch(error => {
				console.error(`Failed to refresh ${provider.providerName}:`, error);
			})
		);
		await Promise.all(refreshPromises);
	}

	/**
	 * Destroys all registered providers
	 */
	destroyAll(): void {
		for (const provider of this.providers.values()) {
			provider.destroy();
		}
		this.providers.clear();
	}
}
