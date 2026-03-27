# TaskNotes Enhancements - Project Brief

## Executive Summary

TaskNotes is an excellent task management plugin for Obsidian, but it has gaps for users managing structured note collections. This project addresses three key limitations:

1. **Bulk Task Creation** - Generate tasks for multiple items from a Bases view
2. **Query-Based Notifications** - Get alerted when Bases conditions match
3. **Multi-User Attribution** - Auto-identify users in shared vaults

## Problem Statement

### Current State

TaskNotes excels at:
- Individual task creation with rich metadata
- Bases views for filtering/grouping tasks
- Time tracking, recurrence, dependencies
- Calendar and Kanban views

TaskNotes lacks:
- Batch operations on query results
- Proactive notifications from query conditions
- Device-level user identification for shared vaults

### Impact

| Scenario | Current Workaround | Pain Level |
|----------|-------------------|------------|
| 50 documents need review tasks | Manual one-by-one creation OR external script | High |
| Daily check for overdue items | Remember to open dashboard | Medium |
| Shared family vault attribution | Manual assignee selection | Medium |

### User Stories

**As a compliance manager:**
- I want to generate review tasks for all controls due this quarter
- So that I don't miss any review deadlines

**As a document owner:**
- I want to be notified when any of my documents are overdue for review
- So that I can prioritize my work

**As a family vault user:**
- I want my tasks to be automatically attributed to me
- So that "My Tasks" views work without manual selection

---

## Enhancement 1: Bulk Task Creation from Bases

### Specification

**Trigger:** Command or button in Bases view header

**Input:** Current Bases query results (filtered/sorted items)

**Output:** One task note per item, linked via `projects` field

### User Flow

1. User opens a Bases view (e.g., "Documents Coming Due")
2. User clicks "Generate tasks" command/button
3. Modal opens showing:
   - Count of items to process
   - Preview of first few task titles
   - Options:
     - [ ] Skip items with existing tasks
     - [ ] Use parent note as project (default: ON)
     - [ ] Custom task template selection
4. User clicks "Create tasks"
5. Progress indicator shows creation
6. Summary: "Created 12 tasks, skipped 3 (existing)"

### Technical Design

**New files:**
```
src/bulk/
├── BulkTaskCreationModal.ts      # Preview and options UI
├── bulk-task-engine.ts           # Core creation logic
└── duplicate-detector.ts         # Find existing tasks by project link
```

**Integration points:**
- `src/bases/` - Add command to view header
- `src/tasks/` - Reuse existing task creation logic
- `src/settings/` - Bulk creation defaults

**Data flow:**
```
Bases Query Results
       ↓
Duplicate Detector (filters out items with existing tasks)
       ↓
Preview Modal (user confirms)
       ↓
Bulk Task Engine (iterates items, calls task creation)
       ↓
Task Notes Created (with project links)
```

### Duplicate Detection Logic

```typescript
interface DuplicateCheckResult {
  item: BasesItem;
  existingTask: TFile | null;
}

async function findExistingTask(itemPath: string, taskFolder: string): Promise<TFile | null> {
  // Get all tasks
  const tasks = await getTasksInFolder(taskFolder);

  // Check if any task has this item in projects field
  for (const task of tasks) {
    const cache = app.metadataCache.getFileCache(task);
    const projects = cache?.frontmatter?.projects || [];

    // Normalize and compare
    const normalized = projects.map(p => extractLinkPath(p));
    if (normalized.includes(itemPath)) {
      return task;
    }
  }
  return null;
}
```

### Settings Additions

```typescript
interface BulkCreationSettings {
  defaultSkipExisting: boolean;
  defaultUseParentAsProject: boolean;
  defaultTaskTemplate: string;  // Path to template note
  showConfirmationDialog: boolean;
  batchSize: number;  // For progress updates
}
```

### Acceptance Criteria

- [ ] Command appears in Bases view header
- [ ] Modal shows accurate item count and preview
- [ ] "Skip existing" correctly identifies tasks linked to items
- [ ] Created tasks have correct `projects` field
- [ ] Progress indicator updates during creation
- [ ] Summary shows created/skipped counts
- [ ] Works with table, list, and kanban Bases views
- [ ] Handles 100+ items without freezing UI

---

## Enhancement 2: Notifications from Bases Results

### Specification

**Trigger:** Configurable (vault load, hourly, on file change)

**Input:** Bases query + condition expression

**Output:** Toast and/or system notification

### User Flow

1. User goes to Settings → TaskNotes → Notification Rules
2. User clicks "Add rule"
3. Configuration:
   - Name: "Overdue documents"
   - Bases file: `TaskNotes/Views/documents-coming-due.base`
   - Condition: `formula.isOverdue == true`
   - When: On vault load, hourly
   - Action: System notification
