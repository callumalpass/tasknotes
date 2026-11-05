import { createSegmentedControl } from '../../../src/ui/kit/controls';
import { openListPicker } from '../../../src/ui/kit/listPicker';
import { closeActivePopover, openPopover } from '../../../src/ui/kit/popover';

beforeEach(() => {
	Object.defineProperty(globalThis, 'activeDocument', { configurable: true, value: document });
	Object.defineProperty(globalThis, 'activeWindow', { configurable: true, value: window });
	document.body.empty();
	HTMLElement.prototype.scrollIntoView = jest.fn();
});

afterEach(() => closeActivePopover());

it('exposes one roving tab stop and uses arrow, Home and End keys', () => {
	const onChange = jest.fn();
	const host = document.body.createDiv();
	createSegmentedControl(host, [
		{ value: 'week', label: 'Week' },
		{ value: 'month', label: 'Month' },
		{ value: 'year', label: 'Year' },
	], 'month', onChange);
	const tabs = host.querySelectorAll<HTMLButtonElement>('[role=tab]');
	expect(Array.from(tabs, tab => tab.tabIndex)).toEqual([-1, 0, -1]);
	tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
	expect(onChange).toHaveBeenLastCalledWith('year');
	expect(document.activeElement).toBe(tabs[2]);
	tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
	expect(onChange).toHaveBeenLastCalledWith('week');
	tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
	expect(onChange).toHaveBeenLastCalledWith('year');
});

it('tracks one active descendant without scrolling for pointer movement, including free-text creation', () => {
	const anchor = document.body.createEl('button');
	const popover = openListPicker({
		anchor, placeholder: 'Choose', emptyText: 'Empty', multiple: true,
		items: [{ id: 'first', label: 'First' }, { id: 'second', label: 'Second', selected: true }],
		onChoose: jest.fn(), createLabel: query => `Create ${query}`, onCreate: jest.fn(),
	});
	const input = popover.el.querySelector<HTMLInputElement>('input')!;
	const rows = popover.el.querySelectorAll<HTMLElement>('[role=option]');
	expect(input.getAttribute('role')).toBe('combobox');
	const scroll = HTMLElement.prototype.scrollIntoView as jest.Mock;
	scroll.mockClear();
	rows[1].dispatchEvent(new MouseEvent('pointermove', { clientX: 40, clientY: 60, bubbles: true }));
	expect(scroll).not.toHaveBeenCalled();
	expect(input.getAttribute('aria-activedescendant')).toBe(rows[1].id);
	input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
	expect(input.getAttribute('aria-activedescendant')).toBe(rows[0].id);
	expect(scroll).toHaveBeenCalledTimes(1);
	rows[1].dispatchEvent(new MouseEvent('pointermove', { clientX: 40, clientY: 60, bubbles: true }));
	expect(input.getAttribute('aria-activedescendant')).toBe(rows[0].id);
	input.value = 'New value';
	input.dispatchEvent(new Event('input', { bubbles: true }));
	const create = popover.el.querySelector<HTMLElement>('[role=option]')!;
	create.dispatchEvent(new MouseEvent('pointermove', { clientX: 40, clientY: 80, bubbles: true }));
	expect(input.getAttribute('aria-activedescendant')).toBe(create.id);
});

it('skips disabled segments and follows RTL arrow direction', () => {
	const onChange = jest.fn();
	const host = document.body.createDiv();
	const control = createSegmentedControl(host, [
		{ value: 'week', label: 'Week' },
		{ value: 'month', label: 'Month' },
		{ value: 'year', label: 'Year' },
	], 'week', onChange);
	const tabs = control.el.querySelectorAll<HTMLButtonElement>('[role=tab]');
	tabs[1].disabled = true;
	tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
	expect(onChange).toHaveBeenLastCalledWith('year');
	control.el.style.direction = 'rtl';
	tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
	expect(onChange).toHaveBeenLastCalledWith('week');
	tabs[1].disabled = false;
	tabs[1].setAttribute('aria-disabled', 'true');
	tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
	expect(onChange).toHaveBeenLastCalledWith('year');
	expect(document.activeElement).toBe(tabs[2]);
});

it('restores pointer focus without carrying the picker input ring into the anchor', () => {
	const host = document.body.createDiv({ cls: 'tasknotes-plugin' });
	const anchor = host.createEl('button');
	const popover = openPopover({ anchor });
	popover.el.createEl('input').focus();
	popover.el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
	popover.close();
	expect(document.activeElement).toBe(anchor);
	expect(anchor.classList.contains('tn-focus-from-pointer')).toBe(true);
	anchor.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
	expect(anchor.classList.contains('tn-focus-from-pointer')).toBe(false);
	const next = openPopover({ anchor });
	next.el.createEl('input').focus();
	next.el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
	next.close();
	anchor.blur();
	expect(anchor.classList.contains('tn-focus-from-pointer')).toBe(false);
});
