---
id: issue-1681
provider: github
kind: issue
key: callumalpass/tasknotes#1681
external_ref: https://github.com/callumalpass/tasknotes/issues/1681
repo: callumalpass/tasknotes
number: 1681
remote_state: open
remote_title: "[Bug]: \"Show convert button next to checkboxes\" dramatically decreases navigation performance in large vaults"
remote_author: "en-ot"
remote_url: https://github.com/callumalpass/tasknotes/issues/1681
local_status: triaged
priority: high
difficulty: medium
risk: medium
summary: "InstantConvert button CodeMirror extension causes editor freezes and CPU spikes when navigating files with many checkboxes"
notes: |
  ## Root cause / Scope
  The `createInstantConvertField` StateField in `src/editor/InstantConvertButtons.ts` rebuilds all button decorations on every document change (`transaction.docChanged`). `buildConvertButtonDecorations` iterates every line in the document to check for task lines. In a file with many checkboxes and a large document, moving the cursor triggers selection-change transactions that may be misclassified as doc changes, or the decoration set mapping (`oldState.map(transaction.changes)`) is more expensive than expected. More critically, `ConvertButtonWidget.toDOM()` sets up event listeners and calls `setTooltip()` for each widget, and creating/destroying many widgets on each update causes significant DOM churn. The `update` function at line 173 checks `!transaction.docChanged && oldState !== Decoration.none` to skip rebuilds—but cursor movement in CodeMirror can still trigger recomputation in certain scenarios (e.g. selection changes, viewport updates).

  ## Suggested fix / Approach
  Reduce rebuild frequency: (1) Use `transaction.docChanged` strictly and also check `transaction.selection` to avoid redundant rebuilds. (2) Limit the line scan to the visible viewport range using `EditorView.visibleRanges` instead of scanning all `doc.lines`. (3) Add debouncing to `buildConvertButtonDecorations` so rapid cursor movements coalesce into a single rebuild. (4) Consider using a `ViewPlugin` instead of `StateField` so viewport changes are handled separately from document changes. Medium difficulty touching the CodeMirror extension architecture.
command_id: triage-issue
last_analyzed_at: "2026-03-31"
sync_state: clean
type: item_state
---
