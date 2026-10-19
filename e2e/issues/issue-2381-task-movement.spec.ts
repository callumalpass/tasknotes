import { test, expect, type Locator } from "@playwright/test";
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from "../obsidian";

let instance: ObsidianApp;
const rootFolder = `E2E task movement ${Date.now()}`;
let folder = rootFolder;
const sourceRank = "0|hzzzzz:";

const card = (title: string): Locator =>
	instance.page
		.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${folder}/${title}.md"]`)
		.first();

async function frontmatter(title = "Source"): Promise<Record<string, unknown>> {
	return instance.page.evaluate(
		({ folder, title }) => {
			const app = (window as any).app;
			const file = app.vault.getAbstractFileByPath(`${folder}/${title}.md`);
			return app.metadataCache.getFileCache(file)?.frontmatter ?? {};
		},
		{ folder, title }
	);
}

async function openView(
	options: {
		manual?: boolean;
		group?: string;
		subgroup?: string | null;
		formula?: boolean;
		ungrouped?: boolean;
	} = {}
): Promise<void> {
	await instance.page.evaluate(
		async ({ folder, options }) => {
			const app = (window as any).app;
			for (const leaf of app.workspace.getLeavesOfType("bases")) leaf.detach();
			const filePath = `${folder}/Movement-${Date.now()}.base`;
			const content = `filters:\n  and:\n    - file.folder == "${folder}"\n    - file.ext == "md"\n${options.formula ? 'formulas:\n  bucket: \'if(status == "done", "closed", "active")\'\n' : ""}views:\n  - type: tasknotesTaskList\n    name: Movement\n${options.ungrouped ? "" : `    groupBy:\n      property: ${options.group ?? "note.status"}\n      direction: ASC\n`}${options.subgroup === null ? "" : `    subGroup: ${options.subgroup ?? "note.priority"}\n`}    sort:\n      - column: ${options.manual ? "tasknotes_manual_order" : "due"}\n        direction: DESC\n    order:\n      - note.status\n      - note.priority\n`;
			const oldFile = app.vault.getAbstractFileByPath(filePath);
			if (oldFile) await app.vault.modify(oldFile, content);
			else await app.vault.create(filePath, content);
			await app.workspace.getLeaf("tab").openFile(app.vault.getAbstractFileByPath(filePath));
		},
		{ folder, options }
	);
	await expect(card("Source")).toBeVisible();
	await expect(card("Source")).toHaveAttribute("draggable", /true|false/);
	await expect(card("Source")).toHaveAttribute("data-status", "open");
	await expect(card("Source")).toHaveAttribute("data-priority", "high");
}

async function beginMouseDrag(target: Locator): Promise<void> {
	await target.hover();
	await card("Source").hover();
	const source = await card("Source").boundingBox();
	const destination = await target.boundingBox();
	expect(source).not.toBeNull();
	expect(destination).not.toBeNull();
	await instance.page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
	await instance.page.mouse.down();
	await instance.page.mouse.move(
		source!.x + source!.width / 2 + 8,
		source!.y + source!.height / 2,
		{ steps: 3 }
	);
	await instance.page.mouse.move(
		destination!.x + destination!.width / 2,
		destination!.y + destination!.height / 2,
		{ steps: 8 }
	);
	await instance.page.mouse.move(
		destination!.x + destination!.width / 2,
		destination!.y + destination!.height / 2
	);
}

test.beforeAll(async () => {
	instance = await launchObsidian();
	await instance.page.evaluate(async (folder) => {
		const app = (window as any).app;
		await app.vault.createFolder(folder);
		app.workspace.leftSplit.collapse();
		app.workspace.rightSplit.collapse();
		const plugin = app.plugins.getPlugin("tasknotes");
		plugin.statusManager.updateStatuses(
			plugin.settings.customStatuses.filter(
				(status: any) => !status.value.startsWith("test-status-")
			)
		);
		plugin.priorityManager.updatePriorities(
			plugin.settings.customPriorities.filter(
				(priority: any) => !priority.value.startsWith("test-priority-")
			)
		);
	}, folder);
});

