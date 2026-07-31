import { requestUrl } from "obsidian";
import { loadAPIEndpoints } from "../../../src/api/loadAPIEndpoints";

const requestUrlMock = requestUrl as jest.Mock;

function mockOpenAPIResponse(status: number) {
	return {
		status,
		headers: {},
		arrayBuffer: new ArrayBuffer(0),
		text: "",
		json: {
			paths: {
				"/api/health": {
					get: {
						tags: ["System"],
						summary: "Health check",
					},
				},
			},
		},
	};
}

describe("Issue #1665: authenticated API docs availability check", () => {
	beforeEach(() => {
		requestUrlMock.mockReset();
	});

	it("loads API endpoints with the configured bearer token instead of reporting 401 as inaccessible", async () => {
		const container = document.createElement("div");
		requestUrlMock.mockResolvedValue(mockOpenAPIResponse(200));

		await loadAPIEndpoints(container, 8080, { apiAuthToken: "secret-token" });

		expect(requestUrlMock).toHaveBeenCalledWith({
			url: "http://localhost:8080/api/docs",
			throw: false,
			headers: {
				Authorization: "Bearer secret-token",
			},
		});
		expect(container.textContent).toContain("GET /api/health - Health check");
		expect(container.textContent).not.toContain("API server not accessible");
	});
});
