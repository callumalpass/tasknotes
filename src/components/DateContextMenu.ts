import type { MessageDescriptor } from "@lingui/core";
import { uiText } from "../i18n/runtime";
import { msg } from "@lingui/core/macro";
import { App, Menu, moment as obsidianMoment, type MenuItem } from "obsidian";
import TaskNotesPlugin from "../main";
import { ContextMenu } from "./ContextMenu";
import { showCoordinatedMenu, showCoordinatedMenuAtElement } from "./ContextMenuCoordinator";
import { DateTimePickerModal } from "../modals/DateTimePickerModal";
import { addDaysToDateTime } from "../utils/dateUtils";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Components/DateContextMenu" });

type SubmenuMenuItem = {
	setSubmenu(): Menu;
};

type MomentLike = {
	format(format: string): string;
	clone(): MomentLike;
	add(amount: number, unit: string): MomentLike;
	day(day: number): MomentLike;
	isSameOrBefore(other: MomentLike, unit: string): boolean;
	isBefore(other: MomentLike): boolean;
	isSame(other: MomentLike, unit: string): boolean;
	startOf(unit: string): MomentLike;
};

function getMoment(): MomentLike {
	return (obsidianMoment as unknown as () => MomentLike)();
}

function getSubmenu(item: MenuItem): Menu {
	return (item as unknown as SubmenuMenuItem).setSubmenu();
}

export interface DateOption {
	label: string;
	value: string | null;
	icon?: string;
	isToday?: boolean;
	isCustom?: boolean;
	category?: string;
}

export interface DateContextMenuOptions {
	currentValue?: string | null;
	currentTime?: string | null;
	onSelect: (value: string | null, time?: string | null) => void;
	onCustomDate?: () => void;
	includeScheduled?: boolean;
	includeDue?: boolean;
	showRelativeDates?: boolean;
	title?: string;
	dateRole?: "due" | "scheduled";
	plugin?: TaskNotesPlugin;
	app?: App;
}

export class DateContextMenu {
	private menu: ContextMenu;
	private options: DateContextMenuOptions;

	constructor(options: DateContextMenuOptions) {
		this.menu = new ContextMenu();
		this.options = options;
		this.buildMenu();
	}

	private t(key: MessageDescriptor, params?: Record<string, string | number>): string {
		return this.options.plugin?.i18n.translate(key, params) ?? uiText(key, params);
	}

	private getFirstDayOfWeek(): number {
		const firstDay = this.options.plugin?.settings?.calendarViewSettings?.firstDay;
		return typeof firstDay === "number" &&
			Number.isInteger(firstDay) &&
			firstDay >= 0 &&
			firstDay <= 6
			? firstDay
			: 0;
	}

	private buildMenu(): void {
		if (this.options.title) {
			this.menu.addItem((item) => {
				item.setTitle(this.options.title || "");
				item.setIcon("calendar");
				item.setDisabled(true);
			});
			this.menu.addSeparator();
		}

		const dateOptions = this.getDateOptions();

		const incrementOptions = dateOptions.filter((option) => option.category === "increment");
		if (incrementOptions.length > 0) {
			incrementOptions.forEach((option) => {
				this.menu.addItem((item) => {
					if (option.icon) item.setIcon(option.icon);
					item.setTitle(option.label);
					item.onClick(async () => {
						this.options.onSelect(option.value, null);
					});
				});
			});
			this.menu.addSeparator();
		}

		const basicOptions = dateOptions.filter((option) => option.category === "basic");
		basicOptions.forEach((option) => {
			this.menu.addItem((item) => {
				if (option.icon) item.setIcon(option.icon);
				const isSelected = option.value && option.value === this.options.currentValue;
				const title = isSelected
					? this.t(msg({ message: "✓ {label}", context: "contextMenus.date.selected" }), { label: option.label })
					: option.label;
				item.setTitle(title);
				item.onClick(async () => {
					this.options.onSelect(option.value, null);
				});
			});
		});

		const weekdayOptions = dateOptions.filter((option) => option.category === "weekday");
		if (weekdayOptions.length > 0) {
			this.menu.addSeparator();
			this.menu.addItem((item) => {
				item.setTitle(this.t(msg({ message: "Weekdays", context: "contextMenus.date.weekdaysLabel" })));
				item.setIcon("calendar");
				const submenu = getSubmenu(item);
				weekdayOptions.forEach((option) => {
					submenu.addItem((subItem) => {
						const isSelected =
							option.value && option.value === this.options.currentValue;
						const title = isSelected
							? this.t(msg({ message: "✓ {label}", context: "contextMenus.date.selected" }), {
									label: option.label,
								})
							: option.label;
						subItem.setTitle(title);
						subItem.setIcon("calendar");
						subItem.onClick(async () => {
							this.options.onSelect(option.value, null);
						});
					});
				});
			});
		}

		this.menu.addSeparator();

		this.menu.addItem((item) => {
			item.setTitle(this.t(msg({ message: "Pick date & time…", context: "contextMenus.date.pickDateTime" })));
			item.setIcon("calendar");
			item.onClick(async () => {
				this.showDateTimePicker();
			});
		});

		if (this.options.currentValue) {
			this.menu.addItem((item) => {
				item.setTitle(this.t(msg({ message: "Clear date", context: "contextMenus.date.clearDate" })));
				item.setIcon("x");
				item.onClick(async () => {
					this.options.onSelect(null, null);
				});
			});
		}
	}

