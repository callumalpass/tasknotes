# Round 2 Undo implementation and verification

Branch: `redesign/r2-undo`. Scope: Slice H of the shared redesign brief.

## Contract

- Undo history is in memory only, bounded to twenty entries per vault. Reloading the plugin clears it.
- The toast button and Mod+Z use the same serialized history. Mod+Z is registered on task-view roots and leaves inputs, textareas and editors alone. Mouse Undo restores view focus; the button is a native keyboard-focusable button.
- Hovering or focusing the toast pauses its remaining dismissal time. Replacing a toast does not discard earlier Undo entries.
- Receipts own changed frontmatter properties, optional body changes, and optional filename moves. They preserve unrelated frontmatter/body edits. Changed owned values, missing notes and conflicting rename destinations prevent restoration.
- Multi-note file receipts acquire stable-order mutation locks, prevalidate every note, then validate again at each write. A later write failure attempts guarded rollback of earlier writes. These locks do not prevent external/editor writes; recovery also refuses to overwrite those edits.
- Once disk restoration succeeds, retrying a failed cache/side-effect refresh does not replay disk writes. Grouped actions retain only their unfinished restorers after a partial retry.
- Creation offers Open, never delete-as-Undo. Timeblock Undo does not delete the containing daily note.

## Slice H status

| Item | Status | Implementation |
| --- | --- | --- |
| 1 | Complete for local tasks/timeblocks | Single task calendar conversion/move/resize and batch movement use shared feedback; timeblock creation/copy/move/resize use guarded file receipts. |
| 2 | Complete | First board reorder records all rewritten neighbor ranks and reports the number of changed notes. |
| 3 | Complete | Cross-column positional drops restore grouping values and all changed ranks. |
| 4 | Complete | Tags, contexts and projects queue picker mutations; closing emits one net-session feedback/Undo action. |
| 5 | Complete for exercised paths | Edit fields/body/title-driven filename rename, dependency and subtask edits, archive, tracking start/stop and time-entry-editor saves have guarded Undo. Task creation has Open. |
| 6 | Complete | Per-vault twenty-entry session history, serialized button/key execution, editor exclusions and mouse focus return. |
| 7 | Complete for integrated paths | Named configured values, count-aware archive feedback, hover/focus pause and accessible action button. |
| 8 | Complete | Completion feedback uses the operation's actual occurrence identity, not the requested action date. |
| 9 | Partial; not a global native-notice migration | Calendar batch, modal save/relationships/archive, creation, tracking, time-entry editor and overdue postponement are integrated. See remaining work below. |
| 10 | Complete | A board without manual sorting does not paint a reorder insertion marker. |

## Native acceptance

On November 5, 2026, `e2e/undo-round2.spec.ts` passed sixteen tests in real Obsidian 1.14.2. The harness verified this worktree's `tasknotes-e2e-vault` before testing. Reuse was disabled; profile `.obsidian-config-undo`, debug port 9391, viewport 1180 by 800. The test profile and fixture notes were removed after acceptance.

Each Undo assertion reads the actual Markdown file from the filesystem, compares parsed frontmatter and the exact body, and removes only `dateModified` from the comparison. The first board reorder and cross-column drop compare all five affected notes, not just the dragged card. The conflict control changes a neighbor rank externally: Undo must leave every note unchanged, then succeeds after the external rank is restored. The tags control retains an unrelated body edit.

The sixteen cases cover:

1. Five successive property changes; mouse Undo followed by four keyboard Undos, all compared with their original disk snapshots.
2. Tracking start and stop; both disk states restored and no duplicate native Notice.
3. All-day-to-timed conversion, timed movement and resize; individual disk snapshots restored.
4. Two tag additions, one close-session toast, keyboard-reachable Undo, unrelated body retained.
5. Timeblock creation, copy, cross-day move and resize; both daily notes compared.
6. Two-note calendar batch movement through shared feedback.
7. Count-aware archive feedback and original note restoration.
8. Native board drag without manual sorting: no insertion marker.
9. First manual reorder, stale-neighbor conflict/retry, then cross-column positional drop: all ranks and grouping values restored.
10. Modal title/details save, including original filename restoration.
11. Creation offers Open; opening leaves the created note intact.
12. Recurring requested date November 4 UTC / November 5 Melbourne, owning occurrence November 6: feedback and stored occurrence both November 6, then full disk Undo.
13. Overdue postponement of two fixture tasks, followed by both disk restorations.
14. Time-entry editor save and command archive, with disk restoration for each.
15. One modal save changing dependencies and subtasks on separate notes; all three note snapshots restored.
16. List group movement followed by shared keyboard Undo.

