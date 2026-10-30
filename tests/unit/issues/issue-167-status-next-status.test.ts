import { StatusManager } from "../../../src/services/StatusManager";
import { StatusConfig } from "../../../src/types";

const createStatus = (
	value: string,
	order: number,
	overrides: Partial<StatusConfig> = {}
): StatusConfig => ({
	id: value,
	value,
	label: value,
	color: "#808080",
	isCompleted: value === "done" || value === "archived",
	order,
	autoArchive: false,
	autoArchiveDelay: 5,
	...overrides,
});

describe("Issue #167: explicit next status overrides", () => {
	describe("status after completion", () => {
		it("is the open status explicitly configured to follow the completed status", () => {
			const manager = new StatusManager([
				createStatus("inbox", 0),
				createStatus("todo", 1),
				createStatus("done", 2, { nextStatus: "todo" }),
			]);

			expect(manager.getConfiguredStatusAfterCompletion()).toBe("todo");
		});

		it("is undefined without an explicit next status, ignoring cycle order", () => {
			const manager = new StatusManager([
				createStatus("none", 0),
				createStatus("open", 1),
				createStatus("done", 2),
			]);

			expect(manager.getNextStatus("done")).toBe("none");
			expect(manager.getConfiguredStatusAfterCompletion()).toBeUndefined();
		});

		it("comes only from the first completed status", () => {
			const onFirst = new StatusManager([
				createStatus("open", 0),
				createStatus("done", 1, { nextStatus: "open" }),
				createStatus("archived", 2, { nextStatus: "backlog" }),
				createStatus("backlog", 3),
			]);
			const onSecond = new StatusManager([
				createStatus("open", 0),
				createStatus("done", 1),
				createStatus("archived", 2, { nextStatus: "open" }),
			]);

			expect(onFirst.getConfiguredStatusAfterCompletion()).toBe("open");
			expect(onSecond.getConfiguredStatusAfterCompletion()).toBeUndefined();
		});

		it("is undefined when the next status is itself completed or unknown", () => {
			const archived = new StatusManager([
				createStatus("open", 0),
				createStatus("done", 1, { nextStatus: "archived" }),
				createStatus("archived", 2),
			]);
			const unknown = new StatusManager([
				createStatus("open", 0),
				createStatus("done", 1, { nextStatus: "missing-status" }),
			]);

			expect(archived.getConfiguredStatusAfterCompletion()).toBeUndefined();
			expect(unknown.getConfiguredStatusAfterCompletion()).toBeUndefined();
		});
	});

	it("uses a configured next status instead of the ordered cycle", () => {
		const manager = new StatusManager([
			createStatus("backlog", 0),
			createStatus("in-progress", 1, { nextStatus: "done" }),
			createStatus("blocked", 2, { nextStatus: "done" }),
			createStatus("done", 3, { nextStatus: "archived" }),
			createStatus("archived", 4),
		]);

		expect(manager.getNextStatus("in-progress")).toBe("done");
		expect(manager.getNextStatus("blocked")).toBe("done");
		expect(manager.getNextStatus("done")).toBe("archived");
	});

	it("falls back to status order when no valid next status is configured", () => {
		const manager = new StatusManager([
			createStatus("backlog", 0),
			createStatus("blocked", 1, { nextStatus: "missing-status" }),
			createStatus("in-progress", 2),
			createStatus("done", 3),
		]);

		expect(manager.getNextStatus("backlog")).toBe("blocked");
		expect(manager.getNextStatus("blocked")).toBe("in-progress");
	});

	it("falls back to status order when next status points to itself", () => {
		const manager = new StatusManager([
			createStatus("backlog", 0),
			createStatus("in-progress", 1, { nextStatus: "in-progress" }),
			createStatus("done", 2),
		]);

		expect(manager.getNextStatus("in-progress")).toBe("done");
	});

	it("allows manually selected statuses to jump back into the workflow", () => {
		const manager = new StatusManager([
			createStatus("open", 0),
			createStatus("delegated", 1, {
				excludeFromCycle: true,
				nextStatus: "done",
			}),
			createStatus("done", 2),
		]);

		expect(manager.getNextStatus("delegated")).toBe("done");
		expect(manager.getPreviousStatus("delegated")).toBe("open");
	});
});
