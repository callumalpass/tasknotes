/**
 * Skipped tests for Issue #870: Base with TaskNotes Task List layout pulls everything not just tasks
 *
 * Bug Description:
 * When creating a Base with the Layout as "TaskNotes Task List", it pulls all files from the
 * Base query results (including notes) instead of filtering to only show actual TaskNotes tasks.
 *
 * Root Cause:
 * The `identifyTaskNotesFromBasesData()` function in src/bases/helpers.ts (lines 209-226) does NOT
 * filter items based on whether they are actually TaskNotes tasks. It simply converts ALL items
 * from the Bases query results to TaskInfo objects, treating every Markdown file as a task.
 *
 * The conversion function `createTaskInfoFromBasesData()` (lines 168-204) applies default values
 * when task-specific properties are missing (e.g., status defaults to "open", priority to "normal"),
 * making regular notes appear as tasks in the TaskNotes Task List layout.
 *
 * Key code locations:
 * - src/bases/helpers.ts:209-226 - `identifyTaskNotesFromBasesData()` - no filtering applied
 * - src/bases/helpers.ts:168-204 - `createTaskInfoFromBasesData()` - treats all files as tasks
 * - src/bases/helpers.ts:131 - `status: props.status || "open"` - defaults notes to "open" status
 * - src/bases/BasesDataAdapter.ts:18-28 - `extractDataItems()` - extracts ALL Bases data items
 * - src/bases/TaskListView.ts:108-172 - `render()` - renders all converted items as task cards
 *
 * The issue is architectural: there's no mechanism to distinguish TaskNotes tasks from regular
 * notes when rendering in Bases layouts. The filtering should occur either:
 * 1. In `identifyTaskNotesFromBasesData()` - check for required TaskNotes properties (e.g., status)
 * 2. In `BasesDataAdapter.extractDataItems()` - filter before returning data items
 * 3. At Base registration time - set up an automatic filter for TaskNotes tasks only
 *
 * Suggested fix:
 * Add filtering logic to `identifyTaskNotesFromBasesData()` that checks whether each item
 * has TaskNotes-specific properties (like a `status` field in frontmatter) before including
 * it in the results. Regular notes without these properties should be excluded.
 *
 * Alternative approaches:
 * - Check for presence of required properties (status, priority) in frontmatter
 * - Check if file is in a configured "tasks" folder path
 * - Add explicit `type: task` frontmatter field to distinguish tasks from notes
 * - Use a naming convention or pattern to identify task files
 *
 * @see https://github.com/callumalpass/tasknotes/issues/870
 */

import { describe, it, expect } from '@jest/globals';
import {
    identifyTaskNotesFromBasesData,
    createTaskInfoFromBasesData,
    BasesDataItem,
} from '../../../src/bases/helpers';

