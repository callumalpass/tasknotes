/**
 * Issue #1329: relationships widget should sit after note content, not after
 * CodeMirror/preview spacer elements.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1329
 */

import {
	applyRelationshipsBottomOffset,
	findRelationshipsBottomAnchor,
	insertRelationshipsWidgetAtBottom,
} from "../../../src/editor/RelationshipsDecorations";

beforeAll(() => {
	if (typeof Element.prototype.instanceOf !== "function") {
		Object.defineProperty(Element.prototype, "instanceOf", {
			value(this: Element, constructor: typeof HTMLElement) {
				return this instanceof constructor;
			},
			configurable: true,
		});
	}
});

function el(className: string): HTMLElement {
	const element = document.createElement("div");
	if (className) {
		element.className = className;
	}
	return element;
}

describe("Issue #1329: relationships widget bottom placement", () => {
	it("anchors live preview widgets after CodeMirror content and preserves normal spacing", () => {
		const sizer = el("cm-sizer");
		const contentContainer = el("cm-contentContainer");
		const cmContent = el("cm-content cm-lineWrapping");
		const firstLine = el("cm-line");
		const lastLine = el("cm-line");
		const backlinks = el("embedded-backlinks");
		const widget = el("tasknotes-relationships-widget");
		widget.style.marginTop = "24px";

		cmContent.append(firstLine, lastLine);
		contentContainer.append(cmContent);
		sizer.append(contentContainer, backlinks);

		Object.defineProperty(contentContainer, "getBoundingClientRect", {
			value: () => ({ bottom: 224 }),
		});
		Object.defineProperty(lastLine, "getBoundingClientRect", {
			value: () => ({ bottom: 100 }),
		});

		expect(findRelationshipsBottomAnchor(sizer)).toBe(contentContainer);

		insertRelationshipsWidgetAtBottom(sizer, widget);

		expect(widget.parentElement).toBe(sizer);
		expect(widget.previousElementSibling).toBe(contentContainer);
		expect(widget.nextElementSibling).toBe(backlinks);
		expect(widget.style.getPropertyValue("--tn-relationships-widget-margin-top")).toBe(
			"-100px"
		);
	});

	it("recomputes the live preview offset when editor content grows", () => {
		const sizer = el("cm-sizer");
		const contentContainer = el("cm-contentContainer");
		const cmContent = el("cm-content cm-lineWrapping");
		const lastLine = el("cm-line");
		const widget = el("tasknotes-relationships-widget");
		let lastLineBottom = 100;
		widget.style.marginTop = "24px";

		cmContent.append(lastLine);
		contentContainer.append(cmContent);
		sizer.append(contentContainer, widget);

		Object.defineProperty(contentContainer, "getBoundingClientRect", {
			value: () => ({ bottom: 224 }),
		});
		Object.defineProperty(lastLine, "getBoundingClientRect", {
			value: () => ({ bottom: lastLineBottom }),
		});

		applyRelationshipsBottomOffset(sizer, widget);
		expect(widget.style.getPropertyValue("--tn-relationships-widget-margin-top")).toBe(
			"-100px"
		);

		lastLineBottom = 210;
		applyRelationshipsBottomOffset(sizer, widget);
		expect(widget.style.getPropertyValue("--tn-relationships-widget-margin-top")).toBe(
			"10px"
		);

		lastLineBottom = 224;
		applyRelationshipsBottomOffset(sizer, widget);
		expect(widget.style.getPropertyValue("--tn-relationships-widget-margin-top")).toBe("");
	});

	it("uses rendered descendants when embedded content extends below the line box", () => {
		const sizer = el("cm-sizer");
		const contentContainer = el("cm-contentContainer");
		const cmContent = el("cm-content cm-lineWrapping");
		const lastLine = el("cm-line");
		const embed = el("internal-embed bases-embed");
		const widget = el("tasknotes-relationships-widget");
		widget.style.marginTop = "24px";

		lastLine.append(embed);
		cmContent.append(lastLine);
		contentContainer.append(cmContent);
		sizer.append(contentContainer, widget);

		Object.defineProperty(contentContainer, "getBoundingClientRect", {
			value: () => ({ bottom: 224 }),
		});
		Object.defineProperty(lastLine, "getBoundingClientRect", {
			value: () => ({ bottom: 100, width: 100, height: 20 }),
		});
		Object.defineProperty(embed, "getBoundingClientRect", {
			value: () => ({ bottom: 220, width: 100, height: 120 }),
		});

		applyRelationshipsBottomOffset(sizer, widget);

		expect(widget.style.getPropertyValue("--tn-relationships-widget-margin-top")).toBe("20px");
	});

	it("anchors reading mode widgets after the last content section", () => {
		const sizer = el("markdown-preview-sizer");
		const firstSection = el("markdown-preview-section");
		const lastSection = el("markdown-preview-section");
		const pusher = el("markdown-preview-pusher");
		const widget = el("tasknotes-relationships-widget");

		sizer.append(firstSection, lastSection, pusher);

		expect(findRelationshipsBottomAnchor(sizer)).toBe(lastSection);

		insertRelationshipsWidgetAtBottom(sizer, widget);

		expect(widget.parentElement).toBe(sizer);
		expect(widget.previousElementSibling).toBe(lastSection);
		expect(widget.nextElementSibling).toBe(pusher);
	});

	it("falls back to appending when no content anchor exists", () => {
		const sizer = el("markdown-preview-sizer");
		const widget = el("tasknotes-relationships-widget");

		insertRelationshipsWidgetAtBottom(sizer, widget);

		expect(widget.parentElement).toBe(sizer);
		expect(sizer.lastElementChild).toBe(widget);
	});
});
