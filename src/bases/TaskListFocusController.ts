export type TaskListFocusIdentity = {
	path: string;
	occurrence: number;
};

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

export class TaskListFocusController {
	private focusedIdentity: TaskListFocusIdentity | null = null;
	private restoreDomFocus = false;
	private initialFocusPending: boolean;
	private lastCursorSource: "keyboard" | "mouse" = "keyboard";
	private lastMouseCard: HTMLElement | null = null;

	constructor(
		private readonly root: HTMLElement,
		autoFocusInitial = false
	) {
		this.initialFocusPending = autoFocusInitial;
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

		this.lastCursorSource = "mouse";
		if (card === this.lastMouseCard) return true;

		this.lastMouseCard = card;
		this.focusedIdentity = getCardIdentity(card, this.getCards());
		this.syncRovingTabIndex();
		return true;
	}

	moveFocus(
		event: KeyboardEvent,
		direction: "next" | "previous" | "first" | "last"
	): boolean {
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
		this.lastCursorSource = "keyboard";
		this.lastMouseCard = null;
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

	clear(): void {
		this.focusedIdentity = null;
		this.restoreDomFocus = false;
		this.initialFocusPending = false;
		this.lastCursorSource = "keyboard";
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
