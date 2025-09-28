import { Setting } from "obsidian";

export interface ToggleSettingOptions {
	name: string;
	desc: string;
	getValue: () => boolean;
	setValue: (value: boolean) => void;
}

export interface TextSettingOptions {
	name: string;
	desc: string;
	placeholder?: string;
	getValue: () => string;
	setValue: (value: string) => void;
	ariaLabel?: string;
	debounceMs?: number; // Optional debounce time in milliseconds
}

export interface DropdownSettingOptions {
	name: string;
	desc: string;
	options: { value: string; label: string }[];
	getValue: () => string;
	setValue: (value: string) => void;
	ariaLabel?: string;
}

export interface NumberSettingOptions {
	name: string;
	desc: string;
	placeholder?: string;
	getValue: () => number;
	setValue: (value: number) => void;
	min?: number;
	max?: number;
	ariaLabel?: string;
	debounceMs?: number;
}

export interface ButtonSettingOptions {
	name: string;
	desc: string;
	buttonText: string;
	onClick: () => void | Promise<void>;
	buttonClass?: string;
}

/**
 * Helper for creating standard toggle settings
 */
export function createToggleSetting(
	container: HTMLElement,
	options: ToggleSettingOptions
): Setting {
	return new Setting(container)
		.setName(options.name)
		.setDesc(options.desc)
		.addToggle((toggle) => {
			toggle.setValue(options.getValue()).onChange(options.setValue);
		});
}

/**
 * Helper for creating standard text input settings
 */
export function createTextSetting(container: HTMLElement, options: TextSettingOptions): Setting {
	return new Setting(container)
		.setName(options.name)
		.setDesc(options.desc)
		.addText((text) => {
			text.setValue(options.getValue());

			// Use debounced onChange if debounceMs is specified
			if (options.debounceMs && options.debounceMs > 0) {
				const debouncedSetValue = debounce(options.setValue, options.debounceMs);
				text.onChange(debouncedSetValue);
			} else {
				text.onChange(options.setValue);
			}

			if (options.placeholder) {
				text.setPlaceholder(options.placeholder);
			}

			if (options.ariaLabel) {
				text.inputEl.setAttribute("aria-label", options.ariaLabel);
			}

			// Apply consistent styling
			text.inputEl.addClass("settings-view__input");

			return text;
		});
}

/**
 * Helper for creating standard dropdown settings
 */
export function createDropdownSetting(
	container: HTMLElement,
	options: DropdownSettingOptions
): Setting {
	return new Setting(container)
		.setName(options.name)
		.setDesc(options.desc)
		.addDropdown((dropdown) => {
			options.options.forEach((option) => {
				dropdown.addOption(option.value, option.label);
			});

			dropdown.setValue(options.getValue()).onChange(options.setValue);

			if (options.ariaLabel) {
				dropdown.selectEl.setAttribute("aria-label", options.ariaLabel);
			}

			return dropdown;
		});
}

/**
 * Helper for creating standard number input settings
 */
export function createNumberSetting(
	container: HTMLElement,
	options: NumberSettingOptions
): Setting {
	const setValue = options.debounceMs
		? debounce(options.setValue, options.debounceMs)
		: options.setValue;

	return new Setting(container)
		.setName(options.name)
		.setDesc(options.desc)
		.addText((text) => {
			text.setValue(options.getValue().toString()).onChange((value) => {
				const num = parseInt(value);
				if (!isNaN(num)) {
					if (options.min !== undefined && num < options.min) return;
					if (options.max !== undefined && num > options.max) return;
					setValue(num);
				}
			});

			text.inputEl.type = "number";

			if (options.placeholder) {
				text.setPlaceholder(options.placeholder);
			}

			if (options.min !== undefined) {
				text.inputEl.setAttribute("min", options.min.toString());
			}

			if (options.max !== undefined) {
				text.inputEl.setAttribute("max", options.max.toString());
			}

			if (options.ariaLabel) {
				text.inputEl.setAttribute("aria-label", options.ariaLabel);
			}

			// Apply consistent styling
			text.inputEl.addClass("settings-view__input");

			return text;
		});
}

/**
 * Helper for creating standard button settings
 */
export function createButtonSetting(
	container: HTMLElement,
	options: ButtonSettingOptions
): Setting {
	return new Setting(container)
		.setName(options.name)
		.setDesc(options.desc)
		.addButton((button) => {
			button.setButtonText(options.buttonText).onClick(options.onClick);

			if (options.buttonClass) {
				button.buttonEl.addClass(options.buttonClass);
			} else {
				button.buttonEl.addClasses(["tn-btn", "tn-btn--ghost"]);
			}

			return button;
		});
}

/**
 * Helper for creating section headers
 */
export function createSectionHeader(container: HTMLElement, title: string): Setting {
	return new Setting(container).setName(title).setHeading();
}

/**
 * Helper for creating help text with consistent styling
 */
export function createHelpText(container: HTMLElement, text: string): HTMLElement {
	return container.createEl("p", {
		text,
		cls: "settings-view__help-note",
	});
}

/**
 * Helper for creating validation notes
 */
export function createValidationNote(container: HTMLElement, text: string): HTMLElement {
	return container.createEl("p", {
		text,
		cls: "settings-validation-note",
	});
}

/**
 * Helper for creating list headers with consistent styling
 */
export function createListHeaders(
	container: HTMLElement,
	headers: string[],
	className = ""
): HTMLElement {
	const headersRow = container.createDiv(`settings-view__list-headers ${className}`.trim());

	headers.forEach((header) => {
		headersRow.createEl("span", {
			text: header,
			cls: "settings-view__column-header",
		});
	});

	// Add spacer for action buttons
	headersRow.createDiv("settings-view__header-spacer");

	return headersRow;
}

/**
 * Debounce function for reducing save calls
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number,
	immediate = false
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout> | undefined;

	return function (this: any, ...args: Parameters<T>) {
		const later = () => {
			timeout = undefined;
			if (!immediate) func.apply(this, args);
		};

		const callNow = immediate && !timeout;
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);

		if (callNow) func.apply(this, args);
	};
}
