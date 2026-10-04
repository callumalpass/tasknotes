import { parse } from "yaml";
import { BasesFilterConverter } from "../../../src/services/BasesFilterConverter";
import { readBasesViewConfigValue } from "../../../src/bases/basesViewConfig";
import type { SavedView } from "../../../src/types";

const settings = {
	columnWidth: 300,
	hideEmptyColumns: true,
	pinnedColumns: "ordered, shipped, received, returned",
	swimLane: "priority",
	enableSearch: false,
	wipLimits: { received: 5 },
};

function makeConverter() {
	return new BasesFilterConverter({
		fieldMapper: { toUserField: (key: string) => key },
		settings: { userFields: [] },
	} as any);
}

function savedView(viewOptions = settings): SavedView {
	return {
		id: "purchase-board", name: "Purchase Board",
		query: { type: "group", conjunction: "and", children: [], groupKey: "status", sortKey: "title" },
		viewOptions,
	} as unknown as SavedView;
}

describe("Bases saved-view export settings", () => {
	it.each(["single", "all"])("exports %s views with settings readable through the native flat getter", mode => {
		const converter = makeConverter();
		const content = mode === "single"
			? converter.convertSavedViewToBasesFile(savedView(), "tasknotesKanban")
			: converter.convertAllSavedViewsToBasesFile([savedView()]);
		const view = parse(content).views[0];
		expect(view).toMatchObject({ type: "tasknotesKanban", ...settings });
		expect(view.config).toBeUndefined();
		expect(view.options).toBeUndefined();
		const reader = { get: (key: string) => view[key] };
		for (const [key, value] of Object.entries(settings)) {
			expect(reader.get(key)).toEqual(value);
			expect(readBasesViewConfigValue(reader, key)).toEqual(value);
		}
	});

	it("preserves explicit false, zero, and empty strings in exported settings", () => {
		const view = savedView({ hideEmptyColumns: false, firstDay: 0, pinnedColumns: "" } as any);
		const exported = parse(makeConverter().convertAllSavedViewsToBasesFile([view])).views[0];
		expect(exported).toMatchObject({ hideEmptyColumns: false, firstDay: 0, pinnedColumns: "" });
	});
});
