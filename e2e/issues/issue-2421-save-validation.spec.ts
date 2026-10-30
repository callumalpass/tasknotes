import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, type ObsidianApp } from "../obsidian";

let obsidian: ObsidianApp;

test.beforeAll(async () => {
	obsidian = await launchObsidian();
	await obsidian.page.evaluate(() => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		plugin.settings.enableNaturalLanguageInput = false;
		plugin.settings.openTaskAfterCreation = "none";
		plugin.i18n.setLocale("en");
	});
});

test.afterAll(async () => {
	if (obsidian) await closeObsidian(obsidian);
});

for (const mode of ["creation", "edit"] as const) {
	for (const action of ["button", "keyboard", "confirmation"] as const) {
		if (mode === "creation" && action === "confirmation") continue;
		for (const failure of ["validation", "write"] as const) {
			test(`${mode}: ${action} ${failure} failure retains input and allows retry`, async () => {
				const page = obsidian.page;
				await page.evaluate(async (mode) => {
					const plugin = (window as any).app.plugins.plugins.tasknotes;
					if (mode === "creation") {
						plugin.openTaskCreationModal({ title: "Draft title" });
					} else {
						const result = await plugin.taskService.createTask({
							title: "Issue 2421 edit fixture",
						});
						await plugin.openTaskEditModal(result.taskInfo);
					}
				}, mode);
				const modal = page.locator(".modal.mod-tasknotes");
				const title = modal.locator("textarea.title-input, textarea.title-input-detailed");
				await expect(title).toBeVisible();
				await modal.locator(".cm-content").fill("Preserve these details");
				await title.fill(failure === "validation" ? "   " : "Unsaved title");
				if (failure === "write") {
					await page.evaluate((mode) => {
						const service = (window as any).app.plugins.plugins.tasknotes.taskService;
						const method = mode === "creation" ? "createTask" : "updateTask";
						(window as any).__issue2421Restore = () => {
							service[method] = original;
						};
						const original = service[method];
						service[method] = async () => {
							throw new Error("Issue 2421 simulated write failure");
						};
					}, mode);
				}
				try {
					const save = modal.getByRole("button", { name: "Save", exact: true });
					if (action === "button") await save.click();
					else if (action === "keyboard") await title.press("Control+Enter");
					else {
						await modal.getByRole("button", { name: "Cancel", exact: true }).click();
						await page
							.locator(".modal")
							.getByRole("button", { name: "Save changes", exact: true })
							.click();
					}
					await expect(
						page
							.locator(".notice")
							.filter({
								hasText:
									failure === "validation"
										? /title/i
										: /Issue 2421 simulated write failure/,
							})
							.last()
					).toBeVisible();
					await expect(modal).toBeVisible();
					await expect(title).toHaveValue(
						failure === "validation" ? "   " : "Unsaved title"
					);
					await expect(modal.locator(".cm-content")).toContainText(
						"Preserve these details"
					);
					await expect(save).toBeEnabled();
				} finally {
					await page.evaluate(() => {
						(window as any).__issue2421Restore?.();
						delete (window as any).__issue2421Restore;
					});
				}
				await title.fill(`Issue 2421 corrected ${mode} ${action} ${failure}`);
				await modal.getByRole("button", { name: "Save", exact: true }).click();
				await expect(modal).toHaveCount(0);
			});
		}
	}
}
