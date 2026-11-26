import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "../obsidian";

let obsidian: ObsidianApp;

test.beforeAll(async () => {
	obsidian = await launchObsidian();
});

test.afterAll(async () => {
	if (obsidian) await closeObsidian(obsidian);
});

for (const action of ["reschedule", "patch", "patch with body", "workflow"] as const) {
	test(`${action} preserves a note truncated by the second write in a batch`, async () => {
		test.skip(action === "workflow" && !process.env.TASKNOTES_E2E_WORKFLOWS,
			"Requires the released TaskNotes Workflows plugin enabled in the test vault");
		const { page } = obsidian;
		if (action === "workflow") {
			const definition = await readFile("e2e/fixtures/workflows-27.md", "utf8");
			await page.evaluate(async (definition) => {
				const app = window.app;
				const path = "TaskNotes/Workflows/workflows-27-timeout.md";
				if (!await app.vault.adapter.exists(path)) await app.vault.create(path, definition);
				await app.plugins.getPlugin("tasknotes-workflows").reloadWorkflows();
			}, definition);
		}
		const fixture = await page.evaluate(async (action) => {
			const app = window.app;
			const plugin = app.plugins.plugins.tasknotes;
			plugin.settings.openTaskAfterCreation = "none";
			const paths: string[] = [];
			for (const position of ["first", "second", "third"]) {
				const task = await plugin.api.tasks.create({
					title: `Write timeout ${action} ${position} ${crypto.randomUUID()}`,
					details: `Keep the ${position} body.`,
					scheduled: "2026-11-20",
					priority: "normal",
				});
				paths.push(task.path);
			}
			const adapter = app.vault.adapter as import("obsidian").FileSystemAdapter;
			const before = await Promise.all(paths.map((path) => adapter.read(path)));
			return { root: adapter.getBasePath(), paths, before };
		}, action);

		const result = await page.evaluate(async ({ paths, action }) => {
			const app = window.app;
			const adapter = app.vault.adapter as import("obsidian").FileSystemAdapter & {
				fsPromises: typeof import("node:fs/promises");
			};
			const writeFile = adapter.fsPromises.writeFile;
			const target = adapter.getFullPath(paths[1]);
			let injected = false;
			adapter.fsPromises.writeFile = async (path, data, options) => {
				if (path === target && !injected) {
					injected = true;
					await writeFile(path, "", "utf8");
					throw Object.assign(new Error("ETIMEDOUT: connection timed out, write"), {
						code: "ETIMEDOUT",
						syscall: "write",
					});
				}
				return writeFile(path, data, options);
			};
			const completed: string[] = [];
			let error: string | undefined;
			try {
				if (action === "workflow") {
					const run = await app.plugins.getPlugin("tasknotes-workflows")
						.runWorkflowById("workflows-27-timeout", { trigger: { paths } });
					error = run.error;
					for (const step of run.steps) {
						if (step.status === "success") completed.push(step.output.path);
					}
				} else {
					const tasks = app.plugins.plugins.tasknotes.api.tasks;
					for (const path of paths) {
						if (action === "reschedule") {
							await tasks.reschedule(path, "2026-11-23");
						} else {
							await tasks.patch(path, {
								priority: "high",
								...(action === "patch with body" ? { details: "Replacement body" } : {}),
							});
						}
						completed.push(path);
					}
				}
			} catch (failure) {
				error = failure instanceof Error ? failure.message : String(failure);
			} finally {
				adapter.fsPromises.writeFile = writeFile;
			}
			return { injected, completed, error };
		}, { paths: fixture.paths, action });

		expect(result.injected).toBe(true);
		expect(result.completed).toEqual([fixture.paths[0]]);
		const rescheduling = action === "reschedule" || action === "workflow";
		const prefix = rescheduling ? "Failed to update task property" : "Failed to update task";
		expect(result.error).toBe(`${prefix}: ETIMEDOUT: connection timed out, write`);
		const after = await Promise.all(fixture.paths.map((path) =>
			readFile(join(fixture.root, path), "utf8")
		));
		expect(after[0]).toContain(rescheduling ? "scheduled: 2026-11-23" : "priority: high");
		expect(after[1]).toBe(fixture.before[1]);
		expect(after[2]).toBe(fixture.before[2]);
	});
}
