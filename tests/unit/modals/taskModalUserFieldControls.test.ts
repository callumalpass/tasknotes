const mockTextControls: Array<{
	inputEl: HTMLInputElement;
	placeholder?: string;
	onChangeCallback?: (value: string) => void;
	setValue: (value: string) => unknown;
	getValue: () => string;
}> = [];

const mockToggleControls: Array<{
	value?: boolean;
	onChangeCallback?: (value: boolean) => void;
	setValue: (value: boolean) => unknown;
}> = [];

const mockDateMenus: Array<{
	options: {
		currentValue?: string | null;
		onSelect: (value: string | null) => void;
	};
	showAtElement: jest.Mock;
}> = [];

const mockSetIcon = jest.fn();
const mockUserFieldSuggest = jest.fn();
const mockAttachDateInputBehavior = jest.fn();

jest.mock("obsidian", () => ({
	Setting: class {
		settingEl: HTMLElement;
		nameEl: HTMLElement;
		controlEl: HTMLElement;

		constructor(container: HTMLElement) {
			this.settingEl = document.createElement("div");
			this.nameEl = document.createElement("div");
			this.controlEl = document.createElement("div");
			this.settingEl.appendChild(this.nameEl);
			this.settingEl.appendChild(this.controlEl);
			container.appendChild(this.settingEl);
		}

		setName(name: string): this {
			this.nameEl.textContent = name;
			return this;
		}

		addText(
			callback: (text: {
				inputEl: HTMLInputElement;
				setPlaceholder: (placeholder: string) => unknown;
				setValue: (value: string) => unknown;
				getValue: () => string;
				onChange: (handler: (value: string) => void) => unknown;
			}) => void
		): this {
			const inputEl = document.createElement("input");
			const text = {
				inputEl,
				setPlaceholder: (placeholder: string) => {
					inputEl.placeholder = placeholder;
					return text;
				},
				setValue: (value: string) => {
					inputEl.value = value;
					return text;
				},
				getValue: () => inputEl.value,
				onChange: (handler: (value: string) => void) => {
					mockTextControls[mockTextControls.length - 1].onChangeCallback = handler;
					return text;
				},
			};
			mockTextControls.push(text);
			this.controlEl.appendChild(inputEl);
			callback(text);
			return this;
		}

		addToggle(
			callback: (toggle: {
				setValue: (value: boolean) => unknown;
				onChange: (handler: (value: boolean) => void) => unknown;
			}) => void
		): this {
			const toggle = {
				setValue: (value: boolean) => {
					toggle.value = value;
					return toggle;
				},
				onChange: (handler: (value: boolean) => void) => {
					toggle.onChangeCallback = handler;
					return toggle;
				},
				value: undefined as boolean | undefined,
				onChangeCallback: undefined as ((value: boolean) => void) | undefined,
			};
			mockToggleControls.push(toggle);
			callback(toggle);
			return this;
		}
	},
	setIcon: mockSetIcon,
}));

jest.mock("../../../src/components/DateContextMenu", () => ({
	DateContextMenu: jest.fn().mockImplementation((options) => {
		const menu = {
			options,
			showAtElement: jest.fn(),
		};
		mockDateMenus.push(menu);
		return menu;
	}),
}));

jest.mock("../../../src/modals/taskModalSuggests", () => ({
	UserFieldSuggest: mockUserFieldSuggest,
}));

jest.mock("../../../src/ui/dateInputBehavior", () => ({
	attachDateInputBehavior: mockAttachDateInputBehavior,
}));

import type TaskNotesPlugin from "../../../src/main";
import {
	createTaskModalConfiguredUserField,
	createTaskModalUserFieldsSection,
	updateTaskModalUserFieldControls,
	type TaskModalUserFieldContext,
} from "../../../src/modals/taskModalUserFieldControls";
import type { UserMappedField } from "../../../src/types/settings";

function createContext(): TaskModalUserFieldContext {
	return {
		app: {} as never,
		plugin: {} as TaskNotesPlugin,
		translate: (key, params) =>
			params?.field ? `translated:${key}:${params.field}` : `translated:${key}`,
		attachMobileKeyboardScrollGuard: jest.fn(),
	};
}

