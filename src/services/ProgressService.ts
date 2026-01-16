import { TaskInfo, ProgressInfo } from "../types";

/**
 * Service for calculating task progress based on top-level checkboxes in task body
 */
export class ProgressService {
	private cache: Map<string, ProgressInfo> = new Map();

	/**
	 * Calculate progress for a task based on top-level checkboxes in the task body
	 * Only counts checkboxes with no indentation (first level)
	 *
	 * @param task - The task to calculate progress for
	 * @returns ProgressInfo with completed count, total count, and percentage
	 */
	calculateProgress(task: TaskInfo): ProgressInfo | null {
		// Validate input
		if (!task || !task.path) {
			return null;
		}

		// If no details/content, return null (no progress to show)
		if (!task.details || task.details.trim().length === 0) {
			return null;
		}

		// Create cache key based on task path and details hash
		const cacheKey = `${task.path}:${this.hashString(task.details)}`;

		// Check cache first
		if (this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey)!;
		}

		// Parse checkboxes from task body
		const lines = task.details.split("\n");
		let total = 0;
		let completed = 0;

		for (const line of lines) {
			// Check if this is a checkbox line (first-level only)
			const checkboxMatch = line.match(/^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\]\s+)(.*)/);
			if (checkboxMatch) {
				// Check indentation - only count if indentation is 0 (first level)
				const indentation = line.match(/^(\s*)/)?.[1]?.length || 0;
				if (indentation === 0) {
					total++;
					const checkState = checkboxMatch[2];
					if (checkState.toLowerCase() === "x") {
						completed++;
					}
				}
			}
		}

		// If no checkboxes found, return null (no progress to show)
		if (total === 0) {
			return null;
		}

		// Calculate percentage
		const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

		const progressInfo: ProgressInfo = {
			completed,
			total,
			percentage,
		};

		// Cache the result
		this.cache.set(cacheKey, progressInfo);

		return progressInfo;
	}

	/**
	 * Simple hash function for string caching
	 * @param str - String to hash
	 * @returns Hash string
	 */
	private hashString(str: string): string {
		if (!str || str.length === 0) {
			return "0";
		}
		let hash = 0;
		// Limit hash calculation for very long strings to prevent performance issues
		const maxLength = 10000;
		const strToHash = str.length > maxLength ? str.substring(0, maxLength) : str;
		for (let i = 0; i < strToHash.length; i++) {
			const char = strToHash.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash | 0; // Convert to 32-bit integer
		}
		return hash.toString(36);
	}

	/**
	 * Clear the progress cache
	 * Useful when task details change
	 */
	clearCache(): void {
		this.cache.clear();
	}

	/**
	 * Clear cache entry for a specific task
	 * @param taskPath - Path of the task to clear from cache
	 */
	clearCacheForTask(taskPath: string): void {
		const keysToDelete: string[] = [];
		for (const key of this.cache.keys()) {
			if (key.startsWith(`${taskPath}:`)) {
				keysToDelete.push(key);
			}
		}
		for (const key of keysToDelete) {
			this.cache.delete(key);
		}
	}
}
