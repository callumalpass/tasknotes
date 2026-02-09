/**
 * Skipped tests for Issue #1580: Failed to sync task to Google Calendar
 *
 * Bug: Google Calendar sync fails after OAuth token refresh returns HTTP 400
 *
 * Problem:
 * - User sets up Google Calendar sync via OAuth 2.0
 * - Works fine after initial connection
 * - After hours or days, moving scheduled tasks triggers error:
 *   "Failed to sync task to Google Calendar:
 *    Failed to update event: Failed to refresh google token: Request failed, status 400"
 * - Disconnecting and reconnecting fixes temporarily, but issue recurs
 *
 * Root cause analysis:
 * - HTTP 400 on token refresh typically indicates:
 *   1. Refresh token has been revoked (user revoked access in Google account)
 *   2. Refresh token has expired (Google refreshes tokens are long-lived but can expire)
 *   3. App credentials have changed (client_id/client_secret mismatch)
 *   4. The token grant type parameters are malformed
 *   5. Google has revoked access due to security policy (inactive app, suspicious activity)
 *   6. Refresh token was only valid once and has been consumed
 *
 * Current implementation (src/services/OAuthService.ts):
 * - refreshToken() method (lines 721-781) handles token refresh
 * - On failure, throws generic error: "Failed to refresh {provider} token: {message}"
 * - No special handling for 400 errors (invalid_grant)
 * - No automatic disconnection or prompt to reconnect
 * - Token refresh mutex prevents race conditions but doesn't handle revocation
 *
 * Related files:
 * - src/services/OAuthService.ts (token refresh logic, lines 721-820)
 * - src/services/GoogleCalendarService.ts (uses getValidToken for API calls)
 * - src/services/TaskCalendarSyncService.ts (syncs tasks, shows error notice)
 * - src/services/errors.ts (TokenExpiredError class)
 *
 * Potential fixes:
 * 1. Detect 400/invalid_grant errors and prompt user to reconnect
 * 2. Auto-disconnect on irrecoverable token errors
 * 3. Add retry logic for transient token errors (network issues)
 * 4. Store error state to prevent repeated failed refresh attempts
 * 5. Show more specific error message with reconnect action
 * 6. Implement token health check on plugin startup
 *
 * Google OAuth error codes reference:
 * - invalid_grant: Token has been revoked, expired, or is otherwise invalid
 * - invalid_client: Client authentication failed
 * - invalid_request: Missing required parameter
 *
 * See: https://developers.google.com/identity/protocols/oauth2/web-server#httprest_7
 */

import { describe, it, expect } from '@jest/globals';

