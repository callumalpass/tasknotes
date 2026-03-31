---
id: issue-1669
provider: github
kind: issue
key: callumalpass/tasknotes#1669
external_ref: https://github.com/callumalpass/tasknotes/issues/1669
repo: callumalpass/tasknotes
number: 1669
remote_state: open
remote_title: "[Bug]: Data.json constantly being modified"
remote_author: "thehyperadvisor"
remote_url: https://github.com/callumalpass/tasknotes/issues/1669
local_status: triaged
priority: medium
difficulty: medium
risk: medium
summary: "data.json written repeatedly causing iCloud sync conflicts when multiple Obsidian instances are open"
notes: |
  ## Root cause / Scope
  Several services write to `data.json` (Obsidian's plugin data file) at high frequency: `PomodoroService.saveState()` is called on every state change including timer ticks (every second when running), `ICSSubscriptionService.saveSubscriptions()` is called on each subscription update/refresh cycle, and `OAuthService` saves tokens on each refresh. When the API server is enabled, status checks can also trigger saves. With two devices both running Obsidian and syncing via iCloud, each write on one device triggers a sync event visible to the other, creating a feedback loop of constant modifications.

  The core issue is that `saveState()` in PomodoroService does a full `loadData()` + `saveData()` round-trip each time, which is expensive and frequent. Even without an active Pomodoro session, periodic background operations (ICS refresh intervals, notification scans) may touch `data.json`.

  ## Suggested fix / Approach
  Debounce or throttle writes to `data.json`: batch multiple rapid saves into a single write using a debounce (e.g. 500–1000ms delay). For the Pomodoro timer, keep `timeRemaining` in-memory only during the session and persist to `data.json` only on pause/stop/complete rather than every tick. For ICS subscriptions, store `lastFetched` timestamps in-memory (already done via `Map`) and only write `data.json` when subscription config actually changes. This is a multi-service change of medium difficulty.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
