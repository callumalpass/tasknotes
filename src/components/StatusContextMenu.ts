import { configLabel } from "../i18n/configLabels";
import { renderUnconfiguredMenuValue } from "../ui/kit/menu";
import TaskNotesPlugin from "../main";
import { ContextMenu } from "./ContextMenu";
import { showCoordinatedMenu, showCoordinatedMenuAtElement } from "./ContextMenuCoordinator";

export interface StatusOption {
	label: string;
	value: string;
	icon?: string;
	color?: string;
}

export interface StatusContextMenuOptions {
	currentValue: string;
	onSelect: (value: string) => void;
	plugin: TaskNotesPlugin;
}

export class StatusContextMenu {
	private menu: ContextMenu;
	private options: StatusContextMenuOptions;
	private targetDoc: Document = activeDocument;

	constructor(options: StatusContextMenuOptions) {
		this.menu = new ContextMenu();
		this.options = options;
		this.buildMenu();
	}

	private buildMenu(): void {
		const statusOptions = this.getStatusOptions();
		renderUnconfiguredMenuValue(this.menu, this.options.currentValue, statusOptions);

		statusOptions.forEach((option) => {
			this.menu.addItem((item) => {
				// Use custom icon if configured, otherwise default to circle
				item.setIcon(option.icon || "circle");

				item.setTitle(option.label).setChecked(option.value === this.options.currentValue);

				item.onClick(async () => {
					this.options.onSelect(option.value);
				});
			});
		});
	}

	private getStatusOptions(): StatusOption[] {
		const statusConfigs = this.options.plugin.settings.customStatuses;
		const statusOptions: StatusOption[] = [];

		// Use only the user-defined statuses from settings
		if (statusConfigs && statusConfigs.length > 0) {
			// Sort by order property
			const sortedStatuses = [...statusConfigs].sort((a, b) => a.order - b.order);

			sortedStatuses.forEach((status) => {
				statusOptions.push({
					label: configLabel(status),
					value: status.value,
					color: status.color,
					icon: status.icon,
				});
			});
		}

		return statusOptions;
	}

	private capitalizeFirst(str: string): string {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	public show(event: UIEvent): void {
		// Store the document reference from the event target to support pop-out windows
		// Use cross-window compatible instanceOf check
		if ((event.target as Node)?.instanceOf?.(HTMLElement)) {
			this.targetDoc = (event.target as HTMLElement).ownerDocument;
		}
		showCoordinatedMenu(this.menu, event);

		// Apply color styling after menu is shown
		window.setTimeout(() => {
			this.applyColorStyling();
		}, 10);
	}

	public showAtElement(element: HTMLElement): void {
		// Store the document reference from the element to support pop-out windows
		this.targetDoc = element.ownerDocument;
		showCoordinatedMenuAtElement(this.menu, element);

		// Apply color styling after menu is shown
		window.setTimeout(() => {
			this.applyColorStyling();
		}, 10);
	}

	private applyColorStyling(): void {
		const statusOptions = this.getStatusOptions();
		const menuEl = this.targetDoc.querySelector(".menu");

		if (!menuEl) return;

		const menuItems = menuEl.querySelectorAll(".menu-item");
		const offset =
			this.options.currentValue &&
			!statusOptions.some((option) => option.value === this.options.currentValue)
				? 1
				: 0;

		statusOptions.forEach((option, index) => {
			const menuItem = menuItems[index + offset] as HTMLElement;
			if (menuItem && option.color) {
				const iconEl = menuItem.querySelector(".menu-item-icon");
				if (iconEl) {
					(iconEl as HTMLElement).style.color = option.color;
				}
			}
		});
	}
}
