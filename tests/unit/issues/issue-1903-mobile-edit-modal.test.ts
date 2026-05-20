/**
 * Issue #1903: opening a task on iPhone should not immediately show the
 * keyboard, and the edit modal should leave more usable room on small screens.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1903
 */

import * as fs from "fs";
import * as path from "path";
import type { App } from "obsidian";
import { TaskEditModal } from "../../../src/modals/TaskEditModal";
import type { TaskInfo } from "../../../src/types";
import { MockObsidian } from "../../__mocks__/obsidian";

jest.mock("obsidian");

const cssFilePath = path.resolve(__dirname, "../../../styles/task-modal.css");

class TestTaskEditModal extends TaskEditModal {
	runInitialFocus(): void {
		this.focusTitleInput();
	}
}

function createTask(): TaskInfo {
	return {
		title: "Mobile edit modal",
		status: "open",
		priority: "normal",
		path: "TaskNotes/mobile-edit-modal.md",
		archived: false,
		tags: ["task"],
		contexts: [],
		projects: [],
	} as TaskInfo;
}

function createPlugin(app: App) {
	return {
		app,
		i18n: {
			translate: (key: string) => key,
		},
		settings: {
			enableModalSplitLayout: false,
			taskTag: "task",
			taskIdentificationMethod: "tag",
			hideIdentifyingTagsMode: "exact",
			defaultTaskStatus: "open",
			userFields: [],
		},
		statusManager: {
			isCompletedStatus: jest.fn(() => false),
		},
		cacheManager: {
			getTaskInfo: jest.fn(),
			isTaskFile: jest.fn(() => true),
		},
		fieldMapper: {
			toUserField: jest.fn((key: string) => key),
		},
		taskService: {
			deleteTask: jest.fn(),
			toggleArchive: jest.fn(),
			updateTask: jest.fn(),
		},
	};
}

describe("Issue #1903: mobile edit task modal", () => {
	beforeEach(() => {
		MockObsidian.reset();
		document.body.classList.add("is-mobile");
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		document.body.classList.remove("is-mobile");
		document.body.innerHTML = "";
	});

	it("does not autofocus the edit title on mobile open", () => {
		const app = MockObsidian.createMockApp() as unknown as App;
		const modal = new TestTaskEditModal(app, createPlugin(app) as never, {
			task: createTask(),
		});

		expect(() => {
			modal.runInitialFocus();
			jest.runOnlyPendingTimers();
		}).not.toThrow();
		expect(document.activeElement).toBe(document.body);
	});

	it("uses roomier mobile modal layout rules", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");

		expect(
			extractCssBlock(
				cssContent,
				"body.is-mobile .tasknotes-plugin.minimalist-task-modal > .modal"
			)
		).toContain("width: calc(100vw - 16px");
		expect(
			extractCssBlock(
				cssContent,
				"body.is-mobile .tasknotes-plugin.minimalist-task-modal .modal-split-left .details-container"
			)
		).toContain("order: 3");
		expect(
			extractCssBlock(
				cssContent,
				"body.is-mobile .modal.mod-tasknotes .tn-task-modal__button-bar"
			)
		).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
		expect(
			extractCssBlock(
				cssContent,
				"body.is-mobile .tasknotes-plugin.minimalist-task-modal.expanded .modal-button-container"
			)
		).toContain("margin-bottom: max(var(--size-4-1), env(safe-area-inset-bottom))");
		expect(cssContent).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.tn-task-modal__markdown-editor--details,[^{]*\{[^}]*min-height:\s*140px/s
		);
	});
});

function extractCssBlock(css: string, selector: string): string {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const regex = new RegExp(`${escapedSelector}\\s*\\{([^}]*?)\\}`, "s");
	const match = css.match(regex);
	return match ? match[1] : "";
}