test.beforeEach(async () => {
	folder = `${rootFolder}/${Date.now()}`;
	await instance.page.evaluate(async (folder) => {
		await (window as any).app.vault.createFolder(folder);
	}, folder);
	await instance.page.keyboard.press("Escape");
	await instance.page.evaluate(() => {
		document.body.classList.remove("is-mobile");
		document.querySelectorAll(".notice").forEach((notice) => notice.remove());
	});
	await setObsidianViewport(instance.page, { width: 1400, height: 900 });
	await instance.page.evaluate(
		async ({ folder, sourceRank }) => {
			const app = (window as any).app;
			for (const [title, status, priority, rank, contexts] of [
				["Source", "open", "high", sourceRank, ["work", "call"]],
				["Low", "open", "low", "0|i00007:", ["home", "focus"]],
				["Done", "done", "low", "0|i0000f:", ["other"]],
				["High peer", "open", "high", "0|i0000n:", ["other"]],
			]) {
				const fm = {
					title,
					status,
					priority,
					tasknotes_manual_order: rank,
					contexts,
					flag: title !== "Source" && title !== "High peer",
					timeEstimate: title === "Source" ? 0 : 15,
					due: "2026-10-10",
					tags: ["task"],
				};
				const content = `---\n${Object.entries(fm)
					.map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
					.join("\n")}\n---\n`;
				const filePath = `${folder}/${title}.md`;
				const file = app.vault.getAbstractFileByPath(filePath);
				if (file) await app.vault.modify(file, content);
				else await app.vault.create(filePath, content);
			}
		},
		{ folder, sourceRank }
	);
	await expect.poll(async () => (await frontmatter()).priority).toBe("high");
});

test.afterEach(async ({}, testInfo) => {
	if (testInfo.status !== testInfo.expectedStatus)
		await instance.page.screenshot({ path: testInfo.outputPath("failure-live.png") });
	await instance.page.mouse.up();
	await instance.page.keyboard.press("Escape");
	await instance.page.evaluate(() => document.body.classList.remove("is-mobile"));
});

test.afterAll(async () => {
	if (!instance) return;
	try {
		await instance.page.evaluate(async (folder) => {
			const app = (window as any).app;
			const fixture = app.vault.getAbstractFileByPath(folder);
			if (fixture) await app.vault.delete(fixture, true);
		}, rootFolder);
	} finally {
		await closeObsidian(instance);
	}
});

async function setFields(title: string, fields: Record<string, unknown>): Promise<void> {
	await instance.page.evaluate(
		async ({ folder, title, fields }) => {
			const app = (window as any).app;
			await app.fileManager.processFrontMatter(
				app.vault.getAbstractFileByPath(`${folder}/${title}.md`),
				(fm: any) => Object.assign(fm, fields)
			);
		},
		{ folder, title, fields }
	);
	await expect
		.poll(async () => {
			const fm = await frontmatter(title);
			return Object.entries(fields).every(
				([key, value]) => JSON.stringify(fm[key]) === JSON.stringify(value)
			);
		})
		.toBe(true);
}

async function beginParentDrop(title: string): Promise<void> {
	await beginMouseDrag(card(title));
	const target = card(title).locator(
		":scope > .task-card__main-row > .task-list-view__parent-target"
	);
	await expect(target).toBeVisible();
	const bounds = await target.boundingBox();
	await instance.page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2, {
		steps: 5,
	});
	await instance.page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
}

test("parent drop adds a relationship without moving groups or manual rank", async ({}, testInfo) => {
	await setFields("Source", { projects: ["[[Existing project]]", "Marketing"] });
	await openView();
	await beginParentDrop("Done");
	await expect(instance.page.locator(".task-list-view__movement-feedback")).toContainText(
		"Add as subtask of Done"
	);
	await expect(
		instance.page.locator(".task-list-view__drop-slot-before, .task-list-view__drop-slot-after")
	).toHaveCount(0);
	await instance.page.screenshot({ path: testInfo.outputPath("parent-drop-preview.png") });
	await instance.page.mouse.up();
	await expect.poll(async () => (await frontmatter()).projects).toHaveLength(3);
	expect(await frontmatter()).toMatchObject({
		status: "open",
		priority: "high",
		tasknotes_manual_order: sourceRank,
	});
	const projects = (await frontmatter()).projects as string[];
	expect(projects.slice(0, 2)).toEqual(["[[Existing project]]", "Marketing"]);
	expect(projects[2]).toContain("Done");
	await expect(instance.page.locator(".notice")).toContainText("Added as a subtask of Done");
	await expect(instance.page.locator(".task-list-view--moving")).toHaveCount(0);
});

test("parent assignment works in an ungrouped due-sorted list", async () => {
	await openView({ ungrouped: true, subgroup: null });
	await beginParentDrop("Done");
	await instance.page.mouse.up();
	await expect.poll(async () => (await frontmatter()).projects).toHaveLength(1);
	expect(await frontmatter()).toMatchObject({
		status: "open",
		priority: "high",
		tasknotes_manual_order: sourceRank,
	});
});

test("parent drop blocks self assignment without writing", async () => {
	await openView();
	const before = await frontmatter();
	await beginParentDrop("Source");
	await expect(instance.page.locator(".task-list-view__movement-feedback")).toContainText(
		"cannot be its own parent"
	);
	await instance.page.mouse.up();
	expect(await frontmatter()).toEqual(before);
});

