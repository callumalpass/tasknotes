import type { Plugin } from "obsidian";
import {
	TASKNOTES_TASK_COMPLETED_EVENT_CONTRACT,
	type TaskInfo,
} from "@tasknotes/model";
import type {
	EventSourceRegistration,
	InteropClient,
} from "@callumalpass/mdbase-interop";
import type {
	TaskNotesRuntimeApiV1,
	TaskNotesRuntimeEventPayload,
} from "./runtime-api";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

interface MdbaseObsidianPlugin {
	api?: {
		interop?: {
			connect(plugin: Plugin): InteropClient;
		};
		getInteropStatus?(): { enabled: boolean };
	};
}

const logger = createTaskNotesLogger({ tag: "API/MdbaseInterop" });

export class TaskNotesInteropPublisher {
	private client: InteropClient | null = null;
	private registration: EventSourceRegistration | null = null;
	private unsubscribe: (() => void) | null = null;
	private connecting: Promise<void> | null = null;

	constructor(
		private readonly plugin: Plugin,
		private readonly api: TaskNotesRuntimeApiV1,
	) {}

	connect(): void {
		if (this.client || this.connecting) return;
		const mdbase = this.getMdbasePlugin();
		if (!mdbase?.api?.interop || mdbase.api.getInteropStatus?.().enabled === false) return;
		this.connecting = this.register(mdbase)
			.catch((error: unknown) => {
				logger.error("Failed to register the TaskNotes event source.", {
					category: "internal",
					operation: "interop-event-source-registration",
					error,
				});
			})
			.finally(() => {
				this.connecting = null;
			});
	}

	async dispose(): Promise<void> {
		await this.connecting;
		this.unsubscribe?.();
		this.unsubscribe = null;
		await this.registration?.dispose();
		this.registration = null;
		await this.client?.dispose();
		this.client = null;
	}

	private async register(mdbase: MdbaseObsidianPlugin): Promise<void> {
		const interop = mdbase.api?.interop;
		if (!interop) return;
		const client = interop.connect(this.plugin);
		try {
			const registration = await client.registerEventSource({
				declaration_id: "tasknotes.events",
				contracts: [{
					contract: structuredClone(TASKNOTES_TASK_COMPLETED_EVENT_CONTRACT),
				}],
			});
			const eventRef = this.api.events.on("task.completed", (payload) => {
				void this.publishCompleted(client, payload).catch((error: unknown) => {
					logger.error("Failed to publish tasknotes.task.completed.", {
						category: "internal",
						operation: "interop-event-publish",
						error,
					});
				});
			});
			this.client = client;
			this.registration = registration;
			this.unsubscribe = () => this.api.events.off(eventRef);
		} catch (error) {
			await client.dispose();
			throw error;
		}
	}

	private async publishCompleted(
		client: InteropClient,
		payload: TaskNotesRuntimeEventPayload,
	): Promise<void> {
		const task = payload.after ?? payload.task;
		if (!isTaskInfo(task)) {
			throw new Error("TaskNotes completion event did not contain the completed task.");
		}
		const taskPath = task.path || payload.taskPath;
		if (!taskPath) throw new Error("TaskNotes completion event did not contain a task path.");
		await client.publishEvent({
			contract: {
				id: TASKNOTES_TASK_COMPLETED_EVENT_CONTRACT.id,
				version: TASKNOTES_TASK_COMPLETED_EVENT_CONTRACT.version,
			},
			time: payload.timestamp,
			subject: encodeURI(taskPath),
			...(payload.correlationId ? { correlation_id: payload.correlationId } : {}),
			data: {
				task_id: task.id || taskPath,
				task_path: taskPath,
				title: task.title,
				status: task.status,
				completed_at: payload.timestamp,
			},
		});
	}

	private getMdbasePlugin(): MdbaseObsidianPlugin | null {
		const app = this.plugin.app as unknown as {
			plugins?: { getPlugin(id: string): unknown };
		} | undefined;
		return app?.plugins?.getPlugin("mdbase-obsidian") as MdbaseObsidianPlugin | null;
	}
}

function isTaskInfo(value: unknown): value is TaskInfo {
	return value !== null
		&& typeof value === "object"
		&& typeof (value as TaskInfo).path === "string"
		&& typeof (value as TaskInfo).title === "string"
		&& typeof (value as TaskInfo).status === "string";
}
