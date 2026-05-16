/**
 * Regression coverage for Issue #1634: custom status icons in inline task
 * widgets should share the inline status-dot sizing and alignment.
 */

import { describe, expect, it } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";

function readStylesheet(): string {
	return fs.readFileSync(
		path.resolve(__dirname, "../../../styles/task-card-bem.css"),
		"utf8"
	);
}

describe("Issue #1634: inline custom status icon alignment", () => {
	it("sizes inline status-icon SVGs to the inline status-dot box", () => {
		const css = readStylesheet();

		const inlineDotSelector =
			".tasknotes-plugin .task-card--layout-inline .task-card__status-dot";
		const inlineIconSelector =
			".tasknotes-plugin .task-card--layout-inline .task-card__status-dot--icon";
		const inlineIconSvgSelector = `${inlineIconSelector} svg`;

		expect(css).toContain(inlineDotSelector);
		expect(css).toContain(inlineIconSelector);
		expect(css).toContain(inlineIconSvgSelector);
		expect(css.indexOf(inlineIconSelector)).toBeGreaterThan(
			css.indexOf(inlineDotSelector)
		);
		expect(css).toMatch(
			/\.tasknotes-plugin \.task-card--layout-inline \.task-card__status-dot\s*\{[^}]*width:\s*0\.85em;[^}]*height:\s*0\.85em;/s
		);
		expect(css).toMatch(
			/\.tasknotes-plugin \.task-card--layout-inline \.task-card__status-dot--icon\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/s
		);
		expect(css).toMatch(
			/\.tasknotes-plugin \.task-card--layout-inline \.task-card__status-dot--icon svg\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;/s
		);
	});
});
