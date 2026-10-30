import { z } from "zod";

jest.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
	StreamableHTTPServerTransport: jest.fn(),
}));

import { MCPService } from "../../../src/services/MCPService";
import type { TaskDependency, TaskInfo } from "../../../src/types";

type ToolConfig = {
	description: string;
	inputSchema: z.ZodRawShape;
};

type ToolResult = {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
};

type ToolCallback = (args: Record<string, unknown>) => Promise<ToolResult>;

type CapturedTool = {
	name: string;
	config: ToolConfig;
	callback: ToolCallback;
};

type CapturableMCPService = {
	getToolRegistrar(server: unknown): (
		name: string,
		config: ToolConfig,
		callback: ToolCallback
	) => void;
	registerTaskTools(server: unknown): void;
};

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "MCP dependencies",
		status: "open",
		priority: "normal",
		path: "Tasks/mcp-dependencies.md",
		archived: false,
		...overrides,
	};
}

function captureTaskTools(options: {
	taskService?: Partial<{
		createTask: jest.Mock;
		updateTask: jest.Mock;
	}>;
	cacheManager?: Partial<{
		getTaskInfo: jest.Mock;
	}>;
	pluginSettings?: Record<string, unknown>;
} = {}): CapturedTool[] {
	const service = new MCPService(
		{
			settings: {
				defaultTaskStatus: "open",
				defaultTaskPriority: "normal",
				...(options.pluginSettings ?? {}),
			},
		} as never,
		options.taskService as never,
		{} as never,
		options.cacheManager as never,
		{} as never,
		{} as never,
		{} as never
	);
	const capturedTools: CapturedTool[] = [];
	const capturableService = service as unknown as CapturableMCPService;

	capturableService.getToolRegistrar = () => (name, config, callback) => {
		capturedTools.push({ name, config, callback });
	};
	capturableService.registerTaskTools({});

	return capturedTools;
}

function getTaskTool(name: string, tools: CapturedTool[]): CapturedTool {
	const tool = tools.find((candidate) => candidate.name === name);
	if (!tool) {
		throw new Error(`${name} was not registered`);
	}
	return tool;
}

const draftDependency: TaskDependency = {
	uid: "[[Draft docs]]",
	reltype: "FINISHTOSTART",
};

const reviewDependency: TaskDependency = {
	uid: "[[Review docs]]",
	reltype: "STARTTOSTART",
	gap: "P1D",
};

describe("Issue #2442: MCP create/update blockedBy input", () => {
	it("passes blockedBy from tasknotes_create_task to task creation", async () => {
		const createTask = jest.fn(async (taskData) => ({ taskInfo: { ...taskData } }));
		const tools = captureTaskTools({ taskService: { createTask } });
		const createTool = getTaskTool("tasknotes_create_task", tools);
		const schema = z.object(createTool.config.inputSchema);

		expect(
			schema.safeParse({ title: "Publish docs", blockedBy: [draftDependency] }).success
		).toBe(true);

		await createTool.callback({ title: "Publish docs", blockedBy: [draftDependency] });

		expect(createTask).toHaveBeenCalledWith(
			expect.objectContaining({ title: "Publish docs", blockedBy: [draftDependency] })
		);
	});

	it("rejects dependencies with an unknown reltype or empty uid", () => {
		const tools = captureTaskTools();
		for (const name of ["tasknotes_create_task", "tasknotes_update_task"]) {
			const schema = z.object(getTaskTool(name, tools).config.inputSchema);
			const base = { id: "Tasks/mcp-dependencies.md", title: "Publish docs" };

			expect(
				schema.safeParse({
					...base,
					blockedBy: [{ uid: "[[Draft docs]]", reltype: "BLOCKS" }],
				}).success
			).toBe(false);
			expect(
				schema.safeParse({ ...base, blockedBy: [{ uid: "", reltype: "FINISHTOSTART" }] })
					.success
			).toBe(false);
		}
	});

	it("replaces, clears and preserves blockedBy on tasknotes_update_task", async () => {
		const task = createTask({ blockedBy: [draftDependency] });
		const getTaskInfo = jest.fn(async () => task);
		const updateTask = jest.fn(async (originalTask, updates) => ({
			...originalTask,
			...updates,
		}));
		const tools = captureTaskTools({
			taskService: { updateTask },
			cacheManager: { getTaskInfo },
		});
		const updateTool = getTaskTool("tasknotes_update_task", tools);

		await updateTool.callback({ id: task.path, blockedBy: [reviewDependency] });
		await updateTool.callback({ id: task.path, blockedBy: null });
		await updateTool.callback({ id: task.path, blockedBy: [] });
		await updateTool.callback({ id: task.path, title: "Renamed" });

		expect(updateTask).toHaveBeenNthCalledWith(1, task, { blockedBy: [reviewDependency] });
		expect(updateTask).toHaveBeenNthCalledWith(2, task, { blockedBy: [] });
		expect(updateTask).toHaveBeenNthCalledWith(3, task, { blockedBy: [] });
		expect(updateTask).toHaveBeenNthCalledWith(4, task, { title: "Renamed" });
	});
});
