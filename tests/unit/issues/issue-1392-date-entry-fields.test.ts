import {
	attachDateInputBehavior,
	normalizeDateEntryValue,
} from "../../../src/ui/dateInputBehavior";

describe("Issue #1392: date entry field behavior", () => {
	it("normalizes compact and pasted date values", () => {
		expect(normalizeDateEntryValue("20260120")).toBe("2026-01-20");
		expect(normalizeDateEntryValue("2026-1-2")).toBe("2026-01-02");
		expect(normalizeDateEntryValue("2026/01/20")).toBe("2026-01-20");
		expect(normalizeDateEntryValue("20260230")).toBeNull();
	});

	it("applies pasted compact dates to native date inputs", () => {
		const input = document.createElement("input");
		input.type = "date";
		const onCommit = jest.fn();
		attachDateInputBehavior(input, { onCommit });

		const event = new Event("paste", {
			bubbles: true,
			cancelable: true,
		}) as ClipboardEvent;
		Object.defineProperty(event, "clipboardData", {
			value: { getData: () => "20260120" },
		});

		input.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(true);
		expect(input.value).toBe("2026-01-20");
		expect(onCommit).toHaveBeenCalledWith("2026-01-20");
	});

	it("accepts continuous YYYYMMDD typing in native date inputs", () => {
		const input = document.createElement("input");
		input.type = "date";
		const onCommit = jest.fn();
		let currentTime = 0;
		attachDateInputBehavior(input, {
			onCommit,
			now: () => currentTime,
		});

		for (const digit of "20260120") {
			input.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: digit,
					bubbles: true,
					cancelable: true,
				})
			);
			currentTime += 100;
		}

		expect(input.value).toBe("2026-01-20");
		expect(onCommit).toHaveBeenCalledWith("2026-01-20");
	});
});
