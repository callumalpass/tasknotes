# Issue #810 Analysis: Agenda View Not Showing Overdue Tasks

## Problem Understanding

**Issue Title:** [Bug]: Agenda not showing overdue tasks

**Reporter:** skyrunner15

**Description:**
When clicking on "today" in the agenda view, it properly filters out prior days but overdue tasks disappear. The user can see the missing task in the Tasks view with a due date of yesterday but not showing in the agenda view. When updating the due date to today, it doesn't show in the agenda view either. The task is a recurring one.

### Key Observations:
1. **Overdue tasks disappear** when viewing "today" in the agenda view
2. **Tasks view shows the overdue task correctly** (due date = yesterday)
3. **Updating task due date to today** doesn't make it appear
4. **The task is recurring**, which may be relevant to the bug

## Test File Location

A test file has been created but is currently failing:
- **Path:** `tests/unit/issues/issue-810-overdue-tasks-disappear.test.ts`
- **Test Framework:** Jest
- **Current Status:** ❌ FAILING (missing test helper functions)
- **Run Command:** `npm test -- issue-810-overdue-tasks-disappear.test.ts`

### Test Failure Reason:
The test is trying to use `createMockCacheManager()` and `createMockTaskInfo()` helper functions which don't exist in the test helpers. The test needs to be updated to use the existing factory methods from `tests/helpers/mock-factories.ts`:
- Use `TaskFactory.createTask()` instead of `createMockTaskInfo()`
- Use `PluginFactory.createMockPlugin().cacheManager` instead of `createMockCacheManager()`

## Relevant Code Locations

### 1. AgendaView Component
**File:** `src/views/AgendaView.ts`

**Key Lines:**
- `AgendaView.ts:731-735` - Calls `getAgendaDataWithOverdue()` method
- `AgendaView.ts:843-1018` - Renders overdue section separately
- `AgendaView.ts:65` - `showOverdueOnToday` property controls overdue display

### 2. FilterService - Main Logic
**File:** `src/services/FilterService.ts`

**Key Functions:**

#### a. `getAgendaDataWithOverdue()`
- **Location:** `FilterService.ts:2622-2652`
- **Purpose:** Gets agenda data with a separate overdue section
- **Parameters:**
  - `dates: Date[]` - Array of dates to get tasks for
  - `baseQuery: FilterQuery` - Filter query to apply
  - `showOverdueSection: boolean` - Whether to show overdue section
- **Logic:**
  ```typescript
  // Line 2630-2642: Gets tasks for each specific date (no overdue mixing)
  for (const date of dates) {
    const tasksForDate = await this.getTasksForDate(
      date,
      baseQuery,
      false // Never include overdue in daily sections
    );
    dailyData.push({ date: new Date(date), tasks: tasksForDate });
  }

  // Line 2645-2646: Gets overdue tasks separately if requested
  const overdueTasks = showOverdueSection ? await this.getOverdueTasks(baseQuery) : [];
  ```

#### b. `getOverdueTasks()`
- **Location:** `FilterService.ts:2573-2617`
- **Purpose:** Get overdue tasks for the agenda view
- **Logic:**
  - Line 2579: Filters all tasks to find overdue ones
  - Line 2584-2591: For recurring tasks, only checks `scheduled` date
  - Line 2593-2606: For non-recurring tasks, checks both `due` and `scheduled` dates
  - Line 2588, 2596, 2603: Uses `isOverdueTimeAware()` helper function

#### c. `isOverdueTimeAware()`
- **Location:** `src/utils/dateUtils.ts:1021-1050`
- **Purpose:** Check if a date string represents an overdue date
- **Parameters:**
  - `dateString: string` - The date to check
  - `isCompleted?: boolean` - Whether the task is completed
  - `hideCompletedFromOverdue?: boolean` - Setting to hide completed tasks from overdue
- **Logic:**
  - Line 1029-1031: If setting enabled and task completed, return false
  - Line 1037-1044: Uses UTC anchors to compare dates consistently

## Root Cause Analysis

Based on the code review, the issue appears to be in how recurring tasks are handled in the `getOverdueTasks()` method:

### For Recurring Tasks (Line 2584-2591):
```typescript
if (task.recurrence) {
  // Only check scheduled date for recurring tasks (this is the current instance date)
  if (task.scheduled) {
    return isOverdueTimeAware(task.scheduled, isCompleted, hideCompletedFromOverdue);
  }
  return false;
}
```

**Problem:** If a recurring task's `scheduled` date has been updated to today (or is missing), it won't appear as overdue even if previous instances were overdue. The comment says "this is the current instance date" which suggests the scheduled date represents the next/current occurrence, not a past overdue occurrence.

### User's Scenario:
1. User has a recurring task with scheduled date = yesterday
2. User clicks "Today" in agenda view
3. The task's scheduled date (yesterday) is checked by `isOverdueTimeAware()`
4. The task is correctly identified as overdue
5. **BUT** when the user updates the due date to today, the task still doesn't show because:
   - The overdue logic only checks `scheduled` for recurring tasks
   - If the user updated `due` but not `scheduled`, the task won't match either daily or overdue sections

## Proposed Solutions

### Solution 1: Fix Recurring Task Overdue Detection (Recommended)
**Approach:** Improve the logic in `getOverdueTasks()` to handle recurring tasks more accurately.

