import type { TaskListFocusController } from "./TaskListFocusController";

const OVERLAY_SELECTOR = ".menu, .modal-container:not(.modals-hidden)";
const EDITABLE_SELECTOR =
	'input, textarea, select, [contenteditable="true"], [role="textbox"], .cm-content';

export class TaskListInputOwnershipController {
	private suspendedForOverlay = false;
	private restoreTimer: number | null = null;
	private restoreAttempts = 0;

	constructor(
		private readonly viewRoot: HTMLElement,
		private readonly focusController: TaskListFocusController
	) {}

	canHandleListKeyDown(event: KeyboardEvent): boolean {
		if (event.isComposing || event.key === "Process") return false;
		if (this.suspendedForOverlay) return false;

		const target = event.target;
		if (!(target instanceof Element) || target.closest(EDITABLE_SELECTOR)) return false;
		if (this.getOverlayFromTarget(target) || this.hasOpenOverlay()) return false;

		return this.viewRoot.contains(target);
	}

	noteOverlayOpening(): void {
		const activeElement = this.viewRoot.ownerDocument.activeElement;
		if (activeElement instanceof Element && this.viewRoot.contains(activeElement)) {
			this.suspendedForOverlay = true;
		}
	}

	handleDocumentFocusIn(event: FocusEvent): void {
		const target = event.target;
		if (!(target instanceof Element)) return;

		if (this.getOverlayFromTarget(target)) {
			this.suspendedForOverlay = true;
			return;
		}

		if (this.suspendedForOverlay) {
			// Focus moved intentionally somewhere outside the closing overlay.
			this.suspendedForOverlay = false;
		}
	}

	handleOverlayInteraction(event: Event): void {
		const target = event.target;
		const overlayTarget =
			target instanceof Element && Boolean(this.getOverlayFromTarget(target));
		const overlayCloseKey =
			event instanceof KeyboardEvent &&
			(event.key === "Escape" || event.key === "Backspace") &&
			(this.suspendedForOverlay || this.hasOpenOverlay());
		if (!overlayTarget && !overlayCloseKey) return;

		this.suspendedForOverlay = true;
		this.scheduleRestoreAfterOverlayClose();
	}

	scheduleRestoreAfterOverlayClose(): void {
		if (!this.suspendedForOverlay || this.restoreTimer !== null) return;

		const win = this.viewRoot.ownerDocument.defaultView ?? window;
		this.restoreAttempts = 0;
		const check = () => {
			this.restoreTimer = null;
			if (!this.suspendedForOverlay || !this.viewRoot.isConnected) return;

			if (this.hasOpenOverlay() && this.restoreAttempts < 20) {
				this.restoreAttempts++;
				this.restoreTimer = win.setTimeout(check, 16);
				return;
			}

			if (this.hasOpenOverlay()) return;

			const activeElement = this.viewRoot.ownerDocument.activeElement;
			const body = this.viewRoot.ownerDocument.body;
			if (
				!activeElement ||
				activeElement === body ||
				!activeElement.isConnected ||
				activeElement === this.viewRoot
			) {
				this.focusController.restoreFocusedElement();
			}
			this.suspendedForOverlay = false;
		};

		this.restoreTimer = win.setTimeout(check, 0);
	}

	destroy(): void {
		if (this.restoreTimer !== null) {
			const win = this.viewRoot.ownerDocument.defaultView ?? window;
			win.clearTimeout(this.restoreTimer);
			this.restoreTimer = null;
		}
		this.suspendedForOverlay = false;
	}

	private hasOpenOverlay(): boolean {
		return this.viewRoot.ownerDocument.querySelector(OVERLAY_SELECTOR) !== null;
	}

	private getOverlayFromTarget(target: Element): Element | null {
		return target.closest(OVERLAY_SELECTOR);
	}
}
