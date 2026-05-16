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
	isCompleted: value === "done",
	order,
	autoArchive: false,
	autoArchiveDelay: 5,
	...overrides,
});

describe("Issue #1522: status cycle exclusions", () => {
	it("skips excluded statuses when cycling forward and backward", () => {
		const manager = new StatusManager([
			createStatus("open", 0),
			createStatus("waiting", 1, { excludeFromCycle: true }),
			createStatus("in-progress", 2),
			createStatus("done", 3),
		]);

		expect(manager.getNextStatus("open")).toBe("in-progress");
		expect(manager.getPreviousStatus("in-progress")).toBe("open");
		expect(manager.getPreviousStatus("open")).toBe("done");
	});

	it("respects excluded status order when the current status was set manually", () => {
		const manager = new StatusManager([
			createStatus("open", 0),
			createStatus("waiting", 1, { excludeFromCycle: true }),
			createStatus("in-progress", 2),
			createStatus("done", 3),
		]);

		expect(manager.getNextStatus("waiting")).toBe("in-progress");
		expect(manager.getPreviousStatus("waiting")).toBe("open");
	});

	it("keeps the current status when every configured status is excluded", () => {
		const manager = new StatusManager([
			createStatus("waiting", 0, { excludeFromCycle: true }),
			createStatus("blocked", 1, { excludeFromCycle: true }),
		]);

		expect(manager.getNextStatus("waiting")).toBe("waiting");
		expect(manager.getPreviousStatus("waiting")).toBe("waiting");
	});
});
