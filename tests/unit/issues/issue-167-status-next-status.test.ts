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
