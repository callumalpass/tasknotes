/**
 * Shared types for bulk operations.
 *
 * All bulk operation implementations (BulkTaskEngine, BulkConvertEngine,
 * BulkRescheduleModal, BatchContextMenu) should return BulkOperationResult
 * for consistent result handling.
 */

/**
 * Unified result type for all bulk operations.
 * Provides consistent structure for UI to display results.
 */
export interface BulkOperationResult {
	/** Type of operation performed */
	operationType:
		| "create"
		| "convert"
		| "reschedule"
		| "update"
		| "archive"
		| "delete"
		| "complete";

	/** Number of items successfully processed */
	succeeded: number;

	/** Number of items skipped (already exists, not applicable, etc.) */
	skipped: number;

	/** Number of items that failed */
	failed: number;

	/** Error messages for debugging */
	errors: string[];

	/** Paths of files that were modified (for UI refresh) */
	affectedPaths: string[];
}

/**
 * Creates a new empty result object.
 */
export function createEmptyResult(
	operationType: BulkOperationResult["operationType"]
): BulkOperationResult {
	return {
		operationType,
		succeeded: 0,
		skipped: 0,
		failed: 0,
		errors: [],
		affectedPaths: [],
	};
}

/**
 * Merges multiple results into one.
 * Useful when combining results from parallel operations.
 */
export function mergeResults(
	results: BulkOperationResult[]
): BulkOperationResult {
	if (results.length === 0) {
		return createEmptyResult("update");
	}

	const merged: BulkOperationResult = {
		operationType: results[0].operationType,
		succeeded: 0,
		skipped: 0,
		failed: 0,
		errors: [],
		affectedPaths: [],
	};

	for (const result of results) {
		merged.succeeded += result.succeeded;
		merged.skipped += result.skipped;
		merged.failed += result.failed;
		merged.errors.push(...result.errors);
		merged.affectedPaths.push(...result.affectedPaths);
	}

	// Deduplicate paths
	merged.affectedPaths = [...new Set(merged.affectedPaths)];

	return merged;
}

/**
 * Formats a result for display in a Notice.
 */
export function formatResultNotice(result: BulkOperationResult): string {
	const parts: string[] = [];

	if (result.succeeded > 0) {
		parts.push(`${result.succeeded} succeeded`);
	}
	if (result.skipped > 0) {
		parts.push(`${result.skipped} skipped`);
	}
	if (result.failed > 0) {
		parts.push(`${result.failed} failed`);
	}

	if (parts.length === 0) {
		return "No items processed";
	}

	return parts.join(", ");
}

/**
 * Convert BulkCreationResult to unified BulkOperationResult.
 */
export function fromCreationResult(result: {
	created: number;
	skipped: number;
	failed: number;
	errors: string[];
	createdPaths: string[];
}): BulkOperationResult {
	return {
		operationType: "create",
		succeeded: result.created,
		skipped: result.skipped,
		failed: result.failed,
		errors: result.errors,
		affectedPaths: result.createdPaths,
	};
}

/**
 * Convert BulkConvertResult to unified BulkOperationResult.
 */
export function fromConvertResult(result: {
	converted: number;
	skipped: number;
	failed: number;
	errors: string[];
	convertedPaths: string[];
}): BulkOperationResult {
	return {
		operationType: "convert",
		succeeded: result.converted,
		skipped: result.skipped,
		failed: result.failed,
		errors: result.errors,
		affectedPaths: result.convertedPaths,
	};
}

// ============================================================================
// Unified Bulk Engine Types (Phase 1+2)
// ============================================================================

/**
 * Progress callback signature for all bulk operations.
 */
export type ProgressCallback = (
	current: number,
	total: number,
	status: string
) => void;

/**
 * Default values that can be applied to bulk-created/converted tasks.
 */
export interface BulkDefaults {
	status?: string;
	priority?: string;
	dueDate?: string;
	scheduledDate?: string;
	contexts?: string[];
	tags?: string[];
	assignee?: string;
	reminders?: any[]; // Reminder type from TaskInfo
	timeEstimate?: number;
	customFields?: Record<string, any>;
}

/**
 * Options for bulk update operations (reschedule, status change, etc.)
 */
export interface BulkUpdateOptions {
	/** Property to update */
	property: string;
	/** New value for the property */
	value: any;
	/** Progress callback */
	onProgress?: ProgressCallback;
}

/**
 * Options specific to bulk reschedule operations.
 */
export interface BulkRescheduleOptions {
	/** New due date (YYYY-MM-DD or YYYY-MM-DDTHH:mm) */
	newDueDate?: string;
	/** New scheduled date (YYYY-MM-DDTHH:mm) */
	newScheduledDate?: string;
	/** Whether to clear time component */
	clearTime?: boolean;
	/** Progress callback */
	onProgress?: ProgressCallback;
}

/**
 * Item types that bulk operations can handle.
 */
export type BulkItemType = "tasknote" | "base-notification" | "generic";

/**
 * A generic item that can be processed by bulk operations.
 */
export interface BulkItem {
	/** File path */
	path: string;
	/** Item type for operation routing */
	itemType: BulkItemType;
	/** Title for display */
	title?: string;
	/** Current due date (for reschedule preview) */
	dueDate?: string;
	/** Source base file (for base notifications) */
	sourceBase?: string;
}

/**
 * Union type for all bulk operations.
 */
export type BulkOperation =
	| { type: "create"; items: any[]; options: any }
	| { type: "convert"; items: any[]; options: any }
	| { type: "update"; items: BulkItem[]; options: BulkUpdateOptions }
	| { type: "reschedule"; items: BulkItem[]; options: BulkRescheduleOptions }
	| { type: "archive"; items: BulkItem[] }
	| { type: "delete"; items: BulkItem[] }
	| { type: "complete"; items: BulkItem[] };

/**
 * Pre-check result before executing a bulk operation.
 */
export interface BulkPreCheckResult {
	/** Number of items that will be processed */
	willProcess: number;
	/** Number of items that will be skipped */
	willSkip: number;
	/** Reasons for skipping (for UI display) */
	skipReasons: string[];
	/** Warnings to show user */
	warnings: string[];
	/** Whether operation can proceed */
	canProceed: boolean;
}

/**
 * Convert BulkUpdateResult to unified BulkOperationResult.
 */
export function fromUpdateResult(result: {
	updated: number;
	skipped: number;
	failed: number;
	errors: string[];
	updatedPaths: string[];
}, operationType: BulkOperationResult["operationType"] = "update"): BulkOperationResult {
	return {
		operationType,
		succeeded: result.updated,
		skipped: result.skipped,
		failed: result.failed,
		errors: result.errors,
		affectedPaths: result.updatedPaths,
	};
}
