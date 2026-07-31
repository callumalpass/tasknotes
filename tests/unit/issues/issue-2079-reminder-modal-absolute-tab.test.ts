import fs from "fs";
import path from "path";
import type { App } from "obsidian";
import { ReminderModal } from "../../../src/modals/ReminderModal";
import type { TaskInfo } from "../../../src/types";
import { MockObsidian } from "../../helpers/obsidian-runtime";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function createPlugin(app: App): any {
	return {
		app,
		emitter: {
			trigger: jest.fn(),
		},
	};
}

function createTask(): TaskInfo {
	return {
		title: "Absolute reminder smoke",
		path: "TaskNotes/absolute-reminder-smoke.md",
		status: "open",
		priority: "normal",
		due: "2026-06-26",
		scheduled: "2026-06-25",
		reminders: [],
	} as TaskInfo;
}

function findTypeTab(container: HTMLElement, label: string): HTMLButtonElement {
	const tab = Array.from(
		container.querySelectorAll<HTMLButtonElement>(".reminder-modal__type-tab")
	).find((button) => button.textContent === label);

	if (!tab) {
		throw new Error(`Could not find ${label} reminder type tab`);
	}

	return tab;
}

describe("Issue #2079: Reminder modal absolute tab visibility", () => {
	it("toggles relative and absolute fields with a modal-specific hidden class", () => {
		const app = MockObsidian.createMockApp() as unknown as App;
		const modal = new ReminderModal(app, createPlugin(app), createTask(), jest.fn());
		const container = document.createElement("div");

		(modal as any).renderAddReminderForm(container);

		const relativeFields = container.querySelector(".relative-fields") as HTMLElement;
		const absoluteFields = container.querySelector(".absolute-fields") as HTMLElement;

		expect(relativeFields.classList.contains("reminder-modal__fields--hidden")).toBe(false);
		expect(absoluteFields.classList.contains("reminder-modal__fields--hidden")).toBe(true);

		findTypeTab(container, "Absolute").click();

		expect(relativeFields.classList.contains("reminder-modal__fields--hidden")).toBe(true);
		expect(absoluteFields.classList.contains("reminder-modal__fields--hidden")).toBe(false);
	});

	it("hides reminder field groups with scoped CSS instead of an unconditional absolute field rule", () => {
		const css = readRepoFile("styles/reminder-modal.css");

		expect(css).toMatch(
			/\.tasknotes-plugin \.relative-fields\.reminder-modal__fields--hidden,\s*\.tasknotes-plugin \.absolute-fields\.reminder-modal__fields--hidden\s*\{[^}]*display:\s*none;/s
		);
		expect(css).not.toMatch(/\.tasknotes-plugin \.absolute-fields\s*\{\s*display:\s*none;\s*\}/);
	});
});
