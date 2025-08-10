/**
 * FieldMapper boolean status tests
 * Tests for handling boolean status values in frontmatter
 */

import { FieldMapper } from '../../../src/services/FieldMapper';
import { DEFAULT_FIELD_MAPPING } from '../../../src/settings/settings';
import { TaskInfo } from '../../../src/types';

describe('FieldMapper - boolean status handling', () => {
    let fieldMapper: FieldMapper;

    beforeEach(() => {
        fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
    });

    describe('mapToFrontmatter - writing boolean status', () => {
        it('should write "true" status as boolean true to frontmatter', () => {
            const taskData: Partial<TaskInfo> = {
                title: 'Test Task',
                status: 'true'
            };

            const frontmatter = fieldMapper.mapToFrontmatter(taskData);

            expect(typeof frontmatter.status).toBe('boolean');
            expect(frontmatter.status).toBe(true);
        });

        it('should write "false" status as boolean false to frontmatter', () => {
            const taskData: Partial<TaskInfo> = {
                title: 'Test Task',
                status: 'false'
            };

            const frontmatter = fieldMapper.mapToFrontmatter(taskData);

            expect(typeof frontmatter.status).toBe('boolean');
            expect(frontmatter.status).toBe(false);
        });

        it('should handle case-insensitive boolean status values', () => {
            const taskDataTrue: Partial<TaskInfo> = {
                title: 'Test Task',
                status: 'TRUE'
            };

            const frontmatterTrue = fieldMapper.mapToFrontmatter(taskDataTrue);
            expect(typeof frontmatterTrue.status).toBe('boolean');
            expect(frontmatterTrue.status).toBe(true);

            const taskDataFalse: Partial<TaskInfo> = {
                title: 'Test Task',
                status: 'False'
            };

            const frontmatterFalse = fieldMapper.mapToFrontmatter(taskDataFalse);
            expect(typeof frontmatterFalse.status).toBe('boolean');
            expect(frontmatterFalse.status).toBe(false);
        });

        it('should not convert non-boolean status strings', () => {
            const taskData: Partial<TaskInfo> = {
                title: 'Test Task',
                status: 'open'
            };

            const frontmatter = fieldMapper.mapToFrontmatter(taskData);

            expect(typeof frontmatter.status).toBe('string');
            expect(frontmatter.status).toBe('open');
        });

        it('should handle other status values normally', () => {
            const statusValues = ['open', 'done', 'in-progress', 'waiting', 'blocked'];

            statusValues.forEach(status => {
                const taskData: Partial<TaskInfo> = {
                    title: 'Test Task',
                    status: status
                };

                const frontmatter = fieldMapper.mapToFrontmatter(taskData);

                expect(typeof frontmatter.status).toBe('string');
                expect(frontmatter.status).toBe(status);
            });
        });
    });

    describe('mapFromFrontmatter - reading boolean status', () => {
        it('should convert boolean true from frontmatter to "true" string', () => {
            const frontmatter = {
                title: 'Test Task',
                status: true
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(frontmatter, 'test-task.md');

            expect(typeof taskInfo.status).toBe('string');
            expect(taskInfo.status).toBe('true');
        });

        it('should convert boolean false from frontmatter to "false" string', () => {
            const frontmatter = {
                title: 'Test Task',
                status: false
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(frontmatter, 'test-task.md');

            expect(typeof taskInfo.status).toBe('string');
            expect(taskInfo.status).toBe('false');
        });

        it('should handle string status values normally', () => {
            const frontmatter = {
                title: 'Test Task',
                status: 'open'
            };

            const taskInfo = fieldMapper.mapFromFrontmatter(frontmatter, 'test-task.md');

            expect(typeof taskInfo.status).toBe('string');
            expect(taskInfo.status).toBe('open');
        });
    });

    describe('round-trip conversion', () => {
        it('should maintain consistency when converting true status through full cycle', () => {
            const originalTaskData: Partial<TaskInfo> = {
                title: 'Test Task',
                status: 'true'
            };

            // Convert to frontmatter (should become boolean)
            const frontmatter = fieldMapper.mapToFrontmatter(originalTaskData);
            expect(frontmatter.status).toBe(true);

            // Convert back to task data (should become string "true")
            const convertedTaskData = fieldMapper.mapFromFrontmatter(frontmatter, 'test-task.md');
            expect(convertedTaskData.status).toBe('true');
        });

        it('should maintain consistency when converting false status through full cycle', () => {
            const originalTaskData: Partial<TaskInfo> = {
                title: 'Test Task',
                status: 'false'
            };

            // Convert to frontmatter (should become boolean)
            const frontmatter = fieldMapper.mapToFrontmatter(originalTaskData);
            expect(frontmatter.status).toBe(false);

            // Convert back to task data (should become string "false")
            const convertedTaskData = fieldMapper.mapFromFrontmatter(frontmatter, 'test-task.md');
            expect(convertedTaskData.status).toBe('false');
        });

        it('should maintain consistency for non-boolean status values', () => {
            const originalTaskData: Partial<TaskInfo> = {
                title: 'Test Task',
                status: 'in-progress'
            };

            // Convert to frontmatter (should remain string)
            const frontmatter = fieldMapper.mapToFrontmatter(originalTaskData);
            expect(frontmatter.status).toBe('in-progress');

            // Convert back to task data (should remain same string)
            const convertedTaskData = fieldMapper.mapFromFrontmatter(frontmatter, 'test-task.md');
            expect(convertedTaskData.status).toBe('in-progress');
        });
    });

    describe('custom field mapping', () => {
        it('should work with custom status field name', () => {
            const customMapping = {
                ...DEFAULT_FIELD_MAPPING,
                status: 'done' // Custom field name for status
            };
            const customFieldMapper = new FieldMapper(customMapping);

            const taskData: Partial<TaskInfo> = {
                title: 'Test Task',
                status: 'true'
            };

            const frontmatter = customFieldMapper.mapToFrontmatter(taskData);

            // Should use custom field name and convert to boolean
            expect(frontmatter.done).toBe(true);
            expect(frontmatter.status).toBeUndefined();

            // Reading back should work too
            const convertedTaskData = customFieldMapper.mapFromFrontmatter(frontmatter, 'test-task.md');
            expect(convertedTaskData.status).toBe('true');
        });
    });
});