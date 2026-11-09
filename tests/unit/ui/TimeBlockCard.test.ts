import { createTimeBlockCard } from "../../../src/ui/TimeBlockCard";
import * as calendarCore from "../../../src/bases/calendar-core";
import type TaskNotesPlugin from "../../../src/main";

describe("timeblock calendar cards", () => {
	const timeblock = {
		id: "focus",
		title: "Focus time",
		startTime: "13:00",
		endTime: "14:00",
		description: "Keep the vault visible.",
		attachments: ["[[Project brief]]"],
	};
	const plugin = {} as TaskNotesPlugin;

	it("retains the time, description, attachments and original date when opening details", () => {
		const openDetails = jest.spyOn(calendarCore, "showTimeblockInfoModal").mockResolvedValue(undefined);
		const date = new Date("2026-11-04T13:00:00");
		const card = createTimeBlockCard(timeblock, plugin, { eventDate: date, originalDate: "2026-11-04" });
		expect(card.querySelector(".task-card__title")?.textContent).toBe("Focus time");
		expect(card.querySelector(".tn-chip.timeblock-card__time")?.textContent).toBe("13:00 - 14:00");
		expect(card.querySelector(".task-card__description")?.textContent).toBe(timeblock.description);
		expect(card.querySelector(".timeblock-card__attachments")?.textContent).toBe("1 attachment");
		card.click();
		expect(openDetails).toHaveBeenCalledWith(timeblock, date, "2026-11-04", plugin);
		openDetails.mockRestore();
	});

	it("still honors hidden description and attachment options", () => {
		const card = createTimeBlockCard(timeblock, plugin, { showDescription: false, showAttachments: false });
		expect(card.querySelector(".task-card__description")).toBeNull();
		expect(card.querySelector(".timeblock-card__attachments")).toBeNull();
		expect(card.querySelector(".timeblock-card__time")).not.toBeNull();
	});
});
