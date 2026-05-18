import type { EventRef } from "obsidian";
import { ViewPerformanceService } from "../../../src/services/ViewPerformanceService";
import { EVENT_TASK_UPDATED } from "../../../src/types";
import type { ViewPerformanceServiceContext } from "../../../src/bootstrap/pluginServices";

describe("ViewPerformanceService context contract", () => {
	it("registers and unregisters with only the narrow event/cache context", () => {
		const eventRef = { id: "task-update-listener" } as unknown as EventRef;
		const on = jest.fn(() => eventRef);
		const offref = jest.fn();
		const getAllTaskPaths = jest.fn(() => new Set<string>());
		const context: ViewPerformanceServiceContext = {
			emitter: { on, offref },
			cacheManager: { getAllTaskPaths },
		};

		const service = new ViewPerformanceService(context);

		expect(on).toHaveBeenCalledWith(EVENT_TASK_UPDATED, expect.any(Function));

		service.destroy();

		expect(offref).toHaveBeenCalledWith(eventRef);
	});
});
