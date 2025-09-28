import { Menu, setIcon } from "obsidian";

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
}

export class DateContextMenu {
	private menu: Menu;
	private options: DateContextMenuOptions;

	constructor(options: DateContextMenuOptions) {
		this.menu = new Menu();
		this.options = options;
		this.buildMenu();
	}

	private t(key: string, fallback?: string, params?: Record<string, string | number>): string {
		return this.options.plugin?.i18n.translate(key, params) || fallback || key;
	}

	private buildMenu(): void {
		if (this.options.title) {
			this.menu.addItem((item) => {
				item.setTitle(this.options.title!);
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
		const locale = this.options.plugin?.i18n.getCurrentLocale() || "en";
		const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: "long" });
		const monthFormatter = new Intl.DateTimeFormat(locale, { month: "long" });

		if (this.options.currentValue) {
			const currentDate = (window as any).moment(this.options.currentValue);
			options.push({
				label: this.t("contextMenus.date.increment.plusOneDay", "+1 day"),
				value: currentDate.clone().add(1, "day").format("YYYY-MM-DD"),
				icon: "plus",
				category: "increment",
			});
			options.push({
				label: this.t("contextMenus.date.increment.minusOneDay", "-1 day"),
				value: currentDate.clone().subtract(1, "day").format("YYYY-MM-DD"),
				icon: "minus",
				category: "increment",
			});
			options.push({
				label: this.t("contextMenus.date.increment.plusOneWeek", "+1 week"),
				value: currentDate.clone().add(1, "week").format("YYYY-MM-DD"),
				icon: "plus-circle",
				category: "increment",
			});
			options.push({
				label: this.t("contextMenus.date.increment.minusOneWeek", "-1 week"),
				value: currentDate.clone().subtract(1, "week").format("YYYY-MM-DD"),
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

	public show(event: MouseEvent): void {
		this.menu.showAtMouseEvent(event);
	}

	public showAtElement(element: HTMLElement): void {
		this.menu.showAtPosition({
			x: element.getBoundingClientRect().left,
			y: element.getBoundingClientRect().bottom + 4,
		});
	}

	private showDateTimePicker(): void {
		const modal = this.createModal();

		// Create title with icon
		const header = this.createHeader();

		// Create date input section
		const dateSection = this.createDateSection();

		// Create time input section
		const timeSection = this.createTimeSection();

		// Create action buttons
		const buttonSection = this.createButtonSection();

		// Assemble modal
		modal.appendChild(header);
		modal.appendChild(dateSection.container);
		modal.appendChild(timeSection.container);
		modal.appendChild(buttonSection.container);

		document.body.appendChild(modal);

		// Set up event handlers
		this.setupModalEventHandlers(
			modal,
			dateSection.input,
			timeSection.input,
			buttonSection.selectButton
		);

		// Focus the date input
		setTimeout(() => {
			dateSection.input.focus();
		}, 100);
	}

	private createModal(): HTMLElement {
		const modal = document.createElement("div");
		modal.className = "date-picker-modal";
		return modal;
	}

	private createHeader(): HTMLElement {
		const header = document.createElement("div");
		header.className = "date-picker-modal__header";

		// Calendar icon
		const icon = document.createElement("div");
		icon.className = "date-picker-modal__header-icon";
		setIcon(icon, "calendar");

		const title = document.createElement("h3");
		title.className = "date-picker-modal__header-title";
		title.textContent = this.t("contextMenus.date.modal.title", "Set date & time");

		header.appendChild(icon);
		header.appendChild(title);
		return header;
	}

	private createDateSection(): { container: HTMLElement; input: HTMLInputElement } {
		const container = document.createElement("div");
		container.className = "date-picker-modal__section";

		const label = this.createInputLabel(
			"calendar",
			this.t("contextMenus.date.modal.dateLabel", "Date")
		);
		const inputContainer = this.createInputContainer();
		const input = this.createDateInput();

		if (this.options.currentValue?.trim()) {
			input.value = this.options.currentValue;
		}

		inputContainer.appendChild(input);
		container.appendChild(label);
		container.appendChild(inputContainer);

		return { container, input };
	}

	private createTimeSection(): { container: HTMLElement; input: HTMLInputElement } {
		const container = document.createElement("div");
		container.className = "date-picker-modal__section date-picker-modal__section--buttons";

		const label = this.createInputLabel(
			"clock",
			this.t("contextMenus.date.modal.timeLabel", "Time (optional)")
		);
		const inputContainer = this.createInputContainer();
		const input = this.createTimeInput();

		if (this.options.currentTime?.trim()) {
			input.value = this.options.currentTime;
		}

		inputContainer.appendChild(input);
		container.appendChild(label);
		container.appendChild(inputContainer);

		return { container, input };
	}

	private createInputLabel(iconName: string, text: string): HTMLElement {
		const label = document.createElement("label");
		label.className = "date-picker-modal__label";

		const icon = document.createElement("div");
		icon.className = "date-picker-modal__label-icon";
		setIcon(icon, iconName === "calendar" ? "calendar" : "clock");

		const labelText = document.createElement("span");
		labelText.textContent = text;

		label.appendChild(icon);
		label.appendChild(labelText);
		return label;
	}

	private createInputContainer(): HTMLElement {
		const container = document.createElement("div");
		container.className = "date-picker-modal__input-container";
		return container;
	}

	private createDateInput(): HTMLInputElement {
		const input = document.createElement("input");
		input.type = "date";
		input.className = "date-picker-modal__input";
		this.addPickerClickHandler(input);
		return input;
	}

	private createTimeInput(): HTMLInputElement {
		const input = document.createElement("input");
		input.type = "time";
		input.className = "date-picker-modal__input";
		this.addPickerClickHandler(input);
		return input;
	}

	private addPickerClickHandler(input: HTMLInputElement): void {
		input.addEventListener("click", () => {
			if ("showPicker" in input && typeof (input as any).showPicker === "function") {
				try {
					(input as any).showPicker();
				} catch (error) {
					input.focus();
				}
			} else {
				input.focus();
			}
		});
	}

	private createButtonSection(): { container: HTMLElement; selectButton: HTMLButtonElement } {
		const container = document.createElement("div");
		container.className = "date-picker-modal__buttons";

		const cancelButton = this.createButton(this.t("common.cancel", "Cancel"), false);
		const selectButton = this.createButton(
			this.t("contextMenus.date.modal.select", "Select"),
			true
		);

		container.appendChild(cancelButton);
		container.appendChild(selectButton);

		return { container, selectButton };
	}

	private createButton(text: string, isPrimary: boolean): HTMLButtonElement {
		const button = document.createElement("button");
		button.textContent = text;
		button.className = isPrimary
			? "date-picker-modal__button date-picker-modal__button--primary"
			: "date-picker-modal__button date-picker-modal__button--secondary";
		return button;
	}

	private setupModalEventHandlers(
		modal: HTMLElement,
		dateInput: HTMLInputElement,
		timeInput: HTMLInputElement,
		selectButton: HTMLButtonElement
	): void {
		// Select button click
		selectButton.addEventListener("click", () => {
			if (dateInput.value) {
				this.options.onSelect(dateInput.value, timeInput.value || null);
			}
			document.body.removeChild(modal);
		});

		// Cancel button click
		const cancelButton = modal.querySelector(
			".date-picker-modal__button--secondary"
		) as HTMLButtonElement;
		cancelButton.addEventListener("click", () => {
			document.body.removeChild(modal);
		});

		// Escape key
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				document.body.removeChild(modal);
				document.removeEventListener("keydown", handleEscape);
			}
		};
		document.addEventListener("keydown", handleEscape);

		// Enter key in inputs
		const handleEnter = (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				selectButton.click();
			}
		};

		dateInput.addEventListener("keydown", handleEnter);
		timeInput.addEventListener("keydown", handleEnter);

		// Click outside to close
		const handleClickOutside = (e: MouseEvent) => {
			if (!modal.contains(e.target as Node)) {
				document.body.removeChild(modal);
				document.removeEventListener("click", handleClickOutside);
				document.removeEventListener("keydown", handleEscape);
			}
		};

		// Add slight delay to prevent immediate closure
		setTimeout(() => {
			document.addEventListener("click", handleClickOutside);
		}, 100);
	}
}
