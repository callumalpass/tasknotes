import { TFile } from "obsidian";
import { renderGroupTitle } from "../../../src/bases/groupTitleRenderer";
import type { LinkServices } from "../../../src/ui/renderers/linkRenderer";

function makeServices(frontmatterTitle?: string): LinkServices {
	const files = new Map([
		["Projects/First project", new TFile("Projects/First project.md")],
		["Projects/Second project", new TFile("Projects/Second project.md")],
	]);

	return {
		metadataCache: {
			getFirstLinkpathDest: jest.fn((linkPath: string) => files.get(linkPath) ?? null),
			getCache: jest.fn(() =>
				frontmatterTitle ? { frontmatter: { title: frontmatterTitle } } : null
			),
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

describe("Issue #508: grouped project path titles", () => {
	it("renders a grouped project file path with the note basename", () => {
		const container = document.createElement("div");

		renderGroupTitle(container, "Projects/First project", makeServices());

		const link = container.querySelector<HTMLAnchorElement>("a.task-group-link");
		expect(link).not.toBeNull();
		expect(link?.textContent).toBe("First project");
		expect(link?.getAttribute("data-href")).toBe("Projects/First project");
	});

	it("renders a grouped project wikilink path with the note basename", () => {
		const container = document.createElement("div");

		renderGroupTitle(container, "[[Projects/First project]]", makeServices());

		const link = container.querySelector<HTMLAnchorElement>("a.task-group-link");
		expect(link).not.toBeNull();
		expect(link?.textContent).toBe("First project");
		expect(link?.getAttribute("data-href")).toBe("Projects/First project");
	});

	it("preserves explicit aliases and frontmatter titles", () => {
		const aliased = document.createElement("div");
		renderGroupTitle(aliased, "[[Projects/First project|Client launch]]", makeServices());
		expect(aliased.textContent).toBe("Client launch");

		const titled = document.createElement("div");
		renderGroupTitle(titled, "[[Projects/Second project]]", makeServices("Renamed project"));
		expect(titled.textContent).toBe("Renamed project");
	});
});
