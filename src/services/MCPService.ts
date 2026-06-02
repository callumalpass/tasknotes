import type { HTTPRequestLike, HTTPResponseLike } from "../api/httpTypes";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import TaskNotesPlugin from "../main";
import { TaskService } from "./TaskService";
import { FilterService } from "./FilterService";
import { TaskManager } from "../utils/TaskManager";
import { StatusManager } from "./StatusManager";
import { NaturalLanguageParser } from "./NaturalLanguageParser";
import { TaskStatsService } from "./TaskStatsService";
import {
	FILTER_OPERATORS,
	TaskCreationData,
	FilterQuery,
	FilterCondition,
	FilterGroup,
	FilterOperator,
	TaskGroupKey,
	TaskSortKey,
} from "../types";
import {
	computeActiveTimeSessions,
	computeTimeSummary,
	computeTaskTimeData,
} from "../utils/timeTrackingUtils";
import { collectCalendarEvents } from "../utils/calendarUtils";
import { buildTaskCreationDataFromParsed } from "./buildTaskCreationDataFromParsed";
import { hydrateTaskDetailsFromFile } from "../utils/taskDetails";
import { JsonRpcBody, normalizeMcpInitializeProtocol } from "./mcpProtocol";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Services/MCPService" });
const MCP_FILTER_OPERATOR_VALUES = FILTER_OPERATORS.map((operator) => operator.id) as [
	FilterOperator,
	...FilterOperator[],
];
const MCP_FILTER_OPERATOR_DESCRIPTION = [
	"Filter operator. Valid operators:",
	MCP_FILTER_OPERATOR_VALUES.join(", "),
].join(" ");

function createMcpJsonReplacer(): (this: unknown, key: string, value: unknown) => unknown {
	const ancestors: unknown[] = [];

	return function mcpJsonReplacer(this: unknown, key: string, value: unknown): unknown {
		if (key === "basesData") {
			return undefined;
		}

		if (typeof value === "bigint") {
			return value.toString();
		}

		if (typeof value === "function" || typeof value === "symbol") {
			return undefined;
		}

		if (value === null || typeof value !== "object") {
			return value;
		}

		if (!Array.isArray(value)) {
			const prototype = Object.getPrototypeOf(value);
			if (prototype !== Object.prototype && prototype !== null) {
				return undefined;
			}
		}

		while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
			ancestors.pop();
		}

		if (ancestors.includes(value)) {
			return undefined;
		}

		ancestors.push(value);
		return value;
	};
}

function stringifyMcpJson(data: unknown): string {
	return JSON.stringify(data, createMcpJsonReplacer());
}

type ListTasksArgs = { limit?: number; offset?: number };
type TaskIdArgs = { id: string };
type CreateTaskArgs = {
	title: string;
	status?: string;
	priority?: string;
	due?: string;
	scheduled?: string;
	tags?: string[];
	contexts?: string[];
	projects?: string[];
	recurrence?: string;
	timeEstimate?: number;
	details?: string;
};
type UpdateTaskArgs = TaskIdArgs &
	Partial<Omit<CreateTaskArgs, "title" | "timeEstimate">> & {
		title?: string;
		recurrence?: string | null;
		timeEstimate?: number | null;
		due?: string | null;
		scheduled?: string | null;
	};
type CompleteRecurringArgs = TaskIdArgs & { date?: string };
type MaterializeOccurrenceArgs = TaskIdArgs & { date: string };
type TextTaskArgs = { text: string };
type QueryTasksArgs = {
	conjunction: "and" | "or";
	children: FilterGroup["children"];
	sortKey?: TaskSortKey;
	sortDirection?: "asc" | "desc";
	groupKey?: TaskGroupKey;
};
type StartTimeTrackingArgs = TaskIdArgs & { description?: string };
type TimeSummaryArgs = {
	period?: "today" | "week" | "month" | "all" | "custom";
	from?: string;
	to?: string;
};
type StartPomodoroArgs = { taskId?: string; duration?: number };
type CalendarEventsArgs = { start?: string; end?: string };
type VaultAdapterWithBasePath = { basePath?: string };
type McpToolRegistrar = (
	name: string,
	config: { description: string; inputSchema: z.ZodRawShape },
	callback: (...args: never[]) => unknown
) => void;

