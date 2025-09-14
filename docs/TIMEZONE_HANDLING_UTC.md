# UTC-Based Timezone Handling in TaskNotes

## Overview

TaskNotes implements a UTC-based timezone approach to ensure consistent date handling across all timezones while maintaining intuitive user behavior. This document explains the technical implementation, design decisions, and best practices for developers working with the codebase.

## Core Architecture

### The UTC Midnight Convention

TaskNotes follows a **UTC Midnight Convention** that operates on two key principles:

1. **User-facing operations** use local dates for intuitive behavior
2. **Internal calculations** use UTC to prevent timezone-dependent bugs

This hybrid approach ensures that:
- Users see dates in their local timezone context
- The system calculates dates consistently regardless of user timezone
- Recurring tasks and date boundaries work correctly across all timezones

### Date Flow Architecture

```
User Input (Local) → Storage (YYYY-MM-DD) → Processing (UTC) → Display (Local)
```

## Key Functions and Behavior

### Date Creation Functions

#### `formatDateForStorage(date: Date): string`

**Purpose**: Converts Date objects to YYYY-MM-DD format using UTC components to ensure consistent date representation across timezones.

**Behavior**:
```typescript
// Uses UTC methods to prevent timezone shifts
const year = date.getUTCFullYear();
const month = String(date.getUTCMonth() + 1).padStart(2, '0');
const day = String(date.getUTCDate()).padStart(2, '0');
return `${year}-${month}-${day}`;
```

**When to use**: Converting any Date object to storage format, replacing `format(date, 'yyyy-MM-dd')`.

#### `getTodayLocal(): Date`

**Purpose**: Returns today's date as a Date object set to midnight local time.

**Behavior**:
```typescript
const now = new Date();
return new Date(now.getFullYear(), now.getMonth(), now.getDate());
```

**When to use**: Getting "today" from the user's perspective for comparisons and calculations.

#### `parseDateAsLocal(dateString: string): Date`

**Purpose**: Parses YYYY-MM-DD strings as local dates at midnight to ensure consistent day representation.

**Behavior**:
```typescript
// For "2024-10-01", creates Date(2024, 9, 1) - local midnight
const [year, month, day] = dateString.split('-').map(Number);
return new Date(year, month - 1, day);
```

**When to use**: Converting date-only strings to Date objects for user-facing operations.

#### `createUTCDateForRRule(dateString: string): Date`

**Purpose**: Creates UTC dates at midnight for RRule operations to preserve correct day-of-week calculations.

**Behavior**:
```typescript
// For "2024-10-01", creates Date.UTC(2024, 9, 1) - UTC midnight
return new Date(Date.UTC(year, month - 1, day));
```

**When to use**: Converting dates for recurring task calculations with RRule library.

### Date Comparison and Utilities

#### `isOverdueTimeAware(dateString: string, isCompleted?: boolean, hideCompletedFromOverdue?: boolean): boolean`

**Purpose**: Determines if a date/datetime is overdue with completion status awareness.

**Behavior**:
- For datetime strings: Compares with current moment
- For date-only strings: Compares calendar days using local dates
- Respects completion status and user preferences

#### `isBeforeDateTimeAware(date1: string, date2: string): boolean`

**Purpose**: Time-aware comparison for sorting tasks with mixed date/datetime formats.

**Behavior**:
- Both have time: Direct comparison
- Neither has time: Compare start-of-day
- Mixed: Treat date-only as end-of-day for sorting

#### `hasTimeComponent(dateString: string): boolean`

**Purpose**: Detects if a date string includes time information.

**Pattern**: Checks for 'T' followed by time pattern (HH:mm or HH:mm:ss).

## Timezone Handling Guidelines

### For Developers

#### 1. Date Storage and Retrieval

```typescript
// ✅ CORRECT - Use formatDateForStorage for consistent dates
const dueDate = formatDateForStorage(selectedDate);

// ❌ INCORRECT - Don't use date-fns format directly
const dueDate = format(selectedDate, 'yyyy-MM-dd');
```

#### 2. Getting Today's Date

