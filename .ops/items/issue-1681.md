---
id: 'github:callumalpass/tasknotes:issue:1681'
provider: github
kind: issue
key: '1681'
external_ref: callumalpass/tasknotes#1681
repo: callumalpass/tasknotes
number: 1681
remote_state: OPEN
remote_title: >-
  [Bug]: "Show convert button next to checkboxes" dramatically decreases navigation performance in large vaults
remote_author: en-ot
remote_url: 'https://github.com/callumalpass/tasknotes/issues/1681'
local_status: triaged
priority: high
difficulty: medium
risk: low
summary: >-
  The instant convert button StateField in InstantConvertButtons.ts scans every
  line in the document on each document change, calling TasksPluginParser.parseTaskLine
  per line. This causes significant CPU usage and cursor freezing in files with
  many checkboxes.
notes: |-
  Root cause:
  - buildConvertButtonDecorations() (src/editor/InstantConvertButtons.ts,
    line 210) iterates over every line in the document (for loop from 0 to
    doc.lines) on every rebuild. Each iteration calls
    TasksPluginParser.parseTaskLine which involves regex matching.
  - The StateField update function (line 155) rebuilds all decorations on
    any document change (line 173: docChanged check). While cursor-only
    changes reuse the old state, any keystroke triggers a full rescan.
  - For documents with many checkbox lines (the user's example), this
    creates a ConvertButtonWidget per line, and FullCalendar/CodeMirror
    must manage those DOM widgets during viewport updates.

  Suggested fix (preferred):
  - Use CodeMirror's viewport-aware decoration approach: only build
    decorations for lines in the visible viewport (using
    view.visibleRanges or EditorView.plugin with ViewPlugin). This limits
    the work to ~50-100 visible lines instead of the entire document.
  - Add a simple regex pre-check (e.g., /^\s*- \[/) before calling the
    full parseTaskLine to skip non-checkbox lines cheaply.

  Fallback options:
  - Debounce the decoration rebuild on document changes.
  - Switch to a ViewPlugin (instead of StateField) which natively supports
    viewport-scoped updates.
command_id: triage-issue
last_analyzed_at: '2026-03-22T00:00:00Z'
sync_state: clean
type: item_state
---
