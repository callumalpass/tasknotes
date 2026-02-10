/**
 * Test for GitHub Issue #1016 / #1555: Folder already exists race condition
 *
 * Fix: ensureFolderExists() now uses vault.adapter.exists() (on-disk) instead
 * of vault.getAbstractFileByPath() (in-memory cache), and gracefully handles
 * createFolder errors when the folder was created concurrently.
 */

import { ensureFolderExists } from '../../../src/utils/helpers';

// Mock obsidian module
jest.mock('obsidian');

describe('Issue #1016: Folder already exists race condition', () => {
	let mockVault: {
		adapter: { exists: jest.Mock };
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
			adapter: { exists: jest.fn().mockResolvedValue(false) },
			createFolder: jest.fn().mockResolvedValue(undefined),
		};
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('handles race condition when folder is created between check and create', async () => {
		// Scenario: folder doesn't exist when checked, but createFolder fails
		// because another process created it in the meantime
		mockVault.adapter.exists.mockResolvedValue(false);
		mockVault.createFolder.mockRejectedValue(new Error('Folder already exists.'));

		// After createFolder fails, the retry check sees it now exists
		mockVault.adapter.exists
			.mockResolvedValueOnce(false)  // TaskNotes initial check
			.mockResolvedValueOnce(true)   // TaskNotes retry after error
			.mockResolvedValueOnce(false)  // TaskNotes/Tasks initial check
			.mockResolvedValueOnce(true);  // TaskNotes/Tasks retry after error

		await expect(ensureFolderExists(mockVault as any, 'TaskNotes/Tasks')).resolves.not.toThrow();
	});

	it('handles concurrent task creation operations without folder conflict', async () => {
		const existingFolders = new Set<string>();

		mockVault.adapter.exists.mockImplementation(async (path: string) => {
			return existingFolders.has(path);
		});

		mockVault.createFolder.mockImplementation(async (path: string) => {
			if (existingFolders.has(path)) {
				throw new Error('Folder already exists.');
			}
			existingFolders.add(path);
		});

		// Two concurrent operations trying to ensure the same folder exists
		const operation1 = ensureFolderExists(mockVault as any, 'TaskNotes/Tasks');
		const operation2 = ensureFolderExists(mockVault as any, 'TaskNotes/Tasks');

		// Both operations should succeed without throwing
		await expect(Promise.all([operation1, operation2])).resolves.not.toThrow();
	});

	it('handles plugin initialization racing with task creation', async () => {
		const existingFolders = new Set<string>();

		mockVault.adapter.exists.mockImplementation(async (path: string) => {
			return existingFolders.has(path);
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

	it('throws when folder creation fails and folder still does not exist', async () => {
		mockVault.adapter.exists.mockResolvedValue(false);
		mockVault.createFolder.mockRejectedValue(new Error('Disk full'));

		await expect(ensureFolderExists(mockVault as any, 'TaskNotes/Tasks')).rejects.toThrow(
			'Failed to create folder "TaskNotes"'
		);
	});
});
