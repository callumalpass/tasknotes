import { createTaskNotesPerformanceProfiler } from "../../../src/utils/PerformanceProfiler";

describe("TaskNotesPerformanceProfiler", () => {
	it("does not collect timings while disabled", () => {
		let now = 10;
		const profiler = createTaskNotesPerformanceProfiler({
			now: () => now,
			isEnabled: () => false,
		});

		profiler.measureSync("disabled", () => {
			now += 20;
		});

		expect(profiler.snapshot().metrics).toEqual({});
	});

	it("collects bounded timing statistics when enabled", () => {
		let now = 0;
		const profiler = createTaskNotesPerformanceProfiler({
			namespace: "test",
			now: () => now,
			isEnabled: () => true,
			sampleLimit: 2,
			slowThresholdMs: 1000,
		});

		for (const duration of [5, 15, 30]) {
			const span = profiler.start("operation");
			now += duration;
			span.end({ batch: duration });
		}

		const snapshot = profiler.snapshot();
		expect(snapshot.metrics["test.operation"]).toEqual(
			expect.objectContaining({
				count: 3,
				totalMs: 50,
				averageMs: 16.667,
				minMs: 5,
				maxMs: 30,
				medianMs: 15,
				p95Ms: 30,
				lastMs: 30,
				sampleCount: 2,
				lastDetails: { batch: 30 },
			})
		);
	});

	it("supports manual enablement, counters, gauges, and reset", () => {
		const profiler = createTaskNotesPerformanceProfiler({
			namespace: "test",
			isEnabled: () => false,
		});

		profiler.enable();
		profiler.increment("queue.replayed", 2, { queue: "sync" });
		profiler.recordGauge("queue.remaining", 4);

		let snapshot = profiler.snapshot();
		expect(snapshot.enabled).toBe(true);
		expect(snapshot.counters["test.queue.replayed"]).toEqual(
			expect.objectContaining({
				count: 2,
				lastDetails: { queue: "sync" },
			})
		);
		expect(snapshot.gauges["test.queue.remaining"]).toEqual(
			expect.objectContaining({ value: 4 })
		);

		profiler.reset("queue.replayed");
		snapshot = profiler.snapshot();
		expect(snapshot.counters["test.queue.replayed"]).toBeUndefined();
		expect(snapshot.gauges["test.queue.remaining"]).toEqual(
			expect.objectContaining({ value: 4 })
		);

		profiler.reset();
		expect(profiler.snapshot().gauges).toEqual({});
	});

	it("records failed async measurements before rethrowing", async () => {
		let now = 100;
		const profiler = createTaskNotesPerformanceProfiler({
			namespace: "test",
			now: () => now,
			isEnabled: () => true,
			slowThresholdMs: 1000,
		});

		await expect(
			profiler.measureAsync("failure", async () => {
				now += 12;
				throw new Error("boom");
			})
		).rejects.toThrow("boom");

		expect(profiler.snapshot().metrics["test.failure"]).toEqual(
			expect.objectContaining({
				count: 1,
				lastMs: 12,
				lastDetails: { failed: true },
			})
		);
	});
});
