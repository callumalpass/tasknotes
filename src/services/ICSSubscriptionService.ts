/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Notice, requestUrl, TFile } from "obsidian";
import ICAL from "ical.js";
import { ICSSubscription, ICSEvent, ICSCache } from "../types";
import { EventEmitter } from "../utils/EventEmitter";
import TaskNotesPlugin from "../main";
import { TranslationKey } from "../i18n";

export class ICSSubscriptionService extends EventEmitter {
	private plugin: TaskNotesPlugin;
	private subscriptions: ICSSubscription[] = [];
	private cache: Map<string, ICSCache> = new Map();
	private refreshTimers: Map<string, number> = new Map();
	private fileWatchers: Map<string, () => void> = new Map(); // For local file change tracking
	private pendingRefreshes: Set<string> = new Set(); // Track in-progress refreshes to avoid duplicates
	private lastFetched: Map<string, string> = new Map(); // In-memory storage for last fetch timestamps (ISO strings)
	private lastError: Map<string, string> = new Map(); // In-memory storage for last error messages

	// Grace period after cache expiration to show stale data while refreshing (5 minutes)
	private readonly CACHE_GRACE_PERIOD = 5 * 60 * 1000;

	private translate(key: TranslationKey, variables?: Record<string, any>): string {
		return this.plugin.i18n.translate(key, variables);
	}

	/**
	 * Converts an ICAL.Time object to an ISO string with proper timezone handling.
	 *
	 * For timed events, uses toUnixTime() which correctly handles all timezones.
	 * For all-day events, preserves the date without time conversion.
	 *
	 * This fixes issues with:
	 * - Non-IANA timezones (e.g., TZID=Zurich without VTIMEZONE)
	 * - Floating time events
	 * - Outlook/Exchange timezone formats
	 */
	private icalTimeToISOString(icalTime: ICAL.Time): string {
		// For all-day events, return date-only string (YYYY-MM-DD)
		// This preserves the calendar date semantics without timezone ambiguity
		// per iCalendar RFC 5545 specification for VALUE=DATE events
		if (icalTime.isDate) {
			const year = icalTime.year.toString().padStart(4, '0');
			const month = icalTime.month.toString().padStart(2, '0');
			const day = icalTime.day.toString().padStart(2, '0');
			return `${year}-${month}-${day}`;
		}

		// For timed events, use toUnixTime() which correctly converts to UTC
		// This handles all timezone cases properly, including:
		// - Events with proper VTIMEZONE definitions
		// - Events with non-IANA TZIDs (treated as floating)
		// - Floating time events
		const unixTime = icalTime.toUnixTime();
		return new Date(unixTime * 1000).toISOString();
	}

	constructor(plugin: TaskNotesPlugin) {
		super();
		this.plugin = plugin;
	}

	async initialize(): Promise<void> {
		// Load subscriptions from plugin data
		await this.loadSubscriptions();

		// Start refresh timers and file watchers for enabled subscriptions
		// Also immediately fetch subscriptions that don't have valid cache
		const fetchPromises: Promise<void>[] = [];
		this.subscriptions.forEach((subscription) => {
			if (subscription.enabled) {
				if (subscription.type === "remote") {
					this.startRefreshTimer(subscription);
				} else if (subscription.type === "local") {
					this.startFileWatcher(subscription);
				}

				// Immediately fetch if no cache or cache is expired
				const cache = this.cache.get(subscription.id);
				if (!cache || new Date(cache.expires) <= new Date()) {
					fetchPromises.push(this.fetchSubscription(subscription.id));
				}
			}
		});

		// Wait for initial fetches to complete
		await Promise.allSettled(fetchPromises);

		// Emit initial data load
		this.emit("data-changed");
	}

	private async loadSubscriptions(): Promise<void> {
		try {
			const data = await this.plugin.loadData();
			this.subscriptions = data?.icsSubscriptions || [];
		} catch (error) {
			console.error("Failed to load ICS subscriptions:", error);
			this.subscriptions = [];
		}
	}

	private async saveSubscriptions(): Promise<void> {
		try {
			const data = (await this.plugin.loadData()) || {};
			data.icsSubscriptions = this.subscriptions;
			await this.plugin.saveData(data);
		} catch (error) {
			console.error("Failed to save ICS subscriptions:", error);
			throw error;
		}
	}

	getSubscriptions(): ICSSubscription[] {
		return [...this.subscriptions];
	}

	getLastFetched(id: string): string | undefined {
		return this.lastFetched.get(id);
	}

	getLastError(id: string): string | undefined {
		return this.lastError.get(id);
	}

