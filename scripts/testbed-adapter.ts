import { webcrypto } from "node:crypto";
import {
	InMemoryInteropBridge,
	contractDigest,
	type CloudEvent,
	type InteropClient,
} from "@callumalpass/mdbase-interop";
import { TASKNOTES_TASK_COMPLETED_EVENT_CONTRACT } from "@tasknotes/model";
import { TaskNotesInteropPublisher } from "../src/api/tasknotes-interop";

const SCENARIO = "interop.application-event-multicast";
const implementation = {
	id: "tasknotes",
	name: "TaskNotes Obsidian plugin",
	version: "4.11.1",
	language: "TypeScript",
	target: "Obsidian",
};

async function main(): Promise<void> {
	Object.defineProperty(globalThis, "crypto", {
		configurable: true,
		value: webcrypto,
	});
	const command = process.argv[2];
	if (command === "describe") {
		write({
			kind: "mdbase.testbed.adapter",
			protocol_version: "0.1",
			implementation,
			profiles: ["event_action_interop/0.1"],
			roles: ["event_source"],
			scenarios: [SCENARIO],
		});
		return;
	}
	if (command !== "run") {
		throw new Error("Usage: testbed-adapter.mjs describe|run");
	}
	const request = JSON.parse(await readStdin()) as {
		kind?: string;
		protocol_version?: string;
		scenario?: { id?: string };
	};
	if (
		request.kind !== "mdbase.testbed.run" ||
		request.protocol_version !== "0.1" ||
		request.scenario?.id !== SCENARIO
	) {
		throw new Error("Unsupported or invalid mdbase testbed run request.");
	}
	write({
		kind: "mdbase.testbed.transcript",
		protocol_version: "0.1",
		scenario_id: SCENARIO,
		implementation,
		entries: await eventMulticast(),
	});
}

async function eventMulticast(): Promise<Record<string, unknown>[]> {
	let nextId = 0;
	const bridge = new InMemoryInteropBridge({
		authorize: () => true,
		now: () => new Date("2026-07-29T00:00:00.000Z"),
		idFactory: (prefix) => `${prefix}_${++nextId}`,
	});
	const source = bridge.connect(identity("tasknotes"));
	const alpha = bridge.connect(identity("consumer-alpha"));
	const beta = bridge.connect(identity("consumer-beta"));
	const received: Array<{ consumer: string; event: CloudEvent }> = [];
	await alpha.subscribeEvents(
		{
			contract: {
				id: TASKNOTES_TASK_COMPLETED_EVENT_CONTRACT.id,
				version: "^1.0.0",
			},
		},
		(event) => received.push({ consumer: "consumer-alpha", event })
	);
	await beta.subscribeEvents(
		{
			contract: {
				id: TASKNOTES_TASK_COMPLETED_EVENT_CONTRACT.id,
				version: "^1.0.0",
			},
		},
		(event) => received.push({ consumer: "consumer-beta", event })
	);
	let completedHandler: ((payload: never) => void) | undefined;
	const api = {
		events: {
			on: (_event: string, handler: (payload: never) => void) => {
				completedHandler = handler;
				return { event: "task.completed" };
			},
			off: () => {
				completedHandler = undefined;
			},
		},
	};
	const mdbase = {
		api: {
			interop: { connect: (): InteropClient => source },
			getInteropStatus: () => ({ enabled: true }),
		},
	};
	const plugin = {
		app: {
			plugins: {
				getPlugin: (id: string) => (id === "mdbase-obsidian" ? mdbase : null),
			},
		},
	};
	const publisher = new TaskNotesInteropPublisher(plugin as never, api as never);
	try {
		publisher.connect();
		await waitFor(
			() =>
				typeof completedHandler === "function" &&
				bridge.describe().event_sources.length === 1
		);
		completedHandler?.({
			event: "task.completed",
			timestamp: "2026-07-29T00:00:00.000Z",
			taskPath: "Tasks/Testbed.md",
			after: {
				id: "task-testbed",
				path: "Tasks/Testbed.md",
				title: "Exercise interoperability",
				status: "done",
				priority: "normal",
				archived: false,
			},
			changes: {},
			correlationId: "testbed-run",
			rawEvent: "task-updated",
		} as never);
		await waitFor(() => received.length === 2);
		const event = received[0]?.event;
		return [
			entry(1, "arrange", "application", "contract.describe", "succeeded", {
				contract_type: TASKNOTES_TASK_COMPLETED_EVENT_CONTRACT.contract_type,
				schema: TASKNOTES_TASK_COMPLETED_EVENT_CONTRACT.data_schema.dialect,
			}),
			entry(2, "arrange", "application", "event-source.register", "succeeded", {
				sources: bridge.describe().event_sources.length,
			}),
			entry(3, "arrange", "consumers", "event.subscribe", "succeeded", {
				consumers: 2,
			}),
			entry(4, "act", "application", "event.publish", "succeeded", {
				exact_contract:
					event?.mdbasecontractdigest ===
					(await contractDigest(TASKNOTES_TASK_COMPLETED_EVENT_CONTRACT)),
				specversion: event?.specversion,
			}),
			entry(5, "observe", "bridge", "event.deliver", "succeeded", {
				deliveries: received.length,
				distinct_consumers: new Set(received.map(({ consumer }) => consumer)).size,
			}),
		];
	} finally {
		await publisher.dispose();
		await alpha.dispose();
		await beta.dispose();
		await bridge.dispose();
	}
}

function identity(application: string) {
	return {
		application,
		implementation: `${application}.testbed`,
		version: "1.0.0",
		instance_id: `${application}-instance`,
	};
}

function entry(
	sequence: number,
	phase: string,
	actor: string,
	operation: string,
	outcome: string,
	facts: Record<string, unknown>
) {
	return { sequence, phase, actor, operation, outcome, facts };
}

async function waitFor(predicate: () => boolean): Promise<void> {
	for (let attempt = 0; attempt < 100; attempt += 1) {
		if (predicate()) return;
		await new Promise((resolve) => setTimeout(resolve, 0));
	}
	throw new Error("TaskNotes did not reach the expected interoperability state.");
}

async function readStdin(): Promise<string> {
	let source = "";
	for await (const chunk of process.stdin) source += chunk;
	return source;
}

function write(value: unknown): void {
	process.stdout.write(`${JSON.stringify(value)}\n`);
}

main().catch((error) => {
	process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
	process.exitCode = 1;
});
