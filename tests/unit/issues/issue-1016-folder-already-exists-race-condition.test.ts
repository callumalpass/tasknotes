/**
 * Test for GitHub Issue #1016: Unable to create tasks using some methods
 *
 * Bug Description:
 * When creating tasks via command palette, advanced calendar, or agenda views,
 * users get the error: "Failed to create task: Failed to create folder 'TaskNotes/Tasks': Folder already exists"
 *
 * Converting inline markdown tasks to TaskNotes tasks works fine.
 *
 * Root Cause Analysis:
 * The `ensureFolderExists()` function in src/utils/helpers.ts has a race condition:
 * 1. It checks if folder exists using `vault.getAbstractFileByPath()`
 * 2. If null, it calls `vault.createFolder()`
 * 3. But between the check and creation, another concurrent operation may have created the folder
 * 4. This causes Obsidian's vault API to throw "Folder already exists"
 *
 * Scenarios that trigger this:
 * - Plugin initialization creating view folders while user creates a task
 * - Multiple simultaneous task creation operations
 * - Race between vault cache update and folder creation
 *
 * The inline conversion works because it uses a different folder path based on
 * `inlineTaskConvertFolder` setting, which may already exist.
 */

import { ensureFolderExists } from '../../../src/utils/helpers';

// Mock obsidian module
jest.mock('obsidian');

describe('Issue #1016: Folder already exists race condition', () => {
	let mockVault: {
		getAbstractFileByPath: jest.Mock;
		createFolder: jest.Mock;
	};

	beforeEach(() => {
		// Mock normalizePath from obsidian
		const obsidianMock = require('obsidian');
		obsidianMock.normalizePath = jest.fn((path: string) => {
			if (!path) return '';
			return path
				.replace(/\\/g, '/')
				.replace(/\/+/g, '/')
				.replace(/^\/*/, '')
				.replace(/\/*$/, '');
		});

		mockVault = {
			getAbstractFileByPath: jest.fn(),
			createFolder: jest.fn().mockResolvedValue(undefined),
		};
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it.skip('reproduces issue #1016: race condition when folder is created between check and create', async () => {
		// This test reproduces the race condition described in issue #1016
		//
		// Scenario:
		// 1. User triggers task creation via command palette
		// 2. ensureFolderExists checks if "TaskNotes" exists -> returns null
		// 3. Before createFolder is called, another process creates "TaskNotes"
		// 4. createFolder fails with "Folder already exists"
		//
		// Expected behavior: ensureFolderExists should gracefully handle the
		// "Folder already exists" error since the goal (folder existing) is achieved

		// Simulate race condition: folder doesn't exist when checked,
		// but createFolder fails because it was created in the meantime
		mockVault.getAbstractFileByPath.mockReturnValue(null);
		mockVault.createFolder.mockRejectedValue(new Error('Folder already exists.'));

		// Currently this throws, but it should succeed (or at least not throw)
		// since the folder now exists which was the goal
		await expect(ensureFolderExists(mockVault as any, 'TaskNotes/Tasks')).resolves.not.toThrow();
	});

	it.skip('reproduces issue #1016: concurrent task creation operations cause folder conflict', async () => {
		// This test simulates multiple concurrent task creation operations
		// all trying to ensure the same folder exists
		//
		// This happens when:
		// - User rapidly creates multiple tasks
		// - Plugin initialization and task creation happen simultaneously
		// - Multiple views (calendar, agenda) creating tasks at the same time

		let folderCreated = false;

		mockVault.getAbstractFileByPath.mockImplementation(() => {
			// Initially folder doesn't exist, but may be created by another operation
			return folderCreated ? { path: 'TaskNotes/Tasks' } : null;
		});

		mockVault.createFolder.mockImplementation(async (path: string) => {
			if (path === 'TaskNotes') {
				if (folderCreated) {
					throw new Error('Folder already exists.');
				}
				// Simulate race: folder gets created by "another process"
				folderCreated = true;
			}
			if (path === 'TaskNotes/Tasks') {
				// This will fail if parent was just created by another process
				// due to timing issues
			}
		});

		// Two concurrent operations trying to ensure the folder exists
		const operation1 = ensureFolderExists(mockVault as any, 'TaskNotes/Tasks');
		const operation2 = ensureFolderExists(mockVault as any, 'TaskNotes/Tasks');

		// Both operations should succeed without throwing
		// Currently one of them may fail with "Folder already exists"
		await expect(Promise.all([operation1, operation2])).resolves.not.toThrow();
	});

	it.skip('reproduces issue #1016: plugin initialization races with task creation', async () => {
		// This test simulates the scenario where plugin initialization
		// is creating default view folders while the user creates a task
		//
		// Plugin initialization creates: TaskNotes/Views/...
		// Task creation needs: TaskNotes/Tasks
		// Both need to create the parent "TaskNotes" folder

		const existingFolders = new Set<string>();

		mockVault.getAbstractFileByPath.mockImplementation((path: string) => {
			return existingFolders.has(path) ? { path } : null;
		});

		mockVault.createFolder.mockImplementation(async (path: string) => {
			// Simulate small delay to allow race conditions
			await new Promise((resolve) => setTimeout(resolve, 1));

			if (existingFolders.has(path)) {
				throw new Error('Folder already exists.');
			}
			existingFolders.add(path);
		});

		// Simulate concurrent initialization and task creation
		const pluginInit = ensureFolderExists(mockVault as any, 'TaskNotes/Views');
		const taskCreation = ensureFolderExists(mockVault as any, 'TaskNotes/Tasks');

		// Both should succeed - the "Folder already exists" error for
		// "TaskNotes" parent folder should be handled gracefully
		await expect(Promise.all([pluginInit, taskCreation])).resolves.not.toThrow();
	});

	// This test shows the current behavior (which is the bug)
	it('demonstrates current behavior: throws on "Folder already exists" error', async () => {
		mockVault.getAbstractFileByPath.mockReturnValue(null);
		mockVault.createFolder.mockRejectedValue(new Error('Folder already exists.'));

		// Current behavior: throws an error wrapping the "Folder already exists" message
		await expect(ensureFolderExists(mockVault as any, 'TaskNotes/Tasks')).rejects.toThrow(
			'Failed to create folder "TaskNotes/Tasks": Folder already exists.'
		);
	});
});
