/**
 * Issue #1348: task modal title and organization fields need more breathing room.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1348
 */

import fs from "fs";
import path from "path";
import type { App } from "obsidian";
import { TaskModal } from "../../../src/modals/TaskModal";
import { MockObsidian } from "../../helpers/obsidian-runtime";

class TaskModalHarness extends TaskModal {
	async initializeFormData(): Promise<void> {}
	async handleSave(): Promise<void> {}
	getModalTitle(): string {
		return "Harness";
	}

	renderTitleInput(container: HTMLElement): HTMLInputElement | HTMLTextAreaElement {
		this.createTitleInput(container);
		return (this as { titleInput: HTMLInputElement | HTMLTextAreaElement }).titleInput;
	}

	getTitleValue(): string {
		return (this as { title: string }).title;
	}
}

function createPlugin() {
	return {
		i18n: {
			translate: (key: string) => key,
		},
		settings: {
			enableModalSplitLayout: false,
			modalFieldsConfig: undefined,
		},
	} as never;
}

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.resolve(__dirname, "../../../", relativePath), "utf8");
}

describe("Issue #1348: task modal title layout", () => {
	let app: App;

	beforeEach(() => {
		MockObsidian.reset();
		app = MockObsidian.createMockApp() as unknown as App;
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("renders the title control as a wrapping textarea without allowing stored newlines", () => {
		const modal = new TaskModalHarness(app, createPlugin());
		const titleInput = modal.renderTitleInput(modal.contentEl);

		expect(titleInput).toBeInstanceOf(HTMLTextAreaElement);
		expect(titleInput.classList.contains("title-input")).toBe(true);

		titleInput.value = "Long task description\nwith pasted line break";
		titleInput.dispatchEvent(new Event("input", { bubbles: true }));

		expect(titleInput.value).toBe("Long task description with pasted line break");
		expect(modal.getTitleValue()).toBe("Long task description with pasted line break");

		const enterEvent = new KeyboardEvent("keydown", {
			key: "Enter",
			bubbles: true,
			cancelable: true,
		});
		titleInput.dispatchEvent(enterEvent);
		expect(enterEvent.defaultPrevented).toBe(true);
	});

	it("keeps the modal polish scoped to title and context/tag text fields", () => {
		const css = readRepoFile("styles/task-modal.css");

		expect(css).toContain(".tasknotes-plugin .title-input");
		expect(css).toContain(".tasknotes-plugin .title-input-detailed");
		expect(css).toContain("max-height: calc((var(--font-ui-large) * 1.4 * 3)");
		expect(css).toContain(".tn-task-modal__wide-text-setting .setting-item-control");
		expect(css).toContain("flex: 1 1 65%;");
	});
});
