import { ICSSubscriptionService } from '../../../src/services/ICSSubscriptionService';

// Mock Obsidian's dependencies
jest.mock('obsidian', () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	TFile: class TFile {
		path: string;
		extension: string;
		constructor(path: string) {
			this.path = path;
			this.extension = path.split('.').pop() || '';
		}
	}
}));

// Mock ical.js
jest.mock('ical.js', () => ({
	default: {
		parse: jest.fn(),
		Component: jest.fn(),
		Event: jest.fn(),
		Time: jest.fn(),
		TimezoneService: {
			register: jest.fn()
		}
	}
}));

/**
 * Issue #1569: Adding a local calendar (.ics file) fails
 *
 * Bug: When a user enters an absolute filesystem path for a local ICS file
 * (e.g., "/home/user/vault/Calendar.ics"), the plugin fails with "File not found"
 * even though the file exists on disk. This happens because:
 *
 * 1. `readLocalICSFile` uses `vault.getAbstractFileByPath()` which expects a
 *    vault-relative path (e.g., "Calendar.ics"), not an absolute OS path.
 * 2. The UI placeholder ("Calendar.ics") hints at vault-relative, but the label
 *    just says "File Path" which leads users to enter absolute paths.
 * 3. There is no path normalization or validation to convert absolute paths
 *    to vault-relative paths, nor any user-facing guidance.
 *
 * The user's .ics file was inside the vault at:
 *   Absolute: /home/photon/Syncthing/Obsidian/Notizen/TaskNotes/Sommersemester 2026/Kalender.ics
 *   Vault-relative: Sommersemester 2026/Kalender.ics (or similar)
 *
 * The user entered the absolute path, causing vault.getAbstractFileByPath() to
 * return null, triggering the "File not found" error.
 */
describe('Issue #1569 - Local ICS file path fails with absolute paths', () => {
	let service: ICSSubscriptionService;
	let mockPlugin: any;
	const { TFile } = require('obsidian');

	beforeEach(() => {
		mockPlugin = {
			loadData: jest.fn().mockResolvedValue({ icsSubscriptions: [] }),
			saveData: jest.fn().mockResolvedValue(undefined),
			app: {
				vault: {
					getAbstractFileByPath: jest.fn(),
					cachedRead: jest.fn(),
					getFiles: jest.fn().mockReturnValue([]),
					on: jest.fn(),
					offref: jest.fn(),
					adapter: {
						getBasePath: jest.fn().mockReturnValue('/home/photon/Syncthing/Obsidian/Notizen/TaskNotes')
					}
				}
			},
			i18n: {
				translate: jest.fn((key: string) => key)
			}
		};

		service = new ICSSubscriptionService(mockPlugin);
	});

	afterEach(() => {
		service.destroy();
	});

	it.skip('reproduces issue #1569 - absolute filesystem path should resolve to vault-relative path', async () => {
		// The user's vault is at: /home/photon/Syncthing/Obsidian/Notizen/TaskNotes
		// The .ics file is at: /home/photon/Syncthing/Obsidian/Notizen/TaskNotes/Sommersemester 2026/Kalender.ics
		// The vault-relative path would be: Sommersemester 2026/Kalender.ics

		const absolutePath = '/home/photon/Syncthing/Obsidian/Notizen/TaskNotes/Sommersemester 2026/Kalender.ics';
		const vaultRelativePath = 'Sommersemester 2026/Kalender.ics';

		// Mock: vault.getAbstractFileByPath returns null for absolute paths (current behavior)
		// but returns a file for vault-relative paths
		const mockFile = new TFile(vaultRelativePath);
		mockFile.extension = 'ics';

		mockPlugin.app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
			if (path === vaultRelativePath) return mockFile;
			return null; // absolute path won't match
		});

		mockPlugin.app.vault.cachedRead.mockResolvedValue(
			'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:test1\nDTSTART:20260301T120000Z\nSUMMARY:Test\nEND:VEVENT\nEND:VCALENDAR'
		);

		await service.initialize();

		// Add subscription with absolute path (as the user would)
		const subscription = await service.addSubscription({
			name: 'Studienkolleg SoSe 2026',
			filePath: absolutePath,
			type: 'local',
			enabled: true,
			color: '#ff8800',
			refreshInterval: 60
		});

		// Attempt to fetch - currently fails with "File not found"
		// FIX: Should strip the vault base path prefix and resolve to vault-relative path
		await service.fetchSubscription(subscription.id);

		// After fix, there should be no error
		const error = service.getLastError(subscription.id);
		expect(error).toBeUndefined();
	});

	it.skip('reproduces issue #1569 - should provide helpful error when file is outside the vault', async () => {
		// If the user enters a path to a file outside the vault, the error should explain
		// that local ICS files must be inside the vault
		const outsidePath = '/home/photon/Downloads/calendar.ics';

		mockPlugin.app.vault.getAbstractFileByPath.mockReturnValue(null);

		await service.initialize();

		const subscription = await service.addSubscription({
			name: 'External Calendar',
			filePath: outsidePath,
			type: 'local',
			enabled: true,
			color: '#ff0000',
			refreshInterval: 60
		});

		await service.fetchSubscription(subscription.id);

		const error = service.getLastError(subscription.id);
		// FIX: Error message should mention that the file must be inside the vault,
		// not just "File not found"
		expect(error).toBeDefined();
		expect(error).toContain('vault');
	});

	it.skip('reproduces issue #1569 - UI should use file suggester for local ICS path input', () => {
		// The current UI uses a plain text input with placeholder "Calendar.ics"
		// This doesn't help the user understand that:
		// 1. The path must be vault-relative
		// 2. The file must be inside the vault
		//
		// FIX: Should use Obsidian's file suggest modal (like FileSelectorModal)
		// to let the user pick from files in the vault, filtered to .ics extension
		//
		// This is a UI/integration test that would need Playwright or manual verification
		expect(true).toBe(true); // placeholder - see description above
	});
});
