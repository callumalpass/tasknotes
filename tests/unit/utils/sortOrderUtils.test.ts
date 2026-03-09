import { jest } from "@jest/globals";
import { TFile } from "obsidian";
import {
	applySortOrderPlan,
	prepareSortOrderUpdate,
	type SortOrderPlan,
} from "../../../src/bases/sortOrderUtils";

jest.mock("obsidian");

type FrontmatterMap = Record<string, Record<string, any>>;

function createPlugin(frontmatterByPath: FrontmatterMap, sortOrderField = "sort_order") {
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
			"ranked.md": { status: "todo", sort_order: "0|hzzzzz:" },
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

		expect(plan.reason).toBe("sparse-init");
		expect(rankA).toBeDefined();
		expect(rankB).toBeDefined();
		expect(rankC).toBeDefined();
		expect(rankA!.localeCompare(rankB!)).toBeLessThan(0);
		expect(rankB!.localeCompare(plan.sortOrder!)).toBeLessThan(0);
		expect(plan.sortOrder!.localeCompare(rankC!)).toBeLessThan(0);
	});

	it("uses a cheap boundary insert before the first unranked task in a sparse tail", async () => {
		const plugin = createPlugin({
			"ranked.md": { status: "todo", sort_order: "0|hzzzzz:" },
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

		expect(plan.reason).toBe("boundary");
		expect(plan.additionalWrites).toEqual([]);
		expect(plan.sortOrder).toBeDefined();
		expect(plan.sortOrder!.localeCompare("0|hzzzzz:")).toBeGreaterThan(0);
	});

	it("isolates kanban reorder calculations to the active swimlane scope", async () => {
		const plugin = createPlugin({
			"alpha-a.md": { status: "todo", project: "Alpha", sort_order: "0|hzzzzz:" },
			"alpha-b.md": { status: "todo", project: "Alpha", sort_order: "0|i00007:" },
			"beta-a.md": { status: "todo", project: "Beta", sort_order: "0|zzzzzz:" },
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
		expect(plan.sortOrder!.localeCompare("0|hzzzzz:")).toBeGreaterThan(0);
		expect(plan.sortOrder!.localeCompare("0|i00007:")).toBeLessThan(0);
	});

	it("rebalances oversized sparse scopes into compact ranks", async () => {
		const oversizedRank = `0|zhzzzz:${"i".repeat(120)}`;
		const plugin = createPlugin({
			"seed.md": { status: "todo", sort_order: oversizedRank },
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
		expect(seedRank.localeCompare(rankA)).toBeLessThan(0);
		expect(rankA.localeCompare(plan.sortOrder!)).toBeLessThan(0);
		expect(plan.sortOrder!.localeCompare(rankB)).toBeLessThan(0);
	});
});
