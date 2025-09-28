/* eslint-disable no-console */
import { Platform } from "obsidian";

/**
 * Performance Monitor
 *
 * Tracks and measures performance metrics for the TaskNotes plugin
 * to identify bottlenecks and monitor improvements.
 */
export class PerformanceMonitor {
	private static instance: PerformanceMonitor | null = null;
	private metrics = new Map<string, number[]>();
	private markers = new Map<string, number>();
	private enabled = true;
	private mutationObservers = new Set<MutationObserver>();
	private performanceObservers = new Set<PerformanceObserver>();

	static getInstance(): PerformanceMonitor {
		if (!PerformanceMonitor.instance) {
			PerformanceMonitor.instance = new PerformanceMonitor();
		}
		return PerformanceMonitor.instance;
	}

	/**
	 * Start timing an operation
	 */
	startTimer(operation: string): void {
		if (!this.enabled) return;

		this.markers.set(operation, performance.now());
	}

	/**
	 * End timing an operation and record the duration
	 */
	endTimer(operation: string): number {
		if (!this.enabled) return 0;

		const startTime = this.markers.get(operation);
		if (startTime === undefined) {
			// Don't warn for measure operations that handle their own timing
			if (!operation.includes("-measure-")) {
				console.warn(`No start marker found for operation: ${operation}`);
			}
			return 0;
		}

		const duration = performance.now() - startTime;
		this.recordMetric(operation, duration);
		this.markers.delete(operation);

		return duration;
	}

	/**
	 * Measure the duration of an async operation
	 */
	async measure<T>(operation: string, fn: () => Promise<T>): Promise<T> {
		if (!this.enabled) {
			return fn();
		}

		const startTime = performance.now();
		try {
			const result = await fn();
			return result;
		} finally {
			const duration = performance.now() - startTime;
			this.recordMetric(operation, duration);
		}
	}

	/**
	 * Measure the duration of a sync operation
	 */
	measureSync<T>(operation: string, fn: () => T): T {
		if (!this.enabled) {
			return fn();
		}

		const startTime = performance.now();
		try {
			const result = fn();
			return result;
		} finally {
			const duration = performance.now() - startTime;
			this.recordMetric(operation, duration);
		}
	}

	/**
	 * Record a metric value
	 */
	recordMetric(name: string, value: number): void {
		if (!this.enabled) return;

		if (!this.metrics.has(name)) {
			this.metrics.set(name, []);
		}

		const values = this.metrics.get(name)!;
		values.push(value);

		// Keep only the last 50 measurements to prevent memory bloat
		if (values.length > 50) {
			values.splice(0, values.length - 50);
		}
	}

	/**
	 * Get statistics for a specific metric
	 */
	getStats(name: string): {
		count: number;
		average: number;
		min: number;
		max: number;
		median: number;
		p95: number;
	} | null {
		const values = this.metrics.get(name);
		if (!values || values.length === 0) {
			return null;
		}

		const sorted = [...values].sort((a, b) => a - b);
		const count = sorted.length;
		const sum = sorted.reduce((a, b) => a + b, 0);

		return {
			count,
			average: sum / count,
			min: sorted[0],
			max: sorted[count - 1],
			median: sorted[Math.floor(count / 2)],
			p95: sorted[Math.floor(count * 0.95)],
		};
	}

	/**
	 * Get all recorded metrics
	 */
	getAllStats(): Record<string, ReturnType<PerformanceMonitor["getStats"]>> {
		const result: Record<string, ReturnType<PerformanceMonitor["getStats"]>> = {};

		for (const [name] of this.metrics) {
			result[name] = this.getStats(name);
		}

		return result;
	}

	/**
	 * Log performance summary to console
	 */
	logSummary(): void {
		if (!this.enabled) return;

		console.group("[Performance Summary]");

		const stats = this.getAllStats();
		const importantMetrics = [
			"cache-file-read",
			"task-list-render",
			"calendar-render",
			"task-update",
			"file-index",
			"dom-update",
		];

		importantMetrics.forEach((metric) => {
			const stat = stats[metric];
			if (stat) {
				console.log(`${metric}:`, {
					average: `${stat.average.toFixed(2)}ms`,
					p95: `${stat.p95.toFixed(2)}ms`,
					count: stat.count,
				});
			}
		});

		console.groupEnd();
	}