function createField(overrides: Partial<UserMappedField>): UserMappedField {
	return {
		id: overrides.id ?? overrides.key ?? "field",
		key: overrides.key ?? "field",
		displayName: overrides.displayName ?? "Field",
		type: overrides.type ?? "text",
	};
}

describe("taskModalUserFieldControls", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		mockTextControls.length = 0;
		mockToggleControls.length = 0;
		mockDateMenus.length = 0;
		mockSetIcon.mockClear();
		mockUserFieldSuggest.mockClear();
		mockAttachDateInputBehavior.mockClear();
	});

	it("creates configured list fields with display normalization, refs, guard, suggest, and parsing", () => {
		const context = createContext();
		const container = document.createElement("div");
		const inputRefs = new Map<string, HTMLInputElement>();
		const toggleRefs = new Map();
		const onValueChange = jest.fn();
		const field = createField({
			id: "labels",
			key: "labels",
			displayName: "Labels",
			type: "list",
		});

		createTaskModalConfiguredUserField(context, {
			container,
			field,
			values: { labels: ["alpha", 2, true] },
			inputRefs,
			toggleRefs,
			onValueChange,
		});

		const input = inputRefs.get("labels");
		expect(input?.value).toBe("alpha, 2, true");
		expect(container.textContent).toContain("Labels");
		expect(context.attachMobileKeyboardScrollGuard).toHaveBeenCalledWith(input);
		expect(mockUserFieldSuggest).toHaveBeenCalledWith(context.app, input, context.plugin, field);

		mockTextControls[0].onChangeCallback?.("beta, , gamma");
		expect(onValueChange).toHaveBeenCalledWith("labels", ["beta", "gamma"]);
	});

	it("creates configured number, date, and boolean fields without legacy placeholders", () => {
		const context = createContext();
		const container = document.createElement("div");
		const inputRefs = new Map<string, HTMLInputElement>();
		const toggleRefs = new Map();
		const onValueChange = jest.fn();

		createTaskModalConfiguredUserField(context, {
			container,
			field: createField({ key: "effort", displayName: "Effort", type: "number" }),
			values: { effort: 4 },
			inputRefs,
			toggleRefs,
			onValueChange,
		});
		createTaskModalConfiguredUserField(context, {
			container,
			field: createField({ key: "due_custom", displayName: "Custom Due", type: "date" }),
			values: { due_custom: "2026-05-19" },
			inputRefs,
			toggleRefs,
			onValueChange,
		});
		createTaskModalConfiguredUserField(context, {
			container,
			field: createField({ key: "flagged", displayName: "Flagged", type: "boolean" }),
			values: { flagged: true },
			inputRefs,
			toggleRefs,
			onValueChange,
		});

		expect(inputRefs.get("effort")?.type).toBe("number");
		expect(inputRefs.get("due_custom")?.type).toBe("date");
		expect(inputRefs.get("effort")?.placeholder).toBe("");
		expect(inputRefs.get("due_custom")?.placeholder).toBe("");
		expect(mockAttachDateInputBehavior).toHaveBeenCalledWith(
			inputRefs.get("due_custom"),
			expect.objectContaining({ onCommit: expect.any(Function) })
		);
		expect(mockToggleControls[0].value).toBe(true);

		mockTextControls[0].onChangeCallback?.("not numeric");
		mockTextControls[1].onChangeCallback?.("2026-06-01");
		mockToggleControls[0].onChangeCallback?.(false);
		mockAttachDateInputBehavior.mock.calls[0][1].onCommit("2026-06-02");

		expect(onValueChange).toHaveBeenCalledWith("effort", null);
		expect(onValueChange).toHaveBeenCalledWith("due_custom", "2026-06-01");
		expect(onValueChange).toHaveBeenCalledWith("due_custom", "2026-06-02");
		expect(onValueChange).toHaveBeenCalledWith("flagged", false);
	});

	it("creates the legacy user-field section with placeholders, date picker, and nullable parsing", () => {
		const context = createContext();
		const container = document.createElement("div");
		const oldPreview = container.createDiv({ cls: "user-field-link-preview" });
		const inputRefs = new Map<string, HTMLInputElement>();
		const toggleRefs = new Map();
		const onValueChange = jest.fn();
		const fields = [
			createField({ key: "assignee", displayName: "Assignee", type: "text" }),
			createField({ key: "labels", displayName: "Labels", type: "list" }),
			createField({ key: "effort", displayName: "Effort", type: "number" }),
			createField({ key: "custom_date", displayName: "Custom Date", type: "date" }),
			createField({ key: "flagged", displayName: "Flagged", type: "boolean" }),
		];

		createTaskModalUserFieldsSection(context, {
			container,
			fields,
			values: {
				assignee: "Ada",
				labels: ["alpha", "beta"],
				effort: 5,
				custom_date: "2026-05-19",
				flagged: "true",
			},
			inputRefs,
			toggleRefs,
			onValueChange,
		});

		expect(container.textContent).toContain("translated:modals.task.customFieldsLabel");
		expect(inputRefs.get("assignee")?.placeholder).toBe(
			"translated:modals.task.userFields.textPlaceholder:Assignee"
		);
		expect(inputRefs.get("labels")?.placeholder).toBe(
			"translated:modals.task.userFields.listPlaceholder"
		);
		expect(inputRefs.get("effort")?.placeholder).toBe(
			"translated:modals.task.userFields.numberPlaceholder"
		);
		expect(inputRefs.get("custom_date")?.placeholder).toBe(
			"translated:modals.task.userFields.datePlaceholder"
		);
		expect(inputRefs.get("labels")?.value).toBe("alpha, beta");
		expect(mockUserFieldSuggest).toHaveBeenCalledTimes(2);
		expect(oldPreview.isConnected).toBe(false);
		expect(mockToggleControls[0].value).toBe(true);

		const dateButton = container.querySelector<HTMLButtonElement>(".user-field-date-picker-btn");
		expect(dateButton?.getAttribute("aria-label")).toBe(
			"translated:modals.task.userFields.pickDate:Custom Date"
		);
		expect(dateButton?.parentElement?.classList.contains("tn-date-control")).toBe(true);
		expect(mockSetIcon).toHaveBeenCalledWith(dateButton, "calendar");

		mockTextControls[0].onChangeCallback?.("");
		mockTextControls[1].onChangeCallback?.("one, , two");
		mockTextControls[2].onChangeCallback?.("7");
		mockTextControls[3].onChangeCallback?.("");
		mockToggleControls[0].onChangeCallback?.(false);
		dateButton?.click();
		mockDateMenus[0].options.onSelect("2026-06-03");

		expect(onValueChange).toHaveBeenCalledWith("assignee", null);
		expect(onValueChange).toHaveBeenCalledWith("labels", ["one", "two"]);
		expect(onValueChange).toHaveBeenCalledWith("effort", 7);
		expect(onValueChange).toHaveBeenCalledWith("custom_date", null);
		expect(onValueChange).toHaveBeenCalledWith("custom_date", "2026-06-03");
		expect(onValueChange).toHaveBeenCalledWith("flagged", false);
		expect(mockDateMenus[0].showAtElement).toHaveBeenCalledWith(dateButton);
	});

	it("updates existing user-field input and toggle controls from modal state", () => {
		const listInput = document.createElement("input");
		const textInput = document.createElement("input");
		const toggle = { setValue: jest.fn() };

		updateTaskModalUserFieldControls({
			fields: [
				{ key: "labels" },
				{ key: "assignee" },
				{ key: "flagged" },
			],
			values: {
				labels: ["alpha", "beta"],
				assignee: "Ada",
				flagged: "true",
			},
			inputRefs: new Map([
				["labels", listInput],
				["assignee", textInput],
			]),
			toggleRefs: new Map([["flagged", toggle]]),
		});

		expect(listInput.value).toBe("alpha, beta");
		expect(textInput.value).toBe("Ada");
		expect(toggle.setValue).toHaveBeenCalledWith(true);
	});
});
