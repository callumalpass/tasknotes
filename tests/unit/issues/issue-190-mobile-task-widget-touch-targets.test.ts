import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Issue #190: mobile task widget touch targets", () => {
	it("keeps Obsidian mobile task-card controls compact on narrow screens", () => {
		const variablesCss = readRepoFile("styles/variables.css");
		const css = readRepoFile("styles/task-card-bem.css");

		expect(variablesCss).toMatch(
			/body\.is-mobile \.tasknotes-plugin\s*\{[^}]*--tn-mobile-task-card-indicator-size:\s*24px;[^}]*--tn-mobile-task-card-menu-size:\s*32px;[^}]*--tn-mobile-inline-indicator-size:\s*20px;[^}]*--tn-mobile-inline-menu-size:\s*24px;/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card:not\(\.task-card--layout-inline\):not\(\.task-card--layout-compact\) \.task-card__main-row\s*\{[^}]*align-items:\s*center;[^}]*flex-wrap:\s*wrap;/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card:not\(\.task-card--layout-inline\):not\(\.task-card--layout-compact\) \.task-card__status-dot\s*\{[^}]*width:\s*var\(--tn-mobile-task-card-indicator-size\);[^}]*height:\s*var\(--tn-mobile-task-card-indicator-size\);/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card:not\(\.task-card--layout-inline\):not\(\.task-card--layout-compact\) \.task-card__priority-dot\s*\{[^}]*width:\s*var\(--tn-mobile-task-card-indicator-size\);[^}]*padding:\s*var\(--tn-mobile-task-card-dot-padding\);[^}]*background-clip:\s*content-box;/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card:not\(\.task-card--layout-inline\):not\(\.task-card--layout-compact\) \.task-card__context-menu\s*\{[^}]*width:\s*var\(--tn-mobile-task-card-menu-size\);[^}]*height:\s*var\(--tn-mobile-task-card-menu-size\);/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card:not\(\.task-card--layout-inline\):not\(\.task-card--layout-compact\) \.task-card__badges\s*\{[^}]*order:\s*2;[^}]*flex:\s*1 0 100%;/s
		);
	});

	it("uses smaller inline widgets on Obsidian mobile without changing touch-capable desktop rules", () => {
		const css = readRepoFile("styles/task-card-bem.css");

		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card--layout-inline \.task-card__content\s*\{[^}]*flex-direction:\s*row;/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card--layout-inline \.task-card__metadata\s*\{[^}]*display:\s*none;/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card--layout-inline \.task-card__priority-dot\s*\{[^}]*width:\s*var\(--tn-mobile-inline-indicator-size\);[^}]*height:\s*var\(--tn-mobile-inline-indicator-size\);[^}]*padding:\s*5px;[^}]*background-clip:\s*content-box;/s
		);
		expect(css).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card--layout-inline \.task-card__context-menu\s*\{[^}]*width:\s*var\(--tn-mobile-inline-menu-size\);[^}]*height:\s*var\(--tn-mobile-inline-menu-size\);[^}]*opacity:\s*1;/s
		);
		expect(css).toMatch(
			/@media \(pointer: coarse\)\s*\{[\s\S]*body:not\(\.is-mobile\) \.tasknotes-plugin \.task-card--layout-inline \.task-card__priority-dot\s*\{[^}]*width:\s*28px;[^}]*height:\s*28px;[^}]*background-clip:\s*content-box;/s
		);
	});

	it("keeps mobile-only modal and settings refinements scoped to Obsidian mobile", () => {
		const taskCardCss = readRepoFile("styles/task-card-bem.css");
		const taskModalCss = readRepoFile("styles/task-modal.css");
		const reminderCss = readRepoFile("styles/reminder-modal.css");
		const settingsCss = readRepoFile("styles/settings-view.css");
		const calendarCss = readRepoFile("styles/advanced-calendar-view.css");

		expect(taskCardCss).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card:not\(\.task-card--layout-inline\) \.task-card__metadata-property--projects\s*\{[^}]*flex-wrap:\s*wrap;[^}]*overflow-wrap:\s*anywhere;/s
		);
		expect(taskCardCss).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-card:not\(\.task-card--layout-inline\) \.task-card__metadata-property--contexts,[\s\S]*?\.task-card__metadata-value\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s
		);
		expect(taskModalCss).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.task-project-remove\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;/s
		);
		expect(reminderCss).toMatch(
			/\.tasknotes-plugin \.reminder-modal__task-title\s*\{[^}]*overflow-wrap:\s*anywhere;/s
		);
		expect(settingsCss).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.tasknotes-settings__card-config-row\s*\{[^}]*flex-direction:\s*column;[^}]*width:\s*100%;/s
		);
		expect(settingsCss).toMatch(
			/body\.is-mobile \.tasknotes-plugin \.field-manager__tabs\s*\{[^}]*overflow-x:\s*auto;/s
		);
		expect(calendarCss).toMatch(
			/body\.is-mobile \.timeblock-modal-buttons,\s*body\.is-mobile \.tasknotes-plugin\.calendar-event-creation-modal \.calendar-event-modal-buttons\s*\{[^}]*flex-direction:\s*column;/s
		);
	});
});
