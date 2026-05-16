/**
 * Issues #648 and #1605: render links in task-card context values.
 *
 * Context values are stored as plain strings, and users sometimes store wikilinks,
 * markdown links, or URLs there for people/place/external-reference workflows.
 * Plain contexts should remain tag-search buttons, while link-like contexts should
 * preserve Obsidian/external-link behavior in task cards.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/648
 * @see https://github.com/callumalpass/tasknotes/issues/1605
 */

import {
	normalizeContext,
	renderContextsValue,
	type TagServices,
} from "../../../src/ui/renderers/tagRenderer";
import type { LinkServices } from "../../../src/ui/renderers/linkRenderer";
import { makeContainer } from "../../helpers/dom-helpers";

describe("Issues #648 and #1605: context entries clickable links", () => {
	let container: HTMLElement;
	const linkServices: LinkServices = {
		metadataCache: {
			getFirstLinkpathDest: jest.fn().mockReturnValue(null),
		} as unknown as LinkServices["metadataCache"],
		workspace: {
			trigger: jest.fn(),
			getLeaf: jest.fn().mockReturnValue({ openFile: jest.fn() }),
			openLinkText: jest.fn(),
		} as unknown as LinkServices["workspace"],
		sourcePath: "TaskNotes/Tasks/source.md",
	};

	beforeEach(() => {
		container = makeContainer();
	});

	it("renders a wikilink context as an internal link", () => {
		renderContextsValue(container, ["[[Joe Smith]]"], { linkServices });

		const contextTag = container.querySelector(".context-tag");
		expect(contextTag).not.toBeNull();
		expect(contextTag?.tagName).toBe("SPAN");
		expect(contextTag?.textContent).toBe("@Joe Smith");

		const internalLink = container.querySelector(".internal-link");
		expect(internalLink).not.toBeNull();
		expect(internalLink?.textContent).toBe("Joe Smith");
		expect(internalLink?.getAttribute("data-href")).toBe("Joe Smith");
	});

	it("leaves plain context normalization unchanged", () => {
		expect(normalizeContext("[[Joe Smith]]")).toBe("@JoeSmith");
	});

	it("does not call the plain-context tag handler for link contexts", () => {
		const clickedContexts: string[] = [];
		const tagServices: TagServices = {
			onTagClick: (context) => {
				clickedContexts.push(context);
			},
			linkServices,
		};

		renderContextsValue(container, ["[[Joe Smith]]"], tagServices);
		const internalLink = container.querySelector(".internal-link");
		expect(internalLink).not.toBeNull();

		internalLink?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(clickedContexts).toEqual([]);
	});

	it("keeps plain text contexts as tag buttons", () => {
		renderContextsValue(container, ["work", "home"], { linkServices });

		const contextTags = container.querySelectorAll(".context-tag");
		expect(contextTags.length).toBe(2);
		expect(contextTags[0].tagName).toBe("SPAN");
		expect(contextTags[0].textContent).toBe("@work");
		expect(contextTags[1].textContent).toBe("@home");
		expect(container.querySelectorAll(".internal-link").length).toBe(0);
	});

	it("renders mixed plain and wikilink contexts correctly", () => {
		renderContextsValue(container, ["work", "[[Joe Smith]]", "urgent"], { linkServices });

		const contextTags = container.querySelectorAll(".context-tag");
		expect(contextTags.length).toBe(3);

		const internalLinks = container.querySelectorAll(".internal-link");
		expect(internalLinks.length).toBe(1);
		expect(internalLinks[0].textContent).toBe("Joe Smith");
		expect(container.textContent).toBe("@work, @Joe Smith, @urgent");
	});

	it("renders markdown and bare external URL contexts as external links", () => {
		renderContextsValue(
			container,
			["[Wikipedia](https://en.wikipedia.org/wiki/Main_Page)", "https://example.com/page"],
			{ linkServices }
		);

		const externalLinks = Array.from(container.querySelectorAll("a.external-link"));
		expect(externalLinks).toHaveLength(2);
		expect(externalLinks[0].textContent).toBe("Wikipedia");
		expect(externalLinks[0].getAttribute("href")).toBe(
			"https://en.wikipedia.org/wiki/Main_Page"
		);
		expect(externalLinks[1].textContent).toBe("https://example.com/page");
		expect(externalLinks[1].getAttribute("href")).toBe("https://example.com/page");
	});
});
