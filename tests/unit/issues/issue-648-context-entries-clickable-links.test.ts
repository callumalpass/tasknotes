/**
 * Issue #648: [FR] Make context entries clickable links
 *
 * Feature Request Description:
 * When a wikilink like `[[Joe Smith]]` is entered in the context field of a task,
 * it is stored correctly as a clickable link in the task note properties. However,
 * in Task View, Kanban View, and other views, it displays as `@JoeSmith` — a colored
 * tag span that opens the tag search pane on click, rather than a clickable internal
 * link that navigates to the referenced note.
 *
 * Current Behavior:
 * - Context entries are always rendered as `<span>` elements with class `context-tag`
 *   and role="button" via `renderContextsValue()` in tagRenderer.ts
 * - Clicking a context opens the tag search pane (`plugin.openTagsPane('#contextname')`)
 * - The `normalizeContext()` function strips spaces and non-alphanumeric characters,
 *   converting `[[Joe Smith]]` → `@JoeSmith` (losing the link semantics)
 * - No file navigation or hover preview is available for contexts
 *
 * Expected Behavior:
 * - If a context value contains a wikilink (e.g. `[[Joe Smith]]`), it should be
 *   rendered as an internal link (similar to how projects render via `appendInternalLink()`)
 * - The rendered link should be clickable, navigating to the referenced note
 * - Hover preview should work (like project links)
 * - Plain text contexts (without wikilinks) can continue to work as tag buttons
 *
 * Related Components:
 * - `renderContextsValue()` in src/ui/renderers/tagRenderer.ts (lines 69-149)
 * - `renderProjectLinks()` in src/ui/renderers/linkRenderer.ts (lines 355-423) — reference impl
 * - `PROPERTY_RENDERERS['contexts']` in src/ui/TaskCard.ts (lines 729-742)
 * - `normalizeContext()` in src/ui/renderers/tagRenderer.ts (lines 207-223)
 *
 * @see https://github.com/callumalpass/tasknotes/issues/648
 */

import { renderContextsValue, normalizeContext, TagServices } from "../../../src/ui/renderers/tagRenderer";

describe("Issue #648: Make context entries clickable links", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
	});

	it.skip("reproduces issue #648: wikilink context is rendered as plain tag instead of internal link", () => {
		/**
		 * When a context value is a wikilink like `[[Joe Smith]]`, the current
		 * `renderContextsValue()` normalizes it to `@JoeSmith` and renders it
		 * as a plain span tag. It should instead detect the wikilink format and
		 * render it as a clickable internal link (like projects do).
		 */
		const contexts = ["[[Joe Smith]]"];
		renderContextsValue(container, contexts);

		// Current behavior: renders as a span.context-tag with text "@JoeSmith"
		const contextTag = container.querySelector(".context-tag");
		expect(contextTag).not.toBeNull();
		expect(contextTag?.tagName).toBe("SPAN");
		expect(contextTag?.textContent).toBe("@JoeSmith");

		// Expected behavior (currently fails): should render as an internal link
		// that navigates to the "Joe Smith" note
		const internalLink = container.querySelector(".internal-link");
		expect(internalLink).not.toBeNull(); // FAILS: no internal link is rendered
	});

	it.skip("reproduces issue #648: wikilink context loses spaces in display text", () => {
		/**
		 * The normalizeContext() function strips spaces from context values,
		 * converting "Joe Smith" to "JoeSmith". While this is fine for plain
		 * text contexts used as tags, wikilink contexts should preserve the
		 * original display text (with spaces) since they represent note names.
		 */
		const result = normalizeContext("[[Joe Smith]]");

		// Current behavior: normalizeContext strips brackets and spaces
		// producing "@JoeSmith" (CamelCase, no spaces)
		expect(result).toBe("@JoeSmith");

		// Expected behavior: for wikilink contexts, the display text should
		// preserve spaces, e.g. "@Joe Smith" or the wikilink should be
		// handled separately before normalization
		// expect(result).toContain("Joe Smith");
	});

	it.skip("reproduces issue #648: context click opens tag pane instead of navigating to note", () => {
		/**
		 * When a context contains a wikilink, clicking it should navigate to
		 * the linked note (like project links do), not open the tag search pane.
		 *
		 * Currently, the onTagClick handler in TaskCard.ts always does:
		 *   plugin.openTagsPane(`#${searchTag}`)
		 * regardless of whether the original context value was a wikilink.
		 */
		const clickedContexts: string[] = [];
		const tagServices: TagServices = {
			onTagClick: (context) => {
				clickedContexts.push(context);
			},
		};

		const contexts = ["[[Joe Smith]]"];
		renderContextsValue(container, contexts, tagServices);

		// Click the rendered context
		const contextTag = container.querySelector(".context-tag");
		expect(contextTag).not.toBeNull();

		contextTag?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		// Current behavior: onTagClick is called with "@JoeSmith"
		// which then gets used to search tags via openTagsPane("#JoeSmith")
		expect(clickedContexts).toContain("@JoeSmith");

		// Expected behavior: for wikilink contexts, clicking should navigate
		// to the "Joe Smith" note file, not trigger a tag search
	});

	it.skip("reproduces issue #648: plain text contexts should continue working as tag buttons", () => {
		/**
		 * While wikilink contexts should become internal links, plain text
		 * contexts like "work" or "home" should continue to work as they
		 * currently do (colored tag spans with tag search on click).
		 * This test documents the expected backward-compatible behavior.
		 */
		const contexts = ["work", "home"];
		renderContextsValue(container, contexts);

		const contextTags = container.querySelectorAll(".context-tag");
		expect(contextTags.length).toBe(2);

		// Plain text contexts should remain as span tags
		expect(contextTags[0].tagName).toBe("SPAN");
		expect(contextTags[0].textContent).toBe("@work");
		expect(contextTags[1].textContent).toBe("@home");

		// They should NOT be internal links
		const internalLinks = container.querySelectorAll(".internal-link");
		expect(internalLinks.length).toBe(0);
	});

	it.skip("reproduces issue #648: mixed plain and wikilink contexts should render correctly", () => {
		/**
		 * When a task has both plain text contexts and wikilink contexts,
		 * each should render in its appropriate format:
		 * - Plain text → colored tag span (current behavior)
		 * - Wikilink → clickable internal link (requested feature)
		 */
		const contexts = ["work", "[[Joe Smith]]", "urgent"];
		renderContextsValue(container, contexts);

		const allElements = container.children;
		// Should have 3 context elements plus 2 separator text nodes
		// Currently all render as span.context-tag

		// Expected: "work" and "urgent" as context-tag spans
		// Expected: "[[Joe Smith]]" as an internal-link anchor
		const internalLinks = container.querySelectorAll(".internal-link");
		expect(internalLinks.length).toBe(1); // FAILS: currently 0
	});
});
