import { createI18nService } from "../../../src/i18n";
import { TFile } from "obsidian";
import { renderGroupTitle } from "../../../src/bases/groupTitleRenderer";
import { convertBasesGroupKeyToLinkTitle } from "../../../src/bases/basesValueConversion";
import type { LinkServices } from "../../../src/ui/renderers/linkRenderer";

/**
 * PR #1545: plain group values must not resolve to unrelated notes by name.
 *
 * Plain values render as links only when they are the exact vault path of a note,
 * written with a folder ("Projects/Alpha") or the extension ("Alpha.md"). Bare names
 * ("STY", "Alpha") stay text; link values keep their link markup via
 * convertBasesGroupKeyToLinkTitle, so root-level project links still render as links.
 */
const notes: Record<string, { file: TFile; title?: string }> = {
	sty: { file: new TFile("Notes/sty.md"), title: "Unrelated note" },
	"work/home": { file: new TFile("Areas/work/home.md") },
	Alpha: { file: new TFile("Alpha.md"), title: "Alpha title" },
};

function makeServices(): LinkServices {
	const lookup = (linkPath: string) =>
		notes[linkPath] ?? notes[linkPath.toLowerCase()] ??
		Object.values(notes).find(({ file }) => file.path === `${linkPath}.md`);
	return {
		translate: (key, params) => createI18nService().translate(key, params),
		metadataCache: {
			getFirstLinkpathDest: jest.fn((linkPath: string) => lookup(linkPath)?.file ?? null),
			getCache: jest.fn((path: string) => {
				const title = Object.values(notes).find(({ file }) => file.path === path)?.title;
				return title ? { frontmatter: { title } } : null;
			}),
		} as unknown as LinkServices["metadataCache"],
		workspace: {
			getLeaf: jest.fn(() => ({ openFile: jest.fn() })),
			openLinkText: jest.fn(),
			trigger: jest.fn(),
		} as unknown as LinkServices["workspace"],
	};
}

function render(title: string): HTMLElement {
	const container = document.createElement("div");
	renderGroupTitle(container, title, makeServices());
	return container;
}

function bases(data: string, markup = data) {
	return { data, toString: () => markup };
}

function list(...items: unknown[]) {
	return { data: items, length: () => items.length, get: (index: number) => items[index] };
}

describe("PR #1545: plain group titles", () => {
	it("renders a plain context as text even when a note with that name exists", () => {
		const container = render("STY");

		expect(container.querySelector("a")).toBeNull();
		expect(container.textContent).toBe("STY");
	});

	it("does not link values that only match a note by name or path suffix", () => {
		expect(render("Alpha").querySelector("a")).toBeNull();
		expect(render("work/home").querySelector("a")).toBeNull();
	});

	it("links exact vault paths with frontmatter titles", () => {
		const link = render("Alpha.md").querySelector("a.task-group-link");

		expect(link?.textContent).toBe("Alpha title");
		expect(link?.getAttribute("data-href")).toBe("Alpha");
	});

	it("keeps explicit links, aliases and frontmatter titles resolving by name", () => {
		expect(render("[[STY]]").querySelector("a")?.textContent).toBe("Unrelated note");
		expect(render("[[STY|Studio]]").querySelector("a")?.textContent).toBe("Studio");
		expect(render("[[Alpha]], [[STY|Studio]]").querySelectorAll("a")).toHaveLength(2);
	});

	it("keeps link markup for Bases link group keys but not plain text keys", () => {
		expect(convertBasesGroupKeyToLinkTitle(list(bases("Alpha", "[[Alpha]]")))).toBe("[[Alpha]]");
		expect(
			convertBasesGroupKeyToLinkTitle(list(bases("Alpha", "[[Alpha]]"), bases("STY", "[[STY]]")))
		).toBe("[[Alpha]], [[STY]]");
		expect(convertBasesGroupKeyToLinkTitle(bases("Alpha", "[[Alpha]]"))).toBe("[[Alpha]]");
		expect(convertBasesGroupKeyToLinkTitle(list(bases("STY")))).toBeNull();
		expect(convertBasesGroupKeyToLinkTitle(list(bases("Alpha", "[[Alpha]]"), bases("STY")))).toBeNull();
	});
});
