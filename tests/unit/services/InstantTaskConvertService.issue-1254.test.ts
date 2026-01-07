/**
 * InstantTaskConvertService Issue #1254 Tests
 *
 * Feature Request: Instant Note Creation - Change File Name + Support ../ Path
 *
 * Two requested features:
 * 1. Customizing file names for instant task conversion with date variables
 *    - Users want to include date in the generated filename (e.g., "2025-01-15 Task Name.md")
 *    - Currently, the filename format is determined by global settings, not specific to inline conversion
 *
 * 2. Support ../ in folder paths for relative navigation
 *    - Users with structure like Project/Meetings/ and Project/Tasks/ want to use
 *      {{currentNotePath}}/../Tasks/{{currentNoteTitle}} to navigate to sibling folders
 *    - Currently, ../ is not normalized in folder paths, causing tasks to be created in wrong locations
 *
 * @see https://github.com/obsidian-tasknotes/tasknotes/issues/1254
 */

import { processFolderTemplate, TaskTemplateData } from '../../../src/utils/folderTemplateProcessor';
import { generateTaskFilename, FilenameContext } from '../../../src/utils/filenameGenerator';
import { DEFAULT_SETTINGS } from '../../../src/settings/defaults';

describe('Issue #1254: Instant Note Creation - Change File Name + Support ../ Path', () => {
	const testDate = new Date('2025-01-15T14:30:00');

	describe('Feature 1: Customizing File Names with Date Variables', () => {
		/**
		 * The user wants to be able to use date variables in the filename for instant task conversion.
		 * Example desired filename: "2025-01-15 My Task.md"
		 *
		 * Currently, the `customFilenameTemplate` setting supports this, but the user needs
		 * a clear way to configure this for instant task conversion specifically.
		 */

		it.skip('reproduces issue #1254: should support date variables in custom filename template', () => {
			// User's desired template: {{date}} {{title}}
			// Expected filename: "2025-01-15 My Task"
			const context: FilenameContext = {
				title: 'My Task',
				priority: 'normal',
				status: 'open',
				date: testDate,
			};

			const settings = {
				...DEFAULT_SETTINGS,
				taskFilenameFormat: 'custom' as const,
				customFilenameTemplate: '{{date}} {{title}}',
				storeTitleInFilename: false,
			};

			const filename = generateTaskFilename(context, settings);

			// This test documents the expected behavior - date should be included in filename
			expect(filename).toBe('2025-01-15 My Task');
		});

		it.skip('reproduces issue #1254: should support year/month/day variables in filename', () => {
			// User's alternative template: {{year}}-{{month}}-{{day}} {{title}}
			const context: FilenameContext = {
				title: 'Meeting Notes',
				priority: 'normal',
				status: 'open',
				date: testDate,
			};

			const settings = {
				...DEFAULT_SETTINGS,
				taskFilenameFormat: 'custom' as const,
				customFilenameTemplate: '{{year}}-{{month}}-{{day}} {{title}}',
				storeTitleInFilename: false,
			};

			const filename = generateTaskFilename(context, settings);

			expect(filename).toBe('2025-01-15 Meeting Notes');
		});

		it.skip('reproduces issue #1254: should support timestamp in filename for unique sorting', () => {
			// For users who want time-based uniqueness: {{date}}-{{time}} {{title}}
			const context: FilenameContext = {
				title: 'Quick Task',
				priority: 'normal',
				status: 'open',
				date: testDate,
			};

			const settings = {
				...DEFAULT_SETTINGS,
				taskFilenameFormat: 'custom' as const,
				customFilenameTemplate: '{{date}}-{{time}} {{title}}',
				storeTitleInFilename: false,
			};

			const filename = generateTaskFilename(context, settings);

			expect(filename).toBe('2025-01-15-143000 Quick Task');
		});
	});

	describe('Feature 2: Support ../ in Folder Paths (Relative Navigation)', () => {
		/**
		 * The user has this project structure:
		 *
		 * Project/
		 *   Meetings/
		 *     MeetingA.md   <- task is created here
		 *   Tasks/          <- task note should go here
		 *
		 * When using Instant Task Conversion inside Project/Meetings/MeetingA.md,
		 * they want to use the template: {{currentNotePath}}/../Tasks/{{currentNoteTitle}}
		 *
		 * Expected behavior:
		 * - Input: "Project/Meetings/../Tasks/MeetingA"
		 * - Output: "Project/Tasks/MeetingA"
		 *
		 * Currently, ../ is not normalized, causing incorrect folder paths.
		 */

		it.skip('reproduces issue #1254: should normalize ../ in folder path templates', () => {
			// Simulate the scenario where {{currentNotePath}} = "Project/Meetings"
			// and the template is "{{currentNotePath}}/../Tasks/{{currentNoteTitle}}"
			// After variable substitution: "Project/Meetings/../Tasks/MeetingA"
			// Expected normalized: "Project/Tasks/MeetingA"

			const folderPath = 'Project/Meetings/../Tasks/MeetingA';

			// The folder template processor should normalize the path
			const result = processFolderTemplate(folderPath, { date: testDate });

			// This test documents the expected behavior
			// Currently, this likely returns the path unchanged with ../
			expect(result).toBe('Project/Tasks/MeetingA');
		});

		it.skip('reproduces issue #1254: should handle multiple ../ segments', () => {
			// User navigating up multiple levels
			// Project/SubA/SubB/../../../Tasks
			// Should normalize to: Tasks

			const folderPath = 'Project/SubA/SubB/../../../Tasks';
			const result = processFolderTemplate(folderPath, { date: testDate });

			expect(result).toBe('Tasks');
		});

		it.skip('reproduces issue #1254: should handle ../ at the beginning of path', () => {
			// Edge case: ../Tasks (relative to vault root)
			// Should normalize appropriately (or error gracefully)

			const folderPath = '../Tasks';
			const result = processFolderTemplate(folderPath, { date: testDate });

			// When ../ would go above vault root, it should be handled gracefully
			// Expected behavior: either "Tasks" or error - depends on implementation decision
			expect(result).toBe('Tasks');
		});

		it.skip('reproduces issue #1254: should handle mixed template variables and ../ ', () => {
			// Real-world scenario from the issue
			const folderPath = '{{currentNotePath}}/../Tasks/{{currentNoteTitle}}';

			// Simulate the substitution that happens in TaskService
			// {{currentNotePath}} -> "Project/Meetings"
			// {{currentNoteTitle}} -> "MeetingA"
			const processedPath = folderPath
				.replace(/\{\{currentNotePath\}\}/g, 'Project/Meetings')
				.replace(/\{\{currentNoteTitle\}\}/g, 'MeetingA');

			// Result: "Project/Meetings/../Tasks/MeetingA"

			// Now the folder template processor should normalize this
			const result = processFolderTemplate(processedPath, { date: testDate });

			expect(result).toBe('Project/Tasks/MeetingA');
		});

		it.skip('reproduces issue #1254: should normalize ../ with task variables', () => {
			// Combining ../ with task-specific variables
			const taskData: TaskTemplateData = {
				title: 'Review PR',
				priority: 'high',
				status: 'open',
				projects: ['web-app'],
			};

			const folderPath = 'Projects/web-app/Notes/../Tasks/{{priority}}';
			const result = processFolderTemplate(folderPath, {
				date: testDate,
				taskData,
			});

			// After variable substitution and normalization:
			// "Projects/web-app/Notes/../Tasks/high" -> "Projects/web-app/Tasks/high"
			expect(result).toBe('Projects/web-app/Tasks/high');
		});

		it.skip('reproduces issue #1254: should preserve trailing slash after normalization', () => {
			// Some users might want a trailing slash
			const folderPath = 'Project/Meetings/../Tasks/';
			const result = processFolderTemplate(folderPath, { date: testDate });

			expect(result).toBe('Project/Tasks/');
		});

		it.skip('reproduces issue #1254: should handle consecutive ../ segments', () => {
			// Edge case: Project/A/B/C/../../Tasks -> Project/A/Tasks
			const folderPath = 'Project/A/B/C/../../Tasks';
			const result = processFolderTemplate(folderPath, { date: testDate });

			expect(result).toBe('Project/A/Tasks');
		});

		it.skip('reproduces issue #1254: should handle ../ with ./ (current directory)', () => {
			// Mixed relative paths: Project/./Meetings/../Tasks
			const folderPath = 'Project/./Meetings/../Tasks';
			const result = processFolderTemplate(folderPath, { date: testDate });

			expect(result).toBe('Project/Tasks');
		});
	});

	describe('Combined Scenarios', () => {
		it.skip('reproduces issue #1254: should support both date in filename and ../ in folder', () => {
			// Full scenario from the issue:
			// - Folder template: {{currentNotePath}}/../Tasks/{{currentNoteTitle}}
			// - Filename template: {{date}} {{title}}
			// - Current note: Project/Meetings/MeetingA.md
			// - Task title: "Follow up with client"

			// Expected result:
			// - Folder: "Project/Tasks/MeetingA"
			// - Filename: "2025-01-15 Follow up with client.md"

			// Test the folder path normalization
			const folderPath = 'Project/Meetings/../Tasks/MeetingA';
			const normalizedFolder = processFolderTemplate(folderPath, { date: testDate });
			expect(normalizedFolder).toBe('Project/Tasks/MeetingA');

			// Test the filename generation with date
			const context: FilenameContext = {
				title: 'Follow up with client',
				priority: 'normal',
				status: 'open',
				date: testDate,
			};

			const settings = {
				...DEFAULT_SETTINGS,
				taskFilenameFormat: 'custom' as const,
				customFilenameTemplate: '{{date}} {{title}}',
				storeTitleInFilename: false,
			};

			const filename = generateTaskFilename(context, settings);
			expect(filename).toBe('2025-01-15 Follow up with client');
		});
	});
});
