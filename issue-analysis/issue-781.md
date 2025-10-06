# Issue #781 Analysis: ICS Calendar Timezone Conversion Bug

## Problem Understanding

**Issue Report:** An Outlook calendar event scheduled for 3 PM EST correctly shows as 1 PM MST in Outlook (the user's local timezone), but appears as 3 PM MST in Advanced Calendar - ignoring the timezone conversion.

**Root Cause:** The `ICAL.Time.toJSDate()` method in the ICAL.js library returns a Date object that interprets the time components in the **local JavaScript timezone**, not the timezone specified in the ICS event. When this Date is then converted to ISO string with `.toISOString()`, it creates an incorrect UTC timestamp.

### Example Flow (Bug):

1. **ICS Event:** `DTSTART;TZID=Eastern Standard Time:20250110T150000` (3 PM EST)
2. **ICAL.js parsing:** Creates an `ICAL.Time` object with timezone="Eastern Standard Time", time=15:00
3. **`toJSDate()` call:** Returns a JavaScript Date representing "15:00 in LOCAL timezone" (not EST!)
   - If the system is running in MST, this creates a Date for "3 PM MST"
   - This is **wrong** - it should represent "3 PM EST" = "1 PM MST" = "8 PM UTC"
4. **`toISOString()` call:** Converts this to `2025-01-10T22:00:00.000Z` (3 PM MST = 22:00 UTC)
   - Should be `2025-01-10T20:00:00.000Z` (3 PM EST = 20:00 UTC)
5. **Display:** FullCalendar displays this as 3 PM in the user's local timezone (MST)

## Test File Location

**Created:** `tests/unit/issues/issue-781-ics-timezone-bug.test.ts`

**Note:** The test requires the real ICAL.js library to properly test timezone handling, as the mocked version doesn't implement full timezone support. The test structure is in place but may need to be run with real ICAL data to fully verify the fix.

**How to run:**
```bash
npm test -- tests/unit/issues/issue-781-ics-timezone-bug.test.ts
```

## Relevant Code Locations

### Primary Issue Location

**File:** `src/services/ICSSubscriptionService.ts`

**Lines 296-305:** Initial event parsing (non-recurring)
```typescript
const startDate = event.startDate;
const endDate = event.endDate;

if (!startDate) {
    return; // Skip events without start date
}

const isAllDay = startDate.isDate;
const startISO = startDate.toJSDate().toISOString();  // ❌ BUG HERE
const endISO = endDate ? endDate.toJSDate().toISOString() : undefined;  // ❌ BUG HERE
```

**Lines 372-383:** Recurring events with modifications
```typescript
const modifiedStart = modifiedEvent.startDate;
const modifiedEnd = modifiedEvent.endDate;

if (modifiedStart) {
    events.push({
        // ...
        start: modifiedStart.toJSDate().toISOString(),  // ❌ BUG HERE
        end: modifiedEnd ? modifiedEnd.toJSDate().toISOString() : undefined,  // ❌ BUG HERE
        // ...
    });
}
```

**Lines 392-401:** Recurring event instances
```typescript
const instanceStart = occurrence.toJSDate().toISOString();  // ❌ BUG HERE
let instanceEnd = endISO;

if (endDate && startDate) {
    const duration = endDate.toJSDate().getTime() - startDate.toJSDate().getTime();
    instanceEnd = new Date(
        occurrence.toJSDate().getTime() + duration
    ).toISOString();  // ❌ BUG HERE
}
```

### Display Locations

**File:** `src/ui/ICSCard.ts:15-32`
- Formats time for display in calendar cards
- Uses `formatTime()` which expects correctly timezone-converted dates

**File:** `src/views/AdvancedCalendarView.ts:1219-1243`
- Creates calendar events from ICS events
- Passes the start/end times directly to FullCalendar

## Proposed Solutions

### Solution 1: Use UTC Methods from ICAL.Time (Recommended)

**Approach:** Use ICAL.js's built-in UTC conversion before calling `toJSDate()`.

**Implementation:**
```typescript
// Instead of:
const startISO = startDate.toJSDate().toISOString();

// Do:
const startISO = startDate.toUnixTime()
    ? new Date(startDate.toUnixTime() * 1000).toISOString()
    : startDate.toJSDate().toISOString();
```

Or use the `convertToZone()` method if available:
```typescript
const utcTime = startDate.convertToZone(ICAL.Timezone.utcTimezone);
const startISO = utcTime.toJSDate().toISOString();
```

**Pros:**
- Uses ICAL.js's native timezone handling
- Most accurate conversion
- Handles DST transitions correctly

**Cons:**
- Need to verify ICAL.js API availability (check version)
- May need to handle all-day events separately

### Solution 2: Manual UTC Construction

**Approach:** Extract time components from ICAL.Time and construct UTC Date manually.

**Implementation:**
```typescript
function icalTimeToUTC(icalTime: ICAL.Time): string {
    if (icalTime.isDate) {
        // All-day event - use midnight UTC
        return new Date(Date.UTC(
            icalTime.year,
            icalTime.month - 1,
            icalTime.day,
            0, 0, 0, 0
        )).toISOString();
    }

    // Convert to UTC using ICAL's toJSDate which gives us the correct absolute time
    // then extract UTC components
    const jsDate = icalTime.toJSDate();
    const utcDate = new Date(Date.UTC(
        jsDate.getUTCFullYear(),
        jsDate.getUTCMonth(),
        jsDate.getUTCDate(),
        jsDate.getUTCHours(),
        jsDate.getUTCMinutes(),
        jsDate.getUTCSeconds()
    ));

    return utcDate.toISOString();
}
```

**Pros:**
- More explicit control over conversion
- Doesn't rely on ICAL.js internals

**Cons:**
- May not properly handle timezone offset if `toJSDate()` is already broken
- More code to maintain
- Doesn't actually fix the root issue if `toJSDate()` is incorrect

### Solution 3: Store Timezone Info and Convert on Display (Future-proof)

**Approach:** Store both the ISO string AND the original timezone, then convert on display.

**Implementation:**
```typescript
// In ICSEvent type (src/types.ts)
export interface ICSEvent {
    // ...existing fields
    start: string;
    end?: string;
    timezone?: string;  // Add this
    // ...
}

// In parseICS:
const icsEvent: ICSEvent = {
    // ...
    start: startDate.toString(),  // Store in original format
    end: endDate?.toString(),
    timezone: startDate.zone?.tzid,
    // ...
};

// In display code:
function displayICSEvent(event: ICSEvent) {
    const startTime = ICAL.Time.fromString(event.start);
    if (event.timezone) {
        // Convert to local timezone
        const localTime = startTime.convertToZone(ICAL.Timezone.localTimezone);
        return localTime.toJSDate();
    }
    return startTime.toJSDate();
}
```

**Pros:**
- Preserves original timezone information
- Most flexible for future features
- Allows showing events in multiple timezones

**Cons:**
- Requires type changes
- More complex refactoring
- Breaking change to data structure

## Recommended Approach

**Solution 1** is recommended as the immediate fix, with the following implementation plan:

1. Add helper function to safely convert ICAL.Time to UTC ISO string
2. Replace all `toJSDate().toISOString()` calls in `ICSSubscriptionService.ts`
3. Test with real Outlook calendar ICS feeds in different timezones
4. Add timezone regression tests

### Implementation Steps:

1. Create helper in `src/services/ICSSubscriptionService.ts`:
```typescript
private icalTimeToISOString(icalTime: ICAL.Time): string {
    // For all-day events, preserve the date without time
    if (icalTime.isDate) {
        return new Date(Date.UTC(
            icalTime.year,
            icalTime.month - 1,
            icalTime.day
        )).toISOString();
    }

    // For timed events, convert to Unix timestamp then to UTC
    // toUnixTime() returns seconds since epoch in UTC
    const unixTime = icalTime.toUnixTime();
    return new Date(unixTime * 1000).toISOString();
}
```

2. Replace in three locations:
   - Line 304: `const startISO = this.icalTimeToISOString(startDate);`
   - Line 305: `const endISO = endDate ? this.icalTimeToISOString(endDate) : undefined;`
   - Line 381: `start: this.icalTimeToISOString(modifiedStart),`
   - Line 382-383: `end: modifiedEnd ? this.icalTimeToISOString(modifiedEnd) : undefined,`
   - Line 392: `const instanceStart = this.icalTimeToISOString(occurrence);`
   - Lines 395-401: Update duration calculation to use the helper

3. Test with sample ICS data from different timezones

## Additional Notes

- The issue affects all timezone-aware ICS events, not just Outlook
- All-day events may already work correctly since they don't have timezone issues
- This is a display bug - the events themselves are parsed correctly by ICAL.js
- The fix should be verified against:
  - Standard time events (EST, PST, etc.)
  - Daylight saving time events
  - Multiple timezone sources (Google Calendar, Outlook, iCal)
  - Recurring events with timezone info
