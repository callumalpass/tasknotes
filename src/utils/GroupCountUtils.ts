import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";

/**
 * Options for formatting group counts
 */
export interface GroupCountOptions {
	/** Show percentage instead of fraction (future feature) */
	showPercentage?: boolean;
	/** Hide completed count, show only total (future feature) */
	hideCompleted?: boolean;
	/** Show overdue count (future feature for agenda view) */
	showOverdue?: boolean;
	/** Custom CSS classes to add */
	additionalClasses?: string[];
}

/**
 * Result of group count formatting
 */
export interface GroupCountResult {
	/** Formatted count text (e.g., "3 / 8") */
	text: string;
	/** CSS classes to apply */
	classes: string[];
	/** Raw completed count */
	completed: number;
	/** Raw total count */
	total: number;
	/** Completion percentage (0-100) */
	percentage: number;
}

/**
 * Utility functions for consistent group count formatting across views
 */
export class GroupCountUtils {
	/**
	 * Format group count with completed/total display
	 */
	static formatGroupCount(
		completed: number,
		total: number,
		options: GroupCountOptions = {}
	): GroupCountResult {
		const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

		// Base CSS classes - always include agenda-view__item-count for consistency
		const classes = ["agenda-view__item-count"];

		// Add any additional classes
		if (options.additionalClasses) {
			classes.push(...options.additionalClasses);
		}

		// Format text based on options (future extensibility)
		let text: string;

		if (options.showPercentage) {
			// Future feature: show percentage
			text = `${percentage}%`;
		} else if (options.hideCompleted) {
			// Future feature: show only total
			text = `${total}`;
		} else {
			// Current implementation: show completed / total
			text = `${completed} / ${total}`;
		}

		return {
			text,
			classes,
			completed,
			total,
			percentage,
		};
	}

	/**
	 * Calculate completion stats for a group of tasks
	 */
	static calculateGroupStats(
		tasks: TaskInfo[],
		plugin: TaskNotesPlugin
	): { completed: number; total: number } {
		const total = tasks.length;
		const completed = tasks.filter((task) =>
			plugin.statusManager.isCompletedStatus(task.status)
		).length;

		return { completed, total };
	}

	/**
	 * Create a count element with proper styling
	 */
	static createCountElement(
		container: HTMLElement,
		completed: number,
		total: number,
		options: GroupCountOptions = {}
	): HTMLElement {
		const countResult = GroupCountUtils.formatGroupCount(completed, total, options);

		const countEl = container.createEl("div", {
			text: countResult.text,
			cls: countResult.classes.join(" "),
		});

		// Add data attributes for potential future use
		countEl.setAttribute("data-completed", completed.toString());
		countEl.setAttribute("data-total", total.toString());
		countEl.setAttribute("data-percentage", countResult.percentage.toString());

		return countEl;
	}

	/**
	 * Update an existing count element
	 */
	static updateCountElement(
		element: HTMLElement,
		completed: number,
		total: number,
		options: GroupCountOptions = {}
	): void {
		const countResult = GroupCountUtils.formatGroupCount(completed, total, options);

		element.textContent = countResult.text;
		element.className = countResult.classes.join(" ");

		// Update data attributes
		element.setAttribute("data-completed", completed.toString());
		element.setAttribute("data-total", total.toString());
		element.setAttribute("data-percentage", countResult.percentage.toString());
	}
}
