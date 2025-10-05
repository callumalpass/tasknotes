# Issue #829 Analysis: Time Estimate Gets Lost in Instant Task Conversion

## Problem Understanding

### Bug Description
When converting an inline checkbox item to a task using **instant task conversion**, the time estimate parsed from natural language processing (NLP) is **not preserved** in the task's YAML frontmatter, even though the text is correctly removed from the task title.

**Example:**
- Input: `- [ ] Practice guitar 30 minutes`
- Expected: Task titled "Practice guitar" with `timeEstimate: 30` in frontmatter
- Actual: Task titled "Practice guitar" with **no timeEstimate field** in frontmatter

### Affected Functionality
1. **Time Estimate**: NLP correctly extracts "30 minutes" from input, but it's lost during conversion
2. **Recurrence**: Same issue - NLP extracts recurrence patterns but they're not preserved

### User Impact
- Users typing natural language like "Practice guitar 30 minutes" in inline tasks lose the time estimate metadata
- This works correctly in the "Create new task" dialog but fails in instant task conversion
- Other NLP attributes like scheduled dates work correctly (e.g., "Practice guitar 9am")

## Test File Location

**Test File:** `/tests/unit/services/InstantTaskConvertService.issue-829.test.ts`

This test file includes:
- Tests for time estimate preservation with various formats (minutes, hours, combined)
- Tests for recurrence pattern preservation
- Tests for combined scenarios (time estimate + recurrence + other properties)
- Edge case handling

**How to Run:**
```bash
npm test -- InstantTaskConvertService.issue-829.test.ts
```

**Expected Result:** The tests will **FAIL** until the bug is fixed, demonstrating the issue.

## Root Cause Analysis

### Issue 1: Missing Field in ParsedTaskData Interface

**Location:** `src/utils/TasksPluginParser.ts:3-25`

The `ParsedTaskData` interface used by TasksPluginParser **does not include** a `timeEstimate` field:

```typescript
export interface ParsedTaskData {
  title: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  // ... other fields
  // ❌ Missing: timeEstimate?: number;
  // ❌ Missing proper handling for recurrence from NLP
  recurrence?: string;
  // ...
}
```

Meanwhile, the NLP parser's interface **does have** the estimate field:

```typescript
// src/services/NaturalLanguageParser.ts:7-22
export interface ParsedTaskData {
  // ...
  estimate?: number; // ✅ in minutes
  recurrence?: string;
  // ...
}
```

### Issue 2: Missing Mapping in tryNLPFallback

**Location:** `src/services/InstantTaskConvertService.ts:878-903`

The `tryNLPFallback` method converts NLP results to TasksPlugin format but **omits** the estimate field:

```typescript
// Convert NLP result to TasksPlugin ParsedTaskData format
const parsedData: ParsedTaskData = {
  title: nlpResult.title.trim(),
  isCompleted: nlpResult.isCompleted || false,
  status: nlpResult.status,
  priority: nlpResult.priority,
  dueDate: nlpResult.dueDate,
  scheduledDate: nlpResult.scheduledDate,
  dueTime: nlpResult.dueTime,
  scheduledTime: nlpResult.scheduledTime,
  recurrence: nlpResult.recurrence,  // ✅ Recurrence IS mapped here
  tags: nlpResult.tags && nlpResult.tags.length > 0 ? nlpResult.tags : undefined,
  // ... other fields ...
  // ❌ MISSING: estimate/timeEstimate mapping!
};
```

### Issue 3: Missing Logic in createTaskFile

**Location:** `src/services/InstantTaskConvertService.ts:514-524`

The `createTaskFile` method only applies **default** time estimates and recurrence, never the **parsed** values:

```typescript
// Apply time estimate
if (defaults.defaultTimeEstimate && defaults.defaultTimeEstimate > 0) {
  timeEstimate = defaults.defaultTimeEstimate;  // ❌ Only uses defaults!
}

// Apply recurrence
if (defaults.defaultRecurrence && defaults.defaultRecurrence !== "none") {
  recurrence = {
    frequency: defaults.defaultRecurrence,  // ❌ Only uses defaults!
  };
}
```

**Location:** `src/services/InstantTaskConvertService.ts:525-552`

In the else branch (when defaults are disabled), there's **no handling** for timeEstimate or recurrence at all:

