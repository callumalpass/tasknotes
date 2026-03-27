import { Menu, Notice, setIcon } from "obsidian";
import TaskNotesPlugin from "../main";
import { AggregatedNotificationItem, DismissBehavior, TimeCategory } from "../types/settings";

/**
 * Default snooze duration options shown in the toast snooze dropdown.
 */
const SNOOZE_OPTIONS: { label: string; getMinutes: () => number }[] = [
	{ label: "15 minutes", getMinutes: () => 15 },
	{ label: "1 hour", getMinutes: () => 60 },
	{ label: "4 hours", getMinutes: () => 240 },
	{
		label: "Until tomorrow",
		getMinutes: () => {
			const now = new Date();
			const tomorrow = new Date(now);
			tomorrow.setDate(tomorrow.getDate() + 1);
			tomorrow.setHours(9, 0, 0, 0);
			return Math.round((tomorrow.getTime() - now.getTime()) / (1000 * 60));
		},
	},
];

/**
 * Enhanced seen entry with dismiss behavior tracking.
 * Version 2 format stores more context for per-category dismiss logic.
 */
interface SeenEntry {
	/** Timestamp when item was dismissed */
	dismissedAt: number;
	/** The dismiss behavior that was applied */
	behavior: DismissBehavior;
	/** Time category when dismissed (for reference) */
	category: TimeCategory | "queryBased";
	/** When item should return (for snooze behaviors), 0 = never auto-return */
	returnAt: number;
}

/**
 * State for the reminder queue (persisted in localStorage).
 * Version 2: Enhanced seen entries with dismiss behavior tracking.
 */
interface ReminderQueueState {
	version: number;
	/** Map of seen item keys to seen entry (v2) or timestamp (v1 legacy) */
	seen: Record<string, SeenEntry | number>;
}

/**
 * Toast notification configuration.
 */
export interface ToastConfig {
	/** Message to display */
	message: string;
	/** Optional subtitle/details (plain text) */
	subtitle?: string;
	/** Optional subtitle as HTML (takes precedence over subtitle) */
	subtitleHtml?: string;
	/** Auto-dismiss timeout in ms (0 = no auto-dismiss) */
	timeout?: number;
	/** Show action button */
	actionLabel?: string;
	/** Action callback */
	onAction?: () => void;
	/** Dismiss callback */
	onDismiss?: () => void;
	/** Show snooze dropdown button */
	showSnooze?: boolean;
	/** Snooze callback (duration in minutes) */
	onSnooze?: (minutes: number) => void;
}

/**
 * Extended toast config with items for expandable list.
 */
export interface ToastWithItemsConfig extends ToastConfig {
	/** Items to show in expandable list */
	items: AggregatedNotificationItem[];
}

/**
 * ToastNotification - Compact bottom-right notification indicator.
 *
 * Used to alert users about items needing attention without interrupting workflow.
 * Clicking the toast opens the Upcoming view.
 *
 * Two modes:
 * 1. Aggregated rollup - "8 items need attention" with breakdown
 * 2. Individual - Specific task reminder with inline actions
 */
export class ToastNotification {
	private plugin: TaskNotesPlugin;
	private currentToast: HTMLElement | null = null;
	private dismissTimeout: ReturnType<typeof setTimeout> | null = null;
	private statusBarItem: HTMLElement | null = null;
	private static readonly SNOOZE_KEY = "tasknotes-snooze-until";
	private static readonly QUEUE_KEY = "tasknotes-reminder-queue";

	/**
	 * Whether toast has been dismissed this session.
	 * When true, periodic checks update status bar but don't show toast popup.
	 * Resets on Obsidian restart.
	 */
	private toastDismissedThisSession: boolean = false;

	/**
	 * Current items being displayed (for marking as seen on dismiss).
	 */
	private currentItems: AggregatedNotificationItem[] = [];

	/**
	 * Whether notifications are currently snoozed.
	 * Reads from localStorage so it survives plugin reloads.
	 * Used by the periodic check in main.ts to skip status bar updates.
	 */
	isSnoozed(): boolean {
		const stored = localStorage.getItem(ToastNotification.SNOOZE_KEY);
		if (!stored) return false;
		const until = parseInt(stored, 10);
		if (isNaN(until)) return false;
		if (until <= Date.now()) {
			// Expired — clean up
			localStorage.removeItem(ToastNotification.SNOOZE_KEY);
			return false;
		}
		return true;
	}

	constructor(plugin: TaskNotesPlugin) {
		this.plugin = plugin;
	}

	// ========================================
	// Reminder Queue State Management (Phase 8a)
	// ========================================

