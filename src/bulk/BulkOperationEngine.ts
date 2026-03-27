/**
 * Unified Bulk Operation Engine.
 *
 * Single entry point for all bulk operations in TaskNotes.
 * Routes operations to appropriate specialized engines and returns
 * consistent BulkOperationResult for all operations.
 *
 * Architecture:
 * - BulkOperationEngine (this file) - Unified processor, routing
 * - BulkTaskEngine - Create new task files
 * - BulkConvertEngine - Convert notes to tasks in-place
 * - BulkUpdateEngine - Update/reschedule/archive/complete/delete
 *
 * See: knowledge-base/01-working/bulk-engine-unified-operations.md
 */

import TaskNotesPlugin from "../main";
import { BulkTaskEngine, BulkCreationOptions } from "./bulk-task-engine";
import { BulkConvertEngine, BulkConvertOptions } from "./bulk-convert-engine";
import { BulkUpdateEngine } from "./bulk-update-engine";
import {
	BulkOperation,
	BulkOperationResult,
	BulkPreCheckResult,
	BulkItem,
	BulkRescheduleOptions,
	BulkUpdateOptions,
	ProgressCallback,
	createEmptyResult,
	fromCreationResult,
	fromConvertResult,
} from "./types";

/**
 * BulkOperationEngine is the unified entry point for all bulk operations.
 *
 * Usage:
 * ```typescript
 * const engine = new BulkOperationEngine(plugin);
 *
 * // Reschedule tasks
 * const result = await engine.execute({
 *   type: 'reschedule',
 *   items: bulkItems,
 *   options: { newDueDate: '2026-02-15' }
 * });
 *
 * // Show result
 * new Notice(formatResultNotice(result));
 * ```
 */
export class BulkOperationEngine {
	private taskEngine: BulkTaskEngine;
	private convertEngine: BulkConvertEngine;
	private updateEngine: BulkUpdateEngine;

	constructor(private plugin: TaskNotesPlugin) {
		this.taskEngine = new BulkTaskEngine(plugin);
		this.convertEngine = new BulkConvertEngine(plugin);
		this.updateEngine = new BulkUpdateEngine(plugin);
	}

	/**
	 * Execute a bulk operation.
	 *
	 * Routes to appropriate engine based on operation type.
	 *
	 * @param operation - The bulk operation to execute
	 * @returns Unified operation result
	 */
	async execute(operation: BulkOperation): Promise<BulkOperationResult> {
		this.plugin.debugLog.log(
			"BulkOperationEngine",
			`Executing ${operation.type} operation on ${operation.items?.length || 0} items`
		);

		switch (operation.type) {
			case "create":
				return this.executeCreate(operation.items, operation.options);

			case "convert":
				return this.executeConvert(operation.items, operation.options);

			case "reschedule":
				return this.updateEngine.reschedule(
					operation.items,
					operation.options as BulkRescheduleOptions
				);

			case "update":
				return this.updateEngine.updateProperty(
					operation.items,
					operation.options as BulkUpdateOptions
				);

			case "archive":
				return this.updateEngine.archive(operation.items, true);

			case "delete":
				return this.updateEngine.delete(operation.items);

			case "complete":
				return this.updateEngine.complete(operation.items);

			default:
				const result = createEmptyResult("update");
				result.errors.push(`Unknown operation type: ${(operation as any).type}`);
				return result;
		}
	}

	/**
	 * Pre-check an operation before execution.
	 *
	 * Returns information about what will happen without making changes.
	 * Useful for showing user a preview before confirming.
	 *
	 * @param operation - The bulk operation to check
	 * @returns Pre-check result with counts and warnings
	 */
	async preCheck(operation: BulkOperation): Promise<BulkPreCheckResult> {
		const result: BulkPreCheckResult = {
			willProcess: 0,
			willSkip: 0,
			skipReasons: [],
			warnings: [],
			canProceed: true,
		};

		if (!operation.items || operation.items.length === 0) {
			result.canProceed = false;
			result.warnings.push("No items to process");
			return result;
		}

		switch (operation.type) {
			case "create":
				return this.preCheckCreate(operation.items, operation.options);

			case "convert":
				return this.preCheckConvert(operation.items, operation.options);

			case "reschedule":
			case "update":
			case "archive":
			case "complete":
			case "delete":
				return this.preCheckUpdate(operation.items, operation.type);

			default:
				result.canProceed = false;
				result.warnings.push(`Unknown operation type`);
				return result;
		}
	}

