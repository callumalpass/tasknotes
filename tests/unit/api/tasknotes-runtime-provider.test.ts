import {
	InMemoryRuntimeHost,
	type MdbaseRuntimeDispatchContext,
	type MdbaseRuntimeEventEnvelope,
} from "@callumalpass/mdbase-runtime";
import type { EventRef } from "obsidian";
import {
	createTaskNotesRuntimeProvider,
} from "../../../src/api/tasknotes-runtime-provider";
import {
	TASKNOTES_RUNTIME_EVENT_DEFINITIONS,
	type TaskNotesRuntimeApiV1,
	type TaskNotesRuntimeEventHandler,
	type TaskNotesRuntimeEventName,
	type TaskNotesRuntimeEventPayload,
} from "../../../src/api/runtime-api";

const DISPATCH_CONTEXT: MdbaseRuntimeDispatchContext = {
	actor: { id: "test-user", kind: "user" },
	origin: { workflow: "workflow.test" },
	run_id: "run.test",
	invocation_id: "invocation.test",
	attempt: 1,
	correlation_id: "correlation.test",
	executor: "tasknotes-workflows",
};

interface EventFixture {
	api: TaskNotesRuntimeApiV1;
	patch: jest.Mock;
	on: jest.Mock;
	off: jest.Mock;
	emit(event: TaskNotesRuntimeEventName, payload: TaskNotesRuntimeEventPayload): void;
}

function createApiFixture(options: { patchOutput?: unknown } = {}): EventFixture {
	const handlers = new Map<TaskNotesRuntimeEventName, Set<TaskNotesRuntimeEventHandler>>();
	const refs = new Map<EventRef, { event: TaskNotesRuntimeEventName; handler: TaskNotesRuntimeEventHandler }>();
	const patch = jest.fn(async (path: string, values: Record<string, unknown>) =>
		Object.prototype.hasOwnProperty.call(options, "patchOutput")
			? options.patchOutput
			: {
					path,
					title: "Test task",
					status: String(values.status ?? "open"),
					priority: "normal",
				}
	);
	const on = jest.fn((event: TaskNotesRuntimeEventName, handler: TaskNotesRuntimeEventHandler) => {
		const eventHandlers = handlers.get(event) ?? new Set<TaskNotesRuntimeEventHandler>();
		eventHandlers.add(handler);
		handlers.set(event, eventHandlers);
		const ref = { event, handler } as unknown as EventRef;
		refs.set(ref, { event, handler });
		return ref;
	});
	const off = jest.fn((ref: EventRef) => {
		const subscription = refs.get(ref);
		if (!subscription) return;
		handlers.get(subscription.event)?.delete(subscription.handler);
		refs.delete(ref);
	});
	const unsupported = jest.fn(async () => ({ path: "Tasks/test.md" }));
	const api = {
		tasks: {
			patch,
			complete: unsupported,
			uncomplete: unsupported,
			archive: unsupported,
		},
		time: { start: unsupported, stop: unsupported },
		pomodoro: { start: unsupported, assignTask: unsupported },
		recurring: {
			toggleCompleteInstance: unsupported,
			toggleSkippedInstance: unsupported,
		},
		events: { on, off },
	} as unknown as TaskNotesRuntimeApiV1;

	return {
		api,
		patch,
		on,
		off,
		emit: (event, payload) => {
			for (const handler of handlers.get(event) ?? []) handler(payload as never);
		},
	};
}

