import { z } from "zod";

jest.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
	StreamableHTTPServerTransport: jest.fn(),
}));

import { mapTaskToFrontmatter } from "../../../src/core/fieldMapping";
import { MCPService } from "../../../src/services/MCPService";
import { applyTaskUpdateFrontmatterChange } from "../../../src/services/task-service/taskUpdatePlanning";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import type { TaskInfo } from "../../../src/types";
import type { UserMappedField } from "../../../src/types/settings";

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

const USER_FIELDS: UserMappedField[] = [
	{
		id: "impact",
		displayName: "Impact",
		key: "impact",
		type: "number",
	},
	{
		id: "reviewed",
		displayName: "Reviewed",
		key: "reviewed",
		type: "boolean",
	},
];

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "MCP custom fields",
		status: "open",
		priority: "normal",
		path: "Tasks/mcp-custom-fields.md",
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

describe("Issue #2142: MCP create/update customProperties input", () => {
	it("accepts customProperties in the tasknotes_create_task schema and passes them to task creation", async () => {
		const customProperties = {
			impact: 5,
			reviewed: null,
			unconfigured: "ignored downstream",
		};
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
				title: "MCP create custom fields",
				customProperties,
			}).success
		).toBe(true);

		await createTool.callback({
			title: "MCP create custom fields",
			customProperties,
		});

		expect(createTask).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "MCP create custom fields",
				customProperties,
				creationContext: "api",
			})
		);
	});

	it("accepts customProperties in the tasknotes_update_task schema and passes them to task update", async () => {
		const customProperties = {
			impact: 8,
			reviewed: null,
			unconfigured: "ignored downstream",
		};
		const task = createTask();
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
		const schema = z.object(updateTool.config.inputSchema);

		expect(
			schema.safeParse({
				id: task.path,
				customProperties,
			}).success
		).toBe(true);

		await updateTool.callback({
			id: task.path,
			customProperties,
		});

		expect(updateTask).toHaveBeenCalledWith(task, { customProperties });
	});

	it("writes only configured customProperties keys and preserves null values", () => {
		const frontmatter = mapTaskToFrontmatter(
			DEFAULT_FIELD_MAPPING,
			{
				title: "MCP custom fields",
				status: "open",
				priority: "normal",
				path: "Tasks/mcp-custom-fields.md",
				archived: false,
				customProperties: {
					impact: 13,
					reviewed: null,
					unconfigured: "ignored",
				},
			} satisfies Partial<TaskInfo>,
			"task",
			false,
			USER_FIELDS
		);

		expect(frontmatter.impact).toBe(13);
		expect(frontmatter.reviewed).toBeNull();
		expect(frontmatter).not.toHaveProperty("unconfigured");
	});

	it("applies update customProperties through the existing mapped frontmatter path", () => {
		const frontmatter: Record<string, unknown> = {
			title: "MCP custom fields",
			status: "open",
			priority: "normal",
		};
		const fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING, USER_FIELDS);

		applyTaskUpdateFrontmatterChange({
			frontmatter,
			originalTask: createTask(),
			updates: {
				customProperties: {
					impact: 21,
					reviewed: null,
					unconfigured: "ignored",
				},
			},
			recurrenceUpdates: {},
			dateModified: "2026-07-20T13:50:00.000Z",
			fieldMapper,
			taskIdentification: {
				method: "tag",
				tag: "task",
				propertyName: "",
				propertyValue: "",
			},
			storeTitleInFilename: false,
			updateCompletedDateInFrontmatter: jest.fn(),
		});

		expect(frontmatter.impact).toBe(21);
		expect(frontmatter.reviewed).toBeNull();
		expect(frontmatter).not.toHaveProperty("unconfigured");
	});
});

function createTaskInfo(taskData: Partial<TaskInfo>): TaskInfo {
	return {
		title: taskData.title ?? "MCP custom fields",
		status: taskData.status ?? "open",
		priority: taskData.priority ?? "normal",
		path: taskData.path || "Tasks/mcp-custom-fields.md",
		archived: taskData.archived ?? false,
		...taskData,
	};
}