describe('Issue #1580: Failed to sync task to Google Calendar - token refresh failure', () => {
	describe('Token refresh error handling', () => {
		it.skip('should detect invalid_grant error and prompt user to reconnect', () => {
			// Reproduces issue #1580
			// When Google returns 400 with invalid_grant, the refresh token is no longer valid
			// The current implementation throws a generic error that doesn't guide the user

			const googleErrorResponse = {
				error: 'invalid_grant',
				error_description: 'Token has been expired or revoked.',
			};

			// Current behavior: generic "Failed to refresh google token: Request failed, status 400"
			// Expected behavior: Detect invalid_grant and show "Google connection expired. Please reconnect."

			const isInvalidGrant = googleErrorResponse.error === 'invalid_grant';
			expect(isInvalidGrant).toBe(true);

			// Should trigger automatic disconnection and reconnect prompt
		});

		it.skip('should handle HTTP 400 token refresh errors specifically', () => {
			// Reproduces issue #1580
			// HTTP 400 errors on token refresh indicate the refresh token is invalid
			// This is different from network errors or server errors

			interface TokenRefreshError {
				status: number;
				body?: {
					error?: string;
					error_description?: string;
				};
			}

			const error400: TokenRefreshError = {
				status: 400,
				body: {
					error: 'invalid_grant',
					error_description: 'Token has been expired or revoked.',
				},
			};

			const error401: TokenRefreshError = {
				status: 401,
				body: {
					error: 'invalid_client',
					error_description: 'Client authentication failed.',
				},
			};

			const isIrrecoverableTokenError = (err: TokenRefreshError) => {
				return err.status === 400 || err.status === 401;
			};

			expect(isIrrecoverableTokenError(error400)).toBe(true);
			expect(isIrrecoverableTokenError(error401)).toBe(true);

			// Irrecoverable errors should:
			// 1. Clear stored tokens
			// 2. Mark connection as disconnected
			// 3. Show reconnect prompt to user
		});

		it.skip('should auto-disconnect on irrecoverable token errors', () => {
			// Reproduces issue #1580
			// When token refresh fails with 400, continuing to retry is pointless
			// Should disconnect and prompt user

			interface OAuthConnection {
				provider: string;
				tokens: {
					accessToken: string;
					refreshToken: string;
					expiresAt: number;
				};
				userEmail?: string;
				connectedAt: string;
			}

			let connection: OAuthConnection | null = {
				provider: 'google',
				tokens: {
					accessToken: 'expired-access-token',
					refreshToken: 'revoked-refresh-token',
					expiresAt: Date.now() - 3600000, // Expired 1 hour ago
				},
				userEmail: 'user@example.com',
				connectedAt: new Date().toISOString(),
			};

			const handleIrrecoverableTokenError = async () => {
				// Clear stored connection
				connection = null;
				// Emit event for UI to show reconnect prompt
				return { disconnected: true, reason: 'token_revoked' };
			};

			// Simulate token refresh failure with 400
			const refreshFailed = true;
			const errorStatus = 400;

			if (refreshFailed && errorStatus === 400) {
				handleIrrecoverableTokenError();
			}

			expect(connection).toBeNull();
		});
	});

	describe('Error message clarity', () => {
		it.skip('should show actionable error message when token is revoked', () => {
			// Reproduces issue #1580
			// Current error: "Failed to sync task to Google Calendar: Failed to update event: Failed to refresh google token: Request failed, status 400"
			// This is confusing and doesn't tell user what to do

			const currentErrorMessage =
				'Failed to sync task to Google Calendar: Failed to update event: Failed to refresh google token: Request failed, status 400';

			// Expected error message
			const expectedErrorMessage =
				'Google Calendar connection expired. Please reconnect in Settings > Integrations.';

			// Error message should be:
			// 1. Clear about what went wrong
			// 2. Actionable (tells user what to do)
			// 3. Not overly technical

			expect(expectedErrorMessage.length).toBeLessThan(currentErrorMessage.length);
			expect(expectedErrorMessage).toContain('reconnect');
			expect(expectedErrorMessage).toContain('Settings');
		});

		it.skip('should provide different messages for different token error types', () => {
			// Reproduces issue #1580
			// Different error causes need different user guidance

			type TokenErrorType =
				| 'revoked'      // User revoked access in Google account
				| 'expired'     // Refresh token naturally expired
				| 'credentials' // App credentials changed
				| 'network'     // Temporary network issue
				| 'unknown';    // Unknown cause

			const getErrorMessage = (errorType: TokenErrorType): string => {
				switch (errorType) {
					case 'revoked':
						return 'Google access was revoked. Please reconnect your account.';
					case 'expired':
						return 'Google connection expired. Please reconnect your account.';
					case 'credentials':
						return 'Plugin configuration changed. Please reconnect your Google account.';
					case 'network':
						return 'Network error. Please check your connection and try again.';
					default:
						return 'Google Calendar sync failed. Please try reconnecting your account.';
				}
			};

			expect(getErrorMessage('revoked')).toContain('revoked');
			expect(getErrorMessage('network')).toContain('Network');
			expect(getErrorMessage('unknown')).toContain('reconnect');
		});
	});

	describe('Preventing repeated failures', () => {
		it.skip('should not spam user with repeated token refresh failures', () => {
			// Reproduces issue #1580
			// When token refresh fails, every subsequent API call will also fail
			// Should cache the failure state to prevent error spam

			interface TokenState {
				lastRefreshAttempt?: number;
				lastRefreshError?: string;
				refreshFailureCount: number;
			}

			const tokenState: TokenState = {
				refreshFailureCount: 0,
			};

			const RETRY_DELAY_MS = 60000; // 1 minute between retry attempts

			const shouldAttemptRefresh = (state: TokenState): boolean => {
				if (state.lastRefreshError === 'invalid_grant') {
					// Don't retry invalid_grant - need user intervention
					return false;
				}
				if (state.lastRefreshAttempt) {
					const timeSinceLastAttempt = Date.now() - state.lastRefreshAttempt;
					if (timeSinceLastAttempt < RETRY_DELAY_MS) {
						return false;
					}
				}
				return true;
			};

			// First failure
			tokenState.lastRefreshAttempt = Date.now();
			tokenState.lastRefreshError = 'invalid_grant';
			tokenState.refreshFailureCount = 1;

			// Second attempt immediately - should be blocked
			expect(shouldAttemptRefresh(tokenState)).toBe(false);

			// Clear error (user reconnected)
			tokenState.lastRefreshError = undefined;
			tokenState.refreshFailureCount = 0;

			// Should allow refresh again
			expect(shouldAttemptRefresh(tokenState)).toBe(true);
		});

		it.skip('should show error notice only once until user acknowledges', () => {
			// Reproduces issue #1580
			// Multiple tasks syncing simultaneously could show multiple error notices
			// Should deduplicate error notifications

			class ErrorNotificationManager {
				private shownErrors = new Set<string>();

				showOnce(errorKey: string, message: string): boolean {
					if (this.shownErrors.has(errorKey)) {
						return false; // Already shown
					}
					this.shownErrors.add(errorKey);
					// new Notice(message);
					return true;
				}

				clear(errorKey: string): void {
					this.shownErrors.delete(errorKey);
				}
			}

			const manager = new ErrorNotificationManager();

			// First error - should show
			const shown1 = manager.showOnce('google_token_expired', 'Google connection expired');
			expect(shown1).toBe(true);

			// Second error (from another sync) - should not show
			const shown2 = manager.showOnce('google_token_expired', 'Google connection expired');
			expect(shown2).toBe(false);

			// User reconnects - clear error
			manager.clear('google_token_expired');

			// New error after reconnect - should show
			const shown3 = manager.showOnce('google_token_expired', 'Google connection expired');
			expect(shown3).toBe(true);
		});
	});

	describe('Token health monitoring', () => {
		it.skip('should check token health on plugin startup', () => {
			// Reproduces issue #1580
			// Proactively check if token is valid when plugin loads
			// Better UX than waiting for first sync to fail

			interface TokenHealth {
				isValid: boolean;
				expiresIn?: number;
				needsRefresh: boolean;
				error?: string;
			}

			const checkTokenHealth = async (
				accessToken: string,
				refreshToken: string,
				expiresAt: number
			): Promise<TokenHealth> => {
				const now = Date.now();
				const bufferMs = 5 * 60 * 1000; // 5 minutes

				if (expiresAt - bufferMs < now) {
					// Token expired or expiring soon
					if (!refreshToken) {
						return {
							isValid: false,
							needsRefresh: false,
							error: 'No refresh token available',
						};
					}
					return {
						isValid: false,
						needsRefresh: true,
					};
				}

				return {
					isValid: true,
					expiresIn: expiresAt - now,
					needsRefresh: false,
				};
			};

			// Valid token
			const validHealth = checkTokenHealth(
				'valid-access-token',
				'valid-refresh-token',
				Date.now() + 3600000 // Expires in 1 hour
			);
			expect(validHealth).resolves.toMatchObject({
				isValid: true,
				needsRefresh: false,
			});

			// Expired token with refresh token
			const expiredHealth = checkTokenHealth(
				'expired-access-token',
				'valid-refresh-token',
				Date.now() - 1000 // Already expired
			);
			expect(expiredHealth).resolves.toMatchObject({
				isValid: false,
				needsRefresh: true,
			});
		});

		it.skip('should proactively refresh tokens before they expire', () => {
			// Reproduces issue #1580
			// Don't wait until token is completely expired
			// Refresh proactively with buffer time

			const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

			interface OAuthTokens {
				accessToken: string;
				refreshToken: string;
				expiresAt: number;
			}

			const shouldProactivelyRefresh = (tokens: OAuthTokens): boolean => {
				const now = Date.now();
				return tokens.expiresAt - TOKEN_REFRESH_BUFFER_MS < now;
			};

			// Token expires in 10 minutes - don't refresh yet
			const healthyToken: OAuthTokens = {
				accessToken: 'token',
				refreshToken: 'refresh',
				expiresAt: Date.now() + 10 * 60 * 1000,
			};
			expect(shouldProactivelyRefresh(healthyToken)).toBe(false);

			// Token expires in 3 minutes - refresh proactively
			const expiringToken: OAuthTokens = {
				accessToken: 'token',
				refreshToken: 'refresh',
				expiresAt: Date.now() + 3 * 60 * 1000,
			};
			expect(shouldProactivelyRefresh(expiringToken)).toBe(true);
		});
	});

	describe('Recovery scenarios', () => {
		it.skip('should recover gracefully after reconnection', () => {
			// Reproduces issue #1580
			// After user reconnects, all pending syncs should resume

			interface SyncQueue {
				pendingTasks: string[];
				failedTasks: string[];
				status: 'active' | 'paused' | 'error';
			}

			const queue: SyncQueue = {
				pendingTasks: ['task1.md', 'task2.md', 'task3.md'],
				failedTasks: [],
				status: 'active',
			};

			// Simulate token failure
			const handleTokenFailure = () => {
				queue.status = 'error';
				queue.failedTasks = [...queue.pendingTasks];
				queue.pendingTasks = [];
			};

			// Simulate reconnection
			const handleReconnection = () => {
				queue.status = 'active';
				// Move failed tasks back to pending for retry
				queue.pendingTasks = [...queue.failedTasks];
				queue.failedTasks = [];
			};

			handleTokenFailure();
			expect(queue.status).toBe('error');
			expect(queue.failedTasks).toHaveLength(3);

			handleReconnection();
			expect(queue.status).toBe('active');
			expect(queue.pendingTasks).toHaveLength(3);
			expect(queue.failedTasks).toHaveLength(0);
		});

		it.skip('should not lose task-event mappings during token errors', () => {
			// Reproduces issue #1580
			// Task-to-event ID mappings should persist even when sync fails
			// So when user reconnects, existing events are updated not duplicated

			interface TaskEventMapping {
				taskPath: string;
				eventId: string;
			}

			const mappings: TaskEventMapping[] = [
				{ taskPath: 'tasks/task1.md', eventId: 'google-event-123' },
				{ taskPath: 'tasks/task2.md', eventId: 'google-event-456' },
			];

			// Token failure should NOT clear mappings
			const handleTokenFailure = () => {
				// Don't touch mappings - they're stored in task frontmatter
				return { mappingsCleared: false };
			};

			const result = handleTokenFailure();
			expect(result.mappingsCleared).toBe(false);
			expect(mappings).toHaveLength(2);

			// When reconnected, sync should update existing events
			const getExistingEventId = (taskPath: string): string | undefined => {
				const mapping = mappings.find(m => m.taskPath === taskPath);
				return mapping?.eventId;
			};

			expect(getExistingEventId('tasks/task1.md')).toBe('google-event-123');
		});
	});
});