	async addSubscription(subscription: Omit<ICSSubscription, "id">): Promise<ICSSubscription> {
		const newSubscription: ICSSubscription = {
			...subscription,
			id: this.generateId(),
		};

		this.subscriptions.push(newSubscription);
		await this.saveSubscriptions();

		if (newSubscription.enabled) {
			if (newSubscription.type === "remote") {
				this.startRefreshTimer(newSubscription);
				// Immediately fetch the subscription
				await this.fetchSubscription(newSubscription.id);
			} else if (newSubscription.type === "local") {
				this.startFileWatcher(newSubscription);
				// Immediately read the local file
				await this.fetchSubscription(newSubscription.id);
			}
		}

		this.emit("data-changed");
		return newSubscription;
	}

	async updateSubscription(id: string, updates: Partial<ICSSubscription>): Promise<void> {
		const index = this.subscriptions.findIndex((sub) => sub.id === id);
		if (index === -1) {
			throw new Error("Subscription not found");
		}

		const oldSubscription = this.subscriptions[index];
		const updatedSubscription = { ...oldSubscription, ...updates };
		this.subscriptions[index] = updatedSubscription;

		await this.saveSubscriptions();

		// Update refresh timer or file watcher
		this.stopRefreshTimer(id);
		this.stopFileWatcher(id);
		if (updatedSubscription.enabled) {
			if (updatedSubscription.type === "remote") {
				this.startRefreshTimer(updatedSubscription);
			} else if (updatedSubscription.type === "local") {
				this.startFileWatcher(updatedSubscription);
			}
		}

		// Clear cache if URL or file path changed
		if (
			(updates.url && updates.url !== oldSubscription.url) ||
			(updates.filePath && updates.filePath !== oldSubscription.filePath)
		) {
			this.cache.delete(id);
		}

		this.emit("data-changed");
	}

	async removeSubscription(id: string): Promise<void> {
		const index = this.subscriptions.findIndex((sub) => sub.id === id);
		if (index === -1) {
			throw new Error("Subscription not found");
		}

		this.subscriptions.splice(index, 1);
		await this.saveSubscriptions();

		// Clean up
		this.stopRefreshTimer(id);
		this.stopFileWatcher(id);
		this.cache.delete(id);
		this.lastFetched.delete(id);
		this.lastError.delete(id);

		this.emit("data-changed");
	}

