import { Notice, requestUrl, TFile } from 'obsidian';
import * as ICAL from 'ical.js';
import { ICSSubscription, ICSEvent, ICSCache } from '../types';
import { EventEmitter } from '../utils/EventEmitter';
import TaskNotesPlugin from '../main';

export class ICSSubscriptionService extends EventEmitter {
    private plugin: TaskNotesPlugin;
    private subscriptions: ICSSubscription[] = [];
    private cache: Map<string, ICSCache> = new Map();
    private refreshTimers: Map<string, number> = new Map();
    private fileWatchers: Map<string, () => void> = new Map(); // For local file change tracking

    constructor(plugin: TaskNotesPlugin) {
        super();
        this.plugin = plugin;
    }

    async initialize(): Promise<void> {
        // Load subscriptions from plugin data
        await this.loadSubscriptions();
        
        // Start refresh timers and file watchers for enabled subscriptions
        this.subscriptions.forEach(subscription => {
            if (subscription.enabled) {
                if (subscription.type === 'remote') {
                    this.startRefreshTimer(subscription);
                } else if (subscription.type === 'local') {
                    this.startFileWatcher(subscription);
                }
            }
        });

        // Emit initial data load
        this.emit('data-changed');
    }

    private async loadSubscriptions(): Promise<void> {
        try {
            const data = await this.plugin.loadData();
            this.subscriptions = data?.icsSubscriptions || [];
        } catch (error) {
            console.error('Failed to load ICS subscriptions:', error);
            this.subscriptions = [];
        }
    }

    private async saveSubscriptions(): Promise<void> {
        try {
            const data = await this.plugin.loadData() || {};
            data.icsSubscriptions = this.subscriptions;
            await this.plugin.saveData(data);
        } catch (error) {
            console.error('Failed to save ICS subscriptions:', error);
            throw error;
        }
    }

    getSubscriptions(): ICSSubscription[] {
        return [...this.subscriptions];
    }

    async addSubscription(subscription: Omit<ICSSubscription, 'id'>): Promise<ICSSubscription> {
        const newSubscription: ICSSubscription = {
            ...subscription,
            id: this.generateId()
        };

        this.subscriptions.push(newSubscription);
        await this.saveSubscriptions();

        if (newSubscription.enabled) {
            if (newSubscription.type === 'remote') {
                this.startRefreshTimer(newSubscription);
                // Immediately fetch the subscription
                await this.fetchSubscription(newSubscription.id);
            } else if (newSubscription.type === 'local') {
                this.startFileWatcher(newSubscription);
                // Immediately read the local file
                await this.fetchSubscription(newSubscription.id);
            }
        }

        this.emit('data-changed');
        return newSubscription;
    }

    async updateSubscription(id: string, updates: Partial<ICSSubscription>): Promise<void> {
        const index = this.subscriptions.findIndex(sub => sub.id === id);
        if (index === -1) {
            throw new Error('Subscription not found');
        }

        const oldSubscription = this.subscriptions[index];
        const updatedSubscription = { ...oldSubscription, ...updates };
        this.subscriptions[index] = updatedSubscription;

        await this.saveSubscriptions();

        // Update refresh timer or file watcher
        this.stopRefreshTimer(id);
        this.stopFileWatcher(id);
        if (updatedSubscription.enabled) {
            if (updatedSubscription.type === 'remote') {
                this.startRefreshTimer(updatedSubscription);
            } else if (updatedSubscription.type === 'local') {
                this.startFileWatcher(updatedSubscription);
            }
        }

        // Clear cache if URL or file path changed
        if ((updates.url && updates.url !== oldSubscription.url) || 
            (updates.filePath && updates.filePath !== oldSubscription.filePath)) {
            this.cache.delete(id);
        }

        this.emit('data-changed');
    }

    async removeSubscription(id: string): Promise<void> {
        const index = this.subscriptions.findIndex(sub => sub.id === id);
        if (index === -1) {
            throw new Error('Subscription not found');
        }

        this.subscriptions.splice(index, 1);
        await this.saveSubscriptions();

        // Clean up
        this.stopRefreshTimer(id);
        this.stopFileWatcher(id);
        this.cache.delete(id);

        this.emit('data-changed');
    }

