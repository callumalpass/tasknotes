import { App, Modal, Setting, TFile, setIcon } from "obsidian";
import TaskNotesPlugin from "../main";

/**
 * Represents an item to display in the notification modal.
 * Can be a task or any note from a Bases query result.
 */
export interface NotificationItem {
	path: string;
	title: string;
	isTask?: boolean;
	status?: string;
	/** Additional context (e.g., "Due in 2 days") */
	context?: string;
}

export interface BasesNotificationModalOptions {
	/** The .base file that triggered this notification */
	baseFilePath: string;
	/** Display name for the notification */
	baseName: string;
	/** Items to show in the notification */
	items: NotificationItem[];
	/** Maximum items to show before "X more" */
	maxDisplayItems?: number;
	/** Callback when user snoozes */
	onSnooze?: (duration: number) => void;
}

/**
 * Rich notification modal for Bases query results.
 * Shows items with action buttons (Open, Complete) and footer actions.
 */
export class BasesNotificationModal extends Modal {
	private plugin: TaskNotesPlugin;
	private options: BasesNotificationModalOptions;

	constructor(app: App, plugin: TaskNotesPlugin, options: BasesNotificationModalOptions) {
		super(app);
		this.plugin = plugin;
		this.options = {
			maxDisplayItems: 5,
			...options,
		};
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("tn-notification-modal");

		this.renderHeader();
		this.renderItems();
		this.renderFooter();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	private renderHeader(): void {
		const { contentEl } = this;
		const header = contentEl.createDiv({ cls: "tn-notification-modal__header" });

		// Icon
		const iconEl = header.createSpan({ cls: "tn-notification-modal__icon" });
		setIcon(iconEl, "list-checks");

		// Title
		const titleEl = header.createEl("h2", {
			cls: "tn-notification-modal__title",
			text: this.options.baseName,
		});

		// Subtitle with item count
		const count = this.options.items.length;
		const subtitle = count === 1 ? "1 item needs attention" : `${count} items need attention`;
		header.createEl("p", {
			cls: "tn-notification-modal__subtitle",
			text: subtitle,
		});
	}

	private renderItems(): void {
		const { contentEl } = this;
		const itemsContainer = contentEl.createDiv({ cls: "tn-notification-modal__items" });

		const maxDisplay = this.options.maxDisplayItems || 5;
		const itemsToShow = this.options.items.slice(0, maxDisplay);
		const remainingCount = this.options.items.length - maxDisplay;

		// Render each item
		for (const item of itemsToShow) {
			this.renderItem(itemsContainer, item);
		}

		// Show "X more items" as a clickable link to open the base view
		if (remainingCount > 0) {
			const moreEl = itemsContainer.createDiv({ cls: "tn-notification-modal__more" });
			const moreLink = moreEl.createEl("a", {
				cls: "tn-notification-modal__more-link",
				text: `+ ${remainingCount} more — open base view to see all`,
			});
			moreLink.addEventListener("click", async (e) => {
				e.preventDefault();
				await this.openBaseView();
				this.close();
			});
		}
	}

	private renderItem(container: HTMLElement, item: NotificationItem): void {
		const itemEl = container.createDiv({ cls: "tn-notification-modal__item" });

		// Item content (title + context)
		const contentEl = itemEl.createDiv({ cls: "tn-notification-modal__item-content" });

		// Title with bullet
		const titleEl = contentEl.createDiv({ cls: "tn-notification-modal__item-title" });
		titleEl.createSpan({ text: "• " });
		titleEl.createSpan({ text: item.title });

		// Context (e.g., "Due tomorrow")
		if (item.context) {
			contentEl.createDiv({
				cls: "tn-notification-modal__item-context",
				text: item.context,
			});
		}

		// Action buttons
		const actionsEl = itemEl.createDiv({ cls: "tn-notification-modal__item-actions" });

		// Open button
		const openBtn = actionsEl.createEl("button", {
			cls: "tn-notification-modal__btn tn-notification-modal__btn--secondary",
		});
		openBtn.textContent = "Open";
		openBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			await this.openItem(item);
		});