test("parent drop blocks an indirect descendant without writing", async () => {
	await setFields("Done", { projects: [`[[${folder}/High peer]]`] });
	await setFields("High peer", { projects: [`[[${folder}/Source]]`] });
	await openView();
	const before = await frontmatter();
	await beginParentDrop("Done");
	await expect(instance.page.locator(".task-list-view__movement-feedback")).toContainText(
		"descendants"
	);
	await instance.page.mouse.up();
	expect(await frontmatter()).toEqual(before);
});

test("parent drop recognizes an existing aliased membership", async () => {
	await setFields("Source", { projects: [`[[${folder}/Done|Different label]]`, "Marketing"] });
	await openView();
	const before = await frontmatter();
	await beginParentDrop("Done");
	await expect(instance.page.locator(".task-list-view__movement-feedback")).toContainText(
		"Already a subtask"
	);
	await instance.page.mouse.up();
	expect(await frontmatter()).toEqual(before);
});

test("parent assignment Undo restores memberships and preserves later unrelated edits", async () => {
	await setFields("Source", { projects: ["Original project"] });
	await openView();
	await beginParentDrop("Done");
	await instance.page.mouse.up();
	await expect.poll(async () => (await frontmatter()).projects).toHaveLength(2);
	await setFields("Source", { description: "Edited after assigning" });
	await instance.page.getByRole("button", { name: "Undo", exact: true }).click();
	await expect.poll(async () => (await frontmatter()).projects).toEqual(["Original project"]);
	expect(await frontmatter()).toMatchObject({
		description: "Edited after assigning",
		status: "open",
		priority: "high",
		tasknotes_manual_order: sourceRank,
	});
});

test("parent assignment is available through the keyboard movement menu", async () => {
	await openView();
	const handle = card("Source").getByRole("button", { name: "Move task" });
	await handle.focus();
	await instance.page.keyboard.press("Enter");
	await instance.page.getByText("Add as subtask of…", { exact: true }).click();
	const input = instance.page.locator(".prompt-input");
	await input.fill("Done");
	await expect(
		instance.page.locator(".suggestion-item").filter({ hasText: "Done" }).first()
	).toBeVisible();
	await instance.page.keyboard.press("Enter");
	await expect.poll(async () => (await frontmatter()).projects).toHaveLength(1);
});

test("Escape cancels a parent preview without writing memberships", async () => {
	await openView();
	const before = await frontmatter();
	await beginParentDrop("Done");
	await expect(instance.page.locator(".task-list-view__movement-feedback")).toContainText(
		"Add as subtask of Done"
	);
	await instance.page.keyboard.press("Escape");
	await instance.page.mouse.up();
	await expect(instance.page.locator(".task-list-view__movement-feedback")).toHaveCount(0);
	expect(await frontmatter()).toEqual(before);
});

test("parent Undo refuses to replace later project edits", async () => {
	await openView();
	await beginParentDrop("Done");
	await instance.page.mouse.up();
	await expect.poll(async () => (await frontmatter()).projects).toHaveLength(1);
	await setFields("Source", { projects: ["Later project"] });
	await instance.page.getByRole("button", { name: "Undo", exact: true }).click();
	await expect(instance.page.locator(".notice")).toContainText("Cannot undo");
	expect((await frontmatter()).projects).toEqual(["Later project"]);
});

test("read-only grouping does not prevent a separate parent assignment", async () => {
	await openView({ group: "formula.bucket", formula: true });
	await beginParentDrop("Done");
	await instance.page.mouse.up();
	await expect.poll(async () => (await frontmatter()).projects).toHaveLength(1);
	expect((await frontmatter()).status).toBe("open");
});

test("parent preview wraps a long title in a small-laptop pane", async ({}, testInfo) => {
	await instance.page.evaluate(() =>
		(window as any).require("electron").remote.getCurrentWindow().unmaximize()
	);
	await setObsidianViewport(instance.page, { width: 860, height: 760 });
	const title =
		"A long parent task title for coordinating the research review with several collaborators and follow-up notes";
	await setFields("Done", { title });
	await openView();
	await beginParentDrop("Done");
	const feedback = instance.page.locator(".task-list-view__movement-feedback");
	await expect(feedback).toContainText(title);
	const fits = await feedback.evaluate((element) => element.scrollWidth <= element.clientWidth);
	expect(fits).toBe(true);
	await instance.page.screenshot({
		path: testInfo.outputPath("parent-small-laptop-preview.png"),
	});
	await instance.page.keyboard.press("Escape");
	await instance.page.mouse.up();
});

