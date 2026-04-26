import { normalizeMcpInitializeProtocol } from "../../../src/services/mcpProtocol";

describe("Issue #1778: MCP initialize protocol negotiation", () => {
	it("downgrades newer initialize protocol versions to TaskNotes' supported version", () => {
		const body = {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-11-25",
				capabilities: {},
				clientInfo: { name: "claude-desktop", version: "current" },
			},
		};

		normalizeMcpInitializeProtocol(body);

		expect(body.params.protocolVersion).toBe("2025-06-18");
	});

	it("leaves supported initialize protocol versions unchanged", () => {
		const body = {
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-06-18",
				capabilities: {},
				clientInfo: { name: "test-client", version: "1.0.0" },
			},
		};

		normalizeMcpInitializeProtocol(body);

		expect(body.params.protocolVersion).toBe("2025-06-18");
	});

	it("handles batched messages without changing non-initialize requests", () => {
		const body = [
			{
				jsonrpc: "2.0",
				id: 1,
				method: "tools/list",
				params: { protocolVersion: "2025-11-25" },
			},
			{
				jsonrpc: "2.0",
				id: 2,
				method: "initialize",
				params: {
					protocolVersion: "2025-11-25",
					capabilities: {},
					clientInfo: { name: "test-client", version: "1.0.0" },
				},
			},
		];

		normalizeMcpInitializeProtocol(body);

		expect(body[0].params.protocolVersion).toBe("2025-11-25");
		expect(body[1].params.protocolVersion).toBe("2025-06-18");
	});
});