	/**
	 * Get the reminder queue state from localStorage.
	 * Supports both v1 (timestamp only) and v2 (enhanced entry) formats.
	 */
	private getQueueState(): ReminderQueueState {
		const stored = localStorage.getItem(ToastNotification.QUEUE_KEY);
		if (!stored) {
			return { version: 2, seen: {} };
		}
		try {
			const parsed = JSON.parse(stored);
			// Accept both v1 and v2 - v1 entries are migrated on read in isItemSeen
			return parsed;
		} catch {
			return { version: 2, seen: {} };
		}
	}

	/**
	 * Save the reminder queue state to localStorage.
	 */
	private saveQueueState(state: ReminderQueueState): void {
		state.version = 2; // Always save as v2
		localStorage.setItem(ToastNotification.QUEUE_KEY, JSON.stringify(state));
	}

	/**
	 * Generate a unique key for an item in the seen map.
	 *
	 * For rolled-up base notifications:
	 *   Format: `${basePath}:base:${matchCount}`
	 *   Returns when match count changes (new items flow in/out)
	 *
	 * For individual items:
	 *   Format: `${path}:query:${dueDate || 'no-date'}`
	 *   Returns when due date changes
	 */
	private getSeenKey(item: AggregatedNotificationItem): string {
		if (item.isBaseNotification && item.matchCount !== undefined) {
			// Rolled-up base notification: key includes match count
			// Returns when items flow in/out of the query
			return `${item.path}:base:${item.matchCount}`;
		}
		// Individual item: key includes due date
		const dueContext = item.dueDate || "no-date";
		return `${item.path}:query:${dueContext}`;
	}

	/**
	 * Check if an item has been seen (dismissed) and should remain hidden.
	 * Respects per-category dismiss behavior and snooze timing.
	 */
	isItemSeen(item: AggregatedNotificationItem): boolean {
		const state = this.getQueueState();
		const key = this.getSeenKey(item);
		const entry = state.seen[key];

		if (!entry) {
			return false; // Not seen
		}

		const now = Date.now();

		// Handle v1 legacy entries (just a timestamp) - treat as until-restart
		if (typeof entry === "number") {
			// v1 format: item stays seen forever (until restart clears memory)
			// For safety, we keep it seen - users can clear via command
			return true;
		}

		// v2 format: check behavior-specific return conditions
		const seenEntry = entry as SeenEntry;

		switch (seenEntry.behavior) {
			case "until-restart":
				// Item stays seen until Obsidian restarts (localStorage persists, but
				// this is effectively a session marker since we don't track restarts)
				// For now, these stay seen - the restart clears toastDismissedThisSession
				return true;

			case "snooze-1h":
			case "snooze-4h":
			case "snooze-1d":
				// Check if snooze period has elapsed
				if (seenEntry.returnAt > 0 && now >= seenEntry.returnAt) {
					// Snooze expired - item should return
					this.removeSeenEntry(key);
					return false;
				}
				return true;

			case "until-data-change":
				// The key already includes due date, so if data changed, the key changed
				// and this entry wouldn't match. So if we're here, data hasn't changed.
				return true;

			case "until-complete":
				// Would need to check if task is completed - for now, stays seen
				// TODO: Integrate with TaskService to check completion status
				return true;

			case "until-next-reminder":
				// One-shot per reminder instance - stays seen
				return true;

			case "permanent":
				// Gone forever
				return true;

			default:
				return true;
		}
	}

	/**
	 * Remove a seen entry (used when snooze expires).
	 */
	private removeSeenEntry(key: string): void {
		const state = this.getQueueState();
		delete state.seen[key];
		this.saveQueueState(state);
	}

	/**
	 * Mark items as seen (dismissed) with per-category behavior.
	 */
	markItemsAsSeen(items: AggregatedNotificationItem[]): void {
		const state = this.getQueueState();
		const now = Date.now();
		const reminderSettings = this.getReminderTypeSettings();

		for (const item of items) {
			const key = this.getSeenKey(item);
			const categoryBehavior = this.getCategoryBehavior(item.timeCategory, item.sources, reminderSettings);
			const behavior = categoryBehavior.dismissBehavior;

			// Calculate return time based on behavior
			let returnAt = 0;
			switch (behavior) {
				case "snooze-1h":
					returnAt = now + (1 * 60 * 60 * 1000); // 1 hour
					break;
				case "snooze-4h":
					returnAt = now + (4 * 60 * 60 * 1000); // 4 hours
					break;
				case "snooze-1d":
					returnAt = now + (24 * 60 * 60 * 1000); // 24 hours
					break;
				default:
					// Check autoReturnHours
					if (categoryBehavior.autoReturnHours > 0) {
						returnAt = now + (categoryBehavior.autoReturnHours * 60 * 60 * 1000);
					}
			}

			// Determine category for storage
			const isQueryBased = item.sources.some(s => s.type === "base");
			const category = isQueryBased ? "queryBased" as const : item.timeCategory;

			const seenEntry: SeenEntry = {
				dismissedAt: now,
				behavior,
				category,
				returnAt,
			};

			state.seen[key] = seenEntry;
		}

		this.saveQueueState(state);
		this.plugin.debugLog.log("ToastNotification", `Marked ${items.length} items as seen with per-category behavior`);
	}

