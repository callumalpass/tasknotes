import { createHash } from "node:crypto";

// Host adaptation of @tasknotes/calendar 0.1.0. Keep upstream bytes intact in
// node_modules; review this adapter when upgrading the dependency. No lint exemptions.
const CALENDAR_CSS_SHA256 = "43932615da8bfe1b2398ac8368413e9aeb28e9a4d28cf6ed4459c56a403f0e15";

export function adaptCalendarCss(source) {
	if (createHash("sha256").update(source).digest("hex") !== CALENDAR_CSS_SHA256) {
		throw new Error("Calendar stylesheet changed; review its Obsidian host adaptation.");
	}
	return source
		.replace(/#([\da-f])([\da-f])([\da-f])\b/gi, (_, r, g, b) => `#${r}${r}${g}${g}${b}${b}`)
		// Host-scoped specificity replaces important declarations. Inline event
		// stacking is handled by calendarStyleCompatibility.ts, not CSS priority.
		.replace(/ !important/g, "")
		.replace(/(^|\n)([ \t]*)(\.tnc[^\n{]*)(?=[,{])/g, "$1$2.advanced-calendar-view $3")
		.replace(".advanced-calendar-view .tnc {", ".advanced-calendar-view .tnc.tnc {")
		.replace(".tnc-dh:has(.tnc-cap)", ".tnc-dh.tnc-dh--capacity")
		.replace(".advanced-calendar-view .tnc-weeknum ~ .tnc-dg-layer,\n.advanced-calendar-view .tnc-dg-week:has(.tnc-weeknum) .tnc-dg-layer", ".advanced-calendar-view--week-numbers .tnc-dg-layer")
		// Preserve the grid row and cell in the accessibility tree. A nested grid
		// spans the same columns; the event overlay keeps its original containing box.
		.replace(".advanced-calendar-view .tnc-dg-dates,\n.advanced-calendar-view .tnc-dg-content {\n\tdisplay: contents;\n}", ".advanced-calendar-view .tnc-dg-dates {\n\tdisplay: grid;\n\tgrid-template-columns: var(--tnc-cols);\n\tgrid-column: 1 / -1;\n}\n.advanced-calendar-view .tnc-dg-content {\n\tposition: absolute;\n\tinset: 0;\n}");
}
