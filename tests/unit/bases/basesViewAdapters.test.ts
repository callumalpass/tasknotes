import type { BasesDataItem } from "../../../src/bases/helpers";
import {
	buildBasesPathProperties,
	computeBasesFormulas,
} from "../../../src/bases/basesViewAdapters";

describe("basesViewAdapters", () => {
	it("computes Bases formulas with TaskNotes properties and restores frontmatter", () => {
		const frontmatter = { status: "todo" };
		const item: BasesDataItem = {
			path: "task.md",
			properties: { priority: "high" },
			basesData: {
				frontmatter,
				formulaResults: {
					cachedFormulaOutputs: {},
				},
			},
		};
		const formula = {
			getValue: jest.fn((data: { frontmatter?: Record<string, unknown> }) => {
				return `${data.frontmatter?.status}:${data.frontmatter?.priority}`;
			}),
		};

		computeBasesFormulas({ ctx: { formulas: { score: formula } } }, [item]);

		expect(formula.getValue).toHaveBeenCalledTimes(1);
		expect(item.basesData).toMatchObject({
			frontmatter,
			formulaResults: {
				cachedFormulaOutputs: {
					score: "todo:high",
				},
			},
		});
		expect((item.basesData as { frontmatter?: Record<string, unknown> }).frontmatter).toBe(
			frontmatter
		);
	});

	it("skips missing, undefined, and throwing formulas without blocking other outputs", () => {
		const item: BasesDataItem = {
			path: "task.md",
			properties: {},
			basesData: {
				formulaResults: {
					cachedFormulaOutputs: {},
				},
			},
		};

		computeBasesFormulas(
			{
				ctx: {
					formulas: {
						valid: { getValue: () => "ok" },
						missingGetter: {},
						undefinedResult: { getValue: () => undefined },
						throwing: {
							getValue: () => {
								throw new Error("bad formula");
							},
						},
					},
				},
			},
			[item]
		);

		expect(
			(item.basesData as {
				formulaResults?: { cachedFormulaOutputs?: Record<string, unknown> };
			}).formulaResults?.cachedFormulaOutputs
		).toEqual({ valid: "ok" });
	});

	it("builds path property maps with cached formula outputs", () => {
		const items: BasesDataItem[] = [
			{
				path: "one.md",
				properties: { status: "todo" },
				basesData: {
					formulaResults: {
						cachedFormulaOutputs: {
							score: 5,
						},
					},
				},
			},
			{
				path: "two.md",
				properties: { status: "done" },
			},
			{
				properties: { status: "ignored" },
			},
		];

		expect(buildBasesPathProperties(items)).toEqual(
			new Map([
				["one.md", { status: "todo", "formula.score": 5 }],
				["two.md", { status: "done" }],
			])
		);
	});
});
