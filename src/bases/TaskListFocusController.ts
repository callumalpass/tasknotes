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

	constructor(private readonly root: HTMLElement) {}

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

	handleKeyDown(event: KeyboardEvent): boolean {
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
			return false;
		}

		const target = event.target;
		if (!(target instanceof Element) || target.closest(INTERACTIVE_SELECTOR)) return false;

		const cards = this.getCards();
		if (cards.length === 0) return false;

		const activeCard = this.getCardFromTarget(target);
		let currentIndex = activeCard ? cards.indexOf(activeCard) : this.findFocusedIndex(cards);
		if (currentIndex < 0) currentIndex = 0;

		let nextIndex: number;
		switch (event.key) {
			case "ArrowDown":
				nextIndex = Math.min(currentIndex + 1, cards.length - 1);
				break;
			case "ArrowUp":
				nextIndex = Math.max(currentIndex - 1, 0);
				break;
			case "Home":
				nextIndex = 0;
				break;
			case "End":
				nextIndex = cards.length - 1;
				break;
			default:
				return false;
		}

		event.preventDefault();
		event.stopPropagation();
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
		if (this.restoreDomFocus) {
			card.focus({ preventScroll: true });
			card.scrollIntoView({ block: "nearest" });
		}
		this.restoreDomFocus = false;
	}

	clear(): void {
		this.focusedIdentity = null;
		this.restoreDomFocus = false;
	}

	getFocusedIdentity(): TaskListFocusIdentity | null {
		return this.focusedIdentity ? { ...this.focusedIdentity } : null;
	}

	getFocusedElement(): HTMLElement | null {
		const cards = this.getCards();
		const index = this.findFocusedIndex(cards);
		return index >= 0 ? cards[index] : null;
	}

	getFocusedPathForEvent(event: KeyboardEvent, allowModifiers = false): string | null {
		if (
			event.defaultPrevented ||
			(!allowModifiers &&
				(event.altKey || event.ctrlKey || event.metaKey || event.shiftKey))
		) {
			return null;
		}

		const target = event.target;
		if (!(target instanceof Element) || target.closest(INTERACTIVE_SELECTOR)) return null;

		const card = this.getCardFromTarget(target);
		return card?.dataset.taskPath ?? null;
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
