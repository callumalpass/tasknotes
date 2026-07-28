import { InMemoryInteropBridge, type CloudEvent, type InteropClient } from "@callumalpass/mdbase-interop";
import { webcrypto } from "node:crypto";
import { TaskNotesInteropPublisher } from "../../../src/api/tasknotes-interop";

describe("TaskNotes interoperability publisher", () => {
	it("publishes a minimal contract event with source identity and correlation", async () => {
		globalThis.structuredClone ??= ((value) =>
			JSON.parse(JSON.stringify(value)) as unknown) as typeof structuredClone;
		Object.defineProperty(globalThis, "crypto", {
			configurable: true,
			value: webcrypto,
		});
		const bridge = new InMemoryInteropBridge({ authorize: () => true });
		const sourceClient = bridge.connect({
			application: "tasknotes",
			implementation: "tasknotes.obsidian",
			version: "5.0.0",
		});
		const consumer = bridge.connect({
			application: "tasknotes-workflows",
			implementation: "tasknotes-workflows.obsidian",
			version: "0.1.1",
		});
		let received: CloudEvent | undefined;
		await consumer.subscribeEvents(
			{ contract: { id: "tasknotes.task.completed", version: "^1.0.0" } },
			(event) => {
				received = event;
			},
		);
		let completedHandler: ((payload: never) => void) | undefined;
		const api = {
			events: {
				on: (event: string, handler: (payload: never) => void) => {
					expect(event).toBe("task.completed");
					completedHandler = handler;
					return { event };
				},
				off: jest.fn(),
			},
		};
		const mdbase = {
			api: {
				interop: { connect: jest.fn((): InteropClient => sourceClient) },
				getInteropStatus: () => ({ enabled: true }),
			},
		};
		const plugin = {
			app: {
				plugins: {
					getPlugin: (id: string) => id === "mdbase-obsidian" ? mdbase : null,
				},
			},
		};
		const publisher = new TaskNotesInteropPublisher(plugin as never, api as never);
		publisher.connect();
		await eventually(() => expect(typeof completedHandler).toBe("function"));

		completedHandler?.({
			event: "task.completed",
			timestamp: "2026-07-28T10:15:00.000Z",
			taskPath: "Tasks/Ship contracts.md",
			after: {
				id: "task-42",
				path: "Tasks/Ship contracts.md",
				title: "Ship contracts",
				status: "done",
				priority: "normal",
				archived: false,
			},
			changes: {},
			correlationId: "workflow-42",
			rawEvent: "task-updated",
		} as never);
		await eventually(() => expect(received).toBeDefined());

		expect(received).toMatchObject({
			specversion: "1.0",
			type: "tasknotes.task.completed",
			mdbaseapplication: "tasknotes",
			mdbasecontractversion: "1.0.0",
			correlationid: "workflow-42",
			subject: "Tasks/Ship%20contracts.md",
			data: {
				task_id: "task-42",
				task_path: "Tasks/Ship contracts.md",
				title: "Ship contracts",
				status: "done",
				completed_at: "2026-07-28T10:15:00.000Z",
			},
		});
		expect(received?.data).not.toHaveProperty("priority");

		await publisher.dispose();
		await consumer.dispose();
		await bridge.dispose();
	});
});

async function eventually(assertion: () => void): Promise<void> {
	let lastError: unknown;
	for (let attempt = 0; attempt < 20; attempt += 1) {
		try {
			assertion();
			return;
		} catch (error) {
			lastError = error;
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}
	throw lastError;
}
