import { App, setIcon } from "obsidian";
import { ContextMenu } from "./ContextMenu";
import { DateTimePickerModal } from "../modals/DateTimePickerModal";
import { addDaysToDateTime } from "../utils/dateUtils";

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
	plugin?: any;
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

	private t(key: string, fallback?: string, params?: Record<string, string | number>): string {
		return this.options.plugin?.i18n.translate(key, params) || fallback || key;
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
					? this.t("contextMenus.date.selected", "✓ {label}", { label: option.label })
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
				item.setTitle(this.t("contextMenus.date.weekdaysLabel", "Weekdays"));
				item.setIcon("calendar");
				const submenu = (item as any).setSubmenu();
				weekdayOptions.forEach((option) => {
					submenu.addItem((subItem: any) => {
						const isSelected =
							option.value && option.value === this.options.currentValue;
						const title = isSelected
							? this.t("contextMenus.date.selected", "✓ {label}", {
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
			item.setTitle(this.t("contextMenus.date.pickDateTime", "Pick date & time…"));
			item.setIcon("calendar");
			item.onClick(async () => {
				this.showDateTimePicker();
			});
		});

		if (this.options.currentValue) {
			this.menu.addItem((item) => {
				item.setTitle(this.t("contextMenus.date.clearDate", "Clear date"));
				item.setIcon("x");
				item.onClick(async () => {
					this.options.onSelect(null, null);
				});
			});
		}
	}

	public getDateOptions(): DateOption[] {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const today = (window as any).moment();
		const options: DateOption[] = [];

		if (this.options.currentValue) {
			options.push({
				label: this.t("contextMenus.date.increment.plusOneDay", "+1 day"),
				value: addDaysToDateTime(this.options.currentValue, 1),
				icon: "plus",
				category: "increment",
			});
			options.push({
				label: this.t("contextMenus.date.increment.minusOneDay", "-1 day"),
				value: addDaysToDateTime(this.options.currentValue, -1),
				icon: "minus",
				category: "increment",
			});
			options.push({
				label: this.t("contextMenus.date.increment.plusOneWeek", "+1 week"),
				value: addDaysToDateTime(this.options.currentValue, 7),
				icon: "plus-circle",
				category: "increment",
			});
			options.push({
				label: this.t("contextMenus.date.increment.minusOneWeek", "-1 week"),
				value: addDaysToDateTime(this.options.currentValue, -7),
				icon: "minus-circle",
				category: "increment",
			});
		}

		options.push({
			label: this.t("contextMenus.date.basic.today", "Today"),
			value: today.format("YYYY-MM-DD"),
			icon: "calendar-check",
			isToday: true,
			category: "basic",
		});

		options.push({
			label: this.t("contextMenus.date.basic.tomorrow", "Tomorrow"),
			value: today.clone().add(1, "day").format("YYYY-MM-DD"),
			icon: "calendar-plus",
			category: "basic",
		});

		const weekdayCodes = [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday",
		];
		weekdayCodes.forEach((dayName, index) => {
			let targetDate = today.clone().day(index);
			if (targetDate.isSameOrBefore(today, "day")) {
				targetDate = targetDate.add(1, "week");
			}
			const label = this.t(`common.weekdays.${dayName.toLowerCase()}` as const, dayName);
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
			label: this.t("contextMenus.date.basic.thisWeekend", "This weekend"),
			value: nextSaturday.format("YYYY-MM-DD"),
			icon: "calendar-days",
			category: "basic",
		});

		const nextMonday = today.clone().day(1).add(1, "week");
		options.push({
			label: this.t("contextMenus.date.basic.nextWeek", "Next week"),
			value: nextMonday.format("YYYY-MM-DD"),
			icon: "calendar-plus",
			category: "basic",
		});

		const nextMonth = today.clone().add(1, "month").startOf("month");
		options.push({
			label: this.t("contextMenus.date.basic.nextMonth", "Next month"),
			value: nextMonth.format("YYYY-MM-DD"),
			icon: "calendar-range",
			category: "basic",
		});

		return options;
	}

	public show(event: UIEvent): void {
		this.menu.show(event);
	}

	public showAtElement(element: HTMLElement): void {
		this.menu.showAtPosition({
			x: element.getBoundingClientRect().left,
			y: element.getBoundingClientRect().bottom + 4,
		});
	}

	private showDateTimePicker(): void {
		// Use app from options or plugin
		const app = this.options.app || this.options.plugin?.app;
		if (!app) {
			console.error("DateContextMenu: No app instance available for modal");
			return;
		}

		const modal = new DateTimePickerModal(app, {
			currentDate: this.options.currentValue || null,
			currentTime: this.options.currentTime || null,
			title: this.t("contextMenus.date.modal.title", "Set date & time"),
			onSelect: (date, time) => {
				this.options.onSelect(date, time);
			},
		});

		modal.open();
	}
}
