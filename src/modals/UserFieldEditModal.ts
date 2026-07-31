import { App, Modal, Setting, setIcon } from "obsidian";
import type TaskNotesPlugin from "../main";
import type { TaskInfo } from "../types";
import type { UserMappedField } from "../types/settings";
import {
	parseNullableTextUserFieldInput,
	parseNumberUserFieldInput,
} from "./taskModalUserFields";
import { DateTimePickerModal } from "./DateTimePickerModal";

type UserFieldValue = unknown;

export interface UserFieldEditModalOptions {
	field: UserMappedField;
	tasks: readonly TaskInfo[];
	onApply: (value: UserFieldValue, listChange?: { added?: string; removed?: string[] }) => Promise<void>;
	/** Called after the popup closes so the caller can restore its keyboard target. */
	onClose?: () => void;
}

/**
 * Edits one configured user field while keeping the task-list hotkey workflow
 * compact. The modal owns input parsing and MRU presentation; callers own task
 * persistence and bulk-update semantics.
 */
export class UserFieldEditModal extends Modal {
	private readonly options: UserFieldEditModalOptions;
	private input: HTMLInputElement | null = null;
	private value: UserFieldValue;
	private listValues: string[];
	private readonly initialListValues: string[];
	private mruButtons: HTMLButtonElement[] = [];
	private mruFocusIndex = -1;
	private suppressNextMruClick = false;
	private closed = false;
	private readonly keydownHandler = (event: KeyboardEvent) => {
		if (event.key === "Escape") {
			event.preventDefault();
			event.stopPropagation();
			this.close();
		}
	};

	/** Creates an editor bound to one field and one or more task targets. */
	constructor(app: App, private readonly plugin: TaskNotesPlugin, options: UserFieldEditModalOptions) {
		super(app);
		this.options = options;
		this.value = this.readInitialValue();
		this.listValues = Array.isArray(this.value) ? this.value.map(String) : [];
		this.initialListValues = [...this.listValues];
	}

	/** Builds the type-specific editor when Obsidian displays the modal. */
	onOpen(): void {
		this.titleEl.setText(this.options.field.displayName);
		this.modalEl.addClass("tasknotes-user-field-edit-modal");
		this.contentEl.addEventListener("keydown", this.keydownHandler, true);
		this.render();
	}

	/** Releases the modal DOM and keyboard scope without persisting changes. */
	onClose(): void {
		this.closed = true;
		this.contentEl.removeEventListener("keydown", this.keydownHandler, true);
		this.contentEl.empty();
		// Return focus ownership to the task-list view after Apply, Cancel, or Escape.
		this.options.onClose?.();
	}

	/** Reads the first target's current value to seed the editor and MRU choices. */
	private readInitialValue(): UserFieldValue {
		const task = this.options.tasks[0];
		if (!task) return this.options.field.type === "list" ? "" : undefined;
		const record = task as unknown as Record<string, unknown>;
		return record[this.options.field.key] ?? task.customProperties?.[this.options.field.key];
	}

	/** Returns the persisted five-item history for this stable field ID. */
	private getMruValues(): unknown[] {
		return this.plugin.settings.userFieldMru?.[this.options.field.id] ?? [];
	}

	/** Rebuilds the popup after a type-specific value or chip changes. */
	private render(): void {
		this.contentEl.empty();
		this.mruButtons = [];
		this.mruFocusIndex = -1;
		const field = this.options.field;
		const current = this.value;

		if (field.type === "boolean") {
			this.renderBoolean(current);
		} else {
			this.renderInput(current);
			this.renderMru();
			if (field.type === "list") this.renderExistingListValues(current);
		}

		const footer = this.contentEl.createDiv({ cls: "tasknotes-user-field-edit-footer" });
		new Setting(footer)
			.addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((button) =>
				button.setCta().setButtonText("Apply").onClick(() => void this.apply())
			);
	}

	/** Renders the immediate true/false/clear choices for boolean fields. */
	private renderBoolean(current: unknown): void {
		const values: Array<{ label: string; value: boolean | undefined }> = [
			{ label: "True", value: true },
			{ label: "False", value: false },
			{ label: "Clear", value: undefined },
		];
		const setting = new Setting(this.contentEl).setName("Value");
		for (const option of values) {
			setting.addButton((button) =>
				button
					.setButtonText(option.label)
					.onClick(() => {
						button.buttonEl.toggleClass("mod-cta", current === option.value);
						this.value = option.value;
						void this.apply();
					})
			);
		}
	}

	/** Renders text-like input and the existing date picker for scalar fields. */
	private renderInput(current: unknown): void {
		const setting = new Setting(this.contentEl).setName("Value");
		setting.addText((text) => {
			this.input = text.inputEl;
			text.setValue(this.toInputValue(current));
			if (this.options.field.type === "number") text.inputEl.type = "number";
			if (this.options.field.type === "date") text.inputEl.type = "date";
			text.onChange((value) => {
				this.value = this.parseInputValue(value);
			});
			text.inputEl.addEventListener("keydown", (event) => {
				if (event.key === "Enter") {
					event.preventDefault();
					event.stopPropagation();
					void this.apply();
				}
			});
		});
		if (this.options.field.type === "date") {
			setting.addButton((button) =>
				button.setButtonText("Pick date").onClick(() => {
					new DateTimePickerModal(this.app, {
						currentDate: typeof this.value === "string" ? this.value : null,
						title: this.options.field.displayName,
						showTime: false,
						onSelect: (date) => {
							this.value = date ?? undefined;
							if (this.input) this.input.value = date ?? "";
						},
					}).open();
				})
			);
		}
		this.input?.focus();
	}