    async fetchSubscription(id: string): Promise<void> {
        const subscription = this.subscriptions.find(sub => sub.id === id);
        if (!subscription || !subscription.enabled) {
            return;
        }

        try {
            let icsData: string;

            if (subscription.type === 'remote') {
                if (!subscription.url) {
                    throw new Error('Remote subscription missing URL');
                }

                const response = await requestUrl({
                    url: subscription.url,
                    method: 'GET',
                    headers: {
                        'Accept': 'text/calendar,application/calendar+xml,text/plain',
                        'User-Agent': 'TaskNotes-Plugin/1.0'
                    }
                });

                icsData = response.text;
            } else if (subscription.type === 'local') {
                if (!subscription.filePath) {
                    throw new Error('Local subscription missing file path');
                }

                icsData = await this.readLocalICSFile(subscription.filePath);
            } else {
                throw new Error('Unknown subscription type');
            }

            const events = this.parseICS(icsData, subscription.id);

            // Update cache
            const cache: ICSCache = {
                subscriptionId: id,
                events,
                lastUpdated: new Date().toISOString(),
                expires: new Date(Date.now() + subscription.refreshInterval * 60 * 1000).toISOString()
            };
            this.cache.set(id, cache);

            // Update subscription metadata
            await this.updateSubscription(id, {
                lastFetched: new Date().toISOString(),
                lastError: undefined
            });

            this.emit('data-changed');

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // Update subscription with error
            await this.updateSubscription(id, {
                lastError: errorMessage
            });

            // Show user notification for errors with more helpful message
            if (subscription.type === 'remote') {
                if (errorMessage.includes('404')) {
                    new Notice(`Calendar "${subscription.name}" not found (404). Please check the ICS URL is correct and the calendar is publicly accessible.`);
                } else {
                    new Notice(`Failed to fetch remote calendar "${subscription.name}": ${errorMessage}`);
                }
            } else {
                new Notice(`Failed to read local calendar "${subscription.name}": ${errorMessage}`);
            }
        }
    }


