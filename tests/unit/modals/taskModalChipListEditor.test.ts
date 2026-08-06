import {
	isTaskModalChipListEditorMobileLikeEnvironment,
	TaskModalChipListEditorModal,
} from "../../../src/modals/taskModalChipListEditor";

const mockSetIcon = jest.fn();
const mockSetTooltip = jest.fn();

jest.mock("obsidian", () => {
	const actual = jest.requireActual("obsidian");
	return {
		...actual,
		Modal: class {
			app: unknown;
			modalEl = document.createElement("div");
			contentEl = document.createElement("div");

			constructor(app: unknown) {
				this.app = app;
				this.modalEl.classList.add("modal");
				this.modalEl.appendChild(this.contentEl);
			}

			open(): void {
				this.onOpen();
			}

			close(): void {}

			onOpen(): void {}
		},
		Setting: class {
			settingEl = document.createElement("div");

			constructor(container: HTMLElement) {
				container.appendChild(this.settingEl);
			}

			setName(): this {
				return this;
			}

			setHeading(): this {
				return this;
			}

			addText(callback: (text: { inputEl: HTMLInputElement; setPlaceholder: () => void }) => void): this {
				const control = document.createElement("div");
				const input = document.createElement("input");
				control.appendChild(input);
				this.settingEl.appendChild(control);
				callback({
					inputEl: input,
					setPlaceholder: jest.fn(),
				});
				return this;
			}
		},
		setIcon: (...args: unknown[]) => mockSetIcon(...args),
		setTooltip: (...args: unknown[]) => mockSetTooltip(...args),
	};
});

jest.mock("../../../src/modals/taskModalSuggests", () => ({
	attachChipEditorContextSuggest: jest.fn(),
	attachChipEditorTagSuggest: jest.fn(),
}));

function createModal(): TaskModalChipListEditorModal {
	return new TaskModalChipListEditorModal(
		{} as never,
		{
			settings: {
				taskTag: "task",
				taskIdentificationMethod: "tag",
				hideIdentifyingTagsInCards: false,
			},
			cacheManager: {
				getAllContexts: jest.fn(() => []),
				getAllTags: jest.fn(() => []),
			},
		} as never,
		{
			title: "Tags",
			placeholder: "Add tag",
			initialValues: ["review"],
			variant: "tags",
			confirmText: "Confirm",
			cancelText: "Cancel",
			removeItemLabel: (item) => `Remove ${item}`,
			formatChipLabel: (value) => `#${value}`,
		},
		["review"]
	);
}

describe("taskModalChipListEditor", () => {
	const originalMatchMedia = window.matchMedia;

	beforeEach(() => {
		document.body.innerHTML = "";
		document.body.classList.remove("is-mobile");
		window.matchMedia = originalMatchMedia;
		mockSetIcon.mockClear();
		mockSetTooltip.mockClear();
	});

	it("detects mobile-like environments from body class or coarse pointer media", () => {
		expect(isTaskModalChipListEditorMobileLikeEnvironment(document)).toBe(false);

		document.body.classList.add("is-mobile");
		expect(isTaskModalChipListEditorMobileLikeEnvironment(document)).toBe(true);

		document.body.classList.remove("is-mobile");
		Object.defineProperty(window, "matchMedia", {
			writable: true,
			value: jest.fn().mockImplementation((query: string) => ({
				matches: query === "(pointer: coarse)",
				media: query,
				addEventListener: jest.fn(),
				removeEventListener: jest.fn(),
			})),
		});
		expect(isTaskModalChipListEditorMobileLikeEnvironment(document)).toBe(true);
	});

	it("renders icon-only cancel and confirm buttons in one row on mobile", () => {
		document.body.classList.add("is-mobile");
		const modal = createModal();
		modal.onOpen();

		expect(modal.modalEl.classList.contains("tn-chip-list-editor--mobile-actions")).toBe(true);

		const buttonBar = modal.contentEl.querySelector(".tn-chip-list-editor__buttons");
		expect(buttonBar?.classList.contains("tn-task-modal__icon-button-bar")).toBe(true);

		const trailing = modal.contentEl.querySelector(".tn-task-modal__icon-button-trailing");
		expect(trailing).not.toBeNull();

		const buttons = Array.from(trailing?.querySelectorAll("button") ?? []);
		expect(buttons).toHaveLength(2);
		expect(buttons[0].getAttribute("aria-label")).toBe("Cancel");
		expect(buttons[1].getAttribute("aria-label")).toBe("Confirm");
		expect(
			buttons[0].querySelector(".tn-task-modal__icon-button-label")?.textContent
		).toBe("Cancel");
		expect(
			buttons[1].querySelector(".tn-task-modal__icon-button-label")?.textContent
		).toBe("Confirm");
		expect(buttons[1].classList.contains("mod-cta")).toBe(true);
	});

	it("keeps labeled text buttons on desktop", () => {
		const modal = createModal();
		modal.onOpen();

		expect(modal.modalEl.classList.contains("tn-chip-list-editor--mobile-actions")).toBe(false);

		const buttonBar = modal.contentEl.querySelector(".tn-chip-list-editor__buttons");
		expect(buttonBar?.classList.contains("tn-task-modal__icon-button-bar")).toBe(false);

		const buttons = Array.from(buttonBar?.querySelectorAll("button") ?? []);
		expect(buttons).toHaveLength(2);
		expect(buttons[0].textContent).toBe("Cancel");
		expect(buttons[1].textContent).toBe("Confirm");
	});
});
