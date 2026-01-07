import { generateTaskFilename } from '../../../src/utils/filenameGenerator';
import { TaskNotesSettings } from '../../../src/types/settings';

/**
 * Tests for issue #791: UUID v4 as filename format option
 *
 * Feature request: Add UUID v4 as a filename format option in the dropdown
 * alongside existing options (title, zettel, timestamp, custom).
 *
 * Expected behavior:
 * - A new "uuid" option should appear in the Filename format dropdown
 * - When selected, filenames should be generated using crypto.randomUUID()
 * - UUIDs should be valid v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
describe('filenameGenerator - UUID v4 format (issue #791)', () => {
    const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // Base settings for testing - using type assertion since 'uuid' is not yet a valid option
    const createSettingsWithUuid = (): TaskNotesSettings => ({
        taskFilenameFormat: 'uuid' as TaskNotesSettings['taskFilenameFormat'],
        storeTitleInFilename: false,
        customFilenameTemplate: '',
    } as unknown as TaskNotesSettings);

    const baseContext = {
        title: 'Test Task',
        priority: 'normal',
        status: 'open',
    };

    it.skip('should generate a valid UUID v4 when format is "uuid"', () => {
        // Issue #791: UUID v4 format not yet implemented
        const settings = createSettingsWithUuid();

        const filename = generateTaskFilename(baseContext, settings);

        expect(filename).toMatch(UUID_V4_REGEX);
    });

    it.skip('should generate unique UUIDs for each call', () => {
        // Issue #791: UUID v4 format not yet implemented
        const settings = createSettingsWithUuid();

        const filename1 = generateTaskFilename(baseContext, settings);
        const filename2 = generateTaskFilename(baseContext, settings);
        const filename3 = generateTaskFilename(baseContext, settings);

        expect(filename1).not.toBe(filename2);
        expect(filename2).not.toBe(filename3);
        expect(filename1).not.toBe(filename3);
    });

    it.skip('should ignore task title when UUID format is selected', () => {
        // Issue #791: UUID v4 format not yet implemented
        const settings = createSettingsWithUuid();

        const filename = generateTaskFilename({
            ...baseContext,
            title: 'My Important Task',
        }, settings);

        // UUID should not contain any part of the title
        expect(filename).not.toContain('My');
        expect(filename).not.toContain('Important');
        expect(filename).not.toContain('Task');
        expect(filename).toMatch(UUID_V4_REGEX);
    });

    it.skip('should not use UUID when storeTitleInFilename is true', () => {
        // Issue #791: UUID v4 format not yet implemented
        // When storeTitleInFilename is true, title should be used regardless of format setting
        const settings = {
            ...createSettingsWithUuid(),
            storeTitleInFilename: true,
        } as TaskNotesSettings;

        const filename = generateTaskFilename({
            ...baseContext,
            title: 'My Task Title',
        }, settings);

        // Should use title, not UUID
        expect(filename).toBe('My Task Title');
    });
});

describe('filenameGenerator - UUID as custom template variable (alternative approach)', () => {
    const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    const createSettings = (template: string): TaskNotesSettings => ({
        taskFilenameFormat: 'custom',
        storeTitleInFilename: false,
        customFilenameTemplate: template,
    } as unknown as TaskNotesSettings);

    const baseContext = {
        title: 'Test Task',
        priority: 'normal',
        status: 'open',
    };

    it.skip('should support {uuid} variable in custom templates', () => {
        // Issue #791: UUID variable not yet implemented
        const settings = createSettings('{{uuid}}');

        const filename = generateTaskFilename(baseContext, settings);

        expect(filename).toMatch(UUID_V4_REGEX);
    });

    it.skip('should support combining UUID with other variables', () => {
        // Issue #791: UUID variable not yet implemented
        const settings = createSettings('{{titleKebab}}-{{uuid}}');

        const filename = generateTaskFilename({
            ...baseContext,
            title: 'My Task',
        }, settings);

        expect(filename).toMatch(/^my-task-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it.skip('should generate unique UUIDs when using template variable', () => {
        // Issue #791: UUID variable not yet implemented
        const settings = createSettings('{{uuid}}');

        const filename1 = generateTaskFilename(baseContext, settings);
        const filename2 = generateTaskFilename(baseContext, settings);

        expect(filename1).not.toBe(filename2);
    });
});
