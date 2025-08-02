# AdvancedCalendarView Audit Summary

## Date: 2025-08-02

## Issues Found and Fixed

### 1. Deprecated parseDate Usage
**Location:** Line 1043 in `createRecurringEvent()`
```typescript
// Before:
const start = parseDate(eventStart);

// After:
const start = parseDateToLocal(eventStart);
```
**Reason:** Using deprecated function for datetime parsing

### 2. Direct new Date() for Current Time
**Location:** Line 1701 in `handleEventDidMount()`
```typescript
// Before:
: (arg.event.start || new Date());

// After:
: (arg.event.start || getTodayLocal());
```
**Reason:** More consistent with the codebase's date handling patterns

### 3. Direct new Date() for Time Entry Parsing
**Location:** Lines 1920-1921 in `showTimeEntryContextMenu()`
```typescript
// Before:
const start = new Date(timeEntry.startTime);
const end = new Date(timeEntry.endTime);

// After:
const start = parseDateToLocal(timeEntry.startTime);
const end = parseDateToLocal(timeEntry.endTime);
```
**Reason:** Ensures consistent timezone handling for ISO datetime strings

### 4. Date Iteration Using setDate()
**Location:** Lines 1227-1249 in `getTimeblockEvents()`
```typescript
// Before:
const currentDate = new Date(visibleStart);
while (currentDate <= visibleEnd) {
    // ... code ...
    currentDate.setDate(currentDate.getDate() + 1);
}

// After:
const startTime = visibleStart.getTime();
const endTime = visibleEnd.getTime();
const oneDayMs = 24 * 60 * 60 * 1000;

for (let time = startTime; time <= endTime; time += oneDayMs) {
    const currentDate = new Date(time);
    // ... code ...
}
```
**Reason:** Avoids DST boundary issues with date manipulation

## Safe Patterns Found (No Changes Needed)

### Time Arithmetic
The following patterns are safe because they work with timestamps:
```typescript
const end = new Date(start.getTime() + (task.timeEstimate * 60 * 1000));
```
These create new Date objects from millisecond timestamps, which is timezone-safe.

### FullCalendar Date Objects
```typescript
const currentDate = new Date(visibleStart);
```
When `visibleStart` is already a Date object from FullCalendar, this is just copying the date.

## Summary

The AdvancedCalendarView has been largely updated to follow the UTC Anchor principle. The remaining issues were:
- One instance of deprecated `parseDate` usage
- Three instances of direct `new Date()` construction that needed improvement
- One date iteration pattern that could have DST issues

All issues have been fixed to ensure consistent timezone handling throughout the calendar view.