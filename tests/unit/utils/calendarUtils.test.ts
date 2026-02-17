/**
 * Tests for calendar utility functions
 *
 * These utilities are shared between HTTP controllers and MCPService
 * for collecting and filtering calendar events.
 */

import { ICSEvent } from '../../../src/types';
import {
	isEventInRange,
	getProviderFromSubscriptionId,
	collectCalendarEvents,
} from '../../../src/utils/calendarUtils';

describe('calendarUtils', () => {
	describe('isEventInRange', () => {
		const createEvent = (start: string, end?: string): ICSEvent => ({
			id: 'test-event',
			title: 'Test Event',
			start,
			end,
			allDay: false,
			subscriptionId: 'test-sub',
		});

		it('should return true when no date filters are provided', () => {
			const event = createEvent('2025-01-15T10:00:00Z', '2025-01-15T11:00:00Z');
			expect(isEventInRange(event, null, null)).toBe(true);
		});

		it('should return true when event is within range', () => {
			const event = createEvent('2025-01-15T10:00:00Z', '2025-01-15T11:00:00Z');
			const startDate = new Date('2025-01-01');
			const endDate = new Date('2025-01-31');
			expect(isEventInRange(event, startDate, endDate)).toBe(true);
		});

		it('should return false when event ends before start filter', () => {
			const event = createEvent('2025-01-05T10:00:00Z', '2025-01-05T11:00:00Z');
			const startDate = new Date('2025-01-10');
			expect(isEventInRange(event, startDate, null)).toBe(false);
		});

		it('should return false when event starts after end filter', () => {
			const event = createEvent('2025-01-20T10:00:00Z', '2025-01-20T11:00:00Z');
			const endDate = new Date('2025-01-15');
			expect(isEventInRange(event, null, endDate)).toBe(false);
		});

		it('should handle events without end time (use start as end)', () => {
			const event = createEvent('2025-01-15T10:00:00Z');
			const startDate = new Date('2025-01-10');
			const endDate = new Date('2025-01-20');
			expect(isEventInRange(event, startDate, endDate)).toBe(true);
		});

		it('should return true when event overlaps with range start', () => {
			const event = createEvent('2025-01-08T10:00:00Z', '2025-01-12T11:00:00Z');
			const startDate = new Date('2025-01-10');
			expect(isEventInRange(event, startDate, null)).toBe(true);
		});

		it('should return true when event overlaps with range end', () => {
			const event = createEvent('2025-01-14T10:00:00Z', '2025-01-20T11:00:00Z');
			const endDate = new Date('2025-01-15');
			expect(isEventInRange(event, null, endDate)).toBe(true);
		});
	});

	describe('getProviderFromSubscriptionId', () => {
		it('should return "google" for google- prefixed IDs', () => {
			expect(getProviderFromSubscriptionId('google-123')).toBe('google');
			expect(getProviderFromSubscriptionId('google-calendar-abc')).toBe('google');
		});

		it('should return "microsoft" for microsoft- prefixed IDs', () => {
			expect(getProviderFromSubscriptionId('microsoft-456')).toBe('microsoft');
			expect(getProviderFromSubscriptionId('microsoft-outlook-xyz')).toBe('microsoft');
		});

		it('should return "unknown" for other IDs', () => {
			expect(getProviderFromSubscriptionId('other-789')).toBe('unknown');
			expect(getProviderFromSubscriptionId('ics-feed')).toBe('unknown');
			expect(getProviderFromSubscriptionId('')).toBe('unknown');
		});
	});

	describe('collectCalendarEvents', () => {
		const createMockProviderRegistry = (events: ICSEvent[]) => ({
			getAllEvents: jest.fn().mockReturnValue(events),
		});

		const createMockICSService = (events: ICSEvent[]) => ({
			getAllEvents: jest.fn().mockReturnValue(events),
		});

		it('should collect events from provider registry', () => {
			const providerEvents: ICSEvent[] = [
				{
					id: 'google-event-1',
					title: 'Google Meeting',
					start: '2025-01-15T10:00:00Z',
					end: '2025-01-15T11:00:00Z',
					allDay: false,
					subscriptionId: 'google-calendar-1',
				},
			];

			const registry = createMockProviderRegistry(providerEvents);
			const result = collectCalendarEvents(registry as any, null, {});

			expect(result.total).toBe(1);
			expect(result.events[0].title).toBe('Google Meeting');
			expect(result.events[0].provider).toBe('google');
			expect(result.sources['google']).toBe(1);
		});

		it('should collect events from ICS service', () => {
			const icsEvents: ICSEvent[] = [
				{
					id: 'ics-event-1',
					title: 'ICS Event',
					start: '2025-01-15T14:00:00Z',
					end: '2025-01-15T15:00:00Z',
					allDay: false,
					subscriptionId: 'ics-sub-1',
				},
			];

			const registry = createMockProviderRegistry([]);
			const icsService = createMockICSService(icsEvents);
			const result = collectCalendarEvents(registry as any, icsService as any, {});

			expect(result.total).toBe(1);
			expect(result.events[0].title).toBe('ICS Event');
			expect(result.events[0].provider).toBe('ics');
			expect(result.sources['ics']).toBe(1);
		});

		it('should combine events from multiple sources', () => {
			const providerEvents: ICSEvent[] = [
				{
					id: 'google-1',
					title: 'Google Event',
					start: '2025-01-15T10:00:00Z',
					allDay: false,
					subscriptionId: 'google-cal',
				},
				{
					id: 'ms-1',
					title: 'Microsoft Event',
					start: '2025-01-15T12:00:00Z',
					allDay: false,
					subscriptionId: 'microsoft-cal',
				},
			];

			const icsEvents: ICSEvent[] = [
				{
					id: 'ics-1',
					title: 'ICS Event',
					start: '2025-01-15T14:00:00Z',
					allDay: false,
					subscriptionId: 'ics-feed',
				},
			];

			const registry = createMockProviderRegistry(providerEvents);
			const icsService = createMockICSService(icsEvents);
			const result = collectCalendarEvents(registry as any, icsService as any, {});

			expect(result.total).toBe(3);
			expect(result.sources['google']).toBe(1);
			expect(result.sources['microsoft']).toBe(1);
			expect(result.sources['ics']).toBe(1);
		});

		it('should filter events by date range', () => {
			const providerEvents: ICSEvent[] = [
				{
					id: 'event-1',
					title: 'In Range',
					start: '2025-01-15T10:00:00Z',
					end: '2025-01-15T11:00:00Z',
					allDay: false,
					subscriptionId: 'google-cal',
				},
				{
					id: 'event-2',
					title: 'Out of Range',
					start: '2025-01-05T10:00:00Z',
					end: '2025-01-05T11:00:00Z',
					allDay: false,
					subscriptionId: 'google-cal',
				},
			];

			const registry = createMockProviderRegistry(providerEvents);
			const result = collectCalendarEvents(registry as any, null, {
				start: new Date('2025-01-10'),
				end: new Date('2025-01-20'),
			});

			expect(result.total).toBe(1);
			expect(result.events[0].title).toBe('In Range');
		});

		it('should sort events by start time', () => {
			const providerEvents: ICSEvent[] = [
				{
					id: 'event-2',
					title: 'Later Event',
					start: '2025-01-15T14:00:00Z',
					allDay: false,
					subscriptionId: 'google-cal',
				},
				{
					id: 'event-1',
					title: 'Earlier Event',
					start: '2025-01-15T10:00:00Z',
					allDay: false,
					subscriptionId: 'google-cal',
				},
			];

			const registry = createMockProviderRegistry(providerEvents);
			const result = collectCalendarEvents(registry as any, null, {});

			expect(result.events[0].title).toBe('Earlier Event');
			expect(result.events[1].title).toBe('Later Event');
		});

		it('should handle null ICS service gracefully', () => {
			const registry = createMockProviderRegistry([]);
			const result = collectCalendarEvents(registry as any, null, {});

			expect(result.total).toBe(0);
			expect(result.events).toHaveLength(0);
		});

		it('should handle empty sources', () => {
			const registry = createMockProviderRegistry([]);
			const icsService = createMockICSService([]);
			const result = collectCalendarEvents(registry as any, icsService as any, {});

			expect(result.total).toBe(0);
			expect(result.sources).toEqual({});
		});
	});
});
