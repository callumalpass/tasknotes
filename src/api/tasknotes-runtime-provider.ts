import type {
	MdbaseRuntimeContract,
	MdbaseRuntimeDispatchContext,
	MdbaseRuntimeDisposable,
	MdbaseRuntimeEventHandler,
	MdbaseRuntimeProvider,
} from "@callumalpass/mdbase-runtime";
import type { TaskNotesRuntimeApiV1 } from "./runtime-api";

const TASK_PATCH_ACTION = "tasknotes.task.patch";
const ZONE_ACTIONS = [
	{ id: "task.complete", name: "Complete task", effect: "task.patch" },
	{ id: "task.uncomplete", name: "Uncomplete task", effect: "task.patch" },
	{ id: "task.archive", name: "Archive task", effect: "task.patch" },
	{ id: "task.unarchive", name: "Unarchive task", effect: "task.patch" },
	{ id: "time.start", name: "Start task time tracking", effect: "time.write" },
	{ id: "time.stop", name: "Stop task time tracking", effect: "time.write" },
	{ id: "pomodoro.start", name: "Start task Pomodoro", effect: "pomodoro.write" },
	{ id: "pomodoro.assign", name: "Assign current Pomodoro", effect: "pomodoro.write" },
	{ id: "recurring.complete", name: "Complete recurring instance", effect: "recurring.write" },
	{ id: "recurring.skip", name: "Skip recurring instance", effect: "recurring.write" },
] as const;

const ZONE_ACTION_INPUT_SCHEMA = {
	type: "object",
	required: ["path"],
	additionalProperties: false,
	properties: { path: { type: "string", minLength: 1 } },
} as const;

export function createTaskNotesRuntimeProvider(
	api: TaskNotesRuntimeApiV1,
	providerVersion: string
): MdbaseRuntimeProvider {
	const contracts: MdbaseRuntimeContract[] = [
		{
			type: "capability",
			id: "task.read",
			version: 1,
			name: "Task read",
			risk: "low",
			description: "Read TaskNotes task records.",
		},
		{
			type: "capability",
			id: "task.patch",
			version: 1,
			name: "Task patch",
			risk: "medium",
			description: "Patch TaskNotes task records.",
		},
		{
			type: "capability",
			id: "time.write",
			version: 1,
			name: "Time tracking write",
			risk: "medium",
			description: "Start and stop TaskNotes time tracking.",
		},
		{
			type: "capability",
			id: "pomodoro.write",
			version: 1,
			name: "Pomodoro write",
			risk: "medium",
			description: "Start and assign TaskNotes Pomodoro sessions.",
		},
		{
			type: "capability",
			id: "recurring.write",
			version: 1,
			name: "Recurring task write",
			risk: "medium",
			description: "Update TaskNotes recurring instances.",
		},
		{
			type: "action",
			id: TASK_PATCH_ACTION,
			version: 1,
			name: "Patch TaskNotes task",
			provider: "tasknotes",
			schemas: {
				dialect: "json-schema-2020-12",
				input: {
					type: "object",
					required: ["path", "patch"],
					additionalProperties: false,
					properties: {
						path: { type: "string", minLength: 1 },
						patch: { type: "object" },
					},
				},
				output: { type: "object" },
			},
			effects: ["task.patch"],
		},
		...ZONE_ACTIONS.map(({ id, name, effect }): MdbaseRuntimeContract => ({
			type: "action",
			id,
			version: 1,
			name,
			provider: "tasknotes",
			schemas: {
				dialect: "json-schema-2020-12",
				input: ZONE_ACTION_INPUT_SCHEMA,
				output: { type: "object" },
			},
			effects: [effect],
		})),
	];

	return {
		descriptor: () => ({
			type: "provider",
			id: "tasknotes",
			version: 1,
			name: "TaskNotes",
			provider_version: providerVersion,
			contracts: {
				actions: [TASK_PATCH_ACTION, ...ZONE_ACTIONS.map(({ id }) => id)],
				capabilities: ["task.read", "task.patch", "time.write", "pomodoro.write", "recurring.write"],
			},
		}),
		contracts: () => contracts,
		readiness: () => ({ valid: true, status: "ready", diagnostics: [] }),
		subscribe: (_eventId: string, _handler: MdbaseRuntimeEventHandler): MdbaseRuntimeDisposable => ({
			dispose: () => undefined,
		}),
		dispatch: async (actionId: string, input: unknown, context: MdbaseRuntimeDispatchContext) => {
			if (!isRecord(input)) {
				throw new Error(`Unsupported TaskNotes runtime action: ${actionId}`);
			}
			const path = String(input.path);
			const mutationContext = {
				source: context.origin.provider ?? context.origin.workflow ?? "mdbase-runtime",
				correlationId: context.correlation_id,
				reason: actionId,
			};
			switch (actionId) {
				case TASK_PATCH_ACTION:
					return await api.tasks.patch(path, input.patch as Record<string, unknown>, mutationContext);
				case "task.complete":
					return await api.tasks.complete(path, undefined, mutationContext);
				case "task.uncomplete":
					return await api.tasks.uncomplete(path, undefined, mutationContext);
				case "task.archive":
					return await api.tasks.archive(path, true, mutationContext);
				case "task.unarchive":
					return await api.tasks.archive(path, false, mutationContext);
				case "time.start":
					return await api.time.start(path, undefined, mutationContext);
				case "time.stop":
					return await api.time.stop(path, mutationContext);
				case "pomodoro.start":
					return await api.pomodoro.start({ taskPath: path }, mutationContext);
				case "pomodoro.assign":
					return await api.pomodoro.assignTask(path, mutationContext);
				case "recurring.complete":
					return await api.recurring.toggleCompleteInstance(path, undefined, mutationContext);
				case "recurring.skip":
					return await api.recurring.toggleSkippedInstance(path, undefined, mutationContext);
				default:
					throw new Error(`Unsupported TaskNotes runtime action: ${actionId}`);
			}
		},
		dispose: () => undefined,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
