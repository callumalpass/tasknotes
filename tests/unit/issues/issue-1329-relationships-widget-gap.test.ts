/**
 * Issue #1329: relationships widget should sit after note content, not after
 * CodeMirror/preview spacer elements.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1329
 */

import {
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
	it("anchors live preview widgets after CodeMirror content and offsets editor spacer gap", () => {
		const sizer = el("cm-sizer");
		const contentContainer = el("cm-contentContainer");
		const cmContent = el("cm-content cm-lineWrapping");
		const firstLine = el("cm-line");
		const lastLine = el("cm-line");
		const backlinks = el("embedded-backlinks");
		const widget = el("tasknotes-relationships-widget");

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
			"-124px"
		);
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
