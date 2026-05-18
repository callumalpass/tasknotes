import { TFile } from "obsidian";
import {
	addTaskModalProjectItemsFromStrings,
	createTaskModalProjectItemFromFile,
	createTaskModalProjectItemFromString,
	getTaskModalProjectDedupKeys,
	getTaskModalProjectsValue,
	hasTaskModalProjectItem,
	normalizeTaskModalProjectPath,
	removeTaskModalProjectItem,
	renderTaskModalProjectsList,
	type TaskModalProjectStringContext,
} from "../../../src/modals/taskModalProjects";

function file(path: string): TFile {
	return new TFile(path);
}

function createContext(
	files: TFile[] = [],
	resolved: Record<string, TFile | undefined> = {}
): TaskModalProjectStringContext {
	return {
		sourcePath: "Tasks/current.md",
		getMarkdownFiles: () => files,
		resolveLink: (linkPath) => resolved[linkPath],
	};
}

function createApp(files: Record<string, TFile> = {}): any {
	return {
		metadataCache: {
			fileToLinktext: (targetFile: TFile) => targetFile.path.replace(/\.md$/i, ""),
			getFirstLinkpathDest: (linkPath: string) =>
				files[linkPath] ?? files[`${linkPath}.md`] ?? null,
			getCache: () => ({}),
		},
		workspace: {
			getLeaf: () => ({ openFile: jest.fn() }),
			openLinkText: jest.fn(),
			trigger: jest.fn(),
		},
		fileManager: {
			generateMarkdownLink: (targetFile: TFile) => `[${targetFile.basename}](${targetFile.path})`,
		},
	};
}

