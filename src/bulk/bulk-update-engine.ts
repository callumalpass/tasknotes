/**
 * Bulk update engine.
 * Handles batch updates to existing tasks: reschedule, status change, priority, etc.
 *
 * Part of the unified bulk operations system.
 * See: knowledge-base/01-working/bulk-engine-unified-operations.md
 */

import TaskNotesPlugin from "../main";
import { TaskInfo } from "../types";
import {
	BulkItem,
	BulkRescheduleOptions,
	BulkUpdateOptions,
	BulkOperationResult,
	createEmptyResult,
	ProgressCallback,
} from "./types";

/**
 * Result from bulk update operation (internal format).
 */
export interface BulkUpdateResult {
	/** Number of items successfully updated */
	updated: number;
	/** Number of items skipped */
	skipped: number;
	/** Number of items that failed */
	failed: number;
	/** Error messages */
	errors: string[];
	/** Paths of updated files */
	updatedPaths: string[];
}

/**
 * BulkUpdateEngine handles batch updates to existing tasks.
 *
 * Supports:
 * - Reschedule (update due/scheduled date)
 * - Property updates (status, priority, etc.)
 * - Archive/complete operations
 *
 * All operations return BulkOperationResult for consistent UI handling.
 */
export class BulkUpdateEngine {
	constructor(private plugin: TaskNotesPlugin) {}

	/**
	 * Reschedule multiple tasks to a new due date.
	 *
	 * @param items - Tasks to reschedule
	 * @param options - Reschedule options (newDueDate, newScheduledDate, etc.)
	 * @returns Unified operation result
	 */
	async reschedule(
		items: BulkItem[],
		options: BulkRescheduleOptions
	): Promise<BulkOperationResult> {
		const result = createEmptyResult("reschedule");

		if (items.length === 0) {
			return result;
		}

		const total = items.length;
		let current = 0;

		for (const item of items) {
			current++;
			options.onProgress?.(current, total, `Rescheduling: ${item.title || item.path}`);

			try {
				// Only process tasknotes (not base notifications)
				if (item.itemType === "base-notification") {
					// Base notifications can't be rescheduled directly
					// They need snooze logic (future implementation)
					result.skipped++;
					result.errors.push(`${item.title}: Base notification items cannot be rescheduled`);
					continue;
				}

				// Get the task from cache
				const task = await this.plugin.cacheManager.getTaskByPath(item.path);
				if (!task) {
					result.failed++;
					result.errors.push(`${item.title}: Task not found`);
					continue;
				}

				// Update due date if provided
				if (options.newDueDate) {
					await this.plugin.taskService.updateProperty(task, "due", options.newDueDate);
				}

				// Update scheduled date if provided
				if (options.newScheduledDate) {
					await this.plugin.taskService.updateProperty(task, "scheduled", options.newScheduledDate);
				}

				result.succeeded++;
				result.affectedPaths.push(item.path);
			} catch (error) {
				this.plugin.debugLog.error("BulkUpdateEngine", `Failed to reschedule ${item.path}:`, error);
				result.failed++;
				result.errors.push(`${item.title}: ${error instanceof Error ? error.message : "Unknown error"}`);
			}
		}

		return result;
	}

	/**
	 * Update a property on multiple tasks.
	 *
	 * @param items - Tasks to update
	 * @param options - Update options (property name and value)
	 * @returns Unified operation result
	 */
	async updateProperty(
		items: BulkItem[],
		options: BulkUpdateOptions
	): Promise<BulkOperationResult> {
		const result = createEmptyResult("update");

		if (items.length === 0) {
			return result;
		}

		const total = items.length;
		let current = 0;

		for (const item of items) {
			current++;
			options.onProgress?.(current, total, `Updating: ${item.title || item.path}`);

			try {
				// Only process tasknotes
				if (item.itemType === "base-notification") {
					result.skipped++;
					result.errors.push(`${item.title}: Cannot update base notification items`);
					continue;
				}

				const task = await this.plugin.cacheManager.getTaskByPath(item.path);
				if (!task) {
					result.failed++;
					result.errors.push(`${item.title}: Task not found`);
					continue;
				}

				await this.plugin.taskService.updateProperty(
					task,
					options.property as keyof TaskInfo,
					options.value
				);

				result.succeeded++;
				result.affectedPaths.push(item.path);
			} catch (error) {
				this.plugin.debugLog.error("BulkUpdateEngine", `Failed to update ${item.path}:`, error);
				result.failed++;
				result.errors.push(`${item.title}: ${error instanceof Error ? error.message : "Unknown error"}`);
			}
		}

		return result;
	}

