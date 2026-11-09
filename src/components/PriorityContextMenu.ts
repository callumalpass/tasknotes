import { configLabel } from "../i18n/configLabels";
import { renderPriorityMenuGlyph, renderUnconfiguredMenuValue } from "../ui/kit/menu";
import TaskNotesPlugin from "../main";
import { PriorityConfig } from "../types";
import { ContextMenu } from "./ContextMenu";
import { showCoordinatedMenu, showCoordinatedMenuAtElement } from "./ContextMenuCoordinator";

export interface PriorityContextMenuOptions {
	currentValue?: string;
	onSelect: (value: string) => void;
	plugin: TaskNotesPlugin;
}

export class PriorityContextMenu {
	private menu: ContextMenu;
	private options: PriorityContextMenuOptions;
	private sortedPriorities: PriorityConfig[] = [];

	constructor(options: PriorityContextMenuOptions) {
		this.menu = new ContextMenu();
		this.options = options;
		this.buildMenu();
	}

	private buildMenu(): void {
		// Match the order shown in Priority settings.
		this.sortedPriorities = this.options.plugin.priorityManager.getPrioritiesByWeightAsc();
		renderUnconfiguredMenuValue(this.menu, this.options.currentValue, this.sortedPriorities);

		this.sortedPriorities.forEach((priority) => {
			this.menu.addItem((item) => {
				renderPriorityMenuGlyph(item, priority, this.sortedPriorities);

				item.setTitle(configLabel(priority)).setChecked(
					priority.value === this.options.currentValue
				);

				item.onClick(async () => {
					this.options.onSelect(priority.value);
				});
			});
		});
	}

	public show(event: UIEvent): void {
		showCoordinatedMenu(this.menu, event);
	}

	public showAtElement(element: HTMLElement): void {
		showCoordinatedMenuAtElement(this.menu, element);
	}
}
