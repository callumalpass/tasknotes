# CalDAV Sync

TaskNotes can keep your tasks in sync with a CalDAV task list in both directions. Tasks you create in Obsidian appear on your phone, and tasks you tick off elsewhere are reflected back in your vault.

This works with any CalDAV server that stores tasks, including Nextcloud, Apple Reminders (iCloud), Radicale and Baikal.

## How it differs from the calendar integrations

TaskNotes has two separate ways of talking to calendar servers, and they do different jobs:

- **[Calendar integration](calendar-integration.md)** (Google, Microsoft) exports tasks *as calendar events* on a time grid, and is one-way.
- **CalDAV sync** treats tasks as tasks. They land in the task list of your phone or desktop client — Reminders, Nextcloud Tasks, and so on — with a due date, a status and a priority, and changes flow both ways.

You can use both at once; they do not interfere with each other.

## Setup

1. Open `Settings -> TaskNotes -> Integrations` and turn on **Enable CalDAV sync**.
2. Select **Add account**.
3. Fill in the **Server URL**, **Username** and **Password**. Any address on your server will do — TaskNotes works its way up to the account root if you paste something more specific.
    - For Nextcloud, the server URL usually looks like `https://cloud.example.com/remote.php/dav`.
    - For iCloud, use `https://caldav.icloud.com` and an app-specific password generated in your Apple account settings.
    - Credentials are only ever sent over `https://`, except to `localhost` for local testing.
4. Select **Discover** to find the task lists this account can reach. TaskNotes only offers lists that can actually hold tasks, so event-only calendars, read-only subscriptions and deleted calendars are filtered out. If more than one list qualifies, pick the one you want from **Selected task list**.
5. Select **Preview** under **First sync** to see what would change.
6. Turn on **Sync this account**.

Passwords are stored in Obsidian's secret storage, which is encrypted at rest where the operating system supports it. They are never written to the plugin's `data.json`.

## The first sync

The first sync is the one moment where a wrong setting is expensive, so nothing is written until you confirm it. The preview reports four numbers:

- **to upload** — tasks in your vault that the server has never seen.
- **to import** — tasks on the server with no counterpart in your vault.
- **already matching** — tasks that are linked and in agreement.
- **changed on both sides** — tasks that differ, and will be resolved by the rule below.

If those numbers look wrong — a much larger import than expected, for instance — cancel, correct the task list or the filter, and preview again.

## What gets synced

| Task property | CalDAV field |
|---|---|
| Title | `SUMMARY` |
| Due date | `DUE` |
| Scheduled date | `DTSTART` |
| Status | `STATUS` |
| Priority | `PRIORITY` |
| Completed date | `COMPLETED` |
| Tags | `CATEGORIES` |
| Recurrence | `RRULE` |
| Projects (parents) | `RELATED-TO;RELTYPE=PARENT` |
| Blocked by | `RELATED-TO` with the dependency type |
| Reminders | `VALARM` |

**The note body is not synced.** Anything already in a task's description on the server is left untouched, and your Markdown body stays in Obsidian. The same is true of attachments and any other field your other client sets that TaskNotes does not model — those are preserved exactly as they were.

### Subtasks and dependencies

In TaskNotes a subtask is a task whose **Projects** field points at its parent, and that is what gets sent as the standard `RELATED-TO` link. Your task hierarchy shows up as a real hierarchy in Nextcloud Tasks, Apple Reminders and anything else that understands subtasks.

Blocking relationships travel the same way, keeping their type and any offset, so two vaults syncing through the same list see the same dependencies.

A link can only be sent once both tasks exist on the server. If a parent is a plain note rather than a task, is archived, or belongs to a different account, the link is simply left out — nothing in your vault is changed, the hierarchy just is not visible on the server.

### Reminders

Reminders become alarms on the server, so a reminder set in Obsidian can notify you on your phone. A reminder attached to the due date fires relative to that date, one attached to the scheduled date relative to that.

TaskNotes only ever rewrites the alarms it created itself. An alarm you add in another app is left exactly as it is.

### Statuses and priorities

TaskNotes lets you define your own statuses and priorities, while CalDAV has a fixed set. TaskNotes maps between them automatically: a status marked as completed becomes `COMPLETED`, one marked as skipped becomes `CANCELLED`, and everything else becomes `NEEDS-ACTION`. Priorities are spread across the CalDAV 1–9 scale by their configured weight, and a priority with no weight is sent as no priority at all.

## Choosing which tasks sync

Each account can carry a filter, using the same conditions as the FilterBar. A task syncs to the first account whose filter it matches, so a task is never uploaded twice. An account with no filter takes every task.

This is how you keep separate lists separate: give one account a `#work` filter and another a `#personal` filter, and each syncs to its own task list on the server.

Archived tasks are never uploaded.

## Changes made in two places at once

If you edit a task in Obsidian and someone edits the same task on the server before the next sync, TaskNotes notices — it remembers the version it last saw, and the server tells it when that version is out of date. The more recently changed side wins, and the change that lost is written to the debug log so you can recover it.

Because this compares a timestamp from your computer against one from the server, it works best when both have a roughly accurate clock.

## When a task is deleted on the server

You choose what happens, per account:

- **Archive the note** (default) — the note is archived and stops syncing. Nothing is lost.
- **Keep the note and stop syncing it** — the note stays exactly as it is and is unlinked from the server.
- **Delete the note** — the note is moved to trash.

Deleting a task in Obsidian always deletes it on the server.

## Sync timing

Local edits are sent within a couple of seconds by default. You can turn that off with **Push changes immediately**, in which case they go out on the next scheduled sync.

Changes made on the server are picked up on the interval you set per account, 15 minutes by default. Each check starts by asking the server a single question — has anything in this list changed? — and stops there when the answer is no. Task lists often share a calendar with hundreds of ordinary events, and this keeps those out of the way entirely.

If a change cannot be sent because the server is unreachable, it is queued and retried in the background rather than lost.

Two commands are available from the command palette: **Sync tasks with CalDAV now**, and **Unlink all tasks from CalDAV**, which detaches every task without deleting anything. Note that the link is also what stops a task syncing twice, so syncing the same list again after unlinking gives you a second copy of every task.

## Troubleshooting

**"The server rejected those credentials."** Check the username and password. Many providers require an app-specific password rather than your account password.

**No task lists found.** The account may only have event calendars. Confirm that a task list exists on the server, and that the server URL points at the DAV endpoint rather than the web interface.

**Tasks are not syncing.** Confirm that both the global **Enable CalDAV sync** toggle and the per-account **Sync this account** toggle are on, and that a task list has been selected. Turn on debug logging under `Settings -> TaskNotes -> Misc` to see what the sync is doing.
