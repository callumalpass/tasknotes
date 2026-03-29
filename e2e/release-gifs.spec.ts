import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import { closeObsidian, launchObsidian, ObsidianApp, runCommand } from "./obsidian";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const E2E_VAULT_DIR = path.join(PROJECT_ROOT, "tasknotes-e2e-vault");
const GIF_ROOT = path.join(PROJECT_ROOT, "test-results", "release-gifs");
const FRAME_ROOT = path.join(PROJECT_ROOT, "test-results", "release-gif-frames");
const DOC_VIEWPORT = { width: 1400, height: 900 };

let app: ObsidianApp;

type BackupMap = Map<string, string | null>;

class GifRecorder {
	private frameIndex = 0;
	private readonly frameDir: string;
	private readonly gifPath: string;
	private readonly palettePath: string;

	constructor(private readonly name: string) {
		this.frameDir = path.join(FRAME_ROOT, name);
		this.gifPath = path.join(GIF_ROOT, `${name}.gif`);
		this.palettePath = path.join(this.frameDir, "palette.png");
		fs.rmSync(this.frameDir, { recursive: true, force: true });
		fs.mkdirSync(this.frameDir, { recursive: true });
		fs.mkdirSync(GIF_ROOT, { recursive: true });
	}

	private nextFramePath(): string {
		return path.join(this.frameDir, `frame-${String(this.frameIndex).padStart(3, "0")}.png`);
	}

	async capture(page: Page, holdFrames = 1): Promise<void> {
		const firstFramePath = this.nextFramePath();
		await page.screenshot({ path: firstFramePath });
		this.frameIndex += 1;

		for (let i = 1; i < holdFrames; i += 1) {
			const duplicatePath = this.nextFramePath();
			fs.copyFileSync(firstFramePath, duplicatePath);
			this.frameIndex += 1;
		}
	}

	finalize(): string {
		if (this.frameIndex === 0) {
			throw new Error(`No frames captured for ${this.name}`);
		}

		const inputPattern = path.join(this.frameDir, "frame-%03d.png");
		execFileSync(
			"ffmpeg",
			[
				"-y",
				"-framerate",
				"3",
				"-i",
				inputPattern,
				"-vf",
				"fps=8,scale=1200:-1:flags=lanczos,palettegen",
				this.palettePath,
			],
			{ stdio: "ignore" }
		);
		execFileSync(
			"ffmpeg",
			[
				"-y",
				"-framerate",
				"3",
				"-i",
				inputPattern,
				"-i",
				this.palettePath,
				"-lavfi",
				"fps=8,scale=1200:-1:flags=lanczos[x];[x][1:v]paletteuse",
				this.gifPath,
			],
			{ stdio: "ignore" }
		);

		return this.gifPath;
	}
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
	app = await launchObsidian();
	await app.page.setViewportSize(DOC_VIEWPORT);
	fs.mkdirSync(GIF_ROOT, { recursive: true });
	fs.mkdirSync(FRAME_ROOT, { recursive: true });
});

test.afterAll(async () => {
	if (app) {
		await closeObsidian(app);
	}
});

function getPage(): Page {
	if (!app?.page) {
		throw new Error("Obsidian app not initialized");
	}
	return app.page;
}

function vaultPath(relativePath: string): string {
	return path.join(E2E_VAULT_DIR, relativePath);
}

function backupFiles(relativePaths: string[]): BackupMap {
	const backup = new Map<string, string | null>();
	for (const relativePath of relativePaths) {
		const fullPath = vaultPath(relativePath);
		backup.set(relativePath, fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : null);
	}
	return backup;
}

function restoreFiles(backup: BackupMap): void {
	for (const [relativePath, original] of backup.entries()) {
		const fullPath = vaultPath(relativePath);
		if (original === null) {
			fs.rmSync(fullPath, { force: true });
			continue;
		}
		fs.mkdirSync(path.dirname(fullPath), { recursive: true });
		fs.writeFileSync(fullPath, original);
	}
}

function writeVaultFile(relativePath: string, content: string): void {
	const fullPath = vaultPath(relativePath);
	fs.mkdirSync(path.dirname(fullPath), { recursive: true });
	fs.writeFileSync(fullPath, content);
}

function formatDate(date: Date): string {
	return date.toISOString().slice(0, 10);
}

function formatDateTime(date: Date, hours: number, minutes = 0): string {
	const copy = new Date(date);
	copy.setHours(hours, minutes, 0, 0);
	return copy.toISOString().slice(0, 16);
}

