/**
 * Issue #2397: tags and same-note heading links must not be rendered as
 * TaskNotes task widgets in Reading View when the current note is a task.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2397
 */

import { describe, expect, it, jest } from "@jest/globals";
import type { MarkdownPostProcessorContext } from "obsidian";
import { ReadingModeTaskLinkProcessor } from "../../../src/editor/ReadingModeTaskLinkProcessor";
import type { TaskInfo } from "../../../src/types";
import type TaskNotesPlugin from "../../../src/main";

jest.mock("../../../src/editor/TaskLinkWidget", () => {
	class TaskLinkWidget {
		constructor(
			private taskInfo: TaskInfo,
			private plugin: TaskNotesPlugin,
			private originalText: string,
			private displayText?: string
		) {}

		toDOM(): HTMLElement {
			const element = document.createElement("span");
			element.className = "tasknotes-plugin tasknotes-inline-widget";
			element.textContent = this.displayText ?? this.originalText;
			return element;
		}
	}

	return { TaskLinkWidget };
});

const CURRENT_NOTE_PATH = "Tasks/MariaDB.md";
const OTHER_TASK_PATH = "Tasks/Other task.md";

function createTask(path: string, title: string): TaskInfo {
	return {
		path,
		title,
		status: "open",
		priority: "normal",
		archived: false,
		tags: [],
		contexts: [],
		projects: [],
		timeEntries: [],
		complete_instances: [],
		skipped_instances: [],
	} as TaskInfo;
}

function createPlugin(): TaskNotesPlugin {
	const tasks: Record<string, TaskInfo> = {
		[CURRENT_NOTE_PATH]: createTask(CURRENT_NOTE_PATH, "MariaDB"),
		[OTHER_TASK_PATH]: createTask(OTHER_TASK_PATH, "Other task"),
	};

	return {
		settings: {
			enableTaskLinkOverlay: true,
			disableOverlayOnAlias: false,
			inlineVisibleProperties: [],
		},
		emitter: { on: jest.fn() },
		registerEvent: jest.fn(),
		register: jest.fn(),
		cacheManager: {
			getCachedTaskInfoSync: jest.fn((path: string) => tasks[path] ?? null),
		},
		app: {
			workspace: { getLeavesOfType: jest.fn(() => []) },
			metadataCache: {
				// Like Obsidian, an empty link path resolves to the source note.
				getFirstLinkpathDest: jest.fn((linkPath: string, sourcePath: string) => {
					if (linkPath === "") return { path: sourcePath };
					if (linkPath === "Other task") return { path: OTHER_TASK_PATH };
					return null;
				}),
			},
		},
	} as unknown as TaskNotesPlugin;
}

async function render(html: string): Promise<HTMLElement> {
	const el = document.createElement("div");
	el.innerHTML = html;

	const processor = new ReadingModeTaskLinkProcessor(createPlugin()).createPostProcessor();
	await processor(el, {
		sourcePath: CURRENT_NOTE_PATH,
		getSectionInfo: () => null,
	} as unknown as MarkdownPostProcessorContext);
	// processLink is fire-and-forget; flush its microtasks.
	await Promise.resolve();
	await Promise.resolve();

	return el;
}

describe("Issue #2397: Reading View tags and same-note heading links", () => {
	it("leaves tags untouched", async () => {
		const el = await render(
			'<p><a href="#servers/db" class="tag" target="_blank" rel="noopener nofollow">#servers/db</a></p>'
		);

		expect(el.querySelector(".tasknotes-inline-widget")).toBeNull();
		expect(el.querySelector("a.tag")?.textContent).toBe("#servers/db");
	});

	it("leaves same-note heading wikilinks untouched", async () => {
		const el = await render(
			'<p><a class="internal-link" data-href="#Installation" href="#Installation" target="_blank" rel="noopener nofollow">MariaDB &gt; Installation</a></p>'
		);

		expect(el.querySelector(".tasknotes-inline-widget")).toBeNull();
		expect(el.querySelector("a.internal-link")?.getAttribute("href")).toBe("#Installation");
	});

	it("leaves same-note heading Markdown links untouched", async () => {
		const el = await render('<p><a href="#Installation">Installation</a></p>');

		expect(el.querySelector(".tasknotes-inline-widget")).toBeNull();
		expect(el.querySelector("a")?.getAttribute("href")).toBe("#Installation");
	});

	it("still renders links to a task, including a heading in another task", async () => {
		const el = await render(
			[
				"<p>",
				'<a href="#servers/db" class="tag">#servers/db</a>',
				'<a class="internal-link" data-href="#Installation" href="#Installation">Installation</a>',
				'<a class="internal-link" data-href="Other task" href="Other task">Other task</a>',
				'<a class="internal-link" data-href="Other task#Setup" href="Other task#Setup">Other task &gt; Setup</a>',
				"</p>",
			].join("")
		);

		const widgets = el.querySelectorAll<HTMLElement>(".task-inline-preview--reading-mode");
		expect(Array.from(widgets).map((widget) => widget.dataset.originalLinkPath)).toEqual([
			"Other task",
			"Other task#Setup",
		]);
		expect(el.querySelector("a.tag")).not.toBeNull();
		expect(el.querySelector('a.internal-link[href="#Installation"]')).not.toBeNull();
	});
});
