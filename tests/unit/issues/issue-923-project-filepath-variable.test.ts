/**
 * Tests for issue #923: New folder template variable for project file path
 *
 * Feature request: Users want a variable like {{projectFilePath}} that returns the full
 * file path of the task's project, enabling organization of tasks into project-specific
 * folders that mirror the project's location in the vault.
 *
 * Use case: When projects are organized in different vault locations
 * (e.g., "Work/Projects/ProjectA", "Personal/Projects/ProjectB"),
 * users want tasks to be placed in corresponding subfolders.
 *
 * Current behavior:
 * - {{project}} returns only the project basename (e.g., "ProjectA")
 * - No variable exists to get the full project file path
 *
 * Expected behavior:
 * - {{projectFilePath}} returns the full path without extension (e.g., "Work/Projects/ProjectA")
 * - {{projectFilePaths}} returns all project paths joined with /
 * - Should handle wikilinks: "[[Work/Projects/ProjectA]]" -> "Work/Projects/ProjectA"
 *
 * @see https://github.com/obsidian-tasknotes/tasknotes/issues/923
 */

import { processFolderTemplate, TaskTemplateData } from '../../../src/utils/folderTemplateProcessor';

describe('Issue #923: Project file path template variable', () => {
	describe('{{projectFilePath}} variable', () => {
		it.skip('reproduces issue #923: should support {{projectFilePath}} for full project path', () => {
			// User wants to organize tasks into project-specific folders
			// matching the project's location in the vault
			const taskData: TaskTemplateData = {
				title: 'Review documentation',
				// Project is located at Work/Projects/ProjectA.md in the vault
				projects: ['[[Work/Projects/ProjectA]]'],
			};

			// Current workaround would require manually setting folder
			// User wants: Tasks/{{projectFilePath}} to yield "Tasks/Work/Projects/ProjectA"

			// This test documents the expected behavior once implemented
			const result = processFolderTemplate('Tasks/{{projectFilePath}}', {
				taskData,
				// A function to extract full path (without .md extension) from project reference
				// This would need to be added to FolderTemplateOptions
			});

			// Expected: Task is placed in folder matching project's vault location
			expect(result).toBe('Tasks/Work/Projects/ProjectA');
		});

		it.skip('reproduces issue #923: should handle plain project paths without wikilinks', () => {
			const taskData: TaskTemplateData = {
				title: 'Fix bug',
				projects: ['Personal/ProjectB'],
			};

			const result = processFolderTemplate('{{projectFilePath}}/Tasks', {
				taskData,
			});

			expect(result).toBe('Personal/ProjectB/Tasks');
		});

		it.skip('reproduces issue #923: should handle display name wikilinks', () => {
			// Wikilinks can have display names: [[path|Display Name]]
			const taskData: TaskTemplateData = {
				title: 'Update README',
				projects: ['[[Projects/Work/ClientProject|Client Project]]'],
			};

			const result = processFolderTemplate('{{projectFilePath}}', {
				taskData,
			});

			// Should extract the path, not the display name
			expect(result).toBe('Projects/Work/ClientProject');
		});

		it.skip('reproduces issue #923: should use first project path when multiple projects exist', () => {
			const taskData: TaskTemplateData = {
				title: 'Multi-project task',
				projects: ['[[Work/Alpha]]', '[[Personal/Beta]]'],
			};

			const result = processFolderTemplate('{{projectFilePath}}/todos', {
				taskData,
			});

			// Should use first project's full path
			expect(result).toBe('Work/Alpha/todos');
		});
	});

	describe('{{projectFilePaths}} variable (plural)', () => {
		it.skip('reproduces issue #923: should support {{projectFilePaths}} for all project paths', () => {
			const taskData: TaskTemplateData = {
				title: 'Shared task',
				projects: ['[[Work/Alpha]]', '[[Personal/Beta]]'],
			};

			const result = processFolderTemplate('{{projectFilePaths}}', {
				taskData,
			});

			// All project paths joined with /
			expect(result).toBe('Work/Alpha/Personal/Beta');
		});
	});

	describe('comparison with existing {{project}} variable', () => {
		it('{{project}} only returns basename (current behavior)', () => {
			const taskData: TaskTemplateData = {
				projects: ['[[Work/Projects/MyProject]]'],
			};

			// extractProjectBasename simulates the current behavior
			const extractBasename = (project: string) => {
				const match = project.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
				if (match) {
					const parts = match[1].split('/');
					return parts[parts.length - 1];
				}
				return project;
			};

			const result = processFolderTemplate('{{project}}', {
				taskData,
				extractProjectBasename: extractBasename,
			});

			// Current behavior: only returns "MyProject", not the full path
			expect(result).toBe('MyProject');
		});

		it.skip('reproduces issue #923: {{projectFilePath}} should return full path unlike {{project}}', () => {
			const taskData: TaskTemplateData = {
				projects: ['[[Work/Projects/MyProject]]'],
			};

			// The key difference between {{project}} and {{projectFilePath}}:
			// - {{project}} returns: "MyProject" (basename only)
			// - {{projectFilePath}} returns: "Work/Projects/MyProject" (full path)

			const projectResult = processFolderTemplate('{{project}}', {
				taskData,
				extractProjectBasename: (p) => {
					const match = p.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
					return match ? match[1].split('/').pop()! : p;
				},
			});

			const filePathResult = processFolderTemplate('{{projectFilePath}}', {
				taskData,
				// New option would be needed: extractProjectFilePath
			});

			expect(projectResult).toBe('MyProject');
			expect(filePathResult).toBe('Work/Projects/MyProject');
		});
	});

	describe('edge cases', () => {
		it.skip('reproduces issue #923: should return empty string when no projects', () => {
			const taskData: TaskTemplateData = {
				title: 'No project task',
				projects: [],
			};

			const result = processFolderTemplate('Tasks/{{projectFilePath}}', {
				taskData,
			});

			expect(result).toBe('Tasks/');
		});

		it.skip('reproduces issue #923: should sanitize paths for folder safety', () => {
			const taskData: TaskTemplateData = {
				projects: ['[[Work/Project<>:"/\\|?*Special]]'],
			};

			const result = processFolderTemplate('{{projectFilePath}}', {
				taskData,
			});

			// Special characters should be sanitized
			expect(result).toBe('Work/Project_________Special');
		});

		it.skip('reproduces issue #923: should handle root-level projects', () => {
			// Project file is at vault root (no folder path)
			const taskData: TaskTemplateData = {
				projects: ['[[RootProject]]'],
			};

			const result = processFolderTemplate('{{projectFilePath}}/Tasks', {
				taskData,
			});

			expect(result).toBe('RootProject/Tasks');
		});
	});
});
