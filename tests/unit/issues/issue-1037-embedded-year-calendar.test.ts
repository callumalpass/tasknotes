import * as fs from "fs";
import * as path from "path";
import {
	getCalendarSizingOptions,
	resolveEffectiveCalendarHeightMode,
} from "../../../src/bases/CalendarView";

const cssFilePath = path.resolve(__dirname, "../../../styles/advanced-calendar-view.css");

function createEmbeddedContainer(): HTMLElement {
	const embed = document.createElement("div");
	embed.className = "internal-embed markdown-embed";
	const container = document.createElement("div");
	embed.appendChild(container);
	document.body.appendChild(embed);
	return container;
}

describe("Issue #1037: embedded Calendar year view spacing", () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it("uses content-sized layout for embedded year calendars", () => {
		const container = createEmbeddedContainer();

		expect(resolveEffectiveCalendarHeightMode("fill", "multiMonthYear", container)).toBe(
			"auto"
		);
		expect(getCalendarSizingOptions("auto")).toMatchObject({
			height: "auto",
			contentHeight: "auto",
			expandRows: false,
		});
	});

	it("keeps the year title horizontal and constrains embedded multi-month width", () => {
		const css = fs.readFileSync(cssFilePath, "utf-8");
		const titleBlock =
			css.match(/\.advanced-calendar-view \.fc-toolbar-title\s*\{[^}]*\}/s)?.[0] ?? "";

		expect(titleBlock).toContain("white-space: nowrap");
		expect(titleBlock).toContain("word-break: keep-all");
		expect(css).toContain(".internal-embed .advanced-calendar-view .fc-multimonth");
		expect(css).toContain(".markdown-embed .advanced-calendar-view .fc-multimonth");
	});
});