/**
 * MCP (Model Context Protocol) server for TaskNotes.
 *
 * Exposes task management, time tracking, pomodoro, and calendar tools
 * via the Streamable HTTP transport in stateless mode.
 */
export class MCPService {
	constructor(
		private plugin: TaskNotesPlugin,
		private taskService: TaskService,
		private filterService: FilterService,
		private cacheManager: TaskManager,
		private statusManager: StatusManager,
		private nlParser: NaturalLanguageParser,
		private taskStatsService: TaskStatsService
	) {}

	/** Handle an incoming MCP-over-HTTP request. */
	async handleRequest(
		req: HTTPRequestLike,
		res: HTTPResponseLike,
		parsedBody: JsonRpcBody
	): Promise<void> {
		if (req.method !== "POST") {
			res.writeHead(405, { Allow: "POST" });
			res.end(
				JSON.stringify({
					jsonrpc: "2.0",
					error: { code: -32000, message: "Method not allowed" },
					id: null,
				})
			);
			return;
		}

		try {
			normalizeMcpInitializeProtocol(parsedBody);

			const transport = new StreamableHTTPServerTransport({
				sessionIdGenerator: undefined, // stateless mode
			});
			const server = new McpServer({
				name: "tasknotes",
				version: this.plugin.manifest.version,
			});

			this.registerTools(server);

			await server.connect(transport);
			await transport.handleRequest(req as never, res as never, parsedBody);

			// Close transport after handling the request in stateless mode
			await transport.close();
			await server.close();
		} catch (error: unknown) {
			tasknotesLogger.error("MCP request error:", {
				category: "provider",
				operation: "mcp-request",
				error: error,
			});
			if (!res.headersSent) {
				res.writeHead(500, { "Content-Type": "application/json" });
				res.end(
					JSON.stringify({
						jsonrpc: "2.0",
						error: { code: -32603, message: "Internal error" },
						id: null,
					})
				);
			}
		}
	}

	private registerTools(server: McpServer): void {
		this.registerTaskTools(server);
		this.registerFilterTools(server);
		this.registerTimeTrackingTools(server);
		this.registerPomodoroTools(server);
		this.registerCalendarTools(server);
		this.registerSystemTools(server);
	}

