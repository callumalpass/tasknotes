import { z } from "zod";

jest.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
	StreamableHTTPServerTransport: jest.fn(),
}));

import { MCPService } from "../../../src/services/MCPService";
import { applyTaskUpdateFrontmatterChange } from "../../../src/services/task-service/taskUpdatePlanning";
import type { Reminder, TaskInfo } from "../../../src/types";

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
		title: "MCP reminders",
		status: "open",
		priority: "normal",
		path: "Tasks/mcp-reminders.md",
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

const relativeReminder: Reminder = {
	id: "rem_due_1",
	type: "relative",
	relatedTo: "due",
	offset: "-PT1H",
	description: "Before due",
};

const absoluteReminder: Reminder = {
	id: "rem_abs_1",
	type: "absolute",
	absoluteTime: "2026-07-03T09:00:00",
	description: "Absolute reminder",
};

describe("Issue #2068: MCP create/update reminders input", () => {
	it("accepts reminders in the tasknotes_create_task schema and passes them to task creation", async () => {
		const createTask = jest.fn(async (taskData) => ({
			taskInfo: createTaskInfo(taskData),
		}));
		const tools = captureTaskTools({
			taskService: { createTask },
		});
		const createTool = getTaskTool("tasknotes_create_task", tools);
		const schema = z.object(createTool.config.inputSchema);

		expect(
			schema.safeParse({
				title: "MCP create reminders",
				reminders: [relativeReminder, absoluteReminder],
			}).success
		).toBe(true);

		await createTool.callback({
			title: "MCP create reminders",
			reminders: [relativeReminder, absoluteReminder],
		});

		expect(createTask).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "MCP create reminders",
				reminders: [relativeReminder, absoluteReminder],
				creationContext: "api",
			})
		);
	});

	it("accepts reminders or null in the tasknotes_update_task schema", () => {
		const tools = captureTaskTools();
		const updateTool = getTaskTool("tasknotes_update_task", tools);
		const schema = z.object(updateTool.config.inputSchema);

		expect(
			schema.safeParse({
				id: "Tasks/mcp-reminders.md",
				reminders: [relativeReminder],
			}).success
		).toBe(true);

		expect(
			schema.safeParse({
				id: "Tasks/mcp-reminders.md",
				reminders: null,
			}).success
		).toBe(true);
	});

	it("passes reminder replacement and clear updates to task update", async () => {
		const task = createTask({
			reminders: [absoluteReminder],
		});
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

		await updateTool.callback({
			id: task.path,
			reminders: [relativeReminder],
		});
		await updateTool.callback({
			id: task.path,
			reminders: null,
		});

		expect(updateTask).toHaveBeenNthCalledWith(1, task, {
			reminders: [relativeReminder],
		});
		expect(updateTask).toHaveBeenNthCalledWith(2, task, {
			reminders: undefined,
		});
	});

	it("removes the mapped reminders field when updates clear reminders", () => {
		const frontmatter: Record<string, unknown> = {
			title: "MCP reminders",
			reminders: [absoluteReminder],
		};

		applyTaskUpdateFrontmatterChange({
			frontmatter,
			originalTask: createTask({ reminders: [absoluteReminder] }),
			updates: { reminders: undefined },
			recurrenceUpdates: {},
			dateModified: "2026-06-23T08:30:00Z",
			fieldMapper: {
				mapToFrontmatter: jest.fn(() => ({
					title: "MCP reminders",
					reminders: undefined,
				})),
				toUserField: jest.fn((field) => field),
			},
			taskIdentification: {
				method: "tag",
				tag: "task",
				propertyName: "",
				propertyValue: "",
			},
			storeTitleInFilename: false,
			updateCompletedDateInFrontmatter: jest.fn(),
		});

		expect(frontmatter).not.toHaveProperty("reminders");
	});
});

function createTaskInfo(taskData: Partial<TaskInfo>): TaskInfo {
	return {
		title: taskData.title ?? "MCP reminders",
		status: taskData.status ?? "open",
		priority: taskData.priority ?? "normal",
		path: taskData.path || "Tasks/mcp-reminders.md",
		archived: taskData.archived ?? false,
		...taskData,
	};
}