	/**
	 * Filter out seen items from a list.
	 */
	filterUnseenItems(items: AggregatedNotificationItem[]): AggregatedNotificationItem[] {
		return items.filter(item => !this.isItemSeen(item));
	}

	/**
	 * Clear all seen items (for testing/debugging).
	 */
	clearSeenItems(): void {
		const state = this.getQueueState();
		state.seen = {};
		this.saveQueueState(state);
		this.plugin.debugLog.log("ToastNotification", "Cleared all seen items");
	}

	/**
	 * Get count of seen items.
	 */
	getSeenCount(): number {
		const state = this.getQueueState();
		return Object.keys(state.seen).length;
	}

	/**
	 * Show an aggregated notification toast.
	 * Used when multiple items need attention.
	 * Note: Does NOT update status bar - caller (checkAndShow) handles that.
	 *
	 * @param data.items - The actual items to display (for expandable list and seen tracking)
	 * @param data.counts - Breakdown counts for display
	 */
	showAggregated(data: {
		items: AggregatedNotificationItem[];
		counts: {
			total: number;
			overdue: number;
			today: number;
			fromBases: number;
		};
	}): void {
		const { items, counts } = data;

		if (counts.total === 0) {
			this.dismiss();
			return;
		}

		// Store items for marking as seen on dismiss
		this.currentItems = items;

		// Count bases vs tasks separately for a clearer message
		const baseCount = items.filter(item => item.isBaseNotification).length;
		const taskCount = items.filter(item => !item.isBaseNotification).length;

		// Build message showing breakdown of tasks and bases
		let message: string;
		if (baseCount > 0 && taskCount > 0) {
			// Mixed: "10 tasks and 5 bases need attention"
			const taskPart = taskCount === 1 ? "1 task" : `${taskCount} tasks`;
			const basePart = baseCount === 1 ? "1 base" : `${baseCount} bases`;
			message = `${taskPart} and ${basePart} need attention`;
		} else if (baseCount > 0) {
			// Only bases
			message = baseCount === 1
				? "1 base needs attention"
				: `${baseCount} bases need attention`;
		} else {
			// Only tasks
			message = taskCount === 1
				? "1 task needs attention"
				: `${taskCount} tasks need attention`;
		}

		// Build subtitle with urgency breakdown (overdue highlighted)
		const parts: string[] = [];
		if (counts.overdue > 0) parts.push(`<span class="tn-toast__overdue">${counts.overdue} overdue</span>`);
		if (counts.today > 0) parts.push(`${counts.today} due today`);
		const subtitleHtml = parts.join(" · ");

		this.showWithItems({
			message,
			subtitleHtml,
			items,
			timeout: 0, // Persist until user acts (WCAG 2.2.4)
			actionLabel: "View",
			onAction: () => this.openUpcomingView(),
			showSnooze: true,
			onSnooze: (minutes) => this.snoozeAll(minutes),
			onDismiss: () => {
				// "I've seen this, I'll action it" — mark items as seen + suppress toast
				this.markItemsAsSeen(this.currentItems);
				this.toastDismissedThisSession = true;
				this.plugin.debugLog.log("ToastNotification", `Toast dismissed — marked ${this.currentItems.length} items as seen`);
			},
		});
		// Status bar is updated by checkAndShow(), not here (avoid double-update)
	}

	/**
	 * Show an individual task notification.
	 * Used for specific task reminders.
	 */
	showIndividual(taskTitle: string, context: string): void {
		this.show({
			message: taskTitle,
			subtitle: context,
			timeout: 0, // Persist until user acts (WCAG 2.2.4)
			actionLabel: "Open",
			onAction: () => this.openUpcomingView(),
		});
	}

