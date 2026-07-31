import type { TaskModalTitleInputElement } from "./taskModalTitleInput";

export interface TaskModalFocusGuardElements {
	containerEl: HTMLElement;
	modalEl: HTMLElement;
	contentEl: HTMLElement;
}

export interface TaskModalScrollPosition {
	element: HTMLElement;
	scrollTop: number;
	scrollLeft: number;
}

export interface TaskModalMobileKeyboardScrollGuardOptions {
	scrollOnFocus?: boolean;
}

export class TaskModalFocusGuards {
	private readonly elements: TaskModalFocusGuardElements;
	private guardedTitleInputs = new WeakSet<TaskModalTitleInputElement>();
	private guardedMobileKeyboardInputs = new WeakSet<HTMLElement>();
	private pendingTitleFocusScrollPositions: TaskModalScrollPosition[] | null = null;
	private mobileKeyboardFocusCleanups: Array<() => void> = [];
	private mobileKeyboardScrollTimers: number[] = [];

	constructor(elements: TaskModalFocusGuardElements) {
		this.elements = elements;
	}

	focusTitleInput(input: TaskModalTitleInputElement): void {
		const win = this.getWindow();
		win.setTimeout(() => {
			this.pendingTitleFocusScrollPositions = this.captureTitleFocusScrollPositions(input);
			input.focus({ preventScroll: true });
			input.select();
			this.restoreTitleFocusScrollPositions(this.pendingTitleFocusScrollPositions);
		}, this.getInitialFocusDelay());
	}

	getInitialFocusDelay(): number {
		return this.isMobileLikeEnvironment() ? 350 : 100;
	}

	isMobileLikeEnvironment(): boolean {
		const doc = this.elements.containerEl.ownerDocument;
		const win = doc.defaultView || window;
		return (
			doc.body.classList.contains("is-mobile") ||
			win.matchMedia?.("(pointer: coarse)")?.matches === true
		);
	}

	attachTitleFocusScrollGuard(input: TaskModalTitleInputElement): void {
		if (this.guardedTitleInputs.has(input)) return;
		this.guardedTitleInputs.add(input);

		const capture = () => {
			this.pendingTitleFocusScrollPositions = this.captureTitleFocusScrollPositions(input);
		};

		input.addEventListener("pointerdown", capture, { capture: true });
		input.addEventListener("touchstart", capture, { capture: true });
		input.addEventListener("focus", () => {
			if (!this.pendingTitleFocusScrollPositions) return;
			this.scheduleTitleFocusScrollRestore(this.pendingTitleFocusScrollPositions);
		});
	}

	attachMobileKeyboardScrollGuard(
		input: HTMLElement,
		options: TaskModalMobileKeyboardScrollGuardOptions = {}
	): void {
		if (this.guardedMobileKeyboardInputs.has(input)) return;
		this.guardedMobileKeyboardInputs.add(input);
		const shouldScrollOnFocus = options.scrollOnFocus ?? true;

		const handleFocus = () => {
			if (!this.isMobileLikeEnvironment()) return;
			this.elements.containerEl.addClass("is-mobile-keyboard-focused");
			if (shouldScrollOnFocus) {
				this.scheduleMobileKeyboardScrollIntoView(input);
			}
		};
		const handleBlur = () => {
			const win = input.ownerDocument.defaultView || window;
			win.setTimeout(() => {
				const activeElement = input.ownerDocument.activeElement;
				if (
					!activeElement ||
					!this.elements.modalEl.contains(activeElement) ||
					!this.isKeyboardTextEntryElement(activeElement)
				) {
					this.elements.containerEl.removeClass("is-mobile-keyboard-focused");
				}
			}, 100);
		};

		input.addEventListener("focus", handleFocus);
		input.addEventListener("blur", handleBlur);
		this.mobileKeyboardFocusCleanups.push(() => {
			input.removeEventListener("focus", handleFocus);
			input.removeEventListener("blur", handleBlur);
		});
	}

	destroy(): void {
		for (const cleanup of this.mobileKeyboardFocusCleanups) {
			cleanup();
		}
		this.mobileKeyboardFocusCleanups = [];

		const win = this.getWindow();
		for (const timer of this.mobileKeyboardScrollTimers) {
			win.clearTimeout(timer);
		}
		this.mobileKeyboardScrollTimers = [];
		this.elements.containerEl.removeClass("is-mobile-keyboard-focused");
		this.pendingTitleFocusScrollPositions = null;
	}

