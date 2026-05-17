/**
 * Issue #1350: reading-mode inline task widgets should refresh after task
 * property edits.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1350
 */

import { describe, expect, it, jest, afterEach } from "@jest/globals";
import { EVENT_TASK_UPDATED, type TaskInfo } from "../../../src/types";
import { ReadingModeTaskLinkProcessor } from "../../../src/editor/ReadingModeTaskLinkProcessor";
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
			element.textContent = [
				this.taskInfo.title,
				this.taskInfo.due ?? "",
				this.displayText ?? this.originalText,
			].join("|");
			return element;
		}
	}

	return { TaskLinkWidget };
});

function createTask(overrides: Partial<TaskInfo>): TaskInfo {
	return {
		path: "Tasks/renew-passport.md",
		title: "Renew passport",
		status: "open",
		priority: "normal",
		archived: false,
		tags: [],
		contexts: [],
		projects: [],
		timeEntries: [],
		complete_instances: [],
		skipped_instances: [],
		...overrides,
	} as TaskInfo;
}

function createReadingModeWidgetContainer(): {
	container: HTMLElement;
	widget: HTMLElement;
} {
	const container = document.createElement("div");
	const widget = document.createElement("span");
	widget.className =
		"tasknotes-plugin tasknotes-inline-widget task-inline-preview--reading-mode";
	widget.dataset.taskPath = "Tasks/renew-passport.md";
	widget.dataset.originalLinkPath = "Tasks/renew-passport";
	widget.dataset.originalText = "Renew passport";
	widget.textContent = "Renew passport|2026-01-20";
	container.appendChild(widget);

	return { container, widget };
}

function createPlugin(task: TaskInfo | null, container: HTMLElement): {
	plugin: TaskNotesPlugin;
	listeners: Map<string, (data?: unknown) => void>;
} {
	const listeners = new Map<string, (data?: unknown) => void>();
	const plugin = {
		settings: {
			enableTaskLinkOverlay: true,
			disableOverlayOnAlias: false,
			inlineVisibleProperties: ["due"],
		},
		emitter: {
			on: jest.fn((event: string, callback: (data?: unknown) => void) => {
				listeners.set(event, callback);
				return { event, callback };
			}),
		},
		registerEvent: jest.fn(),
		register: jest.fn(),
		cacheManager: {
			getCachedTaskInfoSync: jest.fn(() => task),
		},
		app: {
			workspace: {
				getLeavesOfType: jest.fn(() => [
					{
						view: {
							getMode: () => "preview",
							previewMode: { containerEl: container },
						},
					},
				]),
			},
		},
	} as unknown as TaskNotesPlugin;

	return { plugin, listeners };
}

describe("Issue #1350: reading mode inline task property refresh", () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	it("refreshes existing reading-mode widgets when the linked task is updated", () => {
		jest.useFakeTimers();
		const { container, widget } = createReadingModeWidgetContainer();
		const updatedTask = createTask({
			title: "Renew passport",
			due: "2026-02-18",
		});
		const { plugin, listeners } = createPlugin(updatedTask, container);

		new ReadingModeTaskLinkProcessor(plugin);
		listeners.get(EVENT_TASK_UPDATED)?.({ path: "Tasks/renew-passport.md" });
		jest.advanceTimersByTime(100);

		const refreshed = container.querySelector<HTMLElement>(
			".task-inline-preview--reading-mode"
		);
		expect(refreshed).not.toBe(widget);
		expect(refreshed?.dataset.taskPath).toBe("Tasks/renew-passport.md");
		expect(refreshed?.dataset.originalLinkPath).toBe("Tasks/renew-passport");
		expect(refreshed?.textContent).toBe("Renew passport|2026-02-18|Renew passport");
	});

	it("restores the original link when the overlay is disabled before refresh", () => {
		const { container } = createReadingModeWidgetContainer();
		const { plugin } = createPlugin(createTask({}), container);
		plugin.settings.enableTaskLinkOverlay = false;

		const processor = new ReadingModeTaskLinkProcessor(plugin);
		processor.refreshReadingModeWidgets(new Set(["Tasks/renew-passport.md"]));

		const link = container.querySelector<HTMLAnchorElement>("a.internal-link");
		expect(link?.getAttribute("href")).toBe("Tasks/renew-passport");
		expect(link?.getAttribute("data-href")).toBe("Tasks/renew-passport");
		expect(link?.textContent).toBe("Renew passport");
		expect(container.querySelector(".task-inline-preview--reading-mode")).toBeNull();
	});
});