test("parent assignment honors Markdown frontmatter links", async () => {
	const previous = await instance.page.evaluate(() => {
		const app = (window as any).app;
		const plugin = app.plugins.getPlugin("tasknotes");
		const before = {
			plugin: plugin.settings.useFrontmatterMarkdownLinks,
			vault: app.vault.getConfig("useMarkdownLinks"),
		};
		plugin.settings.useFrontmatterMarkdownLinks = true;
		app.vault.setConfig("useMarkdownLinks", true);
		return before;
	});
	try {
		await openView();
		await beginParentDrop("Done");
		await instance.page.mouse.up();
		await expect.poll(async () => (await frontmatter()).projects).toHaveLength(1);
		expect(((await frontmatter()).projects as string[])[0]).toMatch(/^\[.*\]\(.*\)$/);
		await beginParentDrop("Done");
		await expect(instance.page.locator(".task-list-view__movement-feedback")).toContainText(
			"Already a subtask"
		);
		await instance.page.mouse.up();
		expect((await frontmatter()).projects).toHaveLength(1);
	} finally {
		await instance.page.evaluate((before) => {
			const app = (window as any).app;
			app.plugins.getPlugin("tasknotes").settings.useFrontmatterMarkdownLinks = before.plugin;
			app.vault.setConfig("useMarkdownLinks", before.vault);
		}, previous);
	}
});

test("touch parent drop stays distinct and readable at a narrow dark viewport", async ({}, testInfo) => {
	await instance.page.evaluate(() =>
		(window as any).require("electron").remote.getCurrentWindow().unmaximize()
	);
	await setObsidianViewport(instance.page, { width: 480, height: 800 });
	await instance.page.evaluate(() => {
		document.body.classList.add("is-mobile", "theme-dark");
		document.body.classList.remove("theme-light");
	});
	await openView();
	const cdp = await instance.page.context().newCDPSession(instance.page);
	try {
		await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
		const handle = await card("Source")
			.getByRole("button", { name: "Move task" })
			.boundingBox();
		const x = handle!.x + handle!.width / 2,
			y = handle!.y + handle!.height / 2;
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ x, y, id: 1 }],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [{ x: x + 12, y, id: 1 }],
		});
		const target = card("Done").locator(
			":scope > .task-card__main-row > .task-list-view__parent-target"
		);
		await expect(target).toBeVisible();
		const bounds = await target.boundingBox();
		expect(bounds!.height).toBeGreaterThanOrEqual(44);
		for (let step = 1; step <= 8; step++)
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: [
					{
						x: x + ((bounds!.x + bounds!.width / 2 - x) * step) / 8,
						y: y + ((bounds!.y + bounds!.height / 2 - y) * step) / 8,
						id: 1,
					},
				],
			});
		await expect(instance.page.locator(".task-list-view__movement-feedback")).toContainText(
			"Add as subtask of Done"
		);
		await instance.page.screenshot({
			path: testInfo.outputPath("touch-parent-dark-preview.png"),
		});
		await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
		await expect.poll(async () => (await frontmatter()).projects).toHaveLength(1);
		await expect(instance.page.locator(".task-list-view__touch-ghost")).toHaveCount(0);
		expect(await frontmatter()).toMatchObject({
			status: "open",
			priority: "high",
			tasknotes_manual_order: sourceRank,
		});
	} finally {
		await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
		await cdp.detach();
		await instance.page.evaluate(() => {
			document.body.classList.remove("theme-dark");
			document.body.classList.add("theme-light");
		});
	}
});

test("due-sorted movement previews both properties and preserves manual rank", async ({}, testInfo) => {
	await openView();
	await beginMouseDrag(card("Done"));
	const feedback = instance.page.locator(".task-list-view__movement-feedback");
	await expect(feedback).toContainText("status → done");
	await expect(feedback).toContainText("priority → low");
	await expect(
		instance.page.locator(".task-list-view__drop-slot-before, .task-list-view__drop-slot-after")
	).toHaveCount(0);
	await instance.page.screenshot({ path: testInfo.outputPath("desktop-move-preview.png") });
	await instance.page.mouse.up();
	await expect.poll(async () => (await frontmatter()).status).toBe("done");
	expect(await frontmatter()).toMatchObject({
		priority: "low",
		tasknotes_manual_order: sourceRank,
	});
	expect((await frontmatter()).completedDate).toBeTruthy();
	await expect(feedback).toHaveCount(0);
});

test("movement feedback stays readable in the native dark theme", async ({}, testInfo) => {
	await instance.page.evaluate(() => {
		document.body.classList.remove("theme-light");
		document.body.classList.add("theme-dark");
	});
	try {
		await openView();
		await beginMouseDrag(card("Done"));
		await expect(instance.page.locator(".task-list-view__movement-feedback")).toContainText(
			"status → done"
		);
		await instance.page.screenshot({ path: testInfo.outputPath("dark-move-preview.png") });
		await instance.page.keyboard.press("Escape");
	} finally {
		await instance.page.evaluate(() => {
			document.body.classList.remove("theme-dark");
			document.body.classList.add("theme-light");
		});
	}
});

