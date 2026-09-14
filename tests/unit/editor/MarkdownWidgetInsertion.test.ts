import { afterEach, describe, expect, it } from "@jest/globals";

import {
	getMetadataOrHeaderInsertionReference,
	hasMetadataOrHeaderAnchor,
	insertInsideHeaderAnchor,
} from "../../../src/editor/MarkdownWidgetInsertion";

/**
 * Builds a stand-in for the reading-mode DOM.
 *
 * `withHeader: false` models what Obsidian leaves behind once the reader has scrolled
 * past the top of the note: the header section is detached, and the pusher is followed
 * by whichever section happens to be rendered.
 */
function buildSizer({ withHeader }: { withHeader: boolean }): HTMLElement {
	const scroller = document.createElement("div");
	scroller.className = "markdown-preview-view";

	const sizer = document.createElement("div");
	sizer.className = "markdown-preview-sizer";

	const pusher = document.createElement("div");
	pusher.className = "markdown-preview-pusher";
	sizer.appendChild(pusher);

	if (withHeader) {
		const header = document.createElement("div");
		header.className = "mod-header mod-ui";
		const metadata = document.createElement("div");
		metadata.className = "metadata-container";
		header.appendChild(metadata);
		sizer.appendChild(header);
	}

	const section = document.createElement("div");
	section.className = "el-p";
	section.textContent = "a section the reader is currently looking at";
	sizer.appendChild(section);

	scroller.appendChild(sizer);
	// Attach to the document so `isConnected` means what it says: without this it is
	// false for everything and the survival assertions would pass vacuously.
	document.body.appendChild(scroller);
	return sizer;
}

function widgetEl(): HTMLElement {
	const widget = document.createElement("div");
	widget.className = "tasknotes-task-card-note-widget";
	return widget;
}

/**
 * Obsidian ends every render pass with
 * `sizerEl.setChildrenInPlace([pusherEl, ...shownSections])`, which drops any direct
 * child of the sizer it did not put there. Nested nodes are untouched.
 */
function simulateRenderPass(sizer: HTMLElement): void {
	Array.from(sizer.children).forEach((child) => {
		const keep =
			child.classList.contains("markdown-preview-pusher") ||
			child.className.startsWith("el-") ||
			child.classList.contains("mod-header");
		if (!keep) {
			child.remove();
		}
	});
}

afterEach(() => {
	document.body.innerHTML = "";
});

describe("insertInsideHeaderAnchor", () => {
	it("nests the widget in the header, after the properties block", () => {
		const sizer = buildSizer({ withHeader: true });
		const widget = widgetEl();

		expect(insertInsideHeaderAnchor(sizer, widget)).toBe(true);

		const header = sizer.querySelector(".mod-header") as HTMLElement;
		expect(widget.parentElement).toBe(header);
		expect(Array.from(header.children).map((child) => child.className)).toEqual([
			"metadata-container",
			"tasknotes-task-card-note-widget",
		]);
	});

	it("survives a render pass, which is the whole point", () => {
		const sizer = buildSizer({ withHeader: true });
		const widget = widgetEl();
		insertInsideHeaderAnchor(sizer, widget);

		simulateRenderPass(sizer);

		expect(widget.isConnected).toBe(true);
	});

	it("reports failure when the header has been virtualised away", () => {
		const sizer = buildSizer({ withHeader: false });
		expect(insertInsideHeaderAnchor(sizer, widgetEl())).toBe(false);
	});

	it("waits for the properties block instead of landing above it", () => {
		// Obsidian builds the header in stages. Injecting into a half-built header puts
		// the widget above the properties, which then render underneath and shove it
		// down - a visible jolt on every note open.
		const sizer = buildSizer({ withHeader: true });
		const header = sizer.querySelector(".mod-header") as HTMLElement;
		header.querySelector(".metadata-container")?.remove();

		expect(hasMetadataOrHeaderAnchor(sizer)).toBe(false);
		expect(insertInsideHeaderAnchor(sizer, widgetEl())).toBe(false);
	});
});

describe("hasMetadataOrHeaderAnchor", () => {
	it("is true while the header is rendered", () => {
		expect(hasMetadataOrHeaderAnchor(buildSizer({ withHeader: true }))).toBe(true);
	});

	it("is false once the header has been virtualised away", () => {
		expect(hasMetadataOrHeaderAnchor(buildSizer({ withHeader: false }))).toBe(false);
	});
});

describe("the between-sections placement this replaces", () => {
	it("is deleted by a render pass", () => {
		const sizer = buildSizer({ withHeader: true });
		const widget = widgetEl();
		sizer.insertBefore(widget, getMetadataOrHeaderInsertionReference(sizer));

		simulateRenderPass(sizer);

		expect(widget.isConnected).toBe(false);
	});

	it("lands in the middle of the reader's viewport once the header is gone", () => {
		// The trap behind #2255: with the header detached the insertion reference is the
		// first *rendered* section, so re-injecting drops the widget into the text being
		// read and shoves the page down by the widget's own height.
		const sizer = buildSizer({ withHeader: false });
		const reference = getMetadataOrHeaderInsertionReference(sizer);

		expect((reference as HTMLElement).className).toBe("el-p");
		expect(hasMetadataOrHeaderAnchor(sizer)).toBe(false);
	});
});