	public show(event: UIEvent): void {
		showCoordinatedMenu(this.menu, event);
	}

	public showAtElement(element: HTMLElement): void {
		showCoordinatedMenuAtElement(this.menu, element);
	}

	public getDateOptions(): DateOption[] {
		const today = getMoment();
		const options: DateOption[] = [];

		if (this.options.currentValue) {
			options.push({
				label: this.t(msg({ message: "+1 day", context: "contextMenus.date.increment.plusOneDay" })),
				value: addDaysToDateTime(this.options.currentValue, 1),
				icon: "plus",
				category: "increment",
			});
			options.push({
				label: this.t(msg({ message: "-1 day", context: "contextMenus.date.increment.minusOneDay" })),
				value: addDaysToDateTime(this.options.currentValue, -1),
				icon: "minus",
				category: "increment",
			});
			options.push({
				label: this.t(msg({ message: "+1 week", context: "contextMenus.date.increment.plusOneWeek" })),
				value: addDaysToDateTime(this.options.currentValue, 7),
				icon: "plus-circle",
				category: "increment",
			});
			options.push({
				label: this.t(msg({ message: "-1 week", context: "contextMenus.date.increment.minusOneWeek" })),
				value: addDaysToDateTime(this.options.currentValue, -7),
				icon: "minus-circle",
				category: "increment",
			});
		}

		options.push({
			label: this.t(msg({ message: "Today", context: "contextMenus.date.basic.today" })),
			value: today.format("YYYY-MM-DD"),
			icon: "calendar-check",
			isToday: true,
			category: "basic",
		});

		options.push({
			label: this.t(msg({ message: "Tomorrow", context: "contextMenus.date.basic.tomorrow" })),
			value: today.clone().add(1, "day").format("YYYY-MM-DD"),
			icon: "calendar-plus",
			category: "basic",
		});

		const weekdayMessages = [
			msg({ message: "Sunday", context: "common.weekdays.sunday" }),
			msg({ message: "Monday", context: "common.weekdays.monday" }),
			msg({ message: "Tuesday", context: "common.weekdays.tuesday" }),
			msg({ message: "Wednesday", context: "common.weekdays.wednesday" }),
			msg({ message: "Thursday", context: "common.weekdays.thursday" }),
			msg({ message: "Friday", context: "common.weekdays.friday" }),
			msg({ message: "Saturday", context: "common.weekdays.saturday" }),
		];
		const weekdayCodes = weekdayMessages.map((_, index) => index);
		const firstDay = this.getFirstDayOfWeek();
		const orderedWeekdayCodes = [
			...weekdayCodes.slice(firstDay),
			...weekdayCodes.slice(0, firstDay),
		];
		orderedWeekdayCodes.forEach((dayIndex) => {
			let targetDate = today.clone().day(dayIndex);
			if (targetDate.isSameOrBefore(today, "day")) {
				targetDate = targetDate.add(1, "week");
			}
			const label = this.t(weekdayMessages[dayIndex]);
			options.push({
				label,
				value: targetDate.format("YYYY-MM-DD"),
				icon: "calendar",
				category: "weekday",
			});
		});

		const nextSaturday = today.clone().day(6);
		if (nextSaturday.isBefore(today) || nextSaturday.isSame(today, "day")) {
			nextSaturday.add(1, "week");
		}
		options.push({
			label: this.t(msg({ message: "This weekend", context: "contextMenus.date.basic.thisWeekend" })),
			value: nextSaturday.format("YYYY-MM-DD"),
			icon: "calendar-days",
			category: "basic",
		});

		const nextMonday = today.clone().day(1).add(1, "week");
		options.push({
			label: this.t(msg({ message: "Next week", context: "contextMenus.date.basic.nextWeek" })),
			value: nextMonday.format("YYYY-MM-DD"),
			icon: "calendar-plus",
			category: "basic",
		});

		const nextMonth = today.clone().add(1, "month").startOf("month");
		options.push({
			label: this.t(msg({ message: "Next month", context: "contextMenus.date.basic.nextMonth" })),
			value: nextMonth.format("YYYY-MM-DD"),
			icon: "calendar-range",
			category: "basic",
		});

		return options;
	}

	private showDateTimePicker(): void {
		// Use app from options or plugin
		const app = this.options.app || this.options.plugin?.app;
		if (!app) {
			tasknotesLogger.error("DateContextMenu: No app instance available for modal", {
				category: "validation",
				operation: "datecontextmenu-no-app-instance-modal",
			});
			return;
		}

		const modal = new DateTimePickerModal(app, {
			currentDate: this.options.currentValue || null,
			currentTime: this.options.currentTime || null,
			title: this.t(msg({ message: "Set date & time", context: "contextMenus.date.modal.title" })),
			dateRole: this.options.dateRole,
			plugin: this.options.plugin,
			onSelect: (date, time) => {
				this.options.onSelect(date, time);
			},
		});

		modal.open();
	}
}