test("primary-header drops preserve the task subgroup", async () => {
	await openView();
	const header = instance.page.locator(
		'.workspace-leaf.mod-active .task-group[data-level="primary"][data-group-key="done"]'
	);
	await card("Source").dragTo(header);
	await expect.poll(async () => (await frontmatter()).status).toBe("done");
	expect((await frontmatter()).priority).toBe("high");
});

test("collapsed subgroups remain usable destinations", async () => {
	await openView();
	const header = instance.page.locator(
		'.workspace-leaf.mod-active .task-group[data-level="sub"][data-group-key="open:low"]'
	);
	await header.locator("button").click();
	await expect(card("Low")).toHaveCount(0);
	await card("Source").dragTo(header);
	await expect.poll(async () => (await frontmatter()).priority).toBe("low");
	expect((await frontmatter()).status).toBe("open");
});

test("configured empty subgroups have explicit drop destinations", async () => {
	await openView();
	const source = await card("Source").boundingBox();
	await instance.page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
	await instance.page.mouse.down();
	await instance.page.mouse.move(
		source!.x + source!.width / 2 + 10,
		source!.y + source!.height / 2,
		{ steps: 3 }
	);
	const destination = instance.page.getByText("open / normal", { exact: true });
	await expect(destination).toBeVisible();
	const target = await destination.boundingBox();
	await instance.page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, {
		steps: 10,
	});
	await instance.page.mouse.up();
	await expect.poll(async () => (await frontmatter()).priority).toBe("normal");
	expect((await frontmatter()).tasknotes_manual_order).toBe(sourceRank);
});

test("the movement handle exposes a keyboard-accessible group menu", async () => {
	await openView();
	const handle = card("Source").getByRole("button", { name: "Move task" });
	await handle.focus();
	await handle.press("Enter");
	const group = instance.page.locator(".menu-item").filter({ hasText: /^open$/ });
	await expect(group).toBeVisible();
	await group.hover();
	const destination = instance.page.locator(".menu-item").filter({ hasText: /^normal$/ });
	await expect(destination).toBeVisible();
	await destination.click();
	await expect.poll(async () => (await frontmatter()).priority).toBe("normal");
});

test("releasing a drag back on its own row cancels instead of moving to a neighbour", async () => {
	await openView();
	// "Low" is alone in open / low, so the nearest other row belongs to a different subgroup.
	const before = await frontmatter("Low");
	const bounds = await card("Low").boundingBox();
	const x = bounds!.x + bounds!.width / 2;
	const y = bounds!.y + bounds!.height / 2;
	await card("Low").hover();
	await instance.page.mouse.move(x, y);
	await instance.page.mouse.down();
	await instance.page.mouse.move(x + 12, y, { steps: 3 });
	await instance.page.mouse.move(x, y, { steps: 3 });
	await instance.page.mouse.up();
	await instance.page.waitForTimeout(500);
	expect(await frontmatter("Low")).toEqual(before);
});

test("a touch hold released in place never writes", async () => {
	await instance.page.evaluate(() => document.body.classList.add("is-mobile"));
	await openView();
	const before = await frontmatter("Low");
	const cdp = await instance.page.context().newCDPSession(instance.page);
	try {
		await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
		const handle = await card("Low").getByRole("button", { name: "Move task" }).boundingBox();
		const point = { x: handle!.x + handle!.width / 2, y: handle!.y + handle!.height / 2 };
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ ...point, id: 1 }],
		});
		await instance.page.waitForTimeout(400);
		await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
		await instance.page.waitForTimeout(500);
		await expect(instance.page.locator(".task-list-view__touch-ghost")).toHaveCount(0);
		await expect(instance.page.locator("body")).not.toHaveClass(/tn-drag-active/);
		expect(await frontmatter("Low")).toEqual(before);
	} finally {
		await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
		await cdp.detach();
	}
});

test("list moves preview the whole replacement before and after", async () => {
	await openView({ group: "note.contexts", subgroup: null });
	await beginMouseDrag(card("Low"));
	await expect(instance.page.locator(".task-list-view__movement-feedback")).toContainText(
		"work, call → home, focus"
	);
	await instance.page.mouse.up();
	await expect.poll(async () => (await frontmatter()).contexts).toEqual(["home", "focus"]);
});

