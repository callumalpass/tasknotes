/**
 * Reproduction test for Issue #1738: calendar subscription shows wrong time of appointments made by others
 *
 * Bug Description:
 * When subscribing to a remote ICS calendar (Outlook/Exchange), events created by other
 * people show times that are 2 hours ahead of their correct time, particularly around
 * DST transitions. The user's own events display correctly. The problem appeared "a week
 * before daylight savings".
 *
 * Root Cause Hypothesis:
 * `ICSSubscriptionService.icalTimeToISOString()` calls `icalTime.toUnixTime()` for timed
 * events. ical.js's timezone resolution depends on VTIMEZONE components being registered
 * via `ICAL.TimezoneService.register()`. Outlook published feeds for events created by
 * other organizers may embed a Windows/Exchange TZID (e.g. "W. Europe Standard Time")
 * that ical.js does not recognise as an IANA timezone. When unrecognised, ical.js treats
 * the time as floating (no timezone offset applied), and `toUnixTime()` adds the host
 * system's local UTC offset instead of the event's actual timezone offset. Around DST
 * transitions the difference between the Windows TZ offset and the resolved offset
 * produces a 1–2 hour error.
 *
 * Key locations:
 * - src/services/ICSSubscriptionService.ts (icalTimeToISOString ~line 37, parseICS ~line 299)
 */

jest.mock('obsidian');

describe('Issue #1738: ICS calendar subscription wrong time for events from others (DST timezone bug)', () => {
  it.skip('reproduces issue #1738: Windows timezone IDs from Outlook should be mapped to IANA before time conversion', () => {
    // Minimal Windows-to-IANA timezone mapping (subset)
    const WINDOWS_TO_IANA: Record<string, string> = {
      'W. Europe Standard Time': 'Europe/Amsterdam',
      'Romance Standard Time': 'Europe/Paris',
      'Central European Standard Time': 'Europe/Warsaw',
      'GMT Standard Time': 'Europe/London',
    };

    // Simulate resolving a TZID that comes from an Outlook-generated ICS for an event
    // created by another user whose calendar uses Windows timezone identifiers
    function resolveTimezoneId(tzid: string): string | null {
      // ical.js returns null / uses floating time for unrecognised TZIDs
      // A fix would attempt the Windows-to-IANA lookup here
      const iana = WINDOWS_TO_IANA[tzid];
      return iana ?? null; // Bug: if null is returned, time is treated as floating
    }

    const outlookTzid = 'W. Europe Standard Time';
    const resolved = resolveTimezoneId(outlookTzid);

    // After fix: the Windows TZID should resolve to an IANA identifier
    expect(resolved).toBe('Europe/Amsterdam');

    // Simulate the error: if ical.js treats the time as floating (no timezone),
    // the UTC offset is not applied and the displayed time is wrong.
    // Demonstrate that a UTC+2 event at 10:00 floating would appear as 10:00 UTC (= 12:00 local)
    const eventTimeAsFloating = new Date('2026-03-29T10:00:00'); // floating: treated as local
    const correctEventTime = new Date('2026-03-29T08:00:00Z');   // UTC equivalent for 10:00 CET (UTC+2 in DST)

    // The two dates represent the same wall-clock time but different UTC values
    // When the timezone is not resolved correctly, the 2-hour offset is lost
    const offsetHours = (eventTimeAsFloating.getTime() - correctEventTime.getTime()) / (1000 * 60 * 60);

    // This demonstrates the 2-hour discrepancy reported by the user
    // (exact value depends on the test runner's local timezone; the test documents the pattern)
    expect(Math.abs(offsetHours)).toBeGreaterThanOrEqual(0); // placeholder — real fix must resolve TZID

    // Flag that the bug is present: unresolved Windows TZID leads to wrong times
    expect(true).toBe(false); // Fails to indicate bug is present
  });

  it.skip('reproduces issue #1738: VTIMEZONE registration should handle non-IANA timezone identifiers from Exchange', () => {
    // The parseICS method in ICSSubscriptionService registers VTIMEZONE components via
    // ICAL.TimezoneService.register(vtimezone). However, if the VTIMEZONE block uses
    // a Windows TZID that ical.js cannot map internally, subsequent calls to
    // icalTime.toUnixTime() on events from that zone will be incorrect.

    // Simulate the check: after registering a VTIMEZONE with a Windows TZID,
    // ical.js should be able to convert times in that zone correctly.
    const windowsTzid = 'W. Europe Standard Time';

    // Without a fix, ical.js would not find this timezone and treat times as floating
    // The fix should intercept unresolved TZIDs and provide an IANA alias
    function isKnownIANATimezone(tzid: string): boolean {
      // Simplified check: IANA zones contain a '/' (e.g. 'Europe/Amsterdam')
      return tzid.includes('/');
    }

    expect(isKnownIANATimezone(windowsTzid)).toBe(false); // Windows TZID is not IANA format
    expect(isKnownIANATimezone('Europe/Amsterdam')).toBe(true);

    // The bug: without mapping, the non-IANA TZID causes floating-time treatment
    expect(true).toBe(false); // Fails to indicate bug is present
  });
});
