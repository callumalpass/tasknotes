import { ICSSubscriptionService } from '../../../src/services/ICSSubscriptionService';

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

jest.mock('ical.js', () => ({
	...jest.requireActual('ical.js')
}));

describe('Remote ICS file:// protocol support', () => {
	let service: ICSSubscriptionService;
	let mockPlugin: any;
	const { TFile, requestUrl } = require('obsidian');

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
						getBasePath: jest.fn().mockReturnValue('/home/photon/Vault')
					}
				}
			},
			i18n: {
				translate: jest.fn((key: string) => key)
			}
		};

		service = new ICSSubscriptionService(mockPlugin);
		requestUrl.mockReset();
	});

	afterEach(() => {
		service.destroy();
	});

	it('reads file:// remote subscriptions from vault files without network fetch', async () => {
		const absolutePath = '/home/photon/Vault/Calendars/Team Calendar.ics';
		const fileUrl = 'file:///home/photon/Vault/Calendars/Team%20Calendar.ics';
		const vaultRelativePath = 'Calendars/Team Calendar.ics';

		const mockFile = new TFile(vaultRelativePath);
		mockFile.extension = 'ics';

		mockPlugin.app.vault.getAbstractFileByPath.mockImplementation((resolvedPath: string) => {
			if (resolvedPath === vaultRelativePath) {
				return mockFile;
			}
			if (resolvedPath === absolutePath) {
				return null;
			}
			return null;
		});

		mockPlugin.app.vault.cachedRead.mockResolvedValue(
			'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:test-file-protocol\nDTSTART:20260610T120000Z\nDTEND:20260610T130000Z\nSUMMARY:File Protocol Event\nEND:VEVENT\nEND:VCALENDAR'
		);

		await service.initialize();

		const subscription = await service.addSubscription({
			name: 'File Protocol Calendar',
			url: fileUrl,
			type: 'remote',
			enabled: true,
			color: '#42a5f5',
			refreshInterval: 60
		});

		expect(requestUrl).not.toHaveBeenCalled();
		expect(mockPlugin.app.vault.getAbstractFileByPath).toHaveBeenCalledWith(vaultRelativePath);
		expect(service.getLastError(subscription.id)).toBeUndefined();

		const events = service.getAllEvents();
		expect(events).toHaveLength(1);
		expect(events[0].title).toBe('File Protocol Event');
	});
});
