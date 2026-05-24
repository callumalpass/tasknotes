import { Platform } from "obsidian";
import { createTaskNotesLogger, TaskNotesLogger } from "./tasknotesLogger";

export type PerformanceProfilerDetails = Record<
	string,
	string | number | boolean | null | undefined
>;

export interface PerformanceProfilerMetricSnapshot {
	name: string;
	count: number;
	totalMs: number;
	averageMs: number;
	minMs: number;
	maxMs: number;
	medianMs: number;
	p95Ms: number;
	lastMs: number;
	sampleCount: number;
	lastDetails?: PerformanceProfilerDetails;
}

export interface PerformanceProfilerCounterSnapshot {
	name: string;
	count: number;
	lastDetails?: PerformanceProfilerDetails;
}

export interface PerformanceProfilerGaugeSnapshot {
	name: string;
	value: number;
	updatedAt: string;
	lastDetails?: PerformanceProfilerDetails;
}

export interface PerformanceProfilerSnapshot {
	generatedAt: string;
	enabled: boolean;
	metrics: Record<string, PerformanceProfilerMetricSnapshot>;
	counters: Record<string, PerformanceProfilerCounterSnapshot>;
	gauges: Record<string, PerformanceProfilerGaugeSnapshot>;
}

export interface PerformanceProfilerExport extends PerformanceProfilerSnapshot {
	platform: {
		isDesktop: boolean;
		isMobile: boolean;
		isWin: boolean;
		isMacOS: boolean;
		isLinux: boolean;
	};
	memoryInfo: unknown;
}

export interface PerformanceProfilerOptions {
	namespace?: string;
	isEnabled?: () => boolean;
	logger?: TaskNotesLogger;
	now?: () => number;
	sampleLimit?: number;
	slowThresholdMs?: number;
}

export interface PerformanceProfilerSpan {
	end(details?: PerformanceProfilerDetails): number;
}

interface MetricAggregate {
	count: number;
	totalMs: number;
	minMs: number;
	maxMs: number;
	lastMs: number;
	samples: number[];
	lastDetails?: PerformanceProfilerDetails;
}

interface CounterAggregate {
	count: number;
	lastDetails?: PerformanceProfilerDetails;
}

interface GaugeAggregate {
	value: number;
	updatedAt: string;
	lastDetails?: PerformanceProfilerDetails;
}

type PerformanceWithMemory = Performance & {
	memory?: {
		usedJSHeapSize: number;
		totalJSHeapSize: number;
		jsHeapSizeLimit: number;
	};
};

const DEFAULT_SAMPLE_LIMIT = 200;
const DEFAULT_SLOW_THRESHOLD_MS = 250;

const defaultLogger = createTaskNotesLogger({ tag: "Utils/PerformanceProfiler" });

function defaultNow(): number {
	if (typeof performance !== "undefined" && typeof performance.now === "function") {
		return performance.now();
	}
	return Date.now();
}

function hasMemoryInfo(): boolean {
	return typeof performance !== "undefined" && "memory" in performance;
}

function percentile(sortedValues: number[], percentileValue: number): number {
	if (sortedValues.length === 0) {
		return 0;
	}

	const index = Math.min(
		sortedValues.length - 1,
		Math.max(0, Math.ceil(sortedValues.length * percentileValue) - 1)
	);
	return sortedValues[index];
}

function roundDuration(value: number): number {
	return Math.round(value * 1000) / 1000;
}

function mergeDetails(
	first?: PerformanceProfilerDetails,
	second?: PerformanceProfilerDetails
): PerformanceProfilerDetails | undefined {
	if (!first && !second) {
		return undefined;
	}

	return {
		...(first || {}),
		...(second || {}),
	};
}

export class TaskNotesPerformanceProfiler {
	private namespace: string;
	private isEnabledCallback: () => boolean;
	private logger: TaskNotesLogger;
	private now: () => number;
	private sampleLimit: number;
	private slowThresholdMs: number;
	private enabledOverride: boolean | null = null;
	private metrics = new Map<string, MetricAggregate>();
	private counters = new Map<string, CounterAggregate>();
	private gauges = new Map<string, GaugeAggregate>();

