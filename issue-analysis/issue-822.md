# Issue #822 Analysis: Mini Calendar Offset by One Day

## Problem Understanding

### User Report
The user reports that the mini-calendar is offset by one day:
- When selecting October 2nd in the mini calendar, the tooltip shows October 1st
- This links over to the Notes view - when October 2nd is selected, the Notes view shows October 1st
- Repeating tasks that recur each weekday show incorrect behavior: when completed for the current day, it logs the correct completed date but does not increment the scheduled date to the next day
- Only affects Weekday or Daily recurrences (Weekly/Monthly work correctly)

### Root Cause
The mini calendar uses **UTC-anchored dates** (e.g., `2025-10-02T00:00:00.000Z`) for internal consistency, but formats them using `date-fns`'s `format()` function which interprets dates in the **user's local timezone**.

In timezones with negative UTC offset (e.g., UTC-7 Pacific, UTC-5 Eastern):
- UTC date: `2025-10-02T00:00:00.000Z` (midnight UTC on Oct 2)
- In UTC-7 timezone: This represents Oct 1 at 5:00 PM local time
- `format(date, "EEEE, MMMM d, yyyy")` returns `"Wednesday, October 1, 2025"` ❌

The problem is that UTC-anchored dates should be formatted using their UTC components, not their local timezone interpretation.

## Test File Location

**Test file**: `tests/unit/issues/issue-822-mini-calendar-tooltip-off-by-one.test.ts`

This test reproduces the bug in Pacific (UTC-7) and Eastern (UTC-5) timezones.

### How to Run the Test
```bash
npm test -- issue-822-mini-calendar-tooltip-off-by-one.test.ts
```

Note: The test currently fails because Jest mocks `date-fns`. To see the real bug, you need to unmock it or test manually in a browser.

## Relevant Code Locations

### MiniCalendarView.ts

All locations use `format(utcAnchoredDate, formatString)` which causes timezone-dependent formatting:

1. **Line 361** - `updateSelectedDate()` method:
   ```typescript
   const ariaLabel = dayEl.getAttribute("aria-label") || "";
   if (ariaLabel.includes(format(newDate, "EEEE, MMMM d, yyyy"))) {
   ```
   Bug: Compares formatted strings but formats with local timezone, causing wrong day element to be selected.

2. **Line 378 & 467** - Month display:
   ```typescript
   monthDisplay.textContent = format(this.plugin.selectedDate, "MMMM yyyy");
   ```
   Bug: Shows wrong month for dates early in the month in negative offset timezones.

3. **Line 604** - Previous month days aria-label:
   ```typescript
   "aria-label": format(dayDate, "EEEE, MMMM d, yyyy"),
   ```
   Bug: Tooltip shows wrong date.

4. **Line 656-657** - Current month days aria-label:
   ```typescript
   "aria-label":
     format(dayDate, "EEEE, MMMM d, yyyy") + (isToday ? " (Today)" : ""),
   ```
   Bug: Tooltip shows wrong date.

5. **Line 702** - Next month days aria-label:
   ```typescript
   "aria-label": format(dayDate, "EEEE, MMMM d, yyyy"),
   ```
   Bug: Tooltip shows wrong date.

### dateUtils.ts

The codebase already has a helper function for this exact purpose!

**Line 448-453** - `convertUTCToLocalCalendarDate()`:
```typescript
export function convertUTCToLocalCalendarDate(utcDate: Date): Date {
  const year = utcDate.getUTCFullYear();
  const month = utcDate.getUTCMonth();
  const day = utcDate.getUTCDate();
  return new Date(year, month, day);
}
```

This function is designed to convert UTC-anchored dates to local dates for display purposes, but **MiniCalendarView is not using it**.

## Proposed Solutions

### Solution 1: Use `convertUTCToLocalCalendarDate()` Helper (RECOMMENDED)

**Pros:**
- Uses existing, tested helper function
- Clear, readable intent
- Consistent with codebase patterns
- Already documented for this exact use case

**Cons:**
- Requires importing function
- Additional function call overhead (negligible)

**Implementation:**
```typescript
import { convertUTCToLocalCalendarDate } from "../utils/dateUtils";

// Before (buggy):
"aria-label": format(dayDate, "EEEE, MMMM d, yyyy")

// After (fixed):
"aria-label": format(convertUTCToLocalCalendarDate(dayDate), "EEEE, MMMM d, yyyy")
```

**Changes required:**
- MiniCalendarView.ts:2 - Add import
- MiniCalendarView.ts:361 - updateSelectedDate comparison
- MiniCalendarView.ts:378 - updateMonthDisplay
- MiniCalendarView.ts:467 - createCalendarControls month display
- MiniCalendarView.ts:542 - calendar aria-label
- MiniCalendarView.ts:604 - previous month aria-label
- MiniCalendarView.ts:656 - current month aria-label
- MiniCalendarView.ts:702 - next month aria-label