	/**
	 * Show a custom toast notification.
	 */
	show(config: ToastConfig): void {
		// Dismiss any existing toast
		this.dismiss();

		const doc = document;

		// Create toast container
		const toast = doc.createElement("div");
		toast.className = "tn-toast";

		// Icon
		const iconEl = doc.createElement("div");
		iconEl.className = "tn-toast__icon";
		setIcon(iconEl, "bell");
		toast.appendChild(iconEl);

		// Content
		const content = doc.createElement("div");
		content.className = "tn-toast__content";

		const messageEl = doc.createElement("div");
		messageEl.className = "tn-toast__message";
		messageEl.textContent = config.message;
		content.appendChild(messageEl);

		if (config.subtitleHtml || config.subtitle) {
			const subtitleEl = doc.createElement("div");
			subtitleEl.className = "tn-toast__subtitle";
			if (config.subtitleHtml) {
				subtitleEl.innerHTML = config.subtitleHtml;
			} else {
				subtitleEl.textContent = config.subtitle!;
			}
			content.appendChild(subtitleEl);
		}

		toast.appendChild(content);

		// Actions
		const actions = doc.createElement("div");
		actions.className = "tn-toast__actions";

		if (config.actionLabel && config.onAction) {
			const actionBtn = doc.createElement("button");
			actionBtn.className = "tn-toast__action";
			actionBtn.textContent = config.actionLabel;
			actionBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				config.onAction?.();
				this.dismiss();
			});
			actions.appendChild(actionBtn);
		}

		if (config.showSnooze && config.onSnooze) {
			const snoozeBtn = doc.createElement("button");
			snoozeBtn.className = "tn-toast__snooze";
			const snoozeIcon = doc.createElement("span");
			snoozeIcon.className = "tn-toast__snooze-icon";
			setIcon(snoozeIcon, "clock");
			snoozeBtn.appendChild(snoozeIcon);
			snoozeBtn.appendText("Snooze");
			snoozeBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				const menu = new Menu();
				for (const opt of SNOOZE_OPTIONS) {
					menu.addItem((item) => {
						item.setTitle(opt.label)
							.setIcon("clock")
							.onClick(() => {
								config.onSnooze!(opt.getMinutes());
								this.dismiss();
							});
					});
				}
				menu.showAtMouseEvent(e as MouseEvent);
			});
			actions.appendChild(snoozeBtn);
		}

		const dismissBtn = doc.createElement("button");
		dismissBtn.className = "tn-toast__dismiss";
		dismissBtn.textContent = "Dismiss";
		dismissBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.dismiss();
			config.onDismiss?.();
		});
		actions.appendChild(dismissBtn);

		toast.appendChild(actions);

		// Click anywhere on toast to trigger action
		toast.addEventListener("click", () => {
			config.onAction?.();
			this.dismiss();
		});

		// Add to document
		doc.body.appendChild(toast);
		this.currentToast = toast;

		// Trigger animation
		requestAnimationFrame(() => {
			toast.classList.add("tn-toast--visible");
		});

		// Auto-dismiss
		if (config.timeout && config.timeout > 0) {
			this.dismissTimeout = setTimeout(() => {
				this.dismiss();
			}, config.timeout);
		}

		this.plugin.debugLog.log("ToastNotification", `Showing toast: ${config.message}`);
	}

	/**
	 * Show a toast with expandable item list (Phase 8b enhanced toast).
	 * Includes:
	 * - Expandable item list that expands UPWARD (keeps header in place)
	 * - Clickable count text with up-arrow as toggle
	 * - "Got it" button instead of "Dismiss"
	 * - Color-coded urgency icons
	 *
	 * DOM structure for upward expansion:
	 * - toast (flex column)
	 *   - itemsList (expands from 0 height)
	 *   - header (icon + content + actions) - stays at bottom
	 */
	showWithItems(config: ToastWithItemsConfig): void {
		// Dismiss any existing toast
		this.dismiss();

		const doc = document;

		// Create toast container
		const toast = doc.createElement("div");
		toast.className = "tn-toast tn-toast--with-items";

		// Items list (positioned ABOVE header, hidden by default)
		let itemsList: HTMLElement | null = null;
		let expanded = false;

		if (config.items.length > 0) {
			itemsList = doc.createElement("div");
			itemsList.className = "tn-toast__items-list tn-toast__items-list--above";

			const maxVisible = 5;
			const hiddenCount = config.items.length - maxVisible;
			let isScrollMode = false;

			// Helper to render a single item element
			const renderItem = (item: AggregatedNotificationItem): HTMLElement => {
				const itemEl = doc.createElement("div");
				itemEl.className = "tn-toast__item";

				// Icon - different for base notifications vs individual items
				const itemIcon = doc.createElement("span");
				itemIcon.className = "tn-toast__item-icon";

				if (item.isBaseNotification) {
					// Base notification: use layers icon with urgency coloring
					if (item.timeCategory === "overdue") {
						itemIcon.classList.add("tn-toast__item-icon--overdue");
					} else if (item.timeCategory === "today") {
						itemIcon.classList.add("tn-toast__item-icon--today");
					} else {
						itemIcon.classList.add("tn-toast__item-icon--upcoming");
					}
					setIcon(itemIcon, "layers");
				} else {
					// Individual item: use urgency-specific icons
					if (item.timeCategory === "overdue") {
						itemIcon.classList.add("tn-toast__item-icon--overdue");
						setIcon(itemIcon, "alert-triangle");
					} else if (item.timeCategory === "today") {
						itemIcon.classList.add("tn-toast__item-icon--today");
						setIcon(itemIcon, "calendar");
					} else {
						itemIcon.classList.add("tn-toast__item-icon--upcoming");
						setIcon(itemIcon, "bell");
					}
				}
				itemEl.appendChild(itemIcon);

				// Title - clickable to open the item/base, with Ctrl+hover preview
				const titleEl = doc.createElement("span");
				titleEl.className = "tn-toast__item-title";
				titleEl.textContent = item.title;
				titleEl.dataset.href = item.path;
				titleEl.addEventListener("click", (e) => {
					e.stopPropagation();
					this.openFile(item.path);
				});
				// Ctrl+hover to show page preview
				titleEl.addEventListener("mouseenter", (e) => {
					if (e.ctrlKey || e.metaKey) {
						this.plugin.app.workspace.trigger("hover-link", {
							event: e,
							source: "tasknotes-toast",
							hoverParent: { hoverPopover: null },
							targetEl: titleEl,
							linktext: item.path,
						});
					}
				});
				itemEl.appendChild(titleEl);

				// Context (e.g., "X items match") - clickable for base notifications
				if (item.timeContext) {
					const contextEl = doc.createElement("span");
					contextEl.className = "tn-toast__item-context";

					if (item.isBaseNotification && item.sourceBasePath) {
						// Make "X items match" clickable to open the base
						contextEl.classList.add("tn-toast__item-context--clickable");
						contextEl.textContent = item.timeContext;
						contextEl.title = `Open ${item.title}`;
						contextEl.addEventListener("click", (e) => {
							e.stopPropagation();
							this.openFile(item.sourceBasePath!);
						});
					} else {
						contextEl.textContent = item.timeContext;
					}
					itemEl.appendChild(contextEl);
				}

				return itemEl;
			};

			// Render initial items (truncated mode)
			const renderTruncated = () => {
				itemsList!.empty();
				const visibleItems = config.items.slice(0, maxVisible);
				for (const item of visibleItems) {
					itemsList!.appendChild(renderItem(item));
				}

				// "+X more" indicator - clickable to enable scroll mode
				if (hiddenCount > 0) {
					const moreEl = doc.createElement("div");
					moreEl.className = "tn-toast__item tn-toast__item--more";
					moreEl.textContent = `+${hiddenCount} more`;
					moreEl.title = "Click to show all and enable scrolling";
					moreEl.style.cursor = "pointer";
					moreEl.addEventListener("click", (e) => {
						e.stopPropagation();
						enableScrollMode();
					});
					itemsList!.appendChild(moreEl);
				}
			};

			// Enable scroll mode - show all items with scrollable container
			const enableScrollMode = () => {
				if (isScrollMode) return;
				isScrollMode = true;

				itemsList!.empty();
				itemsList!.classList.add("tn-toast__items-list--scrollable");

				for (const item of config.items) {
					itemsList!.appendChild(renderItem(item));
				}
			};

			// Initial render in truncated mode
			renderTruncated();

			// Items list comes FIRST in DOM (will be at top when expanded)
			toast.appendChild(itemsList);
		}

		// ── Header wrapper (stays at bottom, doesn't move when items expand) ──
		const header = doc.createElement("div");
		header.className = "tn-toast__header";

		// Icon
		const iconEl = doc.createElement("div");
		iconEl.className = "tn-toast__icon";
		setIcon(iconEl, "bell");
		header.appendChild(iconEl);

		// Content
		const content = doc.createElement("div");
		content.className = "tn-toast__content";

		// Parse message to make count clickable (e.g., "4 bases" or "10 tasks and 5 bases")
		// Extract everything before "need(s) attention" to make it the toggle
		const messageEl = doc.createElement("div");
		messageEl.className = "tn-toast__message";

		// Shared toggle function (used by count toggle and optionally by toast body click)
		let countToggle: HTMLElement | null = null;
		const toggleExpanded = () => {
			if (!itemsList) return;
			expanded = !expanded;
			itemsList.classList.toggle("tn-toast__items-list--expanded", expanded);
			if (countToggle) {
				countToggle.classList.toggle("tn-toast__count-toggle--expanded", expanded);
				countToggle.title = expanded ? "Click to hide details" : "Click to show details";
			}
		};

		if (config.items.length > 0 && itemsList) {
			// Parse various formats:
			// - "5 bases need attention"
			// - "10 tasks and 5 bases need attention"
			// - "1 task needs attention"
			const match = config.message.match(/^(.+?)\s+(needs?\s+attention)$/);
			if (match) {
				// Clickable count toggle with up-arrow
				countToggle = doc.createElement("span");
				countToggle.className = "tn-toast__count-toggle";
				countToggle.title = "Click to show details";

				const countText = doc.createElement("span");
				countText.className = "tn-toast__count-text";
				countText.textContent = match[1]; // "4 bases" or "10 tasks and 5 bases"
				countToggle.appendChild(countText);

				const chevronIcon = doc.createElement("span");
				chevronIcon.className = "tn-toast__count-chevron";
				setIcon(chevronIcon, "chevron-up");
				countToggle.appendChild(chevronIcon);

				// Toggle behavior
				countToggle.addEventListener("click", (e) => {
					e.stopPropagation();
					toggleExpanded();
				});

				messageEl.appendChild(countToggle);
				messageEl.appendText(" " + match[2]); // " need attention"
			} else {
				// Fallback: just show the message as-is
				messageEl.textContent = config.message;
			}
		} else {
			messageEl.textContent = config.message;
		}
		content.appendChild(messageEl);

		if (config.subtitleHtml || config.subtitle) {
			const subtitleEl = doc.createElement("div");
			subtitleEl.className = "tn-toast__subtitle";
			if (config.subtitleHtml) {
				subtitleEl.innerHTML = config.subtitleHtml;
			} else {
				subtitleEl.textContent = config.subtitle!;
			}
			content.appendChild(subtitleEl);
		}

		header.appendChild(content);

		// Actions
		const actions = doc.createElement("div");
		actions.className = "tn-toast__actions";

		if (config.actionLabel && config.onAction) {
			const actionBtn = doc.createElement("button");
			actionBtn.className = "tn-toast__action";
			actionBtn.textContent = config.actionLabel;
			actionBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				config.onAction?.();
				this.dismiss();
			});
			actions.appendChild(actionBtn);
		}

		if (config.showSnooze && config.onSnooze) {
			const snoozeBtn = doc.createElement("button");
			snoozeBtn.className = "tn-toast__snooze";
			const snoozeIcon = doc.createElement("span");
			snoozeIcon.className = "tn-toast__snooze-icon";
			setIcon(snoozeIcon, "clock");
			snoozeBtn.appendChild(snoozeIcon);
			snoozeBtn.appendText("Snooze");
			snoozeBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				const menu = new Menu();
				for (const opt of SNOOZE_OPTIONS) {
					menu.addItem((item) => {
						item.setTitle(opt.label)
							.setIcon("clock")
							.onClick(() => {
								config.onSnooze!(opt.getMinutes());
								this.dismiss();
							});
					});
				}
				menu.showAtMouseEvent(e as MouseEvent);
			});
			actions.appendChild(snoozeBtn);
		}

		// "Got it" button (renamed from "Dismiss" for clarity)
		const gotItBtn = doc.createElement("button");
		gotItBtn.className = "tn-toast__dismiss tn-toast__got-it";
		gotItBtn.textContent = "Got it";
		gotItBtn.title = "Mark as seen — won't show again until data changes";
		gotItBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.dismiss();
			config.onDismiss?.();
		});
		actions.appendChild(gotItBtn);

		header.appendChild(actions);

		// Header comes AFTER items list (stays at bottom visually)
		toast.appendChild(header);

		// Click anywhere on toast (not on buttons) to trigger action
		// Behavior depends on toastClickBehavior setting:
		// - "view": click opens Upcoming View (current default)
		// - "expand": click toggles items list, View button is only way to Upcoming
		const clickBehavior = this.plugin.devicePrefs?.getToastClickBehavior() ?? "view";

		toast.addEventListener("click", (e) => {
			const target = e.target as HTMLElement;
			// Don't trigger if clicking on buttons, items list, or individual items
			// This allows clicks anywhere else on the toast (including subtitle, message, etc.)
			if (target.closest('.tn-toast__button') ||
				target.closest('.tn-toast__items-list') ||
				target.closest('.tn-toast__item') ||
				target.closest('.tn-toast__toggle')) {
				return;
			}
			// Click anywhere else on toast triggers expand/view
			if (clickBehavior === "expand" && itemsList) {
				// Expand mode: toggle items list
				toggleExpanded();
			} else {
				// View mode: open Upcoming View
				config.onAction?.();
				this.dismiss();
			}
		});

		// Add to document
		doc.body.appendChild(toast);
		this.currentToast = toast;

		// Trigger animation
		requestAnimationFrame(() => {
			toast.classList.add("tn-toast--visible");
		});

		// Auto-dismiss
		if (config.timeout && config.timeout > 0) {
			this.dismissTimeout = setTimeout(() => {
				this.dismiss();
			}, config.timeout);
		}

		this.plugin.debugLog.log("ToastNotification", `Showing enhanced toast: ${config.message} with ${config.items.length} items`);
	}

	/**
	 * Dismiss the current toast.
	 */
	dismiss(): void {
		if (this.dismissTimeout) {
			clearTimeout(this.dismissTimeout);
			this.dismissTimeout = null;
		}

		if (this.currentToast) {
			this.currentToast.classList.remove("tn-toast--visible");
			this.currentToast.classList.add("tn-toast--hiding");

			// Remove after animation
			const toast = this.currentToast;
			setTimeout(() => {
				toast.remove();
			}, 300);

			this.currentToast = null;
		}
	}

	/**
	 * Update the status bar badge with notification count.
	 */
	updateStatusBar(count: number): void {
		// Only create status bar item once
		if (!this.statusBarItem) {
			// Check if there's already one from a previous session (orphaned)
			const existing = document.querySelector(".tn-status-bar-notifications");
			if (existing) {
				this.plugin.debugLog.log("ToastNotification", "Found orphaned status bar item, removing it");
				existing.remove();
			}

			// Create status bar item
			this.statusBarItem = this.plugin.addStatusBarItem();
			this.statusBarItem.className = "tn-status-bar-notifications";
			this.statusBarItem.addEventListener("click", async () => {
				const behavior = this.plugin.devicePrefs?.getStatusBarClickBehavior() ?? "view";
				if (behavior === "toast") {
					// Show/toggle toast instead of opening view
					if (this.currentToast) {
						// Toast already visible - dismiss it
						this.dismiss();
					} else {
						// Show the toast with current items
						await this.checkAndShow();
						// If checkAndShow didn't show toast (all seen/snoozed), force show it
						if (!this.currentToast) {
							const items = await this.plugin.notificationCache.getAggregatedItems();
							if (items.length > 0) {
								this.showAggregated({
									items,
									counts: {
										total: items.length,
										overdue: items.filter(i => i.timeCategory === "overdue").length,
										today: items.filter(i => i.timeCategory === "today").length,
										fromBases: items.filter(i => i.sources.some(s => s.type === "base")).length,
									},
								});
							}
						}
					}
				} else {
					// Default: open Upcoming View
					this.openUpcomingView();
				}
			});
			this.plugin.debugLog.log("ToastNotification", "Created status bar item");
		}

		if (count > 0) {
			this.statusBarItem.empty();
			const iconEl = this.statusBarItem.createSpan({ cls: "tn-status-bar-notifications__icon" });
			setIcon(iconEl, "bell");
			this.statusBarItem.createSpan({
				cls: "tn-status-bar-notifications__count",
				text: count.toString()
			});
			this.statusBarItem.title = `${count} item${count > 1 ? "s" : ""} need attention`;
			this.statusBarItem.style.display = "flex";
		} else {
			this.statusBarItem.style.display = "none";
		}
	}

	/**
	 * Snooze all monitored bases and clear status bar.
	 */
	private snoozeAll(minutes: number): void {
		const until = Date.now() + minutes * 60 * 1000;
		localStorage.setItem(ToastNotification.SNOOZE_KEY, until.toString());
		this.plugin.basesQueryWatcher.snoozeAllBases(minutes);
		this.updateStatusBar(0);
		const label =
			minutes >= 1440
				? "until tomorrow"
				: minutes >= 60
					? `${Math.round(minutes / 60)} hour${Math.round(minutes / 60) > 1 ? "s" : ""}`
					: `${minutes} minute${minutes > 1 ? "s" : ""}`;
		new Notice(`Snoozed all notifications for ${label}`);
	}

	/**
	 * Open the Upcoming view.
	 * Uses the same command file mapping system as other TaskNotes views.
	 * Reuses existing tab if the file is already open.
	 */
	private async openUpcomingView(): Promise<void> {
		this.plugin.debugLog.log("ToastNotification", "Opening Upcoming view via command mapping");
		await this.plugin.openBasesFileForCommand('open-upcoming-view');
	}

	/**
	 * Open a file by path.
	 * Used for opening bases or task notes from the toast item list.
	 */
	private async openFile(path: string): Promise<void> {
		const file = this.plugin.app.vault.getAbstractFileByPath(path);
		if (file) {
			await this.plugin.app.workspace.getLeaf(false).openFile(file as any);
			this.dismiss();
		}
	}

	/**
	 * Check for notifications and show toast if needed.
	 * Called periodically or on events.
	 *
	 * Phase 8d: Bell shows PENDING items only (unseen + category has showInBellCount).
	 * Toast shows items where category has showToast: true.
	 */
	async checkAndShow(): Promise<void> {
		this.plugin.debugLog.log("ToastNotification", "checkAndShow() called");

		// Respect toast-level snooze (persisted in localStorage)
		if (this.isSnoozed()) {
			this.plugin.debugLog.log("ToastNotification", "Snoozed, skipping check");
			this.updateStatusBar(0); // Hide bell when snoozed
			return;
		}

		try {
			// Use cache for performance - returns instantly if cached (45s TTL)
			const allItems = await this.plugin.notificationCache.getAggregatedItems();

			this.plugin.debugLog.log("ToastNotification", `Got ${allItems.length} aggregated items`, {
				items: allItems.map(i => ({
					title: i.title,
					timeCategory: i.timeCategory,
					sources: i.sources.map(s => s.type)
				}))
			});

			if (allItems.length === 0) {
				this.plugin.debugLog.log("ToastNotification", "No items - hiding status bar");
				this.updateStatusBar(0);
				return;
			}

			// Get per-category behavior settings (with defaults fallback)
			const reminderSettings = this.getReminderTypeSettings();

			// Filter out seen items for toast display (Phase 8a: per-item seen tracking)
			const unseenItems = this.filterUnseenItems(allItems);
			const seenCount = allItems.length - unseenItems.length;

			this.plugin.debugLog.log("ToastNotification", `Filtered: ${unseenItems.length} unseen, ${seenCount} seen`);

			// Filter for bell count: only items where category has showInBellCount: true
			const bellItems = unseenItems.filter(item => {
				const categoryBehavior = this.getCategoryBehavior(item.timeCategory, item.sources, reminderSettings);
				return categoryBehavior.showInBellCount;
			});

			// Update status bar with PENDING items only (unseen + showInBellCount)
			this.updateStatusBar(bellItems.length);

			this.plugin.debugLog.log("ToastNotification", `Bell count: ${bellItems.length} pending items`);

			// If all items are seen or filtered out, no need to show toast
			if (unseenItems.length === 0) {
				this.plugin.debugLog.log("ToastNotification", "All items seen — no toast");
				return;
			}

			// Filter for toast: only items where category has showToast: true
			const toastItems = unseenItems.filter(item => {
				const categoryBehavior = this.getCategoryBehavior(item.timeCategory, item.sources, reminderSettings);
				return categoryBehavior.showToast;
			});

			// Count by category (for toast items only)
			let overdue = 0;
			let today = 0;
			let fromBases = 0;

			for (const item of toastItems) {
				if (item.timeCategory === "overdue") overdue++;
				if (item.timeCategory === "today") today++;
				if (item.sources.some(s => s.type === "base")) fromBases++;
			}

			this.plugin.debugLog.log("ToastNotification", `Toast categories: overdue=${overdue}, today=${today}, fromBases=${fromBases}`);

			// If user dismissed toast this session, don't re-show popup
			// (Status bar stays visible so they can access items via click)
			if (this.toastDismissedThisSession) {
				this.plugin.debugLog.log("ToastNotification", "Toast dismissed this session — no popup");
				return;
			}

			// Show toast if there are any toastable items
			if (toastItems.length > 0) {
				this.plugin.debugLog.log("ToastNotification", `Showing toast (${toastItems.length} toastable items)`);
				this.showAggregated({
					items: toastItems,
					counts: {
						total: toastItems.length,
						overdue,
						today,
						fromBases,
					},
				});
			} else {
				this.plugin.debugLog.log("ToastNotification", "No toastable items (categories filtered out by showToast setting)");
			}
		} catch (error) {
			this.plugin.debugLog.error("ToastNotification", "Error checking notifications:", error);
		}
	}

	/**
	 * Get reminder type settings with fallback to defaults.
	 */
	private getReminderTypeSettings(): import("../types/settings").ReminderTypeSettings {
		const { DEFAULT_REMINDER_TYPE_SETTINGS } = require("../settings/defaults");
		return this.plugin.settings.vaultWideNotifications?.reminderTypeSettings ?? DEFAULT_REMINDER_TYPE_SETTINGS;
	}

	/**
	 * Get behavior for a specific time category.
	 * Query-based items (from bases) use the 'queryBased' category settings.
	 */
	private getCategoryBehavior(
		timeCategory: import("../types/settings").TimeCategory,
		sources: import("../types/settings").NotificationSource[],
		settings: import("../types/settings").ReminderTypeSettings
	): import("../types/settings").TimeCategoryBehavior {
		// If item is from a base query, use queryBased settings
		const isQueryBased = sources.some(s => s.type === "base");
		if (isQueryBased) {
			return settings.queryBased;
		}

		// Map time category to settings
		switch (timeCategory) {
			case "overdue":
				return settings.overdue;
			case "today":
				return settings.today;
			case "tomorrow":
				return settings.tomorrow;
			case "thisWeek":
			case "thisMonth":
			case "later":
				return settings.thisWeek; // Use thisWeek settings for all future items
			default:
				return settings.today; // Safe default
		}
	}

	/**
	 * Clean up resources.
	 */
	destroy(): void {
		this.dismiss();
		if (this.statusBarItem) {
			this.statusBarItem.remove();
			this.statusBarItem = null;
		}
	}
}
