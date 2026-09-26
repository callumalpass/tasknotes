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
			block: "nearest",
			inline: "nearest",
			behavior: "auto",
		});

		guards.destroy();

		expect(elements.containerEl.classList.contains("is-mobile-keyboard-focused")).toBe(false);
	});

	it.each(["contenteditable", "textarea"])(
		"protects the description %s when focus moves from the title (#2352)",
		(kind) => {
			const elements = createElements();
			const guards = new TaskModalFocusGuards(elements);
			const title = elements.contentEl.createEl("textarea");
			const wrapper = elements.contentEl.createDiv();
			const editor = wrapper.createEl(kind === "textarea" ? "textarea" : "div");
			if (kind === "contenteditable") {
				editor.setAttribute("contenteditable", "true");
				editor.tabIndex = 0;
				// jsdom does not implement isContentEditable.
				Object.defineProperty(editor, "isContentEditable", { value: true });
			}
			guards.attachMobileKeyboardScrollGuard(title, { scrollOnFocus: false });
			guards.attachMobileKeyboardScrollGuard(wrapper);
			title.focus();
			editor.focus();
			jest.runOnlyPendingTimers();

			expect(elements.containerEl.classList.contains("is-mobile-keyboard-focused")).toBe(true);
			expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();

			editor.blur();
			jest.runOnlyPendingTimers();
			expect(elements.containerEl.classList.contains("is-mobile-keyboard-focused")).toBe(false);
			guards.destroy();
		}
	);

	it("nudges the focused description above a late-opening keyboard and removes viewport listeners", () => {
		const originalViewport = Object.getOwnPropertyDescriptor(window, "visualViewport");
		const viewport = new EventTarget();
		Object.assign(viewport, { height: 667, offsetTop: 0 });
		Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
		const elements = createElements();
		const guards = new TaskModalFocusGuards(elements);
		try {
			const scroller = elements.contentEl.createDiv({ cls: "modal-split-content" });
			const wrapper = scroller.createDiv();
			const editor = wrapper.createEl("textarea");
			jest.spyOn(scroller, "getBoundingClientRect").mockReturnValue({ top: 0, bottom: 500 } as DOMRect);
			jest.spyOn(editor, "getBoundingClientRect").mockReturnValue({ top: 413, bottom: 453 } as DOMRect);
			guards.attachMobileKeyboardScrollGuard(wrapper);
			editor.focus();
			jest.runOnlyPendingTimers();
			expect(scroller.scrollTop).toBe(0);

			Object.assign(viewport, { height: 367 });
			viewport.dispatchEvent(new Event("resize"));
			jest.advanceTimersByTime(0);
			expect(scroller.scrollTop).toBe(110);

			guards.destroy();
			jest.mocked(HTMLElement.prototype.scrollIntoView).mockClear();
			viewport.dispatchEvent(new Event("resize"));
			jest.runOnlyPendingTimers();
			expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
		} finally {
			guards.destroy();
			if (originalViewport) {
				Object.defineProperty(window, "visualViewport", originalViewport);
			} else {
				Reflect.deleteProperty(window, "visualViewport");
			}
		}
	});

	it("does not scroll a previously focused field after focus moves", () => {
		const elements = createElements();
		const guards = new TaskModalFocusGuards(elements);
		const first = elements.contentEl.createEl("textarea");
		const second = elements.contentEl.createEl("textarea");
		const firstScroll = jest.spyOn(first, "scrollIntoView");
		guards.attachMobileKeyboardScrollGuard(first);
		guards.attachMobileKeyboardScrollGuard(second, { scrollOnFocus: false });
		first.focus();
		second.focus();
		jest.runOnlyPendingTimers();
		expect(firstScroll).not.toHaveBeenCalled();
		guards.destroy();
	});

	it("does not enable the description guard on desktop", () => {
		document.body.classList.remove("is-mobile");
		const elements = createElements();
		const guards = new TaskModalFocusGuards(elements);
		const wrapper = elements.contentEl.createDiv();
		const editor = wrapper.createEl("textarea");
		guards.attachMobileKeyboardScrollGuard(wrapper);
		editor.focus();
		jest.runOnlyPendingTimers();
		expect(elements.containerEl.classList.contains("is-mobile-keyboard-focused")).toBe(false);
		expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
		guards.destroy();
	});

	it("can mark keyboard focus without forcing the title field to scroll", () => {
		const elements = createElements();
		const guards = new TaskModalFocusGuards(elements);
		const input = elements.contentEl.createEl("textarea");

		guards.attachMobileKeyboardScrollGuard(input, { scrollOnFocus: false });
		input.dispatchEvent(new Event("focus"));
		jest.runOnlyPendingTimers();

		expect(elements.containerEl.classList.contains("is-mobile-keyboard-focused")).toBe(true);
		expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
	});
});
