/**
 * README screenshots.
 *
 * Builds a demo vault with realistic tasks (dates relative to today), opens it in
 * an isolated Obsidian instance at 2x scale, and writes the README images to
 * media/readme/ in light and dark themes.
 *
 * Run with: npm run build && npm run e2e:readme
 */

import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { closeObsidian, dismissObsidianModals, launchObsidian, ObsidianApp, setObsidianViewport } from "./obsidian";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEMO_VAULT = path.join(PROJECT_ROOT, "test-results", "readme-vault");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "media", "readme");
const VIEWPORT = { width: 1440, height: 900 };
const HERO_VIEWPORT = { width: 1600, height: 900 };
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

// The harness reads the vault path when it is imported, so the npm script sets it.
// Refuse to run against any other vault: building the demo vault deletes its contents.
if (path.resolve(process.env.TASKNOTES_E2E_VAULT_DIR ?? "") !== DEMO_VAULT) {
	throw new Error(`Run with TASKNOTES_E2E_VAULT_DIR=${DEMO_VAULT} (npm run e2e:readme)`);
}

let app: ObsidianApp;

// ---------------------------------------------------------------------------
// Demo vault
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

function day(offset: number): Date {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	d.setDate(d.getDate() + offset);
	return d;
}

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** Calendar-day offset of the nth working day from today (0 = today). */
function workday(n: number): number {
	let offset = 0;
	for (let remaining = Math.abs(n); remaining > 0; ) {
		offset += Math.sign(n);
		if (!isWeekend(day(offset))) remaining--;
	}
	return offset;
}

