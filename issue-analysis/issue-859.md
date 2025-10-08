# Issue #859 Analysis: Multiple Days Task Glitches in Calendar View

## Problem Understanding

### Issue Description
When creating a multi-day task by dragging in the calendar view, the task duration behaves unexpectedly. Users report that when they drag to create a 2-day task, it spreads to an entire week, several weeks, or any random amount of days. This happens in both the base calendar view (Bases integration) and the old calendar view (AdvancedCalendarView).

### Root Cause
The bug is **only in the Bases calendar view** (`src/bases/calendar-view.ts`), not in AdvancedCalendarView. The issue occurs because the `handleDateSelect` function in the Bases calendar view doesn't calculate the `timeEstimate` property for multi-day all-day task selections, unlike AdvancedCalendarView which does.

When a user drags across multiple days:
1. The Bases calendar view only sets the `scheduled` date to the start date
2. It does NOT calculate or set the `timeEstimate` based on the number of days dragged
3. The TaskCreationModal then either uses a default time estimate or shows an incorrect duration
4. When the task is displayed back on the calendar, the end date is calculated from `start + timeEstimate`, which doesn't match the user's intended selection

The AdvancedCalendarView (old calendar view) already has the fix implemented (see issue #564), but this fix was never ported to the Bases calendar view.

### Evidence
Comparing the two implementations:

**AdvancedCalendarView** (`src/views/AdvancedCalendarView.ts:1182-1225`):
- ✅ Calculates `daysDuration` for multi-day all-day selections
- ✅ Sets `timeEstimate = daysDuration * minutesPerDay` when `daysDuration > 1`
- ✅ Handles single-day selections correctly (no time estimate)
- ✅ Handles timed selections correctly

**Bases Calendar View** (`src/bases/calendar-view.ts:108-139`):
- ❌ Does NOT calculate duration for multi-day selections
- ❌ Only sets `scheduled` date, ignoring the dragged duration
- ❌ Missing the entire multi-day calculation logic

## Test File Location

**Test File**: `tests/unit/issues/issue-859-bases-calendar-multi-day-task.test.ts`

**How to Run**:
```bash
npm test -- tests/unit/issues/issue-859-bases-calendar-multi-day-task.test.ts
```

The test demonstrates:
1. The current buggy behavior (timeEstimate is undefined for multi-day selections)
2. The expected fixed behavior (timeEstimate should be set to `daysDuration * 1440` minutes)

## Relevant Code Locations

### Primary Bug Location
- **File**: `src/bases/calendar-view.ts`
- **Function**: `handleDateSelect` (lines 108-139)
- **Issue**: Missing multi-day duration calculation logic

### Reference Implementation (Working)
- **File**: `src/views/AdvancedCalendarView.ts`
- **Function**: `handleTaskCreation` (lines 1182-1225)
- **Status**: Already fixed for issue #564

### Related Test Files
- **Existing test**: `tests/unit/issues/issue-564-multi-day-task-creation.test.ts` (shows correct behavior)
- **New test**: `tests/unit/issues/issue-859-bases-calendar-multi-day-task.test.ts` (demonstrates bug)

### Shared Calendar Core
- **File**: `src/bases/calendar-core.ts`
- **Relevance**: Contains shared event generation logic but not task creation logic

## Proposed Solutions

### Solution 1: Port the Fix from AdvancedCalendarView (Recommended)

**Approach**: Copy the multi-day duration calculation logic from `AdvancedCalendarView.handleTaskCreation` to `calendar-view.ts:handleDateSelect`.

**Implementation**:
```typescript
// In calendar-view.ts, replace lines 125-133 with:
const scheduledDate = allDay
    ? format(start, "yyyy-MM-dd")
    : format(start, "yyyy-MM-dd'T'HH:mm");

const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));

// Convert slot duration setting to minutes for comparison
const slotDurationMinutes = 30; // Default from settings

// Determine if this was a drag (intentional time selection) or just a click
const isDragOperation = !allDay && durationMinutes > slotDurationMinutes;

const prePopulatedValues: any = {
    scheduled: scheduledDate
};

// Calculate duration for multi-day all-day selections
if (allDay) {
    const dayDurationMillis = 24 * 60 * 60 * 1000;
    const daysDuration = Math.round((end.getTime() - start.getTime()) / dayDurationMillis);

    if (daysDuration > 1) {
        const minutesPerDay = 60 * 24;
        prePopulatedValues.timeEstimate = daysDuration * minutesPerDay;
    }
} else if (isDragOperation) {
    prePopulatedValues.timeEstimate = durationMinutes;
}

const { TaskCreationModal } = require("../modals/TaskCreationModal");
const modal = new TaskCreationModal(plugin.app, plugin, {
    prePopulatedValues
});
modal.open();
```

**Pros**:
- ✅ Direct fix that matches the working implementation
- ✅ Consistent behavior across both calendar views
- ✅ Minimal code changes (only modifying `handleDateSelect`)
- ✅ Already proven to work in AdvancedCalendarView
- ✅ Easy to test and verify

**Cons**:
- ⚠️ Requires accessing `plugin.settings.calendarViewSettings.slotDuration` which may need to be passed to the factory function
- ⚠️ Minor code duplication between two calendar views

**Risk**: Low - This is a proven fix already working in production

---

### Solution 2: Extract to Shared Function

**Approach**: Create a shared function in `calendar-core.ts` for task creation logic, then use it in both calendar views.

**Implementation**:
1. Create `calculateTaskCreationValues(start: Date, end: Date, allDay: boolean, slotDurationMinutes: number)` in `calendar-core.ts`
2. Use this function in both `AdvancedCalendarView.handleTaskCreation` and `calendar-view.ts:handleDateSelect`

**Pros**:
- ✅ DRY principle - single source of truth
- ✅ Easier to maintain and test
- ✅ Any future fixes apply to both views automatically
- ✅ Better code organization

**Cons**:
- ⚠️ Requires refactoring both calendar views
- ⚠️ More extensive testing needed
- ⚠️ Larger changeset with higher risk of regression

**Risk**: Medium - More extensive changes but better long-term solution

---

### Solution 3: Minimal Patch (Quick Fix)

**Approach**: Add just the multi-day calculation without the full drag detection logic.

**Implementation**:
```typescript
// In calendar-view.ts, after line 128:
const scheduledDate = allDay
    ? format(start, "yyyy-MM-dd")
    : format(start, "yyyy-MM-dd'T'HH:mm");

const prePopulatedValues: any = {
    scheduled: scheduledDate
};

// Quick fix: add multi-day duration calculation
if (allDay) {
    const daysDuration = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
    if (daysDuration > 1) {
        prePopulatedValues.timeEstimate = daysDuration * 60 * 24;
    }
}
```

**Pros**:
- ✅ Minimal code change
- ✅ Very low risk
- ✅ Fast to implement and test

**Cons**:
- ❌ Doesn't handle timed task duration (week view drags)
- ❌ Missing drag vs. click detection logic
- ❌ Incomplete fix - only solves all-day multi-day tasks
- ❌ Still inconsistent with AdvancedCalendarView

**Risk**: Low, but incomplete solution

---

## Recommended Approach

**Solution 1: Port the Fix from AdvancedCalendarView**

This is the recommended approach because:

1. **Proven Solution**: The fix already works in AdvancedCalendarView since issue #564
2. **Complete Fix**: Handles all cases (multi-day, single-day, timed, clicks)
3. **Low Risk**: Minimal changes to a well-understood bug
4. **Fast Implementation**: Can be done in a single commit
5. **Easy to Test**: Can verify against existing test patterns

### Implementation Steps

1. Locate the `handleDateSelect` function in `src/bases/calendar-view.ts:108`
2. Replace lines 126-133 with the duration calculation logic from AdvancedCalendarView
3. Access the slot duration setting from plugin settings (may need to pass it to the factory)
4. Run the test suite to verify the fix
5. Manually test both calendar views to ensure consistency

### Testing Strategy

1. Run unit test: `npm test -- tests/unit/issues/issue-859-bases-calendar-multi-day-task.test.ts`
2. Run existing test: `npm test -- tests/unit/issues/issue-564-multi-day-task-creation.test.ts`
3. Manual testing in Bases calendar view:
   - Drag to create 2-day task → should have 2880 minutes time estimate
   - Drag to create 7-day task → should have 10080 minutes time estimate
   - Click single day → should use default time estimate
   - Drag timed selection → should calculate duration in minutes
4. Verify AdvancedCalendarView still works correctly

### Edge Cases to Consider

- User drags across daylight saving time boundaries
- User drags across month/year boundaries
- Very long selections (30+ days)
- Selections that start/end at non-midnight times but are marked allDay

---

## Alternative Considerations

If **Solution 2 (Extract to Shared Function)** is preferred for long-term maintainability:

1. Implement Solution 1 first as an immediate fix
2. Create a follow-up task to refactor both views to use shared logic
3. This allows the bug to be fixed quickly while planning for better architecture

This two-phase approach balances speed of fix with code quality goals.