async function ensureCleanState(page: Page): Promise<void> {
	for (let i = 0; i < 3; i += 1) {
		await page.keyboard.press("Escape");
		await page.waitForTimeout(100);
	}
	await page.waitForTimeout(400);
}

async function openFileByPath(page: Page, relativePath: string): Promise<void> {
	const opened = await page.evaluate(async (targetPath) => {
		const obsidianApp = (window as any).app;
		const file = obsidianApp?.vault?.getAbstractFileByPath?.(targetPath);
		if (!file) return false;
		await obsidianApp.workspace.getLeaf(true).openFile(file);
		return true;
	}, relativePath);

	if (!opened) {
		throw new Error(`Could not open ${relativePath}`);
	}

	const fileLabel = path.basename(relativePath, path.extname(relativePath));
	const tabHeader = page.locator(`.workspace-tab-header:has-text("${fileLabel}")`).last();
	if (await tabHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
		await tabHeader.click();
		await page.waitForTimeout(400);
	}

	await page.waitForTimeout(1400);
}

async function reloadWithoutSaving(page: Page): Promise<void> {
	await runCommand(page, "Reload app without saving");
	await page.waitForTimeout(3500);
}

async function setPluginSettings(page: Page, patch: Record<string, unknown>): Promise<void> {
	await page.evaluate(async (settingsPatch) => {
		const obsidianApp = (window as any).app;
		const plugin = obsidianApp?.plugins?.plugins?.["tasknotes"];
		if (!plugin?.settings) {
			throw new Error("TaskNotes plugin not available");
		}

		const mergeInto = (target: any, source: any) => {
			for (const [key, value] of Object.entries(source)) {
				if (
					value &&
					typeof value === "object" &&
					!Array.isArray(value) &&
					target[key] &&
					typeof target[key] === "object" &&
					!Array.isArray(target[key])
				) {
					mergeInto(target[key], value);
				} else {
					target[key] = value;
				}
			}
		};

		mergeInto(plugin.settings, settingsPatch);
		if (typeof settingsPatch.uiLanguage === "string") {
			plugin.i18n?.setLocale?.(settingsPatch.uiLanguage);
		}
		await plugin.saveSettings?.();
	}, patch);
	await page.waitForTimeout(1200);
}

async function openTaskListByPath(page: Page, relativePath: string): Promise<void> {
	await openFileByPath(page, relativePath);
	const activeLeaf = page.locator(".workspace-leaf.mod-active").first();
	await activeLeaf.waitFor({ state: "visible", timeout: 10000 });
	const hasRenderableList = await activeLeaf
		.locator('.task-list-view, [data-type="tasknotesTaskList"], .task-card, [class*="bases"]')
		.first()
		.isVisible({ timeout: 3000 })
		.catch(() => false);
	if (!hasRenderableList) {
		await page.waitForTimeout(1200);
	}
}

async function openCalendarByPath(page: Page, relativePath: string): Promise<void> {
	await openFileByPath(page, relativePath);
	const calendar = page.locator(".workspace-leaf.mod-active .fc, .workspace-leaf.mod-active .tasknotes-calendar-view").first();
	await calendar.waitFor({ state: "visible", timeout: 10000 });
}

async function openTaskNote(page: Page, relativePath: string): Promise<void> {
	await openFileByPath(page, relativePath);
	await page.waitForTimeout(1200);
}

function createTaskListBase(name: string, extra = ""): string {
	return `filters:
  and:
    - file.hasTag("task")
views:
  - type: tasknotesTaskList
    name: "${name}"
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - blockedBy
      - file.name
${extra}`;
}

function createKanbanBase(name: string, extra = ""): string {
	return `filters:
  and:
    - file.hasTag("task")
views:
  - type: tasknotesKanban
    name: "${name}"
    order:
      - status
      - priority
      - due
      - scheduled
      - projects
      - contexts
      - blockedBy
      - file.name
    groupBy:
      property: status
      direction: ASC
${extra}`;
}

function createCalendarBase(name: string, extraOptions = ""): string {
	return `filters:
  and:
    - file.hasTag("task")
views:
  - type: tasknotesCalendar
    name: "${name}"
    order:
      - status
      - priority
      - due
      - scheduled
      - file.name
    options:
      showScheduled: true
      showDue: true
      showRecurring: true
      showTimeEntries: true
      calendarView: timeGridWeek
      slotMinTime: 06:00:00
      slotMaxTime: 22:00:00
      slotDuration: 00:30:00
${extraOptions}`;
}

