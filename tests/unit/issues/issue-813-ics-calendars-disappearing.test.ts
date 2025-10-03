import { ICSSubscriptionService } from '../../../src/services/ICSSubscriptionService';
import { ICSSubscription } from '../../../src/types';

// Mock Obsidian's dependencies
jest.mock('obsidian', () => ({
    Notice: jest.fn(),
    requestUrl: jest.fn(),
    TFile: jest.fn()
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

    describe('Cache Expiration Bug', () => {
        it('should return empty events when cache has expired', async () => {
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

            // Manually populate cache with expired data
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
                expires: new Date(Date.now() - 60 * 60 * 1000).toISOString() // Expired 1 hour ago
            };

            // Access private cache property
            (service as any).cache.set(subscription.id, expiredCache);

            // Try to get events - should return empty array due to expired cache
            const events = service.getAllEvents();

            // BUG: Events disappear when cache expires, even though subscription is still enabled
            expect(events).toHaveLength(0);
        });

        it('should still show subscription as enabled even when cache expires', async () => {
            await service.initialize();

            const subscription = await service.addSubscription({
                name: 'Test Calendar',
                url: 'https://example.com/calendar.ics',
                type: 'remote',
                enabled: true,
                color: '#ff0000',
                refreshInterval: 60
            });

            // Manually populate cache with expired data
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
                expires: new Date(Date.now() - 60 * 60 * 1000).toISOString() // Expired
            };

            (service as any).cache.set(subscription.id, expiredCache);

            // Subscription should still show as enabled in settings
            const subscriptions = service.getSubscriptions();
            expect(subscriptions[0].enabled).toBe(true);

            // But no events are returned
            const events = service.getAllEvents();
            expect(events).toHaveLength(0);

            // This creates a confusing UX where calendars "disappear" even though they're enabled
        });

        it('should demonstrate the race condition between refresh and cache expiration', async () => {
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

            // Events disappear
            events = service.getAllEvents();
            expect(events).toHaveLength(0);

            // The refresh timer is set to 60 minutes, but if the network is slow,
            // or the refresh fails silently, there's a gap where no events are shown
        });
    });

    describe('Network Failure Scenarios', () => {
        it('should demonstrate events disappearing after network error', async () => {
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

            // Now events disappear, and the failed refresh didn't update cache
            events = service.getAllEvents();
            expect(events).toHaveLength(0);
        });
    });
});
