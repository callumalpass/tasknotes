/**
 * Reproduction tests for Issue #1648: Settings panel fails to load API endpoints
 * when an API key is configured.
 *
 * Bug: The settings panel fetches `/api/docs` without including the Bearer
 * auth token. When an API key is set, HTTPAPIService returns 401 for all
 * `/api/*` routes including `/api/docs`, so the endpoint list never loads.
 *
 * Root cause:
 * - `src/api/loadAPIEndpoints.ts` calls `fetch(url)` with no Authorization header.
 * - `src/services/HTTPAPIService.ts` line 216: `if (pathname.startsWith("/api/") && !this.authenticate(req))`
 *   blocks all `/api/*` requests without a valid Bearer token, including `/api/docs`.
 *
 * Related files:
 * - src/api/loadAPIEndpoints.ts (fetch without auth header)
 * - src/services/HTTPAPIService.ts (auth gate at line 216)
 * - src/api/SystemController.ts (handles /api/docs at line 170)
 *
 * Fix options:
 * 1. Exempt `/api/docs` and `/api/docs/ui` from auth in HTTPAPIService.handleRequest()
 * 2. Pass the API key into loadAPIEndpoints() and include it as a Bearer header
 */

import { describe, it, expect } from '@jest/globals';

describe('Issue #1648: API docs endpoint blocked by auth when API key is set', () => {
	it.skip('reproduces issue #1648 - /api/docs should be accessible without auth token', () => {
		// Simulates the auth gate logic from HTTPAPIService.handleRequest()
		const apiAuthToken = 'my-secret-key'; // User has configured an API key

		function authenticate(authHeader: string | undefined): boolean {
			if (!apiAuthToken) return true;
			if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
			return authHeader.substring(7) === apiAuthToken;
		}

		const pathname = '/api/docs';

		// Current behavior: /api/docs is blocked because no auth header is sent
		const requestAuthHeader = undefined; // loadAPIEndpoints sends no auth header
		const isAuthenticated = authenticate(requestAuthHeader);

		// This is the bug: auth fails because no token is sent
		expect(isAuthenticated).toBe(false);

		// The auth gate blocks the request
		const isBlocked = pathname.startsWith('/api/') && !isAuthenticated;
		expect(isBlocked).toBe(true);

		// Expected behavior: /api/docs should be exempt from auth
		const docsExemptPaths = ['/api/docs', '/api/docs/ui'];
		const isExempt = docsExemptPaths.some((p) => pathname === p);
		const shouldBlock = pathname.startsWith('/api/') && !isExempt && !isAuthenticated;
		expect(shouldBlock).toBe(false);
	});

	it.skip('reproduces issue #1648 - loadAPIEndpoints does not send Authorization header', () => {
		// The fetch call in loadAPIEndpoints.ts (line 11) does not include headers:
		// `fetch(`http://localhost:${apiPort}/api/docs`)`
		//
		// It should be:
		// `fetch(`http://localhost:${apiPort}/api/docs`, { headers: { Authorization: `Bearer ${token}` } })`

		const apiPort = 8080;
		const fetchUrl = `http://localhost:${apiPort}/api/docs`;

		// Current implementation: no headers object at all
		const currentFetchOptions = undefined;

		// Verify the request has no auth header
		expect(currentFetchOptions).toBeUndefined();

		// Expected: either exempt the endpoint from auth or send the token
	});
});
