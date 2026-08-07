export type TaskListFocusIdentity = {
	path: string;
	occurrence: number;
};

export type TaskListFocusMoveDirection = "next" | "previous" | "first" | "last";

/**
 * Given the currently-focused path (if any) and the requested move direction,
 * mount and return the off-screen card that virtualization would otherwise
 * hide, or null if there truly is no further item in that direction. Consulted
 * only when moveFocus() would otherwise clamp at the edge of currently-rendered
 * cards, so views that don't supply this see no behavior change.
 */
export type TaskListFocusOffscreenResolver = (
	currentPath: string | null,
	direction: TaskListFocusMoveDirection
) => HTMLElement | null;

const CARD_SELECTOR = ".task-card[data-task-path]";
const INTERACTIVE_SELECTOR =
	'input, textarea, select, button, a, [contenteditable="true"], [role="textbox"], .cm-content';

function getCardIdentity(card: HTMLElement, cards: readonly HTMLElement[]): TaskListFocusIdentity | null {
	const path = card.dataset.taskPath;
	if (!path) return null;

	let occurrence = 0;
	for (const candidate of cards) {
		if (candidate === card) break;
		if (candidate.dataset.taskPath === path) occurrence++;
	}
	return { path, occurrence };
}

function identitiesEqual(
	left: TaskListFocusIdentity | null,
	right: TaskListFocusIdentity | null
): boolean {
	return left?.path === right?.path && left?.occurrence === right?.occurrence;
}

/**
 * Owns the Task List's logical focus independently of transient card DOM nodes.
 *
 * Bases can replace cards after edits or tab activation, so this controller keeps
 * a path-based identity, restores roving tabindex, and coordinates mouse and
 * keyboard focus styling across renders.
 */
export class TaskListFocusController {
	private focusedIdentity: TaskListFocusIdentity | null = null;
	private restoreDomFocus = false;
	private initialFocusPending: boolean;
	private lastCursorSource: "keyboard" | "mouse" = "keyboard";
	private lastMouseCard: HTMLElement | null = null;

	constructor(
		private readonly root: HTMLElement,
		autoFocusInitial = false,
		private readonly canClaimHover: () => boolean = () => true,
		private readonly resolveOffscreenCard?: TaskListFocusOffscreenResolver
	) {
		this.initialFocusPending = autoFocusInitial;
		this.syncCursorSourceClass();
	}

	handleFocusIn(event: FocusEvent): void {
		const card = this.getCardFromTarget(event.target);
		if (!card) return;

		this.focusedIdentity = getCardIdentity(card, this.getCards());
		this.syncRovingTabIndex();
	}

	handlePointerDown(event: PointerEvent): void {
		const target = event.target;
		if (!(target instanceof Element) || target.closest(INTERACTIVE_SELECTOR)) return;

		const card = this.getCardFromTarget(target);
		if (card) this.focusCard(card, false);
	}

	handleMouseMove(event: MouseEvent): boolean {
		const card = this.getCardFromTarget(event.target);
		if (!card) return false;
		if (!this.canClaimHover()) return false;

		this.setCursorSource("mouse");
		if (card === this.lastMouseCard) return true;

		// Mouse hover advances the same logical cursor used by keyboard actions,
		// but avoids stealing DOM focus from controls embedded in a card.
		this.lastMouseCard = card;
		const activeElement = this.root.ownerDocument.activeElement;
		if (
			activeElement instanceof Element &&
			card.contains(activeElement) &&
			activeElement.closest(INTERACTIVE_SELECTOR)
		) {
			this.focusedIdentity = getCardIdentity(card, this.getCards());
			this.syncRovingTabIndex();
			return true;
		}

		this.focusCard(card, false);
		return true;
	}

	moveFocus(event: KeyboardEvent, direction: TaskListFocusMoveDirection): boolean {
		const target = event.target;
		if (!(target instanceof Element) || target.closest(INTERACTIVE_SELECTOR)) return false;

		const cards = this.getCards();
		if (cards.length === 0) return false;

		const activeCard = this.getCardFromTarget(target);
		let currentIndex =
			this.lastCursorSource === "mouse"
				? this.findFocusedIndex(cards)
				: activeCard
					? cards.indexOf(activeCard)
					: this.findFocusedIndex(cards);
		if (currentIndex < 0) currentIndex = 0;
		let nextIndex: number;
		switch (direction) {
			case "next":
				nextIndex = Math.min(currentIndex + 1, cards.length - 1);
				break;
			case "previous":
				nextIndex = Math.max(currentIndex - 1, 0);
				break;
			case "first":
				nextIndex = 0;
				break;
			case "last":
				nextIndex = cards.length - 1;
				break;
		}

		event.preventDefault();
		event.stopPropagation();
		this.setCursorSource("keyboard");
		this.lastMouseCard = null;

		if (nextIndex === currentIndex && this.resolveOffscreenCard) {
			const currentPath = cards[currentIndex]?.dataset.taskPath ?? this.focusedIdentity?.path ?? null;
			const resolved = this.resolveOffscreenCard(currentPath, direction);
			if (resolved) {
				this.focusCard(resolved, true);
				return true;
			}
		}

		this.focusCard(cards[nextIndex], true);
		return true;
	}

