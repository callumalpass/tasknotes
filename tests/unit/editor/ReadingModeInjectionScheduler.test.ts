import { describe, expect, it } from "@jest/globals";

import { ReadingModeInjectionScheduler } from "../../../src/editor/ReadingModeInjectionScheduler";

describe("ReadingModeInjectionScheduler", () => {
	it("serializes concurrent requests for the same leaf and reruns once with the latest state", async () => {
		const scheduler = new ReadingModeInjectionScheduler();
		const leaf = {} as any;
		const events: string[] = [];
		let releaseFirstRun: (() => void) | null = null;
		let runCount = 0;

		const firstRunStarted = new Promise<void>((resolve) => {
			const run = async ({ isCurrent }: { isCurrent: () => boolean }) => {
				runCount += 1;
				events.push(`start-${runCount}-${isCurrent() ? "current" : "stale"}`);

				if (runCount === 1) {
					resolve();
					await new Promise<void>((resume) => {
						releaseFirstRun = resume;
					});
					events.push(`finish-${runCount}-${isCurrent() ? "current" : "stale"}`);
					return;
				}

				events.push(`finish-${runCount}-${isCurrent() ? "current" : "stale"}`);
			};

			scheduler.schedule(leaf, run);
		});

		await firstRunStarted;

		scheduler.schedule(leaf, async ({ isCurrent }) => {
			runCount += 1;
			events.push(`start-${runCount}-${isCurrent() ? "current" : "stale"}`);
			events.push(`finish-${runCount}-${isCurrent() ? "current" : "stale"}`);
		});

		expect(runCount).toBe(1);

		releaseFirstRun?.();
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(runCount).toBe(2);
		expect(events).toEqual([
			"start-1-current",
			"finish-1-stale",
			"start-2-current",
			"finish-2-current",
		]);
	});
});