	/** Renders recent values as quick-pick buttons. */
	private renderMru(): void {
		const values = this.getMruValues();
		if (values.length === 0) return;
		this.contentEl.createDiv({ text: "Recent values", cls: "setting-item-name" });
		const row = this.contentEl.createDiv({ cls: "tasknotes-user-field-mru" });
		for (const [index, value] of values.slice(0, 5).entries()) {
			const button = row.createEl("button", { text: this.toDisplayValue(value) });
			button.type = "button";
			button.tabIndex = 0;
			this.mruButtons.push(button);
			button.addEventListener("focus", () => {
				this.mruFocusIndex = index;
			});
			button.addEventListener("keydown", (event) => {
				if (event.key === "Enter") {
					// Keep Enter as a two-step keyboard flow: choose the MRU value,
					// then confirm it from the editor input on the next Enter.
					event.preventDefault();
					event.stopPropagation();
					this.suppressNextMruClick = true;
					this.selectMruValue(value, true, false);
					return;
				}
				if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) return;
				event.preventDefault();
				event.stopPropagation();
				const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
				const count = this.mruButtons.length;
				if (count === 0) return;
				const currentIndex = this.mruFocusIndex >= 0 ? this.mruFocusIndex : index;
				const nextIndex = (currentIndex + direction + count) % count;
				this.mruButtons[nextIndex]?.focus();
			});
			button.addEventListener("click", () => {
				if (this.suppressNextMruClick) {
					this.suppressNextMruClick = false;
					return;
				}
				this.selectMruValue(value, false, true);
			});
		}
	}

	/** Populates the editor from an MRU entry and optionally returns focus to its input. */
	private selectMruValue(value: unknown, focusInput: boolean, applyList: boolean): void {
		this.value = value;
		if (this.input) {
			this.input.value = this.toInputValue(value);
			if (focusInput) this.input.focus();
		}
		if (applyList && this.options.field.type === "list") void this.apply();
	}

	/** Renders removable chips for the first target's current list values. */
	private renderExistingListValues(current: unknown): void {
		const values = this.listValues;
		if (values.length === 0) return;
		this.contentEl.createDiv({ text: "Current values", cls: "setting-item-name" });
		const row = this.contentEl.createDiv({ cls: "tasknotes-user-field-values" });
		for (const value of values) {
			const chip = row.createDiv({ cls: "tasknotes-user-field-value" });
			chip.createSpan({ text: value });
			const remove = chip.createSpan({ cls: "tasknotes-user-field-value-remove" });
			setIcon(remove, "circle-x");
			remove.addEventListener("click", () => {
				this.listValues = values.filter((candidate) => candidate !== value);
				this.value = this.listValues;
				this.render();
			});
		}
	}

	/** Converts popup text into the configured field's persisted value type. */
	private parseInputValue(value: string): UserFieldValue {
		if (this.options.field.type === "number") {
			return parseNumberUserFieldInput(value);
		}
		if (this.options.field.type === "list") return value.trim();
		return parseNullableTextUserFieldInput(value);
	}

	/** Formats a stored value for an input control. */
	private toInputValue(value: unknown): string {
		if (Array.isArray(value)) return value.join(", ");
		return value === undefined || value === null ? "" : String(value);
	}

	/** Formats a stored value for an MRU button label. */
	private toDisplayValue(value: unknown): string {
		return Array.isArray(value) ? value.join(", ") : String(value ?? "");
	}

	/** Applies the value, updates MRU history, and closes only after persistence succeeds. */
	private async apply(): Promise<void> {
		if (this.closed) return;
		let value = this.value;
		let mruValue = value;
		let listAdded: string | undefined;
		if (this.options.field.type === "list") {
			const entered = typeof value === "string" ? value.trim() : "";
			listAdded = entered || undefined;
			mruValue = entered || undefined;
			value = entered
				? [...this.listValues, entered].filter((item, index, list) => list.indexOf(item) === index)
				: this.listValues;
		}
		await this.options.onApply(
			value,
			this.options.field.type === "list"
				? {
					added: listAdded,
					removed: this.initialListValues.filter((candidate) => !this.listValues.includes(candidate)),
				}
				: undefined
		);
		if (mruValue !== undefined) {
			const history = this.getMruValues().filter((candidate) => JSON.stringify(candidate) !== JSON.stringify(mruValue));
			this.plugin.settings.userFieldMru[this.options.field.id] = [mruValue, ...history].slice(0, 5);
		}
		void this.plugin.saveSettings();
		this.close();
	}
}
