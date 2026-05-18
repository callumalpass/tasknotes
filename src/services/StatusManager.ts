import { StatusConfig } from "../types";
import { normalizeStatusConfigValue } from "../core/fieldMapping";
import { isSupportedColorValue, normalizeThemeColor } from "../utils/themeColors";

/**
 * Service for managing custom task statuses
 */
export class StatusManager {
	constructor(private statuses: StatusConfig[], private defaultStatus = "open") {}

	normalizeStatusValue(value: unknown): string {
		return normalizeStatusConfigValue(value, this.statuses) ?? String(value);
	}

	private findStatusIndex(statuses: StatusConfig[], statusValue: string): number {
		const normalizedValue = this.normalizeStatusValue(statusValue);
		return statuses.findIndex(
			(status) => this.normalizeStatusValue(status.value) === normalizedValue
		);
	}

	private getCycleStatuses(): StatusConfig[] {
		return this.getStatusesByOrder().filter((status) => !status.excludeFromCycle);
	}

	/**
	 * Get next status in cycle from current status
	 */
	getNextStatus(currentStatus: string): string {
		const currentStatusConfig = this.getStatusConfig(currentStatus);
		const normalizedCurrentStatus = currentStatusConfig
			? this.normalizeStatusValue(currentStatusConfig.value)
			: undefined;
		const normalizedConfiguredNextStatus = currentStatusConfig?.nextStatus
			? this.normalizeStatusValue(currentStatusConfig.nextStatus)
			: undefined;
		const configuredNextStatus =
			normalizedConfiguredNextStatus &&
			normalizedConfiguredNextStatus !== normalizedCurrentStatus
				? this.getStatusConfig(normalizedConfiguredNextStatus)
				: undefined;
		if (configuredNextStatus) {
			return configuredNextStatus.value;
		}

		const cycleStatuses = this.getCycleStatuses();
		const currentIndex = this.findStatusIndex(cycleStatuses, currentStatus);

		if (cycleStatuses.length === 0) {
			return currentStatusConfig?.value || this.defaultStatus;
		}

		if (currentIndex !== -1) {
			// Get next status, cycling to first if at end
			const nextIndex = (currentIndex + 1) % cycleStatuses.length;
			return cycleStatuses[nextIndex].value;
		}

		if (!currentStatusConfig) {
			// Current status not found, return first cycleable status
			return cycleStatuses[0]?.value || this.defaultStatus;
		}

		return (
			cycleStatuses.find((status) => status.order > currentStatusConfig.order)?.value ||
			cycleStatuses[0].value
		);
	}

	/**
	 * Get previous status in cycle from current status (reverse cycling)
	 */
	getPreviousStatus(currentStatus: string): string {
		const cycleStatuses = this.getCycleStatuses();
		const currentIndex = this.findStatusIndex(cycleStatuses, currentStatus);

		if (cycleStatuses.length === 0) {
			return this.getStatusConfig(currentStatus)?.value || this.defaultStatus;
		}

		if (currentIndex !== -1) {
			// Get previous status, cycling to last if at beginning
			const prevIndex = (currentIndex - 1 + cycleStatuses.length) % cycleStatuses.length;
			return cycleStatuses[prevIndex].value;
		}

		const currentStatusConfig = this.getStatusConfig(currentStatus);
		if (!currentStatusConfig) {
			// Current status not found, return last cycleable status
			return cycleStatuses[cycleStatuses.length - 1]?.value || this.defaultStatus;
		}

		return (
			[...cycleStatuses]
				.reverse()
				.find((status) => status.order < currentStatusConfig.order)?.value ||
			cycleStatuses[cycleStatuses.length - 1].value
		);
	}

	/**
	 * Get status configuration by value
	 */
	getStatusConfig(value: string): StatusConfig | undefined {
		const normalizedValue = this.normalizeStatusValue(value);
		return this.statuses.find(
			(s) => this.normalizeStatusValue(s.value) === normalizedValue
		);
	}

	/**
	 * Get all completed status values
	 */
	getCompletedStatuses(): string[] {
		return this.statuses.filter((s) => s.isCompleted).map((s) => s.value);
	}