4. User saves
5. On vault load, if condition matches:
   - System notification: "3 documents are overdue for review"
   - Click → Opens the Bases view

### Technical Design

**New files:**
```
src/notifications/
├── NotificationRule.ts           # Rule data structure
├── NotificationRuleSettings.ts   # Settings UI component
├── BasesNotificationEngine.ts    # Evaluates rules on trigger
├── ConditionEvaluator.ts         # Parses/evaluates conditions
└── NotificationDispatcher.ts     # Sends toast/system notifications
```

**Integration points:**
- `src/main.ts` - Register triggers (on load, interval)
- `src/settings/` - Add notification rules section
- `src/bases/` - Reuse query engine for evaluation

**Data flow:**
```
Trigger (vault load, timer, file change)
       ↓
Notification Engine (loads rules)
       ↓
For each rule:
  ↓ Load referenced .base file
  ↓ Execute Bases query
  ↓ Evaluate condition against results
  ↓ If matches → Dispatch notification
```

### Rule Configuration Schema

```typescript
interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  basesFile: string;           // Path to .base file
  condition: ConditionConfig;
  triggers: TriggerConfig[];
  action: ActionConfig;
}

interface ConditionConfig {
  type: 'rowCount' | 'formula' | 'any';
  operator: '>' | '<' | '==' | '>=' | '<=';
  value: number | string | boolean;
  formulaField?: string;       // For formula-based conditions
}

interface TriggerConfig {
  type: 'onLoad' | 'interval' | 'fileChange';
  intervalMinutes?: number;    // For interval trigger
  watchPaths?: string[];       // For fileChange trigger
}

interface ActionConfig {
  type: 'toast' | 'system' | 'both';
  message: string;             // Supports {count} placeholder
  openOnClick: boolean;        // Open Bases view on click
}
```

### Condition Examples

```yaml
# Notify if any rows match
condition:
  type: rowCount
  operator: ">"
  value: 0

# Notify if overdue count > 5
condition:
  type: formula
  formulaField: isOverdue
  operator: "=="
  value: true
  # Then count matching rows

# Notify if any high priority overdue
condition:
  type: formula
  formulaField: urgencyScore
  operator: ">"
  value: 10
```

### Settings UI Mockup

```
┌─ Notification Rules ──────────────────────────────────┐
│                                                       │
│  ┌─ Rule: Overdue Documents ────────────────────────┐│
│  │ Enabled: [✓]                                     ││
│  │ Bases file: [TaskNotes/Views/docs-coming-due  ▼] ││
│  │ Condition: [ Row count ] [ > ] [ 0 ]             ││
│  │ Triggers: [✓] On vault load  [✓] Every [60] min  ││
│  │ Action: [Both] "{count} documents need review"   ││
│  │                          [Edit] [Delete]         ││
│  └──────────────────────────────────────────────────┘│
│                                                       │
│  [+ Add rule]                                         │
└───────────────────────────────────────────────────────┘
```

### Acceptance Criteria

- [ ] Settings UI for creating/editing/deleting rules
- [ ] Rules persist across Obsidian restarts
- [ ] "On vault load" trigger fires within 5 seconds of load
- [ ] Interval trigger respects configured minutes
- [ ] Condition evaluation uses Bases formula engine
- [ ] Toast notification shows correct count
- [ ] System notification works on desktop
- [ ] Click notification opens referenced Bases view
- [ ] Rules can be enabled/disabled individually
- [ ] Invalid rules (missing file, bad condition) show error, don't crash

---

## Enhancement 3: Device ID to User Mapping

### Specification

**Setup:** User maps their device to a person note once

**Runtime:** Task creation auto-fills creator/assignee from mapping

### User Flow

1. User goes to Settings → TaskNotes → Device Identity
2. User sees their device UUID (auto-generated)
3. User selects "Link to person note" → picks `[[Jane Doe]]` from User-DB
4. User saves
5. When creating tasks:
   - Creator field auto-filled with `[[Jane Doe]]`
   - Assignee defaults to creator (if enabled)

### Technical Design

**New files:**
```
src/identity/
├── DeviceIdentityManager.ts      # Generates/stores device UUID
├── UserRegistry.ts               # Manages device → user mappings
└── DeviceIdentitySettings.ts     # Settings UI component
```

**Integration points:**
- `src/main.ts` - Initialize DeviceIdentityManager
- `src/tasks/` - Use mapped user in task creation
- `src/settings/` - Add device identity section

**Storage:**
```
// data.json (synced) - NO device UUIDs here
{
  "deviceUserMappings": {
    // Empty in synced config - just the schema
  }
}

// data-local.json (NOT synced) - device-specific
{
  "deviceUUID": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "linkedUserNote": "User-DB/Jane Doe.md"
}
```