	/**
	 * Archive multiple tasks.
	 *
	 * @param items - Tasks to archive
	 * @param archive - true to archive, false to unarchive
	 * @param onProgress - Progress callback
	 * @returns Unified operation result
	 */
	async archive(
		items: BulkItem[],
		archive: boolean = true,
		onProgress?: ProgressCallback
	): Promise<BulkOperationResult> {
		const result = createEmptyResult("archive");

		if (items.length === 0) {
			return result;
		}

		const total = items.length;
		let current = 0;

		for (const item of items) {
			current++;
			onProgress?.(current, total, `${archive ? "Archiving" : "Unarchiving"}: ${item.title || item.path}`);

			try {
				if (item.itemType === "base-notification") {
					result.skipped++;
					continue;
				}

				const task = await this.plugin.cacheManager.getTaskByPath(item.path);
				if (!task) {
					result.failed++;
					result.errors.push(`${item.title}: Task not found`);
					continue;
				}

				await this.plugin.taskService.updateProperty(task, "archived", archive);

				result.succeeded++;
				result.affectedPaths.push(item.path);
			} catch (error) {
				this.plugin.debugLog.error("BulkUpdateEngine", `Failed to archive ${item.path}:`, error);
				result.failed++;
				result.errors.push(`${item.title}: ${error instanceof Error ? error.message : "Unknown error"}`);
			}
		}

		return result;
	}

	/**
	 * Complete multiple tasks.
	 *
	 * @param items - Tasks to complete
	 * @param onProgress - Progress callback
	 * @returns Unified operation result
	 */
	async complete(
		items: BulkItem[],
		onProgress?: ProgressCallback
	): Promise<BulkOperationResult> {
		const result = createEmptyResult("complete");

		if (items.length === 0) {
			return result;
		}

		const total = items.length;
		let current = 0;

		for (const item of items) {
			current++;
			onProgress?.(current, total, `Completing: ${item.title || item.path}`);

			try {
				if (item.itemType === "base-notification") {
					result.skipped++;
					continue;
				}

				const task = await this.plugin.cacheManager.getTaskByPath(item.path);
				if (!task) {
					result.failed++;
					result.errors.push(`${item.title}: Task not found`);
					continue;
				}

				// Find the completed status and set it
				const completedStatus = this.plugin.settings.customStatuses?.find(
					s => s.isCompleted
				)?.value || "done";
				await this.plugin.taskService.updateProperty(task, "status", completedStatus);

				result.succeeded++;
				result.affectedPaths.push(item.path);
			} catch (error) {
				this.plugin.debugLog.error("BulkUpdateEngine", `Failed to complete ${item.path}:`, error);
				result.failed++;
				result.errors.push(`${item.title}: ${error instanceof Error ? error.message : "Unknown error"}`);
			}
		}

		return result;
	}

	/**
	 * Delete multiple tasks.
	 *
	 * @param items - Tasks to delete
	 * @param onProgress - Progress callback
	 * @returns Unified operation result
	 */
	async delete(
		items: BulkItem[],
		onProgress?: ProgressCallback
	): Promise<BulkOperationResult> {
		const result = createEmptyResult("delete");

		if (items.length === 0) {
			return result;
		}

		const total = items.length;
		let current = 0;

		for (const item of items) {
			current++;
			onProgress?.(current, total, `Deleting: ${item.title || item.path}`);

			try {
				if (item.itemType === "base-notification") {
					result.skipped++;
					continue;
				}

				const file = this.plugin.app.vault.getAbstractFileByPath(item.path);
				if (!file) {
					result.failed++;
					result.errors.push(`${item.title}: File not found`);
					continue;
				}

				await this.plugin.app.vault.delete(file);

				result.succeeded++;
				result.affectedPaths.push(item.path);
			} catch (error) {
				this.plugin.debugLog.error("BulkUpdateEngine", `Failed to delete ${item.path}:`, error);
				result.failed++;
				result.errors.push(`${item.title}: ${error instanceof Error ? error.message : "Unknown error"}`);
			}
		}

		return result;
	}
}