describe("TaskNotes mdbase runtime provider", () => {
	it("registers canonical action, capability, and event contracts", async () => {
		const fixture = createApiFixture();
		const host = new InMemoryRuntimeHost();
		const registration = await host.registerProvider(
			createTaskNotesRuntimeProvider(fixture.api, "4.11.1")
		);

		const provider = host.providers()[0];
		expect(provider?.descriptor).toMatchObject({
			id: "tasknotes",
			provider_version: "4.11.1",
			contracts: {
				actions: expect.arrayContaining(["tasknotes.task.patch", "task.complete"]),
				events: TASKNOTES_RUNTIME_EVENT_DEFINITIONS.map(({ name }) => name),
			},
		});
		expect(provider?.contracts.filter(({ type }) => type === "event")).toHaveLength(
			TASKNOTES_RUNTIME_EVENT_DEFINITIONS.length
		);
		expect(fixture.on).toHaveBeenCalledTimes(TASKNOTES_RUNTIME_EVENT_DEFINITIONS.length);

		await registration.unregister();
		expect(host.providers()).toEqual([]);
		expect(fixture.off).toHaveBeenCalledTimes(TASKNOTES_RUNTIME_EVENT_DEFINITIONS.length);
	});

	it("delivers TaskNotes events as canonical runtime envelopes", async () => {
		const fixture = createApiFixture();
		const host = new InMemoryRuntimeHost();
		await host.registerProvider(createTaskNotesRuntimeProvider(fixture.api, "4.11.1"));
		const delivered: MdbaseRuntimeEventEnvelope[] = [];
		host.subscribe("task.created", (event) => delivered.push(event));

		fixture.emit("task.created", {
			event: "task.created",
			timestamp: "2026-07-19T01:02:03.000Z",
			taskPath: "Tasks/test.md",
			changes: {},
			correlationId: "correlation.created",
			rawEvent: "tasknotes:task-created",
		});

		expect(delivered).toHaveLength(1);
		expect(delivered[0]).toMatchObject({
			type: "task.created",
			contract_version: 1,
			occurred_at: "2026-07-19T01:02:03.000Z",
			source: { runtime: "obsidian", provider: "tasknotes" },
			payload: {
				event: "task.created",
				taskPath: "Tasks/test.md",
				rawEvent: "tasknotes:task-created",
			},
			trace: { correlation_id: "correlation.created" },
		});
		expect(delivered[0]?.id).toMatch(/^tasknotes\.event:/u);

		fixture.emit("task.created", {
			event: "task.created",
			timestamp: "2026-07-19T01:03:00.000Z",
			changes: {},
			correlationId: "not a runtime identifier",
			rawEvent: "tasknotes:task-created",
		});
		expect(delivered).toHaveLength(2);
		expect(delivered[1]).not.toHaveProperty("trace");

		await host.dispose();
	});

	it("denies effects by default and dispatches only when host policy allows them", async () => {
		const deniedFixture = createApiFixture();
		const deniedHost = new InMemoryRuntimeHost();
		await deniedHost.registerProvider(
			createTaskNotesRuntimeProvider(deniedFixture.api, "4.11.1")
		);

		await expect(deniedHost.dispatch(
			"tasknotes.task.patch",
			{ path: "Tasks/test.md", patch: { status: "done" } },
			DISPATCH_CONTEXT
		)).rejects.toMatchObject({ code: "capability_denied" });
		expect(deniedFixture.patch).not.toHaveBeenCalled();
		await deniedHost.dispose();

		const allowedFixture = createApiFixture();
		const allowedHost = new InMemoryRuntimeHost({
			policy: {
				id: "test-policy",
				selected: true,
				capabilities: { "task.patch": "allow" },
			},
		});
		await allowedHost.registerProvider(
			createTaskNotesRuntimeProvider(allowedFixture.api, "4.11.1")
		);

		await expect(allowedHost.dispatch(
			"tasknotes.task.patch",
			{ path: "Tasks/test.md", patch: { status: "done" } },
			DISPATCH_CONTEXT
		)).resolves.toMatchObject({ path: "Tasks/test.md", status: "done" });
		expect(allowedFixture.patch).toHaveBeenCalledWith(
			"Tasks/test.md",
			{ status: "done" },
			{
				source: "workflow.test",
				correlationId: "correlation.test",
				reason: "tasknotes.task.patch",
			}
		);

		await expect(allowedHost.dispatch(
			"tasknotes.task.patch",
			{ path: "Tasks/test.md" },
			DISPATCH_CONTEXT
		)).rejects.toMatchObject({ code: "invalid_action_input" });
		expect(allowedFixture.patch).toHaveBeenCalledTimes(1);
		await allowedHost.dispose();
	});

	it("rejects action outputs that violate the registered contract", async () => {
		const fixture = createApiFixture({ patchOutput: null });
		const host = new InMemoryRuntimeHost({
			policy: {
				id: "test-policy",
				selected: true,
				capabilities: { "task.patch": "allow" },
			},
		});
		await host.registerProvider(createTaskNotesRuntimeProvider(fixture.api, "4.11.1"));

		await expect(host.dispatch(
			"tasknotes.task.patch",
			{ path: "Tasks/test.md", patch: { status: "done" } },
			DISPATCH_CONTEXT
		)).rejects.toMatchObject({ code: "invalid_action_output" });
		expect(fixture.patch).toHaveBeenCalledTimes(1);
		await host.dispose();
	});
});
