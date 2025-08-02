# ChronoSync Timezone Handling Guide

## Overview

ChronoSync uses a **UTC Midnight Convention** to ensure consistent date handling across all timezones. This guide explains how to handle dates correctly to avoid timezone-related bugs.

## Core Principle: Local Dates for Users, UTC for RRule

1. **User-facing operations** (display, input, storage) use **local dates**
2. **RRule operations** internally use **UTC** but convert to/from local dates at boundaries
3. **Never mix** `format()` with `formatDateForStorage()` - they're the same now!

## The Golden Rules

### ✅ DO Use These Functions

```typescript
// For storing/displaying dates (YYYY-MM-DD format)
import { formatDateForStorage, getTodayLocal } from '@/utils/dateUtils';

const today = getTodayLocal();
const dateString = formatDateForStorage(someDate);
```

### ❌ DON'T Use These

```typescript
// NEVER use format() from date-fns directly for dates
import { format } from 'date-fns';
const dateString = format(date, 'yyyy-MM-dd'); // ❌ WRONG!

// NEVER create dates like this for today
const today = new Date(); // ❌ WRONG! Includes time component
```

## Common Scenarios

### 1. Getting Today's Date

```typescript
// ✅ CORRECT
import { getTodayLocal } from '@/utils/dateUtils';
const today = getTodayLocal(); // Returns Date object at 00:00:00 local time

// ✅ CORRECT - As a string
import { getTodayString } from '@/utils/dateUtils';
const todayStr = getTodayString(); // Returns "YYYY-MM-DD"

// ❌ WRONG
const today = new Date(); // Has time component, can cause boundary issues
```

### 2. Formatting Dates for Storage

```typescript
// ✅ CORRECT
import { formatDateForStorage } from '@/utils/dateUtils';
const dateStr = formatDateForStorage(date); // Always returns local date

// ❌ WRONG
import { format } from 'date-fns';
const dateStr = format(date, 'yyyy-MM-dd'); // May use wrong timezone
```

### 3. Parsing Date Strings

```typescript
// ✅ CORRECT - For date-only strings
import { parseDateAsLocal } from '@/utils/dateUtils';
const date = parseDateAsLocal('2025-01-21'); // Interprets as local date

// ✅ CORRECT - For dates with time
import { parseDate } from '@/utils/dateUtils';
const dateTime = parseDate('2025-01-21T14:30:00Z');

// ❌ WRONG
const date = new Date('2025-01-21'); // May interpret as UTC midnight
```

### 4. Working with Recurring Tasks (RRule)

```typescript
// ✅ CORRECT - RRule handles UTC conversion internally
import { isDueByRRule, generateRecurringInstances } from '@/utils/helpers';

// Just pass local dates - the functions handle UTC conversion
const isdue = isDueByRRule(task, localDate);
const instances = generateRecurringInstances(task, startDate, endDate);

// ❌ WRONG - Don't manually convert to UTC
const utcDate = new Date(Date.UTC(...)); // Let the helpers handle this
```

### 5. Task Completion

```typescript
// ✅ CORRECT
const completionDate = formatDateForStorage(getTodayLocal());
task.complete_instances.push(completionDate);

// ❌ WRONG
const completionDate = format(new Date(), 'yyyy-MM-dd');
```

### 6. Calendar Operations

```typescript
// ✅ CORRECT - Calendar should use local dates
const calendarDate = formatDateForStorage(selectedDate);
const events = getEventsForDate(parseDateAsLocal(dateString));

// ❌ WRONG
const calendarDate = formatDateForStorage(date); // This now returns local anyway
```

## Key Functions Reference

### From `dateUtils.ts`:

- `getTodayLocal()` - Get today as Date object at 00:00:00 local
- `getTodayString()` - Get today as "YYYY-MM-DD" string
- `formatDateForStorage(date)` - Convert any date to "YYYY-MM-DD" local
- `parseDateAsLocal(dateString)` - Parse "YYYY-MM-DD" as local date
- `parseDate(dateString)` - Parse any date string (handles timezones)
- `hasTimeComponent(dateString)` - Check if string includes time

### What About `formatDateForStorage()`?

This function now just calls `formatDateForStorage()` internally. It exists for backward compatibility but always returns local dates. You can use either, but prefer `formatDateForStorage()` for clarity.

## Testing Your Code

When writing tests involving dates:

```typescript
// ✅ CORRECT - Use specific dates
const testDate = new Date(2025, 0, 21); // January 21, 2025 local
const testDateStr = '2025-01-21';

// ✅ CORRECT - Mock current date
jest.spyOn(Date, 'now').mockReturnValue(new Date(2025, 0, 21).getTime());

// ❌ WRONG - Don't use dynamic dates in tests
const today = new Date(); // Makes tests non-deterministic
```

## Common Pitfalls to Avoid

### 1. The Midnight Boundary Problem

```typescript
// ❌ PROBLEM: User in AEST (UTC+10) at 11 PM marks task complete
const now = new Date(); // 2025-01-21T23:00:00+10:00
const utcString = format(now, 'yyyy-MM-dd'); // "2025-01-21" 
const localString = formatDateForStorage(now); // "2025-01-21" ✅ Same!

// But if they marked it at 1 AM...
const later = new Date(); // 2025-01-22T01:00:00+10:00
const utcString = format(later, 'yyyy-MM-dd'); // Would be "2025-01-21" ❌ Wrong!
const localString = formatDateForStorage(later); // "2025-01-22" ✅ Correct!
```

### 2. String Comparison Safety

```typescript
// ✅ SAFE - Both sides use same format
const isOverdue = task.scheduled < getTodayString();

// ❌ UNSAFE - Mixing formats
const isOverdue = task.scheduled < format(new Date(), 'yyyy-MM-dd');
```

### 3. RRule Date Anchoring

```typescript
// ✅ CORRECT - Let helpers handle UTC conversion
const instances = generateRecurringInstances(task, startDate, endDate);

// ❌ WRONG - Don't pre-convert to UTC
const utcStart = new Date(Date.UTC(...));
const instances = generateRecurringInstances(task, utcStart, utcEnd);
```

## Migration Checklist

When updating old code:

- [ ] Replace all `format(date, 'yyyy-MM-dd')` with `formatDateForStorage(date)`
- [ ] Replace `new Date()` for today with `getTodayLocal()`
- [ ] Replace manual date string parsing with `parseDateAsLocal()`
- [ ] Ensure calendar operations use local dates
- [ ] Update tests to use fixed dates instead of dynamic dates

## Why This Approach?

1. **Users think in local dates** - When they see "Jan 21", they mean Jan 21 in their timezone
2. **RRule needs UTC** - But we handle the conversion transparently
3. **Consistency prevents bugs** - Using the same format everywhere eliminates boundary issues
4. **Storage remains stable** - "2025-01-21" means the same thing regardless of where it's read

## Questions?

If you're unsure about date handling in a specific scenario:

1. Check existing similar code in the codebase
2. Default to using the utility functions in `dateUtils.ts`
3. Write a test to verify the behavior across timezone boundaries
4. Ask in code review if still uncertain

Remember: **When in doubt, use `formatDateForStorage()` and `getTodayLocal()`!**