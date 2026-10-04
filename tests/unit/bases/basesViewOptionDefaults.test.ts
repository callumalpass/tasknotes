import { applyBasesViewOptionDefaults } from "../../../src/bases/basesViewOptionDefaults";
import { registerBasesView } from "../../../src/bases/api";
import type { BasesAllOptions } from "obsidian";

const options: BasesAllOptions[] = [
	{ type: "group", displayName: "Board", items: [
		{ type: "toggle", key: "hideEmptyColumns", displayName: "Hide empty", default: false },
		{ type: "text", key: "pinnedColumns", displayName: "Pinned", default: "" },
		{ type: "slider", key: "firstDay", displayName: "First day", min: 0, max: 6, step: 1, default: 1 },
		{ type: "property", key: "swimLane", displayName: "Swimlane" },
		{ type: "multitext", key: "values", displayName: "Values", default: [] },
	] },
];
const reader = (values: Record<string, unknown>) => ({ get: (key: string) => values[key] });
const defaults = (result: any[]) => result[0].items.map((option: any) => option.default);

describe("native Bases option defaults for legacy settings", () => {
	it("uses nested settings for the panel without mutating option definitions", () => {
		const result = applyBasesViewOptionDefaults(options, reader({ options: {
			hideEmptyColumns: true, pinnedColumns: "ordered, received", firstDay: 0,
			swimLane: "priority", values: ["shopping"],
		} }));
		expect(defaults(result)).toEqual([true, "ordered, received", 0, "priority", ["shopping"]]);
		expect(defaults(options)).toEqual([false, "", 1, undefined, []]);
	});

	it("preserves direct false, zero, and empty overrides", () => {
		expect(defaults(applyBasesViewOptionDefaults(options, reader({
			hideEmptyColumns: false, pinnedColumns: "", firstDay: 0,
			config: { hideEmptyColumns: true, pinnedColumns: "received", firstDay: 1 },
		})))).toEqual([false, "", 0, undefined, []]);
	});

	it("keeps declared defaults for missing or incorrectly typed settings", () => {
		expect(defaults(applyBasesViewOptionDefaults(options, reader({ options: {
			hideEmptyColumns: "true", pinnedColumns: false, firstDay: Infinity,
			swimLane: [], values: [42],
		} })))).toEqual([false, "", 1, undefined, []]);
	});

	it("wraps registered options so the native panel receives legacy defaults", () => {
		const plugin = { registerBasesView: jest.fn(() => true) };
		const registration = { name: "Kanban", icon: "square", factory: jest.fn(), options: jest.fn(() => options) };
		expect(registerBasesView(plugin as any, "tasknotesKanban", registration)).toBe(true);
		const registered = plugin.registerBasesView.mock.calls[0] as any;
		const config = reader({ config: { hideEmptyColumns: true } });
		expect(defaults(registered[1].options(config))[0]).toBe(true);
		expect(registration.options).toHaveBeenCalledWith(config);
	});
});