describe('Issue #1580: Google OAuth token lifecycle', () => {
	it.skip('should understand Google refresh token expiration policies', () => {
		// Reproduces issue #1580
		// Google refresh tokens can expire under certain conditions

		/**
		 * Google refresh token expiration scenarios:
		 * 1. User revokes access in Google Account settings
		 * 2. Token hasn't been used for 6 months (inactive)
		 * 3. User changes password (in some cases)
		 * 4. Google project OAuth consent is set to "Testing" mode
		 *    - Tokens expire after 7 days unless app is verified
		 * 5. Maximum 100 refresh tokens per user per client
		 *    - Oldest token is invalidated when limit is exceeded
		 */

		interface TokenExpirationScenario {
			reason: string;
			recoverable: boolean;
			userAction: string;
		}

		const scenarios: TokenExpirationScenario[] = [
			{
				reason: 'User revoked access',
				recoverable: true,
				userAction: 'Reconnect Google account in settings',
			},
			{
				reason: 'Token inactive for 6 months',
				recoverable: true,
				userAction: 'Reconnect Google account in settings',
			},
			{
				reason: 'Testing mode token expired (7 days)',
				recoverable: true,
				userAction: 'Reconnect or verify app in Google Cloud Console',
			},
			{
				reason: 'Too many tokens issued',
				recoverable: true,
				userAction: 'Reconnect Google account in settings',
			},
		];

		// All scenarios are recoverable by reconnecting
		expect(scenarios.every(s => s.recoverable)).toBe(true);
		expect(scenarios.every(s => s.userAction.includes('Reconnect'))).toBe(true);
	});

	it.skip('should handle Google OAuth testing mode 7-day expiration', () => {
		// Reproduces issue #1580
		// If the Google Cloud project is in "Testing" mode (not verified),
		// refresh tokens expire after 7 days

		const TESTING_MODE_TOKEN_LIFETIME_DAYS = 7;
		const tokenIssuedAt = new Date('2025-01-01');
		const now = new Date('2025-01-09'); // 8 days later

		const daysSinceIssued = Math.floor(
			(now.getTime() - tokenIssuedAt.getTime()) / (1000 * 60 * 60 * 24)
		);

		const isTokenExpiredInTestingMode =
			daysSinceIssued >= TESTING_MODE_TOKEN_LIFETIME_DAYS;

		expect(daysSinceIssued).toBe(8);
		expect(isTokenExpiredInTestingMode).toBe(true);

		// This could explain why tokens work initially but fail after "a few hours or days"
		// If user connected on day 1, token expires on day 8
	});
});

