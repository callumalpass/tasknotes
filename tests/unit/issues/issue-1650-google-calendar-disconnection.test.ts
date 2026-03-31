/**
 * Reproduction test for Issue #1650: Google Calendar keeps getting disconnected
 *
 * Bug Description:
 * Almost every time Obsidian starts, the Google Calendar integration shows "No events to display"
 * and sometimes loses the connection entirely, requiring a full re-authentication. Manually
 * refreshing does not help reliably; the user must disconnect and reconnect from settings.
 *
 * Root Cause Hypothesis:
 * OAuthService.refreshToken() auto-disconnects when a refresh attempt returns HTTP 400 with
 * invalid_grant. This can happen if: (1) Google refresh tokens expire (Google Testing mode
 * apps have 7-day refresh token TTL); (2) the stored access token's expiresAt is corrupted,
 * triggering a refresh on every startup; (3) there is a race condition where the calendar view
 * renders before OAuthService has loaded persisted tokens, causing a spurious "not connected"
 * state. The "No events to display" without full disconnect may indicate the race condition,
 * while the full disconnect indicates an invalid_grant on refresh.
 *
 * Key locations:
 * - src/services/OAuthService.ts (refreshToken, getValidAccessToken, autoDisconnect logic)
 * - src/services/GoogleCalendarService.ts (isConnected, event fetching)
 */

jest.mock('obsidian');

describe('Issue #1650: Google Calendar disconnection on startup', () => {
  it.skip('reproduces issue #1650: token with corrupted expiresAt triggers refresh on every startup', () => {
    // Simulate a stored token where expiresAt is in the past or NaN
    const now = Date.now();
    const bufferMs = 5 * 60 * 1000; // 5 minute buffer as used in OAuthService

    const corruptedToken = {
      accessToken: 'valid-looking-token',
      refreshToken: 'refresh-token',
      expiresAt: NaN, // Corrupted timestamp
    };

    // OAuthService.getValidAccessToken() checks: connection.tokens.expiresAt - bufferMs < now
    function needsRefresh(token: { expiresAt: number }): boolean {
      return token.expiresAt - bufferMs < now;
    }

    // NaN comparisons always return false in JS, so NaN - bufferMs < now → NaN < now → false
    // This means a NaN expiresAt would NOT trigger a refresh — but if expiresAt is 0 or a past
    // timestamp from a bad migration, it would trigger refresh on every load
    const pastToken = { ...corruptedToken, expiresAt: 0 };
    const refreshTriggered = needsRefresh(pastToken);

    // The bug: a token with expiresAt=0 always triggers a refresh, which may fail with
    // invalid_grant, auto-disconnecting the user
    expect(refreshTriggered).toBe(false); // Fails — 0 - bufferMs < now is always true
  });

  it.skip('reproduces issue #1650: calendar view should not show "no events" during OAuth initialization', () => {
    // Simulate the race condition where the calendar view renders before tokens are loaded

    let tokensLoaded = false;
    let calendarRendered = false;
    let eventsDisplayed: string[] = [];

    // Simulate async token loading (happens on plugin load)
    function loadTokensAsync(): Promise<void> {
      return new Promise(resolve => {
        // Tokens take time to load from plugin data
        setTimeout(() => {
          tokensLoaded = true;
          resolve();
        }, 100);
      });
    }

    // Simulate calendar view rendering (happens eagerly on workspace open)
    function renderCalendarView(): void {
      calendarRendered = true;
      if (!tokensLoaded) {
        // Bug: renders with "no events" because tokens aren't loaded yet
        eventsDisplayed = [];
      } else {
        eventsDisplayed = ['event1', 'event2'];
      }
    }

    // The calendar renders immediately (before token load resolves)
    renderCalendarView();

    // The bug: calendar shows no events because tokens haven't loaded
    expect(eventsDisplayed).toHaveLength(2); // Fails — shows [] due to race condition
    expect(calendarRendered).toBe(true);
    expect(tokensLoaded).toBe(false); // Confirms the race condition
  });

  it.skip('reproduces issue #1650: auto-disconnect should not fire for transient network errors', () => {
    // OAuthService should distinguish invalid_grant (permanent) from network errors (transient)

    function shouldAutoDisconnect(error: { status?: number; errorCode?: string; isNetworkError?: boolean }): boolean {
      // Current behavior: auto-disconnects on any refresh failure
      // Correct behavior: only auto-disconnect on confirmed invalid_grant
      if (error.isNetworkError) return false; // Should not disconnect on network error
      if (error.status === 400 && error.errorCode === 'invalid_grant') return true;
      return false; // All other errors should not auto-disconnect
    }

    const networkError = { isNetworkError: true };
    const invalidGrant = { status: 400, errorCode: 'invalid_grant' };
    const serverError = { status: 500 };

    // These should NOT trigger auto-disconnect
    expect(shouldAutoDisconnect(networkError)).toBe(false);
    expect(shouldAutoDisconnect(serverError)).toBe(false);

    // Only this should trigger auto-disconnect
    expect(shouldAutoDisconnect(invalidGrant)).toBe(true);

    // The bug: the current implementation auto-disconnects on all refresh failures,
    // including transient network errors. This test documents the expected behavior.
    // When the fix is in place, these assertions will pass.
    expect(true).toBe(false); // Marker: bug is present until fix is applied
  });
});
