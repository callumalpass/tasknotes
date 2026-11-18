/**
 * Issue #2594: an Agenda in a ```base code block froze Obsidian. The code block
 * was not treated as embedded, so it kept "fill" height, and with no height to
 * fill the agenda kept loading days. It now sizes to its content like an embed.
 */

import { calendarOptionsFor } from "../../helpers/calendarViewHarness";

describe("Issue #2594: calendars in base code blocks", () => {
	afterEach(() => document.body.replaceChildren());

	it.each(["block-language-base bases-embed", "block-language-base"])(
		"sizes an agenda in a code block (%s) to content despite heightMode: fill",
		(hostClasses) => {
			expect(
				calendarOptionsFor({ calendarView: "listWeek", heightMode: "fill" }, { embedded: hostClasses })
			).toMatchObject({ height: "auto" });
		}
	);

	it("still fills when the Base is open in its own tab", () => {
		expect(calendarOptionsFor({ calendarView: "listWeek", heightMode: "fill" })).toMatchObject({
			height: "fill",
		});
	});
});