test("a list move keeps a value added by another edit during the drag", async () => {
	await openView({ group: "note.contexts", subgroup: null });
	await beginMouseDrag(card("Low"));
	await expect(instance.page.locator(".task-list-view__movement-feedback")).toContainText(
		"work, call → home, focus"
	);
	await setFields("Source", { contexts: ["work", "call", "errands"] });
	await expect.poll(async () => (await frontmatter()).contexts).toHaveLength(3);
	await instance.page.mouse.up();
	await expect
		.poll(async () => (await frontmatter()).contexts)
		.toEqual(["errands", "home", "focus"]);
});

test("the keyboard menu reorders within the destination without moving properties", async () => {
	await openView({ manual: true });
	const handle = card("Source").getByRole("button", { name: "Move task" });
	await handle.focus();
	await handle.press("Enter");
	await expect(
		instance.page.locator(".menu-item").filter({ hasText: /^Move down$/ })
	).toHaveCount(0);
	await instance.page
		.locator(".menu-item")
		.filter({ hasText: /^Move up$/ })
		.click();
	await expect
		.poll(async () => String((await frontmatter()).tasknotes_manual_order) > "0|i0000n:")
		.toBe(true);
	expect(await frontmatter()).toMatchObject({ status: "open", priority: "high" });
});

test("same-destination drops are a no-op when not manually sorted", async () => {
	await openView();
	const before = await frontmatter();
	await card("Source").dragTo(card("High peer"));
	await instance.page.waitForTimeout(500);
	expect(await frontmatter()).toEqual(before);
});

test("manual reordering is scoped to the subgroup and does not move properties", async () => {
	await openView({ manual: true });
	const lowBefore = await frontmatter("Low");
	const doneBefore = await frontmatter("Done");
	await card("Source").dragTo(card("High peer"), { targetPosition: { x: 60, y: 4 } });
	await expect
		.poll(async () => (await frontmatter()).tasknotes_manual_order)
		.not.toBe(sourceRank);
	expect(await frontmatter()).toMatchObject({ status: "open", priority: "high" });
	expect(await frontmatter("Low")).toEqual(lowBefore);
	expect(await frontmatter("Done")).toEqual(doneBefore);
});

test("Escape cancels a preview without writing metadata", async () => {
	await openView();
	const before = await frontmatter();
	await beginMouseDrag(card("Done"));
	await expect(instance.page.locator(".task-list-view__movement-feedback")).toBeVisible();
	await instance.page.keyboard.press("Escape");
	await instance.page.mouse.up();
	await expect(instance.page.locator(".task-list-view__movement-feedback")).toHaveCount(0);
	expect(await frontmatter()).toEqual(before);
});

test("formula-group moves are visibly blocked, not partially applied", async () => {
	await openView({ group: "formula.bucket", formula: true });
	const before = await frontmatter();
	await beginMouseDrag(card("Done"));
	await expect(instance.page.locator(".task-list-view__movement-feedback")).toContainText(
		"read-only"
	);
	await instance.page.mouse.up();
	expect(await frontmatter()).toEqual(before);
});

test("combined list destinations use real memberships rather than display strings", async () => {
	await openView({ group: "note.contexts", subgroup: null });
	await card("Source").dragTo(card("Low"));
	await expect.poll(async () => (await frontmatter()).contexts).toEqual(["home", "focus"]);
	expect((await frontmatter()).tasknotes_manual_order).toBe(sourceRank);
});

test("formula subgroups block a combined move instead of partially changing status", async () => {
	await openView({ subgroup: "formula.bucket", formula: true });
	const before = await frontmatter();
	await beginMouseDrag(card("Done"));
	await expect(instance.page.locator(".task-list-view__movement-feedback")).toContainText(
		"read-only"
	);
	await instance.page.mouse.up();
	expect(await frontmatter()).toEqual(before);
});

test("boolean subgroup moves preserve the boolean type and manual rank", async () => {
	await openView({ subgroup: "note.flag" });
	await card("Source").dragTo(card("Low"));
	await expect.poll(async () => (await frontmatter()).flag).toBe(true);
	expect(await frontmatter()).toMatchObject({
		status: "open",
		priority: "high",
		tasknotes_manual_order: sourceRank,
	});
});

test("numeric group moves preserve the number type in frontmatter and task cache", async () => {
	await openView({ group: "note.timeEstimate", subgroup: null });
	await card("Source").dragTo(card("Low"));
	await expect.poll(async () => (await frontmatter()).timeEstimate).toBe(15);
	await expect
		.poll(() =>
			instance.page.evaluate(
				async (folder) =>
					(
						await (window as any).app.plugins
							.getPlugin("tasknotes")
							.cacheManager.getTaskInfo(`${folder}/Source.md`)
					).timeEstimate,
				folder
			)
		)
		.toBe(15);
	expect((await frontmatter()).tasknotes_manual_order).toBe(sourceRank);
});