### Solution 2: Use UTC Methods to Format Manually

**Pros:**
- No additional imports
- Direct control over formatting
- Could be faster for simple formats

**Cons:**
- More verbose
- Harder to maintain
- Need to reimplement date-fns formatting logic
- Error-prone for complex formats
- Inconsistent with rest of codebase

**Implementation:**
```typescript
// Create manual formatter
const monthNames = ['January', 'February', ...];
const dayNames = ['Sunday', 'Monday', ...];

const dayOfWeek = new Date(
  utcDate.getUTCFullYear(),
  utcDate.getUTCMonth(),
  utcDate.getUTCDate()
).getDay();

const formatted = `${dayNames[dayOfWeek]}, ${monthNames[utcDate.getUTCMonth()]} ${utcDate.getUTCDate()}, ${utcDate.getUTCFullYear()}`;
```

### Solution 3: Inline UTC Component Extraction

**Pros:**
- Clear what's happening
- No additional imports
- Self-documenting

**Cons:**
- Repetitive code
- Harder to refactor
- Inconsistent with existing patterns

**Implementation:**
```typescript
// Before:
format(dayDate, "EEEE, MMMM d, yyyy")

// After:
format(
  new Date(dayDate.getUTCFullYear(), dayDate.getUTCMonth(), dayDate.getUTCDate()),
  "EEEE, MMMM d, yyyy"
)
```

## Recommended Approach

**Use Solution 1**: `convertUTCToLocalCalendarDate()` helper function.

### Rationale:
1. **Already exists** in the codebase specifically for this purpose
2. **Well-documented** with clear intent: "Converts a UTC-anchored Date object back to a local Date object representing the same calendar day, for display purposes"
3. **Type-safe** and tested
4. **Maintainable** - single location to fix if needed
5. **Consistent** with the UTC Anchor Pattern used throughout the codebase

### Implementation Steps:
1. Import `convertUTCToLocalCalendarDate` in MiniCalendarView.ts
2. Wrap all `format(utcDate, ...)` calls with `convertUTCToLocalCalendarDate(utcDate)`
3. Pay special attention to the comparison logic at line 361 where both the element's aria-label and the new date need conversion

### Code Pattern:
```typescript
// Import at top of file
import {
  convertUTCToLocalCalendarDate,
  // ... other imports
} from "../utils/dateUtils";

// Use throughout the file
const displayDate = convertUTCToLocalCalendarDate(utcAnchoredDate);
const formattedDate = format(displayDate, "EEEE, MMMM d, yyyy");
```

## Impact Analysis

### Affected Users
- Users in timezones with negative UTC offset (Americas, Pacific)
- Most severe in UTC-7 to UTC-12 (further from UTC = more noticeable)
- Does NOT affect users in UTC or positive offset timezones

### Severity
- **High**: Core calendar functionality shows wrong dates
- Breaks user trust in the application
- Causes confusion with recurring tasks
- Makes the calendar unreliable for planning

### Related Issues
This is part of a broader pattern of timezone bugs in the codebase. Similar issues have been fixed in:
- TaskEditModal calendar (issue #237)
- Recurrence calculations (issue #327, #322)
- Completion dates (issue #160, #314)

The root cause is always the same: **UTC-anchored dates formatted with local timezone methods**.

## Testing Strategy

1. **Unit test** (already created): `tests/unit/issues/issue-822-mini-calendar-tooltip-off-by-one.test.ts`
2. **Manual testing** in different timezones:
   - Pacific (UTC-7): Select Oct 2, expect "Thursday, October 2, 2025" tooltip
   - Eastern (UTC-5): Same test
   - UTC: Verify no regression
3. **Regression testing**: Ensure month navigation still works correctly
4. **Accessibility testing**: Verify aria-labels are correct with screen readers

## Additional Notes

### Why UTC Anchoring?
The codebase uses UTC-anchored dates (e.g., `2025-10-02T00:00:00.000Z`) for internal consistency:
- Prevents DST issues
- Consistent date comparisons across timezones
- Standardized storage format

This is the correct approach, but requires **UTC-aware formatting** for display.

### Documentation Comment from dateUtils.ts
```typescript
/**
 * Converts a UTC-anchored Date object back to a local Date object
 * representing the same calendar day, for display purposes.
 * @param utcDate - A UTC-anchored Date object (e.g., from selectedDate)
 * @returns A local Date object (e.g., for formatting with date-fns)
 */
```

This function exists specifically to solve this problem, but MiniCalendarView is not using it!
