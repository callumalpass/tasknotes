import { App, Modal, Setting, setIcon } from "obsidian";
import type TaskNotesPlugin from "../main";
import { addContextToList, normalizeContextList } from "../components/TaskContextMenu";
import { createTaskModalIconButton } from "./taskModalActionButtons";
import {
	attachChipEditorContextSuggest,
	attachChipEditorTagSuggest,
} from "./taskModalSuggests";
import { parseTaskModalCommaList } from "./taskModalOrgCounts";
import { addTagsToList, normalizeTaskTagList, parseTaskTagInput } from "../utils/taskTagList";

export type TaskModalChipListVariant = "contexts" | "tags";

export interface TaskModalChipListEditorOptions {
	title: string;
	placeholder: string;
	initialValues: string[];
	variant: TaskModalChipListVariant;
	confirmText: string;
	cancelText: string;
	removeItemLabel: (item: string) => string;
	formatChipLabel: (value: string) => string;
}

export function formatTaskModalChipListEditorLabel(
	variant: TaskModalChipListVariant,
	value: string
): string {
	return variant === "tags" ? `#${value}` : value;
}

export function isTaskModalChipListEditorMobileLikeEnvironment(
	doc: Document = document
): boolean {
	const win = doc.defaultView || window;
	return (
		doc.body.classList.contains("is-mobile") ||
		win.matchMedia?.("(pointer: coarse)")?.matches === true
	);
}

export function finalizeTaskModalChipListEditorValues(
	values: readonly string[],
	pendingInput: string,
	variant: TaskModalChipListVariant
): string[] {
	if (variant === "contexts") {
		let next = [...values];
		for (const entry of parseTaskModalCommaList(pendingInput)) {
			next = addContextToList(next, entry) ?? next;
		}
		return normalizeContextList(next);
	}

	let next = [...values];
	for (const entry of parseTaskTagInput(pendingInput)) {
		next = addTagsToList(next, [entry]) ?? next;
	}
	return normalizeTaskTagList(next);
}

export class TaskModalChipListEditorModal extends Modal {
	private readonly options: TaskModalChipListEditorOptions;
	private readonly plugin: TaskNotesPlugin;
	private selectedValues: string[];
	private chipsContainer: HTMLElement;
	private inputEl: HTMLInputElement;
	private resolve: (value: string[] | null) => void;
	private submitted = false;

	constructor(
		app: App,
		plugin: TaskNotesPlugin,
		options: TaskModalChipListEditorOptions,
		initialValues: string[]
	) {
		super(app);
		this.plugin = plugin;
		this.options = options;
		this.selectedValues =
			options.variant === "contexts"
				? normalizeContextList(initialValues)
				: normalizeTaskTagList(initialValues);
	}

	public show(): Promise<string[] | null> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tasknotes-plugin", "tn-chip-list-editor__content");
		this.modalEl.addClass("tn-chip-list-editor");

		const useIconButtons = isTaskModalChipListEditorMobileLikeEnvironment(
			contentEl.ownerDocument
		);
		if (useIconButtons) {
			this.modalEl.addClass("tn-chip-list-editor--mobile-actions");
		}

		new Setting(contentEl).setName(this.options.title).setHeading();

		this.chipsContainer = contentEl.createDiv("tn-chip-list-editor__chips");
		this.renderChips();

		const inputSetting = new Setting(contentEl);
		inputSetting.settingEl.addClass("tn-chip-list-editor__input-setting");
		inputSetting.addText((text) => {
			this.inputEl = text.inputEl;
			text.setPlaceholder(this.options.placeholder);
			this.attachSuggest();
		});

		const buttonContainer = contentEl.createEl("div", {
			cls: useIconButtons
				? "modal-button-container tn-chip-list-editor__buttons tn-task-modal__icon-button-bar"
				: "modal-button-container tn-chip-list-editor__buttons",
		});

		let cancelButton: HTMLButtonElement;
		let confirmButton: HTMLButtonElement;

