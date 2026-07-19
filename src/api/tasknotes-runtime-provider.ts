import type { EventRef } from "obsidian";
import type {
	MdbaseRuntimeContract,
	MdbaseRuntimeDispatchContext,
	MdbaseRuntimeDisposable,
	MdbaseRuntimeEventEnvelope,
	MdbaseRuntimeEventHandler,
	MdbaseRuntimeProvider,
} from "@callumalpass/mdbase-runtime";
import {
	TASKNOTES_RUNTIME_EVENT_DEFINITIONS,
	type TaskNotesRuntimeApiV1,
	type TaskNotesRuntimeEventName,
	type TaskNotesRuntimeEventPayload,
} from "./runtime-api";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesRuntimeProviderLogger = createTaskNotesLogger({ tag: "API/MdbaseRuntimeProvider" });

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

const TASKNOTES_RUNTIME_EVENT_NAMES = new Set<string>(
	TASKNOTES_RUNTIME_EVENT_DEFINITIONS.map(({ name }) => name)
);

const TASKNOTES_EVENT_PAYLOAD_SCHEMA = {
	type: "object",
	required: ["event", "timestamp", "changes", "rawEvent"],
	additionalProperties: true,
	properties: {
		event: { type: "string" },
		timestamp: { type: "string", format: "date-time" },
		changes: { type: "object" },
		rawEvent: { type: "string" },
	},
} as const;

export function createTaskNotesRuntimeProvider(
	api: TaskNotesRuntimeApiV1,
	providerVersion: string
): MdbaseRuntimeProvider {
	const subscriptions = new Set<EventRef>();
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
		...TASKNOTES_RUNTIME_EVENT_DEFINITIONS.map(({ name, label, description }): MdbaseRuntimeContract => ({
			type: "event",
			id: name,
			version: 1,
			name: label,
			description,
			provider: "tasknotes",
			schemas: {
				dialect: "json-schema-2020-12",
				payload: {
					...TASKNOTES_EVENT_PAYLOAD_SCHEMA,
					properties: {
						...TASKNOTES_EVENT_PAYLOAD_SCHEMA.properties,
						event: { const: name },
					},
				},
			},
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
				events: TASKNOTES_RUNTIME_EVENT_DEFINITIONS.map(({ name }) => name),
			},
		}),
		contracts: () => contracts,
		readiness: () => ({ valid: true, status: "ready", diagnostics: [] }),
		subscribe: (eventId: string, handler: MdbaseRuntimeEventHandler): MdbaseRuntimeDisposable => {
			if (!isTaskNotesRuntimeEventName(eventId)) {
				throw new Error(`Unsupported TaskNotes runtime event: ${eventId}`);
			}
			let active = true;
			const ref = api.events.on(eventId, (payload) => {
				try {
					void Promise.resolve(handler(runtimeEventEnvelope(payload))).catch((error: unknown) => {
						logRuntimeEventHandlerError(eventId, error);
					});
				} catch (error) {
					logRuntimeEventHandlerError(eventId, error);
				}
			});
			subscriptions.add(ref);
			return {
				dispose: () => {
					if (!active) return;
					active = false;
					subscriptions.delete(ref);
					api.events.off(ref);
				},
			};
		},
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
		dispose: () => {
			for (const ref of subscriptions) api.events.off(ref);
			subscriptions.clear();
		},
	};
}

function logRuntimeEventHandlerError(eventId: string, error: unknown): void {
	tasknotesRuntimeProviderLogger.error("Runtime event handler failed.", {
		category: "internal",
		operation: "runtime-event-handler",
		details: { eventId },
		error,
	});
}

function runtimeEventEnvelope(payload: TaskNotesRuntimeEventPayload): MdbaseRuntimeEventEnvelope {
	const correlationId = isRuntimeIdentifier(payload.correlationId) ? payload.correlationId : undefined;
	const envelope: MdbaseRuntimeEventEnvelope = {
		type: payload.event,
		contract_version: 1,
		id: runtimeEventId(),
		occurred_at: payload.timestamp,
		source: {
			runtime: "obsidian",
			provider: "tasknotes",
		},
		payload: Object.fromEntries(
			Object.entries(payload).filter(([, value]) => value !== undefined)
		),
	};
	return correlationId
		? { ...envelope, trace: { correlation_id: correlationId } }
		: envelope;
}

function runtimeEventId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return `tasknotes.event:${crypto.randomUUID()}`;
	}
	return `tasknotes.event:${Date.now().toString(36)}-${nextEventSequence().toString(36)}`;
}

let runtimeEventSequence = 0;

function nextEventSequence(): number {
	runtimeEventSequence += 1;
	return runtimeEventSequence;
}

function isTaskNotesRuntimeEventName(value: string): value is TaskNotesRuntimeEventName {
	return TASKNOTES_RUNTIME_EVENT_NAMES.has(value);
}

function isRuntimeIdentifier(value: unknown): value is string {
	return typeof value === "string" && /^[A-Za-z][A-Za-z0-9._:-]*$/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
