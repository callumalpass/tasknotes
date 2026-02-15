import { appendInternalLink } from "../../../src/ui/renderers/linkRenderer";

jest.mock("obsidian");

describe("linkRenderer - anchors", () => {
	const createDeps = () => {
		const openLinkText = jest.fn();
		return {
			metadataCache: {
				getFirstLinkpathDest: jest.fn(() => null),
			},
			workspace: {
				openLinkText,
				getLeaf: jest.fn(() => ({ openFile: jest.fn() })),
				trigger: jest.fn(),
			},
			sourcePath: "Projects/Parent.md",
		};
	};

	it("preserves anchor fragments on internal links", () => {
		const container = document.createElement("div");
		const deps = createDeps();

		appendInternalLink(container, "Folder/Note#Section", "Note", deps as any);

		const linkEl = container.querySelector("a") as HTMLAnchorElement;
		expect(linkEl).toBeTruthy();
		expect(linkEl.getAttribute("data-href")).toBe("Folder/Note");
		expect(linkEl.getAttribute("data-href-fragment")).toBe("#Section");

		linkEl.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
		expect(deps.workspace.openLinkText).toHaveBeenCalledWith(
			"Folder/Note#Section",
			"Projects/Parent.md",
			false
		);
	});

	it("does not add fragment attribute when no anchor is present", () => {
		const container = document.createElement("div");
		const deps = createDeps();

		appendInternalLink(container, "Folder/Note", "Note", deps as any);

		const linkEl = container.querySelector("a") as HTMLAnchorElement;
		expect(linkEl).toBeTruthy();
		expect(linkEl.getAttribute("data-href")).toBe("Folder/Note");
		expect(linkEl.hasAttribute("data-href-fragment")).toBe(false);
	});
});