		if (useIconButtons) {
			const trailingGroup = buttonContainer.createDiv("tn-task-modal__icon-button-trailing");
			cancelButton = createTaskModalIconButton(trailingGroup, {
				iconName: "x",
				label: this.options.cancelText,
			});
			confirmButton = createTaskModalIconButton(trailingGroup, {
				iconName: "check",
				label: this.options.confirmText,
				isPrimary: true,
			});
		} else {
			cancelButton = buttonContainer.createEl("button", {
				text: this.options.cancelText,
			});
			confirmButton = buttonContainer.createEl("button", {
				text: this.options.confirmText,
				cls: "mod-cta",
			});
		}

		cancelButton.addEventListener("click", () => {
			this.resolve(null);
			this.close();
		});

		confirmButton.addEventListener("click", () => {
			this.submit();
		});

		this.inputEl.addEventListener("keydown", (event) => {
			if (event.key === "Enter") {
				event.preventDefault();
				if (this.inputEl.value.trim()) {
					this.addFromInput();
					return;
				}
				confirmButton.click();
			} else if (event.key === "Escape") {
				event.preventDefault();
				cancelButton.click();
			}
		});

		window.setTimeout(() => {
			this.inputEl.focus();
		}, 100);
	}

	onClose(): void {
		this.contentEl.empty();
		if (this.resolve && !this.submitted) {
			this.resolve(null);
		}
	}

	private attachSuggest(): void {
		const callbacks = {
			getSelectedValues: () => this.selectedValues,
			onAdd: (value: string) => {
				this.addValue(value);
			},
		};

		if (this.options.variant === "contexts") {
			attachChipEditorContextSuggest(this.app, this.inputEl, this.plugin, callbacks);
			return;
		}

		attachChipEditorTagSuggest(this.app, this.inputEl, this.plugin, callbacks);
	}

	private renderChips(): void {
		this.chipsContainer.empty();
		this.chipsContainer.classList.toggle("is-empty", this.selectedValues.length === 0);

		for (const value of this.selectedValues) {
			const chip = this.chipsContainer.createDiv("tn-chip-list-editor__chip");
			chip.createSpan({
				cls: "tn-chip-list-editor__chip-label",
				text: this.options.formatChipLabel(value),
			});

			const removeButton = chip.createEl("button", {
				cls: "tn-chip-list-editor__chip-remove",
				attr: {
					"aria-label": this.options.removeItemLabel(
						this.options.formatChipLabel(value)
					),
					type: "button",
				},
			});
			setIcon(removeButton, "x");
			removeButton.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.removeValue(value);
			});
		}
	}

	private addValue(rawValue: string): void {
		const entries =
			this.options.variant === "contexts"
				? parseTaskModalCommaList(rawValue)
				: parseTaskTagInput(rawValue);

		if (!entries.length) {
			this.inputEl.value = "";
			return;
		}

		let nextValues = this.selectedValues;
		for (const entry of entries) {
			const updated =
				this.options.variant === "contexts"
					? addContextToList(nextValues, entry)
					: addTagsToList(nextValues, [entry]);
			if (updated) {
				nextValues = updated;
			}
		}

		const normalized =
			this.options.variant === "contexts"
				? normalizeContextList(nextValues)
				: normalizeTaskTagList(nextValues);

		if (normalized.length === this.selectedValues.length) {
			this.inputEl.value = "";
			return;
		}

		this.selectedValues = normalized;
		this.inputEl.value = "";
		this.renderChips();
	}

	private addFromInput(): void {
		this.addValue(this.inputEl.value);
	}

	private removeValue(value: string): void {
		this.selectedValues = this.selectedValues.filter((entry) => entry !== value);
		this.renderChips();
		this.inputEl.focus();
	}

	private submit(): void {
		const next = finalizeTaskModalChipListEditorValues(
			this.selectedValues,
			this.inputEl.value,
			this.options.variant
		);
		this.submitted = true;
		this.resolve(next);
		this.close();
	}
}

export async function showTaskModalChipListEditor(
	app: App,
	plugin: TaskNotesPlugin,
	options: TaskModalChipListEditorOptions,
	initialValues: string[]
): Promise<string[] | null> {
	const modal = new TaskModalChipListEditorModal(app, plugin, options, initialValues);
	return modal.show();
}
