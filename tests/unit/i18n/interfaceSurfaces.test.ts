import { msg } from "@lingui/core/macro";
import { App } from "obsidian";
import fs from "node:fs";
import path from "node:path";
import { createI18nService } from "../../../src/i18n";
import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import { DateTimePickerModal } from "../../../src/modals/DateTimePickerModal";
import { CustomRecurrenceModal } from "../../../src/components/RecurrenceContextMenu";
import { ReminderModal } from "../../../src/modals/ReminderModal";
import { TaskActionPaletteModal } from "../../../src/modals/TaskActionPaletteModal";
import { getAvailableProperties } from "../../../src/utils/propertyHelpers";

const locales = ["en", "fr", "de", "es", "it", "ja", "ko", "pt", "ru", "zh"];

function fixture(locale: string) {
	const i18n = createI18nService({ initialLocale: locale });
	const task = {
		id: "Tasks/user-task.md",
		path: "Tasks/user-task.md",
		title: "USER_TITLE",
		status: "open",
		priority: "normal",
		due: "2026-10-23",
		scheduled: "2026-10-22",
		reminders: [
			{ id: "zero", type: "relative", relatedTo: "due", offset: "PT0M" },
			{ id: "one", type: "relative", relatedTo: "due", offset: "-PT1M" },
			{
				id: "many",
				type: "relative",
				relatedTo: "scheduled",
				offset: "PT5M",
				description: "USER_DESCRIPTION",
			},
		],
	} as TaskInfo;
	const app = new App();
	const plugin = {
		app,
		i18n,
		settings: {
			enableNaturalLanguageInput: true,
			userFields: [{ id: "user", displayName: "USER_FIELD" }],
		},
		emitter: { trigger: jest.fn() },
		cacheManager: { getTaskInfo: jest.fn(async () => task) },
		fieldMapper: { toUserField: (key: string) => (key === "due" ? "deadline_custom" : key) },
		statusManager: { getAllStatuses: () => [{ value: "custom", label: "USER_STATUS" }] },
		priorityManager: { getAllPriorities: () => [{ value: "normal", label: "USER_PRIORITY" }] },
		getActiveTimeSession: () => null,
	} as unknown as TaskNotesPlugin;
	return { app, task, plugin, i18n };
}