describe('Issue #1580: Suggested implementation improvements', () => {
	it.skip('should implement TokenExpiredError detection in refreshToken', () => {
		// Reproduces issue #1580
		// Current implementation doesn't distinguish between error types

		const detectTokenError = (error: { status?: number; body?: { error?: string } }) => {
			if (error.status === 400) {
				const errorCode = error.body?.error;
				if (errorCode === 'invalid_grant') {
					return { type: 'token_revoked', needsReconnect: true };
				}
				if (errorCode === 'invalid_client') {
					return { type: 'credentials_invalid', needsReconnect: true };
				}
			}
			if (error.status === 401) {
				return { type: 'unauthorized', needsReconnect: true };
			}
			if (error.status && error.status >= 500) {
				return { type: 'server_error', needsReconnect: false };
			}
			return { type: 'unknown', needsReconnect: true };
		};

		// Test various error responses
		expect(detectTokenError({ status: 400, body: { error: 'invalid_grant' } }))
			.toEqual({ type: 'token_revoked', needsReconnect: true });

		expect(detectTokenError({ status: 500 }))
			.toEqual({ type: 'server_error', needsReconnect: false });
	});

	it.skip('should clear connection and emit event on irrecoverable error', () => {
		// Reproduces issue #1580
		// When token refresh fails with 400, should clean up and notify UI

		type ConnectionEvent =
			| { type: 'connected'; provider: string }
			| { type: 'disconnected'; provider: string; reason: string }
			| { type: 'error'; provider: string; error: string };

		const events: ConnectionEvent[] = [];

		const emitEvent = (event: ConnectionEvent) => {
			events.push(event);
		};

		const handleIrrecoverableTokenError = (provider: string, errorMessage: string) => {
			// 1. Clear stored tokens (would call deleteConnection in real impl)
			// 2. Emit disconnection event
			emitEvent({
				type: 'disconnected',
				provider,
				reason: 'token_revoked',
			});
			// 3. Emit error event for UI to show reconnect prompt
			emitEvent({
				type: 'error',
				provider,
				error: errorMessage,
			});
		};

		handleIrrecoverableTokenError('google', 'Token has been expired or revoked');

		expect(events).toHaveLength(2);
		expect(events[0].type).toBe('disconnected');
		expect(events[1].type).toBe('error');
	});
});
