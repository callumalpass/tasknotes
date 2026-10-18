import type { App } from "obsidian";
import type TaskNotesPlugin from "../../../src/main";
import { ProjectSelectModal } from "../../../src/modals/ProjectSelectModal";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { FileSuggestHelper } from "../../../src/suggest/FileSuggestHelper";
import { MockObsidian } from "../../helpers/obsidian-runtime";

const excludedFolders = ["_src", "Files", "Garden", "Inbox", "Outbox", "Shelf", "Tools"];
const excludedPaths = excludedFolders.flatMap((folder) => [
	`${folder}/Project.md`,
	`${folder}/Nested/Project.md`,
]);
const allowedPaths = ["Projects/Active.md", "InboxOther/Project.md", "Project.md"];

function createPlugin(): TaskNotesPlugin {
	const app = MockObsidian.createMockApp() as unknown as App;
	app.vault.getAllLoadedFiles = jest.fn(() => app.vault.getFiles());
	app.metadataCache.getFileCache = jest.fn(() => ({
		frontmatter: { type: "project", tags: ["project"] },
	}));

	return {
		app,
		settings: {
			...DEFAULT_SETTINGS,
			excludedFolders: excludedFolders.join(", "),
			projectAutosuggest: {
				...DEFAULT_SETTINGS.projectAutosuggest,
				requiredTags: [],
				includeFolders: [],
				propertyKey: "",
				propertyValue: "",
			},
			suggestionDebounceMs: 0,
		},
		fieldMapper: { mapFromFrontmatter: jest.fn(() => ({ title: "" })) },
	} as unknown as TaskNotesPlugin;
}

function getProjectPaths(plugin: TaskNotesPlugin): string[] {
	return new ProjectSelectModal(plugin.app, plugin, jest.fn())
		.getItems()
		.map((file) => file.path)
		.sort();
}

describe("Issue #2390: project picker respects excluded folders", () => {
	let plugin: TaskNotesPlugin;

	beforeEach(async () => {
		MockObsidian.reset();
		plugin = createPlugin();
		for (const path of [...excludedPaths, ...allowedPaths]) {
			await plugin.app.vault.create(path, "");
		}
	});

	it("excludes all configured folders and their descendants without project filters", () => {
		expect(getProjectPaths(plugin)).toEqual([...allowedPaths].sort());
	});

	it("normalizes whitespace and folder separators without excluding similarly named folders", () => {
		plugin.settings.excludedFolders = " /Inbox/ , \\Projects\\ , Inbox, , ";

		expect(getProjectPaths(plugin)).toEqual(
			[
				...excludedPaths.filter((path) => !path.startsWith("Inbox/")),
				"InboxOther/Project.md",
				"Project.md",
			].sort()
		);
	});

	it.each(["", " , ", undefined])("preserves candidates when exclusions are %p", (folders) => {
		if (folders === undefined) {
			Reflect.deleteProperty(plugin.settings, "excludedFolders");
		} else {
			plugin.settings.excludedFolders = folders;
		}

		expect(getProjectPaths(plugin)).toEqual([...excludedPaths, ...allowedPaths].sort());
	});

	it("gives exclusions precedence over included folders", () => {
		plugin.settings.projectAutosuggest.includeFolders = ["Inbox", "Projects"];

		expect(getProjectPaths(plugin)).toEqual(["Projects/Active.md"]);
	});

	it("applies exclusions alongside tag and property filters", () => {
		plugin.settings.projectAutosuggest.requiredTags = ["project"];
		plugin.settings.projectAutosuggest.propertyKey = "type";
		plugin.settings.projectAutosuggest.propertyValue = "project";
		plugin.app.metadataCache.getFileCache = jest.fn((file) => ({
			frontmatter: {
				type: file.path === "Project.md" ? "note" : "project",
				tags: file.path === "InboxOther/Project.md" ? ["note"] : ["project"],
			},
		}));

		expect(getProjectPaths(plugin)).toEqual(["Projects/Active.md"]);
	});

	it("reads changed exclusions when retrieving candidates again", () => {
		const modal = new ProjectSelectModal(plugin.app, plugin, jest.fn());
		expect(modal.getItems().map((file) => file.path)).not.toContain("Inbox/Project.md");

		plugin.settings.excludedFolders = "Projects";
		const paths = modal.getItems().map((file) => file.path);
		expect(paths).toContain("Inbox/Project.md");
		expect(paths).not.toContain("Projects/Active.md");
	});

	it("matches inline suggestions for folder exclusions", async () => {
		plugin.app.metadataCache.fileToLinktext = jest.fn((file) => file.path);
		const inline = await FileSuggestHelper.suggest(
			plugin,
			"",
			50,
			plugin.settings.projectAutosuggest
		);

		expect(getProjectPaths(plugin)).toEqual(inline.map((item) => item.path).sort());
	});
});
