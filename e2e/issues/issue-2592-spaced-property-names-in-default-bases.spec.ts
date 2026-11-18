/**
 * Issue #2592: generated default Bases break when a mapped property name contains a space.
 *
 * Maps due/status/projects/blockedBy to names with spaces, regenerates the default
 * Bases through the plugin, then evaluates the generated filters and formulas in
 * Obsidian. Each view is copied into a table limited to this test's folder so the
 * rows can be read directly.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2592
 */
import { test, expect, type Page } from "@playwright/test";
import { parse, stringify } from "yaml";
import { closeObsidian, launchObsidian, type ObsidianApp } from "../obsidian";

const folder = `Issue 2592 ${Date.now()}`;
const mapping = {
	due: "due date",
	status: "task status",
	projects: "my projects",
	blockedBy: "blocked by",
};
let instance: ObsidianApp;
let page: Page;

function localDate(offsetDays: number): string {
	const date = new Date();
	date.setDate(date.getDate() + offsetDays);
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** One generated view as a table restricted to the fixture folder. */
function tableBase(generated: string, viewName: string, order: string[]): string {
	const base = parse(generated);
	const view = base.views.find((candidate: { name: string }) => candidate.name === viewName);
	expect(view, `view ${viewName}`).toBeTruthy();
	const and = [`file.inFolder("${folder}")`, ...(base.filters?.and ?? [])];
	return stringify({
		filters: { and },
		formulas: base.formulas,
		views: [{ ...view, type: "table", order }],
	});
}

async function rowsIn(scope: string): Promise<string[][]> {
	return page.evaluate((scope) => {
		const leaf = (window as any).app.workspace.activeLeaf.view.containerEl as HTMLElement;
		return Array.from(leaf.querySelectorAll(`${scope} .bases-tbody .bases-tr`)).map((tr) =>
			Array.from(tr.querySelectorAll(".bases-td")).map((td) => {
				// Date and boolean cells render as inputs.
				const input = td.querySelector("input");
				if (input?.type === "checkbox") return String(input.checked);
				return input ? input.value : (td.textContent ?? "").trim();
			})
		);
	}, scope);
}

async function open(path: string): Promise<void> {
	await page.evaluate(async (path) => {
		const app = (window as any).app;
		await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path));
	}, path);
}

async function names(scope: string): Promise<string[]> {
	return (await rowsIn(scope)).map((row) => row[0]).sort();
}

test.afterAll(async () => {
	if (page && !page.isClosed()) {
		await page
			.evaluate(async (folder) => {
				const app = (window as any).app;
				const plugin = app.plugins.plugins.tasknotes;
				const saved = (window as any).__issue2592Saved;
				if (saved) {
					plugin.settings.fieldMapping = saved.fieldMapping;
					plugin.settings.commandFileMapping = saved.commandFileMapping;
					plugin.fieldMapper.updateMapping(saved.fieldMapping);
				}
				const fixture = app.vault.getAbstractFileByPath(folder);
				if (fixture) await app.vault.delete(fixture, true);
			}, folder)
			.catch(() => undefined);
	}
	if (instance) await closeObsidian(instance);
});

