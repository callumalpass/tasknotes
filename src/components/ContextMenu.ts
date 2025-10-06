import { Menu } from "obsidian";

export class ContextMenu extends Menu {

	public show(event: UIEvent) {
		if (event instanceof MouseEvent) {
			this.showAtMouseEvent(event);
		} else if (event instanceof KeyboardEvent) {
			const element = event.currentTarget;
			if (!(element instanceof HTMLElement)) {
				return;
			}
			this.showAtPosition({
				x: element.getBoundingClientRect().left,
				y: element.getBoundingClientRect().bottom + 4,
			});
		}
	}
}