**UUID Generation:**
```typescript
function generateDeviceUUID(): string {
  // Check if exists in local storage
  const existing = localStorage.getItem('tasknotes-device-uuid');
  if (existing) return existing;

  // Generate new
  const uuid = crypto.randomUUID();
  localStorage.setItem('tasknotes-device-uuid', uuid);
  return uuid;
}
```

### Settings UI Mockup

```
┌─ Device Identity ─────────────────────────────────────┐
│                                                       │
│  Device UUID: a1b2c3d4-e5f6-7890-abcd-ef1234567890   │
│  (This identifier is unique to this device/browser)   │
│                                                       │
│  Linked user note: [ User-DB/Jane Doe.md         ▼]  │
│                    (Select from User-DB folder)       │
│                                                       │
│  [✓] Auto-fill creator on new tasks                  │
│  [✓] Default assignee to creator                     │
│                                                       │
│  [Save] [Clear link]                                  │
└───────────────────────────────────────────────────────┘
```

### Task Creation Integration

```typescript
// In task creation flow
async function getDefaultCreator(): Promise<string | null> {
  const settings = await loadLocalSettings();

  if (!settings.linkedUserNote) return null;
  if (!settings.autoFillCreator) return null;

  // Return as wiki-link format
  const basename = getBasename(settings.linkedUserNote);
  return `[[${basename}]]`;
}

// Modify existing task creation
async function createTask(taskData: TaskData): Promise<TFile> {
  // Auto-fill creator if enabled
  if (!taskData.creator) {
    taskData.creator = await getDefaultCreator();
  }

  // Auto-fill assignee if enabled and empty
  if (!taskData.assignees?.length && settings.defaultAssigneeToCreator) {
    const creator = await getDefaultCreator();
    if (creator) taskData.assignees = [creator];
  }

  // Continue with existing creation logic...
}
```

### Acceptance Criteria

- [ ] Device UUID generated on first load
- [ ] UUID persists across Obsidian restarts
- [ ] UUID stored locally, NOT synced
- [ ] Settings UI shows current UUID
- [ ] Can select person note from vault
- [ ] Creator auto-filled on task creation (when enabled)
- [ ] Assignee defaults to creator (when enabled)
- [ ] Works correctly when mapping is not set (graceful fallback)
- [ ] Clear link button removes mapping

---

## Implementation Roadmap

### Phase 1: Bulk Task Creation (Priority 1)

1. Create `src/bulk/` directory structure
2. Implement duplicate detection
3. Build preview modal
4. Integrate with Bases view
5. Add settings
6. Test with Document Library example

### Phase 2: Notifications (Priority 2)

1. Create `src/notifications/` directory structure
2. Build settings UI for rules
3. Implement condition evaluator
4. Add trigger handlers
5. Implement notification dispatch
6. Test with coming-due scenarios

### Phase 3: Device Identity (Priority 3)

1. Create `src/identity/` directory structure
2. Implement UUID generation/storage
3. Build settings UI
4. Integrate with task creation
5. Test on multiple devices/browsers

---

## Testing Strategy

### Unit Tests

- Duplicate detection logic
- Condition evaluation
- UUID generation

### Integration Tests

- Bulk creation with mocked vault
- Notification rule persistence
- Local settings storage

### Manual Testing (Required)

| Scenario | Test Steps |
|----------|-----------|
| Bulk creation | Open Bases view → Generate 10 tasks → Verify links |
| Skip existing | Create one task manually → Run bulk → Verify skip |
| Notification on load | Set rule → Restart Obsidian → Check notification |
| Device mapping | Set mapping → Create task → Verify creator |
| Multi-device | Two devices, same vault → Verify separate UUIDs |

### Test Vault Scenarios

The embedded test vault includes:
- 3 documents in `Document Library/` with varying review dates
- Pre-configured "Documents Coming Due" view
- 2 person notes in `User-DB/`
- TaskNotes settings optimized for testing

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Upstream changes conflict | Medium | High | Check upstream before major work |
| Performance with large batches | Medium | Medium | Implement batching with progress |
| Local storage limitations | Low | Low | Use Obsidian's native storage APIs |
| Notification timing issues | Medium | Low | Debounce and queue notifications |

---

## References

- **TaskNotes Repository:** https://github.com/callumalpass/tasknotes
- **Obsidian Plugin API:** https://docs.obsidian.md/
- **Existing settings reference:** `b&g_vault/b&g/.obsidian/plugins/tasknotes/data.json`
- **Formula examples:** `b&g_vault/b&g/TaskNotes/Views/tasks-default.base`
