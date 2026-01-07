/**
 * Issue #1049: [Bug] External calendar events with custom repeating do not display
 *
 * Unit tests for ICS subscription service handling of custom RRULE patterns.
 *
 * This file tests the parseICS method's ability to expand complex recurring events
 * with custom patterns like:
 * - BYDAY with position prefix (2MO = 2nd Monday)
 * - BYSETPOS for selecting specific occurrences
 * - Negative BYDAY positions (-1FR = last Friday)
 * - INTERVAL for skip patterns (every 2 weeks)
 * - Complex combinations of RRULE components
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1049
 */

import { ICSSubscriptionService } from '../../../src/services/ICSSubscriptionService';
import { ICSEvent } from '../../../src/types';

// Mock Obsidian's dependencies
jest.mock('obsidian', () => ({
  Notice: jest.fn(),
  requestUrl: jest.fn(),
  TFile: jest.fn(),
}));

// Ensure ICAL.js is available
jest.mock('ical.js', () => {
  const actualICAL = jest.requireActual('ical.js');
  return actualICAL;
});

describe.skip('Issue #1049: Custom RRULE patterns in ICS parsing', () => {
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
          offref: jest.fn(),
        },
      },
    };

    service = new ICSSubscriptionService(mockPlugin);
  });

  describe('BYDAY with position prefix', () => {
    it('should expand RRULE with 2nd Monday of month (BYDAY=2MO)', () => {
      /**
       * Pattern: Every 2nd Monday of the month
       * RRULE: FREQ=MONTHLY;BYDAY=2MO
       *
       * This is a common "custom" repeat pattern that users set in calendar apps.
       * The 2 prefix before MO means "the 2nd Monday".
       */
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Custom Repeat Test//EN
BEGIN:VEVENT
DTSTART:20250113T100000Z
DTEND:20250113T110000Z
RRULE:FREQ=MONTHLY;BYDAY=2MO;COUNT=6
UID:second-monday-event
SUMMARY:Team Sync (2nd Monday)
END:VEVENT
END:VCALENDAR`;

      const events = (service as any).parseICS(icsData, 'test-sub');

      // Should have 6 events (COUNT=6)
      expect(events).toHaveLength(6);

      // Verify each event is on the 2nd Monday of its month
      events.forEach((event: ICSEvent) => {
        const date = new Date(event.start);
        const dayOfWeek = date.getUTCDay();
        const dayOfMonth = date.getUTCDate();

        // Should be a Monday (day 1)
        expect(dayOfWeek).toBe(1);

        // 2nd Monday falls between day 8-14
        expect(dayOfMonth).toBeGreaterThanOrEqual(8);
        expect(dayOfMonth).toBeLessThanOrEqual(14);
      });
    });

    it('should expand RRULE with 1st Friday of month (BYDAY=1FR)', () => {
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Custom Repeat Test//EN
BEGIN:VEVENT
DTSTART:20250103T140000Z
DTEND:20250103T150000Z
RRULE:FREQ=MONTHLY;BYDAY=1FR;COUNT=4
UID:first-friday-event
SUMMARY:Monthly Review (1st Friday)
END:VEVENT
END:VCALENDAR`;

      const events = (service as any).parseICS(icsData, 'test-sub');

      expect(events).toHaveLength(4);

      events.forEach((event: ICSEvent) => {
        const date = new Date(event.start);
        const dayOfWeek = date.getUTCDay();
        const dayOfMonth = date.getUTCDate();

        // Should be a Friday (day 5)
        expect(dayOfWeek).toBe(5);

        // 1st Friday falls between day 1-7
        expect(dayOfMonth).toBeGreaterThanOrEqual(1);
        expect(dayOfMonth).toBeLessThanOrEqual(7);
      });
    });

    it('should expand RRULE with last Friday of month (BYDAY=-1FR)', () => {
      /**
       * Pattern: Last Friday of the month
       * RRULE: FREQ=MONTHLY;BYDAY=-1FR
       *
       * The -1 prefix means "last occurrence" of that weekday in the month.
       */
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Custom Repeat Test//EN
BEGIN:VEVENT
DTSTART:20250131T160000Z
DTEND:20250131T170000Z
RRULE:FREQ=MONTHLY;BYDAY=-1FR;COUNT=4
UID:last-friday-event
SUMMARY:Month-End Review (Last Friday)
END:VEVENT
END:VCALENDAR`;

      const events = (service as any).parseICS(icsData, 'test-sub');

      expect(events).toHaveLength(4);

      events.forEach((event: ICSEvent) => {
        const date = new Date(event.start);
        const dayOfWeek = date.getUTCDay();
        const dayOfMonth = date.getUTCDate();

        // Should be a Friday (day 5)
        expect(dayOfWeek).toBe(5);

        // Last Friday is typically between day 22-31
        // (varies by month, but must be in final week)
        expect(dayOfMonth).toBeGreaterThanOrEqual(22);
      });
    });

    it('should expand RRULE with 3rd Wednesday of month (BYDAY=3WE)', () => {
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Custom Repeat Test//EN
BEGIN:VEVENT
DTSTART:20250115T090000Z
DTEND:20250115T100000Z
RRULE:FREQ=MONTHLY;BYDAY=3WE;COUNT=3
UID:third-wednesday-event
SUMMARY:Sprint Planning (3rd Wednesday)
END:VEVENT
END:VCALENDAR`;

      const events = (service as any).parseICS(icsData, 'test-sub');

      expect(events).toHaveLength(3);

      events.forEach((event: ICSEvent) => {
        const date = new Date(event.start);
        const dayOfWeek = date.getUTCDay();
        const dayOfMonth = date.getUTCDate();

        // Should be a Wednesday (day 3)
        expect(dayOfWeek).toBe(3);

        // 3rd Wednesday falls between day 15-21
        expect(dayOfMonth).toBeGreaterThanOrEqual(15);
        expect(dayOfMonth).toBeLessThanOrEqual(21);
      });
    });
  });

  describe('BYSETPOS patterns', () => {
    it('should expand RRULE with BYSETPOS=2 (2nd occurrence)', () => {
      /**
       * Pattern: 2nd Monday using BYSETPOS
       * RRULE: FREQ=MONTHLY;BYDAY=MO;BYSETPOS=2
       *
       * BYSETPOS selects the 2nd item from the set of all Mondays in the month.
       * This is an alternative way to express "2nd Monday".
       */
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Custom Repeat Test//EN
BEGIN:VEVENT
DTSTART:20250113T100000Z
DTEND:20250113T110000Z
RRULE:FREQ=MONTHLY;BYDAY=MO;BYSETPOS=2;COUNT=4
UID:bysetpos-second-monday
SUMMARY:Team Meeting (BYSETPOS 2nd Monday)
END:VEVENT
END:VCALENDAR`;

      const events = (service as any).parseICS(icsData, 'test-sub');

      expect(events).toHaveLength(4);

      events.forEach((event: ICSEvent) => {
        const date = new Date(event.start);
        const dayOfWeek = date.getUTCDay();
        const dayOfMonth = date.getUTCDate();

        // Should be a Monday
        expect(dayOfWeek).toBe(1);

        // 2nd Monday falls between day 8-14
        expect(dayOfMonth).toBeGreaterThanOrEqual(8);
        expect(dayOfMonth).toBeLessThanOrEqual(14);
      });
    });

    it('should expand RRULE with BYSETPOS=-1 (last occurrence)', () => {
      /**
       * Pattern: Last Thursday using BYSETPOS
       * RRULE: FREQ=MONTHLY;BYDAY=TH;BYSETPOS=-1
       */
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Custom Repeat Test//EN
BEGIN:VEVENT
DTSTART:20250130T110000Z
DTEND:20250130T120000Z
RRULE:FREQ=MONTHLY;BYDAY=TH;BYSETPOS=-1;COUNT=3
UID:bysetpos-last-thursday
SUMMARY:Month Retrospective (Last Thursday)
END:VEVENT
END:VCALENDAR`;

      const events = (service as any).parseICS(icsData, 'test-sub');

      expect(events).toHaveLength(3);

      events.forEach((event: ICSEvent) => {
        const date = new Date(event.start);
        const dayOfWeek = date.getUTCDay();
        const dayOfMonth = date.getUTCDate();

        // Should be a Thursday (day 4)
        expect(dayOfWeek).toBe(4);

        // Last Thursday is typically between day 22-31
        expect(dayOfMonth).toBeGreaterThanOrEqual(22);
      });
    });
  });

  describe('INTERVAL patterns', () => {
    it('should expand RRULE with INTERVAL=2 (every 2 weeks)', () => {
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Custom Repeat Test//EN
BEGIN:VEVENT
DTSTART:20250106T090000Z
DTEND:20250106T100000Z
RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=5
UID:biweekly-event
SUMMARY:Biweekly Standup
END:VEVENT
END:VCALENDAR`;

      const events = (service as any).parseICS(icsData, 'test-sub');

      expect(events).toHaveLength(5);

      // Verify 2-week intervals
      const dates = events.map((e: ICSEvent) => new Date(e.start).getTime());
      for (let i = 1; i < dates.length; i++) {
        const diff = dates[i] - dates[i - 1];
        const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
        expect(diff).toBe(twoWeeksMs);
      }
    });

    it('should expand RRULE with INTERVAL=3 (every 3 months)', () => {
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Custom Repeat Test//EN
BEGIN:VEVENT
DTSTART:20250115T100000Z
DTEND:20250115T110000Z
RRULE:FREQ=MONTHLY;INTERVAL=3;COUNT=4
UID:quarterly-event
SUMMARY:Quarterly Review
END:VEVENT
END:VCALENDAR`;

      const events = (service as any).parseICS(icsData, 'test-sub');

      expect(events).toHaveLength(4);

      // Verify quarterly (3-month) intervals
      const months = events.map((e: ICSEvent) => new Date(e.start).getUTCMonth());

      // Starting in January (0), should be: Jan, Apr, Jul, Oct
      expect(months[0]).toBe(0); // January
      expect(months[1]).toBe(3); // April
      expect(months[2]).toBe(6); // July
      expect(months[3]).toBe(9); // October
    });
  });

  describe('Complex combined patterns', () => {
    it('should expand RRULE with BYDAY + INTERVAL (every other Wednesday)', () => {
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Custom Repeat Test//EN
BEGIN:VEVENT
DTSTART:20250108T130000Z
DTEND:20250108T140000Z
RRULE:FREQ=WEEKLY;BYDAY=WE;INTERVAL=2;COUNT=4
UID:biweekly-wednesday
SUMMARY:Sprint Demo (Every Other Wednesday)
END:VEVENT
END:VCALENDAR`;

      const events = (service as any).parseICS(icsData, 'test-sub');

      expect(events).toHaveLength(4);

      events.forEach((event: ICSEvent) => {
        const date = new Date(event.start);
        // All should be Wednesdays
        expect(date.getUTCDay()).toBe(3);
      });

      // Verify 2-week intervals
      const dates = events.map((e: ICSEvent) => new Date(e.start).getTime());
      for (let i = 1; i < dates.length; i++) {
        const diff = dates[i] - dates[i - 1];
        const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
        expect(diff).toBe(twoWeeksMs);
      }
    });

    it('should expand RRULE with multiple BYDAY values', () => {
      /**
       * Pattern: Every Monday and Friday
       * RRULE: FREQ=WEEKLY;BYDAY=MO,FR
       */
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Custom Repeat Test//EN
BEGIN:VEVENT
DTSTART:20250106T090000Z
DTEND:20250106T100000Z
RRULE:FREQ=WEEKLY;BYDAY=MO,FR;COUNT=8
UID:monday-friday-event
SUMMARY:Standup (Mon & Fri)
END:VEVENT
END:VCALENDAR`;

      const events = (service as any).parseICS(icsData, 'test-sub');

      expect(events).toHaveLength(8);

      // All events should be either Monday (1) or Friday (5)
      events.forEach((event: ICSEvent) => {
        const dayOfWeek = new Date(event.start).getUTCDay();
        expect([1, 5]).toContain(dayOfWeek);
      });
    });

    it('should expand complex yearly pattern (last Monday of May - Memorial Day style)', () => {
      /**
       * Pattern: Last Monday of May each year
       * RRULE: FREQ=YEARLY;BYMONTH=5;BYDAY=-1MO
       */
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Custom Repeat Test//EN
BEGIN:VEVENT
DTSTART:20250526T000000Z
DTEND:20250527T000000Z
RRULE:FREQ=YEARLY;BYMONTH=5;BYDAY=-1MO;COUNT=3
UID:memorial-day-style
SUMMARY:Annual Event (Last Monday of May)
END:VEVENT
END:VCALENDAR`;

      const events = (service as any).parseICS(icsData, 'test-sub');

      expect(events).toHaveLength(3);

      events.forEach((event: ICSEvent) => {
        const date = new Date(event.start);

        // Should be in May (month 4)
        expect(date.getUTCMonth()).toBe(4);

        // Should be a Monday
        expect(date.getUTCDay()).toBe(1);

        // Should be in last week (day 25-31)
        expect(date.getUTCDate()).toBeGreaterThanOrEqual(25);
      });
    });
  });

  describe('Error handling for unsupported patterns', () => {
    it('should not throw when encountering complex RRULE', () => {
      /**
       * Even if a pattern can't be fully expanded, it should not crash.
       * The service should either:
       * 1. Expand what it can
       * 2. Fall back to base event
       * 3. Log a warning but continue
       */
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Custom Repeat Test//EN
BEGIN:VEVENT
DTSTART:20250115T100000Z
DTEND:20250115T110000Z
RRULE:FREQ=MONTHLY;BYDAY=WE;BYSETPOS=3;WKST=SU;COUNT=3
UID:complex-pattern
SUMMARY:Complex Pattern Event
END:VEVENT
END:VCALENDAR`;

      // Should not throw
      expect(() => {
        (service as any).parseICS(icsData, 'test-sub');
      }).not.toThrow();

      const events = (service as any).parseICS(icsData, 'test-sub');

      // Should return some events (at least the base event or expanded instances)
      expect(events.length).toBeGreaterThan(0);
    });

    it('should handle RRULE with UNTIL date', () => {
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//Custom Repeat Test//EN
BEGIN:VEVENT
DTSTART:20250106T100000Z
DTEND:20250106T110000Z
RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20250203T100000Z
UID:until-date-event
SUMMARY:Weekly Until Feb
END:VEVENT
END:VCALENDAR`;

      const events = (service as any).parseICS(icsData, 'test-sub');

      // Should have events from Jan 6 to Feb 3 (5 Mondays)
      expect(events.length).toBeGreaterThan(0);

      // All events should be before the UNTIL date
      events.forEach((event: ICSEvent) => {
        const date = new Date(event.start);
        expect(date.getTime()).toBeLessThanOrEqual(new Date('2025-02-03T10:00:00Z').getTime());
      });
    });
  });

  describe('Real-world calendar patterns (from screenshot)', () => {
    it('should handle custom repeat pattern from external calendar', () => {
      /**
       * Based on issue screenshot showing custom repeat dialog.
       * Common external calendar custom patterns include:
       * - Every X weeks on specific days
       * - Monthly on specific weekday position
       * - Custom intervals
       */
      const icsData = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Apple Inc.//iCloud Calendar//EN
BEGIN:VEVENT
DTSTART;TZID=America/New_York:20250113T100000
DTEND;TZID=America/New_York:20250113T110000
RRULE:FREQ=MONTHLY;BYDAY=2MO
UID:icloud-custom-repeat
SUMMARY:Custom Recurring Event
DESCRIPTION:Event with custom repeat pattern
END:VEVENT
END:VCALENDAR`;

      const events = (service as any).parseICS(icsData, 'icloud-sub');

      // Should have multiple instances
      expect(events.length).toBeGreaterThan(0);

      // Verify pattern is followed
      events.forEach((event: ICSEvent) => {
        const date = new Date(event.start);
        // Should be on a Monday
        expect(date.getDay()).toBe(1);
      });
    });
  });
});