	constructor(options: PerformanceProfilerOptions = {}) {
		this.namespace = options.namespace?.trim() || "tasknotes";
		this.isEnabledCallback = options.isEnabled || (() => false);
		this.logger = options.logger || defaultLogger;
		this.now = options.now || defaultNow;
		this.sampleLimit = Math.max(1, options.sampleLimit || DEFAULT_SAMPLE_LIMIT);
		this.slowThresholdMs = Math.max(0, options.slowThresholdMs ?? DEFAULT_SLOW_THRESHOLD_MS);
	}

	isEnabled(): boolean {
		return this.enabledOverride ?? this.isEnabledCallback();
	}

	enable(): void {
		this.enabledOverride = true;
	}

	disable(): void {
		this.enabledOverride = false;
	}

	clearEnabledOverride(): void {
		this.enabledOverride = null;
	}

	child(namespace: string): TaskNotesPerformanceProfiler {
		return new TaskNotesPerformanceProfiler({
			namespace: [this.namespace, namespace].filter(Boolean).join("."),
			isEnabled: () => this.isEnabled(),
			logger: this.logger,
			now: this.now,
			sampleLimit: this.sampleLimit,
			slowThresholdMs: this.slowThresholdMs,
		});
	}

	start(name: string, details?: PerformanceProfilerDetails): PerformanceProfilerSpan {
		if (!this.isEnabled()) {
			return { end: () => 0 };
		}

		const startedAt = this.now();
		let ended = false;

		return {
			end: (endDetails?: PerformanceProfilerDetails): number => {
				if (ended) {
					return 0;
				}

				ended = true;
				const durationMs = this.now() - startedAt;
				this.recordDuration(name, durationMs, mergeDetails(details, endDetails));
				return durationMs;
			},
		};
	}

	async measureAsync<T>(
		name: string,
		fn: () => Promise<T>,
		details?: PerformanceProfilerDetails
	): Promise<T> {
		if (!this.isEnabled()) {
			return fn();
		}

		const span = this.start(name, details);
		try {
			const result = await fn();
			span.end();
			return result;
		} catch (error) {
			span.end({ failed: true });
			throw error;
		}
	}

	measureSync<T>(
		name: string,
		fn: () => T,
		details?: PerformanceProfilerDetails
	): T {
		if (!this.isEnabled()) {
			return fn();
		}

		const span = this.start(name, details);
		try {
			const result = fn();
			span.end();
			return result;
		} catch (error) {
			span.end({ failed: true });
			throw error;
		}
	}

	recordDuration(
		name: string,
		durationMs: number,
		details?: PerformanceProfilerDetails
	): void {
		if (!this.isEnabled()) {
			return;
		}

		const metricName = this.getMetricName(name);
		const existing = this.metrics.get(metricName);
		const metric =
			existing ||
			{
				count: 0,
				totalMs: 0,
				minMs: Number.POSITIVE_INFINITY,
				maxMs: 0,
				lastMs: 0,
				samples: [],
			};

		metric.count++;
		metric.totalMs += durationMs;
		metric.minMs = Math.min(metric.minMs, durationMs);
		metric.maxMs = Math.max(metric.maxMs, durationMs);
		metric.lastMs = durationMs;
		metric.lastDetails = details;
		metric.samples.push(durationMs);
		if (metric.samples.length > this.sampleLimit) {
			metric.samples.splice(0, metric.samples.length - this.sampleLimit);
		}

		this.metrics.set(metricName, metric);

		if (durationMs >= this.slowThresholdMs) {
			this.logger.warn("Slow operation recorded", {
				category: "internal",
				operation: "performance-profiler",
				details: {
					name: metricName,
					durationMs: roundDuration(durationMs),
					...(details || {}),
				},
			});
		}
	}