test("the keyboard menu uses actual list memberships rather than joined labels", async () => {
	await openView({ group: "note.contexts", subgroup: null });
	await card("Source").getByRole("button", { name: "Move task" }).focus();
	await instance.page.keyboard.press("Enter");
	await instance.page
		.locator(".menu-item")
		.filter({ hasText: /^home, focus$/ })
		.click();
	await expect.poll(async () => (await frontmatter()).contexts).toEqual(["home", "focus"]);
});

test("clearing a priority deletes its value without putting null into the task cache", async () => {
	await openView();
	await beginMouseDrag(card("Source"));
	const destination = instance.page
		.locator(".task-list-view__destination")
		.filter({ hasText: /^open \/ No value$/ });
	await expect(destination).toBeVisible();
	const rect = await destination.boundingBox();
	await instance.page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2, {
		steps: 8,
	});
	await instance.page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
	await instance.page.mouse.up();
	await expect.poll(async () => (await frontmatter()).priority).toBeUndefined();
	await expect
		.poll(() =>
			instance.page.evaluate(async (folder) => {
				const plugin = (window as any).app.plugins.getPlugin("tasknotes");
				return (await plugin.cacheManager.getTaskInfo(`${folder}/Source.md`)).priority;
			}, folder)
		)
		.toBe("normal");
	expect((await frontmatter()).tasknotes_manual_order).toBe(sourceRank);
});

test("an all-empty primary group still keeps subgroup movement on the correct property", async () => {
	await instance.page.evaluate(async (folder) => {
		const app = (window as any).app;
		for (const title of ["Source", "Low", "Done", "High peer"])
			await app.fileManager.processFrontMatter(
				app.vault.getAbstractFileByPath(`${folder}/${title}.md`),
				(fm: any) => {
					delete fm.status;
				}
			);
	}, folder);
	await openView();
	await card("Source").dragTo(card("Low"));
	await expect.poll(async () => (await frontmatter()).priority).toBe("low");
	expect((await frontmatter()).status).toBeUndefined();
});

test("Undo restores group fields and completion metadata while preserving later unrelated edits", async () => {
	await openView();
	await card("Source").dragTo(card("Done"));
	await expect.poll(async () => (await frontmatter()).status).toBe("done");
	await instance.page.evaluate(async (folder) => {
		const app = (window as any).app;
		await app.fileManager.processFrontMatter(
			app.vault.getAbstractFileByPath(`${folder}/Source.md`),
			(fm: any) => {
				fm.description = "Keep this later edit";
			}
		);
	}, folder);
	await instance.page.getByRole("button", { name: "Undo", exact: true }).last().click();
	await expect.poll(async () => (await frontmatter()).status).toBe("open");
	expect(await frontmatter()).toMatchObject({
		priority: "high",
		tasknotes_manual_order: sourceRank,
		description: "Keep this later edit",
	});
	expect((await frontmatter()).completedDate).toBeUndefined();
});

test("Undo refuses to overwrite a later edit to a moved field", async () => {
	await openView();
	await card("Source").dragTo(card("Done"));
	await expect.poll(async () => (await frontmatter()).status).toBe("done");
	await instance.page.evaluate(async (folder) => {
		const app = (window as any).app;
		await app.fileManager.processFrontMatter(
			app.vault.getAbstractFileByPath(`${folder}/Source.md`),
			(fm: any) => {
				fm.priority = "normal";
			}
		);
	}, folder);
	await expect.poll(async () => (await frontmatter()).priority).toBe("normal");
	await instance.page.getByRole("button", { name: "Undo", exact: true }).last().click();
	await expect(instance.page.locator(".notice").filter({ hasText: "Cannot undo" })).toBeVisible();
	expect(await frontmatter()).toMatchObject({ status: "done", priority: "normal" });
});

