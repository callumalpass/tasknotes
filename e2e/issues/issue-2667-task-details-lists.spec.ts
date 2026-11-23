import { expect, test, type Locator, type Page } from '@playwright/test';
import { closeObsidian, launchObsidian, type ObsidianApp } from '../obsidian';

const folder = `Issue2667-${Date.now()}`;
const taskPath = `${folder}/Existing task.md`;
const boardPath = `${folder}/Board.base`;
const controlPath = `${folder}/Full note.md`;
let instance: ObsidianApp;
let page: Page;
let originalNlp: boolean;

const modal = () => page.locator('.modal.mod-tasknotes');
const details = () => modal().locator('.tn-task-modal__markdown-editor--details .cm-content');
const activeValue = () => page.evaluate(() => (window as any).app.workspace.activeEditor?.editor.getValue());

async function openFile(path: string) {
  await page.evaluate(async path => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(path));
  }, path);
}

async function expectListContinuation(editor: Locator) {
  await editor.click();
  for (const [first, next] of [
    ['- [ ] First item', '- [ ] '],
    ['1. First item', '2. '],
    ['- First item', '- '],
    ['Plain paragraph', ''],
  ]) {
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText(first);
    await expect.poll(activeValue).toBe(first);
    await page.keyboard.press('Enter');
    expect.soft(await activeValue(), `Enter after ${first}`).toBe(`${first}\n${next}`);
  }
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  originalNlp = await page.evaluate(async ({ folder, taskPath, boardPath, controlPath }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const nlp = plugin.settings.enableNaturalLanguageInput;
    plugin.settings.enableNaturalLanguageInput = true;
    await app.vault.createFolder(folder);
    const status = plugin.fieldMapper.toUserField('status');
    await app.vault.create(taskPath, `---\ntags: [task]\ntitle: Existing task\n${status}: ${plugin.settings.defaultTaskStatus}\n---\n`);
    await app.vault.create(controlPath, 'Control');
    await app.vault.create(boardPath, `
filters:
  and:
    - 'file.inFolder("${folder}")'
    - 'file.hasTag("task")'
views:
  - type: tasknotesKanban
    name: Board
    groupBy:
      property: ${JSON.stringify(status)}
      direction: ASC
`);
    return nlp;
  }, { folder, taskPath, boardPath, controlPath });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await page.evaluate(async ({ folder, originalNlp }) => {
      const app = (window as any).app;
      app.plugins.plugins.tasknotes.settings.enableNaturalLanguageInput = originalNlp;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, { folder, originalNlp });
  } finally {
    await closeObsidian(instance);
  }
});

test.afterEach(async () => {
  if (!await modal().count()) return;
  await page.keyboard.press('Escape');
  const discard = page.getByRole('button', { name: 'Discard changes', exact: true });
  if (await discard.isVisible()) await discard.click();
  await expect(modal()).toHaveCount(0);
});

test('Obsidian continues lists in a full note', async () => {
  await openFile(controlPath);
  await expectListContinuation(page.locator('.workspace-leaf.mod-active .markdown-source-view .cm-content'));
});

test('Enter continues lists in Details when creating a task from Kanban', async () => {
  await openFile(boardPath);
  const column = page.locator('.kanban-view__column').filter({ has: page.locator(`[data-task-path="${taskPath}"]`) });
  await column.locator('.kanban-view__column-header').hover();
  await column.locator('.kanban-view__column-header .kanban-view__add-task-button').click();
  await modal().getByRole('button', { name: 'More fields', exact: true }).click();
  await expectListContinuation(details());
});

test('Enter continues lists in Details when editing a task from Kanban', async () => {
  await openFile(boardPath);
  await page.locator(`.kanban-view__card-wrapper[data-task-path="${taskPath}"] .task-card__title`).click();
  await expectListContinuation(details());
});