	captureTitleFocusScrollPositions(
		input: TaskModalTitleInputElement
	): TaskModalScrollPosition[] | null {
		if (!this.isMobileLikeEnvironment()) {
			return null;
		}

		const elements = new Set<HTMLElement>();
		const addElement = (element: Element | null | undefined) => {
			const elementWindow = element?.ownerDocument.defaultView;
			const HTMLElementConstructor = elementWindow?.HTMLElement ?? HTMLElement;
			if (element instanceof HTMLElementConstructor) {
				elements.add(element);
			}
		};

		addElement(this.elements.containerEl);
		addElement(this.elements.modalEl);
		addElement(this.elements.contentEl);
		this.elements.modalEl
			.querySelectorAll<HTMLElement>(
				".modal-content, .minimalist-modal-container, .modal-split-content, .modal-split-left, .modal-split-right, .details-container"
			)
			.forEach(addElement);

		let parent = input.parentElement;
		while (parent && parent !== this.elements.containerEl.parentElement) {
			addElement(parent);
			parent = parent.parentElement;
		}

		return Array.from(elements).map((element) => ({
			element,
			scrollTop: element.scrollTop,
			scrollLeft: element.scrollLeft,
		}));
	}

	restoreTitleFocusScrollPositions(positions: TaskModalScrollPosition[] | null): void {
		if (!positions) return;
		for (const { element, scrollTop, scrollLeft } of positions) {
			element.scrollTop = scrollTop;
			element.scrollLeft = scrollLeft;
		}
	}

	private scheduleTitleFocusScrollRestore(positions: TaskModalScrollPosition[]): void {
		this.restoreTitleFocusScrollPositions(positions);

		const win = this.getWindow();
		if (win.requestAnimationFrame) {
			win.requestAnimationFrame(() => this.restoreTitleFocusScrollPositions(positions));
		} else {
			win.setTimeout(() => this.restoreTitleFocusScrollPositions(positions), 16);
		}
		win.setTimeout(() => this.restoreTitleFocusScrollPositions(positions), 50);
		win.setTimeout(() => {
			this.restoreTitleFocusScrollPositions(positions);
			if (this.pendingTitleFocusScrollPositions === positions) {
				this.pendingTitleFocusScrollPositions = null;
			}
		}, 250);
	}

	private isKeyboardTextEntryElement(element: Element): boolean {
		const win = element.ownerDocument.defaultView || window;
		const InputConstructor = win.HTMLInputElement ?? HTMLInputElement;
		const TextAreaConstructor = win.HTMLTextAreaElement ?? HTMLTextAreaElement;

		if (isInstanceOf(element, TextAreaConstructor)) {
			return true;
		}
		if (!isInstanceOf(element, InputConstructor)) {
			return false;
		}

		const nonTextTypes = new Set([
			"button",
			"checkbox",
			"color",
			"file",
			"hidden",
			"radio",
			"range",
			"reset",
			"submit",
		]);
		return !nonTextTypes.has(element.type);
	}

	private scheduleMobileKeyboardScrollIntoView(input: HTMLElement): void {
		const win = input.ownerDocument.defaultView || window;
		for (const delay of [0, 150, 350]) {
			const timer = win.setTimeout(() => {
				this.mobileKeyboardScrollTimers = this.mobileKeyboardScrollTimers.filter(
					(id) => id !== timer
				);
				this.scrollMobileKeyboardTargetIntoView(input);
			}, delay);
			this.mobileKeyboardScrollTimers.push(timer);
		}
	}

	private scrollMobileKeyboardTargetIntoView(input: HTMLElement): void {
		if (!this.isMobileLikeEnvironment()) return;

		const target = input.closest<HTMLElement>(".setting-item") ?? input;
		target.scrollIntoView({
			block: "nearest",
			inline: "nearest",
			behavior: "auto",
		});

		this.nudgeFocusedFieldInsideVisualViewport(target);
	}

	private nudgeFocusedFieldInsideVisualViewport(target: HTMLElement): void {
		const win = target.ownerDocument.defaultView || window;
		const visualViewport = win.visualViewport;
		const viewportBottom =
			visualViewport && Number.isFinite(visualViewport.height)
				? visualViewport.offsetTop + visualViewport.height
				: win.innerHeight;

		if (!Number.isFinite(viewportBottom) || viewportBottom <= 0) return;

		const scrollContainer =
			target.closest<HTMLElement>(".modal-split-content") ??
			target.closest<HTMLElement>(".modal-content") ??
			this.elements.contentEl;
		const targetRect = target.getBoundingClientRect();
		const containerRect = scrollContainer.getBoundingClientRect();
		const safeTop = Math.max(visualViewport?.offsetTop ?? 0, containerRect.top) + 24;
		const safeBottom = Math.min(viewportBottom, containerRect.bottom) - 24;

		if (targetRect.bottom > safeBottom) {
			scrollContainer.scrollTop += targetRect.bottom - safeBottom;
		} else if (targetRect.top < safeTop) {
			scrollContainer.scrollTop -= safeTop - targetRect.top;
		}
	}

	private getWindow(): Window {
		return this.elements.containerEl.ownerDocument.defaultView || window;
	}
}

function isInstanceOf<T extends Element>(
	element: Element,
	constructor: { new (...args: never[]): T }
): element is T {
	return (
		element.instanceOf?.(constructor) === true ||
		Object.prototype.isPrototypeOf.call(constructor.prototype, element)
	);
}