test("handle-only touch movement works at a narrow viewport and cleans up its ghost", async ({}, testInfo) => {
	await instance.page.evaluate(() =>
		(window as any).require("electron").remote.getCurrentWindow().unmaximize()
	);
	await setObsidianViewport(instance.page, { width: 480, height: 800 });
	await instance.page.evaluate(() => document.body.classList.add("is-mobile"));
	await openView();
	const before = await frontmatter();
	const cdp = await instance.page.context().newCDPSession(instance.page);
	try {
		await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
		await card("Source").getByRole("button", { name: "Move task" }).hover();
		const start = await card("Source").getByRole("button", { name: "Move task" }).boundingBox();
		const target = await card("Low").boundingBox();
		const x = start!.x + start!.width / 2;
		const y = start!.y + start!.height / 2;
		const targetX = target!.x + target!.width / 2;
		const targetY = target!.y + target!.height / 2;
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ x, y, id: 1 }],
		});
		for (let step = 1; step <= 8; step++) {
			await cdp.send("Input.dispatchTouchEvent", {
				type: "touchMove",
				touchPoints: [
					{ x: x + ((targetX - x) * step) / 8, y: y + ((targetY - y) * step) / 8, id: 1 },
				],
			});
		}
		await expect(instance.page.locator(".task-list-view__movement-feedback")).toContainText(
			"priority → low"
		);
		expect(await frontmatter()).toEqual(before);
		await expect(instance.page.locator(".task-list-view__touch-ghost")).toBeVisible();
		const ghostBounds = await instance.page
			.locator(".task-list-view__touch-ghost")
			.boundingBox();
		expect(Math.abs(ghostBounds!.x - (targetX + 12))).toBeLessThan(20);
		expect(Math.abs(ghostBounds!.y - (targetY + 12))).toBeLessThan(20);
		await instance.page.screenshot({ path: testInfo.outputPath("touch-move-preview.png") });
		await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
		await expect.poll(async () => (await frontmatter()).priority).toBe("low");
		expect(await frontmatter()).toMatchObject({
			status: "open",
			tasknotes_manual_order: sourceRank,
		});
		await expect(instance.page.locator(".task-list-view__touch-ghost")).toHaveCount(0);
		await expect(instance.page.locator(".menu")).toHaveCount(0);
		await expect(card("Source")).toHaveAttribute("data-priority", "low");
		const afterMove = await frontmatter();
		const handle = await card("Source")
			.getByRole("button", { name: "Move task" })
			.boundingBox();
		const cancelX = handle!.x + handle!.width / 2;
		const cancelY = handle!.y + handle!.height / 2;
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchStart",
			touchPoints: [{ x: cancelX, y: cancelY, id: 1 }],
		});
		await cdp.send("Input.dispatchTouchEvent", {
			type: "touchMove",
			touchPoints: [{ x: cancelX + 12, y: cancelY, id: 1 }],
		});
		await expect(instance.page.locator(".task-list-view__touch-ghost")).toBeVisible();
		await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
		await expect(instance.page.locator(".task-list-view__touch-ghost")).toHaveCount(0);
		expect(await frontmatter()).toEqual(afterMove);
	} finally {
		await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
		await cdp.detach();
	}
});

test("edge scrolling follows a held touch handle and stops on cancellation without writing metadata", async () => {
	await instance.page.evaluate(() => document.body.classList.add("is-mobile"));
	await instance.page.evaluate(async (folder) => {
		const app = (window as any).app;
		for (let index = 0; index < 60; index++)
			await app.vault.create(
				`${folder}/Scroll ${index}.md`,
				`---\ntitle: Scroll ${index}\nstatus: open\npriority: high\ndue: 2027-10-10\ntags: [task]\n---\n`
			);
	}, folder);
	await openView();
	await expect(instance.page.locator(".workspace-leaf.mod-active .task-card")).toHaveCount(64);
	await card("Source").scrollIntoViewIfNeeded();
	await card("Source").evaluate((element) => {
		let scroller = element.closest<HTMLElement>(".tn-bases-items-container");
		while (scroller && scroller.scrollHeight <= scroller.clientHeight)
			scroller = scroller.parentElement;
		if (scroller) scroller.dataset.movementTestScroller = "true";
	});
	const scroller = instance.page.locator('[data-movement-test-scroller="true"]');
	const initialTop = await scroller.evaluate((element) => element.scrollTop);
	expect(initialTop).toBeGreaterThan(100);
	const before = await frontmatter();
	const cdp = await instance.page.context().newCDPSession(instance.page);
	await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
	const handle = await card("Source").getByRole("button", { name: "Move task" }).boundingBox();
	const bounds = await scroller.boundingBox();
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchStart",
		touchPoints: [
			{ x: handle!.x + handle!.width / 2, y: handle!.y + handle!.height / 2, id: 1 },
		],
	});
	await cdp.send("Input.dispatchTouchEvent", {
		type: "touchMove",
		touchPoints: [{ x: bounds!.x + bounds!.width / 2, y: bounds!.y + 8, id: 1 }],
	});
	await expect
		.poll(() => scroller.evaluate((element) => element.scrollTop))
		.toBeLessThan(initialTop - 60);
	await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
	await expect(instance.page.locator("body")).not.toHaveClass(/tn-drag-active/);
	await instance.page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			)
	);
	const stoppedTop = await scroller.evaluate((element) => element.scrollTop);
	await instance.page.waitForTimeout(150);
	const settled = await scroller.evaluate((element) => ({
		top: element.scrollTop,
		max: element.scrollHeight - element.clientHeight,
	}));
	// Removing the temporary destinations/footer may clamp the scroll range.
	expect(settled.top).toBe(Math.min(stoppedTop, settled.max));
	expect(await frontmatter()).toEqual(before);
	await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
	await cdp.detach();
});
