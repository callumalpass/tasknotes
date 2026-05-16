import { TFile } from "obsidian";
import { renderGroupTitle } from "../../../src/bases/groupTitleRenderer";
import type { LinkServices } from "../../../src/ui/renderers/linkRenderer";

function makeServices(): LinkServices {
	const knownPaths = new Set(["Project A", "Project B", "Project A.md", "Project B.md"]);
	return {
		metadataCache: {
			getFirstLinkpathDest: jest.fn((linkPath: string) =>
				knownPaths.has(linkPath) ? new TFile(`${linkPath}.md`) : null
			),
			getCache: jest.fn(() => null),
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

describe("Issue #1566: grouped project links", () => {
	it("renders comma-delimited wikilink group titles as individual links", () => {
		const container = document.createElement("div");

		renderGroupTitle(container, "[[Project A]], [[Project B]]", makeServices());

		const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("a.task-group-link"));
		expect(links).toHaveLength(2);
		expect(links.map((link) => link.textContent)).toEqual(["Project A", "Project B"]);
		expect(links.map((link) => link.getAttribute("data-href"))).toEqual([
			"Project A",
			"Project B",
		]);
		expect(container.textContent).toBe("Project A, Project B");
	});

	it("renders comma-delimited markdown link group titles as individual links", () => {
		const container = document.createElement("div");

		renderGroupTitle(container, "[Project A](Project%20A.md), [Project B](Project B.md)", makeServices());

		const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("a.task-group-link"));
		expect(links).toHaveLength(2);
		expect(links.map((link) => link.textContent)).toEqual(["Project A", "Project B"]);
		expect(links.map((link) => link.getAttribute("data-href"))).toEqual([
			"Project A.md",
			"Project B.md",
		]);
		expect(container.textContent).toBe("Project A, Project B");
	});

	it("keeps mixed link and plain text group titles as plain text", () => {
		const container = document.createElement("div");

		renderGroupTitle(container, "[[Project A]], Unlinked project", makeServices());

		expect(container.querySelector("a.task-group-link")).toBeNull();
		expect(container.textContent).toBe("[[Project A]], Unlinked project");
	});
});