	/**
	 * Monitor DOM mutations for performance impact
	 */
	monitorDOMMutations(targetNode: Node): () => void {
		if (!this.enabled) return () => {};

		let mutationCount = 0;
		const startTime = performance.now();

		const observer = new MutationObserver((mutations) => {
			mutationCount += mutations.length;

			// Log if too many mutations in a short time
			const elapsed = performance.now() - startTime;
			if (mutationCount > 100 && elapsed < 1000) {
				console.warn(
					`High DOM mutation rate: ${mutationCount} mutations in ${elapsed.toFixed(2)}ms`
				);
			}
		});

		observer.observe(targetNode, {
			childList: true,
			subtree: true,
			attributes: true,
		});

		this.mutationObservers.add(observer);

		return () => {
			observer.disconnect();
			this.mutationObservers.delete(observer);
			this.recordMetric("dom-mutations", mutationCount);
		};
	}

	/**
	 * Monitor memory usage
	 */
	recordMemoryUsage(label?: string): void {
		if (!this.enabled || !("memory" in performance)) return;

		const memory = (performance as any).memory;
		const memoryUsage = {
			used: memory.usedJSHeapSize / 1024 / 1024, // MB
			total: memory.totalJSHeapSize / 1024 / 1024, // MB
			limit: memory.jsHeapSizeLimit / 1024 / 1024, // MB
		};

		const name = label ? `memory-${label}` : "memory-usage";
		this.recordMetric(name, memoryUsage.used);

		// Warn if memory usage is high
		if (memoryUsage.used > 100) {
			// 100MB
			console.warn(`High memory usage: ${memoryUsage.used.toFixed(2)}MB`);
		}
	}

	/**
	 * Track long tasks (blocking the main thread)
	 */
	trackLongTasks(): () => void {
		if (!this.enabled || !("PerformanceObserver" in window)) {
			return () => {};
		}

		const observer = new PerformanceObserver((list) => {
			for (const entry of list.getEntries()) {
				if (entry.duration > 50) {
					// Tasks longer than 50ms
					console.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`);
					this.recordMetric("long-task", entry.duration);
				}
			}
		});

		try {
			observer.observe({ entryTypes: ["longtask"] });
			this.performanceObservers.add(observer);
		} catch (error) {
			// Some browsers might not support longtask observation
			console.warn("Long task monitoring not supported");
		}

		return () => {
			observer.disconnect();
			this.performanceObservers.delete(observer);
		};
	}

	/**
	 * Create a performance marker for browser dev tools
	 */
	mark(name: string): void {
		if (!this.enabled) return;

		try {
			performance.mark(`tasknotes-${name}`);
		} catch (error) {
			// Ignore errors in browsers that don't support performance marks
		}
	}

	/**
	 * Measure time between two performance markers
	 */
	measureBetweenMarks(startMark: string, endMark: string, measureName: string): void {
		if (!this.enabled) return;

		try {
			performance.measure(
				`tasknotes-${measureName}`,
				`tasknotes-${startMark}`,
				`tasknotes-${endMark}`
			);
		} catch (error) {
			// Ignore errors in browsers that don't support performance measures
		}
	}

	/**
	 * Clear all recorded metrics
	 */
	clear(): void {
		this.metrics.clear();
		this.markers.clear();
	}

	/**
	 * Clean up all observers and resources
	 */
	destroy(): void {
		// Disconnect all mutation observers
		for (const observer of this.mutationObservers) {
			observer.disconnect();
		}
		this.mutationObservers.clear();

		// Disconnect all performance observers
		for (const observer of this.performanceObservers) {
			observer.disconnect();
		}
		this.performanceObservers.clear();

		// Clear all data
		this.clear();

		// Reset singleton instance
		PerformanceMonitor.instance = null;
	}

	/**
	 * Enable or disable performance monitoring
	 */
	setEnabled(enabled: boolean): void {
		this.enabled = enabled;

		if (!enabled) {
			this.clear();
		}
	}

	/**
	 * Export performance data for analysis
	 */
	exportData(): string {
		const data = {
			timestamp: new Date().toISOString(),
			stats: this.getAllStats(),
			platform: {
				isDesktop: Platform.isDesktop,
				isMobile: Platform.isMobile,
				isWin: Platform.isWin,
				isMacOS: Platform.isMacOS,
				isLinux: Platform.isLinux,
			},
			memoryInfo: "memory" in performance ? (performance as any).memory : null,
		};

		return JSON.stringify(data, null, 2);
	}
}

/**
 * Performance decorator for automatic method timing
 */
export function measurePerformance(operation: string) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const originalMethod = descriptor.value;
		const monitor = PerformanceMonitor.getInstance();

		descriptor.value = async function (...args: any[]) {
			return monitor.measure(`${operation}-${propertyKey}`, () => {
				return originalMethod.apply(this, args);
			});
		};

		return descriptor;
	};
}

/**
 * Global performance monitoring instance
 */
export const perfMonitor = PerformanceMonitor.getInstance();