```typescript
} else {
  // Minimal behavior: only use parsed data
  priority = (parsedData.priority ? this.sanitizePriority(parsedData.priority) : "") || "none";
  status = (parsedData.status ? this.sanitizeStatus(parsedData.status) : "") || "none";
  // ... handles dates, contexts, tags ...
  // ❌ MISSING: No timeEstimate handling!
  // ❌ MISSING: No recurrence handling!
}
```

## Relevant Code Locations

### Primary Files
- `src/services/InstantTaskConvertService.ts:878-903` - Missing estimate mapping in tryNLPFallback
- `src/services/InstantTaskConvertService.ts:514-524` - Missing parsed estimate in defaults branch
- `src/services/InstantTaskConvertService.ts:525-552` - Missing estimate handling in non-defaults branch
- `src/utils/TasksPluginParser.ts:3-25` - ParsedTaskData interface missing timeEstimate field

### Supporting Files
- `src/services/NaturalLanguageParser.ts:20` - NLP ParsedTaskData has estimate field
- `src/services/NaturalLanguageParser.ts:1036-1085` - extractTimeEstimate method (works correctly)
- `src/services/NaturalLanguageParser.ts:980-994` - extractRecurrence method (works correctly)

## Proposed Solutions

### Solution 1: Add timeEstimate to ParsedTaskData and Map It (Recommended)

**Pros:**
- Clean, minimal change
- Follows existing pattern for other fields
- Maintains type safety
- Works for both defaults enabled/disabled

**Cons:**
- Requires interface change (potential breaking change for external code)

**Implementation Steps:**

1. **Add timeEstimate to TasksPluginParser interface** (`src/utils/TasksPluginParser.ts:3-25`):
```typescript
export interface ParsedTaskData {
  title: string;
  // ... existing fields ...
  recurrence?: string;
  recurrenceData?: { ... };
  timeEstimate?: number;  // ✅ ADD THIS (in minutes)
  tags?: string[];
  // ...
}
```

2. **Map estimate in tryNLPFallback** (`src/services/InstantTaskConvertService.ts:878-903`):
```typescript
const parsedData: ParsedTaskData = {
  title: nlpResult.title.trim(),
  isCompleted: nlpResult.isCompleted || false,
  status: nlpResult.status,
  priority: nlpResult.priority,
  dueDate: nlpResult.dueDate,
  scheduledDate: nlpResult.scheduledDate,
  dueTime: nlpResult.dueTime,
  scheduledTime: nlpResult.scheduledTime,
  recurrence: nlpResult.recurrence,
  timeEstimate: nlpResult.estimate,  // ✅ ADD THIS
  tags: nlpResult.tags && nlpResult.tags.length > 0 ? nlpResult.tags : undefined,
  projects: nlpResult.projects && nlpResult.projects.length > 0
    ? this.resolveProjectLinks(nlpResult.projects)
    : undefined,
  contexts: nlpResult.contexts && nlpResult.contexts.length > 0
    ? nlpResult.contexts
    : undefined,
  startDate: undefined,
  createdDate: undefined,
  doneDate: undefined,
  recurrenceData: undefined,
};
```

3. **Use parsed timeEstimate in createTaskFile with defaults enabled** (`src/services/InstantTaskConvertService.ts:514-524`):
```typescript
// Apply time estimate: parsed value takes priority over defaults
if (parsedData.timeEstimate !== undefined && parsedData.timeEstimate > 0) {
  timeEstimate = parsedData.timeEstimate;  // ✅ Use parsed value
} else if (defaults.defaultTimeEstimate && defaults.defaultTimeEstimate > 0) {
  timeEstimate = defaults.defaultTimeEstimate;  // Fallback to default
}

// Apply recurrence: parsed value takes priority over defaults
if (parsedData.recurrence) {
  // Convert RRule string to RecurrenceInfo format
  recurrence = this.parseRecurrenceFromRRule(parsedData.recurrence);  // ✅ Use parsed value
} else if (defaults.defaultRecurrence && defaults.defaultRecurrence !== "none") {
  recurrence = {
    frequency: defaults.defaultRecurrence,
  };
}
```

4. **Handle timeEstimate in non-defaults branch** (`src/services/InstantTaskConvertService.ts:525-552`):
```typescript
} else {
  // Minimal behavior: only use parsed data, use "none" for unset values
  priority = (parsedData.priority ? this.sanitizePriority(parsedData.priority) : "") || "none";
  status = (parsedData.status ? this.sanitizeStatus(parsedData.status) : "") || "none";
  // ... existing date/context/tag handling ...

  // ✅ ADD: Handle time estimate from parsed data
  timeEstimate = parsedData.timeEstimate;

  // ✅ ADD: Handle recurrence from parsed data
  if (parsedData.recurrence) {
    recurrence = this.parseRecurrenceFromRRule(parsedData.recurrence);
  }
}
```

