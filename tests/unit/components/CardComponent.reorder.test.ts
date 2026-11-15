import { createCard, setupCardDragAndDrop } from '../../../src/settings/components/CardComponent';

beforeEach(() => {
	document.body.empty();
	Object.defineProperty(globalThis, 'activeWindow', { configurable: true, value: window });
	HTMLElement.prototype.scrollIntoView = jest.fn();
});

function fixture() {
	const container = document.body.createDiv();
	const reorder = jest.fn();
	const cards = ['first', 'second', 'third'].map(id => {
		const card = createCard(container, { id, draggable: true, header: { primaryText: id } });
		setupCardDragAndDrop(card, container, reorder);
		return card;
	});
	return { container, reorder, cards };
}

function dragEvent(type: string, dataTransfer: object) {
	const event = new Event(type, { bubbles: true, cancelable: true });
	Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
	Object.defineProperty(event, 'clientY', { value: 1 });
	return event;
}

it('offers keyboard movement without wrapping at the list edges', () => {
	const { cards, reorder } = fixture();
	const handle = cards[0].querySelector<HTMLElement>('[role=button]')!;
	expect(handle.tabIndex).toBe(0);
	handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }));
	expect(reorder).not.toHaveBeenCalled();
	handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
	expect(reorder).toHaveBeenCalledWith('first', 'second', false);
});

it('clears every target on dragend and rejects foreign text drops', () => {
	const { cards, container, reorder } = fixture();
	const handle = cards[0].querySelector<HTMLElement>('[role=button]')!;
	const transfer = { setData: jest.fn(), getData: () => 'first', setDragImage: jest.fn() };
	handle.dispatchEvent(dragEvent('dragstart', transfer));
	cards[1].dispatchEvent(dragEvent('dragover', transfer));
	expect(container.querySelectorAll('[class*="--drag-over"]')).toHaveLength(1);
	handle.dispatchEvent(new Event('dragend'));
	expect(container.querySelectorAll('[class*="--drag-over"], .tasknotes-settings__card--dragging')).toHaveLength(0);
	cards[1].dispatchEvent(dragEvent('drop', transfer));
	expect(reorder).not.toHaveBeenCalled();
});

it('Escape removes source and insertion states without changing the order', () => {
	const { cards, container, reorder } = fixture();
	const handle = cards[0].querySelector<HTMLElement>('[role=button]')!;
	const transfer = { setData: jest.fn(), getData: () => 'first', setDragImage: jest.fn() };
	handle.dispatchEvent(dragEvent('dragstart', transfer));
	cards[1].dispatchEvent(dragEvent('dragover', transfer));
	document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
	expect(container.querySelectorAll('[class*="--drag-over"], .tasknotes-settings__card--dragging')).toHaveLength(0);
	expect(reorder).not.toHaveBeenCalled();
	expect(document.activeElement).toBe(handle);
});
