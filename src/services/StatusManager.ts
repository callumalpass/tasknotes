import { StatusConfig } from "../types";

/**
 * Service for managing custom task statuses
 */
export class StatusManager {
	constructor(private statuses: StatusConfig[]) {}

	/**
	 * Get next status in cycle from current status
	 */
	getNextStatus(currentStatus: string): string {
		const sortedStatuses = this.getStatusesByOrder();
		const currentIndex = sortedStatuses.findIndex((s) => s.value === currentStatus);

		if (currentIndex === -1) {
			// Current status not found, return first status
			return sortedStatuses[0]?.value || "open";
		}

		// Get next status, cycling to first if at end
		const nextIndex = (currentIndex + 1) % sortedStatuses.length;
		return sortedStatuses[nextIndex].value;
	}

	/**
	 * Get previous status in cycle from current status (reverse cycling)
	 */
	getPreviousStatus(currentStatus: string): string {
		const sortedStatuses = this.getStatusesByOrder();
		const currentIndex = sortedStatuses.findIndex((s) => s.value === currentStatus);

		if (currentIndex === -1) {
			// Current status not found, return last status
			return sortedStatuses[sortedStatuses.length - 1]?.value || "open";
		}

		// Get previous status, cycling to last if at beginning
		const prevIndex = (currentIndex - 1 + sortedStatuses.length) % sortedStatuses.length;
		return sortedStatuses[prevIndex].value;
	}

	/**
	 * Get status configuration by value
	 */
	getStatusConfig(value: string): StatusConfig | undefined {
		return this.statuses.find((s) => s.value === value);
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
			cssRules.push(`${cssClass}: ${status.color};`);
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
			if (!status.color || !status.color.match(/^#[0-9a-fA-F]{6}$/)) {
				errors.push("Status colors must be valid hex colors (#rrggbb)");
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
			order,
			autoArchive: false,
			autoArchiveDelay: 5,
		};
	}
}