	prepareForRender(): void {
		const activeElement = this.root.ownerDocument.activeElement;
		this.restoreDomFocus = activeElement instanceof Element && this.root.contains(activeElement);
	}

	restoreAfterRender(): void {
		const cards = this.getCards();
		if (cards.length === 0) return;

		const focusedIndex = this.findFocusedIndex(cards);
		const card = cards[focusedIndex >= 0 ? focusedIndex : 0];
		if (focusedIndex < 0) {
			this.focusedIdentity = getCardIdentity(card, cards);
		}

		this.syncRovingTabIndex(cards);
		if (this.initialFocusPending) {
			this.initialFocusPending = false;
			card.focus({ preventScroll: true });
		} else if (this.restoreDomFocus) {
			card.focus({ preventScroll: true });
			card.scrollIntoView({ block: "nearest" });
		}
		this.restoreDomFocus = false;
	}

	/**
	 * Re-applies roving-tabindex and keyboard-focus styling to whatever cards
	 * currently exist in the DOM, without moving DOM focus or scrolling. Safe to
	 * call reactively (e.g. after virtualization mounts/unmounts cards) while the
	 * user is actively scrolling or typing elsewhere.
	 */
	syncFocusStyles(): void {
		this.syncRovingTabIndex();
	}

	clear(): void {
		this.focusedIdentity = null;
		this.restoreDomFocus = false;
		this.initialFocusPending = false;
		this.setCursorSource("keyboard");
		this.lastMouseCard = null;
		this.syncRovingTabIndex();
	}

	getFocusedIdentity(): TaskListFocusIdentity | null {
		return this.focusedIdentity ? { ...this.focusedIdentity } : null;
	}

	getFocusedElement(): HTMLElement | null {
		const cards = this.getCards();
		const index = this.findFocusedIndex(cards);
		return index >= 0 ? cards[index] : null;
	}

	restoreFocusedElement(): boolean {
		const card = this.getFocusedElement();
		if (!card) return false;

		card.focus({ preventScroll: true });
		card.scrollIntoView({ block: "nearest" });
		return true;
	}

	getFocusedPathForEvent(
		event: KeyboardEvent,
		allowModifiers = false,
		allowRememberedFallback = false
	): string | null {
		if (
			!allowModifiers &&
			(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
		) {
			return null;
		}

		const target = event.target;
		if (!(target instanceof Element) || target.closest(INTERACTIVE_SELECTOR)) return null;

		const card = this.getCardFromTarget(target);
		if (card?.dataset.taskPath) return card.dataset.taskPath;
		if (
			allowRememberedFallback &&
			(this.root.contains(target) || target.contains(this.root))
		) {
			return this.focusedIdentity?.path ?? null;
		}
		return null;
	}

	private getCards(): HTMLElement[] {
		return Array.from(this.root.querySelectorAll<HTMLElement>(CARD_SELECTOR));
	}

	private getCardFromTarget(target: EventTarget | null): HTMLElement | null {
		if (!(target instanceof Element)) return null;
		const card = target.closest<HTMLElement>(CARD_SELECTOR);
		return card && this.root.contains(card) ? card : null;
	}

	private findFocusedIndex(cards: readonly HTMLElement[]): number {
		if (!this.focusedIdentity) return -1;
		return cards.findIndex((card) =>
			identitiesEqual(getCardIdentity(card, cards), this.focusedIdentity)
		);
	}

	private focusCard(card: HTMLElement, scroll: boolean): void {
		const cards = this.getCards();
		this.focusedIdentity = getCardIdentity(card, cards);
		this.syncRovingTabIndex(cards);
		card.focus({ preventScroll: true });
		if (scroll) card.scrollIntoView({ block: "nearest" });
	}

	private setCursorSource(source: "keyboard" | "mouse"): void {
		this.lastCursorSource = source;
		this.syncCursorSourceClass();
	}

	private syncCursorSourceClass(): void {
		this.root.classList.toggle(
			"tn-task-list--keyboard-cursor",
			this.lastCursorSource === "keyboard"
		);
		this.root.classList.toggle(
			"tn-task-list--mouse-cursor",
			this.lastCursorSource === "mouse"
		);
	}

	private syncRovingTabIndex(cards: readonly HTMLElement[] = this.getCards()): void {
		const focusedIndex = this.findFocusedIndex(cards);
		const tabbableIndex = focusedIndex >= 0 ? focusedIndex : 0;

		cards.forEach((card, index) => {
			const focused = index === focusedIndex;

			card.tabIndex = index === tabbableIndex ? 0 : -1;
			card.classList.toggle("task-card--keyboard-focused", focused);
		});
	}
}
