/**
 * Issue #1004 / PR #1346: HTTP Basic auth for ICS calendar subscriptions.
 *
 * The username is stored with the subscription; the password lives in
 * Obsidian SecretStorage and must never reach data.json. Credentials are
 * only sent over HTTPS.
 */
import { requestUrl } from 'obsidian';
import {
	ICSSubscriptionService,
	ICSInsecureAuthError,
	buildICSRequestHeaders,
} from '../../../src/services/ICSSubscriptionService';
import { ICSSecretStore, getICSPasswordSecretId } from '../../../src/services/ICSSecretStore';

jest.mock('obsidian', () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	TFile: jest.fn(),
}));

jest.mock('ical.js', () => ({
	...jest.requireActual('ical.js'),
}));

const mockRequestUrl = requestUrl as jest.MockedFunction<typeof requestUrl>;

const ICS_BODY = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:event-1
SUMMARY:Private event
DTSTART:20250115T100000Z
DTEND:20250115T110000Z
END:VEVENT
END:VCALENDAR`;

class InMemorySecretStorage {
	readonly values = new Map<string, string>();
	getSecret(id: string): string | null {
		return this.values.get(id) ?? null;
	}
	setSecret(id: string, value: string): void {
		this.values.set(id, value);
	}
}

function decodeBasic(header: string): string {
	const binary = atob(header.replace(/^Basic /, ''));
	return new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
}

function createService(secretStorage?: InMemorySecretStorage) {
	let persisted: Record<string, unknown> = { icsSubscriptions: [] };
	const plugin: any = {
		loadData: jest.fn(async () => persisted),
		loadPluginDataForSafeWrite: jest.fn(async () => JSON.parse(JSON.stringify(persisted))),
		saveData: jest.fn(async (data: Record<string, unknown>) => {
			persisted = JSON.parse(JSON.stringify(data));
		}),
		emitter: { trigger: jest.fn() },
		app: { vault: { on: jest.fn(), offref: jest.fn(), getFiles: jest.fn(() => []) } },
		i18n: { translate: jest.fn((descriptor: { id?: string }) => descriptor.id ?? '') },
	};
	const service = new ICSSubscriptionService(plugin, new ICSSecretStore(secretStorage));
	return { service, plugin, getPersisted: () => JSON.stringify(persisted) };
}

const remoteAuthSubscription = {
	name: 'Nextcloud',
	url: 'https://cloud.example.com/remote.php/dav/calendars/user/personal/?export',
	type: 'remote' as const,
	color: '#4285f4',
	enabled: true,
	refreshInterval: 60,
	authType: 'basic' as const,
	username: 'jürgen',
};

describe('Issue #1004: ICS subscription Basic auth', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockRequestUrl.mockResolvedValue({ status: 200, text: ICS_BODY } as any);
	});

	it('encodes non-Latin-1 credentials as UTF-8 in the Authorization header', () => {
		const headers = buildICSRequestHeaders(
			{ url: remoteAuthSubscription.url, authType: 'basic', username: '用户jürgen' },
			'pässwörd🔒'
		);
		expect(decodeBasic(headers.Authorization)).toBe('用户jürgen:pässwörd🔒');
	});

	it('sends no Authorization header for unauthenticated subscriptions', () => {
		const headers = buildICSRequestHeaders({ url: 'http://example.com/a.ics' }, null);
		expect(headers.Authorization).toBeUndefined();
	});

	it.each(['http://cloud.example.com/cal.ics', 'webcal://cloud.example.com/cal.ics', 'not a url'])(
		'refuses to build credentials for non-HTTPS URL %s',
		(url) => {
			expect(() =>
				buildICSRequestHeaders({ url, authType: 'basic', username: 'u' }, 'p')
			).toThrow(ICSInsecureAuthError);
		}
	);

	it('does not send a request when an authenticated feed uses plain HTTP', async () => {
		const storage = new InMemorySecretStorage();
		const { service, plugin } = createService(storage);
		const sub = await service.addSubscription({
			...remoteAuthSubscription,
			url: 'http://cloud.example.com/cal.ics',
		});
		await service.setPassword(sub.id, 'secret');

		expect(mockRequestUrl).not.toHaveBeenCalled();
		expect(service.getLastError(sub.id)).toMatch(/https/);
		expect(plugin.emitter.trigger).toHaveBeenCalled();
		service.destroy();
	});

	it('keeps the password out of plugin data and sends it from SecretStorage', async () => {
		const storage = new InMemorySecretStorage();
		const { service, getPersisted } = createService(storage);
		const sub = await service.addSubscription(remoteAuthSubscription);
		await service.setPassword(sub.id, 'top-secret-pw');

		expect(getPersisted()).not.toContain('top-secret-pw');
		expect(getPersisted()).toContain('jürgen');
		expect(storage.getSecret(getICSPasswordSecretId(sub.id))).toBe('top-secret-pw');

		const lastCall = mockRequestUrl.mock.calls.at(-1)?.[0] as { headers: Record<string, string> };
		expect(decodeBasic(lastCall.headers.Authorization)).toBe('jürgen:top-secret-pw');
		service.destroy();
	});

	it('removes the stored password when the subscription is deleted', async () => {
		const storage = new InMemorySecretStorage();
		const { service } = createService(storage);
		const sub = await service.addSubscription(remoteAuthSubscription);
		await service.setPassword(sub.id, 'top-secret-pw');

		await service.removeSubscription(sub.id);

		expect(storage.getSecret(getICSPasswordSecretId(sub.id))).toBe('');
		expect(service.hasPassword(sub.id)).toBe(false);
		service.destroy();
	});

	it('refuses to save a password when SecretStorage is unavailable', async () => {
		const { service, getPersisted } = createService(undefined);
		const sub = await service.addSubscription(remoteAuthSubscription);

		expect(service.isPasswordStorageAvailable()).toBe(false);
		await expect(service.setPassword(sub.id, 'top-secret-pw')).rejects.toThrow(/SecretStorage/);
		expect(getPersisted()).not.toContain('top-secret-pw');
		service.destroy();
	});
});
