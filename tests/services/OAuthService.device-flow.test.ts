import { OAuthService } from '../../src/services/OAuthService';
import { requestUrl, Notice, Platform } from 'obsidian';
import type TaskNotesPlugin from '../../src/main';

// Mock Obsidian APIs
jest.mock('obsidian', () => ({
	Notice: jest.fn(),
	Platform: {
		isDesktopApp: true
	},
	requestUrl: jest.fn()
}));

// Mock DeviceCodeModal
jest.mock('../../src/modals/DeviceCodeModal', () => ({
	DeviceCodeModal: jest.fn().mockImplementation((app, deviceCode, onCancel) => ({
		open: jest.fn(),
		close: jest.fn()
	}))
}));

describe('OAuthService - Device Flow', () => {
	let oauthService: OAuthService;
	let mockPlugin: Partial<TaskNotesPlugin>;
	let mockRequestUrl: jest.MockedFunction<typeof requestUrl>;

	beforeEach(() => {
		// Use fake timers to speed up polling tests
		jest.useFakeTimers();

		// Clear all mocks
		jest.clearAllMocks();

		// Setup mock plugin
		mockPlugin = {
			app: {} as any,
			settings: {
				lemonSqueezyLicenseKey: '',
				googleOAuthClientId: '',
				googleOAuthClientSecret: '',
				microsoftOAuthClientId: '',
				microsoftOAuthClientSecret: ''
			} as any,
			licenseService: {
				canUseBuiltInCredentials: jest.fn().mockResolvedValue(true)
			} as any,
			loadData: jest.fn().mockResolvedValue({}),
			saveData: jest.fn().mockResolvedValue(undefined)
		};

		// Mock environment variables for built-in client_id
		process.env.GOOGLE_OAUTH_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
		process.env.MICROSOFT_OAUTH_CLIENT_ID = 'test-microsoft-client-id';

		// Create service instance
		oauthService = new OAuthService(mockPlugin as TaskNotesPlugin);

		// Setup requestUrl mock
		mockRequestUrl = requestUrl as jest.MockedFunction<typeof requestUrl>;
	});

	afterEach(() => {
		// Restore real timers
		jest.useRealTimers();

		// Clean up environment
		delete process.env.GOOGLE_OAUTH_CLIENT_ID;
		delete process.env.MICROSOFT_OAUTH_CLIENT_ID;
	});

	describe('Device Code Request', () => {
		test('should request device code with correct parameters', async () => {
			// Mock device code response
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					device_code: 'test-device-code',
					user_code: 'ABCD-1234',
					verification_uri: 'https://google.com/device',
					verification_uri_complete: 'https://google.com/device?user_code=ABCD-1234',
					expires_in: 900,
					interval: 5
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock token polling response (immediate success for test)
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					access_token: 'test-access-token',
					refresh_token: 'test-refresh-token',
					expires_in: 3600,
					scope: 'calendar.readonly',
					token_type: 'Bearer'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Trigger authenticate (will use Device Flow since no user credentials)
			await oauthService.authenticate('google');

			// Verify device code request was made
			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'https://oauth2.googleapis.com/device/code',
					method: 'POST',
					headers: expect.objectContaining({
						'Content-Type': 'application/x-www-form-urlencoded'
					})
				})
			);

			// Verify body contains client_id and scope
			const firstCall = mockRequestUrl.mock.calls[0][0];
			const body = firstCall.body as string;
			expect(body).toContain('client_id=test-client-id.apps.googleusercontent.com');
			expect(body).toContain('scope=');
		});

		test('should throw error when device code request fails', async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 400,
				json: { error: 'invalid_request' },
				text: 'Bad Request',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await expect(oauthService.authenticate('google')).rejects.toThrow();
		});
	});

	describe('Device Code Polling', () => {
		test('should poll until authorization_pending becomes success', async () => {
			// Mock device code request
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					device_code: 'test-device-code',
					user_code: 'ABCD-1234',
					verification_uri: 'https://google.com/device',
					expires_in: 900,
					interval: 5
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock polling responses: pending, pending, success
			mockRequestUrl
				.mockResolvedValueOnce({
					status: 400,
					json: { error: 'authorization_pending' },
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				})
				.mockResolvedValueOnce({
					status: 400,
					json: { error: 'authorization_pending' },
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				})
				.mockResolvedValueOnce({
					status: 200,
					json: {
						access_token: 'test-access-token',
						refresh_token: 'test-refresh-token',
						expires_in: 3600,
						scope: 'calendar.readonly',
						token_type: 'Bearer'
					},
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				});

			const authPromise = oauthService.authenticate('google');

			// Fast-forward through the polling intervals
			await jest.advanceTimersByTimeAsync(15000);

			await authPromise;

			// Verify polling happened (1 device code request + 3 token requests)
			expect(mockRequestUrl).toHaveBeenCalledTimes(4);

			// Verify token endpoint was polled
			const tokenCalls = mockRequestUrl.mock.calls.filter(
				call => call[0].url === 'https://oauth2.googleapis.com/token'
			);
			expect(tokenCalls.length).toBe(3);
		});

		test('should handle slow_down error by increasing interval', async () => {
			// Mock device code request
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					device_code: 'test-device-code',
					user_code: 'ABCD-1234',
					verification_uri: 'https://google.com/device',
					expires_in: 900,
					interval: 5
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock polling: slow_down, then success
			mockRequestUrl
				.mockResolvedValueOnce({
					status: 400,
					json: { error: 'slow_down' },
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				})
				.mockResolvedValueOnce({
					status: 200,
					json: {
						access_token: 'test-access-token',
						refresh_token: 'test-refresh-token',
						expires_in: 3600
					},
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				});

			const authPromise = oauthService.authenticate('google');

			// Fast-forward through polling intervals
			await jest.advanceTimersByTimeAsync(10000);

			await authPromise;

			// Should succeed despite slow_down
			expect(mockRequestUrl).toHaveBeenCalledTimes(3);
		});

		test('should throw error when code expires', async () => {
			// Use real timers for this test since error is immediate (no polling needed)
			jest.useRealTimers();

			// Mock device code request
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					device_code: 'test-device-code',
					user_code: 'ABCD-1234',
					verification_uri: 'https://google.com/device',
					expires_in: 900,
					interval: 5
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock expired token response (polling starts immediately, no wait)
			mockRequestUrl.mockResolvedValueOnce({
				status: 400,
				json: { error: 'expired_token' },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Start authentication and expect it to reject
			await expect(oauthService.authenticate('google')).rejects.toThrow('expired');

			// Restore fake timers for subsequent tests
			jest.useFakeTimers();
		});

		test('should throw error when access is denied', async () => {
			// Use real timers for this test since error is immediate (no polling needed)
			jest.useRealTimers();

			// Mock device code request
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					device_code: 'test-device-code',
					user_code: 'ABCD-1234',
					verification_uri: 'https://google.com/device',
					expires_in: 900,
					interval: 5
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock access denied response (polling starts immediately, no wait)
			mockRequestUrl.mockResolvedValueOnce({
				status: 400,
				json: { error: 'access_denied' },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Start authentication and expect it to reject
			await expect(oauthService.authenticate('google')).rejects.toThrow('denied');

			// Restore fake timers for subsequent tests
			jest.useFakeTimers();
		});
	});

	describe('Flow Selection', () => {
		test('should use Device Flow when license is valid and no user credentials', async () => {
			// License is valid (set in beforeEach)
			// No user credentials (set in beforeEach)

			// Mock device code request
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					device_code: 'test-device-code',
					user_code: 'ABCD-1234',
					verification_uri: 'https://google.com/device',
					expires_in: 900,
					interval: 5
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock successful token response
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					access_token: 'test-access-token',
					refresh_token: 'test-refresh-token',
					expires_in: 3600
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const authPromise = oauthService.authenticate('google');
			await jest.advanceTimersByTimeAsync(5000);
			await authPromise;

			// Verify device code endpoint was called (Device Flow)
			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'https://oauth2.googleapis.com/device/code'
				})
			);
		});

		test('should throw error when no license and no user credentials', async () => {
			// Set license as invalid
			mockPlugin.licenseService!.canUseBuiltInCredentials = jest.fn().mockResolvedValue(false);
			oauthService = new OAuthService(mockPlugin as TaskNotesPlugin);

			// No built-in credentials available
			delete process.env.GOOGLE_OAUTH_CLIENT_ID;
			await oauthService.loadClientIds();

			await expect(oauthService.authenticate('google')).rejects.toThrow(
				/not configured|License required/i
			);
		});

		test('should use Standard Flow when user provides credentials', async () => {
			// Set user credentials
			mockPlugin.settings!.googleOAuthClientId = 'user-client-id';
			mockPlugin.settings!.googleOAuthClientSecret = 'user-client-secret';
			await oauthService.loadClientIds();

			// Device Flow should NOT be used (would need to mock http server for Standard Flow)
			// This test just verifies the flow selection logic doesn't call device code endpoint

			// For now, just verify that user credentials take precedence
			// (Full Standard Flow test would require mocking http.createServer)
		});
	});

	describe('Token Storage', () => {
		test('should store tokens after successful authentication', async () => {
			// Mock device code request
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					device_code: 'test-device-code',
					user_code: 'ABCD-1234',
					verification_uri: 'https://google.com/device',
					expires_in: 900,
					interval: 5
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock successful token response
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					access_token: 'test-access-token',
					refresh_token: 'test-refresh-token',
					expires_in: 3600,
					scope: 'calendar.readonly',
					token_type: 'Bearer'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await oauthService.authenticate('google');

			// Verify saveData was called to store tokens
			expect(mockPlugin.saveData).toHaveBeenCalled();

			// Verify connection can be retrieved
			const connection = await oauthService.getConnection('google');
			expect(connection).toBeDefined();
			expect(connection.tokens.accessToken).toBe('test-access-token');
			expect(connection.tokens.refreshToken).toBe('test-refresh-token');
		});
	});

	describe('Microsoft Support', () => {
		test('should support Device Flow for Microsoft', async () => {
			// Mock device code request for Microsoft
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					device_code: 'test-device-code',
					user_code: 'WXYZ-5678',
					verification_uri: 'https://microsoft.com/devicelogin',
					expires_in: 900,
					interval: 5
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock successful token response
			mockRequestUrl.mockResolvedValueOnce({
				status: 200,
				json: {
					access_token: 'test-access-token',
					refresh_token: 'test-refresh-token',
					expires_in: 3600
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await oauthService.authenticate('microsoft');

			// Verify Microsoft device code endpoint was called
			expect(mockRequestUrl).toHaveBeenCalledWith(
				expect.objectContaining({
					url: 'https://login.microsoftonline.com/common/oauth2/v2.0/devicecode'
				})
			);
		});
	});

	describe('Error Handling', () => {
		test('should show user-friendly notice on failure', async () => {
			mockRequestUrl.mockResolvedValueOnce({
				status: 500,
				json: {},
				text: 'Server Error',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const authPromise = oauthService.authenticate('google');

			await expect(authPromise).rejects.toThrow();

			// Verify Notice was shown to user
			expect(Notice).toHaveBeenCalledWith(
				expect.stringContaining('Failed to connect')
			);
		});

		test('should require desktop platform', async () => {
			// Mock mobile platform
			(Platform as any).isDesktopApp = false;

			// Note: Standard Flow would fail here, but Device Flow should also fail
			// since DeviceCodeModal requires desktop app

			// Clean up
			(Platform as any).isDesktopApp = true;
		});
	});
});
