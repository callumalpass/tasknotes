import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "../obsidian";

// Reporter: exactly two alpha-ranked tasks per actual scheduled date, not a
// formula group. Exercise native mouse drags and persisted YAML, not drop handlers.
const root = `E2E issue 2415 ${Date.now()}`;
let instance: ObsidianApp;

test.beforeAll(async () => {
	instance = await launchObsidian();
	await instance.page.evaluate(async (root) => {
		const app = (window as any).app;
		await app.vault.createFolder(root);
		app.workspace.leftSplit.collapse();
		app.workspace.rightSplit.collapse();
	}, root);
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(async (root) => {
			const app = (window as any).app;
			const folder = app.vault.getAbstractFileByPath(root);
			if (folder) await app.vault.delete(folder, true);
		}, root);
	} finally {
		await closeObsidian(instance);
	}
});

for (const direction of ["ASC", "DESC"]) {
	test(`${direction}: two alpha-ranked tasks persist above/below moves after reopen and reload`, async () => {
		const folder = `${root}/${direction}`;
		const base = `${root}/${direction}.base`;
		await instance.page.evaluate(
			async ({ folder, base, direction }) => {
				const app = (window as any).app;
				await app.vault.createFolder(folder);
				for (const day of ["2035-10-21", "2035-10-22"]) {
					for (const [name, rank] of [
						["Alpha", "tniririririq"],
						["Beta", "tniririririr"],
					]) {
						await app.vault.create(
							`${folder}/${day} ${name}.md`,
							`---\ntitle: ${day} ${name}\nstatus: open\ntags: [task]\nscheduled: ${day}\ntasknotes_manual_order: ${rank}\n---\n`
						);
					}
				}
				await app.vault.create(
					base,
					`filters:\n  and:\n    - file.folder == "${folder}"\n    - file.ext == "md"\nviews:\n  - type: tasknotesTaskList\n    name: ${direction}\n    groupBy:\n      property: note.scheduled\n      direction: ASC\n    sort:\n      - column: tasknotes_manual_order\n        direction: ${direction}\n    order:\n      - note.status\n      - note.scheduled\n`
				);
				await app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(base));
			},
			{ folder, base, direction }
		);

		const card = (day: string, name: string) =>
			instance.page.locator(
				`.workspace-leaf.mod-active .task-card[data-task-path="${folder}/${day} ${name}.md"]`
			);
		const ranks = async () =>
			instance.page.evaluate(async (folder) => {
				const app = (window as any).app;
				const result: Record<string, string> = {};
				for (const file of app.vault
					.getMarkdownFiles()
					.filter((file: any) => file.parent.path === folder)) {
					// Read the persisted bytes, not a write-through task cache.
					const content = await app.vault.read(file);
					result[file.basename] =
						content.match(/^tasknotes_manual_order: (.+)$/m)?.[1] ?? "";
				}
				return result;
			}, folder);
		const expectOrder = async (day: string, first: string) => {
			await expect
				.poll(async () => {
					const a = await card(day, "Alpha").boundingBox();
					const b = await card(day, "Beta").boundingBox();
					return a && b ? (a.y < b.y ? "Alpha" : "Beta") : "missing";
				})
				.toBe(first);
		};
		const drag = async (day: string, above: boolean) => {
			await card(day, "Alpha").hover();
			const source = await card(day, "Alpha")
				.locator(".task-card__drag-handle")
				.boundingBox();
			const target = await card(day, "Beta").boundingBox();
			expect(source).not.toBeNull();
			expect(target).not.toBeNull();
			await instance.page.mouse.move(
				source!.x + source!.width / 2,
				source!.y + source!.height / 2
			);
			await instance.page.mouse.down();
			await instance.page.mouse.move(
				source!.x + source!.width / 2 + 10,
				source!.y + source!.height / 2,
				{ steps: 3 }
			);
			await instance.page.mouse.move(
				target!.x + target!.width / 2,
				target!.y + (above ? 2 : target!.height - 2),
				{ steps: 12 }
			);
			await instance.page.mouse.move(
				target!.x + target!.width / 2 + 1,
				target!.y + (above ? 2 : target!.height - 2)
			);
			await instance.page.mouse.up();
			await expectOrder(day, above ? "Alpha" : "Beta");
		};

		for (const day of ["2035-10-21", "2035-10-22"]) {
			await expect(card(day, "Alpha")).toBeVisible();
			let previous = await ranks();
			// Reverse the initial direction, then reverse it again: both insertion sides.
			for (const above of direction === "DESC" ? [true, false] : [false, true]) {
				await drag(day, above);
				await expect
					.poll(async () => (await ranks())[`${day} Alpha`])
					.not.toBe(previous[`${day} Alpha`]);
				const current = await ranks();
				const alpha = current[`${day} Alpha`];
				const beta = current[`${day} Beta`];
				expect(direction === "ASC" ? alpha < beta : alpha > beta).toBe(above);
				previous = current;
			}
		}
		const persisted = await ranks();
		await instance.page.evaluate(async (base) => {
			const app = (window as any).app;
			const leaf = app.workspace.getMostRecentLeaf();
			await leaf.setViewState({ type: "empty" });
			await leaf.openFile(app.vault.getAbstractFileByPath(base));
		}, base);
		expect(await ranks()).toEqual(persisted);
		for (const day of ["2035-10-21", "2035-10-22"])
			await expectOrder(day, direction === "ASC" ? "Alpha" : "Beta");
		await instance.page.reload();
		await instance.page.waitForFunction(
			() => (window as any).app?.plugins?.plugins?.tasknotes?.cacheManager
		);
		await instance.page.evaluate(async (base) => {
			const app = (window as any).app;
			await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(base));
		}, base);
		expect(await ranks()).toEqual(persisted);
		for (const day of ["2035-10-21", "2035-10-22"])
			await expectOrder(day, direction === "ASC" ? "Alpha" : "Beta");
	});
}