test("default Bases quote mapped property names that contain spaces", async () => {
	test.setTimeout(120000);
	instance = await launchObsidian();
	page = instance.page;

	const yesterday = localDate(-1);
	const generated: Record<string, string> = await page.evaluate(
		async ({ folder, mapping, yesterday }) => {
			const app = (window as any).app;
			const plugin = app.plugins.plugins.tasknotes;
			(window as any).__issue2592Saved = {
				fieldMapping: plugin.settings.fieldMapping,
				commandFileMapping: plugin.settings.commandFileMapping,
			};
			plugin.settings.fieldMapping = { ...plugin.settings.fieldMapping, ...mapping };
			plugin.fieldMapper.updateMapping(plugin.settings.fieldMapping);
			// Blank paths are skipped, so only these two files are (re)generated.
			plugin.settings.commandFileMapping = {
				...Object.fromEntries(
					Object.keys(plugin.settings.commandFileMapping).map((key) => [key, ""])
				),
				"open-tasks-view": `${folder}/Generated/tasks.base`,
				relationships: `${folder}/Generated/relationships.base`,
			};

			await app.vault.createFolder(folder);
			const note = (name: string, frontmatter: string, body = "") =>
				app.vault.create(`${folder}/${name}.md`, `---\ntags: [task]\n${frontmatter}---\n${body}`);
			await note("Overdue open", `task status: open\ndue date: ${yesterday}\n`);
			await note("Overdue done", `task status: done\ndue date: ${yesterday}\n`);
			await note("Inbox", "task status: open\n");
			await note("Parent", "task status: open\n", `![[${folder}/Subtasks.base]]\n`);
			await note(
				"Child",
				'task status: open\nmy projects:\n  - "[[Parent]]"\nblocked by:\n  - uid: "[[Blocker]]"\n',
				`![[${folder}/Projects.base]]\n\n![[${folder}/Blocked by.base]]\n`
			);
			await note("Blocker", "task status: open\n", `![[${folder}/Blocking.base]]\n`);
			await note("Done blocker", "task status: done\n");
			await note("Free", 'task status: open\nblocked by:\n  - uid: "[[Done blocker]]"\n');

			await plugin.ensureBasesViewFiles({ overwriteExisting: true });
			const read = (path: string) => app.vault.adapter.read(path);
			return {
				tasks: await read(`${folder}/Generated/tasks.base`),
				relationships: await read(`${folder}/Generated/relationships.base`),
			};
		},
		{ folder, mapping, yesterday }
	);

	for (const text of Object.values(generated)) {
		for (const name of Object.values(mapping)) {
			expect(text).not.toMatch(new RegExp(`(?<![\\["])${name}\\.|\\(${name}\\)`));
		}
	}

	const write = (name: string, content: string) =>
		page.evaluate(
			async ({ path, content }) => {
				await (window as any).app.vault.create(path, content);
			},
			{ path: `${folder}/${name}.base`, content }
		);
	const columns = ["file.name", "due date", "formula.daysUntilDue", "formula.isOverdue"];
	await write("Overdue", tableBase(generated.tasks, "Overdue", columns));
	await write("Inbox", tableBase(generated.tasks, "Inbox", columns));
	await write("Not blocked", tableBase(generated.tasks, "Not Blocked", columns));
	await write("All", tableBase(generated.tasks, "All Tasks", columns));
	await write("Subtasks", tableBase(generated.relationships, "Subtasks", ["file.name"]));
	await write("Projects", tableBase(generated.relationships, "Projects", ["file.name"]));
	await write("Blocked by", tableBase(generated.relationships, "Blocked By", ["file.name"]));
	await write("Blocking", tableBase(generated.relationships, "Blocking", ["file.name"]));

	// View filters and formulas read the spaced properties.
	await open(`${folder}/Overdue.base`);
	await expect.poll(() => rowsIn("")).toEqual([["Overdue open", yesterday, "-1", "true"]]);

	await open(`${folder}/Inbox.base`);
	await expect.poll(() => names("")).toEqual(["Blocker", "Free", "Inbox", "Parent"]);

	// "Free" only passes if its done blocker's `task status` is read through properties["…"].
	await open(`${folder}/Not blocked.base`);
	await expect
		.poll(() => names(""))
		.toEqual(["Blocker", "Free", "Inbox", "Overdue open", "Parent"]);

	// The All Tasks view sorts by the mapped due property.
	await open(`${folder}/All.base`);
	await expect.poll(async () => (await rowsIn("")).length).toBe(8);
	const [firstName, firstDue] = (await rowsIn(""))[0];
	expect(firstName).toMatch(/^Overdue/);
	expect(firstDue).toBe(yesterday);

	// Relationship views evaluated from inside the related note (`this`).
	await open(`${folder}/Parent.md`);
	await expect.poll(() => names('.internal-embed[src$="Subtasks.base"]')).toEqual(["Child"]);
	await open(`${folder}/Blocker.md`);
	await expect.poll(() => names('.internal-embed[src$="Blocking.base"]')).toEqual(["Child"]);
	await open(`${folder}/Child.md`);
	await expect.poll(() => names('.internal-embed[src$="Projects.base"]')).toEqual(["Parent"]);
	await expect.poll(() => names('.internal-embed[src$="Blocked by.base"]')).toEqual(["Blocker"]);
});
