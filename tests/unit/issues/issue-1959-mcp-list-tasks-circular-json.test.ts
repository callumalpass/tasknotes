jest.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
	StreamableHTTPServerTransport: jest.fn(),
}));

import { MCPService } from "../../../src/services/MCPService";

type ToolConfig = {
	description: string;
	inputSchema: Record<string, unknown>;
};

type ToolResult = {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
};

type ToolCallback = (args: { limit?: number; offset?: number }) => Promise<ToolResult>;

type CapturableMCPService = {
	getToolRegistrar(server: unknown): (
		name: string,
		config: ToolConfig,
		callback: ToolCallback
	) => void;
	registerTaskTools(server: unknown): void;
};

function getListTasksCallback(tasks: unknown[]): ToolCallback {
	const service = new MCPService(
		{} as never,
		{} as never,
		{} as never,
		{
			getAllTasks: jest.fn(async () => tasks),
		} as never,
		{} as never,
		{} as never,
		{} as never
	);
	const capturedTools: Array<{ name: string; callback: ToolCallback }> = [];
	const capturableService = service as unknown as CapturableMCPService;

	capturableService.getToolRegistrar = () => (name, _config, callback) => {
		capturedTools.push({ name, callback });
	};
	capturableService.registerTaskTools({});

	const listTool = capturedTools.find((tool) => tool.name === "tasknotes_list_tasks");
	if (!listTool) {
		throw new Error("tasknotes_list_tasks was not registered");
	}

	return listTool.callback;
}

describe("Issue #1959: MCP list tasks circular JSON", () => {
	it("returns task JSON when cached task data contains circular internal values", async () => {
		const customProperty: Record<string, unknown> = { label: "review" };
		customProperty.self = customProperty;

		const basesData: Record<string, unknown> = { path: "Tasks/Circular.md" };
		basesData.self = basesData;

		const callback = getListTasksCallback([
			{
				title: "Circular task",
				status: "open",
				priority: "normal",
				path: "Tasks/Circular.md",
				archived: false,
				customProperties: {
					source: customProperty,
				},
				basesData,
			},
		]);

		const result = await callback({});

		expect(result.isError).not.toBe(true);
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed.tasks).toHaveLength(1);
		expect(parsed.tasks[0].customProperties.source).toEqual({ label: "review" });
		expect(parsed.tasks[0]).not.toHaveProperty("basesData");
	});

	it("omits live Obsidian object references from custom task values", async () => {
		class ObsidianLikeApp {
			appMenuBarManager = { app: this };
			vault = { name: "test-vault" };
		}

		const callback = getListTasksCallback([
			{
				title: "Task with app reference",
				status: "open",
				priority: "normal",
				path: "Tasks/App.md",
				archived: false,
				customProperties: {
					source: { label: "review" },
					app: new ObsidianLikeApp(),
				},
			},
		]);

		const result = await callback({});

		expect(result.isError).not.toBe(true);
		const parsed = JSON.parse(result.content[0].text);
		expect(parsed.tasks[0].customProperties.source).toEqual({ label: "review" });
		expect(parsed.tasks[0].customProperties).not.toHaveProperty("app");
		expect(result.content[0].text).not.toContain("appMenuBarManager");
	});
});