```typescript
// ✅ CORRECT - Use getTodayLocal for user perspective
const today = getTodayLocal();

// ✅ CORRECT - Use getTodayString for string format
const todayStr = getTodayString();

// ❌ INCORRECT - Don't use new Date() for "today"
const today = new Date(); // Includes time, causes boundary issues
```

#### 3. Date Parsing

```typescript
// ✅ CORRECT - Use parseDateAsLocal for date-only strings
const taskDate = parseDateAsLocal('2024-10-01');

// ✅ CORRECT - Use parseDate for datetime strings
const timestamp = parseDate('2024-10-01T14:30:00Z');

// ❌ INCORRECT - Don't mix parsing functions
const taskDate = parseDate('2024-10-01'); // May cause timezone shifts
```

#### 4. Recurring Task Calculations

```typescript
// ✅ CORRECT - Use createUTCDateForRRule for RRule operations
const rruleDate = createUTCDateForRRule(dateString);
const isRecurring = rrule.between(rruleDate, endDate);

// ❌ INCORRECT - Don't use local dates with RRule
const localDate = parseDateAsLocal(dateString);
const isRecurring = rrule.between(localDate, endDate); // Wrong day-of-week
```

### Common Pitfalls and Solutions

#### 1. Off-by-One Day Errors

**Problem**: Users in certain timezones see tasks on wrong days.

**Cause**: Mixing UTC and local date interpretations.

**Solution**:
```typescript
// ✅ CORRECT - Consistent local date handling
const dueDate = formatDateForStorage(userSelectedDate);
const taskDate = parseDateAsLocal(dueDate);
const isToday = isSameDay(taskDate, getTodayLocal());

// ❌ INCORRECT - Mixed timezone handling
const dueDate = format(userSelectedDate, 'yyyy-MM-dd'); // UTC
const taskDate = parseDate(dueDate); // Might shift timezone
```

#### 2. Recurring Task Wrong Day

**Problem**: Recurring tasks appear on incorrect days in some timezones.

**Cause**: RRule calculations using local dates instead of UTC.

**Solution**:
```typescript
// ✅ CORRECT - Use UTC dates for RRule, local for boundaries
const startUTC = createUTCDateForRRule(startDateString);
const checkDateUTC = createUTCDateForRRule(formatDateForStorage(checkDate));
const isRecurring = rrule.between(startUTC, checkDateUTC);

// ❌ INCORRECT - Using local dates with RRule
const startLocal = parseDateAsLocal(startDateString);
const isRecurring = rrule.between(startLocal, checkDate); // Wrong calculations
```

#### 3. Calendar Display Issues

**Problem**: Tasks show on wrong calendar dates.

**Cause**: Inconsistent date formatting between storage and display.

**Solution**:
```typescript
// ✅ CORRECT - Consistent formatting
const calendarDate = formatDateForStorage(selectedDate);
const tasksForDate = getTasksForDate(calendarDate);

// ❌ INCORRECT - Mixed formatting approaches
const calendarDate = format(selectedDate, 'yyyy-MM-dd'); // Might be UTC
const tasksForDate = getTasksForDate(calendarDate); // Expects local
```

## Recent Fixes (Issues #327, #322, #314)

### Issue #327: Recurring Task Wrong Day Completion

**Problem**: Users completing recurring tasks on the correct day had the completion recorded for the wrong date, causing the task to still appear as due.

**Root Cause**: `isDueByRRule` function was using `formatDateForStorage()` (returns local date) to create dates that were then passed to `createUTCDateForRRule()` (expects UTC interpretation), causing a timezone mismatch.

**Fix Applied**:
1. Added `formatDateAsUTCString()` function for RRule-specific formatting
2. Updated `isDueByRRule` to use `formatDateAsUTCString` instead of `formatDateForStorage`
3. Ensured all RRule operations use consistent UTC dates

**Code Change**:
```typescript
// Before (BROKEN)
const dateStr = formatDateForStorage(targetDate); // Local date string
const rruleDate = createUTCDateForRRule(dateStr); // Interpreted as UTC - MISMATCH!

// After (FIXED)
const dateStr = formatDateAsUTCString(targetDate); // UTC date string
const rruleDate = createUTCDateForRRule(dateStr); // Interpreted as UTC - CONSISTENT!
```

