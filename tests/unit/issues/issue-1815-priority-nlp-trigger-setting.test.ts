import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { createNLPTriggerRows } from "../../../src/settings/tabs/taskProperties/helpers";
import type { TaskNotesSettings } from "../../../src/types/settings";

describe("Issue #1815: Priority NLP trigger character setting", () => {
	function cloneSettings(): TaskNotesSettings {
		return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
	}

	it("shows and saves the priority trigger character even when priority NLP is disabled", () => {
		const settings = cloneSettings();
		const save = jest.fn();
		const translate = (key: string) => key;
		const plugin = { settings } as any;

		const rows = createNLPTriggerRows(
			plugin,
			"priority",
			"!",
			save,
			translate as any
		);

		expect(rows).toHaveLength(2);
		expect(rows[0].label).toBe("settings.taskProperties.propertyCard.nlpTrigger");
		expect(rows[1].label).toBe("settings.taskProperties.propertyCard.triggerChar");

		const triggerInput = rows[1].input as HTMLInputElement;
		expect(triggerInput.value).toBe("!");

		triggerInput.value = "!!";
		triggerInput.dispatchEvent(new Event("change"));

		const priorityTrigger = settings.nlpTriggers.triggers.find(
			(trigger) => trigger.propertyId === "priority"
		);
		expect(priorityTrigger).toMatchObject({
			propertyId: "priority",
			trigger: "!!",
			enabled: false,
		});
		expect(save).toHaveBeenCalledTimes(1);
	});
});
