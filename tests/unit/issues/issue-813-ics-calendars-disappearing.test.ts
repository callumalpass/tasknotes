import { ICSSubscriptionService } from '../../../src/services/ICSSubscriptionService';
import { ICSSubscription } from '../../../src/types';

// Mock Obsidian's dependencies
jest.mock('obsidian', () => ({
    Notice: jest.fn(),
    requestUrl: jest.fn(),
    TFile: jest.fn()
}));

// Mock ical.js
jest.mock('ical.js', () => ({
    default: {
        parse: jest.fn(),
        Component: jest.fn(),
        Event: jest.fn(),
        Time: jest.fn(),
        TimezoneService: {
            register: jest.fn()
        }
    }
}));

describe('Issue #813 - ICS Calendars Disappearing', () => {
    let service: ICSSubscriptionService;
    let mockPlugin: any;

    beforeEach(() => {
        // Mock plugin
        mockPlugin = {
            loadData: jest.fn().mockResolvedValue({ icsSubscriptions: [] }),
            saveData: jest.fn().mockResolvedValue(undefined),
            app: {
                vault: {
                    getAbstractFileByPath: jest.fn(),
                    cachedRead: jest.fn(),
                    getFiles: jest.fn().mockReturnValue([]),
                    on: jest.fn(),
                    offref: jest.fn()
                }
            },
            i18n: {
                translate: jest.fn((key: string) => key)
            }
        };

        service = new ICSSubscriptionService(mockPlugin);
    });

    afterEach(() => {
        // Cleanup timers
        service.destroy();
    });

    describe('Cache Expiration Fix', () => {
        it('should still return events when cache has expired within grace period', async () => {
            // Initialize service with a subscription
            await service.initialize();

            // Add a subscription
            const subscription = await service.addSubscription({
                name: 'Test Calendar',
                url: 'https://example.com/calendar.ics',
                type: 'remote',
                enabled: true,
                color: '#ff0000',
                refreshInterval: 60 // 60 minutes
            });

            // Manually populate cache with expired data (but within grace period)
            const expiredCache = {
                subscriptionId: subscription.id,
                events: [
                    {
                        id: `${subscription.id}-event1`,
                        subscriptionId: subscription.id,
                        title: 'Test Event',
                        start: new Date().toISOString(),
                        allDay: false
                    }
                ],
                lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
                expires: new Date(Date.now() - 60 * 1000).toISOString() // Expired 1 minute ago (within 5 min grace period)
            };

            // Access private cache property
            (service as any).cache.set(subscription.id, expiredCache);

            // Try to get events - should still return events due to grace period
            const events = service.getAllEvents();

            // FIX: Events are still visible within grace period
            expect(events.length).toBeGreaterThan(0);
            expect(events[0].title).toBe('Test Event');
        });

        it('should return events even when cache has expired but still show calendar is enabled', async () => {
            await service.initialize();

            const subscription = await service.addSubscription({
                name: 'Test Calendar',
                url: 'https://example.com/calendar.ics',
                type: 'remote',
                enabled: true,
                color: '#ff0000',
                refreshInterval: 60
            });

            // Manually populate cache with expired data (within grace period)
            const expiredCache = {
                subscriptionId: subscription.id,
                events: [
                    {
                        id: `${subscription.id}-event1`,
                        subscriptionId: subscription.id,
                        title: 'Test Event',
                        start: new Date().toISOString(),
                        allDay: false
                    }
                ],
                lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                expires: new Date(Date.now() - 2 * 60 * 1000).toISOString() // Expired 2 minutes ago (within grace period)
            };

            (service as any).cache.set(subscription.id, expiredCache);

            // Subscription should still show as enabled in settings
            const subscriptions = service.getSubscriptions();
            expect(subscriptions[0].enabled).toBe(true);

            // Events are still returned due to grace period
            const events = service.getAllEvents();
            expect(events.length).toBeGreaterThan(0);

            // This prevents the confusing UX where calendars "disappear" even though they're enabled
        });

        it('should handle the race condition between refresh and cache expiration with grace period', async () => {
            await service.initialize();

            const subscription = await service.addSubscription({
                name: 'Test Calendar',
                url: 'https://example.com/calendar.ics',
                type: 'remote',
                enabled: true,
                color: '#ff0000',
                refreshInterval: 60 // 60 minutes
            });

            // Populate cache that will expire soon
            const soonToExpireCache = {
                subscriptionId: subscription.id,
                events: [
                    {
                        id: `${subscription.id}-event1`,
                        subscriptionId: subscription.id,
                        title: 'Test Event',
                        start: new Date().toISOString(),
                        allDay: false
                    }
                ],
                lastUpdated: new Date(Date.now() - 59 * 60 * 1000).toISOString(), // 59 minutes ago
                expires: new Date(Date.now() + 60 * 1000).toISOString() // Expires in 1 minute
            };

            (service as any).cache.set(subscription.id, soonToExpireCache);

            // Events are visible now
            let events = service.getAllEvents();
            expect(events.length).toBeGreaterThan(0);

            // Simulate time passing - cache expires
            soonToExpireCache.expires = new Date(Date.now() - 1000).toISOString(); // Now expired

            // Events still visible due to grace period (5 minutes after expiry)
            events = service.getAllEvents();
            expect(events.length).toBeGreaterThan(0);

            // FIX: The grace period prevents the gap where no events are shown
            // even if the refresh timer hasn't fired yet or network is slow
        });
    });

    describe('First Load Scenarios', () => {
        it('should fetch subscriptions immediately on initialization when no cache exists', async () => {
            const { requestUrl } = require('obsidian');

            // Mock successful ICS response (will fail parsing, but that's ok for this test)
            requestUrl.mockResolvedValueOnce({
                text: 'BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR'
            });

            // Add subscription before initializing
            mockPlugin.loadData.mockResolvedValue({
                icsSubscriptions: [{
                    id: 'test-sub-1',
                    name: 'Test Calendar',
                    url: 'https://example.com/calendar.ics',
                    type: 'remote',
                    enabled: true,
                    color: '#ff0000',
                    refreshInterval: 60
                }]
            });

            // Initialize service - should attempt to fetch immediately
            await service.initialize();

            // Verify fetch was attempted (even though parsing may fail in test environment)
            expect(requestUrl).toHaveBeenCalledWith(
                expect.objectContaining({
                    url: 'https://example.com/calendar.ics',
                    method: 'GET'
                })
            );

            // Verify the subscription shows it was attempted to be fetched
            const subscriptions = service.getSubscriptions();
            expect(subscriptions[0]).toBeDefined();
            // The subscription should exist and be enabled
            expect(subscriptions[0].enabled).toBe(true);
        });

        it('should fetch when getAllEvents is called with no cache', async () => {
            const { requestUrl } = require('obsidian');

            await service.initialize();

            const subscription = await service.addSubscription({
                name: 'Test Calendar',
                url: 'https://example.com/calendar.ics',
                type: 'remote',
                enabled: true,
                color: '#ff0000',
                refreshInterval: 60
            });

            // Clear the cache that was created by addSubscription
            (service as any).cache.delete(subscription.id);

            // Mock successful ICS response for the fetch
            requestUrl.mockResolvedValueOnce({
                text: 'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:test1\nDTSTART:20251005T120000Z\nDTEND:20251005T130000Z\nSUMMARY:Test Event\nEND:VEVENT\nEND:VCALENDAR'
            });

            // Calling getAllEvents with no cache should trigger a fetch
            const events = service.getAllEvents();

            // Initially empty (fetch is async)
            expect(events).toHaveLength(0);

            // Wait a bit for the async fetch to complete
            await new Promise(resolve => setTimeout(resolve, 10));

            // Verify fetch was triggered
            expect(requestUrl).toHaveBeenCalled();
        });
    });

    describe('Network Failure Scenarios', () => {
        it('should keep events visible after network error with grace period', async () => {
            // Mock requestUrl to fail
            const { requestUrl } = require('obsidian');
            requestUrl.mockRejectedValueOnce(new Error('Network error'));

            await service.initialize();

            const subscription = await service.addSubscription({
                name: 'Test Calendar',
                url: 'https://example.com/calendar.ics',
                type: 'remote',
                enabled: true,
                color: '#ff0000',
                refreshInterval: 60
            });

            // Initial cache with valid data
            const cache = {
                subscriptionId: subscription.id,
                events: [
                    {
                        id: `${subscription.id}-event1`,
                        subscriptionId: subscription.id,
                        title: 'Test Event',
                        start: new Date().toISOString(),
                        allDay: false
                    }
                ],
                lastUpdated: new Date().toISOString(),
                expires: new Date(Date.now() + 60 * 60 * 1000).toISOString()
            };

            (service as any).cache.set(subscription.id, cache);

            // Events visible initially
            let events = service.getAllEvents();
            expect(events.length).toBeGreaterThan(0);

            // Try to refresh - this will fail
            await service.fetchSubscription(subscription.id);

            // Cache expires while events were visible
            cache.expires = new Date(Date.now() - 1000).toISOString();

            // Events still visible due to grace period, even though refresh failed
            events = service.getAllEvents();
            expect(events.length).toBeGreaterThan(0);

            // FIX: Grace period prevents calendars from disappearing during network issues
        });
    });
});