function date(offset: number): string {
	const d = day(offset);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Offset of today if it is a Friday, otherwise of the next Friday. */
const nextFriday = () => (5 - day(0).getDay() + 7) % 7;

const dateTime = (offset: number, time: string) => `${date(offset)}T${time}`;
const compactDate = (offset: number) => date(offset).replace(/-/g, "");

/** A finished time-tracking session, stored in UTC as TaskNotes stores it. */
function session(offset: number, start: string, minutes: number) {
	const [h, m] = start.split(":").map(Number);
	const begin = day(offset);
	begin.setHours(h, m);
	const end = new Date(begin.getTime() + minutes * 60000);
	return { startTime: begin.toISOString(), endTime: end.toISOString() };
}

function pastDays(count: number, filter: (d: Date) => boolean): string[] {
	const result: string[] = [];
	for (let offset = -1; result.length < count && offset > -60; offset--) {
		if (filter(day(offset))) result.push(date(offset));
	}
	return result;
}

type Frontmatter = Record<string, unknown>;

function yamlValue(value: unknown): string {
	if (!Array.isArray(value)) return ` ${typeof value === "string" ? JSON.stringify(value) : String(value)}`;
	return value
		.map((item) => {
			if (item && typeof item === "object") {
				return Object.entries(item as Record<string, unknown>)
					.map(([k, v], i) => `\n  ${i === 0 ? "- " : "  "}${k}: ${JSON.stringify(v)}`)
					.join("");
			}
			return `\n  - ${JSON.stringify(item)}`;
		})
		.join("");
}

function note(frontmatter: Frontmatter, body: string): string {
	const yaml = Object.entries(frontmatter)
		.filter(([, v]) => v !== undefined)
		.map(([k, v]) => `${k}:${yamlValue(v)}`)
		.join("\n");
	return `---\n${yaml}\n---\n\n${body.trim()}\n`;
}

interface DemoTask {
	title: string;
	status: string;
	priority: string;
	due?: string;
	scheduled?: string;
	contexts?: string[];
	projects?: string[];
	tags?: string[];
	timeEstimate?: number;
	timeEntries?: { startTime: string; endTime: string }[];
	recurrence?: string;
	complete_instances?: string[];
	blockedBy?: string[];
	completedDate?: string;
	body?: string;
}

function demoTasks(): DemoTask[] {
	const website = ["[[Website relaunch]]"];
	const talk = ["[[Conference talk]]"];
	return [
		{
			title: "Finalise homepage copy",
			status: "in-progress",
			priority: "high",
			due: date(workday(1)),
			scheduled: dateTime(0, "10:00"),
			contexts: ["writing"],
			projects: website,
			timeEstimate: 120,
			timeEntries: [session(workday(-2), "14:00", 50), session(workday(-1), "09:30", 45)],
			body: `
Tighten the hero section and the three feature blurbs. Keep the headline under eight words.

- [x] Hero headline
- [x] Feature blurbs
- [ ] Customer quote
- [ ] Final read-through with Sam
`,
		},
		{
			title: "Review analytics dashboard with Priya",
			status: "open",
			priority: "normal",
			scheduled: dateTime(0, "14:00"),
			contexts: ["meeting"],
			projects: website,
			timeEstimate: 60,
		},
		{
			title: "Fix mobile navigation overlap",
			status: "in-progress",
			priority: "high",
			scheduled: dateTime(workday(1), "09:30"),
			contexts: ["computer"],
			projects: website,
			tags: ["bug"],
			timeEstimate: 90,
			timeEntries: [session(workday(-1), "15:00", 40)],
		},
		{
			title: "Migrate blog posts to the new CMS",
			status: "open",
			priority: "normal",
			due: date(workday(3)),
			scheduled: dateTime(workday(2), "10:30"),
			contexts: ["computer"],
			projects: website,
			timeEstimate: 150,
		},
		{
			title: "Draft launch announcement",
			status: "open",
			priority: "normal",
			scheduled: dateTime(workday(1), "13:30"),
			contexts: ["writing"],
			projects: website,
			timeEstimate: 60,
		},
		{
			title: "Launch new website",
			status: "open",
			priority: "high",
			due: date(workday(4)),
			projects: website,
			blockedBy: ["Finalise homepage copy", "Migrate blog posts to the new CMS"],
		},
		{
			title: "Send invoice to Northwind",
			status: "open",
			priority: "high",
			due: date(workday(-2)),
			contexts: ["admin"],
			timeEstimate: 15,
		},
		{
			title: "Write conference talk outline",
			status: "open",
			priority: "normal",
			due: date(workday(7)),
			scheduled: dateTime(workday(3), "14:00"),
			contexts: ["writing"],
			projects: talk,
			timeEstimate: 90,
		},
		{
			title: "Book flights to Lisbon",
			status: "open",
			priority: "normal",
			due: date(workday(2)),
			contexts: ["errands"],
			projects: talk,
			timeEstimate: 20,
		},
		{
			title: "Order birthday present for Sam",
			status: "open",
			priority: "low",
			due: date(workday(2)),
			contexts: ["errands"],
		},
		{
			title: "Renew passport",
			status: "open",
			priority: "low",
			due: date(workday(9)),
			contexts: ["errands"],
		},
		{
			title: "Read chapter 4 of Shape Up",
			status: "open",
			priority: "none",
			contexts: ["reading"],
		},
		{
			title: "Plan the day",
			status: "open",
			priority: "normal",
			scheduled: dateTime(0, "09:00"),
			recurrence: `DTSTART:${compactDate(-21)};FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`,
			complete_instances: pastDays(10, (d) => !isWeekend(d)),
			timeEstimate: 15,
		},
		{
			title: "Weekly review",
			status: "open",
			priority: "normal",
			scheduled: dateTime(nextFriday(), "16:00"),
			recurrence: `DTSTART:${compactDate(-35)};FREQ=WEEKLY;BYDAY=FR`,
			complete_instances: pastDays(4, (d) => d.getDay() === 5),
			contexts: ["planning"],
			timeEstimate: 45,
		},
		{
			title: "Call plumber about kitchen tap",
			status: "done",
			priority: "normal",
			due: date(workday(-1)),
			contexts: ["phone"],
			completedDate: date(workday(-1)),
		},
		{
			title: "Set up staging environment",
			status: "done",
			priority: "high",
			projects: website,
			contexts: ["computer"],
			completedDate: date(workday(-2)),
			timeEstimate: 60,
			timeEntries: [session(workday(-3), "10:00", 75)],
		},
	];
}

function writeFile(relativePath: string, content: string): void {
	const target = path.join(DEMO_VAULT, relativePath);
	fs.mkdirSync(path.dirname(target), { recursive: true });
	fs.writeFileSync(target, content);
}

function buildDemoVault(): void {
	fs.rmSync(DEMO_VAULT, { recursive: true, force: true });

	writeFile(".obsidian/app.json", JSON.stringify({ readableLineLength: true, propertiesInDocument: "source" }, null, 2));
	writeFile(".obsidian/appearance.json", JSON.stringify({ theme: "moonstone" }, null, 2));
	writeFile(".obsidian/community-plugins.json", JSON.stringify(["tasknotes"]));
	writeFile(
		".obsidian/core-plugins.json",
		JSON.stringify(
			{
				"file-explorer": true,
				"global-search": true,
				switcher: true,
				"command-palette": true,
				"page-preview": true,
				properties: true,
				bases: true,
				"editor-status": false,
			},
			null,
			2
		)
	);

	const pluginDir = path.join(DEMO_VAULT, ".obsidian/plugins/tasknotes");
	fs.mkdirSync(pluginDir, { recursive: true });
	for (const file of ["main.js", "manifest.json", "styles.css"]) {
		const source = path.join(PROJECT_ROOT, file);
		if (!fs.existsSync(source)) throw new Error(`Missing ${file}; run npm run build first`);
		fs.copyFileSync(source, path.join(pluginDir, file));
	}
	fs.writeFileSync(
		path.join(pluginDir, "data.json"),
		JSON.stringify({ taskFilenameFormat: "title", showReleaseNotesOnUpdate: false, checkForUpdatesOnStartup: false }, null, 2)
	);

	for (const task of demoTasks()) {
		const { title, body, blockedBy, tags, ...fields } = task;
		const frontmatter: Frontmatter = {
			title,
			...fields,
			tags: ["task", ...(tags ?? [])],
			blockedBy: blockedBy?.map((t) => ({ uid: `[[${t}]]`, reltype: "FINISHTOSTART" })),
		};
		writeFile(`TaskNotes/Tasks/${title}.md`, note(frontmatter, body ?? ""));
	}

	writeFile("Projects/Website relaunch.md", "New marketing site, launching next week.\n");
	writeFile("Projects/Conference talk.md", "Talk at the Lisbon product conference.\n");
}

// ---------------------------------------------------------------------------
// Workspace helpers
// ---------------------------------------------------------------------------

function getPage(): Page {
	if (!app?.page) throw new Error("Obsidian app not initialized");
	return app.page;
}

async function setTheme(page: Page, theme: Theme): Promise<void> {
	await page.evaluate((mode) => {
		const appAny = (window as any).app;
		appAny.changeTheme(mode === "dark" ? "obsidian" : "moonstone");
	}, theme);
	await expect(page.locator("body")).toHaveClass(new RegExp(`theme-${theme}`));
}

/** Close every tab and sidebar so each capture starts from the same layout. */
async function resetWorkspace(page: Page): Promise<void> {
	await dismissObsidianModals(page);
	await page.evaluate(() => {
		const workspace = (window as any).app.workspace;
		for (const leaf of (window as any).__readmeLeaves ?? []) leaf.detach();
		(window as any).__readmeLeaves = [];
		workspace.iterateRootLeaves((leaf: any) => leaf.detach());
		workspace.leftSplit.collapse();
		workspace.rightSplit.collapse();
		document.querySelectorAll(".notice").forEach((notice) => notice.remove());
	});
}

/** Open a file, optionally in a new split and on a named Bases view. */
async function openFile(page: Page, file: string, options: { viewName?: string; split?: boolean } = {}): Promise<void> {
	await page.evaluate(
		async ({ file, viewName, split }) => {
			const workspace = (window as any).app.workspace;
			const opened: any[] = (window as any).__readmeLeaves ?? [];
			if (split) workspace.setActiveLeaf(opened[opened.length - 1], { focus: true });
			const leaf = workspace.getLeaf(split ? "split" : false, "vertical");
			if (file.endsWith(".base")) {
				await leaf.setViewState({ type: "bases", state: { file, ...(viewName ? { viewName } : {}) }, active: true });
			} else {
				await leaf.openFile((window as any).app.vault.getAbstractFileByPath(file), { active: true });
			}
			((window as any).__readmeLeaves ??= []).push(leaf);
		},
		{ file, ...options }
	);
}

async function waitForVaultFile(page: Page, filePath: string): Promise<void> {
	await expect
		.poll(() => page.evaluate((p) => !!(window as any).app.vault.getAbstractFileByPath(p), filePath), { timeout: 30000 })
		.toBe(true);
}

async function capture(page: Page, name: string, theme: Theme): Promise<void> {
	// Park the pointer away from hover targets and let layout and fonts settle.
	const viewport = page.viewportSize()!;
	await page.mouse.move(viewport.width - 1, viewport.height - 1);
	await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
	await page.waitForTimeout(800);
	await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}-${theme}.png`) });
}

const VIEWS = "TaskNotes/Views";

// ---------------------------------------------------------------------------
// Captures
// ---------------------------------------------------------------------------

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
	buildDemoVault();
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	app = await launchObsidian();
	await setObsidianViewport(app.page, VIEWPORT);
	await waitForVaultFile(app.page, `${VIEWS}/tasks-default.base`);
});

test.afterAll(async () => {
	if (app) await closeObsidian(app);
});

for (const theme of THEMES) {
	test.describe(`${theme} theme`, () => {
		test.beforeAll(async () => {
			await setTheme(getPage(), theme);
		});

		test("hero: task list beside the week calendar", async () => {
			const page = getPage();
			await setObsidianViewport(page, HERO_VIEWPORT);
			await resetWorkspace(page);
			await openFile(page, `${VIEWS}/tasks-default.base`, { viewName: "Not Blocked" });
			await openFile(page, `${VIEWS}/calendar-default.base`, { split: true });
			await page.evaluate(() => {
				const [list, calendar] = (window as any).__readmeLeaves;
				list.parent.setDimension(47);
				calendar.parent.setDimension(53);
			});
			await expect(page.locator(".tnc-k-scheduled").first()).toBeVisible({ timeout: 20000 });
			await expect(page.locator(".task-card").first()).toBeVisible();
			await capture(page, "hero", theme);
			await setObsidianViewport(page, VIEWPORT);
		});

		test("task list", async () => {
			const page = getPage();
			await resetWorkspace(page);
			await openFile(page, `${VIEWS}/tasks-default.base`, { viewName: "Not Blocked" });
			await expect(page.locator(".task-card").first()).toBeVisible({ timeout: 20000 });
			await capture(page, "task-list", theme);
		});

		test("kanban", async () => {
			const page = getPage();
			await resetWorkspace(page);
			await openFile(page, `${VIEWS}/kanban-default.base`);
			await expect(page.locator(".task-card").first()).toBeVisible({ timeout: 20000 });
			await capture(page, "kanban", theme);
		});

		test("calendar", async () => {
			const page = getPage();
			await resetWorkspace(page);
			await openFile(page, `${VIEWS}/calendar-default.base`);
			await expect(page.locator(".tnc-k-scheduled").first()).toBeVisible({ timeout: 20000 });
			await capture(page, "calendar", theme);
		});

		test("agenda", async () => {
			const page = getPage();
			await resetWorkspace(page);
			await openFile(page, `${VIEWS}/agenda-default.base`);
			await expect(page.locator(".tnc").first()).toBeVisible({ timeout: 20000 });
			await capture(page, "agenda", theme);
		});

		test("task note", async () => {
			const page = getPage();
			await resetWorkspace(page);
			await openFile(page, "TaskNotes/Tasks/Finalise homepage copy.md");
			await expect(page.locator(".markdown-source-view .cm-content").first()).toBeVisible({ timeout: 20000 });
			await capture(page, "task-note", theme);
		});

		test("create task with natural language", async () => {
			const page = getPage();
			await resetWorkspace(page);
			await openFile(page, `${VIEWS}/calendar-default.base`);
			await page.evaluate(() => (window as any).app.commands.executeCommandById("tasknotes:create-new-task"));
			const input = page.locator(".modal-container .cm-content, .modal-container textarea").first();
			await expect(input).toBeVisible({ timeout: 10000 });
			await input.click();
			await page.keyboard.type("Prepare slides for the Lisbon talk friday 2pm #slides @writing +[[Conference talk]] high priority 90m", { delay: 5 });
			await page.waitForTimeout(800);
			await capture(page, "create-task", theme);
			await dismissObsidianModals(page);
		});
	});
}
