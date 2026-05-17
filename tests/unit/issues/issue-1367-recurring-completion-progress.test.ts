import { describe, expect, it, jest } from "@jest/globals";
import { getFiniteRecurringInstanceCount } from "../../../src/utils/helpers";
import { renderPropertyMetadata } from "../../../src/ui/taskCardProperties";
import { PluginFactory, TaskFactory } from "../../helpers/mock-factories";

function createPlugin() {
	const plugin = PluginFactory.createMockPlugin();
	plugin.fieldMapper.lookupMappingKey = jest.fn(() => undefined);
	return plugin;
}

describe("issue #1367 recurring completion progress", () => {
	it("counts finite UNTIL recurrence instances", () => {
		const task = TaskFactory.createTask({
			scheduled: "2025-12-09",
			recurrence: "DTSTART:20251209;FREQ=DAILY;UNTIL=20251213",
		});

		expect(getFiniteRecurringInstanceCount(task)).toBe(5);
	});

	it("renders finite recurring completion against total expected instances", () => {
		const container = document.createElement("div");
		const plugin = createPlugin();
		const task = TaskFactory.createTask({
			scheduled: "2025-12-09",
			recurrence: "DTSTART:20251209;FREQ=DAILY;UNTIL=20251213",
			complete_instances: ["2025-12-09", "2025-12-10", "2025-12-11", "2025-12-12"],
			skipped_instances: [],
		});

		const property = renderPropertyMetadata(container, "completeInstances", task, plugin);

		expect(property?.textContent).toBe("✓ 4/5 completed (80%)");
		expect(property?.textContent).not.toContain("100%");
	});

	it("does not invent a percentage for unbounded recurrences", () => {
		const container = document.createElement("div");
		const plugin = createPlugin();
		const task = TaskFactory.createTask({
			scheduled: "2025-12-09",
			recurrence: "DTSTART:20251209;FREQ=DAILY",
			complete_instances: ["2025-12-09", "2025-12-10", "2025-12-11", "2025-12-12"],
			skipped_instances: [],
		});

		const property = renderPropertyMetadata(container, "completeInstances", task, plugin);

		expect(property?.textContent).toBe("✓ 4 completed");
		expect(property?.textContent).not.toContain("%");
	});
});
