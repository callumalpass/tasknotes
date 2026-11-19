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
	protected readonly mode = "create" as const;
	async initializeFormData(): Promise<void> {}
	async handleSave() {
		return { status: "saved" as const };
	}
	getModalTitle(): string {
		return "Harness";
	}

	renderTitleInput(container: HTMLElement): HTMLInputElement | HTMLTextAreaElement {
		this.createTitleInput(container);
		return (this as { titleInput: HTMLInputElement | HTMLTextAreaElement }).titleInput;
	}

	getTitleValue(): string {
		return this.form.values.title;
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

		expect(css).toContain(".tasknotes-plugin textarea.title-input");
		expect(css).toContain("textarea.title-input-detailed");
		expect(css).toContain("--tn-title-line");
	});
});
