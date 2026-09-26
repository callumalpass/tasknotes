import type { BasesDataItem } from "../../../src/bases/helpers";
import {
	buildBasesPathProperties,
	computeBasesFormulas,
	populateBasesFormulaProperty,
} from "../../../src/bases/basesViewAdapters";
import { getKanbanSwimLaneKeys } from "../../../src/bases/kanbanGrouping";
import type { TaskInfo } from "../../../src/types";

describe("Issue #2361: cold-loaded formula swimlanes", () => {
	it("reads a swimlane-only path formula from the public Bases entry API without data.ctx", () => {
		const items: BasesDataItem[] = ["01 WORK", "02 FINANCE"].map((area) => {
			const path = `${area}/Task.md`;
			return {
				path,
				properties: { status: "open", "file.path": path },
				data: {
					getValue: jest.fn((id: string) => {
						expect(id).toBe("formula.areaF");
						return { data: area };
					}),
				},
			};
		});

		// On a cold load the public query result has no ctx or cached formula output.
		computeBasesFormulas({ data: items }, items);
		const pathToProps = buildBasesPathProperties(items);
		populateBasesFormulaProperty(items, pathToProps, "formula.areaF");

		for (const item of items) {
			const keys = getKanbanSwimLaneKeys({
				task: { path: item.path } as TaskInfo,
				pathToProps,
				swimLanePropertyId: "formula.areaF",
				explodeListColumns: false,
				isListTypeProperty: () => false,
				getListPropertyValue: () => undefined,
				canonicalizeGroupKey: (key) => key,
			});
			expect(keys).toEqual([item.path?.split("/")[0]]);
			expect((item.data as { getValue: jest.Mock }).getValue).toHaveBeenCalledTimes(1);
		}
	});

	it("does not evaluate unrelated properties or let a failing entry block other lanes", () => {
		const failing = jest.fn(() => { throw new Error("bad formula"); });
		const good = jest.fn(() => ({ data: "01 WORK" }));
		const items: BasesDataItem[] = [
			{ path: "bad.md", data: { getValue: failing } },
			{ path: "good.md", data: { getValue: good } },
		];
		const pathToProps = buildBasesPathProperties(items);

		populateBasesFormulaProperty(items, pathToProps, "note.areaF");
		expect(failing).not.toHaveBeenCalled();
		expect(good).not.toHaveBeenCalled();

		populateBasesFormulaProperty(items, pathToProps, "formula.areaF");
		expect(pathToProps.get("bad.md")?.["formula.areaF"]).toBeUndefined();
		expect(pathToProps.get("good.md")?.["formula.areaF"]).toBe("01 WORK");
	});
});