describe("taskModalProjects", () => {
	it("creates project items from selected files", () => {
		const projectFile = file("Projects/Alpha.md");

		expect(createTaskModalProjectItemFromFile(projectFile, "[[Projects/Alpha]]")).toEqual({
			file: projectFile,
			name: "Alpha",
			link: "[[Projects/Alpha]]",
		});
	});

	it("resolves wiki and markdown project links when possible", () => {
		const alpha = file("Projects/Alpha.md");
		const beta = file("Projects/Beta.md");
		const context = createContext([], {
			"Projects/Alpha": alpha,
			"Projects/Beta.md": beta,
		});

		expect(createTaskModalProjectItemFromString("[[Projects/Alpha]]", context)).toEqual({
			file: alpha,
			name: "Alpha",
			link: "[[Projects/Alpha]]",
		});
		expect(createTaskModalProjectItemFromString("[Beta](Projects/Beta.md)", context)).toEqual({
			file: beta,
			name: "Beta",
			link: "[Beta](Projects/Beta.md)",
		});
	});

	it("preserves unresolved wiki, markdown, and plain project values", () => {
		const context = createContext();

		expect(createTaskModalProjectItemFromString("[[Projects/Missing|Alias]]", context)).toEqual({
			name: "Projects/Missing",
			link: "[[Projects/Missing|Alias]]",
			unresolved: true,
		});
		expect(createTaskModalProjectItemFromString("[Missing](Projects/Missing.md)", context)).toEqual({
			name: "Missing",
			link: "[Missing](Projects/Missing.md)",
			unresolved: true,
		});
		expect(createTaskModalProjectItemFromString("Loose project", context)).toEqual({
			name: "Loose project",
			link: "Loose project",
			unresolved: true,
		});
		expect(createTaskModalProjectItemFromString("", context)).toBeNull();
	});

	it("matches plain project names against markdown files for backwards compatibility", () => {
		const alpha = file("Projects/Alpha.md");
		const context = createContext([alpha]);

		expect(createTaskModalProjectItemFromString("Alpha", context)).toEqual({
			file: alpha,
			name: "Alpha",
			link: "[[Alpha]]",
		});
	});

	it("deduplicates project items by resolved path and exact link", () => {
		const alpha = file("Projects/Alpha.md");
		const existing = [
			createTaskModalProjectItemFromFile(alpha, "[[Projects/Alpha]]"),
			{ name: "Loose", link: "Loose", unresolved: true },
		];

		expect(
			hasTaskModalProjectItem(existing, {
				file: alpha,
				name: "Alpha",
				link: "[[Alpha]]",
			})
		).toBe(true);
		expect(
			hasTaskModalProjectItem(existing, {
				name: "Loose copy",
				link: " loose ",
				unresolved: true,
			})
		).toBe(true);
		expect(
			hasTaskModalProjectItem(existing, {
				name: "Other",
				link: "Other",
				unresolved: true,
			})
		).toBe(false);
	});

	it("adds project strings without duplicating existing items and serializes the value", () => {
		const alpha = file("Projects/Alpha.md");
		const beta = file("Projects/Beta.md");
		const context = createContext([alpha, beta], { "Projects/Alpha": alpha });
		const existing = [createTaskModalProjectItemFromFile(alpha, "[[Projects/Alpha]]")];

		const items = addTaskModalProjectItemsFromStrings(
			existing,
			["[[Projects/Alpha]]", "Beta", "Loose"],
			context
		);

		expect(items.map((item) => item.link)).toEqual([
			"[[Projects/Alpha]]",
			"[[Beta]]",
			"Loose",
		]);
		expect(getTaskModalProjectsValue(items)).toBe("[[Projects/Alpha]], [[Beta]], Loose");
	});

	it("removes project items by identity", () => {
		const alpha = createTaskModalProjectItemFromFile(file("Projects/Alpha.md"), "[[Alpha]]");
		const beta = createTaskModalProjectItemFromFile(file("Projects/Beta.md"), "[[Beta]]");

		expect(removeTaskModalProjectItem([alpha, beta], alpha)).toEqual([beta]);
	});

	it("normalizes dedup paths consistently", () => {
		expect(normalizeTaskModalProjectPath(" Projects/Alpha.md ")).toBe("projects/alpha");
		expect(getTaskModalProjectDedupKeys({ name: "Alpha", link: "[[Projects/Alpha]]" })).toEqual([
			"path:projects/alpha",
			"link:[[projects/alpha]]",
		]);
	});

	it("renders resolved and unresolved project list items with remove controls", () => {
		const alpha = file("Projects/Alpha.md");
		const container = document.createElement("div");
		const onRemove = jest.fn();

		renderTaskModalProjectsList({
			app: createApp({ "Projects/Alpha": alpha }),
			listEl: container,
			items: [
				createTaskModalProjectItemFromFile(alpha, "[[Projects/Alpha]]"),
				{ name: "Missing project", link: "Missing project", unresolved: true },
			],
			sourcePath: "Tasks/current.md",
			translate: (key) => `translated:${key}`,
			onRemove,
		});

		expect(container.querySelectorAll(".task-project-item")).toHaveLength(2);
		expect(container.querySelector(".task-card__project-link")?.textContent).toBe("Alpha.md");
		expect(container.querySelector(".task-project-path")?.textContent).toBe(
			"Projects/Alpha.md"
		);
		expect(container.querySelector(".task-project-item--unresolved")?.textContent).toContain(
			"Missing project"
		);
		expect(container.textContent).not.toContain("+Alpha");

		container.querySelector<HTMLButtonElement>(".task-project-remove")?.click();
		expect(onRemove).toHaveBeenCalledWith(
			expect.objectContaining({ file: alpha, link: "[[Projects/Alpha]]" })
		);
	});

	it("clears the rendered project list when no items are selected", () => {
		const container = document.createElement("div");
		container.textContent = "stale";

		renderTaskModalProjectsList({
			app: createApp(),
			listEl: container,
			items: [],
			sourcePath: "Tasks/current.md",
			translate: (key) => key,
			onRemove: jest.fn(),
		});

		expect(container.textContent).toBe("");
	});
});
