import { buildAPIEndpointsDocsRequest } from "../../../src/api/loadAPIEndpoints";

describe("Issue #1648: API docs endpoint request auth", () => {
	it("includes the configured bearer token when loading API docs from settings", () => {
		expect(
			buildAPIEndpointsDocsRequest(8080, {
				apiAuthToken: "my-secret-key",
			})
		).toEqual({
			url: "http://localhost:8080/api/docs",
			throw: false,
			headers: {
				Authorization: "Bearer my-secret-key",
			},
		});
	});

	it("omits the Authorization header when API auth is not configured", () => {
		expect(buildAPIEndpointsDocsRequest(8080)).toEqual({
			url: "http://localhost:8080/api/docs",
			throw: false,
		});
	});
});
