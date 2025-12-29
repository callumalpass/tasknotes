import { Setting, SettingGroup, requireApiVersion } from "obsidian";

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

export interface SettingGroupOptions {
	heading: string;
	description?: string;
	className?: string;
}

/**
 * Check if the current Obsidian version supports SettingGroup (1.11.0+)
 */
function supportsSettingGroup(): boolean {
	return requireApiVersion("1.11.0");
}

/**
 * Legacy fallback that mimics SettingGroup API for Obsidian < 1.11.0
 * Uses the old pattern of section headers and individual settings
 */
class LegacySettingGroup {
	private containerEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		this.containerEl = containerEl;
	}

	setHeading(text: string | DocumentFragment): this {
		new Setting(this.containerEl).setName(text).setHeading();
		return this;
	}

	addClass(_cls: string): this {
		// No-op for legacy - classes were not applied to groups
		return this;
	}

	addSetting(cb: (setting: Setting) => void): this {
		const setting = new Setting(this.containerEl);
		cb(setting);
		return this;
	}
}

/**
 * Helper for creating a setting group with heading
 * Uses native SettingGroup on Obsidian 1.11.0+, falls back to legacy pattern on older versions
 */
export function createSettingGroup(
	container: HTMLElement,
	options: SettingGroupOptions,
	addSettings: (group: SettingGroup | LegacySettingGroup) => void
): SettingGroup | LegacySettingGroup {
	if (supportsSettingGroup()) {
		// Use native SettingGroup on Obsidian 1.11.0+
		const group = new SettingGroup(container).setHeading(options.heading);

		if (options.className) {
			group.addClass(options.className);
		}

		// Add description as help text if provided
		if (options.description) {
			group.addSetting((setting) => {
				setting.setDesc(options.description!);
				setting.settingEl.addClass("settings-view__group-description");
			});
		}

		addSettings(group);
		return group;
	} else {
		// Fall back to legacy pattern on older Obsidian versions
		const group = new LegacySettingGroup(container).setHeading(options.heading);

		if (options.className) {
			group.addClass(options.className);
		}

		// Add description as help text if provided
		if (options.description) {
			group.addSetting((setting) => {
				setting.setDesc(options.description!);
				setting.settingEl.addClass("settings-view__group-description");
			});
		}

		addSettings(group);
		return group;
	}
}

/**
 * Helper for configuring a toggle setting (works with SettingGroup.addSetting)
 */
export function configureToggleSetting(setting: Setting, options: ToggleSettingOptions): Setting {
	return setting
		.setName(options.name)
		.setDesc(options.desc)
		.addToggle((toggle) => {
			toggle.setValue(options.getValue()).onChange(options.setValue);
		});
}

/**
 * Helper for creating standard toggle settings
 */
export function createToggleSetting(
	container: HTMLElement,
	options: ToggleSettingOptions
): Setting {
	return configureToggleSetting(new Setting(container), options);
}

/**
 * Helper for configuring a text input setting (works with SettingGroup.addSetting)
 */
export function configureTextSetting(setting: Setting, options: TextSettingOptions): Setting {
	return setting
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
 * Helper for creating standard text input settings
 */
export function createTextSetting(container: HTMLElement, options: TextSettingOptions): Setting {
	return configureTextSetting(new Setting(container), options);
}

/**
 * Helper for configuring a dropdown setting (works with SettingGroup.addSetting)
 */
export function configureDropdownSetting(setting: Setting, options: DropdownSettingOptions): Setting {
	return setting
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
 * Helper for creating standard dropdown settings
 */
export function createDropdownSetting(
	container: HTMLElement,
	options: DropdownSettingOptions
): Setting {
	return configureDropdownSetting(new Setting(container), options);
}

/**
 * Helper for configuring a number input setting (works with SettingGroup.addSetting)
 */
export function configureNumberSetting(setting: Setting, options: NumberSettingOptions): Setting {
	const setValue = options.debounceMs
		? debounce(options.setValue, options.debounceMs)
		: options.setValue;

	return setting
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
 * Helper for creating standard number input settings
 */
export function createNumberSetting(
	container: HTMLElement,
	options: NumberSettingOptions
): Setting {
	return configureNumberSetting(new Setting(container), options);
}

/**
 * Helper for configuring a button setting (works with SettingGroup.addSetting)
 */
export function configureButtonSetting(setting: Setting, options: ButtonSettingOptions): Setting {
	return setting
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
 * Helper for creating standard button settings
 */
export function createButtonSetting(
	container: HTMLElement,
	options: ButtonSettingOptions
): Setting {
	return configureButtonSetting(new Setting(container), options);
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
