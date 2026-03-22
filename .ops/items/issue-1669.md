---
id: 'github:callumalpass/tasknotes:issue:1669'
provider: github
kind: issue
key: '1669'
external_ref: callumalpass/tasknotes#1669
repo: callumalpass/tasknotes
number: 1669
remote_state: OPEN
remote_title: >-
  [Bug]: Data.json constantly being modified
remote_author: thehyperadvisor
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1669'
local_status: triaged
priority: high
difficulty: medium
risk: medium
summary: >-
  The plugin's data.json is written multiple times per minute even when idle, causing iCloud sync
  conflicts when two Obsidian instances are open on different devices.
notes: |-
  Root cause:
  - Multiple code paths call this.saveData() in src/main.ts (lines ~1395, ~1479) and
    PomodoroService.ts (line ~150) which persist state on every minor change. The pomodoro
    service saves state on every tick (lastPomodoroDate + pomodoroState), and ViewStateManager
    or other services may also trigger frequent writes. Each write updates data.json on disk,
    causing constant iCloud sync churn.

  Suggested fix (preferred):
  - Debounce saveData() calls with a 5-10 second delay so multiple rapid state changes coalesce
    into a single disk write. Use a dirty flag + setTimeout pattern in main.ts. Also consider
    moving volatile state (like pomodoro timer ticks) to in-memory only, persisting only on
    session complete or plugin unload.

  Fallback options:
  - Add a setting to control save frequency or disable auto-save for specific subsystems
    (e.g. pomodoro tick state).
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
