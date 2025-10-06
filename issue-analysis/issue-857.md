# Issue #857 Analysis: Mini Calendar Opens Previous Day

## Problem Understanding

### User Report
Issue #857 reports that clicking on a day in the Mini Calendar opens the previous day's daily note. This is a regression or continuation of issue #822, which fixed the tooltips to show the correct date but did not fix the click handler.

**Example from the issue:**
- User in US Eastern Daylight Time (UTC-4)
- Clicks on a date in the Mini Calendar
- The tooltip shows the **correct** date (fixed in #822)
- But clicking opens the **previous day's** daily note

### Root Cause

The bug occurs because **UTC-anchored dates** are passed directly to `moment()`, which interprets them in the **local timezone**.

#### How the Bug Happens

1. **Mini Calendar creates UTC-anchored dates** for internal consistency:
   ```typescript
   const dayDate = new Date(Date.UTC(2025, 9, 2, 0, 0, 0)); // Oct 2, 2025 00:00 UTC
   // ISO: "2025-10-02T00:00:00.000Z"
   ```

2. **Click handler passes this to `navigateToDailyNote(dayDate)`**

3. **`navigateToDailyNote` passes it to moment()**:
   ```typescript
   const moment = window.moment(date); // Bug is here!
   ```

4. **moment() interprets the Date in the local timezone**:
   - In Pacific (UTC-7): `2025-10-02T00:00:00.000Z` → Oct 1, 5:00 PM
   - In Eastern (UTC-4): `2025-10-02T00:00:00.000Z` → Oct 1, 8:00 PM
   - In UTC: `2025-10-02T00:00:00.000Z` → Oct 2, 12:00 AM (correct)

5. **Daily Notes API looks up Oct 1 instead of Oct 2** ❌

#### Why Issue #822 Fixed Tooltips But Not Clicks

Issue #822 fixed tooltips by using `convertUTCToLocalCalendarDate()` before formatting:

```typescript
// Fixed in #822 (line 605, 658, 703):
"aria-label": format(convertUTCToLocalCalendarDate(dayDate), "EEEE, MMMM d, yyyy")
```

However, the click handler code was not updated:
```typescript
// Still buggy (line 1475-1481, 1485-1490):
void this.plugin.navigateToDailyNote(dayDate); // Passes UTC-anchored date
```

## Test File Location

**Test file**: `tests/unit/issues/issue-857-mini-calendar-click-off-by-one.test.ts`

This test demonstrates:
1. How the bug occurs when passing UTC-anchored dates to moment()
2. How the fix works using `convertUTCToLocalCalendarDate()`
3. Concrete examples with different dates

### How to Run the Test

```bash
npm test -- issue-857-mini-calendar-click-off-by-one.test.ts
```

## Relevant Code Locations

### Primary Bug Location

**main.ts:1728** - `navigateToDailyNote()` method:
```typescript
async navigateToDailyNote(date: Date) {
    // ...
    // Convert date to moment for the API
    const moment = (window as Window & { moment: (date: Date) => any }).moment(date);
    // ^^^ Bug: Passes UTC-anchored date directly to moment()

    const allDailyNotes = getAllDailyNotes();
    let dailyNote = getDailyNote(moment, allDailyNotes);
    // ...
}
```

### Secondary Bug Location

**MiniCalendarView.ts:1392** - `getDailyNotePath()` helper:
```typescript
private getDailyNotePath(date: Date): string | null {
    try {
        const moment = (window as any).moment(date);
        // ^^^ Same bug: Passes UTC-anchored date directly to moment()

        const allDailyNotes = getAllDailyNotes();
        const dailyNote = getDailyNote(moment, allDailyNotes);
        return dailyNote ? dailyNote.path : null;
    } catch (error) {
        return null;
    }
}
```

### Click Handler Locations (Pass UTC-anchored dates)

**MiniCalendarView.ts:1475-1481** - `setupDayInteractionEvents()` click handler:
```typescript
dayEl.addEventListener("click", (event: MouseEvent) => {
    this.plugin.setSelectedDate(dayDate);

    if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        void this.plugin.navigateToDailyNote(dayDate); // Passes UTC-anchored date
    }
});
```

**MiniCalendarView.ts:1485-1490** - Double-click handler:
```typescript
dayEl.addEventListener("dblclick", (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.plugin.setSelectedDate(dayDate);
    void this.plugin.navigateToDailyNote(dayDate); // Passes UTC-anchored date
});
```

**MiniCalendarView.ts:286** - Keyboard Enter handler:
```typescript
case "Enter":
    e.preventDefault();
    this.plugin.navigateToDailyNote(currentDate); // Passes UTC-anchored date
    return;
```

**MiniCalendarView.ts:1367-1372** - Hover preview:
```typescript
private showDayPreview(event: MouseEvent, date: Date, targetEl: HTMLElement) {
    const dailyNotePath = this.getDailyNotePath(date); // Calls buggy helper
    // ...
}
```

### Existing Helper Function (Already Available!)

**dateUtils.ts:448-453** - `convertUTCToLocalCalendarDate()`:
```typescript
/**
 * Converts a UTC-anchored Date object back to a local Date object
 * representing the same calendar day, for display purposes.
 * @param utcDate - A UTC-anchored Date object (e.g., from selectedDate)
 * @returns A local Date object (e.g., for formatting with date-fns)
 */
export function convertUTCToLocalCalendarDate(utcDate: Date): Date {
    const year = utcDate.getUTCFullYear();
    const month = utcDate.getUTCMonth();
    const day = utcDate.getUTCDate();
    return new Date(year, month, day);
}
```

## Proposed Solutions

### Solution 1: Use `convertUTCToLocalCalendarDate()` Before moment() (RECOMMENDED)

**Pros:**
- Uses existing, well-tested helper function
- Consistent with the fix for issue #822
- Clear intent and maintainable
- Minimal code changes
- Already imported in MiniCalendarView.ts

**Cons:**
- Requires importing the function in main.ts
- One additional function call (negligible performance impact)

**Implementation:**

```typescript
// main.ts - Add import
import { convertUTCToLocalCalendarDate } from "./utils/dateUtils";

// main.ts:1717-1728 - Fix navigateToDailyNote
async navigateToDailyNote(date: Date) {
    try {
        if (!appHasDailyNotesPluginLoaded()) {
            new Notice("Daily Notes core plugin is not enabled...");
            return;
        }

        // FIX: Convert UTC-anchored date to local calendar date before passing to moment
        const localDate = convertUTCToLocalCalendarDate(date);
        const moment = (window as Window & { moment: (date: Date) => any }).moment(localDate);

        // ... rest of the function
    }
}

// MiniCalendarView.ts:1390-1400 - Fix getDailyNotePath
private getDailyNotePath(date: Date): string | null {
    try {
        // FIX: Convert UTC-anchored date to local calendar date before passing to moment
        const localDate = convertUTCToLocalCalendarDate(date);
        const moment = (window as any).moment(localDate);

        const allDailyNotes = getAllDailyNotes();
        const dailyNote = getDailyNote(moment, allDailyNotes);
        return dailyNote ? dailyNote.path : null;
    } catch (error) {
        return null;
    }
}
```

### Solution 2: Extract UTC Components Inline

**Pros:**
- No additional imports needed
- Direct and explicit
- Self-documenting

**Cons:**
- Repetitive code
- Harder to maintain
- Inconsistent with existing patterns
- Duplicates logic that already exists in dateUtils

**Implementation:**

```typescript
// Inline extraction
const localDate = new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
);
const moment = window.moment(localDate);
```

### Solution 3: Use UTC Methods on moment()

**Pros:**
- Could work if moment.js has UTC-aware methods
- Might preserve timezone information

**Cons:**
- Requires understanding moment.js internals
- May not work with Daily Notes API expectations
- More complex and error-prone
- Inconsistent with codebase patterns

**Implementation:**

```typescript
// This approach is NOT recommended and may not work correctly
const moment = window.moment.utc(date.toISOString()).local();
```

## Recommended Approach

**Use Solution 1**: Convert UTC-anchored dates to local calendar dates using `convertUTCToLocalCalendarDate()` before passing to moment().

### Rationale:

1. **Consistency**: This is exactly how issue #822 was fixed for tooltips
2. **Existing infrastructure**: The helper function already exists and is well-tested
3. **Clear intent**: Function name explicitly states what it does
4. **Maintainable**: Single source of truth for this conversion
5. **Type-safe**: Pure TypeScript function with clear types
6. **Proven**: Already successfully used in 8 places in MiniCalendarView.ts

### Implementation Steps:

1. **Import the helper in main.ts**:
   ```typescript
   import { convertUTCToLocalCalendarDate } from "./utils/dateUtils";
   ```

2. **Update `navigateToDailyNote()` in main.ts:1728**:
   ```typescript
   const localDate = convertUTCToLocalCalendarDate(date);
   const moment = window.moment(localDate);
   ```

3. **Update `getDailyNotePath()` in MiniCalendarView.ts:1392**:
   ```typescript
   const localDate = convertUTCToLocalCalendarDate(date);
   const moment = (window as any).moment(localDate);
   ```

4. **Add comments** explaining why this conversion is necessary

## Impact Analysis

### Affected Users

- **All users in negative UTC offset timezones** (Americas, Pacific)
- More noticeable in timezones further from UTC (UTC-7 to UTC-12)
- Does NOT affect users in UTC+0 or positive offset timezones
- Severity increases the earlier in the day the user is interacting with the calendar

### Severity

- **High**: Core calendar functionality is broken
- Users cannot reliably navigate to the correct daily note
- Creates confusion and erodes trust in the application
- Particularly problematic for users who rely on daily notes for planning

### User Experience Impact

**Before Fix:**
1. User sees correct date in tooltip (thanks to #822)
2. User clicks on the date
3. Wrong daily note opens (previous day)
4. User is confused by the mismatch

**After Fix:**
1. User sees correct date in tooltip ✓
2. User clicks on the date ✓
3. Correct daily note opens ✓
4. Consistent, predictable behavior ✓

### Related Issues

This is part of a broader timezone bug pattern in the codebase:

- **Issue #822**: Mini Calendar tooltips off by one day (FIXED - partial)
- **Issue #857**: Mini Calendar clicks open wrong day (THIS ISSUE)
- **Issue #327**: Recurring task wrong day
- **Issue #322**: Completion calendar timezone bug
- **Issue #314**: Complete instances timezone bug
- **Issue #160**: Off-by-one completions

**Common root cause**: UTC-anchored dates passed to functions expecting local dates or formatted with local timezone methods.

## Testing Strategy

### 1. Unit Tests (Created)

**File**: `tests/unit/issues/issue-857-mini-calendar-click-off-by-one.test.ts`

Tests cover:
- Bug reproduction with UTC-anchored dates
- Fix verification using `convertUTCToLocalCalendarDate()`
- Multiple date scenarios
- Clear documentation of the problem

### 2. Manual Testing

**Test in different timezones:**

1. **Pacific (UTC-7):**
   - Click Oct 2 in mini calendar
   - Should open Oct 2 daily note (not Oct 1)
   - Test with Ctrl/Cmd+Click and double-click

2. **Eastern (UTC-4):**
   - Same test as above
   - Verify correct day opens

3. **UTC:**
   - Verify no regression
   - Should work correctly (already does)

4. **Test edge cases:**
   - First day of month (Oct 1)
   - Last day of month (Oct 31)
   - Across year boundaries (Dec 31 → Jan 1)

### 3. Integration Testing

**Scenarios to test:**

1. **Click on calendar day** → Opens correct daily note
2. **Ctrl/Cmd + Click** → Opens correct daily note
3. **Double-click** → Opens correct daily note
4. **Press Enter on selected day** → Opens correct daily note
5. **Hover over day** → Preview shows correct daily note
6. **Tooltip** → Shows correct date (already fixed in #822)

### 4. Regression Testing

**Ensure no breakage:**

1. Daily note creation still works
2. Month navigation works correctly
3. Keyboard navigation works
4. Drag-and-drop task scheduling works
5. Calendar colorization works

## Additional Notes

### Why UTC Anchoring?

The codebase uses UTC-anchored dates (e.g., `2025-10-02T00:00:00.000Z`) for internal consistency:

- **Prevents DST issues**: No ambiguous or duplicate hours
- **Consistent comparisons**: Same date = same timestamp across timezones
- **Standardized storage**: All dates stored in same format

This is the **correct approach**, but requires **proper conversion when interfacing with timezone-aware APIs** like moment.js.

### What is a UTC-Anchored Date?

A UTC-anchored date is a JavaScript Date object where:
- The **UTC components** represent the calendar date (year, month, day)
- The **time** is always midnight UTC (00:00:00.000Z)
- Example: Oct 2, 2025 → `new Date(Date.UTC(2025, 9, 2))` → `2025-10-02T00:00:00.000Z`

### Why moment() Needs Local Dates

The moment.js library and Obsidian's Daily Notes API expect dates in the **local timezone**:
- `moment(date)` interprets the Date object's local time components
- To get the correct day, we must pass a Date whose **local components** match the calendar day

### The Conversion Pattern

```typescript
// UTC-anchored date (internal representation)
const utcDate = new Date(Date.UTC(2025, 9, 2)); // 2025-10-02T00:00:00.000Z

// Convert to local calendar date (for external APIs)
const localDate = convertUTCToLocalCalendarDate(utcDate);
// Creates: new Date(2025, 9, 2) - represents Oct 2 in local timezone

// Now safe to use with moment()
const moment = window.moment(localDate); // Correctly interprets as Oct 2
```

### Code Pattern Summary

**When formatting for display:**
```typescript
const displayString = format(convertUTCToLocalCalendarDate(utcDate), "MMMM d, yyyy");
```

**When passing to moment():**
```typescript
const moment = window.moment(convertUTCToLocalCalendarDate(utcDate));
```

**When comparing dates:**
```typescript
const isSame = isSameDay(utcDate1, utcDate2); // Use UTC-aware comparison
```

## Files to Modify

1. **src/main.ts**
   - Line 1-10: Add import for `convertUTCToLocalCalendarDate`
   - Line 1728: Convert date before passing to moment()

2. **src/views/MiniCalendarView.ts**
   - Line 1392: Convert date before passing to moment() in `getDailyNotePath()`

## Success Criteria

✅ Clicking a calendar day opens the correct daily note in all timezones
✅ Ctrl/Cmd+Click opens the correct daily note
✅ Double-click opens the correct daily note
✅ Enter key opens the correct daily note
✅ Hover preview shows the correct daily note
✅ Unit tests pass
✅ No regressions in existing functionality
✅ Consistent behavior across all timezones
