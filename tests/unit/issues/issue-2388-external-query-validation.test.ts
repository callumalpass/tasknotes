import { TFile, type App } from "obsidian";
import { z } from "zod";
import { FilterService } from "../../../src/services/FilterService";
import { StatusManager } from "../../../src/services/StatusManager";
import { PriorityManager } from "../../../src/services/PriorityManager";
import { MCPService } from "../../../src/services/MCPService";
import { TasksController } from "../../../src/api/TasksController";
import type { HTTPRequestLike, HTTPResponseLike } from "../../../src/api/httpTypes";
import type { TaskManager } from "../../../src/utils/TaskManager";
import type { FilterCondition, FilterQuery, TaskInfo } from "../../../src/types";
import type { UserMappedField } from "../../../src/types/settings";
import { normalizeExternalFilterQuery } from "../../../src/services/filter-service/filterQueryValidation";
import { buildUserPropertyDefinitions } from "../../../src/services/filter-service/filterOptions";
import { resolveUserFieldProperty } from "../../../src/services/filter-service/userFieldValues";

jest.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
	StreamableHTTPServerTransport: jest.fn(),
}));

const fields: UserMappedField[] = [
	{
		id: "field_1234567890",
		key: "my-custom-field",
		displayName: "My Custom Field",
		type: "text",
	},
];
const aliases = [
	"user:field_1234567890",
	"user.field_1234567890",
	"user:my-custom-field",
	"user.my-custom-field",
];

function condition(property: string, overrides: Partial<FilterCondition> = {}): FilterCondition {
	return {
		type: "condition",
		id: "custom-condition",
		property: property as FilterCondition["property"],
		operator: "contains",
		value: "ABC-123",
		...overrides,
	};
}
function query(property: string, overrides: Partial<FilterCondition> = {}): FilterQuery {
	return {
		type: "group",
		id: "root",
		conjunction: "and",
		children: [condition(property, overrides)],
	};
}

function fixture() {
	const task: TaskInfo = {
		path: "Task.md",
		title: "Task",
		status: "open",
		priority: "normal",
		archived: false,
	};
	const file = new TFile();
	file.path = task.path;
	const frontmatter: Record<string, unknown> = { "my-custom-field": "ABC-123" };
	const app = {
		vault: {
			getAbstractFileByPath: () => file,
			getName: () => "Test",
			adapter: { basePath: "/test" },
		},
		metadataCache: { getFileCache: () => ({ frontmatter }) },
	} as unknown as App;
	const cache = {
		getApp: () => app,
		getAllTaskPaths: jest.fn(() => new Set([task.path])),
		getCachedTaskInfo: jest.fn(async () => task),
		getAllTasks: jest.fn(async () => [task]),
		getTaskPathsByStatus: jest.fn(() => new Set<string>()),
	};
	const service = new FilterService(
		cache as unknown as TaskManager,
		new StatusManager([]),
		new PriorityManager([]),
		{ app, settings: { userFields: fields } }
	);
	return { service, cache, task, frontmatter, app };
}

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean };
type Tool = {
	config: { description: string; inputSchema: z.ZodRawShape };
	callback: (args: unknown) => Promise<ToolResult>;
};
function captureTools(service: FilterService): Record<string, Tool> {
	const mcp = new MCPService(
		{} as never,
		{} as never,
		service,
		{} as never,
		{} as never,
		{} as never,
		{} as never
	);
	const tools: Record<string, Tool> = {};
	(mcp as unknown as { registerFilterTools(server: unknown): void }).registerFilterTools({
		registerTool(name: string, config: Tool["config"], callback: Tool["callback"]) {
			tools[name] = { config, callback };
		},
	});
	return tools;
}