describe.each(locales)("Interface surfaces use the real %s catalogue", (locale) => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	it("localizes date controls and accessible names without changing a supplied title", () => {
		const { app, plugin, i18n } = fixture(locale);
		const modal = new DateTimePickerModal(app, {
			plugin,
			title: "USER_TITLE",
			onSelect: jest.fn(),
		});
		modal.onOpen();
		expect(modal.contentEl.querySelector("h3")?.textContent).toBe("USER_TITLE");
		expect(
			modal.contentEl
				.querySelector(".date-time-picker-modal__nlp-input")
				?.getAttribute("placeholder")
		).toBe(i18n.translate(msg({ message: "Enter a date or date/time", context: "modals.dateTimePicker.placeholder" })));
		expect(
			modal.contentEl
				.querySelector(".date-time-picker-modal__nlp-button")
				?.getAttribute("aria-label")
		).toBe(i18n.translate(msg({ message: "Apply natural language date", context: "modals.dateTimePicker.apply" })));
		expect(
			modal.contentEl
				.querySelector(".date-time-picker-modal__native-date-button")
				?.getAttribute("aria-label")
		).toBe(i18n.translate(msg({ message: "Open native date picker", context: "modals.dateTimePicker.nativePicker" })));
		modal.onClose();
	});

	it("formats zero/one/many reminder durations and resets translated form inputs", async () => {
		const { app, task, plugin, i18n } = fixture(locale);
		const modal = new ReminderModal(app, plugin, task, jest.fn());
		modal.onOpen();
		await Promise.resolve();
		const primary = Array.from(
			modal.contentEl.querySelectorAll(".reminder-modal__reminder-primary")
		).map((el) => el.textContent);
		const duration = (count: number) =>
			new Intl.NumberFormat(locale, {
				style: "unit",
				unit: "minute",
				unitDisplay: "long",
			}).format(count);
		expect(primary).toEqual([
			i18n.translate(msg({ message: "At the due date", context: "modals.reminder.atDue" })),
			i18n.translate(msg({ message: "Before due date: {duration}", context: "modals.reminder.beforeDue" }), { duration: duration(1) }),
			i18n.translate(msg({ message: "After scheduled date: {duration}", context: "modals.reminder.afterScheduled" }), { duration: duration(5) }),
		]);
		expect(modal.contentEl.textContent).toContain("USER_TITLE");
		expect(modal.contentEl.textContent).toContain("USER_DESCRIPTION");
		const description = modal.contentEl.querySelector<HTMLInputElement>(
			"input.reminder-modal__description-input"
		)!;
		expect(description.placeholder).toBe(
			i18n.translate(msg({ message: "Custom reminder message", context: "modals.reminder.descriptionPlaceholder" }))
		);
		description.value = "SECOND_USER_DESCRIPTION";
		description.dispatchEvent(new Event("input", { bubbles: true }));
		modal.contentEl.querySelector<HTMLButtonElement>(".reminder-add-btn")!.click();
		await Promise.resolve();
		await Promise.resolve();
		expect(description.value).toBe("");
		modal.onClose();
	});

	it("localizes quick actions and categories while preserving user labels and date identifiers", () => {
		const { app, task, plugin, i18n } = fixture(locale);
		const modal = new TaskActionPaletteModal(
			app,
			task,
			plugin,
			new Date("2026-10-23T00:00:00Z")
		);
		const actions = modal.getItems();
		expect(actions.find((a) => a.id === "status-custom")?.title).toBe(
			i18n.translate(msg({ message: "Change status to \"{label}\"", context: "modals.actionPalette.statusAction" }), { label: "USER_STATUS" })
		);
		const today = actions.find((a) => a.id === "set-scheduled-today")!;
		expect(today.title).toBe(
			i18n.translate(msg({ message: "Schedule for {date}", context: "modals.actionPalette.scheduleFor" }), {
				date: i18n.translate(msg({ message: "today", context: "modals.actionPalette.presets.today" })),
			})
		);
		const el = document.createElement("div");
		modal.renderSuggestion({ item: today, match: { score: 1, matches: [] } }, el);
		expect(el.querySelector(".task-action-palette__category")?.textContent).toBe(
			i18n.translate(msg({ message: "Dates", context: "modals.actionPalette.categories.dates" }))
		);
		expect(today.id).toBe("set-scheduled-today");
	});

	it("uses translated recurrence sentences with controls in each language's word order", () => {
		const { app, plugin, i18n } = fixture(locale);
		const modal = new CustomRecurrenceModal(
			app,
			"",
			"scheduled",
			"2026-10-23",
			plugin,
			jest.fn()
		);
		// Obsidian mock constructors are strict proxies; declare optional own fields explicitly.
		Object.assign(modal, { bySetPos: undefined, count: undefined });
		modal.onOpen();
		expect(modal.contentEl.textContent).toContain(
			i18n.translate(msg({ message: "Start date", context: "components.recurrenceContextMenu.customRecurrenceModal.startDate" }))
		);
		const monthlyDate =
			modal.contentEl.querySelector<HTMLLabelElement>(".monthly-options label")!;
		const select = monthlyDate.querySelector<HTMLSelectElement>("select")!;
		expect(select.querySelector('option[value="-1"]')?.textContent).toBe(
			i18n.translate(msg({ message: "Last day", context: "components.recurrenceContextMenu.customRecurrenceModal.lastDay" }))
		);
		// Ignore option text: the remaining label must match the full translated sentence.
		const clone = monthlyDate.cloneNode(true) as HTMLElement;
		clone.querySelector("input")?.remove();
		clone.querySelector("select")?.replaceWith(document.createTextNode("DAY"));
		expect(clone.textContent).toBe(
			i18n.translate(msg({ message: "On day {day} of each month", context: "components.recurrenceContextMenu.customRecurrenceModal.onDayOfMonth" }), {
				day: "DAY",
			})
		);
		expect(monthlyDate.querySelectorAll("select")).toHaveLength(1);
		expect(
			Array.from(
				modal.contentEl.querySelectorAll<HTMLSelectElement>(".yearly-options select")
			).find((select) => select.options.length === 12)?.options[0]?.textContent
		).toBe(new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2026, 0, 1)));
		modal.onClose();
	});

	it("localizes property labels without translating mapped identifiers or user fields", () => {
		const { plugin, i18n } = fixture(locale);
		const properties = getAvailableProperties(plugin);
		expect(properties.find((p) => p.id === "status")?.label).toBe(
			i18n.translate(msg({ message: "Status", context: "settings.taskProperties.fieldMapping.fields.status" }))
		);
		expect(properties.find((p) => p.id === "due")?.label).toContain("deadline_custom");
		expect(properties.find((p) => p.id === "user:user")?.label).toBe("USER_FIELD");
	});
});

it("keeps all source notices marked for translation", () => {
	const visit = (directory: string): void => {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const file = path.join(directory, entry.name);
			if (entry.isDirectory()) {
				visit(file);
				continue;
			}
			if (!/\.tsx?$/.test(entry.name)) continue;
			const source = fs.readFileSync(file, "utf8");
			expect({ file, notices: source.match(/(?:new Notice|showNotice)\(\s*["'`]/g) }).toEqual(
				{ file, notices: null }
			);
		}
	};
	visit(path.resolve(__dirname, "../../../src"));
});

it("keeps audited notice and setting-label call sites marked for translation", () => {
	for (const file of [
		"main.ts",
		"modals/ReminderModal.ts",
		"modals/TaskActionPaletteModal.ts",
		"modals/DateTimePickerModal.ts",
		"modals/FileSelectorModal.ts",
		"settings/tabs/integrationsTab.ts",
		"settings/tabs/featuresTab.ts",
		"settings/tabs/appearanceTab.ts",
		"components/RecurrenceContextMenu.ts",
	]) {
		const source = fs.readFileSync(path.resolve(__dirname, "../../../src", file), "utf8");
		expect({ file, notices: source.match(/new Notice\(\s*["'`]/g) }).toEqual({
			file,
			notices: null,
		});
		expect({
			file,
			labels: source.match(/\.(?:setName|setDesc|setTooltip)\(\s*["'`]/g),
		}).toEqual({ file, labels: null });
	}
});