5. **Add helper method to parse RRule strings** (add to InstantTaskConvertService):
```typescript
/**
 * Convert RRule string to RecurrenceInfo format
 */
private parseRecurrenceFromRRule(rrule: string): import("../types").RecurrenceInfo | undefined {
  try {
    // Extract frequency from RRule string
    const freqMatch = rrule.match(/FREQ=(\w+)/);
    if (!freqMatch) return undefined;

    const frequency = freqMatch[1].toLowerCase();
    const recurrenceInfo: import("../types").RecurrenceInfo = { frequency };

    // Extract BYDAY if present (for weekly recurrence)
    const dayMatch = rrule.match(/BYDAY=([^;]+)/);
    if (dayMatch) {
      const days = dayMatch[1].split(',');
      recurrenceInfo.days_of_week = days;
    }

    // Extract BYMONTHDAY if present
    const monthDayMatch = rrule.match(/BYMONTHDAY=(\d+)/);
    if (monthDayMatch) {
      recurrenceInfo.day_of_month = parseInt(monthDayMatch[1]);
    }

    // Store original RRule for complex patterns
    recurrenceInfo.rrule = rrule;

    return recurrenceInfo;
  } catch (error) {
    console.debug("Error parsing RRule:", error);
    return undefined;
  }
}
```

### Solution 2: Use Separate Path for NLP Results

**Pros:**
- No interface changes needed
- Clearer separation between NLP and TasksPlugin parsing

**Cons:**
- More complex code
- Duplicates logic
- Harder to maintain

**Implementation:**
Create a separate method to handle NLP-parsed data that directly extracts the estimate field without converting to ParsedTaskData format first.

### Solution 3: Add Adapter Layer

**Pros:**
- Clean separation of concerns
- Easy to test

**Cons:**
- More boilerplate
- Over-engineering for this issue

**Implementation:**
Create an adapter class that handles conversion between NLP and TasksPlugin formats with explicit field mapping.

## Recommended Approach

**Solution 1** is recommended because:

1. **Minimal Change**: Only adds one field to an interface and updates existing logic
2. **Follows Existing Pattern**: Other fields like priority, status, dates already work this way
3. **Type Safe**: TypeScript will catch any missing mappings
4. **Comprehensive Fix**: Handles both timeEstimate and recurrence properly
5. **Works in All Cases**: Handles defaults enabled/disabled scenarios correctly

### Implementation Priority

1. Add `timeEstimate?: number` to `ParsedTaskData` interface in TasksPluginParser.ts
2. Map `nlpResult.estimate` to `parsedData.timeEstimate` in tryNLPFallback
3. Update createTaskFile to prioritize parsed timeEstimate over defaults
4. Add recurrence parsing logic to handle RRule strings from NLP
5. Add unit tests to verify the fix

### Testing Strategy

The failing test in `tests/unit/services/InstantTaskConvertService.issue-829.test.ts` should pass after implementing Solution 1. Additionally:

1. Test time estimate preservation with various formats (minutes, hours, combined)
2. Test recurrence pattern preservation (daily, weekly, monthly)
3. Test interaction with defaults (parsed should override defaults)
4. Test edge cases (zero estimate, missing estimate, invalid formats)
5. Integration test with actual task creation flow

## Additional Notes

### Why Scheduled Dates Work But Time Estimate Doesn't

The user correctly observed that "Practice guitar 9am" works but "Practice guitar 30 minutes" doesn't. This is because:

1. **Scheduled dates** (`scheduledDate`, `scheduledTime`) are already in the `ParsedTaskData` interface and properly mapped in tryNLPFallback (lines 885-887)
2. **Time estimates** (`estimate`) are in NLP's ParsedTaskData but NOT in TasksPluginParser's ParsedTaskData, so the mapping is impossible

### Recurrence Issue

The recurrence issue is **partially different**:
- The recurrence field IS in ParsedTaskData interface
- It IS mapped in tryNLPFallback (line 888)
- But the RRule string format from NLP needs to be converted to RecurrenceInfo object for the task file
- The createTaskFile method only checks defaults, not the parsed value

So recurrence requires:
1. Parsing the RRule string from NLP
2. Using parsed recurrence when available (before falling back to defaults)
