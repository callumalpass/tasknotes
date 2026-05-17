import {
	getCalendarSizingOptions,
	resolveEffectiveCalendarHeightMode,
} from "../../../src/bases/CalendarView";

function createEmbeddedContainer(): HTMLElement {
	const embed = document.createElement("div");
	embed.className = "internal-embed markdown-embed";
	const container = document.createElement("div");
	embed.appendChild(container);
	document.body.appendChild(embed);
	return container;
}

describe("Issue #1034: embedded Calendar proportions", () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it("uses content-sized layout for embedded calendar views", () => {
		const container = createEmbeddedContainer();

		expect(resolveEffectiveCalendarHeightMode("fill", "dayGridMonth", container)).toBe("auto");
		expect(resolveEffectiveCalendarHeightMode("fill", "timeGridWeek", container)).toBe("auto");
		expect(resolveEffectiveCalendarHeightMode("fill", "timeGridDay", container)).toBe("auto");
		expect(getCalendarSizingOptions("auto")).toMatchObject({
			height: "auto",
			contentHeight: "auto",
			expandRows: false,
		});
	});

	it("keeps standalone calendar views full height by default", () => {
		const standalone = document.createElement("div");

		expect(resolveEffectiveCalendarHeightMode("fill", "dayGridMonth", standalone)).toBe("fill");
		expect(getCalendarSizingOptions("fill")).toEqual({
			height: "100%",
			expandRows: true,
		});
	});
});
