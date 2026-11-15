import { parse } from "yaml";
import type TaskNotesPlugin from "../../../src/main";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { generateBasesFileTemplate } from "../../../src/templates/defaultBasesFiles";

describe("default Kanban visible properties", () => {
	it("retains priority formulas without displaying their numeric helper on cards", () => {
		const settings = { ...DEFAULT_SETTINGS };
		const plugin = {
			settings,
			fieldMapper: new FieldMapper(settings.fieldMapping),
		} as TaskNotesPlugin;
		const base = parse(generateBasesFileTemplate("open-kanban-view", plugin));
		expect(base.formulas.priorityWeight).toBeDefined();
		expect(base.views[0].order).not.toContain("formula.priorityWeight");
		expect(base.views[0].order).toContain(settings.fieldMapping.priority);
		expect(base.views[0].sort[0].column).toBe(settings.fieldMapping.sortOrder);
	});
});
