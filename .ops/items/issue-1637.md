---
id: issue-1637
provider: github
kind: issue
key: callumalpass/tasknotes#1637
external_ref: https://github.com/callumalpass/tasknotes/issues/1637
repo: callumalpass/tasknotes
number: 1637
remote_state: open
remote_title: "Should data.json be config-only? (Move ephemeral session state out)"
remote_author: "ewgdg"
remote_url: https://github.com/callumalpass/tasknotes/issues/1637
local_status: triaged
priority: low
difficulty: medium
risk: medium
summary: "Discussion/FR: separate ephemeral session state (pomodoroState, lastSelectedTaskPath) from stable settings in data.json"
notes: |
  ## Root cause / Scope
  `data.json` currently mixes stable configuration (user preferences, saved views, field mappings) with ephemeral runtime state (`pomodoroState`, `lastSelectedTaskPath`, `lastPomodoroDate`). This means every Pomodoro tick causes a `saveData()` write to `data.json`, potentially causing conflicts with sync tools (iCloud, Syncthing) and making config diffs noisy. `PomodoroService.ts` writes to `data.pomodoroState` and `data.lastSelectedTaskPath` on almost every state change.

  ## Suggested fix / Approach
  Introduce a separate lightweight state file (e.g., `.obsidian/plugins/tasknotes/session-state.json`) for the ephemeral fields, or use `localStorage`/`sessionStorage` for in-memory persistence across Obsidian restarts within the same session. The migration path for existing users should read the fields from `data.json` on first load and then clear them from there. This is a quality-of-life improvement with medium risk due to touching the Pomodoro persistence path.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
