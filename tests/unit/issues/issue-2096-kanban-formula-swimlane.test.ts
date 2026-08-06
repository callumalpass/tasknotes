import type { BasesDataItem } from "../../../src/bases/helpers";
import {
	buildBasesPathProperties,
	computeBasesFormulas,
} from "../../../src/bases/basesViewAdapters";
import { getKanbanSwimLaneKeys } from "../../../src/bases/kanbanGrouping";
import type { TaskInfo } from "../../../src/types";

describe("Issue #2096: formula-backed Kanban swimlanes", () => {
	it("computes formula values used only by the TaskNotes swimLane option", () => {
		const item: BasesDataItem = {
			path: "Tasks/medium-energy.md",
			properties: {
				status: "open",
				energy: "medium",
			},
			basesData: {
				frontmatter: {
					status: "open",
					energy: "medium",
				},
			},
		};
		const formula = {
			getValue: jest.fn((data: { frontmatter?: Record<string, unknown> }) =>
				data.frontmatter?.energy === "medium" ? "Medium" : "Unspecified"
			),
		};

		computeBasesFormulas({ ctx: { formulas: { energyRange: formula } } }, [item]);

		expect(formula.getValue).toHaveBeenCalledTimes(1);

		const pathToProps = buildBasesPathProperties([item]);
		expect(pathToProps.get("Tasks/medium-energy.md")).toMatchObject({
			"formula.energyRange": "Medium",
		});

		const swimLaneKeys = getKanbanSwimLaneKeys({
			task: {
				title: "Medium energy",
				status: "open",
				path: "Tasks/medium-energy.md",
			} as TaskInfo,
			pathToProps,
			swimLanePropertyId: "formula.energyRange",
			explodeListColumns: false,
			isListTypeProperty: () => false,
			getListPropertyValue: () => undefined,
			canonicalizeGroupKey: (groupKey) => groupKey,
		});

		expect(swimLaneKeys).toEqual(["Medium"]);
	});
});
