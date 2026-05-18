const mockTextControls: Array<{
	inputEl: HTMLInputElement;
	onChangeCallback?: (value: string) => void;
}> = [];

const mockContextSuggest = jest.fn();
const mockTagSuggest = jest.fn();
const mockSanitizeTags = jest.fn((value: string) => `sanitized:${value}`);

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
	},
}));

jest.mock("../../../src/modals/taskModalSuggests", () => ({
	ContextSuggest: mockContextSuggest,
	TagSuggest: mockTagSuggest,
}));

jest.mock("../../../src/utils/helpers", () => ({
	sanitizeTags: mockSanitizeTags,
}));

import type TaskNotesPlugin from "../../../src/main";
import {
	createTaskModalContextsField,
	createTaskModalTagsField,
	createTaskModalTimeEstimateField,
	parseTaskModalTimeEstimate,
	type TaskModalMetadataFieldContext,
} from "../../../src/modals/taskModalMetadataFields";

function createContext(): TaskModalMetadataFieldContext {
	return {
		app: {} as never,
		plugin: {} as TaskNotesPlugin,
		translate: (key) => `translated:${key}`,
		attachMobileKeyboardScrollGuard: jest.fn(),
	};
}

describe("taskModalMetadataFields", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		mockTextControls.length = 0;
		mockContextSuggest.mockClear();
		mockTagSuggest.mockClear();
		mockSanitizeTags.mockClear();
	});

	it("creates the contexts field with input ref, wide setting class, guard, and suggest", () => {
		const context = createContext();
		const container = document.createElement("div");
		const onChange = jest.fn();

		const input = createTaskModalContextsField(context, {
			container,
			value: "home",
			onChange,
		});

		expect(input.value).toBe("home");
		expect(input.placeholder).toBe("translated:modals.task.contextsPlaceholder");
		expect(container.textContent).toContain("translated:modals.task.contextsLabel");
		expect(container.querySelector(".tn-task-modal__wide-text-setting")).not.toBeNull();
		expect(context.attachMobileKeyboardScrollGuard).toHaveBeenCalledWith(input);
		expect(mockContextSuggest).toHaveBeenCalledWith(context.app, input, context.plugin);

		mockTextControls[0].onChangeCallback?.("work");
		expect(onChange).toHaveBeenCalledWith("work");
	});

	it("creates the tags field and sanitizes changes before updating modal state", () => {
		const context = createContext();
		const container = document.createElement("div");
		const onChange = jest.fn();

		const input = createTaskModalTagsField(context, {
			container,
			value: "project",
			onChange,
		});

		expect(input.value).toBe("project");
		expect(input.placeholder).toBe("translated:modals.task.tagsPlaceholder");
		expect(container.textContent).toContain("translated:modals.task.tagsLabel");
		expect(context.attachMobileKeyboardScrollGuard).toHaveBeenCalledWith(input);
		expect(mockTagSuggest).toHaveBeenCalledWith(context.app, input, context.plugin);

		mockTextControls[0].onChangeCallback?.("#alpha, beta");
		expect(mockSanitizeTags).toHaveBeenCalledWith("#alpha, beta");
		expect(onChange).toHaveBeenCalledWith("sanitized:#alpha, beta");
	});

	it("creates the time estimate field and parses numeric input", () => {
		const context = createContext();
		const container = document.createElement("div");
		const onChange = jest.fn();

		const input = createTaskModalTimeEstimateField(context, {
			container,
			value: 25,
			onChange,
		});

		expect(input.value).toBe("25");
		expect(input.placeholder).toBe("translated:modals.task.timeEstimatePlaceholder");
		expect(container.textContent).toContain("translated:modals.task.timeEstimateLabel");
		expect(context.attachMobileKeyboardScrollGuard).toHaveBeenCalledWith(input);

		mockTextControls[0].onChangeCallback?.("45");
		mockTextControls[0].onChangeCallback?.("not a number");

		expect(onChange).toHaveBeenNthCalledWith(1, 45);
		expect(onChange).toHaveBeenNthCalledWith(2, 0);
	});

	it("parses blank and invalid time estimates as zero", () => {
		expect(parseTaskModalTimeEstimate("60")).toBe(60);
		expect(parseTaskModalTimeEstimate("")).toBe(0);
		expect(parseTaskModalTimeEstimate("later")).toBe(0);
	});
});
