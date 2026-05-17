/**
 * Issue #1041 / #1800: copying existing timeblocks should be possible without
 * manually recreating the same block for each day.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/1041
 * @see https://github.com/callumalpass/tasknotes/issues/1800
 */

import { isTimeblockCopyModifierPressed } from "../../../src/bases/calendar-core";
import { createCopiedTimeblock } from "../../../src/utils/helpers";
import type { TimeBlock } from "../../../src/types";

describe("Issue #1041: timeblock copy-drag support", () => {
	it("creates a copied timeblock with a fresh ID and dragged time range", () => {
		const original: TimeBlock = {
			id: "tb-original",
			title: "Work",
			startTime: "08:00",
			endTime: "12:00",
			description: "Focus block",
			color: "blue",
			attachments: ["[[Projects/Work]]"],
		};

		const copied = createCopiedTimeblock(original, "13:00", "17:00");

		expect(copied).toMatchObject({
			title: "Work",
			startTime: "13:00",
			endTime: "17:00",
			description: "Focus block",
			color: "blue",
			attachments: ["[[Projects/Work]]"],
		});
		expect(copied.id).not.toBe(original.id);
		expect(copied.attachments).not.toBe(original.attachments);
	});

	it("treats Ctrl, Cmd, and Alt/Option drag as copy gestures", () => {
		expect(isTimeblockCopyModifierPressed({ ctrlKey: true, metaKey: false, altKey: false }))
			.toBe(true);
		expect(isTimeblockCopyModifierPressed({ ctrlKey: false, metaKey: true, altKey: false }))
			.toBe(true);
		expect(isTimeblockCopyModifierPressed({ ctrlKey: false, metaKey: false, altKey: true }))
			.toBe(true);
		expect(isTimeblockCopyModifierPressed({ ctrlKey: false, metaKey: false, altKey: false }))
			.toBe(false);
		expect(isTimeblockCopyModifierPressed(undefined)).toBe(false);
	});
});
