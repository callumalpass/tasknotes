/**
 * Issue #2696: task links in notes went back to the stacked two-row card (title, then a
 * row of 40px touch targets) in a narrow desktop pane and on an iPad at any width. The
 * stacked layout was keyed on a 480px container on every device, and on `body.is-mobile`,
 * which tablets have too. It is meant for phones only.
 *
 * `app.emulateMobile(true)` at a tablet-sized window applies Obsidian's tablet body classes.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2696
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const note = `Issue2696-${Date.now()}.md`;
const body = '## Tasks\n[[Buy groceries]]\n- [[Plan vacation]]\n- [ ] [[Daily standup]]\n';
let instance: ObsidianApp;
let page: Page;

test.setTimeout(180000);
test.describe.configure({ mode: 'serial' });

async function setMobile(on: boolean): Promise<void> {
  const isOn = () => page.evaluate(() => document.body.classList.contains('emulate-mobile')).catch(() => null);
  if (await isOn() !== on) {
    await page.evaluate((on) => (window as any).app.emulateMobile(on), on).catch(() => undefined);
  }
  await expect.poll(() => page.evaluate(() => [
    document.body.classList.contains('emulate-mobile'),
    (window as any).app?.plugins?.plugins?.tasknotes?.initializationComplete === true,
  ]).catch(() => null), { timeout: 60000 }).toEqual([on, true]);
}

async function widgetLines(): Promise<Array<{ text: string; height: number; hostWidth: number }>> {
  await page.evaluate(async ({ note, body }) => {
    const app = (window as any).app;
    let file = app.vault.getAbstractFileByPath(note);
    if (!file) file = await app.vault.create(note, body);
    app.workspace.leftSplit?.collapse?.();
    app.workspace.rightSplit?.collapse?.();
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file, { state: { mode: 'source', source: false } });
    // Keep the caret off the task links so every one renders as a widget.
    leaf.view.editor.setCursor(0, 0);
  }, { note, body });
  const lines = page.locator('.workspace-leaf.mod-active .markdown-source-view .cm-line');
  await expect(lines.locator('.tasknotes-inline-widget')).toHaveCount(3);
  return page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.workspace-leaf.mod-active .markdown-source-view .cm-line')]
    .filter(line => line.querySelector('.tasknotes-inline-widget'))
    .map(line => ({
      text: line.textContent ?? '',
      height: line.getBoundingClientRect().height,
      hostWidth: line.getBoundingClientRect().width,
    })));
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await setMobile(false);
    await page.evaluate(async (note) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(note);
      if (file) await app.vault.delete(file);
    }, note);
  } finally {
    await closeObsidian(instance);
  }
});

test('task links stay on one row in a narrow desktop pane', async () => {
  await setObsidianViewport(page, { width: 560, height: 900 });
  const rows = await widgetLines();
  expect(rows).toHaveLength(3);
  for (const row of rows) {
    expect(row.hostWidth, row.text).toBeLessThanOrEqual(480);
    // The stacked layout made these lines about 70px.
    expect(row.height, row.text).toBeLessThanOrEqual(34);
  }
});

test('task links stay on one row on a tablet', async () => {
  await setObsidianViewport(page, { width: 820, height: 1180 });
  await setMobile(true);
  await setObsidianViewport(page, { width: 820, height: 1180 });
  expect(await page.evaluate(() => document.body.classList.contains('is-tablet'))).toBe(true);
  const rows = await widgetLines();
  expect(rows).toHaveLength(3);
  for (const row of rows) {
    // One touch-target row; the phone layout made these lines about 85px.
    expect(row.height, row.text).toBeLessThanOrEqual(48);
  }
});
