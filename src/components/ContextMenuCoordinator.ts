interface CoordinatedMenu {
	hide(): void;
	onHide(callback: () => void): void;
	showAtMouseEvent(event: MouseEvent): void;
	showAtPosition(position: { x: number; y: number }, document?: Document): void;
}

/**
 * Coordinates context-menu visibility across the plugin.
 *
 * Every menu wrapper routes its `show` entry points through this module so
 * that only one context menu is visible at a time and activating the same
 * trigger again toggles its menu closed instead of stacking another one.
 *
 * The coordinator only relies on the Obsidian `Menu` surface (`onHide`,
 * `hide`, `showAtMouseEvent`, `showAtPosition`), so it works uniformly for
 * `ContextMenu` instances and plain `Menu` instances.
 */

function asElement(target: EventTarget | null): Element | null {
	if (!target || typeof target !== "object") {
		return null;
	}

	const element = target as Element;
	if (element.nodeType !== 1 || typeof element.closest !== "function") {
		return null;
	}

	return element;
}

/**
 * Cross-window compatible `MouseEvent` check. Obsidian's
 * `Event.prototype.instanceOf` extension is preferred when available; the
 * standard operator is the fallback for environments without it (e.g. unit
 * tests), hence the deliberate duck-typed cast below.
 */
function isMouseEvent(event: UIEvent): event is MouseEvent {
	const instanceOf = (event as { instanceOf?: (ctor: unknown) => boolean }).instanceOf;
	if (typeof instanceOf === "function") {
		return instanceOf.call(event, MouseEvent) === true;
	}

	return (event as unknown) instanceof MouseEvent;
}

/**
 * Interactive-control selector used to resolve a stable menu trigger. Plugin
 * interactive controls are marked via `prepareInteractiveControl`
 * (`role="button"`), `data-tn-action`, or `data-type`.
 */
const TRIGGER_SELECTOR = '[data-tn-action], [data-type], [role="button"], button, .clickable-icon';

let activeMenu: CoordinatedMenu | null = null;
let activeTrigger: Element | null = null;

/**
 * Hide the currently active coordinated menu, if any.
 */
export function closeActiveContextMenu(): void {
	const menu = activeMenu;
	activeMenu = null;
	activeTrigger = null;
	menu?.hide();
}

/**
 * Resolve the element that activated a menu from an event so repeated
 * activations of the same control can be detected.
 */
export function getContextMenuTrigger(event: UIEvent): Element | null {
	const target = asElement(event.target);
	return target?.closest(TRIGGER_SELECTOR) ?? target;
}

function showWithTrigger(menu: CoordinatedMenu, trigger: Element | null, show: () => void): void {
	if (trigger && activeMenu && activeTrigger === trigger) {
		// Same trigger activated again: toggle the menu closed.
		closeActiveContextMenu();
		return;
	}

	closeActiveContextMenu();
	activeMenu = menu;
	activeTrigger = trigger;
	menu.onHide(() => {
		if (activeMenu === menu) {
			activeMenu = null;
			activeTrigger = null;
		}
	});
	show();
}

/**
 * Show a menu from a UI event with single-menu coordination.
 *
 * Mouse events show the menu at the cursor; keyboard events anchor the menu
 * below the event's current target.
 */
export function showCoordinatedMenu(menu: CoordinatedMenu, event: UIEvent): void {
	showWithTrigger(menu, getContextMenuTrigger(event), () => {
		if (isMouseEvent(event)) {
			menu.showAtMouseEvent(event);
			return;
		}

		const element = asElement(event.currentTarget);
		if (element?.instanceOf?.(HTMLElement) || element instanceof HTMLElement) {
			menu.showAtPosition(
				{
					x: element.getBoundingClientRect().left,
					y: element.getBoundingClientRect().bottom + 4,
				},
				element.ownerDocument
			);
		}
	});
}

/**
 * Show a menu anchored below an element with single-menu coordination.
 * The element doubles as the trigger, so showing at the same element again
 * toggles the menu closed.
 */
export function showCoordinatedMenuAtElement(menu: CoordinatedMenu, element: HTMLElement): void {
	showWithTrigger(menu, element, () => {
		menu.showAtPosition(
			{
				x: element.getBoundingClientRect().left,
				y: element.getBoundingClientRect().bottom + 4,
			},
			element.ownerDocument
		);
	});
}
