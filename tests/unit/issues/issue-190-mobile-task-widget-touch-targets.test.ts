import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");

function readRepoFile(relativePath: string): string {
	return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Issue #190: mobile task widget touch targets", () => {
	it("keeps mobile controls touchable without wrapping titles or clipping metadata", () => {
		const css = readRepoFile("styles/task-card-bem.css");
		const tokens = readRepoFile("styles/tokens.css");
		expect(tokens).toContain("--tn-mobile-task-card-indicator-size: 24px");
		expect(tokens).toContain("--tn-mobile-task-card-menu-size: 32px");
		for (const control of ["status-dot", "priority-dot", "context-menu"]) {
			const selector = "body.is-mobile .tasknotes-plugin .task-card:not(.task-card--layout-inline):not(.task-card--layout-compact) .task-card__" + control;
			const block = css.slice(css.indexOf(selector + " {"));
			const rules = block.slice(0, block.indexOf("}"));
			const size = control === "context-menu" ? "menu" : "indicator";
			expect(rules).toContain("width: var(--tn-mobile-task-card-" + size + "-size)");
			expect(rules).toContain("height: var(--tn-mobile-task-card-" + size + "-size)");
		}
		const row = css.slice(css.indexOf("body.is-mobile .tasknotes-plugin .task-card__main-row {"));
		expect(row.slice(0, row.indexOf("}"))).toContain("flex-wrap: nowrap");
		expect(css).toContain(".task-card:focus-within .task-card__drag-handle");
		expect(css).toContain(".task-card--selected .task-card__context-menu");
		const secondary = css.slice(css.indexOf("body.is-mobile .tasknotes-plugin .task-card:not(.task-card--layout-inline):not(.task-card--layout-compact) :is("));
		const secondaryRules = secondary.slice(0, secondary.indexOf("}"));
		for (const control of ["recurring-indicator", "reminder-indicator", "attachment-indicator", "project-indicator", "blocking-toggle", "blocked-toggle"]) {
			expect(secondaryRules).toContain(".task-card__" + control);
		}
		expect(secondaryRules).toContain("min-width: var(--tn-mobile-task-card-indicator-size)");
		expect(secondaryRules).toContain("min-height: var(--tn-mobile-task-card-indicator-size)");
		expect(secondaryRules).not.toContain(".task-card__details-indicator");
		expect(css).toMatch(/body\.is-mobile \.tasknotes-plugin \.task-card \.task-card__details-indicator\s*\{[^}]*min-width:\s*var\(--tn-icon-sm\);[^}]*min-height:\s*var\(--tn-icon-sm\);/s);
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
