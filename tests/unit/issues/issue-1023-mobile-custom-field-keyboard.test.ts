/**
 * Issue #1023: custom field inputs in the task creation modal should stay
 * reachable when the iPhone keyboard opens.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1023
 */

import * as fs from "fs";
import * as path from "path";
import type { App } from "obsidian";
import { TaskModal } from "../../../src/modals/TaskModal";
import { MockObsidian } from "../../__mocks__/obsidian";

jest.mock("obsidian");

const cssFilePath = path.resolve(__dirname, "../../../styles/task-modal.css");

class TestTaskModal extends TaskModal {
	async initializeFormData(): Promise<void> {}
	async handleSave(): Promise<void> {}
	getModalTitle(): string {
		return "Test task modal";
	}

	renderDetailsField(container: HTMLElement): void {
		this.createUserFieldByConfig(container, {
			id: "details",
			fieldType: "user",
		});
	}

	getUserFieldInput(key: string): HTMLInputElement | undefined {
		return (this as any).userFieldInputs.get(key);
	}
}

function createMockPlugin() {
	const app = MockObsidian.createMockApp();
	return {
		app,
		i18n: {
			translate: (key: string) => key,
		},
		settings: {
			enableModalSplitLayout: false,
			modalFieldsConfig: { fields: [], groups: [] },
			userFields: [
				{
					id: "details",
					key: "details",
					displayName: "Details",
					type: "text",
				},
			],
			suggestionDebounceMs: 0,
		},
		cacheManager: {
			getAllContexts: jest.fn(() => []),
			getAllTags: jest.fn(() => []),
		},
	};
}

describe("Issue #1023: mobile custom field keyboard visibility", () => {
	let app: App;
	let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView | undefined;
	let scrollIntoView: jest.Mock;

	beforeEach(() => {
		jest.useFakeTimers();
		document.body.classList.add("is-mobile");
		app = MockObsidian.createMockApp() as unknown as App;
		originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
		scrollIntoView = jest.fn();
		HTMLElement.prototype.scrollIntoView = scrollIntoView;
	});

	afterEach(() => {
		jest.useRealTimers();
		document.body.classList.remove("is-mobile");
		document.body.innerHTML = "";
		if (originalScrollIntoView) {
			HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
		} else {
			delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
		}
	});

	it("scrolls a focused custom text field into view after the mobile keyboard opens", () => {
		const modal = new TestTaskModal(app, createMockPlugin() as any);
		const container = modal.contentEl.createDiv({ cls: "modal-split-content" });
		modal.renderDetailsField(container);

		const input = modal.getUserFieldInput("details");
		expect(input).toBeTruthy();

		input!.dispatchEvent(new Event("focus"));
		jest.runOnlyPendingTimers();

		expect(modal.containerEl.classList.contains("is-mobile-keyboard-focused")).toBe(true);
		expect(scrollIntoView).toHaveBeenCalledWith({
			block: "nearest",
			inline: "nearest",
			behavior: "auto",
		});
	});

	it("adds temporary mobile scroll padding while keyboard-backed fields are focused", () => {
		const cssContent = fs.readFileSync(cssFilePath, "utf-8");

		expect(cssContent).toContain(
			".is-mobile-keyboard-focused.expanded .modal-split-content"
		);
		expect(cssContent).toContain("scroll-padding-bottom");
		expect(cssContent).toContain("env(safe-area-inset-bottom)");
	});
});