	/**
	 * Execute create operation via BulkTaskEngine.
	 */
	private async executeCreate(
		items: any[],
		options: BulkCreationOptions
	): Promise<BulkOperationResult> {
		const result = await this.taskEngine.createTasks(items, options);
		return fromCreationResult(result);
	}

	/**
	 * Execute convert operation via BulkConvertEngine.
	 */
	private async executeConvert(
		items: any[],
		options: BulkConvertOptions
	): Promise<BulkOperationResult> {
		const result = await this.convertEngine.convertNotes(items, options);
		return fromConvertResult(result);
	}

	/**
	 * Pre-check create operation.
	 */
	private async preCheckCreate(
		items: any[],
		options: BulkCreationOptions
	): Promise<BulkPreCheckResult> {
		const preCheck = await this.taskEngine.preCheck(items, options.skipExisting);

		return {
			willProcess: preCheck.toCreate,
			willSkip: preCheck.toSkip,
			skipReasons: preCheck.toSkip > 0
				? [`${preCheck.toSkip} items already have linked tasks`]
				: [],
			warnings: [],
			canProceed: preCheck.toCreate > 0,
		};
	}

	/**
	 * Pre-check convert operation.
	 */
	private async preCheckConvert(
		items: any[],
		options: BulkConvertOptions
	): Promise<BulkPreCheckResult> {
		const preCheck = await this.convertEngine.preCheck(items);

		const skipReasons: string[] = [];
		if (preCheck.alreadyTasks > 0) {
			skipReasons.push(`${preCheck.alreadyTasks} items are already tasks`);
		}
		if (preCheck.nonMarkdown > 0) {
			skipReasons.push(`${preCheck.nonMarkdown} non-markdown files will be skipped`);
		}

		const warnings: string[] = [];
		const skipPercent = (preCheck.alreadyTasks + preCheck.nonMarkdown) / items.length;
		if (skipPercent > 0.25) {
			warnings.push(`Over 25% of items will be skipped`);
		}

		return {
			willProcess: preCheck.toConvert,
			willSkip: preCheck.alreadyTasks + preCheck.nonMarkdown,
			skipReasons,
			warnings,
			canProceed: preCheck.toConvert > 0,
		};
	}

	/**
	 * Pre-check update operations (reschedule, update, archive, complete, delete).
	 */
	private async preCheckUpdate(
		items: BulkItem[],
		operationType: string
	): Promise<BulkPreCheckResult> {
		let willProcess = 0;
		let willSkip = 0;
		const skipReasons: string[] = [];

		// Count base notifications vs tasknotes
		const baseNotifications = items.filter(i => i.itemType === "base-notification");
		const taskNotes = items.filter(i => i.itemType !== "base-notification");

		willProcess = taskNotes.length;
		willSkip = baseNotifications.length;

		if (baseNotifications.length > 0) {
			skipReasons.push(
				`${baseNotifications.length} base notification items cannot be ${operationType}d`
			);
		}

		return {
			willProcess,
			willSkip,
			skipReasons,
			warnings: [],
			canProceed: willProcess > 0,
		};
	}

	// =========================================================================
	// Convenience methods for common operations
	// =========================================================================

	/**
	 * Reschedule multiple tasks to a new due date.
	 *
	 * Convenience wrapper around execute({ type: 'reschedule', ... })
	 */
	async reschedule(
		items: BulkItem[],
		options: BulkRescheduleOptions
	): Promise<BulkOperationResult> {
		return this.execute({ type: "reschedule", items, options });
	}

	/**
	 * Update a property on multiple tasks.
	 *
	 * Convenience wrapper around execute({ type: 'update', ... })
	 */
	async updateProperty(
		items: BulkItem[],
		property: string,
		value: any,
		onProgress?: ProgressCallback
	): Promise<BulkOperationResult> {
		return this.execute({
			type: "update",
			items,
			options: { property, value, onProgress },
		});
	}

	/**
	 * Archive multiple tasks.
	 */
	async archive(items: BulkItem[]): Promise<BulkOperationResult> {
		return this.execute({ type: "archive", items });
	}

	/**
	 * Complete multiple tasks.
	 */
	async complete(items: BulkItem[]): Promise<BulkOperationResult> {
		return this.execute({ type: "complete", items });
	}

	/**
	 * Delete multiple tasks.
	 */
	async deleteItems(items: BulkItem[]): Promise<BulkOperationResult> {
		return this.execute({ type: "delete", items });
	}
}
