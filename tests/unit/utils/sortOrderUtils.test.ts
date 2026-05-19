import { jest } from "@jest/globals";
import { TFile } from "obsidian";
import {
	applySortOrderPlan,
	prepareSortOrderUpdate,
	type SortOrderPlan,
} from "../../../src/bases/sortOrderUtils";

jest.mock("obsidian");

type FrontmatterMap = Record<string, Record<string, any>>;

const basesSortCollator = new Intl.Collator(undefined, {
	numeric: true,
	sensitivity: "base",
});
const alphaRankPattern = /^tn[a-z]{10}$/;

function compareBasesOrder(left: string, right: string): number {
	const collated = basesSortCollator.compare(left, right);
	return collated !== 0 ? collated : left.localeCompare(right);
}

function expectAscendingDisplayOrder(ranks: string[]): void {
	for (let index = 1; index < ranks.length; index++) {
		expect(compareBasesOrder(ranks[index - 1], ranks[index])).toBeLessThan(0);
	}
}

function expectDescendingDisplayOrder(ranks: string[]): void {
	for (let index = 1; index < ranks.length; index++) {
		expect(compareBasesOrder(ranks[index - 1], ranks[index])).toBeGreaterThan(0);
	}
}

function expectAlphaRanks(ranks: string[]): void {
	expect(ranks.every((rank) => alphaRankPattern.test(rank))).toBe(true);
}

function createPlugin(frontmatterByPath: FrontmatterMap, sortOrderField = "tasknotes_manual_order") {
	const processFrontMatter = jest.fn(async (file: TFile, updater: (frontmatter: any) => void) => {
		const frontmatter = frontmatterByPath[file.path];
		if (!frontmatter) {
			throw new Error(`Missing frontmatter for ${file.path}`);
		}
		updater(frontmatter);
	});

	return {
		settings: {
			fieldMapping: {
				sortOrder: sortOrderField,
			},
		},
		app: {
			vault: {
				getMarkdownFiles: jest.fn(() => Object.keys(frontmatterByPath).map((path) => new TFile(path))),
				getAbstractFileByPath: jest.fn((path: string) => (
					Object.prototype.hasOwnProperty.call(frontmatterByPath, path) ? new TFile(path) : null
				)),
			},
			metadataCache: {
				getFileCache: jest.fn((file: TFile) => ({
					frontmatter: frontmatterByPath[file.path],
				})),
			},
			fileManager: {
				processFrontMatter,
			},
		},
	} as any;
}

