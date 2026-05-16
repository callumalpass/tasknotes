import { InstantTaskConvertService } from "../../../src/services/InstantTaskConvertService";
import { NaturalLanguageParser } from "../../../src/services/NaturalLanguageParser";
import { PluginFactory } from "../../helpers/mock-factories";

interface BatchParseResult {
	title: string;
	dueDate?: string;
	scheduledDate?: string;
}

interface BatchParser {
	parseTaskForBatch(line: string): Promise<BatchParseResult | null>;
}

describe("Issue #1698: inline and bulk conversion dual date parsing", () => {
	it("parses due and scheduled dates from natural language in either order", () => {
		const parser = new NaturalLanguageParser([], [], false);

		const dueFirst = parser.parseInput(
			"Write report due 2026-03-20 scheduled 2026-03-16"
		);
		expect(dueFirst.title).toBe("Write report");
		expect(dueFirst.dueDate).toBe("2026-03-20");
		expect(dueFirst.scheduledDate).toBe("2026-03-16");

		const scheduledFirst = parser.parseInput(
			"Write report scheduled 2026-03-16 due 2026-03-20"
		);
		expect(scheduledFirst.title).toBe("Write report");
		expect(scheduledFirst.dueDate).toBe("2026-03-20");
		expect(scheduledFirst.scheduledDate).toBe("2026-03-16");
	});

	it("preserves both dates when batch conversion merges checkbox parsing with NLP", async () => {
		const basePlugin = PluginFactory.createMockPlugin();
		const plugin = PluginFactory.createMockPlugin({
			settings: {
				...basePlugin.settings,
				enableNaturalLanguageInput: true,
				nlpDefaultToScheduled: false,
				customStatuses: [],
				customPriorities: [],
			},
		});
		const service = new InstantTaskConvertService(
			plugin,
			plugin.statusManager,
			plugin.priorityManager
		);
		const batchParser = service as unknown as BatchParser;

		const dueFirst = await batchParser.parseTaskForBatch(
			"- [ ] Write report due 2026-03-20 scheduled 2026-03-16"
		);

		expect(dueFirst).toMatchObject({
			title: "Write report",
			dueDate: "2026-03-20",
			scheduledDate: "2026-03-16",
		});

		const scheduledFirst = await batchParser.parseTaskForBatch(
			"- [ ] Write report scheduled 2026-03-16 due 2026-03-20"
		);

		expect(scheduledFirst).toMatchObject({
			title: "Write report",
			dueDate: "2026-03-20",
			scheduledDate: "2026-03-16",
		});
	});
});
