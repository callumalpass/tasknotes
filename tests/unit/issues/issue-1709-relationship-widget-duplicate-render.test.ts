import { describe, expect, it } from "@jest/globals";

import { ReadingModeInjectionScheduler } from "../../../src/editor/ReadingModeInjectionScheduler";

const CSS_RELATIONSHIPS_WIDGET = "tasknotes-relationships-widget";

describe("issue #1709 relationship widget duplicate rendering", () => {
	it("keeps one reading-mode relationships widget after overlapping refresh requests", async () => {
		const scheduler = new ReadingModeInjectionScheduler();
		const leaf = {} as never;
		const container = document.createElement("div");
		let releaseFirstRun: (() => void) | null = null;
		let runCount = 0;

		const firstRunStarted = new Promise<void>((resolve) => {
			const run = async ({ isCurrent }: { isCurrent: () => boolean }) => {
				runCount += 1;

				container.querySelectorAll(`.${CSS_RELATIONSHIPS_WIDGET}`).forEach((widget) => {
					widget.remove();
				});

				const widget = document.createElement("div");
				widget.className = CSS_RELATIONSHIPS_WIDGET;
				widget.dataset.run = String(runCount);

				if (runCount === 1) {
					resolve();
					await new Promise<void>((resume) => {
						releaseFirstRun = resume;
					});
				}

				if (!isCurrent()) {
					widget.remove();
					return;
				}

				container.appendChild(widget);
			};

			scheduler.schedule(leaf, run);
		});

		await firstRunStarted;
		scheduler.schedule(leaf, async () => {
			throw new Error("running scheduler should coalesce this callback");
		});
		scheduler.schedule(leaf, async () => {
			throw new Error("running scheduler should coalesce this callback too");
		});

		releaseFirstRun?.();
		await new Promise((resolve) => setTimeout(resolve, 0));

		const widgets = Array.from(container.querySelectorAll(`.${CSS_RELATIONSHIPS_WIDGET}`));
		expect(runCount).toBe(2);
		expect(widgets).toHaveLength(1);
		expect((widgets[0] as HTMLElement).dataset.run).toBe("2");
	});
});
