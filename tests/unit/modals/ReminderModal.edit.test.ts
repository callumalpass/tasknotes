import { createI18nService } from "../../../src/i18n";
import type { App } from "obsidian";
import {
	ReminderModal,
	parseRelativeReminderOffset,
} from "../../../src/modals/ReminderModal";
import type { Reminder, TaskInfo } from "../../../src/types";
import { MockObsidian } from "../../helpers/obsidian-runtime";

function createTask(reminders: Reminder[]): TaskInfo {
	return {
		title: "Edit reminder",
		path: "TaskNotes/edit-reminder.md",
		status: "open",
		priority: "normal",
		due: "2026-06-26",
		reminders,
	} as TaskInfo;
}

async function openModal(reminders: Reminder[]) {
	const app = MockObsidian.createMockApp() as unknown as App;
	const plugin = {
		app,
		i18n: createI18nService(),
		emitter: { trigger: jest.fn() },
		cacheManager: { getTaskInfo: jest.fn().mockResolvedValue(null) },
		notificationService: { clearProcessedRemindersForTask: jest.fn() },
	};
	const onSave = jest.fn();
	const modal = new ReminderModal(app, plugin as never, createTask(reminders), onSave);
	await (modal as any).initializeWithFreshData();
	return { modal, contentEl: (modal as any).contentEl as HTMLElement, onSave, plugin };
}


describe("ReminderModal editing", () => {
	it("updates an absolute reminder in place and keeps its id", async () => {
		const { modal, contentEl, onSave, plugin } = await openModal([
			{ id: "rem_keep", type: "relative", relatedTo: "due", offset: "-PT15M" },
			{
				id: "rem_edit",
				type: "absolute",
				absoluteTime: "2026-06-26T09:00:00",
				description: "Call",
			},
		]);

		contentEl.querySelectorAll<HTMLButtonElement>(".reminder-modal__edit-btn")[1].click();

		const timeInput = contentEl.querySelector<HTMLInputElement>('input[type="time"]')!;
		expect(timeInput.value).toBe("09:00");
		expect(
			contentEl.querySelector<HTMLInputElement>("input.reminder-modal__description-input")!.value
		).toBe("Call");

		// The Obsidian mock does not forward DOM input events to Setting onChange handlers.
		(modal as any).absoluteTime = "14:30";
		contentEl.querySelector<HTMLButtonElement>(".reminder-add-btn")!.click();
		contentEl.querySelector<HTMLButtonElement>(".reminder-modal__save-btn")!.click();
		await Promise.resolve();

		expect(onSave).toHaveBeenCalledWith([
			{ id: "rem_keep", type: "relative", relatedTo: "due", offset: "-PT15M" },
			{
				id: "rem_edit",
				type: "absolute",
				absoluteTime: "2026-06-26T14:30:00",
				description: "Call",
			},
		]);
		expect(plugin.emitter.trigger).toHaveBeenCalledWith(
			"reminder-changed",
			expect.objectContaining({ taskPath: "TaskNotes/edit-reminder.md" })
		);
	});

	it("loads a relative reminder into the form and keeps its id when changed", async () => {
		const { modal, contentEl, onSave } = await openModal([
			{ id: "rem_rel", type: "relative", relatedTo: "due", offset: "-PT2H" },
		]);

		contentEl.querySelector<HTMLButtonElement>(".reminder-modal__edit-btn")!.click();

		const offsetInput = contentEl.querySelector<HTMLInputElement>('input[placeholder="15"]')!;
		expect(offsetInput.value).toBe("2");
		(modal as any).relativeOffset = 3;
		contentEl.querySelector<HTMLButtonElement>(".reminder-add-btn")!.click();

		// Leaves edit mode and still shows a single reminder
		expect(contentEl.querySelectorAll(".reminder-modal__reminder-card")).toHaveLength(1);
		expect(contentEl.querySelector(".reminder-modal__cancel-edit-btn")).toBeNull();

		contentEl.querySelector<HTMLButtonElement>(".reminder-modal__save-btn")!.click();
		await Promise.resolve();

		expect(onSave).toHaveBeenCalledWith([
			{
				id: "rem_rel",
				type: "relative",
				relatedTo: "due",
				offset: "-PT3H",
				description: undefined,
			},
		]);
	});

	it("keeps a stored offset the form can't represent when only the description changes", async () => {
		const { modal, contentEl, onSave } = await openModal([
			{ id: "rem_month", type: "relative", relatedTo: "due", offset: "-P1M" },
		]);

		contentEl.querySelector<HTMLButtonElement>(".reminder-modal__edit-btn")!.click();
		(modal as any).description = "Renew";
		contentEl.querySelector<HTMLButtonElement>(".reminder-add-btn")!.click();
		contentEl.querySelector<HTMLButtonElement>(".reminder-modal__save-btn")!.click();
		await Promise.resolve();

		expect(onSave).toHaveBeenCalledWith([
			expect.objectContaining({ id: "rem_month", offset: "-P1M", description: "Renew" }),
		]);
	});

	it("maps stored offsets onto the modal's single value and unit", () => {
		expect(parseRelativeReminderOffset("-P1D")).toEqual({ value: 1, unit: "days", direction: "before" });
		expect(parseRelativeReminderOffset("PT1H30M")).toEqual({ value: 90, unit: "minutes", direction: "after" });
		expect(parseRelativeReminderOffset("-P1W")).toEqual({ value: 7, unit: "days", direction: "before" });
		expect(parseRelativeReminderOffset("-P1M")).toBeNull();
	});
});