		// Complete button (only for tasks)
		if (item.isTask) {
			const completeBtn = actionsEl.createEl("button", {
				cls: "tn-notification-modal__btn tn-notification-modal__btn--secondary",
			});
			setIcon(completeBtn, "check");
			completeBtn.setAttribute("aria-label", "Complete task");
			completeBtn.addEventListener("click", async (e) => {
				e.stopPropagation();
				await this.completeTask(item, itemEl);
			});
		}
	}

	private renderFooter(): void {
		const { contentEl } = this;
		const footer = contentEl.createDiv({ cls: "tn-notification-modal__footer" });

		// Open Base View button
		const openBaseBtn = footer.createEl("button", {
			cls: "tn-notification-modal__btn tn-notification-modal__btn--primary",
		});
		openBaseBtn.textContent = "Open Base view";
		openBaseBtn.addEventListener("click", async () => {
			await this.openBaseView();
			this.close();
		});

		// Snooze dropdown
		const snoozeBtn = footer.createEl("button", {
			cls: "tn-notification-modal__btn tn-notification-modal__btn--secondary",
		});
		snoozeBtn.textContent = "Snooze";
		snoozeBtn.title = "Pause notifications for this base — resets when plugin reloads";
		snoozeBtn.addEventListener("click", () => {
			this.showSnoozeMenu(snoozeBtn);
		});

		// Dismiss button
		const dismissBtn = footer.createEl("button", {
			cls: "tn-notification-modal__btn tn-notification-modal__btn--secondary",
		});
		dismissBtn.textContent = "Dismiss";
		dismissBtn.title = "Close this notification — it may reappear on the next trigger event";
		dismissBtn.addEventListener("click", () => {
			this.close();
		});
	}

	private async openItem(item: NotificationItem): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(item.path);
		if (file instanceof TFile) {
			await this.app.workspace.openLinkText(item.path, "", false);
			this.close();
		}
	}

	private async completeTask(item: NotificationItem, itemEl: HTMLElement): Promise<void> {
		if (!item.isTask) return;

		try {
			// Get a completed status from StatusManager
			const completedStatuses = this.plugin.statusManager.getCompletedStatuses();
			if (!completedStatuses || completedStatuses.length === 0) {
				this.plugin.debugLog.warn('BasesNotificationModal', 'No completed status found');
				return;
			}

			// Use the first completed status
			const completedStatusValue = completedStatuses[0];

			// Update the task status
			const task = await this.plugin.cacheManager.getTaskInfo(item.path);
			if (task) {
				await this.plugin.taskService.updateTask(task, { status: completedStatusValue });

				// Visual feedback - strike through and fade
				itemEl.classList.add("tn-notification-modal__item--completed");

				// Remove from items after animation
				setTimeout(() => {
					itemEl.remove();
					// Update remaining count if needed
					this.updateRemainingCount();
				}, 300);
			}
		} catch (error) {
			console.error("[BasesNotificationModal] Error completing task:", error);
		}
	}

	private updateRemainingCount(): void {
		// Re-count visible items and update "X more" text
		const itemsContainer = this.contentEl.querySelector(".tn-notification-modal__items");
		if (!itemsContainer) return;

		const visibleItems = itemsContainer.querySelectorAll(
			".tn-notification-modal__item:not(.tn-notification-modal__item--completed)"
		);

		if (visibleItems.length === 0) {
			// All items completed - close the modal
			this.close();
		}
	}

	private async openBaseView(): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.options.baseFilePath);
		if (file instanceof TFile) {
			await this.app.workspace.openLinkText(this.options.baseFilePath, "", false);
		}
	}

	private showSnoozeMenu(button: HTMLElement): void {
		const menu = new (require("obsidian").Menu)();

		const snoozeOptions = [
			{ label: "15 minutes", duration: 15 },
			{ label: "1 hour", duration: 60 },
			{ label: "4 hours", duration: 240 },
			{ label: "Until tomorrow", duration: 1440 },
		];

		for (const option of snoozeOptions) {
			menu.addItem((item: any) => {
				item.setTitle(option.label).onClick(() => {
					if (this.options.onSnooze) {
						this.options.onSnooze(option.duration);
					}
					this.close();
				});
			});
		}

		menu.showAtMouseEvent(
			new MouseEvent("click", {
				clientX: button.getBoundingClientRect().left,
				clientY: button.getBoundingClientRect().bottom,
			})
		);
	}
}
