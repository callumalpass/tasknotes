import { describe, it, expect } from "@jest/globals";
import {
	insertAfterElement,
	insertAfterMetadataOrHeader,
} from "../../../src/editor/MarkdownWidgetInsertion";

describe("Issue #1719: Reading mode task card position on Obsidian 1.12.x", () => {
	function el(label: string, className = ""): HTMLElement {
		const element = document.createElement("div");
		element.dataset.label = label;
		element.className = className;
		return element;
	}

	function labels(container: HTMLElement): string[] {
		return Array.from(container.children).map(
			(child) => (child as HTMLElement).dataset.label || ""
		);
	}

	it("inserts after direct metadata in the older reading-mode DOM", () => {
		const sizer = el("sizer", "markdown-preview-sizer");
		const metadata = el("metadata", "metadata-container");
		const content = el("content");
		const widget = el("widget");

		sizer.append(metadata, content);

		insertAfterMetadataOrHeader(sizer, widget);

		expect(labels(sizer)).toEqual(["metadata", "widget", "content"]);
	});

	it("inserts after Obsidian 1.12 mod-header when metadata is nested inside it", () => {
		const sizer = el("sizer", "markdown-preview-sizer");
		const pusher = el("pusher", "markdown-preview-pusher");
		const header = el("header", "mod-header mod-ui");
		const title = el("title", "inline-title");
		const metadata = el("metadata", "metadata-container");
		const content = el("content");
		const widget = el("widget");

		header.append(title, metadata);
		sizer.append(pusher, header, content);

		insertAfterMetadataOrHeader(sizer, widget);

		expect(labels(sizer)).toEqual(["pusher", "header", "widget", "content"]);
		expect(labels(header)).toEqual(["title", "metadata"]);
	});

	it("appends after the Obsidian 1.12 header when there is no following content yet", () => {
		const sizer = el("sizer", "markdown-preview-sizer");
		const pusher = el("pusher", "markdown-preview-pusher");
		const header = el("header", "mod-header mod-ui");
		const metadata = el("metadata", "metadata-container");
		const widget = el("widget");

		header.append(metadata);
		sizer.append(pusher, header);

		insertAfterMetadataOrHeader(sizer, widget);

		expect(labels(sizer)).toEqual(["pusher", "header", "widget"]);
	});

	it("keeps Obsidian preview pusher before the widget when no header or metadata is present", () => {
		const sizer = el("sizer", "markdown-preview-sizer");
		const pusher = el("pusher", "markdown-preview-pusher");
		const content = el("content");
		const widget = el("widget");

		sizer.append(pusher, content);

		insertAfterMetadataOrHeader(sizer, widget);

		expect(labels(sizer)).toEqual(["pusher", "widget", "content"]);
	});

	it("keeps relationship widgets after a task card even when the task card is last", () => {
		const sizer = el("sizer", "markdown-preview-sizer");
		const taskCard = el("task-card", "tasknotes-task-card-note-widget");
		const relationships = el("relationships");

		sizer.append(taskCard);

		expect(insertAfterElement(taskCard, relationships)).toBe(true);
		expect(labels(sizer)).toEqual(["task-card", "relationships"]);
	});
});
