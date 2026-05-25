import { z } from "zod";

jest.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
	StreamableHTTPServerTransport: jest.fn(),
}));

import { MCPService } from "../../../src/services/MCPService";

type ToolConfig = {
	description: string;
	inputSchema: z.ZodRawShape;
};

type CapturableMCPService = {
	getToolRegistrar(server: unknown): (
		name: string,
		config: ToolConfig,
		callback: (...args: never[]) => unknown
	) => void;
	registerFilterTools(server: unknown): void;
};

function getQueryInputSchema(): z.ZodObject<z.ZodRawShape> {
	const service = new MCPService(
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never,
		{} as never
	);
	const capturedTools: Array<{ name: string; config: ToolConfig }> = [];
	const capturableService = service as unknown as CapturableMCPService;

	capturableService.getToolRegistrar = () => (name, config) => {
		capturedTools.push({ name, config });
	};
	capturableService.registerFilterTools({});

	const queryTool = capturedTools.find((tool) => tool.name === "tasknotes_query_tasks");
	if (!queryTool) {
		throw new Error("tasknotes_query_tasks was not registered");
	}

	return z.object(queryTool.config.inputSchema);
}

describe("Issue #1943: MCP query operators", () => {
	it("accepts the hyphenated operators used by TaskNotes filters", () => {
		const schema = getQueryInputSchema();

		const result = schema.safeParse({
			conjunction: "and",
			children: [
				{
					type: "condition",
					id: "due-before",
					property: "due",
					operator: "is-before",
					value: "2026-01-01",
				},
				{
					type: "condition",
					id: "empty-tags",
					property: "tags",
					operator: "is-empty",
					value: null,
				},
			],
		});

		expect(result.success).toBe(true);
	});

	it("rejects the invalid operators previously shown in MCP instructions", () => {
		const schema = getQueryInputSchema();

		for (const operator of ["before", "after", "is_not", "is_empty"]) {
			const result = schema.safeParse({
				conjunction: "and",
				children: [
					{
						type: "condition",
						id: `invalid-${operator}`,
						property: "due",
						operator,
						value: "2026-01-01",
					},
				],
			});

			expect(result.success).toBe(false);
		}
	});
});
