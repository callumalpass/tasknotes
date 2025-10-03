/**
 * Test for GitHub Issue #789: Folder path truncation bug
 *
 * Bug Description:
 * The path fields for "Default tasks folder" and "Archive folder" allow entering long paths,
 * but sometimes lose characters at the end of the path when saving.
 * Example: "0 System/004 Plugin Data/TaskNotes/Archive" becomes
 *          "0 System/004 Plugin Data/TaskNotes/Archi"
 *
 * Root Cause Hypothesis:
 * The debounced save function with immediate=true may cause settings to be saved
 * before all onChange events are processed, especially when typing quickly or
 * pasting long paths.
 */

import { debounce } from '../../../src/settings/components/settingHelpers';

describe('Issue #789: Folder path truncation bug', () => {
	describe('Debounce behavior with immediate=true', () => {
		test('debounce with immediate=true should execute function immediately on first call', () => {
			const mockFn = jest.fn();
			const debouncedFn = debounce(mockFn, 500, true);

			debouncedFn('first');
			expect(mockFn).toHaveBeenCalledTimes(1);
			expect(mockFn).toHaveBeenCalledWith('first');
		});

		test('debounce with immediate=true should block rapid subsequent calls', () => {
			const mockFn = jest.fn();
			const debouncedFn = debounce(mockFn, 500, true);

			debouncedFn('first');
			debouncedFn('second');
			debouncedFn('third');

			// Only the first call should execute immediately
			expect(mockFn).toHaveBeenCalledTimes(1);
			expect(mockFn).toHaveBeenCalledWith('first');
		});

		test('debounce with immediate=true allows subsequent calls after timeout', async () => {
			const mockFn = jest.fn();
			const debouncedFn = debounce(mockFn, 100, true);

			debouncedFn('first');
			expect(mockFn).toHaveBeenCalledTimes(1);

			// Wait for debounce timeout
			await new Promise(resolve => setTimeout(resolve, 150));

			debouncedFn('second');
			expect(mockFn).toHaveBeenCalledTimes(2);
			expect(mockFn).toHaveBeenNthCalledWith(2, 'second');
		});

		test('reproduces the folder path truncation bug: rapid onChange events', () => {
			// Simulate settings object
			const settings = {
				archiveFolder: '',
			};

			// Simulate the debounced save function (immediate=true like in TaskNotesSettingTab)
			const saveFn = jest.fn(() => {
				// Save happens here - captures current settings state
			});
			const debouncedSave = debounce(saveFn, 500, true);

			// Simulate typing or pasting a long path with multiple onChange events
			const path = '0 System/004 Plugin Data/TaskNotes/Archive';
			const chunks = [
				'0 System/004 Plugin Data/TaskNotes/Archi',
				'0 System/004 Plugin Data/TaskNotes/Archive',
			];

			// Simulate rapid onChange events (like typing quickly or paste + autocomplete)
			chunks.forEach(chunk => {
				settings.archiveFolder = chunk;
				debouncedSave();
			});

			// The first save happens immediately with incomplete data
			expect(saveFn).toHaveBeenCalledTimes(1);

			// The second onChange is blocked by the debounce cooldown
			// This means the full path never gets saved!
			expect(settings.archiveFolder).toBe('0 System/004 Plugin Data/TaskNotes/Archive');
			// But saveFn was only called once, with the first (incomplete) value
		});
	});

	describe('Debounce behavior with immediate=false (trailing)', () => {
		test('debounce with immediate=false should wait for timeout before executing', async () => {
			const mockFn = jest.fn();
			const debouncedFn = debounce(mockFn, 100, false);

			debouncedFn('first');
			expect(mockFn).toHaveBeenCalledTimes(0);

			// Wait for debounce timeout
			await new Promise(resolve => setTimeout(resolve, 150));

			expect(mockFn).toHaveBeenCalledTimes(1);
			expect(mockFn).toHaveBeenCalledWith('first');
		});

		test('debounce with immediate=false should use the last value when called rapidly', async () => {
			const mockFn = jest.fn();
			const debouncedFn = debounce(mockFn, 100, false);

			debouncedFn('first');
			debouncedFn('second');
			debouncedFn('third');

			// No calls yet
			expect(mockFn).toHaveBeenCalledTimes(0);

			// Wait for debounce timeout
			await new Promise(resolve => setTimeout(resolve, 150));

			// Should only call once with the last value
			expect(mockFn).toHaveBeenCalledTimes(1);
			expect(mockFn).toHaveBeenCalledWith('third');
		});

		test('trailing debounce would prevent the folder path truncation bug', async () => {
			// Simulate settings object
			const settings = {
				archiveFolder: '',
			};

			const saveFn = jest.fn();
			// Use trailing debounce (immediate=false)
			const debouncedSave = debounce(saveFn, 100, false);

			// Simulate rapid onChange events
			const chunks = [
				'0 System/004 Plugin Data/TaskNotes/Archi',
				'0 System/004 Plugin Data/TaskNotes/Archive',
			];

			chunks.forEach(chunk => {
				settings.archiveFolder = chunk;
				debouncedSave();
			});

			// No save yet
			expect(saveFn).toHaveBeenCalledTimes(0);

			// Wait for debounce
			await new Promise(resolve => setTimeout(resolve, 150));

			// Should save once with the final complete value
			expect(saveFn).toHaveBeenCalledTimes(1);
			expect(settings.archiveFolder).toBe('0 System/004 Plugin Data/TaskNotes/Archive');
		});
	});
});
