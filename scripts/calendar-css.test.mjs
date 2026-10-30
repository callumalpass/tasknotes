import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { adaptCalendarCss } from "./calendar-css.mjs";

test("calendar host styles retain layout and accessible wrappers without lint exemptions", async () => {
	const source = await readFile(new URL("../node_modules/@tasknotes/calendar/dist/calendar.css", import.meta.url), "utf8");
	const css = adaptCalendarCss(source);
	assert.doesNotMatch(css, /!important|:has\(|display:\s*contents|#[\da-f]{3}\b/i);
	assert.match(css, /\.advanced-calendar-view \.tnc\.tnc \{/);
	assert.match(css, /\.tnc-dg-dates \{\s*display: grid;\s*grid-template-columns: var\(--tnc-cols\);\s*grid-column: 1 \/ -1;/);
	assert.match(css, /\.tnc-dg-content \{\s*position: absolute;\s*inset: 0;/);
	assert.match(css, /\.advanced-calendar-view--week-numbers \.tnc-dg-layer/);
	assert.match(css, /\.tnc-dh\.tnc-dh--capacity/);
	assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("an engine stylesheet update requires explicit compatibility review", () => {
	assert.throws(() => adaptCalendarCss(".tnc {}"), /Calendar stylesheet changed/);
});
