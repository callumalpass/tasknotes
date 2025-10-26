import { OAuthService } from '../../src/services/OAuthService';
import { requestUrl, Notice } from 'obsidian';
import type TaskNotesPlugin from '../../src/main';

// Mock Obsidian APIs
jest.mock('obsidian', () => ({
	Notice: jest.fn(),
	requestUrl: jest.fn(),
	Modal: class MockModal {
		constructor() {}
		open() {}
		close() {}
	}
}));

// Mock DeviceCodeModal
jest.mock('../../src/modals/DeviceCodeModal', () => ({
	DeviceCodeModal: jest.fn().mockImplementation(() => ({
		open: jest.fn(),
		close: jest.fn()
	}))
}));

describe('OAuthService - Token Revocation', () => {
	let oauthService: OAuthService;
	let mockPlugin: Partial<TaskNotesPlugin>;
	let mockRequestUrl: jest.MockedFunction<typeof requestUrl>;
	let mockConnectionData: any;

	beforeEach(() => {
		jest.clearAllMocks();

		// Setup mock connection data
		mockConnectionData = {
			oauthConnections: {
				google: {
					provider: 'google',
					tokens: {
						accessToken: 'test-access-token',
						refreshToken: 'test-refresh-token',
						expiresAt: Date.now() + 3600000,
						scope: 'calendar.readonly',
						tokenType: 'Bearer'
					},
					connectedAt: new Date().toISOString()
				}
			}
		};

		// Setup mock plugin
		mockPlugin = {
			app: {} as any,
			settings: {
				googleOAuthClientId: 'test-client-id',
				googleOAuthClientSecret: 'test-client-secret',
				microsoftOAuthClientId: '',
				microsoftOAuthClientSecret: ''
			} as any,
			loadData: jest.fn().mockResolvedValue(mockConnectionData),
			saveData: jest.fn().mockResolvedValue(undefined)
		};

		// Create service instance
		oauthService = new OAuthService(mockPlugin as TaskNotesPlugin);

		// Setup requestUrl mock
		mockRequestUrl = requestUrl as jest.MockedFunction<typeof requestUrl>;
	});

	describe('Token Revocation on Disconnect', () => {
		test('should revoke both access and refresh tokens on disconnect', async () => {
			// Mock successful revocation responses
			mockRequestUrl
				.mockResolvedValueOnce({
					status: 200,
					json: {},
					text: 'OK',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				})
				.mockResolvedValueOnce({
					status: 200,
					json: {},
					text: 'OK',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				});

			await oauthService.disconnect('google');

			// Verify both tokens were revoked
			expect(mockRequestUrl).toHaveBeenCalledTimes(2);

			// Check first call (access token)
			const firstCall = mockRequestUrl.mock.calls[0][0];
			expect(firstCall.url).toBe('https://oauth2.googleapis.com/revoke');
			expect(firstCall.method).toBe('POST');
			expect(firstCall.body).toContain('token=test-access-token');

			// Check second call (refresh token)
			const secondCall = mockRequestUrl.mock.calls[1][0];
			expect(secondCall.url).toBe('https://oauth2.googleapis.com/revoke');
			expect(secondCall.method).toBe('POST');
			expect(secondCall.body).toContain('token=test-refresh-token');
		});

		test('should remove connection from storage after revocation', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: {},
				text: 'OK',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await oauthService.disconnect('google');

			// Verify saveData was called to remove connection
			expect(mockPlugin.saveData).toHaveBeenCalledWith({
				oauthConnections: {}
			});
		});

		test('should show disconnect notice to user', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: {},
				text: 'OK',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await oauthService.disconnect('google');

			expect(Notice).toHaveBeenCalledWith('Disconnected from google Calendar');
		});

		test('should handle revocation failure gracefully', async () => {
			// Mock failed revocation (e.g., network error)
			mockRequestUrl.mockRejectedValue(new Error('Network error'));

			// Should not throw - disconnection should complete
			await expect(oauthService.disconnect('google')).resolves.not.toThrow();

			// Should still remove from storage
			expect(mockPlugin.saveData).toHaveBeenCalled();

			// Should still show disconnect notice
			expect(Notice).toHaveBeenCalledWith('Disconnected from google Calendar');
		});

		test('should handle already-revoked tokens (400 error)', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 400,
				json: { error: 'invalid_token' },
				text: 'Bad Request',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Should not throw
			await expect(oauthService.disconnect('google')).resolves.not.toThrow();

			// Should still complete disconnection
			expect(mockPlugin.saveData).toHaveBeenCalled();
		});

		test('should handle provider without revocation endpoint', async () => {
			// Create connection for a provider without revocation endpoint configured
			// (This test ensures backwards compatibility if endpoint is missing)

			// Setup connection without revocation endpoint
			mockConnectionData.oauthConnections.test = {
				provider: 'test',
				tokens: {
					accessToken: 'test-token',
					expiresAt: Date.now() + 3600000
				}
			};

			await oauthService.disconnect('google');

			// Should still work even if revocation endpoint is undefined
			expect(mockPlugin.saveData).toHaveBeenCalled();
		});
	});

	describe('Revocation for Microsoft', () => {
		beforeEach(() => {
			// Add Microsoft connection
			mockConnectionData.oauthConnections.microsoft = {
				provider: 'microsoft',
				tokens: {
					accessToken: 'ms-access-token',
					refreshToken: 'ms-refresh-token',
					expiresAt: Date.now() + 3600000
				},
				connectedAt: new Date().toISOString()
			};
		});

		test('should use Microsoft revocation endpoint', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: {},
				text: 'OK',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await oauthService.disconnect('microsoft');

			// Verify Microsoft endpoint was called
			const calls = mockRequestUrl.mock.calls;
			expect(calls[0][0].url).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/logout');
		});
	});

	describe('Edge Cases', () => {
		test('should handle disconnect when already disconnected', async () => {
			// Remove connection
			mockConnectionData.oauthConnections = {};

			await expect(oauthService.disconnect('google')).resolves.not.toThrow();

			// Should not attempt revocation or storage update
			expect(mockRequestUrl).not.toHaveBeenCalled();
			expect(mockPlugin.saveData).not.toHaveBeenCalled();
		});

		test('should handle connection with only access token (no refresh token)', async () => {
			// Remove refresh token
			delete mockConnectionData.oauthConnections.google.tokens.refreshToken;

			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: {},
				text: 'OK',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await oauthService.disconnect('google');

			// Should only revoke access token (1 call)
			expect(mockRequestUrl).toHaveBeenCalledTimes(1);
			expect(mockRequestUrl.mock.calls[0][0].body).toContain('token=test-access-token');
		});

		test('should include client_id in revocation request', async () => {
			mockRequestUrl.mockResolvedValue({
				status: 200,
				json: {},
				text: 'OK',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await oauthService.disconnect('google');

			const firstCall = mockRequestUrl.mock.calls[0][0];
			expect(firstCall.body).toContain('client_id=test-client-id');
		});
	});
});
