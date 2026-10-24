import { expect, type Page } from "@playwright/test";
import { generateMessageId } from "@lingui/message-utils/generateMessageId";
import { stringify, parse } from "yaml";
import { mkdirSync, writeFileSync } from "node:fs";
import { openTaskNotesSettings, closeObsidianSettings, setObsidianViewport } from "../obsidian";

/** Real native Bases, pointer drags and creation modals on the minified artifact. */
export async function runLinguiReview(page: Page, output: string): Promise<void> {
  const folder = `Lingui review ${Date.now()}`;
  const original = await page.evaluate(async folder => {
    const app = (window as any).app, plugin = app.plugins.plugins.tasknotes;
    const original = JSON.parse(JSON.stringify(plugin.settings));
    app.workspace.leftSplit.collapse(); app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    Object.assign(plugin.settings, { tasksFolder: folder, taskFilenameFormat: "title", enableMdbaseSpec: false });
    plugin.settings.userFields = [...plugin.settings.userFields, { id: "review-group", key: "review_group", displayName: "Review group", type: "text" }, { id: "review-flag", key: "review_flag", displayName: "Review flag", type: "boolean" }];
    for (const [title, group, flag] of [["Source", "work", false], ["Empty", null, null], ["True peer", "work", true]]) {
      const fm = { title, tags: [plugin.settings.taskTag], [plugin.fieldMapper.toUserField("status")]: "open", [plugin.fieldMapper.toUserField("priority")]: "normal", review_group: group, review_flag: flag };
      await app.vault.create(`${folder}/${title}.md`, `---\n${Object.entries(fm).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join("\n")}\n---\n`);
    }
    return original;
  }, folder);
  const report: Record<string, unknown> = {};
  const noneId = generateMessageId("None", "bases/basesValueConversion: formatBasesGroupKeyValue display");
  const column = (key: string) => page.locator(`.workspace-leaf.mod-active .kanban-view__column[data-group="${key}"]`);
  const source = () => page.locator(`.workspace-leaf.mod-active .kanban-view__card-wrapper[data-task-path="${folder}/Source.md"]`);
  const frontmatter = (name = "Source") => page.evaluate(({ folder, name }) => {
    const app = (window as any).app;
    return app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(`${folder}/${name}.md`))?.frontmatter ?? null;
  }, { folder, name });
  const readBase = (name: string) => page.evaluate(async ({ folder, name }) => {
    const app = (window as any).app;
    return app.vault.read(app.vault.getAbstractFileByPath(`${folder}/${name}.base`));
  }, { folder, name });
  async function openBase(property: string, name: string, keys: string[]) {
    const config = { filters: { and: [`file.folder == "${folder}"`, 'file.ext == "md"'] }, views: [{ type: "tasknotesKanban", name: "Locale review", groupBy: { property, direction: "ASC" }, hideEmptyColumns: false, columnWidth: 280, columnOrder: JSON.stringify({ [property]: keys }), order: ["note.status", "note.priority"] }] };
    await page.evaluate(async ({ folder, name, content }) => {
      const app = (window as any).app;
      const filePath = `${folder}/${name}.base`;
      const file = app.vault.getAbstractFileByPath(filePath) ?? await app.vault.create(filePath, content);
      await app.workspace.getLeaf(false).openFile(file);
    }, { folder, name, content: stringify(config) });
    await expect(source()).toBeVisible();
    await expect(column("None")).toHaveCount(1);
    await expect.poll(() => page.locator(".workspace-leaf.mod-active .kanban-view__column").evaluateAll(columns => columns.map(column => column.getAttribute("data-group")))).toEqual(keys);
  }
  async function createInColumn(key: string, title: string) {
    await column(key).locator(".kanban-view__add-task-button").click();
    const modal = page.locator(".modal").filter({ has: page.locator(".title-input, .title-input-detailed") }).last();
    await expect(modal).toBeVisible();
    // Native quick entry is CodeMirror; parsed values reach detailed inputs
    // only through the real fill-form action (or save), not on each keystroke.
    const editor = modal.locator('.title-input:visible, .title-input-detailed:visible, .cm-content[contenteditable="true"]:visible').first();
    if (await editor.getAttribute("contenteditable") === "true") {
      await editor.click();
      await editor.press("ControlOrMeta+A");
      await editor.pressSequentially(title);
      const label = await page.evaluate(id => (window as any).app.plugins.plugins.tasknotes.i18n.translate({ id }), generateMessageId("Fill form from natural language", "modals.taskCreation.actions.fillFromNaturalLanguage"));
      await modal.getByLabel(label, { exact: true }).click();
    } else await editor.fill(title);
    await expect(modal.locator(".title-input-detailed")).toHaveValue(title);
    await modal.locator(".modal-button-container .mod-cta").click();
    await expect(modal).toHaveCount(0);
    await expect.poll(() => frontmatter(title)).not.toBeNull();
    return frontmatter(title);
  }
  try {
    await setObsidianViewport(page, { width: 1450, height: 1000 });
    for (const locale of ["en", "it", "de", "ru"]) {
      const settingsPage = await openTaskNotesSettings(page);
      await settingsPage.locator('select:has(option[value="system"]):has(option[value="fr"])').selectOption(locale);
      await expect.poll(() => page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.i18n.getCurrentLocale())).toBe(locale);
      await closeObsidianSettings(page, settingsPage);
      await page.evaluate(async folder => {
        const app = (window as any).app;
        await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(`${folder}/Source.md`), (fm: any) => { fm.review_group = "work"; fm.review_flag = false; });
      }, folder);
      await openBase("note.review_group", "Groups", ["work", "None"]);
      const label = await page.evaluate(id => (window as any).app.plugins.plugins.tasknotes.i18n.translate({ id }), noneId);
      await expect(column("None").locator(".kanban-view__column-title")).toContainText(label);
      if (locale !== "en") expect(label).not.toBe("None");
      await source().dragTo(column("None").locator(".kanban-view__cards"), { targetPosition: { x: 30, y: 5 } });
      await expect.poll(async () => Object.hasOwn((await frontmatter()) ?? {}, "review_group")).toBe(false);
      const createdEmpty = await createInColumn("None", `Created empty ${locale}`);
      expect(createdEmpty.review_group == null).toBe(true);
      expect(createdEmpty.status).toBe("open");
      const groupOrder = JSON.parse(parse(await readBase("Groups")).views[0].columnOrder);
      expect(groupOrder["note.review_group"]).toEqual(["work", "None"]);
      await openBase("note.review_flag", "Flags", ["True", "None", "False"]);
      await source().dragTo(column("True").locator(".kanban-view__cards"), { targetPosition: { x: 30, y: 5 } });
      await expect.poll(async () => (await frontmatter())?.review_flag).toBe(true);
      const createdTrue = await createInColumn("True", `Created true ${locale}`);
      expect(createdTrue.review_flag).toBe(true);
      const flagOrder = JSON.parse(parse(await readBase("Flags")).views[0].columnOrder);
      expect(flagOrder["note.review_flag"]).toEqual(["True", "None", "False"]);
      mkdirSync(output, { recursive: true });
      await page.screenshot({ path: `${output}/${locale}-boolean-kanban.png` });
      report[locale] = { emptyLabel: label, emptyDropRemovedProperty: true, createdEmpty, booleanDrop: true, createdTrue, groupOrder, flagOrder };
    }
    writeFileSync(`${output}/review-report.json`, JSON.stringify(report, null, 2));
  } finally {
    await page.keyboard.press("Escape").catch(() => {});
    await page.evaluate(async ({ original, folder }) => {
      const app = (window as any).app, plugin = app.plugins.plugins.tasknotes;
      Object.assign(plugin.settings, original);
      plugin.i18n.setLocale(original.uiLanguage);
      await plugin.saveSettings();
      for (const leaf of app.workspace.getLeavesOfType("bases")) if (leaf.view.file?.path.startsWith(folder + "/")) await leaf.setViewState({ type: "empty" });
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, { original, folder });
  }
}
