/**
 * Regression coverage for Issue #1634: custom status icons in inline task
 * widgets should share the inline status-dot sizing and alignment.
 */

import { describe, expect, it } from "@jest/globals";
import * as fs from "fs";
import * as path from "path";

function readStylesheet(): string {
	return fs.readFileSync(
		path.resolve(__dirname, "../../../styles/task-inline-widget.css"),
		"utf8"
	);
}

describe("Issue #1634: inline custom status icon alignment", () => {
	it("centres inline status icons at the shared glyph size inside their hit targets", () => {
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
			/\.tasknotes-plugin \.task-card--layout-inline \.task-card__status-dot\s*\{[^}]*width:\s*var\(--tn-glyph\);[^}]*height:\s*var\(--tn-glyph\);/s
		);
		expect(css).toMatch(
			/\.tasknotes-plugin \.task-card--layout-inline \.task-card__status-dot--icon\s*\{[^}]*display:\s*inline-flex;[^}]*align-items:\s*center;[^}]*justify-content:\s*center;/s
		);
		expect(css).toMatch(
			/\.tasknotes-plugin \.task-card--layout-inline \.task-card__status-dot--icon svg:not\(\.tn-glyph\)\s*\{[^}]*width:\s*var\(--tn-glyph\);[^}]*height:\s*var\(--tn-glyph\);/s
		);
		const kit = fs.readFileSync(path.resolve(__dirname, "../../../styles/kit.css"), "utf8");
		expect(kit).toMatch(/\.tn-glyph\s*\{[^}]*width:\s*var\(--tn-glyph\);[^}]*height:\s*var\(--tn-glyph\);/s);
	});
});
