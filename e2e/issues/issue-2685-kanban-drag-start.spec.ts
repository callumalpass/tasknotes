import { expect, test } from "@playwright/test";
import { stringify } from "yaml";
import { closeObsidian, launchObsidian, setObsidianViewport, type ObsidianApp } from "../obsidian";

let instance: ObsidianApp;
const folder = `E2E Kanban drag start ${Date.now()}`;
const sourcePath = `${folder}/open 000.md`;

test.beforeAll(async () => {
	instance = await launchObsidian();
	await setObsidianViewport(instance.page, { width: 1150, height: 1000 });
	await instance.page.evaluate(async ({ folder, base }) => {
		const app = (window as any).app;
		await app.vault.createFolder(folder);
		for (const status of ["open", "in-progress", "done"]) {
			for (let index = 0; index < 60; index++) {
				const rank = String(index).padStart(3, "0");
				await app.vault.create(`${folder}/${status} ${rank}.md`, [
					"---", "tags: [task, review, planning]", `status: ${status}`, "priority: normal",
					"due: 2026-12-01", "contexts: [office, focus]", 'projects: ["[[Delivery planning]]"]', "---", "",
				].join("\n"));
			}
		}
		const file = await app.vault.create(`${folder}/Board.base`, base);
		await app.workspace.getLeaf(false).openFile(file);
	}, { folder, base: stringify({
		filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
		views: [{
			type: "tasknotesKanban", name: "Drag start", hideEmptyColumns: true,
			groupBy: { property: "status", direction: "ASC" },
			order: ["file.name", "priority", "due", "projects", "contexts", "file.tags"],
			sort: [{ property: "file.name", direction: "ASC" }],
		}],
	}) });
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(async (folder) => {
			const vault = (window as any).app.vault;
			const fixture = vault.getAbstractFileByPath(folder);
			if (fixture) await vault.delete(fixture, true);
		}, folder);
	} finally {
		await closeObsidian(instance);
	}
});

test("native Kanban drag start only measures the source and real scroll hosts", async () => {
	const { page } = instance;
	const source = page.locator(`.kanban-view__card-wrapper[data-task-path="${sourcePath}"]`);
	await expect(source).toBeVisible();
	await expect(page.locator(".kanban-view__cards--virtual")).toHaveCount(3);
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Performance.enable");
	const readMetrics = async () => Object.fromEntries(
		(await cdp.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value])
	);
	const before = await readMetrics();
	const result = await source.evaluate((source) => {
		const rect = source.getBoundingClientRect();
		const board = source.closest(".kanban-view__board")!;
		const dataTransfer = new DataTransfer();
		let nativeImage = "";
		let rectReads = 0;
		let scrollSizeReads = 0;
		const itemUpdates = new MutationObserver(() => {});
		itemUpdates.observe(board, { subtree: true, attributes: true, attributeFilter: ["data-virtual-index"] });
		const originalRect = Element.prototype.getBoundingClientRect;
		const originalScrollHeight = Object.getOwnPropertyDescriptor(Element.prototype, "scrollHeight")!;
		dataTransfer.setDragImage = (image) => { nativeImage = image.tagName; };
		Element.prototype.getBoundingClientRect = function () {
			rectReads++;
			return originalRect.call(this);
		};
		Object.defineProperty(Element.prototype, "scrollHeight", {
			...originalScrollHeight,
			get() {
				if (board.contains(this)) scrollSizeReads++;
				return originalScrollHeight.get!.call(this);
			},
		});
		const start = performance.now();
		try {
			source.dispatchEvent(new DragEvent("dragstart", {
				bubbles: true, cancelable: true, clientX: rect.left + 20, clientY: rect.top + 20, dataTransfer,
			}));
			return {
				rectReads, scrollSizeReads, nativeImage, itemUpdates: itemUpdates.takeRecords().length,
				elapsedMs: performance.now() - start,
				preview: !!document.querySelector(".kanban-view__floating-drag-preview .task-card"),
				payload: dataTransfer.getData("text/plain"),
			};
		} finally {
			Element.prototype.getBoundingClientRect = originalRect;
			Object.defineProperty(Element.prototype, "scrollHeight", originalScrollHeight);
			itemUpdates.disconnect();
			source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer }));
		}
	});
	const after = await readMetrics();
	await cdp.detach();
	console.info("Issue 2685 drag-start profile:", result, {
		layouts: after.LayoutCount - before.LayoutCount,
		layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
		styleMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
	});
	expect(result).toMatchObject({
		scrollSizeReads: 0, itemUpdates: 0, nativeImage: "CANVAS", preview: true, payload: sourcePath,
	});
	expect(result.rectReads).toBeLessThanOrEqual(2);
	await expect(page.locator(".kanban-view__floating-drag-preview")).toHaveCount(0);
});

test("a cancelled drag restores column scroll and keeps the virtual source attached", async () => {
	const { page } = instance;
	const source = page.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/open 006.md"]`);
	const column = page.locator('.kanban-view__column[data-group="open"] .kanban-view__cards--virtual');
	await column.evaluate(element => { element.scrollTop = 100; });
	await expect(source).toBeVisible();
	const originalScrollTop = await column.evaluate(element => element.scrollTop);
	expect(originalScrollTop).toBeGreaterThan(0);
	const bounds = (await source.boundingBox())!;
	const x = bounds.x + bounds.width / 2;
	const y = bounds.y + 18;
	await page.mouse.move(x, y);
	await page.mouse.down();
	try {
		await page.mouse.move(x + 20, y, { steps: 8 });
		await expect(page.locator(".kanban-view__floating-drag-preview .task-card")).toBeVisible();
		await column.evaluate(element => { element.scrollTop = element.scrollHeight; });
		await expect(source).toHaveClass(/virtual-scroller__pinned/);
		await page.mouse.move(100, 60, { steps: 8 });
	} finally {
		await page.mouse.up();
	}
	await expect(page.locator(".kanban-view__floating-drag-preview")).toHaveCount(0);
	await expect.poll(() => column.evaluate(element => element.scrollTop)).toBe(originalScrollTop);
	await expect(source).toBeVisible();
});