### Issue #322: Calendar Display Timezone Bugs

**Problem**: Tasks appeared on wrong dates in calendar views depending on user timezone.

**Root Cause**: Inconsistent use of `format()` vs `formatDateForStorage()` for date string generation.

**Fix Applied**:
1. Standardized all calendar date formatting to use `formatDateForStorage()`
2. Updated AdvancedCalendarView, TaskEditModal, and other calendar components
3. Ensured consistent local date interpretation throughout the calendar system

### Issue #314: Complete Instances Timezone Inconsistency

**Problem**: Task completion dates stored in `complete_instances` array were inconsistent across timezones.

**Root Cause**: Mixed use of UTC and local date formatting when recording completion dates.

**Fix Applied**:
1. Standardized completion date recording to use `formatDateForStorage()`
2. Added `validateCompleteInstances()` function to filter invalid time-only entries
3. Updated all completion workflows to use consistent local date format

## Testing Strategy

### Timezone-Aware Test Cases

TaskNotes includes comprehensive tests for timezone handling:

1. **Basic Date Functions**: Test date creation, parsing, and formatting across timezones
2. **Recurring Task Logic**: Verify RRule calculations work correctly regardless of user timezone
3. **Completion Workflows**: Test task completion recording and validation
4. **Calendar Integration**: Verify tasks appear on correct dates in all views
5. **Edge Cases**: Test boundary conditions like midnight, DST transitions, etc.

### Test Structure Example

```typescript
describe('Timezone handling', () => {
  it('should handle recurring tasks consistently across timezones', () => {
    // Test setup with specific timezone
    const task = createRecurringTask('2024-10-01', 'daily');
    const checkDate = new Date('2024-10-05T12:00:00Z');
    
    // Test in different timezone contexts
    const isRecurring = isDueByRRule(task, checkDate);
    expect(isRecurring).toBe(true); // Should work regardless of test runner timezone
  });
});
```

## Migration Notes

### For Existing Code

When updating existing code to follow the UTC-based approach:

1. **Replace date-fns format calls**:
   ```typescript
   // Old
   const dateStr = format(date, 'yyyy-MM-dd');
   
   // New
   const dateStr = formatDateForStorage(date);
   ```

2. **Update "today" calculations**:
   ```typescript
   // Old
   const today = new Date();
   
   // New
   const today = getTodayLocal();
   ```

3. **Fix date parsing**:
   ```typescript
   // Old (for date-only strings)
   const date = parseDate('2024-10-01');
   
   // New (for date-only strings)
   const date = parseDateAsLocal('2024-10-01');
   ```

### Breaking Changes

The UTC-based approach introduces some breaking changes:

1. **Date Storage Format**: All dates now consistently use local timezone interpretation
2. **RRule Integration**: Requires specific UTC handling for recurring task calculations
3. **API Consistency**: Date functions now have clearer, more specific purposes

## Performance Considerations

The UTC-based approach is designed for performance:

1. **Reduced Calculations**: Fewer timezone conversions in hot paths
2. **Consistent Caching**: Date strings are consistent across operations
3. **Optimized Comparisons**: Time-aware comparisons reduce unnecessary parsing

## Future Considerations

### Potential Enhancements

1. **Timezone-Aware Display**: Show tasks with time in user's preferred timezone
2. **Multi-Timezone Support**: Handle tasks created in different timezones
3. **DST Handling**: Enhanced support for daylight saving time transitions
4. **Performance Optimization**: Further caching of timezone calculations

### Compatibility

The UTC-based approach maintains backward compatibility:

1. **Existing Data**: Works with existing YYYY-MM-DD date formats
2. **API Stability**: Core date functions maintain same signatures
3. **Plugin Integration**: Compatible with Obsidian's date handling expectations

## Conclusion

The UTC-based timezone approach provides TaskNotes with robust, consistent date handling that prevents timezone-related bugs while maintaining intuitive user behavior. By following the guidelines in this document, developers can ensure their code works correctly for users in all timezones.

For quick reference, see the [Timezone Quick Reference Guide](TIMEZONE_QUICK_REFERENCE.md) for common patterns and functions.