test("current-day-column-width", async () => {
	const page = getPage();
	const today = new Date();
	const taskPath = "TaskNotes/Release GIF Fixtures/today-width-demo.md";
	const basePath = "TaskNotes/Views/release-gif-calendar-width.base";
	const backup = backupFiles([taskPath, basePath]);

	try {
		writeVaultFile(
			taskPath,
			`---
title: Today width demo
status: open
priority: normal
scheduled: ${formatDateTime(today, 11)}
due: ${formatDateTime(today, 13)}
tags:
  - task
---

# Today width demo
`
		);
		writeVaultFile(basePath, createCalendarBase("Today Width Demo", "      todayColumnWidthMultiplier: 1\n"));

		await ensureCleanState(page);
		const recorder = new GifRecorder("release-1704-today-column-width");

		await openCalendarByPath(page, basePath);
		await recorder.capture(page, 4);

		const propertiesButton = page.locator('button:has-text("Properties"), [aria-label*="Properties"]').first();
		if (await propertiesButton.isVisible({ timeout: 3000 }).catch(() => false)) {
			await propertiesButton.click();
			await page.waitForTimeout(500);
			await recorder.capture(page, 2);
			await page.keyboard.press("Escape");
			await page.waitForTimeout(300);
		}

		writeVaultFile(basePath, createCalendarBase("Today Width Demo", "      todayColumnWidthMultiplier: 3\n"));
		await openCalendarByPath(page, basePath);
		await recorder.capture(page, 6);

		recorder.finalize();
	} finally {
		restoreFiles(backup);
	}
});

test("bases-date-values", async () => {
	const page = getPage();
	const basePath = "TaskNotes/Views/release-gif-bases-date-values.base";
	const backup = backupFiles([basePath]);

	try {
		writeVaultFile(
			basePath,
			createTaskListBase(
				"Bases Date Values",
				`    filters:
      and:
        - file.name == "Review project proposal" || file.name == "Buy groceries"
`
			)
		);

		await ensureCleanState(page);
		const recorder = new GifRecorder("release-1720-bases-date-values");

		await openTaskListByPath(page, basePath);
		await recorder.capture(page, 5);

		recorder.finalize();
	} finally {
		restoreFiles(backup);
	}
});

test("translated-task-card-labels", async () => {
	const page = getPage();
	const dataPath = ".obsidian/plugins/tasknotes/data.json";
	const backup = backupFiles([dataPath]);

	try {
		await ensureCleanState(page);
		await setPluginSettings(page, { uiLanguage: "fr" });

		const recorder = new GifRecorder("release-1633-translated-task-card-labels");
		await openTaskNote(page, "TaskNotes/Review project proposal.md");
		await recorder.capture(page, 4);

		await openTaskNote(page, "TaskNotes/Write documentation.md");
		await recorder.capture(page, 4);

		recorder.finalize();
	} finally {
		restoreFiles(backup);
		await reloadWithoutSaving(page);
	}
});

test.skip("expanded-relationships-filter-mode", async () => {
	const page = getPage();
	const parentPath = "TaskNotes/Release GIF Fixtures/Relationships Parent.md";
	const doneChildPath = "TaskNotes/Release GIF Fixtures/Relationships Done Child.md";
	const openChildPath = "TaskNotes/Release GIF Fixtures/Relationships Open Child.md";
	const inheritBasePath = "TaskNotes/Views/release-gif-relationships-inherit.base";
	const allBasePath = "TaskNotes/Views/release-gif-relationships-all.base";
	const backup = backupFiles([parentPath, doneChildPath, openChildPath, inheritBasePath, allBasePath]);

	try {
		writeVaultFile(
			parentPath,
			`---
title: Relationships Parent
status: open
priority: normal
scheduled: ${formatDate(new Date())}
tags:
  - task
---

# Relationships Parent
`
		);
		writeVaultFile(
			doneChildPath,
			`---
title: Relationships Done Child
status: done
priority: normal
projects:
  - "[[Relationships Parent]]"
tags:
  - task
---

# Relationships Done Child
`
		);
		writeVaultFile(
			openChildPath,
			`---
title: Relationships Open Child
status: open
priority: normal
projects:
  - "[[Relationships Parent]]"
tags:
  - task
---

# Relationships Open Child
`
		);
		writeVaultFile(
			inheritBasePath,
			createTaskListBase(
				"Inherit Filter",
				`    filters:
      and:
        - file.name == "Relationships Parent"
        - status != "done"
    options:
      expandedRelationshipFilterMode: inherit
`
			)
		);
		writeVaultFile(
			allBasePath,
			createTaskListBase(
				"Show All Relationships",
				`    filters:
      and:
        - file.name == "Relationships Parent"
        - status != "done"
    options:
      expandedRelationshipFilterMode: show-all
`
			)
		);

		await ensureCleanState(page);
		const recorder = new GifRecorder("release-1725-expanded-relationships-filter-mode");

		await openTaskListByPath(page, inheritBasePath);
		const inheritChevron = page.locator(".workspace-leaf.mod-active .task-card__chevron").first();
		await inheritChevron.click();
		await page.waitForTimeout(1200);
		await recorder.capture(page, 4);

		await openTaskListByPath(page, allBasePath);
		const allChevron = page.locator(".workspace-leaf.mod-active .task-card__chevron").first();
		await allChevron.click();
		await page.waitForTimeout(1200);
		await recorder.capture(page, 5);

		recorder.finalize();
	} finally {
		restoreFiles(backup);
	}
});

