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
				const title = modal.locator(".title-input, textarea.title-input-detailed");
				const details = modal.locator(".tn-task-modal__markdown-editor--details .cm-content");
				const titleValue = () =>
					title.evaluate(
						(element: HTMLTextAreaElement) => element.value ?? element.textContent
					);
				await expect(title).toBeVisible();
				await details.fill("Preserve these details");
				await title.click();
				await title.fill(failure === "validation" ? "   " : "Unsaved title");
				expect(await titleValue()).toBe(failure === "validation" ? "   " : "Unsaved title");
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
					const save = modal.getByRole("button", { name: mode === "creation" ? "Create task" : "Save", exact: true });
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
						failure === "validation"
							? modal.locator(".tn-task-modal__field-error").filter({ hasText: /title/i })
							: page
									.locator(".tn-toast, .notice")
									.filter({ hasText: /Issue 2421 simulated write failure/ })
									.last()
					).toBeVisible();
					await expect(modal).toBeVisible();
					expect(await titleValue()).toBe(
						failure === "validation" ? "   " : "Unsaved title"
					);
					await expect(details).toContainText("Preserve these details");
					await expect(save).toBeEnabled();
				} finally {
					await page.evaluate(() => {
						(window as any).__issue2421Restore?.();
						delete (window as any).__issue2421Restore;
					});
				}
				await title.fill(`Issue 2421 corrected ${mode} ${action} ${failure}`);
				await modal.getByRole("button", { name: mode === "creation" ? "Create task" : "Save", exact: true }).click();
				await expect(modal).toHaveCount(0);
			});
		}
	}
}
