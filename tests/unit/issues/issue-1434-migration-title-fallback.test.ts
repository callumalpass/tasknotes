/**
 * Tests for Issue #1434: Task title shows "Untitled Task" for tasks created
 * before setting storeTitleInFilename to false
 *
 * Bug Description:
 * When a user changes storeTitleInFilename from true to false:
 * - Old tasks were created with title in filename (no title property in frontmatter)
 * - After changing the setting to false, these old tasks show "Untitled Task"
 * - The bug is that when storeTitleInFilename=false, we don't fallback to filename
 *
 * Two manifestations:
 * 1. Task cards display "Untitled Task" instead of the filename-derived title
 * 2. Edit modal pre-fills "Untitled Task" instead of filename-derived title
 *
 * Expected behavior:
 * When a task has no title property AND storeTitleInFilename is false,
 * the system should still derive the title from the filename as a fallback.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1434
 */

import { FieldMapper } from '../../../src/services/FieldMapper';
import { DEFAULT_FIELD_MAPPING } from '../../../src/settings/defaults';
import { extractTaskInfo } from '../../../src/utils/helpers';

describe.skip('Issue #1434: Title fallback for tasks created before storeTitleInFilename change', () => {
    let fieldMapper: FieldMapper;

    beforeEach(() => {
        fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
    });

    describe('FieldMapper.mapFromFrontmatter - title resolution', () => {
        it('should derive title from filename when storeTitleInFilename=true and no title property', () => {
            // This is the current working scenario
            const frontmatter = {
                status: 'open',
                priority: 'normal',
                tags: ['task']
                // No title property - this is how tasks were created with storeTitleInFilename=true
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'tasks/Buy groceries.md',
                true // storeTitleInFilename=true
            );

            expect(taskInfo.title).toBe('Buy groceries');
        });

        it('should derive title from filename when storeTitleInFilename=false and no title property (BUG)', () => {
            // This is the bug scenario:
            // User had storeTitleInFilename=true, created tasks (no title property in frontmatter)
            // User then changed to storeTitleInFilename=false
            // Old tasks should still get their title from filename as fallback
            const frontmatter = {
                status: 'open',
                priority: 'normal',
                tags: ['task']
                // No title property - old task created when storeTitleInFilename was true
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'tasks/Buy groceries.md',
                false // storeTitleInFilename=false (user changed setting)
            );

            // BUG: Currently returns undefined, should return 'Buy groceries'
            expect(taskInfo.title).toBe('Buy groceries');
        });

        it('should use title property when present regardless of storeTitleInFilename setting', () => {
            const frontmatter = {
                title: 'Custom Title',
                status: 'open',
                priority: 'normal',
                tags: ['task']
            };

            // With storeTitleInFilename=true
            const taskInfo1 = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'tasks/Different-filename.md',
                true
            );
            expect(taskInfo1.title).toBe('Custom Title');

            // With storeTitleInFilename=false
            const taskInfo2 = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'tasks/Different-filename.md',
                false
            );
            expect(taskInfo2.title).toBe('Custom Title');
        });

        it('should handle special characters in filename when deriving title', () => {
            const frontmatter = {
                status: 'open',
                tags: ['task']
            };

            // Test with storeTitleInFilename=false (the bug scenario)
            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'tasks/What should I do next.md',
                false
            );

            // BUG: Currently returns undefined
            expect(taskInfo.title).toBe('What should I do next');
        });

        it('should handle nested paths when deriving title from filename', () => {
            const frontmatter = {
                status: 'open',
                tags: ['task']
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'projects/work/tasks/Important meeting.md',
                false
            );

            // BUG: Currently returns undefined
            expect(taskInfo.title).toBe('Important meeting');
        });
    });

    describe('extractTaskInfo - complete task extraction with title fallback', () => {
        it('should not show "Untitled task" for tasks without title property when storeTitleInFilename=false', () => {
            // Simulate the exact scenario from the bug report:
            // A task file created when storeTitleInFilename=true (no title in frontmatter)
            // Now being read with storeTitleInFilename=false
            const fileContent = `---
status: open
priority: normal
tags:
  - task
due: 2024-01-15
---

Task details here.
`;

            // Mock the App object with minimal required structure
            const mockApp = {
                metadataCache: {
                    getFileCache: () => ({
                        frontmatter: {
                            status: 'open',
                            priority: 'normal',
                            tags: ['task'],
                            due: '2024-01-15'
                        }
                    })
                }
            };

            const mockFile = {
                path: 'tasks/Schedule dentist appointment.md',
                name: 'Schedule dentist appointment.md',
                parent: { path: 'tasks' }
            };

            const taskInfo = extractTaskInfo(
                mockApp as any,
                fileContent,
                mockFile.path,
                mockFile as any,
                fieldMapper,
                false // storeTitleInFilename=false
            );

            // BUG: Currently this would be "Untitled task"
            expect(taskInfo?.title).toBe('Schedule dentist appointment');
            expect(taskInfo?.title).not.toBe('Untitled task');
        });
    });

    describe('Migration scenario simulation', () => {
        it('should demonstrate the full migration scenario', () => {
            // Step 1: User creates task with storeTitleInFilename=true
            // The frontmatter would NOT have a title property
            const taskCreatedWithStoreTitleTrue = {
                status: 'open',
                priority: 'high',
                due: '2024-12-31',
                tags: ['task', 'urgent']
                // Note: No title property - it was stored in filename
            };

            // When reading this task with storeTitleInFilename=true, it works
            const result1 = fieldMapper.mapFromFrontmatter(
                taskCreatedWithStoreTitleTrue,
                'tasks/Review quarterly report.md',
                true
            );
            expect(result1.title).toBe('Review quarterly report');

            // Step 2: User changes setting to storeTitleInFilename=false
            // to allow special characters like "?" in titles

            // When reading the SAME task with storeTitleInFilename=false
            // BUG: title becomes undefined, leading to "Untitled task" fallback
            const result2 = fieldMapper.mapFromFrontmatter(
                taskCreatedWithStoreTitleTrue,
                'tasks/Review quarterly report.md',
                false
            );

            // This is what should happen (derive from filename as fallback)
            expect(result2.title).toBe('Review quarterly report');
            // This is what currently happens (undefined, then "Untitled task" in UI)
            expect(result2.title).not.toBeUndefined();
        });

        it('should handle edge case where filename has characters removed during sanitization', () => {
            // When storeTitleInFilename was true, certain characters were sanitized
            // The filename might be different from the original title
            const frontmatter = {
                status: 'open',
                tags: ['task']
            };

            // Even if original title was "What's the plan?", the filename would be sanitized
            // When reading back, we should get whatever the filename is
            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'tasks/Whats the plan.md',
                false
            );

            // BUG: Currently undefined
            expect(taskInfo.title).toBe('Whats the plan');
        });
    });
});