Calendar movement and board/list drop tests invoke the native view's engine/drop handlers after loading a real Bases view; they are not full pointer-trajectory tests. Picker, modal, toast and keyboard interactions use Playwright input. The no-sort marker test exercises native drag events. No mock vault or mock persistence is used in these acceptance cases.

Reproduction timeline, relative to each case: the five-change stack case completes in about 8.6 seconds; first-reorder/conflict/retry/cross-column in about 2.3 seconds; modal relationships in about 2.1 seconds. Traces contain individual action timestamps and DOM snapshots. The final run completed in 51.7 seconds. Its log is `/tmp/slice-h-e2e-final6.log`; recordings are `test-results/undo-round2-*/trace.zip`. Light and dark screenshots are `test-results/undo-round2-light.png` and `test-results/undo-round2-dark.png`; both were visually inspected. These local artifacts are not committed.

Final source revision: `0389c2093802bea291adae1bbfc5c836a643c739`. Every command below exited 0:

- `npm run i18n:extract`: `/tmp/slice-h-extract-acceptance.log`.
- `npm run lint`: `/tmp/slice-h-lint-final6.log`.
- `npm run typecheck`: `/tmp/slice-h-typecheck-final6.log`.
- `npx jest --runInBand`: 787 passed suites, 68 skipped; 6054 passed tests, 988 skipped, 4 todo. Log: `/tmp/slice-h-jest-final6.log`.
- Targeted `npm run build:test`, including production build and vault copy: `/tmp/slice-h-build-final6.log`.
- Isolated Obsidian acceptance: 16 passed; `/tmp/slice-h-e2e-final6.log`.

The recurrence defect was a date-identity mismatch, not corrupted stored data: recurrence planning can search forward from the action date to an owning occurrence. The previous feedback formatted the input date instead of the occurrence actually completed. The returned occurrence date now comes from the materialized occurrence or the authoritative added/removed completion day. No recurrence scheduling/timezone policy was changed.

The relationship disk test also caught a receipt-validation mismatch: serialized dependency UIDs contain wikilink syntax while mapped TaskInfo UIDs are normalized. Receipt validation now applies the existing dependency normalization to both comparison values. Raw note values remain the values restored.

## Remaining work and limits

- Slice H item 9 is not fully finished: `main.ts`'s generic `updateTaskProperty` and `toggleTaskStatus` command paths still use native success/failure Notices. Some legacy card/menu call sites still use those paths. Their recurrence-parent and confirmation/callback behavior was not migrated and independently disk-qualified in this pass; do not describe this branch as a complete plugin-wide notice conversion.
- Generic property-based calendar events and remote calendar-provider writes retain their existing behavior. They are not the local TaskInfo/timeblock handlers covered above. Provider Undo needs operation/version-aware provider receipts, not snapshots of a local note.
- The calendar's separate tracked-time-entry creation path in `calendar-core.ts` is not migrated. Time-entry editor saves and tracking start/stop are migrated and disk-proven.
- Recurring status group moves retain the existing deliberate no-single-note-Undo limitation because one move may mutate other occurrence notes. Occurrence completion's existing dedicated guarded Undo is retained.
- No new persistent transaction ledger or claim of editor/external-write atomicity is introduced. Network-provider reconciliation, attachment-file deletion on edit Undo, third-party theme certification and reload-surviving history are not claimed.
- `TimeblockCreationModal.ts` is also owned by Slice K: retain its persistence-returning-Undo integration when merging K's composer work. No visual/layout rewrite was made there.
- No releases, pushes, tags, PRs or changes to `docs/releases/unreleased.md` are part of this work.

## Repeat

```sh
OBSIDIAN_PLUGIN_PATH="$PWD/tasknotes-e2e-vault/.obsidian/plugins/tasknotes" npm run build:test
TASKNOTES_E2E_REUSE_OBSIDIAN=0 \
TASKNOTES_E2E_REMOTE_DEBUGGING_PORT=9391 \
TASKNOTES_E2E_USER_DATA_DIR="$PWD/.obsidian-config-undo" \
npx playwright test e2e/undo-round2.spec.ts --workers=1
```

This npm-lockfile checkout uses local npm checks; it was not converted to pnpm for remote execution. Required acceptance commands are `npm run lint`, `npm run typecheck`, `npx jest --runInBand` and `npm run build`, with their actual exit codes checked. The build also runs strict catalogue/source guards; new copy has authored translations in all nine non-English locales. Unit coverage includes history bounds/vault separation, rapid Undo serialization, conflict retention, input/focus/timer behavior, concurrent eviction, multi-note prevalidation/rollback and retry after post-disk side-effect failure.