	/**
	 * Get all non-completed status values
	 */
	getOpenStatuses(): string[] {
		return this.statuses.filter((s) => !s.isCompleted).map((s) => s.value);
	}

	/**
	 * Get statuses ordered by their order field
	 */
	getStatusesByOrder(): StatusConfig[] {
		return [...this.statuses].sort((a, b) => a.order - b.order);
	}

	/**
	 * Check if a status value represents a completed task
	 */
	isCompletedStatus(statusValue: string): boolean {
		const status = this.getStatusConfig(statusValue);
		return status?.isCompleted || false;
	}

	/**
	 * Get status order for sorting
	 */
	getStatusOrder(statusValue: string): number {
		const status = this.getStatusConfig(statusValue);
		return status?.order || 0;
	}

	/**
	 * Get CSS variables for status colors
	 */
	getStatusStyles(): string {
		const cssRules: string[] = [];

		for (const status of this.statuses) {
			const cssClass = `--status-${status.value.replace(/[^a-zA-Z0-9-]/g, "-")}-color`;
			cssRules.push(`${cssClass}: ${normalizeThemeColor(status.color)};`);
		}

		return `:root { ${cssRules.join(" ")} }`;
	}

	/**
	 * Get all status configurations
	 */
	getAllStatuses(): StatusConfig[] {
		return [...this.statuses];
	}

	/**
	 * Get non-completion status configurations (for recurring tasks)
	 */
	getNonCompletionStatuses(): StatusConfig[] {
		return this.statuses.filter((s) => !s.isCompleted);
	}

	/**
	 * Update status configurations
	 */
	updateStatuses(newStatuses: StatusConfig[]): void {
		this.statuses = newStatuses;
	}

	/**
	 * Validate status configuration
	 */
	static validateStatuses(statuses: StatusConfig[]): { valid: boolean; errors: string[] } {
		const errors: string[] = [];

		// Minimum 2 statuses required
		if (statuses.length < 2) {
			errors.push("At least 2 statuses are required");
		}

		// At least one completed status required
		const hasCompletedStatus = statuses.some((s) => s.isCompleted);
		if (!hasCompletedStatus) {
			errors.push("At least one status must be marked as completed");
		}

		// Check for unique status values
		const values = statuses.map((s) => s.value);
		const uniqueValues = new Set(values);
		if (values.length !== uniqueValues.size) {
			errors.push("Status values must be unique");
		}

		// Check for unique IDs
		const ids = statuses.map((s) => s.id);
		const uniqueIds = new Set(ids);
		if (ids.length !== uniqueIds.size) {
			errors.push("Status IDs must be unique");
		}

		// Check for empty values and labels
		for (const status of statuses) {
			if (!status.value || status.value.trim() === "") {
				errors.push("Status values cannot be empty");
				break;
			}
			if (!status.label || status.label.trim() === "") {
				errors.push("Status labels cannot be empty");
				break;
			}
			if (!isSupportedColorValue(status.color)) {
				errors.push("Status colors must be valid CSS colors or Obsidian theme colors");
				break;
			}
		}

		return {
			valid: errors.length === 0,
			errors,
		};
	}

	/**
	 * Generate a new unique status ID
	 */
	static generateStatusId(existingStatuses: StatusConfig[]): string {
		const existingIds = new Set(existingStatuses.map((s) => s.id));
		let counter = 1;
		let id = `status-${counter}`;

		while (existingIds.has(id)) {
			counter++;
			id = `status-${counter}`;
		}

		return id;
	}

	/**
	 * Create a new status with default values
	 */
	static createDefaultStatus(existingStatuses: StatusConfig[]): StatusConfig {
		const id = StatusManager.generateStatusId(existingStatuses);
		const order = Math.max(...existingStatuses.map((s) => s.order), 0) + 1;

		return {
			id,
			value: "new-status",
			label: "New status",
			color: "#808080",
			isCompleted: false,
			excludeFromCycle: false,
			order,
			autoArchive: false,
			autoArchiveDelay: 5,
		};
	}
}
