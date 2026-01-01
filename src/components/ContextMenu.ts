import { Menu } from "obsidian";

export class ContextMenu extends Menu {

	public show(event: UIEvent) {
		// Use cross-window compatible instanceOf checks for pop-out window support
		if (event.instanceOf(MouseEvent)) {
			this.showAtMouseEvent(event);
		} else if (event.instanceOf(KeyboardEvent)) {
			const element = event.currentTarget;
			if (!element || !(element as Node).instanceOf?.(HTMLElement)) {
				return;
			}
			this.showAtPosition({
				x: (element as HTMLElement).getBoundingClientRect().left,
				y: (element as HTMLElement).getBoundingClientRect().bottom + 4,
			});
		}
	}
}