	increment(
		name: string,
		amount = 1,
		details?: PerformanceProfilerDetails
	): void {
		if (!this.isEnabled()) {
			return;
		}

		const counterName = this.getMetricName(name);
		const counter = this.counters.get(counterName) || { count: 0 };
		counter.count += amount;
		counter.lastDetails = details;
		this.counters.set(counterName, counter);
	}

	recordGauge(
		name: string,
		value: number,
		details?: PerformanceProfilerDetails
	): void {
		if (!this.isEnabled()) {
			return;
		}

		this.gauges.set(this.getMetricName(name), {
			value,
			updatedAt: new Date().toISOString(),
			lastDetails: details,
		});
	}

	getMetric(name: string): PerformanceProfilerMetricSnapshot | null {
		const metric = this.metrics.get(this.getMetricName(name));
		if (!metric) {
			return null;
		}

		return this.toMetricSnapshot(this.getMetricName(name), metric);
	}

	snapshot(): PerformanceProfilerSnapshot {
		const metrics: Record<string, PerformanceProfilerMetricSnapshot> = {};
		const counters: Record<string, PerformanceProfilerCounterSnapshot> = {};
		const gauges: Record<string, PerformanceProfilerGaugeSnapshot> = {};

		for (const [name, metric] of this.metrics) {
			metrics[name] = this.toMetricSnapshot(name, metric);
		}
		for (const [name, counter] of this.counters) {
			counters[name] = {
				name,
				count: counter.count,
				lastDetails: counter.lastDetails,
			};
		}
		for (const [name, gauge] of this.gauges) {
			gauges[name] = {
				name,
				value: gauge.value,
				updatedAt: gauge.updatedAt,
				lastDetails: gauge.lastDetails,
			};
		}

		return {
			generatedAt: new Date().toISOString(),
			enabled: this.isEnabled(),
			metrics,
			counters,
			gauges,
		};
	}

	exportData(): PerformanceProfilerExport {
		return {
			...this.snapshot(),
			platform: {
				isDesktop: Platform.isDesktop,
				isMobile: Platform.isMobile,
				isWin: Platform.isWin,
				isMacOS: Platform.isMacOS,
				isLinux: Platform.isLinux,
			},
			memoryInfo: hasMemoryInfo() ? (performance as PerformanceWithMemory).memory : null,
		};
	}

	reset(name?: string): void {
		if (!name) {
			this.metrics.clear();
			this.counters.clear();
			this.gauges.clear();
			return;
		}

		const metricName = this.getMetricName(name);
		this.metrics.delete(metricName);
		this.counters.delete(metricName);
		this.gauges.delete(metricName);
	}

	destroy(): void {
		this.reset();
		this.clearEnabledOverride();
	}

	private getMetricName(name: string): string {
		const trimmed = name.trim();
		return trimmed.startsWith(`${this.namespace}.`) ? trimmed : `${this.namespace}.${trimmed}`;
	}

	private toMetricSnapshot(
		name: string,
		metric: MetricAggregate
	): PerformanceProfilerMetricSnapshot {
		const samples = [...metric.samples].sort((a, b) => a - b);
		const average = metric.count === 0 ? 0 : metric.totalMs / metric.count;

		return {
			name,
			count: metric.count,
			totalMs: roundDuration(metric.totalMs),
			averageMs: roundDuration(average),
			minMs: roundDuration(metric.minMs === Number.POSITIVE_INFINITY ? 0 : metric.minMs),
			maxMs: roundDuration(metric.maxMs),
			medianMs: roundDuration(percentile(samples, 0.5)),
			p95Ms: roundDuration(percentile(samples, 0.95)),
			lastMs: roundDuration(metric.lastMs),
			sampleCount: metric.samples.length,
			lastDetails: metric.lastDetails,
		};
	}
}

export function createTaskNotesPerformanceProfiler(
	options: PerformanceProfilerOptions = {}
): TaskNotesPerformanceProfiler {
	return new TaskNotesPerformanceProfiler(options);
}
