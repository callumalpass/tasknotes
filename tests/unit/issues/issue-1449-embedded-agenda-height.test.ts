import {
	getCalendarSizingOptions,
	resolveEffectiveCalendarHeightMode,
} from "../../../src/bases/CalendarView";

describe("Issue #1449: embedded Agenda height", () => {
	function createEmbeddedContainer(): HTMLElement {
		const embed = document.createElement("div");
		embed.className = "internal-embed markdown-embed";
		const container = document.createElement("div");
		embed.appendChild(container);
		document.body.appendChild(embed);
		return container;
	}

	afterEach(() => {
		document.body.replaceChildren();
	});

	it("uses auto height for embedded list agenda views by default", () => {
		const container = createEmbeddedContainer();

		expect(resolveEffectiveCalendarHeightMode("fill", "listWeek", container)).toBe("auto");
		expect(getCalendarSizingOptions("auto")).toMatchObject({
			height: "auto",
			contentHeight: "auto",
			expandRows: false,
		});
	});

	it("keeps fill height for standalone list views and embedded non-list calendars", () => {
		const standalone = document.createElement("div");
		const embedded = createEmbeddedContainer();

		expect(resolveEffectiveCalendarHeightMode("fill", "listWeek", standalone)).toBe("fill");
		expect(resolveEffectiveCalendarHeightMode("fill", "dayGridMonth", embedded)).toBe("fill");
	});

	it("honors an explicit auto-height setting outside embeds", () => {
		const standalone = document.createElement("div");

		expect(resolveEffectiveCalendarHeightMode("auto", "dayGridMonth", standalone)).toBe("auto");
	});
});