describe("sortOrderUtils", () => {
	it("writes the configured sort-order field when applying a plan", async () => {
		const frontmatterByPath = {
			"alpha.md": { custom_order: "0|hzzzzz:" },
			"beta.md": { custom_order: "0|i00007:" },
		};
		const plugin = createPlugin(frontmatterByPath, "custom_order");
		const plan: SortOrderPlan = {
			sortOrder: "0|i00003:",
			additionalWrites: [{ path: "alpha.md", sortOrder: "0|hzzzzx:" }],
			reason: "sparse-init",
		};

		await applySortOrderPlan("beta.md", plan, plugin);

		expect(frontmatterByPath["alpha.md"].custom_order).toBe("0|hzzzzx:");
		expect(frontmatterByPath["beta.md"].custom_order).toBe("0|i00003:");
		expect(plugin.app.fileManager.processFrontMatter).toHaveBeenCalledTimes(2);
	});

	it("initializes a sparse visible run in the dragged display order", async () => {
		const plugin = createPlugin({
			"ranked.md": { status: "todo", tasknotes_manual_order: "0|hzzzzz:" },
			"unranked-a.md": { status: "todo" },
			"unranked-b.md": { status: "todo" },
			"unranked-c.md": { status: "todo" },
		});

		const plan = await prepareSortOrderUpdate(
			"unranked-b.md",
			false,
			"todo",
			"status",
			"dragged.md",
			plugin,
			{
				visibleTaskPaths: ["ranked.md", "unranked-a.md", "unranked-b.md", "unranked-c.md"],
			}
		);

		const rankA = plan.additionalWrites.find((write) => write.path === "unranked-a.md")?.sortOrder;
		const rankB = plan.additionalWrites.find((write) => write.path === "unranked-b.md")?.sortOrder;
		const rankC = plan.additionalWrites.find((write) => write.path === "unranked-c.md")?.sortOrder;

		expect(plan.reason).toBe("rebalance");
		expect(plan.additionalWrites.map((write) => write.path)).toEqual([
			"ranked.md",
			"unranked-a.md",
			"unranked-b.md",
			"unranked-c.md",
		]);
		expect(rankA).toBeDefined();
		expect(rankB).toBeDefined();
		expect(rankC).toBeDefined();
		expectAlphaRanks([rankA!, rankB!, plan.sortOrder!, rankC!]);
		expectAscendingDisplayOrder([rankA!, rankB!, plan.sortOrder!, rankC!]);
	});

	it("rebalances before the first unranked task in a sparse tail", async () => {
		const plugin = createPlugin({
			"ranked.md": { status: "todo", tasknotes_manual_order: "0|hzzzzz:" },
			"unranked-a.md": { status: "todo" },
			"unranked-b.md": { status: "todo" },
		});

		const plan = await prepareSortOrderUpdate(
			"unranked-a.md",
			true,
			"todo",
			"status",
			"dragged.md",
			plugin,
			{
				visibleTaskPaths: ["ranked.md", "unranked-a.md", "unranked-b.md"],
			}
		);

		expect(plan.reason).toBe("rebalance");
		expect(plan.additionalWrites.map((write) => write.path)).toEqual([
			"ranked.md",
			"unranked-a.md",
			"unranked-b.md",
		]);
		expect(plan.sortOrder).toBeDefined();
		const rankedRank = plan.additionalWrites.find((write) => write.path === "ranked.md")!.sortOrder;
		const rankA = plan.additionalWrites.find((write) => write.path === "unranked-a.md")!.sortOrder;
		expectAlphaRanks([rankedRank, plan.sortOrder!, rankA]);
		expectAscendingDisplayOrder([rankedRank, plan.sortOrder!, rankA]);
	});

	it("isolates kanban reorder calculations to the active swimlane scope", async () => {
		const plugin = createPlugin({
			"alpha-a.md": { status: "todo", project: "Alpha", tasknotes_manual_order: "0|hzzzzz:" },
			"alpha-b.md": { status: "todo", project: "Alpha", tasknotes_manual_order: "0|i00007:" },
			"beta-a.md": { status: "todo", project: "Beta", tasknotes_manual_order: "0|zzzzzz:" },
		});

		const plan = await prepareSortOrderUpdate(
			"alpha-a.md",
			false,
			"todo",
			"status",
			"dragged.md",
			plugin,
			{
				scopeFilters: [{ property: "project", value: "Alpha" }],
				visibleTaskPaths: ["alpha-a.md", "alpha-b.md"],
			}
		);

		expect(plan.reason).toBe("midpoint");
		expect(plan.additionalWrites).toEqual([]);
		expect(compareBasesOrder(plan.sortOrder!, "0|hzzzzz:")).toBeGreaterThan(0);
		expect(compareBasesOrder(plan.sortOrder!, "0|i00007:")).toBeLessThan(0);
	});

	it("uses the visible list order as the authoritative drop scope", async () => {
		const plugin = createPlugin({
			"alpha.md": { status: "todo", tasknotes_manual_order: "0|hzzzzz:" },
			"visible-last.md": { status: "todo", tasknotes_manual_order: "0|i00007:" },
			"hidden-after.md": { status: "todo", tasknotes_manual_order: "0|i0000f:" },
		});

		const plan = await prepareSortOrderUpdate(
			"visible-last.md",
			false,
			"todo",
			"status",
			"dragged.md",
			plugin,
			{
				visibleTaskPaths: ["alpha.md", "visible-last.md"],
			}
		);

		expect(plan.reason).toBe("rebalance");
		expect(plan.additionalWrites.map((write) => write.path)).toEqual([
			"alpha.md",
			"visible-last.md",
		]);
		expect(plan.additionalWrites.some((write) => write.path === "hidden-after.md")).toBe(false);
		const alphaRank = plan.additionalWrites.find((write) => write.path === "alpha.md")!.sortOrder;
		const visibleLastRank = plan.additionalWrites.find((write) => write.path === "visible-last.md")!
			.sortOrder;
		expectAlphaRanks([alphaRank, visibleLastRank, plan.sortOrder!]);
		expectAscendingDisplayOrder([alphaRank, visibleLastRank, plan.sortOrder!]);
	});

	it("rebalances old LexoRank gaps that are not between values under Bases natural sort", async () => {
		const plugin = createPlugin({
			"previous.md": { status: "todo", tasknotes_manual_order: "0|hzzzzz:" },
			"target.md": { status: "todo", tasknotes_manual_order: "0|i0000f:" },
			"next.md": { status: "todo", tasknotes_manual_order: "0|i0000n:" },
		});

		const plan = await prepareSortOrderUpdate(
			"target.md",
			true,
			"todo",
			"status",
			"dragged.md",
			plugin,
			{
				visibleTaskPaths: ["previous.md", "target.md", "next.md"],
			}
		);

		expect(plan.reason).toBe("rebalance");
		expect(plan.additionalWrites.map((write) => write.path)).toEqual([
			"previous.md",
			"target.md",
			"next.md",
		]);

		const previousRank = plan.additionalWrites.find((write) => write.path === "previous.md")!.sortOrder;
		const targetRank = plan.additionalWrites.find((write) => write.path === "target.md")!.sortOrder;
		const nextRank = plan.additionalWrites.find((write) => write.path === "next.md")!.sortOrder;

		expectAlphaRanks([previousRank, plan.sortOrder!, targetRank, nextRank]);
		expectAscendingDisplayOrder([previousRank, plan.sortOrder!, targetRank, nextRank]);
	});

	it("respects descending visible sort order when inserting above a target", async () => {
		const plugin = createPlugin({
			"previous.md": { status: "todo", tasknotes_manual_order: "0|jc3j7d:" },
			"target.md": { status: "todo", tasknotes_manual_order: "0|jc2tkt:" },
			"next.md": { status: "todo", tasknotes_manual_order: "0|jc0oo7:" },
		});

		const plan = await prepareSortOrderUpdate(
			"target.md",
			true,
			"todo",
			"status",
			"dragged.md",
			plugin,
			{
				visibleTaskPaths: ["previous.md", "target.md", "next.md"],
			}
		);

		expect(plan.reason).toBe("midpoint");
		expect(plan.additionalWrites).toEqual([]);
		expect(compareBasesOrder(plan.sortOrder!, "0|jc3j7d:")).toBeLessThan(0);
		expect(compareBasesOrder(plan.sortOrder!, "0|jc2tkt:")).toBeGreaterThan(0);
	});

	it("rebalances descending duplicate boundaries instead of jumping above the previous task", async () => {
		const plugin = createPlugin({
			"previous.md": { status: "todo", tasknotes_manual_order: "0|jc3j7l:" },
			"target.md": { status: "todo", tasknotes_manual_order: "0|jc3j7l:" },
			"next.md": { status: "todo", tasknotes_manual_order: "0|jc3j7d:" },
		});

		const plan = await prepareSortOrderUpdate(
			"target.md",
			true,
			"todo",
			"status",
			"dragged.md",
			plugin,
			{
				visibleTaskPaths: ["previous.md", "target.md", "next.md"],
			}
		);

		expect(plan.reason).toBe("rebalance");
		expect(plan.additionalWrites.map((write) => write.path)).toEqual([
			"previous.md",
			"target.md",
			"next.md",
		]);

		const previousRank = plan.additionalWrites.find((write) => write.path === "previous.md")!.sortOrder;
		const targetRank = plan.additionalWrites.find((write) => write.path === "target.md")!.sortOrder;
		const nextRank = plan.additionalWrites.find((write) => write.path === "next.md")!.sortOrder;

		expectAlphaRanks([previousRank, plan.sortOrder!, targetRank, nextRank]);
		expectDescendingDisplayOrder([previousRank, plan.sortOrder!, targetRank, nextRank]);
	});

	it("rebalances oversized sparse scopes into compact ranks", async () => {
		const oversizedRank = `0|zhzzzz:${"i".repeat(120)}`;
		const plugin = createPlugin({
			"seed.md": { status: "todo", tasknotes_manual_order: oversizedRank },
			"unranked-a.md": { status: "todo" },
			"unranked-b.md": { status: "todo" },
		});

		const plan = await prepareSortOrderUpdate(
			"unranked-a.md",
			false,
			"todo",
			"status",
			"dragged.md",
			plugin,
			{
				visibleTaskPaths: ["seed.md", "unranked-a.md", "unranked-b.md"],
			}
		);

		expect(plan.reason).toBe("rebalance");
		expect(plan.additionalWrites.map((write) => write.path)).toEqual([
			"seed.md",
			"unranked-a.md",
			"unranked-b.md",
		]);
		expect(plan.sortOrder).toBeDefined();

		const seedRank = plan.additionalWrites.find((write) => write.path === "seed.md")!.sortOrder;
		const rankA = plan.additionalWrites.find((write) => write.path === "unranked-a.md")!.sortOrder;
		const rankB = plan.additionalWrites.find((write) => write.path === "unranked-b.md")!.sortOrder;
		const allRanks = [seedRank, rankA, plan.sortOrder!, rankB];
		expect(allRanks.every((rank) => rank.length <= 12)).toBe(true);
		expectAlphaRanks(allRanks);
		expectAscendingDisplayOrder(allRanks);
	});
});