test("recurring-task-visible-without-complete-instances", async () => {
	const page = getPage();
	const today = new Date();
	const taskPath = "TaskNotes/Release GIF Fixtures/Recurring visibility demo.md";
	const basePath = "TaskNotes/Views/release-gif-recurring-visible.base";
	const backup = backupFiles([taskPath, basePath]);

	try {
		writeVaultFile(
			taskPath,
			`---
title: Recurring visibility demo
status: open
priority: normal
scheduled: ${formatDate(today)}
recurrence: FREQ=DAILY
tags:
  - task
---

# Recurring visibility demo
`
		);
		writeVaultFile(
			basePath,
			createTaskListBase(
				"Recurring Visible",
				`    filters:
      and:
        - file.name == "Recurring visibility demo"
`
			)
		);

		await ensureCleanState(page);
		const recorder = new GifRecorder("release-1644-recurring-visible");
		await openTaskListByPath(page, basePath);
		await recorder.capture(page, 5);
		recorder.finalize();
	} finally {
		restoreFiles(backup);
	}
});

test("calendar-visible-date-preserved", async () => {
	const page = getPage();
	const future = new Date();
	future.setMonth(future.getMonth() + 1, 14);
	const taskPath = "TaskNotes/Release GIF Fixtures/Future calendar edit.md";
	const basePath = "TaskNotes/Views/release-gif-calendar-preserve-date.base";
	const backup = backupFiles([taskPath, basePath]);

	try {
		writeVaultFile(
			taskPath,
			`---
title: Future calendar edit
status: open
priority: normal
scheduled: ${formatDateTime(future, 10)}
due: ${formatDateTime(future, 11)}
tags:
  - task
---

# Future calendar edit
`
		);
		writeVaultFile(basePath, createCalendarBase("Preserve Date", ""));

		await ensureCleanState(page);
		const recorder = new GifRecorder("release-1513-calendar-visible-date-preserved");

		await openCalendarByPath(page, basePath);
		const nextButton = page.locator(".workspace-leaf.mod-active .fc-next-button").first();
		await nextButton.click();
		await page.waitForTimeout(700);
		await recorder.capture(page, 3);

		const event = page.locator('.workspace-leaf.mod-active .fc-event:has-text("Future calendar edit")').first();
		await event.click();
		await page.waitForTimeout(800);
		const titleInput = page.locator('.modal input[type="text"]').first();
		await expect(titleInput).toBeVisible({ timeout: 5000 });
		await titleInput.fill("Future calendar edit updated");
		await page.waitForTimeout(400);
		const saveButton = page.locator('.modal button:has-text("Save"), .modal button.mod-cta').last();
		await saveButton.click();
		await page.waitForTimeout(1500);
		await recorder.capture(page, 5);

		recorder.finalize();
	} finally {
		restoreFiles(backup);
	}
});