describe("Issue #2388: strict external task queries", () => {
	it.each(aliases)("resolves %s without mutating the caller's query", async (property) => {
		const { service, task } = fixture();
		const input = query(property);
		const before = JSON.stringify(input);
		expect(normalizeExternalFilterQuery(input, fields).children[0]).toMatchObject({
			property: aliases[0],
		});
		expect((await service.getGroupedTasksStrict(input)).get("all")).toEqual([task]);
		expect(JSON.stringify(input)).toBe(before);
	});

	it.each(["my-custom-field", "user:typo", "user.typo", "statuz", "constructor"])(
		"rejects unknown property %s with condition context",
		async (property) => {
			const { service, cache } = fixture();
			await expect(service.getGroupedTasksStrict(query(property))).rejects.toThrow(
				`Unknown property: ${property} (condition 'custom-condition')`
			);
			expect(cache.getAllTaskPaths).not.toHaveBeenCalled();
			expect(cache.getCachedTaskInfo).not.toHaveBeenCalled();
		}
	);

	it.each([
		"contains",
		"does-not-contain",
		"is-not",
		"is-empty",
		"is-not-empty",
		"is-not-checked",
	] as const)("does not treat an unknown field as a missing value for %s", async (operator) => {
		await expect(
			fixture().service.getGroupedTasksStrict(query("user:typo", { operator }))
		).rejects.toThrow("Unknown property: user:typo");
	});

	it.each(["and", "or"] as const)(
		"validates every nested %s branch before short-circuiting or index planning",
		async (conjunction) => {
			const { service, cache } = fixture();
			const input: FilterQuery = {
				type: "group",
				id: "root",
				conjunction,
				children: [
					condition("status", {
						operator: "is",
						value: conjunction === "or" ? "open" : "no-match",
					}),
					{
						type: "group",
						id: "nested",
						conjunction: "or",
						children: [condition("user:typo")],
					},
				],
			};
			await expect(service.getGroupedTasksStrict(input)).rejects.toThrow(
				"Unknown property: user:typo"
			);
			expect(cache.getTaskPathsByStatus).not.toHaveBeenCalled();
			expect(cache.getAllTaskPaths).not.toHaveBeenCalled();
		}
	);

	it("rejects unknown properties in an empty vault", async () => {
		const { service, cache } = fixture();
		cache.getAllTaskPaths.mockReturnValue(new Set());
		await expect(service.getGroupedTasksStrict(query("user:typo"))).rejects.toThrow(
			"Unknown property"
		);
	});

	it("keeps genuine zero matches successful, including an empty vault", async () => {
		const { service, cache } = fixture();
		expect(
			(await service.getGroupedTasksStrict(query(aliases[0], { value: "no-match" }))).get(
				"all"
			)
		).toEqual([]);
		cache.getAllTaskPaths.mockReturnValue(new Set());
		expect((await service.getGroupedTasksStrict(query(aliases[0]))).get("all")).toEqual([]);
	});

	it("distinguishes missing values on known fields from unknown fields", async () => {
		const { service, task, frontmatter } = fixture();
		delete frontmatter["my-custom-field"];
		for (const operator of ["is-empty", "does-not-contain", "is-not"] as const) {
			expect(
				(await service.getGroupedTasksStrict(query(aliases[2], { operator }))).get("all")
			).toEqual([task]);
		}
		expect(
			(
				await service.getGroupedTasksStrict(query(aliases[2], { operator: "is-not-empty" }))
			).get("all")
		).toEqual([]);
	});

	it("rejects incomplete and invalid conditions externally while retaining UI tolerance", async () => {
		const { service, task } = fixture();
		for (const input of [
			query(""),
			query("title", { value: "" }),
			query("user:my-custom-field", { operator: "is-before" }),
		]) {
			await expect(service.getGroupedTasksStrict(input)).rejects.toThrow();
		}
		expect((await service.getGroupedTasks(query("title", { value: "" }))).get("all")).toEqual([
			task,
		]);
		expect(await service.getGroupedTasks(query("my-custom-field"))).toEqual(new Map());
	});

	it("normalizes sort/group aliases and rejects unknown display keys", () => {
		const input = {
			...query(aliases[2]),
			sortKey: aliases[3],
			groupKey: aliases[2],
			subgroupKey: aliases[1],
		} as FilterQuery;
		expect(normalizeExternalFilterQuery(input, fields)).toMatchObject({
			sortKey: aliases[0],
			groupKey: aliases[0],
			subgroupKey: aliases[0],
		});
		for (const key of ["sortKey", "groupKey", "subgroupKey"] as const) {
			expect(() =>
				normalizeExternalFilterQuery({ ...query(aliases[0]), [key]: "user:typo" }, fields)
			).toThrow(`Unknown ${key}`);
		}
		expect(() =>
			normalizeExternalFilterQuery(
				{ ...query(aliases[0]), sortDirection: "wrong" } as unknown as FilterQuery,
				fields
			)
		).toThrow("sortDirection");
	});

	it.each([
		["text", "contains", "ABC-123"],
		["list", "contains", "ABC-123"],
		["number", "is-greater-than", 1],
		["date", "is-before", "2026-10-01"],
		["boolean", "is-checked", null],
	] as const)("validates aliases and operators for %s fields", (type, operator, value) => {
		const definitions: UserMappedField[] = [{ ...fields[0], type }];
		for (const property of aliases) {
			expect(
				normalizeExternalFilterQuery(query(property, { operator, value }), definitions)
					.children[0]
			).toMatchObject({ property: aliases[0], operator });
		}
	});

	it("reports malformed payloads before execution", async () => {
		const { service, cache } = fixture();
		for (const input of [
			null,
			{},
			[],
			{ ...query(aliases[0]), children: [null] },
			{ ...query(aliases[0]), children: "wrong" },
		]) {
			await expect(service.getGroupedTasksStrict(input as FilterQuery)).rejects.toThrow();
		}
		expect(cache.getAllTaskPaths).not.toHaveBeenCalled();
	});

	it("prefers canonical IDs over key aliases and supports fields without IDs", () => {
		const collision: UserMappedField = {
			id: "other",
			key: fields[0].id,
			displayName: "Other",
			type: "text",
		};
		expect(resolveUserFieldProperty([collision, ...fields], aliases[0])).toEqual(fields[0]);
		expect(resolveUserFieldProperty([{ ...fields[0], id: "" }], aliases[2])?.key).toBe(
			"my-custom-field"
		);
	});

	it("advertises the canonical ID, aliases, frontmatter key, and operators", () => {
		expect(buildUserPropertyDefinitions(fields)).toEqual([
			expect.objectContaining({
				id: aliases[0],
				frontmatterKey: "my-custom-field",
				aliases: expect.arrayContaining(aliases.slice(1)),
				supportedOperators: expect.arrayContaining(["contains", "is-empty"]),
			}),
		]);
	});

	it("returns MCP isError for invalid queries, not successful empty results", async () => {
		const { service } = fixture();
		const tool = captureTools(service).tasknotes_query_tasks;
		for (const property of ["my-custom-field", "user:typo"]) {
			const response = await tool.callback(query(property));
			expect(response.isError).toBe(true);
			expect(JSON.parse(response.content[0].text).error).toContain(
				`Unknown property: ${property}`
			);
		}
		for (const property of aliases) {
			const response = await tool.callback(query(property));
			expect(response.isError).toBeUndefined();
			expect(JSON.parse(response.content[0].text).all).toHaveLength(1);
		}
		const noMatch = await tool.callback(query(aliases[2], { value: "no-match" }));
		expect(noMatch.isError).toBeUndefined();
		expect(JSON.parse(noMatch.content[0].text)).toEqual({ all: [] });
		expect(tool.config.inputSchema.children.description).toBeDefined();
		expect(tool.config.inputSchema.groupKey.description).toContain("'project'");
		expect(captureTools(service).tasknotes_get_filter_options.config.description).toContain(
			"aliases"
		);
	});

	it("returns HTTP 400 for unknown properties and HTTP 200 for aliases and zero matches", async () => {
		const { service, cache, app } = fixture();
		const controller = new TasksController(
			{ app } as never,
			{} as never,
			service,
			cache as unknown as TaskManager,
			{} as never
		);
		for (const [input, status, matches] of [
			[query("user:typo"), 400, 0],
			[query(aliases[3]), 200, 1],
			[query(aliases[2], { value: "no-match" }), 200, 0],
		] as const) {
			jest.spyOn(
				controller as unknown as { parseRequestBody(): Promise<FilterQuery> },
				"parseRequestBody"
			).mockResolvedValue(input);
			let body = "";
			const response: HTTPResponseLike = {
				statusCode: 0,
				setHeader: jest.fn(),
				writeHead: jest.fn(),
				end: (data) => {
					body = data ?? "";
				},
			};
			await controller.queryTasks({} as HTTPRequestLike, response);
			expect(response.statusCode).toBe(status);
			const result = JSON.parse(body);
			if (status === 400) expect(result.error).toContain("Unknown property: user:typo");
			else expect(result.data.tasks).toHaveLength(matches);
		}
	});
});
