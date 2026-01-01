/**
 * Issue #1326: Handle empty front-matter properties gracefully
 *
 * Feature request: When a front-matter property is empty (e.g., title: ""),
 * the system should gracefully fall back to reasonable defaults.
 *
 * Example: empty "title" → should fall back to note filename
 */

import { FieldMapper } from '../../../src/services/FieldMapper';
import { DEFAULT_FIELD_MAPPING } from '../../../src/settings/defaults';

describe.skip('Issue #1326 - Empty front-matter properties graceful handling', () => {
    let fieldMapper: FieldMapper;

    beforeEach(() => {
        fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
    });

    describe('empty title property fallback to filename', () => {
        it('should fall back to filename when title is empty string', () => {
            const frontmatter = {
                title: '',
                status: 'open'
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'TaskNotes/My Important Task.md',
                true // storeTitleInFilename
            );

            // Should fall back to filename when title is empty
            expect(taskInfo.title).toBe('My Important Task');
        });

        it('should fall back to filename when title is whitespace-only', () => {
            const frontmatter = {
                title: '   ',
                status: 'open'
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'TaskNotes/Another Task.md',
                true
            );

            // Whitespace-only should be treated as empty and fall back to filename
            expect(taskInfo.title).toBe('Another Task');
        });

        it('should fall back to filename when title is null', () => {
            const frontmatter = {
                title: null,
                status: 'open'
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'TaskNotes/Null Title Task.md',
                true
            );

            // Null should fall back to filename
            expect(taskInfo.title).toBe('Null Title Task');
        });

        it('should use empty title when storeTitleInFilename is false and title is empty', () => {
            const frontmatter = {
                title: '',
                status: 'open'
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'TaskNotes/Some Task.md',
                false // storeTitleInFilename = false
            );

            // When storeTitleInFilename is false, empty title should still result in no title
            // (the caller should handle the fallback to "Untitled task")
            expect(taskInfo.title).toBeUndefined();
        });

        it('should preserve non-empty title values', () => {
            const frontmatter = {
                title: 'Valid Title',
                status: 'open'
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'TaskNotes/Different Filename.md',
                true
            );

            // Non-empty title should be preserved
            expect(taskInfo.title).toBe('Valid Title');
        });

        it('should handle deeply nested file paths when falling back to filename', () => {
            const frontmatter = {
                title: '',
                status: 'open'
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'Projects/Work/Q1 2025/Important Project Task.md',
                true
            );

            // Should extract just the filename without path or extension
            expect(taskInfo.title).toBe('Important Project Task');
        });
    });

    describe('empty array properties graceful handling', () => {
        it('should handle empty contexts array gracefully', () => {
            const frontmatter = {
                title: 'Test Task',
                contexts: []
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'TaskNotes/Test.md'
            );

            // Empty array should be preserved (not cause errors)
            expect(taskInfo.contexts).toEqual([]);
        });

        it('should handle empty projects array gracefully', () => {
            const frontmatter = {
                title: 'Test Task',
                projects: []
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'TaskNotes/Test.md'
            );

            // Empty array should be preserved (not cause errors)
            expect(taskInfo.projects).toEqual([]);
        });

        it('should handle empty tags array gracefully', () => {
            const frontmatter = {
                title: 'Test Task',
                tags: []
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'TaskNotes/Test.md'
            );

            // Empty tags array should be preserved
            expect(taskInfo.tags).toEqual([]);
            expect(taskInfo.archived).toBe(false);
        });
    });

    describe('empty string properties graceful handling', () => {
        it('should handle empty due date gracefully', () => {
            const frontmatter = {
                title: 'Test Task',
                due: ''
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'TaskNotes/Test.md'
            );

            // Empty due date should be treated as no due date
            expect(taskInfo.due).toBeUndefined();
        });

        it('should handle empty scheduled date gracefully', () => {
            const frontmatter = {
                title: 'Test Task',
                scheduled: ''
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'TaskNotes/Test.md'
            );

            // Empty scheduled date should be treated as no scheduled date
            expect(taskInfo.scheduled).toBeUndefined();
        });

        it('should handle empty priority gracefully', () => {
            const frontmatter = {
                title: 'Test Task',
                priority: ''
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'TaskNotes/Test.md'
            );

            // Empty priority should be treated as no priority
            expect(taskInfo.priority).toBeUndefined();
        });

        it('should handle empty recurrence gracefully', () => {
            const frontmatter = {
                title: 'Test Task',
                recurrence: ''
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'TaskNotes/Test.md'
            );

            // Empty recurrence should be treated as no recurrence
            expect(taskInfo.recurrence).toBeUndefined();
        });

        it('should handle empty time_estimate gracefully', () => {
            const frontmatter = {
                title: 'Test Task',
                time_estimate: ''
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'TaskNotes/Test.md'
            );

            // Empty time estimate should be treated as no time estimate
            expect(taskInfo.timeEstimate).toBeUndefined();
        });
    });

    describe('mixed empty and valid properties', () => {
        it('should handle frontmatter with mix of empty and valid properties', () => {
            const frontmatter = {
                title: '',
                status: 'open',
                priority: '',
                due: '2025-06-15',
                contexts: [],
                projects: ['project-a']
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(
                frontmatter,
                'TaskNotes/Mixed Properties Task.md',
                true
            );

            // Empty title should fall back to filename
            expect(taskInfo.title).toBe('Mixed Properties Task');
            // Valid status should be preserved
            expect(taskInfo.status).toBe('open');
            // Empty priority should be undefined
            expect(taskInfo.priority).toBeUndefined();
            // Valid due date should be preserved
            expect(taskInfo.due).toBe('2025-06-15');
            // Empty contexts array should be preserved
            expect(taskInfo.contexts).toEqual([]);
            // Valid projects should be preserved
            expect(taskInfo.projects).toEqual(['project-a']);
        });
    });
});
