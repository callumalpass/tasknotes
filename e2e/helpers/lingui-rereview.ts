import { expect, type Page } from "@playwright/test";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { mkdirSync, writeFileSync } from "node:fs";
import { openTaskNotesSettings, closeObsidianSettings } from "../obsidian";

/** Native production artifact only; fixtures and all mutations stay in the verified test vault. */
export async function runLinguiRereview(page: Page, output: string): Promise<void> {
  const prefix = `Rereview-${Date.now()}`;
  const original = await page.evaluate(async prefix => {
    const app = (window as any).app, plugin = app.plugins.plugins.tasknotes;
    const original = JSON.parse(JSON.stringify(plugin.settings));
    await app.vault.createFolder(prefix);
    Object.assign(plugin.settings, { tasksFolder: prefix, taskFilenameFormat: "title", enableMdbaseSpec: false });
    for (const [name, date] of [["not-completed", undefined], ["old", "2026-10-20"], ["invalid", "invalid"], ["new", "2026-10-23"]]) {
      const fields: any = { title: `${prefix}-${name}`, tags: [plugin.settings.taskTag], [plugin.fieldMapper.toUserField("status")]: "open", [plugin.fieldMapper.toUserField("priority")]: "high" };
      if (date) fields[plugin.fieldMapper.toUserField("completedDate")] = date;
      await app.vault.create(`${prefix}/${name}.md`, `---\n${Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")}\n---\n`);
    }
    return original;
  }, prefix);
  const report: Record<string, unknown> = {};
  const id = (message: string, context: string) => generateMessageId(message, context);
  const translate = (message: string, context: string) => page.evaluate(id => (window as any).app.plugins.plugins.tasknotes.i18n.translate({ id }), id(message, context));
  try {
    for (const locale of ["en", "it", "de"]) {
      let settings = await openTaskNotesSettings(page, await translate("General", "settings.tabs.general"));
      await settings.locator('select:has(option[value="system"]):has(option[value="fr"])').selectOption(locale, { timeout: 10000 });
      await expect.poll(() => page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.i18n.getCurrentLocale())).toBe(locale);
      await closeObsidianSettings(page, settings);
      const before = await page.evaluate(() => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        return JSON.stringify({ fields: plugin.settings.modalFieldsConfig, statuses: plugin.settings.customStatuses, priorities: plugin.settings.customPriorities });
      });
      settings = await openTaskNotesSettings(page, await translate("Modal fields", "settings.tabs.modalFields"));
      const config = JSON.parse(before).fields;
      const rendered: string[] = [];
      for (const group of [...config.groups].sort((a, b) => a.order - b.order)) {
        const label = await translate(group.displayName, "utils/fieldConfigDefaults: defaults displayName");
        const tab = settings.locator(".field-manager__tab").filter({ hasText: label });
        await expect(tab).toHaveCount(1);
        await tab.click();
        rendered.push(label);
        for (const field of config.fields.filter(field => field.group === group.id && field.fieldType !== "user")) {
          const fieldLabel = await translate(field.displayName, "utils/fieldConfigDefaults: defaults displayName");
          await expect(settings.locator(".field-manager__cards").getByText(fieldLabel, { exact: true })).toHaveCount(1);
          rendered.push(fieldLabel);
        }
      }
      expect(rendered).toHaveLength(14);
      if (locale === "de") expect(rendered).toContain("Grundlegende Informationen");
      mkdirSync(output, { recursive: true });
      await settings.screenshot({ path: `${output}/${locale}-modal-fields.png`, fullPage: true });
      await settings.getByRole("tab", { name: await translate("Task properties", "settings.tabs.taskProperties"), exact: true }).click();
      for (const english of ["Open", "High"]) {
        const label = await translate(english, "settings/defaults: defaults label");
        await expect.poll(() => settings.locator("input").evaluateAll(inputs => inputs.map(input => input.value))).toContain(label);
      }
      const after = await page.evaluate(() => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        return JSON.stringify({ fields: plugin.settings.modalFieldsConfig, statuses: plugin.settings.customStatuses, priorities: plugin.settings.customPriorities });
      });
      expect(after).toBe(before);
      await closeObsidianSettings(page, settings);
      const grouped = () => page.evaluate(async prefix => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        const groups = await plugin.filterService.getGroupedTasksStrict({ type: "group", id: "native-rereview", conjunction: "and", children: [{ type: "condition", id: "fixture-title", property: "title", operator: "contains", value: prefix }], groupKey: "completedDate", sortKey: "title", sortDirection: "asc" });
        return { keys: [...groups.keys()], titles: [...groups.values()].flat().map(task => task.title) };
      }, prefix);
      await expect.poll(async () => (await grouped()).titles.length).toBe(4);
      const groups = await grouped();
      expect(groups.keys).toEqual(["2026-10-23", "2026-10-20", "Invalid date", "Not completed"]);
      const fallback = await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.instantTaskConvertService.tryNLPFallback("- [ ] !high", ""));
      expect(fallback.title).toBe("Untitled Task");
      await page.evaluate(() => (window as any).app.commands.executeCommandById("tasknotes:create-new-task"));
      const modal = page.locator(".modal").filter({ has: page.locator(".title-input, .title-input-detailed") }).last();
      await expect(modal).toBeVisible();
      const editor = modal.locator('.title-input:visible, .title-input-detailed:visible, .cm-content[contenteditable="true"]:visible').first();
      if (await editor.getAttribute("contenteditable") === "true") {
        await editor.click();
        await editor.press("ControlOrMeta+A");
        await editor.pressSequentially("!high");
        await editor.press("ControlOrMeta+Enter");
      } else {
        await editor.fill("!high");
        await modal.locator(".modal-button-container .mod-cta").click();
      }
      await expect(modal).toBeVisible();
      await expect(page.locator(".notice").filter({ hasText: await translate("Please enter a task title", "modals.taskCreation.notices.titleRequired") })).toBeVisible();
      const generated = await page.evaluate(prefix => (window as any).app.vault.getMarkdownFiles().filter(file => file.path.startsWith(prefix + "/")).map(file => file.basename), prefix);
      expect(generated).not.toContain("Untitled Task");
      await page.screenshot({ path: `${output}/${locale}-missing-title-modal.png` });
      await page.keyboard.press("Escape");
      report[locale] = { fieldAndGroupLabels: rendered, settingsUnchangedByRendering: true, completedDateGroups: groups, programmaticFallback: fallback.title, interactiveMissingTitleRejected: true };
      writeFileSync(`${output}/report.json`, JSON.stringify(report, null, 2) + "\n");
    }
  } finally {
    await page.keyboard.press("Escape").catch(() => {});
    await page.evaluate(async ({ original, prefix }) => {
      const app = (window as any).app, plugin = app.plugins.plugins.tasknotes;
      Object.assign(plugin.settings, original);
      plugin.i18n.setLocale(original.uiLanguage);
      await plugin.saveSettings();
      const folder = app.vault.getAbstractFileByPath(prefix);
      if (folder) await app.vault.delete(folder, true);
    }, { original, prefix });
  }
}
