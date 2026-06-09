import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import { DependencyCache } from "../../../src/utils/DependencyCache";
import { MockObsidian } from "../../helpers/obsidian-runtime";

describe("Issue #1878: completed blockers should not appear as active blockers", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("does not report dependent tasks as actively blocked by a completed task", async () => {
		const app = MockObsidian.createMockApp();
		MockObsidian.createTestFile(
			"Tasks/blocker.md",
			"---\ntitle: Blocker\nstatus: done\ntags:\n  - task\n---\n"
		);
		MockObsidian.createTestFile(
			"Tasks/dependent.md",
			"---\ntitle: Dependent\nstatus: open\ntags:\n  - task\nblockedBy:\n  - uid: '[[blocker]]'\n    reltype: FINISHTOSTART\n---\n"
		);

		const blockerFile = app.vault.getAbstractFileByPath("Tasks/blocker.md");
		const dependentFile = app.vault.getAbstractFileByPath("Tasks/dependent.md");
		app.metadataCache.setCache("Tasks/blocker.md", {
			frontmatter: { title: "Blocker", status: "done", tags: ["task"] },
		});
		app.metadataCache.setCache("Tasks/dependent.md", {
			frontmatter: {
				title: "Dependent",
				status: "open",
				tags: ["task"],
				blockedBy: [{ uid: "[[blocker]]", reltype: "FINISHTOSTART" }],
			},
		});
		app.metadataCache.getFirstLinkpathDest = jest.fn((linkpath: string) => {
			if (linkpath === "blocker") return blockerFile;
			if (linkpath === "dependent") return dependentFile;
			return null;
		});

		const dependencyCache = new DependencyCache(
			app,
			{} as never,
			new FieldMapper(DEFAULT_FIELD_MAPPING),
			{ isCompletedStatus: jest.fn((status: string) => status === "done") } as never,
			(frontmatter) => Array.isArray((frontmatter as { tags?: unknown }).tags)
		);

		await dependencyCache.buildIndexes();

		expect(dependencyCache.isTaskBlocked("Tasks/dependent.md")).toBe(false);
		expect(dependencyCache.getBlockedTaskPaths("Tasks/blocker.md")).toEqual([]);
	});
});