    private parseICS(icsData: string, subscriptionId: string): ICSEvent[] {
        try {
            const jcalData = ICAL.parse(icsData);
            const comp = new ICAL.Component(jcalData);

            // Register VTIMEZONE components before processing events
            const vtimezones = comp.getAllSubcomponents('vtimezone');
            vtimezones.forEach((vtimezone: ICAL.Component) => {
                (ICAL as any).TimezoneService.register(vtimezone);
            });

            const vevents = comp.getAllSubcomponents('vevent');
            const events: ICSEvent[] = [];
            
            // Maps to track recurring event exceptions
            const modifiedInstances = new Map<string, Map<string, ICAL.Event>>(); // uid -> Map of recurrence-id to Event
            
            // First pass: identify exceptions and modified instances
            vevents.forEach((vevent: ICAL.Component) => {
                const event = new ICAL.Event(vevent);
                const uid = event.uid;
                
                if (!uid) return;
                
                // Check if this is a modified instance (has RECURRENCE-ID)
                const recurrenceId = (vevent as any).getFirstPropertyValue('recurrence-id');
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
                    const recurrenceId = (vevent as any).getFirstPropertyValue('recurrence-id');
                    if (recurrenceId) {
                        return;
                    }
                    
                    // Extract basic properties
                    const summary = event.summary || 'Untitled Event';
                    const description = event.description || undefined;
                    const location = event.location || undefined;
                    
                    // Handle start and end times
                    const startDate = event.startDate;
                    const endDate = event.endDate;
                    
                    if (!startDate) {
                        return; // Skip events without start date
                    }

                    const isAllDay = startDate.isDate;
                    const startISO = startDate.toJSDate().toISOString();
                    const endISO = endDate ? endDate.toJSDate().toISOString() : undefined;

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
                        url: event.url || undefined
                    };

                    // Handle recurring events
                    if (event.isRecurring()) {
                        // Parse EXDATE (exception dates) - dates to exclude from the recurrence
                        const exdates = new Set<string>();
                        const exdateProp = (vevent as any).getAllProperties('exdate');
                        exdateProp.forEach((prop: any) => {
                            const exdateValue = prop.getFirstValue();
                            if (exdateValue) {
                                // Handle both single dates and arrays of dates
                                const dates = Array.isArray(exdateValue) ? exdateValue : [exdateValue];
                                dates.forEach(date => {
                                    if (date && typeof date.toString === 'function') {
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
                                        start: modifiedStart.toJSDate().toISOString(),
                                        end: modifiedEnd ? modifiedEnd.toJSDate().toISOString() : undefined,
                                        allDay: modifiedStart.isDate,
                                        location: modifiedEvent.location || location,
                                        url: modifiedEvent.url || icsEvent.url
                                    });
                                }
                            } else {
                                // Use the original recurring event instance
                                const instanceStart = occurrence.toJSDate().toISOString();
                                let instanceEnd = endISO;
                                
                                if (endDate && startDate) {
                                    const duration = endDate.toJSDate().getTime() - startDate.toJSDate().getTime();
                                    instanceEnd = new Date(occurrence.toJSDate().getTime() + duration).toISOString();
                                }

                                events.push({
                                    ...icsEvent,
                                    id: `${eventId}-${instanceCount}`,
                                    start: instanceStart,
                                    end: instanceEnd
                                });
                            }

                            instanceCount++;
                        }
                    } else {
                        events.push(icsEvent);
                    }

                } catch (eventError) {
                    console.warn('Failed to parse individual event:', eventError);
                }
            });

            return events;

        } catch (error) {
            console.error('Failed to parse ICS data:', error);
            throw new Error('Invalid ICS format');
        }
    }

    getAllEvents(): ICSEvent[] {
        const allEvents: ICSEvent[] = [];
        
        this.cache.forEach(cache => {
            // Check if cache is still valid
            if (new Date(cache.expires) > new Date()) {
                allEvents.push(...cache.events);
            }
        });

        return allEvents;
    }

    getEventsForSubscription(subscriptionId: string): ICSEvent[] {
        const cache = this.cache.get(subscriptionId);
        if (!cache || new Date(cache.expires) <= new Date()) {
            return [];
        }
        return [...cache.events];
    }

    async refreshAllSubscriptions(): Promise<void> {
        const enabledSubscriptions = this.subscriptions.filter(sub => sub.enabled);
        
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

            if (file.extension !== 'ics') {
                throw new Error(`File is not an ICS file: ${filePath}`);
            }

            return await this.plugin.app.vault.cachedRead(file);
        } catch (error) {
            throw new Error(`Failed to read local ICS file "${filePath}": ${error instanceof Error ? error.message : String(error)}`);
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
        const modifyRef = this.plugin.app.vault.on('modify', watcherCallback);
        const renameRef = this.plugin.app.vault.on('rename', watcherCallback);
        const deleteRef = this.plugin.app.vault.on('delete', (file) => {
            if (file.path === subscription.filePath) {
                this.updateSubscription(subscription.id, {
                    lastError: 'Local ICS file was deleted'
                });
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
        return 'ics_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    }

    destroy(): void {
        // Clear all timers
        this.refreshTimers.forEach(timer => clearInterval(timer));
        this.refreshTimers.clear();
        
        // Clear all file watchers
        this.fileWatchers.forEach(cleanup => cleanup());
        this.fileWatchers.clear();
        
        // Clear cache
        this.cache.clear();
        
        // Clear event listeners
        this.removeAllListeners();
    }

    // Helper method to suggest local ICS files
    getLocalICSFiles(): TFile[] {
        return this.plugin.app.vault.getFiles()
            .filter(file => file.extension === 'ics')
            .sort((a, b) => a.path.localeCompare(b.path));
    }
}