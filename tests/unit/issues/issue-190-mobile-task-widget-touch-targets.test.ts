import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Issue #190: mobile task widget touch targets", () => {
	it("keeps narrow controls touchable while allowing metadata to fit without clipping", () => {
		const css = readRepoFile("styles/task-card-bem.css");
		const tokens = readRepoFile("styles/tokens.css");
		expect(tokens).toContain("--tn-touch-target: 40px");
		const narrow = css.slice(css.indexOf("Stacked card layout at every width"));
		expect(narrow).toContain("grid-template-rows: auto minmax(var(--tn-touch-target), auto)");
		expect(narrow).toMatch(/:is\(\.task-card__status-dot, \.task-card__priority-dot, \.task-card__context-menu, \.task-card__drag-handle,[^}]*min-width: var\(--tn-touch-target\);[^}]*min-height: var\(--tn-touch-target\);/s);
		expect(narrow).toContain('.task-card__badges [role="button"]');
		expect(narrow).toMatch(/\.task-card__metadata-date > \.task-card__date-value\s*\{[^}]*white-space:\s*normal;[^}]*overflow:\s*visible;/s);
		expect(narrow).toContain("max-width: calc((100% - var(--tn-touch-target) - 2 * var(--tn-space-2)) / 2)");
		expect(narrow).toMatch(/\.task-card__context-menu\s*\{[^}]*opacity:\s*1;/s);
		expect(css).toMatch(/\.task-card__details-indicator\s*\{[^}]*width:\s*14px;[^}]*height:\s*14px;/s);
	});
	it("keeps inline controls touchable without applying mobile sizing to desktop", () => {
		const css = readRepoFile("styles/task-inline-widget.css");
		const mobileControls = css.slice(css.indexOf("body.is-mobile .tasknotes-plugin .task-card--layout-inline :is("));
		const rules = mobileControls.slice(0, mobileControls.indexOf("}"));
		for (const control of ["status-dot", "priority-dot", "context-menu"]) {
			expect(rules).toContain(".task-card__" + control);
		}
		expect(rules).toContain("width: var(--tn-touch-target)");
		expect(rules).toContain("height: var(--tn-touch-target)");
		expect(rules).toContain("opacity: 1");
		expect(css).toMatch(/\.task-card--layout-inline \.task-card__priority-dot\s*\{[^}]*width:\s*var\(--tn-glyph\);/s);
		expect(css).toMatch(/\.task-card--layout-inline \.task-card__content\s*\{[^}]*display:\s*inline-flex;[^}]*flex-wrap:\s*nowrap;/s);
	});

	it("keeps mobile-only modal and settings refinements scoped to Obsidian mobile", () => {
		const taskCardCss = readRepoFile("styles/task-card-bem.css");
		const taskModalCss = readRepoFile("styles/task-modal.css");
		const reminderCss = readRepoFile("styles/reminder-modal.css");
		const settingsCss = readRepoFile("styles/settings-view.css");
		const calendarCss = readRepoFile("styles/advanced-calendar-view.css");

		expect(taskCardCss).toContain(".task-card__metadata-chips :is(.tag, .context-tag, .task-card__project-link)");
		expect(taskCardCss).toContain(".task-card__metadata-values [hidden]");
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