	async fetchSubscription(id: string): Promise<void> {
		const subscription = this.subscriptions.find((sub) => sub.id === id);
		if (!subscription || !subscription.enabled) {
			return;
		}

		try {
			let icsData: string;

			if (subscription.type === "remote") {
				if (!subscription.url) {
					throw new Error("Remote subscription missing URL");
				}

				const response = await requestUrl({
					url: subscription.url,
					method: "GET",
					headers: {
						Accept: "text/calendar,*/*;q=0.1",
						"Accept-Language": "en-US,en;q=0.9",
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
					},
				});

				icsData = response.text;
			} else if (subscription.type === "local") {
				if (!subscription.filePath) {
					throw new Error("Local subscription missing file path");
				}

				icsData = await this.readLocalICSFile(subscription.filePath);
			} else {
				throw new Error("Unknown subscription type");
			}

			const events = this.parseICS(icsData, subscription.id);

			// Update cache
			const cache: ICSCache = {
				subscriptionId: id,
				events,
				lastUpdated: new Date().toISOString(),
				expires: new Date(
					Date.now() + subscription.refreshInterval * 60 * 1000
				).toISOString(),
			};
			this.cache.set(id, cache);

			// Update in-memory metadata
			this.lastFetched.set(id, new Date().toISOString());
			this.lastError.delete(id);

			this.emit("data-changed");
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);

			// Update in-memory error
			this.lastError.set(id, errorMessage);

			// Show user notification for errors with more helpful message
			if (subscription.type === "remote") {
				if (errorMessage.includes("404")) {
					new Notice(
						this.translate("services.icsSubscription.notices.calendarNotFound", {
							name: subscription.name,
						})
					);
				} else if (
					errorMessage.includes("500") ||
					errorMessage.includes("OwaBasicUnsupportedException")
				) {
					new Notice(
						this.translate("services.icsSubscription.notices.calendarAccessDenied", {
							name: subscription.name,
						})
					);
				} else {
					new Notice(
						this.translate("services.icsSubscription.notices.fetchRemoteFailed", {
							name: subscription.name,
							error: errorMessage,
						})
					);
				}
			} else {
				new Notice(
					this.translate("services.icsSubscription.notices.readLocalFailed", {
						name: subscription.name,
						error: errorMessage,
					})
				);
			}
		}
	}

	private parseICS(icsData: string, subscriptionId: string): ICSEvent[] {
		try {
			const jcalData = ICAL.parse(icsData);
			const comp = new ICAL.Component(jcalData);

			// Register VTIMEZONE components before processing events
			const vtimezones = comp.getAllSubcomponents("vtimezone");
			vtimezones.forEach((vtimezone: ICAL.Component) => {
				(ICAL as any).TimezoneService.register(vtimezone);
			});

			const vevents = comp.getAllSubcomponents("vevent");
			const events: ICSEvent[] = [];

			// Maps to track recurring event exceptions
			const modifiedInstances = new Map<string, Map<string, ICAL.Event>>(); // uid -> Map of recurrence-id to Event

			// First pass: identify exceptions and modified instances
			vevents.forEach((vevent: ICAL.Component) => {
				const event = new ICAL.Event(vevent);
				const uid = event.uid;

				if (!uid) return;

				// Check if this is a modified instance (has RECURRENCE-ID)
				const recurrenceId = (vevent as any).getFirstPropertyValue("recurrence-id");
				if (recurrenceId) {
					if (!modifiedInstances.has(uid)) {
						modifiedInstances.set(uid, new Map());
					}
					const recurrenceIdStr = recurrenceId.toString();
					modifiedInstances.get(uid)!.set(recurrenceIdStr, event);
				}
			});

			// Second pass: process events
			vevents.forEach((vevent: ICAL.Component) => {
				try {
					const event = new ICAL.Event(vevent);

					// Skip if this is a modified instance (will be handled as part of the recurring series)
					const recurrenceId = (vevent as any).getFirstPropertyValue("recurrence-id");
					if (recurrenceId) {
						return;
					}

					// Skip cancelled events (STATUS:CANCELLED)
					const status = (vevent as any).getFirstPropertyValue("status");
					if (typeof status === "string" && status.toUpperCase() === "CANCELLED") {
						return;
					}

					// Skip events the user has declined.
					// In a personal calendar's ICS feed the owner's ATTENDEE
					// entry carries their own PARTSTAT, so if any attendee is
					// marked DECLINED the event was almost certainly declined
					// by the calendar owner.
					const attendees = (vevent as any).getAllProperties("attendee");
					if (attendees && attendees.length > 0) {
						const hasDeclined = attendees.some(
							(a: any) => {
								const partstat = a.getParameter("partstat");
								return typeof partstat === "string" && partstat.toUpperCase() === "DECLINED";
							}
						);
						if (hasDeclined) {
							return;
						}
					}

					// Extract basic properties
					const summary = event.summary || "Untitled Event";
					const description = event.description || undefined;
					const location = event.location || undefined;

					// Handle start and end times
					const startDate = event.startDate;
					const endDate = event.endDate;

					if (!startDate) {
						return; // Skip events without start date
					}

					const isAllDay = startDate.isDate;
					const startISO = this.icalTimeToISOString(startDate);
					const endISO = endDate ? this.icalTimeToISOString(endDate) : undefined;

					// Generate unique ID
					const uid = event.uid || `${subscriptionId}-${events.length}`;
					const eventId = `${subscriptionId}-${uid}`;

					const icsEvent: ICSEvent = {
						id: eventId,
						subscriptionId: subscriptionId,
						title: summary,
						description: description,
						start: startISO,
						end: endISO,
						allDay: isAllDay,
						location: location,
						url: event.url || undefined,
					};

					// Handle recurring events
					if (event.isRecurring()) {
						// Parse EXDATE (exception dates) - dates to exclude from the recurrence
						const exdates = new Set<string>();
						const exdateProp = (vevent as any).getAllProperties("exdate");
						exdateProp.forEach((prop: any) => {
							const exdateValue = prop.getFirstValue();
							if (exdateValue) {
								// Handle both single dates and arrays of dates
								const dates = Array.isArray(exdateValue)
									? exdateValue
									: [exdateValue];
								dates.forEach((date) => {
									if (date && typeof date.toString === "function") {
										exdates.add(date.toString());
									}
								});
							}
						});

						// Get modified instances for this UID
						const modifiedForThisEvent = modifiedInstances.get(uid) || new Map();

						// Generate instances for the next year
						const iterator = event.iterator(startDate);
						const maxDate = new ICAL.Time();
						maxDate.fromJSDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)); // One year from now

						let occurrence;
						let instanceCount = 0;
						const maxInstances = 100; // Prevent infinite loops

						while ((occurrence = iterator.next()) && instanceCount < maxInstances) {
							if (occurrence.compare(maxDate) > 0) {
								break;
							}

							const occurrenceStr = occurrence.toString();

							// Skip if this date is in EXDATE
							if (exdates.has(occurrenceStr)) {
								instanceCount++;
								continue;
							}

							// Check if this instance has been modified
							const modifiedEvent = modifiedForThisEvent.get(occurrenceStr);
							if (modifiedEvent) {
								// Use the modified event instead
								const modifiedStart = modifiedEvent.startDate;
								const modifiedEnd = modifiedEvent.endDate;

								if (modifiedStart) {
									events.push({
										id: `${eventId}-${instanceCount}`,
										subscriptionId: subscriptionId,
										title: modifiedEvent.summary || summary,
										description: modifiedEvent.description || description,
										start: this.icalTimeToISOString(modifiedStart),
										end: modifiedEnd
											? this.icalTimeToISOString(modifiedEnd)
											: undefined,
										allDay: modifiedStart.isDate,
										location: modifiedEvent.location || location,
										url: modifiedEvent.url || icsEvent.url,
									});
								}
							} else {
								// Use the original recurring event instance
								const instanceStart = this.icalTimeToISOString(occurrence);
								let instanceEnd = endISO;

								if (endDate && startDate) {
									// Calculate duration using Unix timestamps for accuracy
									const duration = endDate.toUnixTime() - startDate.toUnixTime();
									const instanceEndTime = occurrence.toUnixTime() + duration;
									instanceEnd = new Date(instanceEndTime * 1000).toISOString();
								}

								events.push({
									...icsEvent,
									id: `${eventId}-${instanceCount}`,
									start: instanceStart,
									end: instanceEnd,
								});
							}

							instanceCount++;
						}
					} else {
						events.push(icsEvent);
					}
				} catch (eventError) {
					console.warn("Failed to parse individual event:", eventError);
				}
			});

			return events;
		} catch (error) {
			console.error("Failed to parse ICS data:", error);
			throw new Error("Invalid ICS format");
		}
	}

	getAllEvents(): ICSEvent[] {
		const allEvents: ICSEvent[] = [];
		const now = new Date();

		// Check all enabled subscriptions, not just those with cache
		this.subscriptions.forEach((subscription) => {
			if (!subscription.enabled) {
				return;
			}

			const cache = this.cache.get(subscription.id);

			if (!cache) {
				// No cache exists - trigger immediate fetch
				if (!this.pendingRefreshes.has(subscription.id)) {
					this.pendingRefreshes.add(subscription.id);
					this.fetchSubscription(subscription.id)
						.finally(() => this.pendingRefreshes.delete(subscription.id));
				}
				return;
			}

			const expiryDate = new Date(cache.expires);
			const gracePeriodEnd = new Date(expiryDate.getTime() + this.CACHE_GRACE_PERIOD);

			// Return events if within grace period
			if (now < gracePeriodEnd) {
				allEvents.push(...cache.events);

				// Trigger refresh if cache expired but within grace period
				const isStale = now > expiryDate;
				if (isStale && !this.pendingRefreshes.has(subscription.id)) {
					this.pendingRefreshes.add(subscription.id);
					this.fetchSubscription(subscription.id)
						.finally(() => this.pendingRefreshes.delete(subscription.id));
				}
			} else {
				// Cache is expired beyond grace period - trigger fetch
				if (!this.pendingRefreshes.has(subscription.id)) {
					this.pendingRefreshes.add(subscription.id);
					this.fetchSubscription(subscription.id)
						.finally(() => this.pendingRefreshes.delete(subscription.id));
				}
			}
		});

		return allEvents;
	}

	getEventsForSubscription(subscriptionId: string): ICSEvent[] {
		const cache = this.cache.get(subscriptionId);
		if (!cache) {
			// No cache exists - trigger immediate fetch for enabled subscriptions
			const subscription = this.subscriptions.find(sub => sub.id === subscriptionId);
			if (subscription && subscription.enabled && !this.pendingRefreshes.has(subscriptionId)) {
				this.pendingRefreshes.add(subscriptionId);
				this.fetchSubscription(subscriptionId)
					.finally(() => this.pendingRefreshes.delete(subscriptionId));
			}
			return [];
		}

		const now = new Date();
		const expiryDate = new Date(cache.expires);
		const gracePeriodEnd = new Date(expiryDate.getTime() + this.CACHE_GRACE_PERIOD);

		// Return events if within grace period
		if (now >= gracePeriodEnd) {
			// Cache expired beyond grace period - trigger fetch
			if (!this.pendingRefreshes.has(subscriptionId)) {
				this.pendingRefreshes.add(subscriptionId);
				this.fetchSubscription(subscriptionId)
					.finally(() => this.pendingRefreshes.delete(subscriptionId));
			}
			return [];
		}

		// Trigger refresh if cache expired but within grace period
		const isStale = now > expiryDate;
		if (isStale && !this.pendingRefreshes.has(subscriptionId)) {
			this.pendingRefreshes.add(subscriptionId);
			this.fetchSubscription(subscriptionId)
				.finally(() => this.pendingRefreshes.delete(subscriptionId));
		}

		return [...cache.events];
	}

	async refreshAllSubscriptions(): Promise<void> {
		const enabledSubscriptions = this.subscriptions.filter((sub) => sub.enabled);

		for (const subscription of enabledSubscriptions) {
			await this.fetchSubscription(subscription.id);
		}
	}

	private async readLocalICSFile(filePath: string): Promise<string> {
		try {
			const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
			if (!file || !(file instanceof TFile)) {
				throw new Error(`File not found: ${filePath}`);
			}

			if (file.extension !== "ics") {
				throw new Error(`File is not an ICS file: ${filePath}`);
			}

			return await this.plugin.app.vault.cachedRead(file);
		} catch (error) {
			throw new Error(
				`Failed to read local ICS file "${filePath}": ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	private startFileWatcher(subscription: ICSSubscription): void {
		if (!subscription.filePath) {
			return;
		}

		this.stopFileWatcher(subscription.id);

		// Register file watcher with Obsidian's vault
		const watcherCallback = (file: TFile, oldPath?: string) => {
			if (file.path === subscription.filePath || oldPath === subscription.filePath) {
				// Debounce file changes to avoid excessive updates
				setTimeout(() => {
					this.fetchSubscription(subscription.id);
				}, 1000);
			}
		};

		// Register event handlers for file modifications
		const modifyRef = this.plugin.app.vault.on("modify", watcherCallback);
		const renameRef = this.plugin.app.vault.on("rename", watcherCallback);
		const deleteRef = this.plugin.app.vault.on("delete", (file) => {
			if (file.path === subscription.filePath) {
				this.lastError.set(subscription.id, "Local ICS file was deleted");
			}
		});

		// Store cleanup function
		this.fileWatchers.set(subscription.id, () => {
			this.plugin.app.vault.offref(modifyRef);
			this.plugin.app.vault.offref(renameRef);
			this.plugin.app.vault.offref(deleteRef);
		});

		// Set up periodic refresh for local files (less frequent than remote)
		const intervalMs = subscription.refreshInterval * 60 * 1000;
		const timer = setInterval(() => {
			this.fetchSubscription(subscription.id);
		}, intervalMs);

		this.refreshTimers.set(subscription.id, timer as unknown as number);
	}

	private stopFileWatcher(id: string): void {
		const cleanup = this.fileWatchers.get(id);
		if (cleanup) {
			cleanup();
			this.fileWatchers.delete(id);
		}
	}

	async refreshSubscription(id: string): Promise<void> {
		await this.fetchSubscription(id);
	}

	private startRefreshTimer(subscription: ICSSubscription): void {
		this.stopRefreshTimer(subscription.id);

		const intervalMs = subscription.refreshInterval * 60 * 1000; // Convert minutes to milliseconds
		const timer = setInterval(() => {
			this.fetchSubscription(subscription.id);
		}, intervalMs);

		this.refreshTimers.set(subscription.id, timer as unknown as number);
	}

	private stopRefreshTimer(id: string): void {
		const timer = this.refreshTimers.get(id);
		if (timer) {
			clearInterval(timer);
			this.refreshTimers.delete(id);
		}
	}

	private generateId(): string {
		return "ics_" + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
	}

	destroy(): void {
		// Clear all timers
		this.refreshTimers.forEach((timer) => clearInterval(timer));
		this.refreshTimers.clear();

		// Clear all file watchers
		this.fileWatchers.forEach((cleanup) => cleanup());
		this.fileWatchers.clear();

		// Clear cache
		this.cache.clear();

		// Clear pending refreshes
		this.pendingRefreshes.clear();

		// Clear event listeners
		this.removeAllListeners();
	}

	// Helper method to suggest local ICS files
	getLocalICSFiles(): TFile[] {
		return this.plugin.app.vault
			.getFiles()
			.filter((file) => file.extension === "ics")
			.sort((a, b) => a.path.localeCompare(b.path));
	}
}
