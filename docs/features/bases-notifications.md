# View Notifications

[← Back to Features](../features.md)

<!--
Recording Script
SETUP:
  cd .obsidian/plugins/tasknotes
  node scripts/generate-test-data.mjs --clean   # or: bun run generate-test-data:clean
  Reload plugin in Obsidian

Use: TaskNotes/Demos/Notification Demo.base
Show adding notify: true to a .base file
Show toast appearing in bottom-right with bell badge
Show toast expanded with item breakdown
Show clicking snooze dropdown, selecting a duration
Show status bar bell icon with count badge
Show clicking toast → navigates to the view

CLEANUP: remove notify: true if added to a non-demo base
-->

> [!warning] Experimental feature
> View notifications are experimental as of v4.3.50. The core functionality works -- toast alerts, bell badge, snooze, and assignee filtering -- but edge cases remain. Known issues include the watcher sometimes reporting "monitoring 0 bases" on startup and notification sync files not always cleaning up. See [Troubleshooting](../troubleshooting.md#notifications) for workarounds. Feedback welcome on [GitHub Discussions](https://github.com/cybersader/tasknotes/discussions).

View notifications alert you when items match a view's filter. This is separate from [task reminders](reminders.md), which alert you based on a task's due or scheduled date. Notifications are per-view: you enable them on any [Bases](https://help.obsidian.md/bases) view, and TaskNotes watches for matching items in the background.

<!-- SCREENSHOT: Toast notification in bottom-right corner with bell badge -->

## Enabling Notifications on a View

Add `notify: true` to any view inside a `.base` file:

```yaml
views:
  - type: tasknotesTaskList
    name: Urgent Tasks
    notify: true
```

<!-- GIF: Adding notify: true to a .base file and seeing the toast appear when items match -->

Or use the Configure panel: open the gear menu on any Bases view, find the TaskNotes section, and toggle **Notify on matches**.

Once enabled, TaskNotes monitors the view's query in the background. When items match the filter, a toast notification appears and the status bar bell badge updates.

You can also fine-tune when notifications fire using `notifyOn` and `notifyThreshold`:

```yaml
views:
  - type: tasknotesTaskList
    name: Urgent Tasks
    notify: true
    notifyOn: count_threshold
    notifyThreshold: 5
```

| notifyOn value | Behavior |
|----------------|----------|
| `any` (default) | Notify whenever the view has any matching items |
| `new_items` | Only notify when new items appear that were not there before |
| `count_threshold` | Only notify when the match count exceeds the threshold |

## The Toast Indicator

When items match a notification-enabled view, a toast appears in the bottom-right corner of the Obsidian window. It shows:

- The total number of items needing attention, with a breakdown by time category (e.g., "3 overdue, 2 due today")
- An **action button** to open the Upcoming View
- A **snooze dropdown** with preset durations
- A **dismiss button** to hide the toast for this session

<!-- SCREENSHOT: Toast notification expanded showing item breakdown -->

![Notification toast with item count and action buttons](docs/assets/bases-notifications/screenshot-kanban.png)

<!-- GIF: Toast appearing with item breakdown, clicking snooze dropdown, selecting a duration -->

![Notification toast with View, Snooze, and Got it buttons](docs/assets/bases-notifications/screenshot-kanban.png)

The toast persists until you dismiss it or snooze it. It does not auto-dismiss (following WCAG 2.2.4 accessibility guidelines for timed content).

Clicking the toast body or the action button opens the Upcoming View, where you can see all notification items organized by time category and take action on them.

## Bell Badge and Status Bar

<!-- SCREENSHOT: Status bar showing bell icon with count badge -->

![Kanban view with status bar notification indicators](docs/assets/bases-notifications/screenshot-kanban.png)

A bell icon appears in the Obsidian status bar. When there are active notification items, it shows a count badge. Click the bell to open the Upcoming View.

The status bar updates periodically (every 5 minutes by default) and also updates immediately when tasks change.

If notifications are snoozed, the bell badge is hidden until the snooze period expires.

## Snooze

The toast snooze dropdown offers preset durations:

| Option | Duration |
|--------|----------|
| 15 minutes | 15 min |
| 1 hour | 60 min |
| 4 hours | 240 min |
| Until tomorrow | Until 9:00 AM tomorrow |

Snooze state is stored in `localStorage` (per-device, not synced). While snoozed:

- The toast does not reappear
- The status bar badge is hidden
- Background monitoring continues (so items are ready when snooze expires)

When the snooze period ends, the toast reappears if there are still matching items.

## How the Watcher Works

The background monitoring system (BasesQueryWatcher) operates as follows:

1. **Startup scan.** On plugin load, scans all `.base` files in the vault for views with `notify: true`
2. **Event-driven evaluation.** Listens for task update events and metadata cache changes. When a change affects a file that could match a monitored query, the watcher re-evaluates
3. **Relevance checking.** Each monitored base keeps a cached set of matching file paths. When a file changes, the watcher checks in O(1) whether it is relevant before doing a full evaluation
4. **Periodic rescan.** Every 5 minutes, re-scans for new or modified `.base` files and re-evaluates queries
5. **Debouncing.** Rapid changes are debounced (1 second) to avoid evaluating the same query multiple times

This approach means notifications respond to changes within seconds, without continuously polling.

## Notification Sync

TaskNotes can create real Markdown files that represent notification-enabled bases. This is handled by the BaseNotificationSyncService.

These "notification task" files:

- Live in your task folder alongside regular tasks
- Have `type: base-notification` in frontmatter
- Link back to the source `.base` file via a `sourceBase` wikilink
- Track the current `matchCount` from the base's query
- Are recognized as tasks by TaskNotes (they have `isTask: true`)

This means notification items can appear in your regular Bases views and be filtered, sorted, and grouped like any other task. The Upcoming View shows them with a special badge indicating they come from a view notification rather than a standalone task.

The sync runs on plugin load, after each base evaluation, and periodically. It creates, updates, and removes notification files as bases are added, changed, or have `notify: true` removed.

## How It Differs from Reminders

| | View Notifications | Task Reminders |
|---|---|---|
| **Scope** | Per-view | Per-task |
| **Trigger** | Query matches (items in view filter) | Date-based (due date, scheduled date) |
| **Configuration** | `notify: true` in `.base` YAML | `reminders` array in task frontmatter |
| **UI** | Toast + status bar bell | Obsidian Notice popup |
| **Snooze** | Snooze the entire view's notifications | Snooze individual reminders |
| **Assignee filtering** | Supported (filter by who the task is assigned to) | Not applicable |
| **Use case** | "Alert me when tasks match these criteria" | "Remind me about this specific task" |

Both systems can be active at the same time. A task can trigger a reminder (because its due date is approaching) and also appear in a notification (because it matches a view's filter).

## Settings

These settings are in **Settings > Features > Notifications**:

| Setting | Default | Description |
|---------|---------|-------------|
| Enable vault-wide notifications | On | Master toggle for the notification system |
| Show on startup | Off | Show notifications immediately when Obsidian opens |
| Check interval | 5 min | How often to re-evaluate notification queries |
| Bases notifications | On | Include items from `notify: true` views |
| Upstream reminders | On | Include items from the upstream task reminder system |

Per-view settings are configured in the `.base` file YAML or through the Configure panel:

| Setting | Where | Description |
|---------|-------|-------------|
| `notify` | Per-view | Enable/disable notifications for this view |
| `notifyOn` | Per-view | When to fire: `any`, `new_items`, or `count_threshold` |
| `notifyThreshold` | Per-view | Item count threshold (only used with `count_threshold`) |

## Related

- [Reminders](reminders.md) for per-task date-driven alerts
- [Upcoming View](../views/upcoming-view.md) for the aggregated view that shows notification items
- [Team & Attribution](shared-vault.md) for assignee-aware notification filtering
