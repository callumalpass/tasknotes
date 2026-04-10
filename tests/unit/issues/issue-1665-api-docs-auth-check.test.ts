/**
 * Issue #1665: Settings panel reports API server as inaccessible when auth is enabled.
 *
 * Reported behavior:
 * - HTTP API is enabled and the local server is listening.
 * - An API auth token is configured.
 * - The integrations settings tab fetches `/api/docs` with no Authorization header.
 * - The server responds `401 Unauthorized`.
 * - The UI shows "API server not accessible" even though the server is up.
 *
 * This test documents the current reproduction and stays skipped so CI is unaffected.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1665
 */

import { loadAPIEndpoints } from "../../../src/api/loadAPIEndpoints";

describe("Issue #1665: authenticated API docs availability check", () => {
	it.skip("reproduces issue #1665", async () => {
		const container = document.createElement("div");
		const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
			ok: false,
			status: 401,
			statusText: "Unauthorized",
			json: async () => ({}),
		} as Response);

		await loadAPIEndpoints(container, 8080);

		// Current behavior: the settings panel probes `/api/docs` without auth and
		// interprets the 401 as the API server being unreachable.
		expect(fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/docs");
		expect(container.textContent).toContain("API server not accessible");
		expect(container.textContent).toContain("401: Unauthorized");

		// Expected behavior after a fix:
		// - use an auth-safe reachability check such as `/api/health`, or
		// - include the configured bearer token when fetching `/api/docs`.
	});
});
