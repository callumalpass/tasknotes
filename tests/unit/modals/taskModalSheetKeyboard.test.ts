import {
	attachTaskModalSheetKeyboardAvoidance,
	computeMobileToolbarInset,
	computeSheetBottomInset,
	computeSheetBottomInsetAdjustment,
	computeSheetBottomInsetMaxHeightPx,
	computeSheetKeyboardInset,
	computeSheetKeyboardMaxHeightPx,
	isMobileToolbarVisible,
} from "../../../src/modals/taskModalSheetKeyboard";

describe("taskModalSheetKeyboard", () => {
	describe("computeSheetKeyboardInset", () => {
		it("returns zero when the visual viewport still fills the layout viewport", () => {
			expect(
				computeSheetKeyboardInset(800, { height: 800, offsetTop: 0 })
			).toBe(0);
		});

		it("returns the covered height when the keyboard shrinks the visual viewport", () => {
			expect(
				computeSheetKeyboardInset(800, { height: 420, offsetTop: 0 })
			).toBe(380);
		});

		it("accounts for visual viewport offset when the browser shifts content", () => {
			expect(
				computeSheetKeyboardInset(800, { height: 420, offsetTop: 40 })
			).toBe(340);
		});

		it("ignores small viewport deltas from browser chrome", () => {
			expect(
				computeSheetKeyboardInset(800, { height: 770, offsetTop: 0 })
			).toBe(0);
		});
	});

	describe("computeMobileToolbarInset", () => {
		it("returns zero when the Obsidian mobile toolbar is hidden", () => {
			const toolbar = document.createElement("div");
			toolbar.className = "mobile-toolbar";
			Object.defineProperty(toolbar, "getBoundingClientRect", {
				value: () => ({ top: 800, height: 0, width: 0 }),
			});

			expect(computeMobileToolbarInset(800, toolbar)).toBe(0);
		});

		it("returns the toolbar height when it is visible at the bottom of the screen", () => {
			const toolbar = document.createElement("div");
			toolbar.className = "mobile-toolbar";
			Object.defineProperty(toolbar, "getBoundingClientRect", {
				value: () => ({ top: 756, height: 44, width: 390 }),
			});
			jest.spyOn(window, "getComputedStyle").mockReturnValue({
				display: "flex",
				visibility: "visible",
			} as CSSStyleDeclaration);

			expect(computeMobileToolbarInset(800, toolbar)).toBe(44);
			expect(isMobileToolbarVisible(toolbar)).toBe(true);
		});

		it("ignores a toolbar that is not actually docked within the visible viewport", () => {
			jest.spyOn(window, "getComputedStyle").mockReturnValue({
				display: "flex",
				visibility: "visible",
			} as CSSStyleDeclaration);

			const offscreenAbove = document.createElement("div");
			Object.defineProperty(offscreenAbove, "getBoundingClientRect", {
				value: () => ({ top: -50, height: 44, width: 390 }),
			});
			expect(computeMobileToolbarInset(800, offscreenAbove)).toBe(0);

			const offscreenBelow = document.createElement("div");
			Object.defineProperty(offscreenBelow, "getBoundingClientRect", {
				value: () => ({ top: 900, height: 44, width: 390 }),
			});
			expect(computeMobileToolbarInset(800, offscreenBelow)).toBe(0);

			const zeroHeight = document.createElement("div");
			Object.defineProperty(zeroHeight, "getBoundingClientRect", {
				value: () => ({ top: 756, height: 0, width: 390 }),
			});
			expect(computeMobileToolbarInset(800, zeroHeight)).toBe(0);
		});
	});

	describe("computeSheetBottomInset", () => {
		it("uses whichever bottom obstruction is larger between keyboard and toolbar", () => {
			const toolbar = document.createElement("div");
			Object.defineProperty(toolbar, "getBoundingClientRect", {
				value: () => ({ top: 340, height: 44, width: 390 }),
			});
			jest.spyOn(window, "getComputedStyle").mockReturnValue({
				display: "flex",
				visibility: "visible",
			} as CSSStyleDeclaration);

			expect(
				computeSheetBottomInset(800, { height: 420, offsetTop: 0 }, toolbar)
			).toBe(460);
		});

		it("clamps the combined inset so the sheet can never be pushed past the top safe area", () => {
			expect(
				computeSheetBottomInset(800, { height: 0, offsetTop: 0 }, null)
			).toBeLessThanOrEqual(800 - 16);
		});
	});

	describe("computeSheetBottomInsetMaxHeightPx", () => {
		it("leaves the configured top safe area above the sheet", () => {
			expect(
				computeSheetBottomInsetMaxHeightPx(800, 44, { offsetTop: 0 })
			).toBe(740);
			expect(
				computeSheetBottomInsetMaxHeightPx(800, 44, { offsetTop: 20 })
			).toBe(720);
		});
	});

	describe("computeSheetKeyboardMaxHeightPx", () => {
		it("leaves the configured top safe area above the sheet", () => {
			expect(computeSheetKeyboardMaxHeightPx({ height: 420, offsetTop: 0 })).toBe(404);
			expect(computeSheetKeyboardMaxHeightPx({ height: 420, offsetTop: 20 })).toBe(384);
		});
	});

	describe("computeSheetBottomInsetAdjustment", () => {
		it("returns zero inset when nothing obscures the bottom edge", () => {
			expect(
				computeSheetBottomInsetAdjustment(800, { height: 800, offsetTop: 0 }, null)
			).toEqual({
				bottomInsetPx: 0,
			});
		});

		it("returns only a bottom inset when the keyboard is open", () => {
			expect(
				computeSheetBottomInsetAdjustment(800, { height: 420, offsetTop: 0 }, null)
			).toEqual({
				bottomInsetPx: 380,
			});
		});

		it("returns only a bottom inset for the mobile toolbar when the keyboard is closed", () => {
			const toolbar = document.createElement("div");
			Object.defineProperty(toolbar, "getBoundingClientRect", {
				value: () => ({ top: 756, height: 44, width: 390 }),
			});
			jest.spyOn(window, "getComputedStyle").mockReturnValue({
				display: "flex",
				visibility: "visible",
			} as CSSStyleDeclaration);

			expect(
				computeSheetBottomInsetAdjustment(800, { height: 800, offsetTop: 0 }, toolbar)
			).toEqual({
				bottomInsetPx: 44,
			});
		});
	});

	describe("attachTaskModalSheetKeyboardAvoidance", () => {
		afterEach(() => {
			jest.useRealTimers();
			jest.restoreAllMocks();
		});

		function mockVisualViewport(
			win: Window,
			viewport: { height: number; offsetTop: number }
		): VisualViewport {
			const listeners = new Map<string, Set<EventListener>>();
			const visualViewport = {
				height: viewport.height,
				offsetTop: viewport.offsetTop,
				addEventListener: (type: string, listener: EventListener) => {
					if (!listeners.has(type)) {
						listeners.set(type, new Set());
					}
					listeners.get(type)!.add(listener);
				},
				removeEventListener: (type: string, listener: EventListener) => {
					listeners.get(type)?.delete(listener);
				},
				dispatch: (type: string) => {
					for (const listener of listeners.get(type) ?? []) {
						listener(new Event(type));
					}
				},
			};

			Object.defineProperty(win, "visualViewport", {
				configurable: true,
				value: visualViewport,
			});
			Object.defineProperty(win, "innerHeight", {
				configurable: true,
				value: 800,
			});

			return visualViewport as unknown as VisualViewport;
		}

		it("lifts the whole sheet via bottom inset and freezes its current height", () => {
			const modalEl = document.createElement("div");
			modalEl.style.setProperty("--tn-sheet-max-height", "60dvh");
			jest.spyOn(modalEl, "getBoundingClientRect").mockReturnValue({
				height: 480,
				width: 0,
				top: 0,
				left: 0,
				right: 0,
				bottom: 480,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			} as DOMRect);
			const win = modalEl.ownerDocument.defaultView!;
			const visualViewport = mockVisualViewport(win, { height: 420, offsetTop: 0 });

			const controller = attachTaskModalSheetKeyboardAvoidance({
				modalEl,
				getSnapMaxHeight: () => "60dvh",
				isDragging: () => false,
			});

			visualViewport.dispatch("resize");

			expect(modalEl.style.getPropertyValue("--tn-sheet-bottom-inset")).toBe("380px");
			expect(modalEl.style.getPropertyValue("--tn-sheet-max-height")).toBe("480px");
			expect(modalEl.classList.contains("tn-task-modal__sheet--bottom-inset")).toBe(true);

			controller.destroy();
		});

		it("lifts the sheet when Obsidian's mobile toolbar is visible", () => {
			const modalEl = document.createElement("div");
			modalEl.style.setProperty("--tn-sheet-max-height", "60dvh");
			jest.spyOn(modalEl, "getBoundingClientRect").mockReturnValue({
				height: 480,
				width: 0,
				top: 0,
				left: 0,
				right: 0,
				bottom: 480,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			} as DOMRect);
			const win = modalEl.ownerDocument.defaultView!;
			mockVisualViewport(win, { height: 800, offsetTop: 0 });

			const toolbar = document.createElement("div");
			toolbar.className = "mobile-toolbar";
			document.body.appendChild(toolbar);
			Object.defineProperty(toolbar, "getBoundingClientRect", {
				value: () => ({ top: 756, height: 44, width: 390 }),
			});
			jest.spyOn(win, "getComputedStyle").mockReturnValue({
				display: "flex",
				visibility: "visible",
			} as CSSStyleDeclaration);

			const controller = attachTaskModalSheetKeyboardAvoidance({
				modalEl,
				getSnapMaxHeight: () => "60dvh",
				isDragging: () => false,
			});

			expect(modalEl.style.getPropertyValue("--tn-sheet-bottom-inset")).toBe("44px");
			expect(modalEl.style.getPropertyValue("--tn-sheet-max-height")).toBe("480px");
			expect(modalEl.classList.contains("tn-task-modal__sheet--bottom-inset")).toBe(true);

			controller.destroy();
			toolbar.remove();
		});

		it("restores the snap max-height when the obstruction closes", () => {
			const modalEl = document.createElement("div");
			jest.spyOn(modalEl, "getBoundingClientRect").mockReturnValue({
				height: 480,
				width: 0,
				top: 0,
				left: 0,
				right: 0,
				bottom: 480,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			} as DOMRect);
			const win = modalEl.ownerDocument.defaultView!;
			const visualViewport = mockVisualViewport(win, { height: 420, offsetTop: 0 });

			const controller = attachTaskModalSheetKeyboardAvoidance({
				modalEl,
				getSnapMaxHeight: () => "calc(100dvh - 16px)",
				isDragging: () => false,
			});

			visualViewport.dispatch("resize");
			(visualViewport as unknown as { height: number }).height = 800;
			visualViewport.dispatch("resize");

			expect(modalEl.style.getPropertyValue("--tn-sheet-bottom-inset")).toBe("0");
			expect(modalEl.style.getPropertyValue("--tn-sheet-max-height")).toBe(
				"calc(100dvh - 16px)"
			);
			expect(modalEl.classList.contains("tn-task-modal__sheet--bottom-inset")).toBe(false);

			controller.destroy();
		});

		it("does not apply bottom inset adjustments while the sheet is being dragged", () => {
			const modalEl = document.createElement("div");
			const win = modalEl.ownerDocument.defaultView!;
			const visualViewport = mockVisualViewport(win, { height: 420, offsetTop: 0 });

			const controller = attachTaskModalSheetKeyboardAvoidance({
				modalEl,
				getSnapMaxHeight: () => "60dvh",
				isDragging: () => true,
			});

			visualViewport.dispatch("resize");

			expect(modalEl.style.getPropertyValue("--tn-sheet-bottom-inset")).toBe("");
			expect(modalEl.classList.contains("tn-task-modal__sheet--bottom-inset")).toBe(false);

			controller.destroy();
		});

		it("freezes the sheet height on focus before the keyboard viewport resize", () => {
			jest.useFakeTimers();
			const modalEl = document.createElement("div");
			modalEl.style.setProperty("--tn-sheet-max-height", "60dvh");
			const input = document.createElement("input");
			modalEl.appendChild(input);
			jest.spyOn(modalEl, "getBoundingClientRect").mockReturnValue({
				height: 480,
				width: 0,
				top: 0,
				left: 0,
				right: 0,
				bottom: 480,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			} as DOMRect);
			const win = modalEl.ownerDocument.defaultView!;
			mockVisualViewport(win, { height: 800, offsetTop: 0 });

			const controller = attachTaskModalSheetKeyboardAvoidance({
				modalEl,
				getSnapMaxHeight: () => "60dvh",
				isDragging: () => false,
			});

			input.dispatchEvent(new Event("focusin", { bubbles: true }));

			expect(modalEl.style.getPropertyValue("--tn-sheet-max-height")).toBe("480px");

			controller.destroy();
		});

		it("schedules a refresh after a field inside the sheet receives focus", () => {
			jest.useFakeTimers();
			const modalEl = document.createElement("div");
			const input = document.createElement("input");
			modalEl.appendChild(input);
			const win = modalEl.ownerDocument.defaultView!;
			mockVisualViewport(win, { height: 420, offsetTop: 0 });

			const controller = attachTaskModalSheetKeyboardAvoidance({
				modalEl,
				getSnapMaxHeight: () => "60dvh",
				isDragging: () => false,
			});

			input.dispatchEvent(new Event("focusin", { bubbles: true }));
			jest.runOnlyPendingTimers();

			expect(modalEl.style.getPropertyValue("--tn-sheet-bottom-inset")).toBe("380px");

			controller.destroy();
		});
	});
});
