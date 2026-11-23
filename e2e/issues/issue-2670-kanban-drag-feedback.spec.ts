import { expect, test } from "@playwright/test";
import { stringify } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

let instance: ObsidianApp;
const folder = `E2E Kanban drag feedback ${Date.now()}`;

test.beforeAll(async () => {
	instance = await launchObsidian();
	await instance.page.evaluate(async ({ folder, base }) => {
		const app = (window as any).app;
		await app.vault.createFolder(folder);
		await app.vault.create(`${folder}/Source.md`, "---\ntags: [task]\nstatus: done\n---\n");
		for (let index = 0; index < 41; index++) {
			const rank = String(index).padStart(6, "0");
			await app.vault.create(`${folder}/Target ${rank}.md`,
				`---\ntags: [task]\nstatus: open\ntasknotes_manual_order: "0|${rank}:"\n---\n`);
		}
		const file = await app.vault.create(`${folder}/Board.base`, base);
		await app.workspace.getLeaf(false).openFile(file);
	}, { folder, base: stringify({
		filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
		views: [{ type: "tasknotesKanban", name: "Drag feedback", hideEmptyColumns: true,
			groupBy: { property: "status", direction: "ASC" },
			sort: [{ property: "tasknotes_manual_order", direction: "ASC" }],
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

test("coalesces native dragover feedback below a large column without repainting the same slot", async () => {
	const { page } = instance;
	const source = page.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/Source.md"]`);
	const cards = page.locator('.kanban-view__column[data-group="open"] .kanban-view__cards--virtual');
	const last = cards.locator(`[data-task-path="${folder}/Target 000040.md"]`).first();
	await expect(source).toBeVisible();
	await expect(async () => {
		await cards.evaluate((element) => { element.scrollTop = element.scrollHeight; });
		await expect(last).toBeAttached({ timeout: 500 });
	}).toPass({ timeout: 5000 });
	const result = await cards.evaluate(async (container, sourcePath) => {
		const column = container.closest(".kanban-view__column")!;
		const board = container.closest(".kanban-view__board")!;
		const source = board.querySelector<HTMLElement>(`[data-task-path="${sourcePath}"]`)!;
		const cardSelector = ".kanban-view__card-wrapper";
		const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		const dispatch = (target: Element, type: string, clientX: number, clientY: number) => {
			const dataTransfer = new DataTransfer();
			Object.defineProperty(dataTransfer, "dropEffect", { value: "none", writable: true });
			const event = new DragEvent(type, { bubbles: true, cancelable: true, clientX, clientY, dataTransfer });
			target.dispatchEvent(event);
			return event.defaultPrevented && dataTransfer.dropEffect === "move";
		};
		const sourceRect = source.getBoundingClientRect();
		dispatch(source, "dragstart", sourceRect.left, sourceRect.top);
		await frame();
		await frame();
		const wrappers = Array.from(container.querySelectorAll(cardSelector));
		const last = wrappers[wrappers.length - 1];
		const { left, width, bottom, top, height } = last.getBoundingClientRect();
		const clientX = left + width / 2;
		const originalRect = Element.prototype.getBoundingClientRect;
		let cardReads = 0;
		Element.prototype.getBoundingClientRect = function () {
			if (container.contains(this) && this.matches(cardSelector)) cardReads++;
			return originalRect.call(this);
		};
		let steadyMutations = 0;
		const attributes = new MutationObserver((records) => { steadyMutations += records.length; });
		const endMarker = "kanban-view__cards--drop-marker-end";
		try {
			const accepted = [dispatch(container, "dragenter", clientX, bottom + 1)];
			for (let index = 0; index < 100; index++) {
				accepted.push(dispatch(index % 2 ? container : last, "dragover", clientX, index % 2 ? bottom + 1 : top + height / 4));
			}
			const synchronousReads = cardReads;
			await frame();
			const initialReads = cardReads;
			const pickedLatest = container.classList.contains(endMarker);
			attributes.observe(column, { attributes: true, attributeFilter: ["class"] });
			attributes.observe(container, { attributes: true, attributeFilter: ["class", "style"] });
			for (let index = 0; index < 100; index++) {
				accepted.push(dispatch(container, "dragover", clientX, bottom + 1));
			}
			await frame();
			steadyMutations += attributes.takeRecords().length;
			attributes.disconnect();
			const steadyReads = cardReads - initialReads;
			dispatch(last, "dragover", clientX, top + height / 4);
			await frame();
			const movedMarker = last.classList.contains("kanban-view__card-wrapper--drop-marker");
			dispatch(container, "dragover", clientX, bottom + 1);
			dispatch(source, "dragend", clientX, bottom + 1);
			await frame();
			return {
				accepted: accepted.filter(Boolean).length, synchronousReads, initialReads,
				pickedLatest, steadyReads, steadyMutations, movedMarker,
				cleared: !container.classList.contains(endMarker) &&
					!column.classList.contains("kanban-view__column--dragover"),
			};
		} finally {
			Element.prototype.getBoundingClientRect = originalRect;
			attributes.disconnect();
			if (source.classList.contains("kanban-view__card--dragging")) dispatch(source, "dragend", clientX, bottom);
		}
	}, `${folder}/Source.md`);
	console.info("Issue 2670 synthetic dragover burst:", result);
	expect(result).toMatchObject({ accepted: 201, synchronousReads: 0, pickedLatest: true, steadyMutations: 0, movedMarker: true, cleared: true });
	expect(result.initialReads).toBeLessThanOrEqual(3);
	expect(result.steadyReads).toBeLessThanOrEqual(2);
});
