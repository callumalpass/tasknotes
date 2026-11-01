import { TFile } from "obsidian";
import { createI18nService } from "../../../src/i18n";
import {
	renderProjectLinks,
	renderTextWithLinks,
	type LinkServices,
} from "../../../src/ui/renderers/linkRenderer";
import { makeContainer } from "../../helpers/dom-helpers";

const SOURCE_PATH = "Tasks/Task.md";

function createServices(files: Record<string, TFile>) {
	const openFile = jest.fn().mockResolvedValue(undefined);
	const getFirstLinkpathDest = jest.fn(
		(linkpath: string, sourcePath: string): TFile | null => {
			// Relative links only resolve against the task's own folder.
			if (linkpath.startsWith("../")) {
				return sourcePath === SOURCE_PATH ? files[linkpath.slice(3)] ?? null : null;
			}
			return files[linkpath] ?? files[`${linkpath}.md`] ?? null;
		}
	);
	const services: LinkServices = {
		translate: (key, params) => createI18nService().translate(key, params),
		metadataCache: {
			getFirstLinkpathDest,
			getCache: jest.fn().mockReturnValue(null),
		} as unknown as LinkServices["metadataCache"],
		workspace: {
			trigger: jest.fn(),
			getLeaf: jest.fn().mockReturnValue({ openFile }),
			openLinkText: jest.fn(),
		} as unknown as LinkServices["workspace"],
		sourcePath: SOURCE_PATH,
	};
	return { services, openFile, getFirstLinkpathDest };
}

async function click(link: HTMLAnchorElement, init: MouseEventInit = {}): Promise<void> {
	link.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init }));
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("link renderer heading and block subpaths", () => {
	const note = new TFile("Folder/My Note.md");
	const task = new TFile(SOURCE_PATH);
	const files = { "Folder/My Note.md": note, [SOURCE_PATH]: task };

	it.each([
		["[[Folder/My Note#Section]]", "#Section"],
		["[[Folder/My Note#^abc123|Alias]]", "#^abc123"],
		["[[<Folder/My%20Note.md#Section>]]", "#Section"],
		["[x](<Folder/My%20Note.md#Section>)", "#Section"],
		["[x](Folder/My%20Note.md#^abc123)", "#^abc123"],
	])("opens %s at its subpath", async (text, subpath) => {
		const { services, openFile } = createServices(files);
		const container = makeContainer();
		renderTextWithLinks(container, text, services);

		const link = container.querySelector<HTMLAnchorElement>("a.internal-link")!;
		expect(link.getAttribute("data-href")).toMatch(/^Folder\/My Note(\.md)?$/);
		await click(link);

		expect(openFile).toHaveBeenCalledWith(note, { eState: { subpath } });
	});

	it("opens a bare block link in the source note", async () => {
		const { services, openFile } = createServices(files);
		const container = makeContainer();
		renderTextWithLinks(container, "[[#^abc123]]", services);

		await click(container.querySelector<HTMLAnchorElement>("a.internal-link")!);

		expect(openFile).toHaveBeenCalledWith(task, { eState: { subpath: "#^abc123" } });
	});

	it("keeps the subpath for ctrl-click and hover", () => {
		const { services } = createServices(files);
		const container = makeContainer();
		renderTextWithLinks(container, "[[Folder/My Note#Section]]", services);
		const link = container.querySelector<HTMLAnchorElement>("a.internal-link")!;

		link.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true }));
		link.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));

		expect(services.workspace.openLinkText).toHaveBeenCalledWith(
			"Folder/My Note#Section",
			SOURCE_PATH,
			true
		);
		expect(services.workspace.trigger).toHaveBeenCalledWith(
			"hover-link",
			expect.objectContaining({ linktext: "Folder/My Note#Section" })
		);
	});

	it("opens project links at their subpath", async () => {
		const { services, openFile } = createServices(files);
		const container = makeContainer();
		renderProjectLinks(
			container,
			["[[Folder/My Note#Section|Project]]", "[x](<Folder/My%20Note.md#^abc123>)"],
			services
		);

		const links = Array.from(container.querySelectorAll<HTMLAnchorElement>("a.internal-link"));
		expect(links.map((link) => link.textContent)).toEqual(["Project", "x"]);
		await click(links[0]);
		await click(links[1]);

		expect(openFile).toHaveBeenNthCalledWith(1, note, { eState: { subpath: "#Section" } });
		expect(openFile).toHaveBeenNthCalledWith(2, note, { eState: { subpath: "#^abc123" } });
	});

	it("opens links without a subpath as before", async () => {
		const { services, openFile } = createServices(files);
		const container = makeContainer();
		renderTextWithLinks(container, "[[Folder/My Note|Alias]]", services);

		await click(container.querySelector<HTMLAnchorElement>("a.internal-link")!);

		expect(openFile).toHaveBeenCalledWith(note);
	});
});