describe('Issue #870: Bases TaskNotes Task List layout includes notes', () => {
    describe('Core bug demonstration - no filtering of non-task items', () => {
        it.skip('reproduces issue #870 - identifyTaskNotesFromBasesData includes regular notes', async () => {
            // Reproduces issue #870
            // Regular notes (files without TaskNotes-specific frontmatter) are included
            // in the results and displayed as tasks in the TaskNotes Task List layout

            const dataItems: BasesDataItem[] = [
                // A proper TaskNotes task with status field
                {
                    path: 'tasks/complete-report.md',
                    name: 'Complete Report',
                    properties: {
                        title: 'Complete the quarterly report',
                        status: 'open',
                        priority: 'high',
                        due: '2025-10-15',
                    },
                },
                // A regular note - NO status or TaskNotes-specific properties
                {
                    path: 'notes/meeting-notes.md',
                    name: 'Meeting Notes',
                    properties: {
                        title: 'Meeting notes from standup',
                        // No status, no priority, no due date - this is a note, not a task
                    },
                },
                // Another regular note
                {
                    path: 'notes/ideas.md',
                    name: 'Ideas',
                    properties: {
                        tags: ['brainstorm'],
                        // Again, no TaskNotes-specific properties
                    },
                },
            ];

            const result = await identifyTaskNotesFromBasesData(dataItems);

            // BUG: Currently returns ALL 3 items
            // The notes are treated as tasks with default status="open", priority="normal"
            expect(result.length).toBe(3);

            // EXPECTED behavior after fix:
            // Should only return the actual task (1 item)
            // expect(result.length).toBe(1);
            // expect(result[0].path).toBe('tasks/complete-report.md');

            // Verify the notes are incorrectly included
            const meetingNotes = result.find(t => t.path === 'notes/meeting-notes.md');
            expect(meetingNotes).toBeDefined();
            // The note is given default task properties even though it's not a task
            expect(meetingNotes?.status).toBe('open'); // Defaulted to 'open'
            expect(meetingNotes?.priority).toBe('normal'); // Defaulted to 'normal'
        });

        it.skip('reproduces issue #870 - createTaskInfoFromBasesData converts notes to tasks', () => {
            // Reproduces issue #870
            // Demonstrates that ANY file is converted to a TaskInfo object regardless of content

            const regularNote: BasesDataItem = {
                path: 'daily/2025-10-06.md',
                name: '2025-10-06',
                properties: {
                    // This is a daily note with no task properties whatsoever
                    date: '2025-10-06',
                    mood: 'good',
                    weather: 'sunny',
                },
            };

            const result = createTaskInfoFromBasesData(regularNote);

            // BUG: The daily note is converted to a TaskInfo object
            expect(result).not.toBeNull();
            expect(result?.path).toBe('daily/2025-10-06.md');

            // It's given default task properties even though it's clearly a note
            expect(result?.status).toBe('open');
            expect(result?.priority).toBe('normal');
            expect(result?.title).toBe('2025-10-06'); // Uses filename as title

            // EXPECTED behavior after fix:
            // Should return null for items without required TaskNotes properties
            // expect(result).toBeNull();
        });

        it.skip('reproduces issue #870 - empty frontmatter file treated as task', () => {
            // Reproduces issue #870
            // Even files with no frontmatter properties are converted to tasks

            const emptyFrontmatterFile: BasesDataItem = {
                path: 'archive/old-document.md',
                name: 'old-document',
                properties: {}, // Completely empty frontmatter
            };

            const result = createTaskInfoFromBasesData(emptyFrontmatterFile);

            // BUG: Empty file is still converted to a task
            expect(result).not.toBeNull();
            expect(result?.status).toBe('open');
            expect(result?.title).toBe('old-document');

            // EXPECTED: Should be filtered out or return null
        });
    });

    describe('Filtering criteria - what should distinguish tasks from notes', () => {
        it.skip('reproduces issue #870 - demonstrates need for status field filtering', async () => {
            // Reproduces issue #870
            // Tests the proposed fix: filter based on presence of 'status' field

            const dataItems: BasesDataItem[] = [
                // Task WITH status - should be included
                {
                    path: 'tasks/task-with-status.md',
                    name: 'Task With Status',
                    properties: {
                        title: 'A real task',
                        status: 'in-progress',
                    },
                },
                // Note WITHOUT status - should be excluded
                {
                    path: 'notes/note-without-status.md',
                    name: 'Note Without Status',
                    properties: {
                        title: 'Just a note',
                        // No status field
                    },
                },
            ];

            const result = await identifyTaskNotesFromBasesData(dataItems);

            // BUG: Both items are returned
            expect(result.length).toBe(2);

            // EXPECTED after fix - only the task with explicit status
            // expect(result.length).toBe(1);
            // expect(result[0].path).toBe('tasks/task-with-status.md');

            // The note should NOT appear in the task list
            const note = result.find(t => t.path === 'notes/note-without-status.md');
            expect(note).toBeDefined(); // BUG: Note is present in results
        });

        it.skip('reproduces issue #870 - mixed vault content scenario', async () => {
            // Reproduces issue #870
            // Real-world scenario: user has tasks, notes, daily notes, templates all in vault

            const vaultContent: BasesDataItem[] = [
                // TaskNotes tasks (have status)
                {
                    path: 'tasks/buy-groceries.md',
                    properties: { status: 'open', priority: 'low', title: 'Buy groceries' },
                },
                {
                    path: 'tasks/finish-project.md',
                    properties: { status: 'in-progress', priority: 'high', title: 'Finish project', due: '2025-10-20' },
                },
                // Regular notes (no status)
                {
                    path: 'notes/research-notes.md',
                    properties: { title: 'Research Notes', tags: ['research'] },
                },
                {
                    path: 'notes/book-summary.md',
                    properties: { title: 'Book Summary', author: 'Some Author' },
                },
                // Daily notes (no status)
                {
                    path: 'daily/2025-10-01.md',
                    properties: { date: '2025-10-01' },
                },
                {
                    path: 'daily/2025-10-02.md',
                    properties: { date: '2025-10-02' },
                },
                // Templates (no status)
                {
                    path: 'templates/meeting-template.md',
                    properties: { template: true },
                },
            ];

            const result = await identifyTaskNotesFromBasesData(vaultContent);

            // BUG: All 7 items are returned as "tasks"
            expect(result.length).toBe(7);

            // EXPECTED: Only the 2 actual tasks should be returned
            // expect(result.length).toBe(2);
            // expect(result.map(t => t.path).sort()).toEqual([
            //     'tasks/buy-groceries.md',
            //     'tasks/finish-project.md',
            // ]);

            // Verify that notes/dailies/templates are incorrectly included
            expect(result.some(t => t.path === 'notes/research-notes.md')).toBe(true);
            expect(result.some(t => t.path === 'daily/2025-10-01.md')).toBe(true);
            expect(result.some(t => t.path === 'templates/meeting-template.md')).toBe(true);
        });
    });

    describe('Expected behavior after fix', () => {
        it('should demonstrate that tasks have identifying properties', () => {
            // This test PASSES - demonstrates that we CAN identify tasks
            // by checking for the presence of a 'status' property

            const taskItem: BasesDataItem = {
                path: 'tasks/real-task.md',
                properties: {
                    title: 'A real task',
                    status: 'open',
                    priority: 'high',
                },
            };

            const noteItem: BasesDataItem = {
                path: 'notes/just-a-note.md',
                properties: {
                    title: 'Just a note',
                    // No status property
                },
            };

            // We can distinguish tasks from notes by checking for 'status'
            const taskHasStatus = taskItem.properties?.status !== undefined;
            const noteHasStatus = noteItem.properties?.status !== undefined;

            expect(taskHasStatus).toBe(true);
            expect(noteHasStatus).toBe(false);

            // This logic should be added to identifyTaskNotesFromBasesData()
            // to filter out non-task items before rendering
        });

        it('should verify createTaskInfoFromBasesData could check for required properties', () => {
            // This test demonstrates how the fix could work
            // by checking for required TaskNotes properties before conversion

            const isTaskNotesFile = (item: BasesDataItem): boolean => {
                const props = item.properties || {};
                // A TaskNotes task should have at minimum a 'status' field
                // (or we could check for other required properties)
                return props.status !== undefined;
            };

            // Test cases
            const taskWithStatus: BasesDataItem = {
                path: 'tasks/task.md',
                properties: { status: 'open' },
            };

            const noteWithoutStatus: BasesDataItem = {
                path: 'notes/note.md',
                properties: { title: 'A note' },
            };

            const emptyFile: BasesDataItem = {
                path: 'other/empty.md',
                properties: {},
            };

            expect(isTaskNotesFile(taskWithStatus)).toBe(true);
            expect(isTaskNotesFile(noteWithoutStatus)).toBe(false);
            expect(isTaskNotesFile(emptyFile)).toBe(false);
        });
    });
});
