/**
 * Bulk operations module.
 *
 * Exports engines for bulk task creation, conversion, and updates,
 * plus unified result types and the main BulkOperationEngine.
 *
 * Architecture:
 * - BulkOperationEngine - Unified entry point (use this for new code)
 * - BulkTaskEngine - Create new task files
 * - BulkConvertEngine - Convert notes to tasks in-place
 * - BulkUpdateEngine - Update/reschedule/archive/complete/delete
 */

// Unified operation engine (preferred entry point)
export { BulkOperationEngine } from "./BulkOperationEngine";

// Specialized engines (for direct use if needed)
export { BulkTaskEngine } from "./bulk-task-engine";
export type { BulkCreationOptions, BulkCreationResult } from "./bulk-task-engine";

export { BulkConvertEngine } from "./bulk-convert-engine";
export type {
	BulkConvertOptions,
	BulkConvertResult,
	ConvertPreCheckResult,
} from "./bulk-convert-engine";

export { BulkUpdateEngine } from "./bulk-update-engine";
export type { BulkUpdateResult } from "./bulk-update-engine";

// Duplicate detection
export { DuplicateDetector } from "./duplicate-detector";
export type { DuplicateCheckResult } from "./duplicate-detector";

// Unified types
export type {
	BulkOperationResult,
	BulkOperation,
	BulkItem,
	BulkItemType,
	BulkDefaults,
	BulkUpdateOptions,
	BulkRescheduleOptions,
	BulkPreCheckResult,
	ProgressCallback,
} from "./types";

export {
	createEmptyResult,
	mergeResults,
	formatResultNotice,
	fromCreationResult,
	fromConvertResult,
	fromUpdateResult,
} from "./types";