test("readable-line-length-inline-card", async () => {
	const page = getPage();
	await ensureCleanState(page);
	const recorder = new GifRecorder("release-1630-readable-line-length");

	await page.evaluate(async () => {
		const obsidianApp = (window as any).app;
		const plugin = obsidianApp?.plugins?.plugins?.["tasknotes"];
		if (obsidianApp?.customCss?.setTheme) {
			try {
				await obsidianApp.customCss.setTheme("Minimal");
			} catch {
				// Best effort only.
			}
		}
		if (obsidianApp?.vault?.setConfig) {
			await obsidianApp.vault.setConfig("readableLineLength", true);
		}
		await plugin?.saveSettings?.();
		obsidianApp?.workspace?.trigger?.("css-change");
	});
	await page.waitForTimeout(1000);

	await openTaskNote(page, "TaskNotes/Buy groceries.md");
	await recorder.capture(page, 5);
	recorder.finalize();
});

test("modal-relationship-cards", async () => {
	const page = getPage();
	const parentPath = "TaskNotes/Release GIF Fixtures/Modal parent.md";
	const childPath = "TaskNotes/Release GIF Fixtures/Modal child.md";
	const blockerPath = "TaskNotes/Release GIF Fixtures/Modal blocker.md";
	const basePath = "TaskNotes/Views/release-gif-modal-relationships.base";
	const backup = backupFiles([parentPath, childPath, blockerPath, basePath]);

	try {
		writeVaultFile(
			parentPath,
			`---
title: Modal parent
status: open
priority: normal
scheduled: ${formatDateTime(new Date(), 9)}
blockedBy:
  - uid: "[[Modal blocker]]"
    reltype: FINISHTOSTART
tags:
  - task
---

# Modal parent
`
		);
		writeVaultFile(
			childPath,
			`---
title: Modal child
status: open
priority: normal
projects:
  - "[[Modal parent]]"
tags:
  - task
---

# Modal child
`
		);
		writeVaultFile(
			blockerPath,
			`---
title: Modal blocker
status: in-progress
priority: high
tags:
  - task
---

# Modal blocker
`
		);
		writeVaultFile(
			basePath,
			createTaskListBase(
				"Modal Relationships",
				`    filters:
      and:
        - file.name == "Modal parent"
`
			)
		);

		await ensureCleanState(page);
		const recorder = new GifRecorder("release-1716-modal-relationship-cards");
		await openTaskListByPath(page, basePath);
		const card = page.locator('.workspace-leaf.mod-active .task-card:has-text("Modal parent")').first();
		await card.click();
		await page.waitForTimeout(1000);
		await recorder.capture(page, 5);
		recorder.finalize();
	} finally {
		restoreFiles(backup);
	}
});

test.skip("drag-to-reorder-task-list", async () => {
	const page = getPage();
	const firstTaskPath = "TaskNotes/Release GIF Fixtures/Reorder alpha.md";
	const secondTaskPath = "TaskNotes/Release GIF Fixtures/Reorder beta.md";
	const thirdTaskPath = "TaskNotes/Release GIF Fixtures/Reorder gamma.md";
	const basePath = "TaskNotes/Views/release-gif-drag-reorder.base";
	const backup = backupFiles([firstTaskPath, secondTaskPath, thirdTaskPath, basePath]);

	try {
		writeVaultFile(
			firstTaskPath,
			`---
title: Reorder alpha
status: open
priority: normal
tasknotes_manual_order: 0|hzzzzz:
tags:
  - task
---

# Reorder alpha
`
		);
		writeVaultFile(
			secondTaskPath,
			`---
title: Reorder beta
status: open
priority: normal
tasknotes_manual_order: 0|i00007:
tags:
  - task
---

# Reorder beta
`
		);
		writeVaultFile(
			thirdTaskPath,
			`---
title: Reorder gamma
status: open
priority: normal
tasknotes_manual_order: 0|i0000f:
tags:
  - task
---

# Reorder gamma
`
		);
		writeVaultFile(
			basePath,
			createTaskListBase(
				"Manual Reorder",
				`    filters:
      and:
        - file.name == "Reorder alpha" || file.name == "Reorder beta" || file.name == "Reorder gamma"
    sort:
      - column: tasknotes_manual_order
        direction: DESC
`
			)
		);

		await ensureCleanState(page);
		const recorder = new GifRecorder("release-1619-drag-to-reorder");
		await openTaskListByPath(page, basePath);
		await recorder.capture(page, 3);

		const dragged = page.locator('.workspace-leaf.mod-active .task-card:has-text("Reorder gamma")').first();
		const target = page.locator('.workspace-leaf.mod-active .task-card:has-text("Reorder alpha")').first();
		await dragged.dragTo(target);
		await page.waitForTimeout(1800);
		await recorder.capture(page, 6);

		recorder.finalize();
	} finally {
		restoreFiles(backup);
	}
});
