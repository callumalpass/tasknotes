import TaskNotesPlugin from "../main";
import { ContextMenu } from "./ContextMenu";

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
	private targetDoc: Document = document;

	constructor(options: StatusContextMenuOptions) {
		this.menu = new ContextMenu();
		this.options = options;
		this.buildMenu();
	}

	private buildMenu(): void {
		const statusOptions = this.getStatusOptions();

		statusOptions.forEach((option, index) => {
			this.menu.addItem((item) => {
				let title = option.label;

				// Use custom icon if configured, otherwise default to circle
				item.setIcon(option.icon || "circle");

				// Highlight current selection with visual indicator
				if (option.value === this.options.currentValue) {
					title = `✓ ${option.label}`;
				}

				item.setTitle(title);

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
					label: status.label,
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
		this.menu.show(event);

		// Apply color styling after menu is shown
		setTimeout(() => {
			this.applyColorStyling();
		}, 10);
	}

	public showAtElement(element: HTMLElement): void {
		// Store the document reference from the element to support pop-out windows
		this.targetDoc = element.ownerDocument;
		this.menu.showAtPosition({
			x: element.getBoundingClientRect().left,
			y: element.getBoundingClientRect().bottom + 4,
		});

		// Apply color styling after menu is shown
		setTimeout(() => {
			this.applyColorStyling();
		}, 10);
	}

	private applyColorStyling(): void {
		const statusOptions = this.getStatusOptions();
		const menuEl = this.targetDoc.querySelector(".menu");

		if (!menuEl) return;

		const menuItems = menuEl.querySelectorAll(".menu-item");

		statusOptions.forEach((option, index) => {
			const menuItem = menuItems[index] as HTMLElement;
			if (menuItem && option.color) {
				const iconEl = menuItem.querySelector(".menu-item-icon");
				if (iconEl) {
					(iconEl as HTMLElement).style.color = option.color;
				}
			}
		});
	}
}
