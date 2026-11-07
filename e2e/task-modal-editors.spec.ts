import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
const run = `ModalEditors-${Date.now()}`;
const taskPath = `${run}/Editable.md`;
const notePath = `${run}/Behind.md`;
const modal = () => page.locator('.modal.mod-tasknotes');
const title = () => modal().locator('.tn-task-modal__markdown-editor--title .cm-content');
const details = () => modal().locator('.tn-task-modal__markdown-editor--details .cm-content');
const activeValue = () => page.evaluate(() => (window as any).app.workspace.activeEditor?.editor.getValue());

async function openEdit(): Promise<void> {
  await page.evaluate(async taskPath => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    await plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(taskPath));
  }, taskPath);
  await expect(title()).toHaveText('Editable');
}

async function closeModal(): Promise<void> {
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click({ timeout: 1000 }).catch(() => {});
  await expect(modal()).toHaveCount(0);
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(async ({ run, taskPath, notePath }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    plugin.settings.enableModalSplitLayout = true;
    await app.vault.createFolder(run);
    await app.vault.create(`${run}/Linked.md`, '# Linked');
    await app.vault.create(notePath, '# Behind\n\n- [ ] first\n- [ ] second\n');
    await app.vault.create(taskPath, `---\ntags: [task]\ntitle: Editable\nstatus: ${plugin.settings.defaultTaskStatus}\npriority: ${plugin.settings.defaultTaskPriority}\n---\n\nalpha beta\n\n- [ ] one\n`);
  }, { run, taskPath, notePath });
  await expect.poll(() => page.evaluate(async taskPath => Boolean(await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath)), taskPath)).toBe(true);
});

test.afterAll(async () => {
  try {
    if (page) await page.evaluate(async run => {
      const folder = (window as any).app.vault.getAbstractFileByPath(run);
      if (folder) await (window as any).app.vault.delete(folder, true);
    }, run);
  } finally { if (instance) await closeObsidian(instance); }
});

test('the details editor runs Obsidian commands, completion and live preview', async () => {
  await page.evaluate(async notePath => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(notePath));
  }, notePath);
  await openEdit();
  await details().click();
  expect(await page.evaluate(() => {
    const active = (window as any).app.workspace.activeEditor;
    return active.editor === active.editMode.editor && typeof active.editor.getClickableTokenAt === 'function';
  })).toBe(true);
  await page.evaluate(() => (window as any).app.workspace.activeEditor.editor.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 5 }));
  await page.keyboard.press('Control+b');
  expect(await activeValue()).toContain('**alpha** beta');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+End');
  await page.keyboard.type('[[Linked');
  await expect(page.locator('.suggestion-container .suggestion-item').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect.poll(activeValue).toContain('[[Linked]]');
  await expect(modal().locator('.markdown-source-view.is-live-preview .task-list-item-checkbox')).toHaveCount(1);
  await details().click({ button: 'right', position: { x: 30, y: 8 } });
  await expect(page.locator('.menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu')).toHaveCount(0);
  await expect(page.getByText('Unsaved changes', { exact: true })).toHaveCount(0);
  await expect(details()).toBeVisible();
  // Convert acts on the note behind the modal, so it must not be offered here.
  await expect(modal().locator('.instant-convert-button')).toHaveCount(0);
  await closeModal();
});

test('the title is one line of a real editor, and Enter finishes a completion before moving on', async () => {
  await openEdit();
  await title().click();
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+b');
  expect(await activeValue()).toBe('**Editable**');
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' [[Linked');
  await expect(page.locator('.suggestion-container .suggestion-item').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect.poll(activeValue).toBe('Editable [[Linked]]');
  await expect(title()).toBeFocused();
  await title().evaluate(element => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', ' one\ntwo');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }));
  });
  await expect.poll(activeValue).toBe('Editable [[Linked]] one two');
  await page.keyboard.press('Enter');
  await expect(details()).toBeFocused();
  await closeModal();
});

test('create and edit share one pane layout that never resizes on disclosure', async () => {
  await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal());
  await expect(details()).toBeVisible();
  const created = await modal().boundingBox();
  await modal().locator('.tn-task-modal__details-toggle').click();
  await expect(modal().locator('.title-input-detailed')).toBeVisible();
  expect(await modal().boundingBox()).toEqual(created);
  await closeModal();

  await openEdit();
  expect(await modal().boundingBox()).toEqual(created);
  const panes = await modal().evaluate(element => {
    const right = element.querySelector('.modal-split-right')!.getBoundingClientRect();
    const left = element.querySelector('.modal-split-left')!.getBoundingClientRect();
    const footer = element.querySelector('.tn-task-modal__button-bar')!.getBoundingClientRect();
    return { beside: right.left >= left.right - 1, reachesFooter: Math.abs(right.bottom - footer.top) <= 1 };
  });
  expect(panes).toEqual({ beside: true, reachesFooter: true });
  const heights = await modal().locator('.tn-chip--property, .modal-button-container button').evaluateAll(controls => controls.map(control => control.getBoundingClientRect().height).filter(height => height > 0));
  expect(new Set(heights)).toEqual(new Set([30]));
  await closeModal();
});

test('a narrow window gets a sheet that keeps the view above it', async () => {
  await setObsidianViewport(page, { width: 400, height: 800 });
  await openEdit();
  const box = (await modal().boundingBox())!;
  expect(box.width).toBe(400);
  expect(box.y + box.height).toBe(800);
  expect(box.y).toBeGreaterThan(100);
  await closeModal();
  await setObsidianViewport(page, { width: 1180, height: 800 });
});
