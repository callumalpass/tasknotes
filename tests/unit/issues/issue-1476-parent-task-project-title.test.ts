/**
 * @see https://github.com/callumalpass/tasknotes/issues/1476
 */

import { TFile } from "obsidian";
import { renderGroupTitle } from "../../../src/bases/groupTitleRenderer";
import { getProjectDisplayName } from "../../../src/utils/linkUtils";
import type { LinkServices } from "../../../src/ui/renderers/linkRenderer";

function makeAppWithTaskTitle(title = "Homework") {
	const file = new TFile("TaskNotes/Tasks/202601132359.md");
	return {
		metadataCache: {
			getFirstLinkpathDest: jest.fn(() => file),
			getFileCache: jest.fn(() => ({ frontmatter: { title } })),
			getCache: jest.fn(() => ({ frontmatter: { title } })),
		},
	} as any;
}

function makeLinkServices(title = "Homework"): LinkServices {
	const file = new TFile("TaskNotes/Tasks/202601132359.md");
	return {
		metadataCache: {
			getFirstLinkpathDest: jest.fn(() => file),
			getCache: jest.fn(() => ({ frontmatter: { title } })),
		} as unknown as LinkServices["metadataCache"],
		workspace: {
			getLeaf: jest.fn(() => ({
				openFile: jest.fn(),
			})),
			openLinkText: jest.fn(),
			trigger: jest.fn(),
		} as unknown as LinkServices["workspace"],
	};
}

describe("issue #1476 parent-task project title rendering", () => {
	it("uses a linked task's frontmatter title instead of its timestamp filename", () => {
		const app = makeAppWithTaskTitle("Homework");

		expect(getProjectDisplayName("[[TaskNotes/Tasks/202601132359]]", app)).toBe(
			"Homework"
		);
	});

	it("uses the frontmatter title for generated markdown links whose display is the basename", () => {
		const app = makeAppWithTaskTitle("Homework");

		expect(
			getProjectDisplayName(
				"[202601132359](TaskNotes/Tasks/202601132359.md)",
				app
			)
		).toBe("Homework");
	});

	it("keeps explicit markdown aliases", () => {
		const app = makeAppWithTaskTitle("Homework");

		expect(
			getProjectDisplayName("[Assignment](TaskNotes/Tasks/202601132359.md)", app)
		).toBe("Assignment");
	});

	it("renders Bases group titles with the linked task title", () => {
		const container = document.createElement("div");

		renderGroupTitle(
			container,
			"[202601132359](TaskNotes/Tasks/202601132359.md)",
			makeLinkServices()
		);

		const link = container.querySelector<HTMLAnchorElement>("a.task-group-link");
		expect(link).not.toBeNull();
		expect(link?.textContent).toBe("Homework");
	});
});
