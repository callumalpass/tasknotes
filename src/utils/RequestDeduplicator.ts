/**
 * Request Deduplicator
 *
 * Prevents duplicate concurrent requests for the same data by
 * maintaining a cache of in-flight requests and returning
 * the same promise for identical requests.
 */
export class RequestDeduplicator {
	private inFlightRequests = new Map<string, Promise<any>>();
	private prefetchQueue = new Set<string>();
	private prefetchPromises = new Map<string, Promise<any>>();
	private activeTimeouts = new Set<number>();

	/**
	 * Execute a request, deduplicating concurrent calls
	 */
	async execute<T>(key: string, requestFn: () => Promise<T>, ttl = 5000): Promise<T> {
		// Check if request is already in flight
		if (this.inFlightRequests.has(key)) {
			return this.inFlightRequests.get(key) as Promise<T>;
		}

		// Create new request
		const requestPromise = this.createRequest(key, requestFn, ttl);
		this.inFlightRequests.set(key, requestPromise);

		return requestPromise;
	}

	/**
	 * Create and manage a request with cleanup
	 */
	private async createRequest<T>(
		key: string,
		requestFn: () => Promise<T>,
		ttl: number
	): Promise<T> {
		try {
			const result = await requestFn();

			// Schedule cleanup after TTL
			const timeout = setTimeout(() => {
				this.inFlightRequests.delete(key);
				this.activeTimeouts.delete(timeout as unknown as number);
			}, ttl);
			this.activeTimeouts.add(timeout as unknown as number);

			return result;
		} catch (error) {
			// Remove failed request immediately
			this.inFlightRequests.delete(key);
			throw error;
		}
	}

	/**
	 * Prefetch data that might be needed soon
	 */
	prefetch<T>(key: string, requestFn: () => Promise<T>, priority: "high" | "low" = "low"): void {
		// Don't prefetch if already in flight or completed recently
		if (this.inFlightRequests.has(key) || this.prefetchPromises.has(key)) {
			return;
		}

		if (priority === "high") {
			// Execute immediately for high priority
			this.executePrefetch(key, requestFn);
		} else {
			// Queue for next idle period
			this.prefetchQueue.add(key);

			// Process queue when browser is idle
			if ("requestIdleCallback" in window) {
				requestIdleCallback(() => {
					this.processPrefetchQueue(key, requestFn);
				});
			} else {
				// Fallback for browsers without requestIdleCallback
				const timeout = setTimeout(() => {
					this.processPrefetchQueue(key, requestFn);
					this.activeTimeouts.delete(timeout as unknown as number);
				}, 50);
				this.activeTimeouts.add(timeout as unknown as number);
			}
		}
	}

	/**
	 * Execute prefetch request
	 */
	private async executePrefetch<T>(key: string, requestFn: () => Promise<T>): Promise<void> {
		try {
			const prefetchPromise = requestFn();
			this.prefetchPromises.set(key, prefetchPromise);

			await prefetchPromise;

			// Keep prefetch result available for a short time
			const timeout = setTimeout(() => {
				this.prefetchPromises.delete(key);
				this.activeTimeouts.delete(timeout as unknown as number);
			}, 30000); // 30 seconds
			this.activeTimeouts.add(timeout as unknown as number);
		} catch (error) {
			// Ignore prefetch errors
			this.prefetchPromises.delete(key);
		}
	}

	/**
	 * Process prefetch queue during idle time
	 */
	private processPrefetchQueue<T>(key: string, requestFn: () => Promise<T>): void {
		if (this.prefetchQueue.has(key)) {
			this.prefetchQueue.delete(key);
			this.executePrefetch(key, requestFn);
		}
	}

	/**
	 * Check if data is available from prefetch
	 */
	getPrefetchedData<T>(key: string): Promise<T> | null {
		return this.prefetchPromises.get(key) || null;
	}

	/**
	 * Cancel in-flight request
	 */
	cancel(key: string): void {
		this.inFlightRequests.delete(key);
		this.prefetchPromises.delete(key);
		this.prefetchQueue.delete(key);
	}

	/**
	 * Cancel all requests
	 */
	cancelAll(): void {
		this.inFlightRequests.clear();
		this.prefetchPromises.clear();
		this.prefetchQueue.clear();

		// Clear all active timeouts
		for (const timeout of this.activeTimeouts) {
			clearTimeout(timeout);
		}
		this.activeTimeouts.clear();
	}

	/**
	 * Get stats about current requests
	 */
	getStats(): {
		inFlightCount: number;
		prefetchCount: number;
		queuedCount: number;
	} {
		return {
			inFlightCount: this.inFlightRequests.size,
			prefetchCount: this.prefetchPromises.size,
			queuedCount: this.prefetchQueue.size,
		};
	}
}

/**
 * Predictive prefetcher for calendar and date-based data
 */
export class PredictivePrefetcher {
	private deduplicator: RequestDeduplicator;
	private lastAccessTime = new Map<string, number>();

	constructor(deduplicator: RequestDeduplicator) {
		this.deduplicator = deduplicator;
	}

	/**
	 * Record access to date-based data and prefetch adjacent dates
	 */
	recordAccess(
		date: Date,
		dataType: "tasks" | "notes" | "calendar",
		requestFn: (date: Date) => Promise<any>
	): void {
		const dateKey = this.getDateKey(date);
		this.lastAccessTime.set(dateKey, Date.now());

		// Prefetch adjacent dates
		this.prefetchAdjacentDates(date, dataType, requestFn);
	}

	/**
	 * Prefetch data for dates adjacent to the current date
	 */
	private prefetchAdjacentDates(
		currentDate: Date,
		dataType: string,
		requestFn: (date: Date) => Promise<any>
	): void {
		const adjacentDates = this.getAdjacentDates(currentDate);

		adjacentDates.forEach(({ date, priority }) => {
			const key = `${dataType}-${this.getDateKey(date)}`;

			this.deduplicator.prefetch(key, () => requestFn(date), priority);
		});
	}

	/**
	 * Get adjacent dates for prefetching
	 */
	private getAdjacentDates(date: Date): Array<{ date: Date; priority: "high" | "low" }> {
		const result: Array<{ date: Date; priority: "high" | "low" }> = [];

		// Yesterday and tomorrow (high priority)
		const yesterday = new Date(date);
		yesterday.setDate(date.getDate() - 1);
		result.push({ date: yesterday, priority: "high" });

		const tomorrow = new Date(date);
		tomorrow.setDate(date.getDate() + 1);
		result.push({ date: tomorrow, priority: "high" });

		// ±2-7 days (low priority)
		for (let offset = 2; offset <= 7; offset++) {
			const pastDate = new Date(date);
			pastDate.setDate(date.getDate() - offset);
			result.push({ date: pastDate, priority: "low" });

			const futureDate = new Date(date);
			futureDate.setDate(date.getDate() + offset);
			result.push({ date: futureDate, priority: "low" });
		}

		return result;
	}

	/**
	 * Get cache key for a date
	 */
	private getDateKey(date: Date): string {
		return date.toISOString().split("T")[0];
	}

	/**
	 * Clean up old access records
	 */
	cleanup(): void {
		const now = Date.now();
		const maxAge = 24 * 60 * 60 * 1000; // 24 hours

		for (const [key, time] of this.lastAccessTime) {
			if (now - time > maxAge) {
				this.lastAccessTime.delete(key);
			}
		}
	}
}