	private getErrorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}

	private getToolRegistrar(server: McpServer): McpToolRegistrar {
		return server.registerTool.bind(server) as McpToolRegistrar;
	}

	// Task Tools

	private registerTaskTools(server: McpServer): void {
		const tool = this.getToolRegistrar(server);

		tool(
			"tasknotes_list_tasks",
			{
				description: "List all tasks with optional pagination",
				inputSchema: {
					limit: z.number().optional().describe("Max tasks to return"),
					offset: z.number().optional().describe("Number of tasks to skip"),
				},
			},
			async ({ limit, offset }: ListTasksArgs) => {
				try {
					const allTasks = await this.cacheManager.getAllTasks();
					const start = offset ?? 0;
					const end = limit ? start + limit : undefined;
					const tasks = allTasks.slice(start, end);

					return this.jsonResult({
						tasks,
						total: allTasks.length,
						offset: start,
						returned: tasks.length,
					});
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_get_task",
			{
				description: "Get a single task by its file path ID",
				inputSchema: {
					id: z.string().describe("Task file path (e.g. 'tasks/My Task.md')"),
				},
			},
			async ({ id }: TaskIdArgs) => {
				try {
					const task = await this.cacheManager.getTaskInfo(id);
					if (!task) {
						return this.errorResult("Task not found");
					}
					const taskWithDetails = await hydrateTaskDetailsFromFile(this.plugin.app, task);
					return this.jsonResult(taskWithDetails);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_create_task",
			{
				description: "Create a new task",
				inputSchema: {
					title: z.string().describe("Task title"),
					status: z
						.string()
						.optional()
						.describe("Task status (e.g. 'open', 'in-progress', 'done')"),
					priority: z
						.string()
						.optional()
						.describe("Task priority (e.g. 'low', 'normal', 'high', 'urgent')"),
					due: z.string().optional().describe("Due date (YYYY-MM-DD)"),
					scheduled: z.string().optional().describe("Scheduled date (YYYY-MM-DD)"),
					tags: z.array(z.string()).optional().describe("Tags"),
					contexts: z.array(z.string()).optional().describe("Contexts"),
					projects: z.array(z.string()).optional().describe("Projects"),
					recurrence: z.string().optional().describe("RFC 5545 recurrence rule"),
					timeEstimate: z.number().optional().describe("Time estimate in minutes"),
					details: z.string().optional().describe("Task body/description"),
				},
			},
			async (args: CreateTaskArgs) => {
				try {
					const taskData: TaskCreationData = {
						title: args.title,
						path: "",
						archived: false,
						status: args.status || this.plugin.settings.defaultTaskStatus,
						priority: args.priority || this.plugin.settings.defaultTaskPriority,
						due: args.due,
						scheduled: args.scheduled,
						tags: args.tags,
						contexts: args.contexts,
						projects: args.projects,
						recurrence: args.recurrence,
						timeEstimate: args.timeEstimate,
						details: args.details,
						creationContext: "api",
					};
					const result = await this.taskService.createTask(taskData);

					return this.jsonResult(result.taskInfo);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_update_task",
			{
				description: "Update an existing task's properties",
				inputSchema: {
					id: z.string().describe("Task file path"),
					title: z.string().optional().describe("New title"),
					status: z.string().optional().describe("New status"),
					priority: z.string().optional().describe("New priority"),
					due: z
						.string()
						.nullable()
						.optional()
						.describe("New due date (YYYY-MM-DD) or null to clear"),
					scheduled: z
						.string()
						.nullable()
						.optional()
						.describe("New scheduled date (YYYY-MM-DD) or null to clear"),
					tags: z.array(z.string()).optional().describe("New tags"),
					contexts: z.array(z.string()).optional().describe("New contexts"),
					projects: z.array(z.string()).optional().describe("New projects"),
					recurrence: z
						.string()
						.nullable()
						.optional()
						.describe("New recurrence rule or null to clear"),
					timeEstimate: z
						.number()
						.nullable()
						.optional()
						.describe("New time estimate in minutes or null to clear"),
					details: z.string().optional().describe("New body/description"),
				},
			},
			async ({ id, ...updates }: UpdateTaskArgs) => {
				try {
					const task = await this.cacheManager.getTaskInfo(id);
					if (!task) {
						return this.errorResult("Task not found");
					}

					// Build updates object, filtering out undefined values
					const cleanUpdates: Record<string, unknown> = {};
					for (const [key, value] of Object.entries(updates)) {
						if (value !== undefined) {
							cleanUpdates[key] = value;
						}
					}

					const updatedTask = await this.taskService.updateTask(task, cleanUpdates);

					return this.jsonResult(updatedTask);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_delete_task",
			{
				description: "Permanently delete a task file",
				inputSchema: { id: z.string().describe("Task file path") },
			},
			async ({ id }: TaskIdArgs) => {
				try {
					const task = await this.cacheManager.getTaskInfo(id);
					if (!task) {
						return this.errorResult("Task not found");
					}
					await this.taskService.deleteTask(task);

					return this.jsonResult({ deleted: true, id });
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_toggle_status",
			{
				description: "Toggle a task's status through the status cycle",
				inputSchema: { id: z.string().describe("Task file path") },
			},
			async ({ id }: TaskIdArgs) => {
				try {
					const task = await this.cacheManager.getTaskInfo(id);
					if (!task) {
						return this.errorResult("Task not found");
					}
					const updatedTask = await this.taskService.toggleStatus(task);

					return this.jsonResult(updatedTask);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_toggle_archive",
			{
				description: "Toggle a task's archived state",
				inputSchema: { id: z.string().describe("Task file path") },
			},
			async ({ id }: TaskIdArgs) => {
				try {
					const task = await this.cacheManager.getTaskInfo(id);
					if (!task) {
						return this.errorResult("Task not found");
					}
					const updatedTask = await this.taskService.toggleArchive(task);

					return this.jsonResult(updatedTask);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_complete_recurring_instance",
			{
				description: "Mark a recurring task as completed for a specific date",
				inputSchema: {
					id: z.string().describe("Task file path"),
					date: z
						.string()
						.optional()
						.describe("Date to mark complete (YYYY-MM-DD), defaults to today"),
				},
			},
			async ({ id, date }: CompleteRecurringArgs) => {
				try {
					const task = await this.cacheManager.getTaskInfo(id);
					if (!task) {
						return this.errorResult("Task not found");
					}
					const targetDate = date ? new Date(date) : undefined;
					const updatedTask =
						await this.taskService.toggleRecurringTaskCompleteWithOccurrenceNotes(
							task,
							targetDate
						);

					return this.jsonResult(updatedTask);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_materialize_occurrence",
			{
				description: "Create or return a materialized occurrence note for a recurring task",
				inputSchema: {
					id: z.string().describe("Parent recurring task file path"),
					date: z.string().describe("Occurrence date to materialize (YYYY-MM-DD)"),
				},
			},
			async ({ id, date }: MaterializeOccurrenceArgs) => {
				try {
					const task = await this.cacheManager.getTaskInfo(id);
					if (!task) {
						return this.errorResult("Task not found");
					}
					const occurrence = await this.taskService.materializeOccurrence(task, date);

					return this.jsonResult(occurrence);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_create_task_from_text",
			{
				description:
					"Create a task by parsing natural language text (e.g. 'Buy groceries tomorrow #shopping @home')",
				inputSchema: { text: z.string().describe("Natural language task description") },
			},
			async ({ text }: TextTaskArgs) => {
				try {
					const parsed = this.nlParser.parseInput(text);
					const taskData = buildTaskCreationDataFromParsed(this.plugin, parsed, {
						creationContext: "api",
					});
					const result = await this.taskService.createTask(taskData);

					return this.jsonResult({ parsed, task: result.taskInfo });
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);
	}

	// Filter Tools

	private registerFilterTools(server: McpServer): void {
		const tool = this.getToolRegistrar(server);

		// Define the recursive filter schema
		const filterValueSchema = z.union([
			z.string(),
			z.array(z.string()),
			z.number(),
			z.boolean(),
			z.null(),
		]);
		const filterOperatorSchema = z
			.enum(MCP_FILTER_OPERATOR_VALUES)
			.describe(MCP_FILTER_OPERATOR_DESCRIPTION);
		const filterConditionSchema: z.ZodType<FilterCondition> = z.object({
			type: z.literal("condition"),
			id: z.string(),
			property: z
				.string()
				.describe(
					"Filter property (e.g. 'status', 'priority', 'due', 'tags', 'projects', 'contexts')"
				),
			operator: filterOperatorSchema,
			value: filterValueSchema,
		}) as z.ZodType<FilterCondition>;

		const filterGroupSchema: z.ZodType<FilterGroup> = z.lazy(() =>
			z.object({
				type: z.literal("group"),
				id: z.string(),
				conjunction: z.enum(["and", "or"]),
				children: z.array(z.union([filterConditionSchema, filterGroupSchema])),
			})
		) as z.ZodType<FilterGroup>;

		tool(
			"tasknotes_query_tasks",
			{
				description:
					"Query tasks using advanced filters with AND/OR logic, sorting, and grouping",
				inputSchema: {
					conjunction: z.enum(["and", "or"]).describe("How to combine filter conditions"),
					children: z
						.array(z.union([filterConditionSchema, filterGroupSchema]))
						.describe("Filter conditions or nested groups"),
					sortKey: z
						.string()
						.optional()
						.describe("Sort by field (e.g. 'due', 'priority', 'title', 'status')"),
					sortDirection: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
					groupKey: z
						.string()
						.optional()
						.describe("Group by field (e.g. 'priority', 'status', 'projects')"),
				},
			},
			async (args: QueryTasksArgs) => {
				try {
					const query: FilterQuery = {
						type: "group",
						id: "mcp-root",
						conjunction: args.conjunction,
						children: args.children,
						sortKey: args.sortKey,
						sortDirection: args.sortDirection,
						groupKey: args.groupKey,
					};

					const grouped = await this.filterService.getGroupedTasks(query);
					const result: Record<string, unknown[]> = {};
					for (const [key, tasks] of grouped) {
						result[key] = tasks;
					}
					return this.jsonResult(result);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_get_filter_options",
			{
				description:
					"Get available filter options (statuses, priorities, tags, contexts, projects)",
				inputSchema: {},
			},
			async () => {
				try {
					const options = await this.filterService.getFilterOptions();
					return this.jsonResult(options);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_get_stats",
			{
				description: "Get task statistics (counts by status, priority, overdue, etc.)",
				inputSchema: {},
			},
			async () => {
				try {
					const allTasks = await this.cacheManager.getAllTasks();
					const stats = this.taskStatsService.getStats(allTasks);
					return this.jsonResult(stats);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);
	}

	// Time Tracking Tools

	private registerTimeTrackingTools(server: McpServer): void {
		const tool = this.getToolRegistrar(server);

		tool(
			"tasknotes_start_time_tracking",
			{
				description: "Start a time tracking session on a task",
				inputSchema: {
					id: z.string().describe("Task file path"),
					description: z.string().optional().describe("Description for the time session"),
				},
			},
			async ({ id, description }: StartTimeTrackingArgs) => {
				try {
					const task = await this.cacheManager.getTaskInfo(id);
					if (!task) {
						return this.errorResult("Task not found");
					}

					let updatedTask = await this.taskService.startTimeTracking(task);

					// If description was provided, update the latest time entry
					if (
						description &&
						updatedTask.timeEntries &&
						updatedTask.timeEntries.length > 0
					) {
						const latestEntry =
							updatedTask.timeEntries[updatedTask.timeEntries.length - 1];
						if (latestEntry && !latestEntry.endTime) {
							latestEntry.description = description;
							updatedTask = await this.taskService.updateTask(updatedTask, {
								timeEntries: updatedTask.timeEntries,
							});
						}
					}

					return this.jsonResult(updatedTask);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_stop_time_tracking",
			{
				description: "Stop the active time tracking session on a task",
				inputSchema: { id: z.string().describe("Task file path") },
			},
			async ({ id }: TaskIdArgs) => {
				try {
					const task = await this.cacheManager.getTaskInfo(id);
					if (!task) {
						return this.errorResult("Task not found");
					}
					const updatedTask = await this.taskService.stopTimeTracking(task);

					return this.jsonResult(updatedTask);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_get_active_time_sessions",
			{
				description: "Get all tasks with currently running time tracking sessions",
				inputSchema: {},
			},
			async () => {
				try {
					const allTasks = await this.cacheManager.getAllTasks();
					const result = computeActiveTimeSessions(allTasks, (task) =>
						this.plugin.getActiveTimeSession(task)
					);
					return this.jsonResult(result);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_get_time_summary",
			{
				description: "Get time tracking summary for a period",
				inputSchema: {
					period: z
						.enum(["today", "week", "month", "all", "custom"])
						.optional()
						.describe("Time period (default: today)"),
					from: z
						.string()
						.optional()
						.describe("Start date (ISO string) for custom range"),
					to: z.string().optional().describe("End date (ISO string) for custom range"),
				},
			},
			async ({ period: periodArg, from, to }: TimeSummaryArgs) => {
				try {
					const allTasks = await this.cacheManager.getAllTasks();
					const period = periodArg || "today";
					const fromDate = from ? new Date(from) : null;
					const toDate = to ? new Date(to) : null;

					const result = computeTimeSummary(
						allTasks,
						{ period, fromDate, toDate, includeTags: false },
						(status) => this.statusManager.isCompletedStatus(status)
					);

					return this.jsonResult(result);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_get_task_time_data",
			{
				description: "Get detailed time tracking data for a specific task",
				inputSchema: { id: z.string().describe("Task file path") },
			},
			async ({ id }: TaskIdArgs) => {
				try {
					const task = await this.cacheManager.getTaskInfo(id);
					if (!task) {
						return this.errorResult("Task not found");
					}

					const result = computeTaskTimeData(task, (t) =>
						this.plugin.getActiveTimeSession(t)
					);
					return this.jsonResult(result);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);
	}

	// Pomodoro Tools

	private registerPomodoroTools(server: McpServer): void {
		const tool = this.getToolRegistrar(server);

		tool(
			"tasknotes_start_pomodoro",
			{
				description: "Start a pomodoro timer, optionally linked to a task",
				inputSchema: {
					taskId: z
						.string()
						.optional()
						.describe("Task file path to associate with this pomodoro"),
					duration: z
						.number()
						.optional()
						.describe("Duration in minutes (default: work duration from settings)"),
				},
			},
			async ({ taskId, duration }: StartPomodoroArgs) => {
				try {
					let task;
					if (taskId) {
						task = await this.cacheManager.getTaskInfo(taskId);
						if (!task) {
							return this.errorResult("Task not found");
						}
					}

					const currentState = this.plugin.pomodoroService.getState();
					if (currentState.isRunning) {
						return this.errorResult(
							"Pomodoro session is already running. Stop or pause the current session first."
						);
					}

					await this.plugin.pomodoroService.startPomodoro(task, duration);
					const newState = this.plugin.pomodoroService.getState();

					return this.jsonResult({
						session: newState.currentSession,
						task: task || null,
						message: "Pomodoro session started",
					});
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_stop_pomodoro",
			{ description: "Stop and reset the current pomodoro session", inputSchema: {} },
			async () => {
				try {
					const currentState = this.plugin.pomodoroService.getState();
					if (!currentState.currentSession) {
						return this.errorResult("No active pomodoro session to stop");
					}
					await this.plugin.pomodoroService.stopPomodoro();
					return this.jsonResult({ message: "Pomodoro session stopped and reset" });
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_pause_pomodoro",
			{ description: "Pause the running pomodoro timer", inputSchema: {} },
			async () => {
				try {
					const currentState = this.plugin.pomodoroService.getState();
					if (!currentState.isRunning || !currentState.currentSession) {
						return this.errorResult("No running pomodoro session to pause");
					}
					await this.plugin.pomodoroService.pausePomodoro();
					const newState = this.plugin.pomodoroService.getState();
					return this.jsonResult({
						timeRemaining: newState.timeRemaining,
						message: "Pomodoro session paused",
					});
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_resume_pomodoro",
			{ description: "Resume a paused pomodoro timer", inputSchema: {} },
			async () => {
				try {
					const currentState = this.plugin.pomodoroService.getState();
					if (currentState.isRunning) {
						return this.errorResult("Pomodoro session is already running");
					}
					if (!currentState.currentSession) {
						return this.errorResult("No paused session to resume");
					}
					await this.plugin.pomodoroService.resumePomodoro();
					const newState = this.plugin.pomodoroService.getState();
					return this.jsonResult({
						timeRemaining: newState.timeRemaining,
						message: "Pomodoro session resumed",
					});
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);

		tool(
			"tasknotes_get_pomodoro_status",
			{
				description: "Get the current pomodoro timer status including stats",
				inputSchema: {},
			},
			async () => {
				try {
					const state = this.plugin.pomodoroService.getState();
					const enhancedState = {
						...state,
						totalPomodoros: await this.plugin.pomodoroService.getPomodorosCompleted(),
						currentStreak: await this.plugin.pomodoroService.getCurrentStreak(),
						totalMinutesToday: await this.plugin.pomodoroService.getTotalMinutesToday(),
					};
					return this.jsonResult(enhancedState);
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);
	}

	// Calendar Tools

	private registerCalendarTools(server: McpServer): void {
		const tool = this.getToolRegistrar(server);

		tool(
			"tasknotes_get_calendar_events",
			{
				description:
					"Get calendar events from all connected providers (Google, Microsoft, ICS subscriptions)",
				inputSchema: {
					start: z.string().optional().describe("Start date filter (ISO string)"),
					end: z.string().optional().describe("End date filter (ISO string)"),
				},
			},
			async ({ start, end }: CalendarEventsArgs) => {
				try {
					const startDate = start ? new Date(start) : null;
					const endDate = end ? new Date(end) : null;

					const result = collectCalendarEvents(
						this.plugin.calendarProviderRegistry,
						this.plugin.icsSubscriptionService ?? null,
						{ start: startDate, end: endDate }
					);

					return this.jsonResult({
						events: result.events,
						total: result.total,
					});
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);
	}

	// System Tools

	private registerSystemTools(server: McpServer): void {
		const tool = this.getToolRegistrar(server);

		tool(
			"tasknotes_health_check",
			{
				description: "Check if the TaskNotes MCP server is running and return vault info",
				inputSchema: {},
			},
			async () => {
				try {
					const vaultName = this.plugin.app.vault.getName();
					const vaultPath =
						(this.plugin.app.vault.adapter as VaultAdapterWithBasePath).basePath ||
						"unknown";
					return this.jsonResult({
						status: "ok",
						vault: vaultName,
						vaultPath,
						version: this.plugin.manifest.version,
						timestamp: new Date().toISOString(),
					});
				} catch (error: unknown) {
					return this.errorResult(this.getErrorMessage(error));
				}
			}
		);
	}

	// Helpers

	private jsonResult(data: unknown) {
		return {
			content: [{ type: "text" as const, text: stringifyMcpJson(data) }],
		};
	}

	private errorResult(message: string) {
		return {
			content: [{ type: "text" as const, text: stringifyMcpJson({ error: message }) }],
			isError: true,
		};
	}
}