**Changes Required:**
- File: `src/services/FilterService.ts:2584-2591`

**Implementation:**
```typescript
if (task.recurrence) {
  // For recurring tasks, check scheduled date (current instance)
  // Also check due date if it exists (user may set both)
  if (task.due) {
    if (isOverdueTimeAware(task.due, isCompleted, hideCompletedFromOverdue)) {
      return true;
    }
  }
  if (task.scheduled) {
    if (isOverdueTimeAware(task.scheduled, isCompleted, hideCompletedFromOverdue)) {
      return true;
    }
  }
  return false;
}
```

**Pros:**
- ✅ Handles both `due` and `scheduled` dates for recurring tasks
- ✅ Minimal code changes
- ✅ Consistent with non-recurring task logic
- ✅ Fixes the reported issue

**Cons:**
- ⚠️ May show tasks as overdue that shouldn't be if both dates are set inconsistently
- ⚠️ Need to verify this doesn't break existing recurring task behavior

### Solution 2: Separate Overdue Logic for Recurring vs Non-Recurring
**Approach:** Create distinct overdue detection logic based on task type.

**Changes Required:**
- File: `src/services/FilterService.ts:2573-2617`
- New method: `isRecurringTaskOverdue(task: TaskInfo): boolean`

**Implementation:**
```typescript
private isRecurringTaskOverdue(task: TaskInfo, isCompleted: boolean, hideCompletedFromOverdue: boolean): boolean {
  // For recurring tasks, we need to check if the current instance is overdue
  // The scheduled date represents the current/next occurrence

  // Check if there's an uncompleted instance in the past
  if (task.scheduled) {
    const scheduledDate = parseDateToUTC(task.scheduled);
    const today = parseDateToUTC(getTodayString());

    if (isBefore(scheduledDate, today) && !isCompleted) {
      return !hideCompletedFromOverdue || !isCompleted;
    }
  }

  // Also check due date if the recurring task has one set
  if (task.due) {
    return isOverdueTimeAware(task.due, isCompleted, hideCompletedFromOverdue);
  }

  return false;
}

// Then use it in getOverdueTasks:
if (task.recurrence) {
  return this.isRecurringTaskOverdue(task, isCompleted, hideCompletedFromOverdue);
}
```

**Pros:**
- ✅ Clear separation of concerns
- ✅ Easier to test and maintain
- ✅ Can handle complex recurring task scenarios

**Cons:**
- ⚠️ More code to maintain
- ⚠️ Need thorough testing for edge cases
- ⚠️ Requires understanding of recurring task lifecycle

### Solution 3: Add Explicit Overdue Instance Tracking
**Approach:** Track overdue instances separately in the task metadata.

**Changes Required:**
- File: `src/types.ts` - Add `overdue_instances?: string[]` field
- File: `src/services/FilterService.ts` - Update recurring task logic
- File: `src/views/AgendaView.ts` - Display overdue instances

**Implementation:**
```typescript
// In types.ts
export interface TaskInfo {
  // ... existing fields
  complete_instances?: string[];
  overdue_instances?: string[]; // NEW: Track overdue instances
}

// In getOverdueTasks
if (task.recurrence) {
  // Check if current instance is overdue OR if there are tracked overdue instances
  const hasOverdueInstances = task.overdue_instances && task.overdue_instances.length > 0;

  if (hasOverdueInstances) {
    return true;
  }

  // Check current scheduled date
  if (task.scheduled) {
    return isOverdueTimeAware(task.scheduled, isCompleted, hideCompletedFromOverdue);
  }

  return false;
}
```

**Pros:**
- ✅ Most accurate tracking of overdue recurring tasks
- ✅ Maintains history of overdue instances
- ✅ Future-proof for complex scenarios

**Cons:**
- ❌ Requires schema changes
- ❌ Need migration for existing tasks
- ❌ More complex implementation
- ❌ Higher risk of breaking existing functionality

## Recommended Approach

**Solution 1** is recommended for the following reasons:

1. **Minimal Risk:** Only changes one small section of code
2. **Fixes the Reported Issue:** Handles the user's exact scenario (recurring task with due date)
3. **Low Complexity:** Easy to understand and maintain
4. **Quick to Implement:** Can be done in a single PR
5. **Easy to Test:** Can verify with the existing test file (once helper functions are fixed)

## Next Steps

1. ✅ **Fix the test file** - Update to use correct factory methods
2. ✅ **Verify test fails** - Confirm the test reproduces the bug
3. ✅ **Implement Solution 1** - Make the code changes
4. ✅ **Verify test passes** - Confirm the fix works
5. ✅ **Manual testing** - Test in the actual plugin
6. ✅ **Edge case testing** - Test various recurring task scenarios

## Additional Notes

- The codebase uses UTC anchors for date comparisons to avoid timezone issues
- The `hideCompletedFromOverdue` setting (default: true) hides completed tasks from overdue section
- Recurring tasks use the `scheduled` field to track the current instance date
- The `complete_instances` array tracks which instances of a recurring task have been completed

## Related Code Patterns

The codebase follows these patterns for date handling:
- Use `parseDateToUTC()` for internal logic and comparisons
- Use `parseDateToLocal()` for UI display
- Use `isOverdueTimeAware()`, `isSameDateSafe()`, `isBeforeDateSafe()` for safe date comparisons
- Store dates in `YYYY-MM-DD` format using `formatDateForStorage()`
