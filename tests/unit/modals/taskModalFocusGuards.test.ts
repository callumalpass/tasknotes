import { TaskModalFocusGuards } from "../../../src/modals/taskModalFocusGuards";

function createElements() {
	const containerEl = document.createElement("div");
	const modalEl = document.createElement("div");
	const contentEl = document.createElement("div");
	containerEl.appendChild(modalEl);
	modalEl.appendChild(contentEl);
	document.body.appendChild(containerEl);
	return { containerEl, modalEl, contentEl };
}

describe("taskModalFocusGuards", () => {
	let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView | undefined;

	beforeEach(() => {
		document.body.innerHTML = "";
		document.body.classList.add("is-mobile");
		jest.useFakeTimers();
		originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
		HTMLElement.prototype.scrollIntoView = jest.fn();
	});

	afterEach(() => {
		jest.useRealTimers();
		document.body.classList.remove("is-mobile");
		if (originalScrollIntoView) {
			HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
		} else {
			delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
		}
	});

	it("reports mobile-like environments and uses the longer focus delay", () => {
		const guards = new TaskModalFocusGuards(createElements());

		expect(guards.isMobileLikeEnvironment()).toBe(true);
		expect(guards.getInitialFocusDelay()).toBe(350);

		document.body.classList.remove("is-mobile");
		expect(guards.isMobileLikeEnvironment()).toBe(false);
		expect(guards.getInitialFocusDelay()).toBe(100);
	});

	it("restores captured title scroll positions after tapped focus", () => {
		const elements = createElements();
		const guards = new TaskModalFocusGuards(elements);
		const scrollContainer = elements.contentEl.createDiv({ cls: "modal-split-content" });
		const input = scrollContainer.createEl("textarea");

		scrollContainer.scrollTop = 120;
		guards.attachTitleFocusScrollGuard(input);
		input.dispatchEvent(new Event("pointerdown", { bubbles: true }));

		scrollContainer.scrollTop = 900;
		input.dispatchEvent(new Event("focus"));
		jest.runOnlyPendingTimers();

		expect(scrollContainer.scrollTop).toBe(120);
	});

	it("focuses the title input without scroll and restores captured positions", () => {
		const elements = createElements();
		const guards = new TaskModalFocusGuards(elements);
		const scrollContainer = elements.contentEl.createDiv({ cls: "modal-split-content" });
		const input = scrollContainer.createEl("textarea");
		const focus = jest.spyOn(input, "focus").mockImplementation(() => {});
		const select = jest.spyOn(input, "select").mockImplementation(() => {});

		scrollContainer.scrollTop = 44;
		guards.focusTitleInput(input);
		jest.runOnlyPendingTimers();

		expect(focus).toHaveBeenCalledWith({ preventScroll: true });
		expect(select).toHaveBeenCalledTimes(1);
		expect(scrollContainer.scrollTop).toBe(44);
	});

	it("scrolls mobile keyboard fields into view and cleans up on destroy", () => {
		const elements = createElements();
		const guards = new TaskModalFocusGuards(elements);
		const scrollContainer = elements.contentEl.createDiv({ cls: "modal-split-content" });
		const settingItem = scrollContainer.createDiv({ cls: "setting-item" });
		const input = settingItem.createEl("input");

		guards.attachMobileKeyboardScrollGuard(input);
		input.dispatchEvent(new Event("focus"));
		jest.runOnlyPendingTimers();

		expect(elements.containerEl.classList.contains("is-mobile-keyboard-focused")).toBe(true);
		expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
			block: "center",
			inline: "nearest",
			behavior: "smooth",
		});

		guards.destroy();

		expect(elements.containerEl.classList.contains("is-mobile-keyboard-focused")).toBe(false);
	});
});
