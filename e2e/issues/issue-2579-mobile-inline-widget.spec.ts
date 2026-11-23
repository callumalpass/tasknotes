/**
 * Issue #2579 (mobile follow-up): on a phone, a task link on a checkbox line
 * (`- [ ] [[task]]`) took three lines: checkbox, then the full-width card, then the
 * convert button. With no status or priority shown, the title was also indented
 * by an empty 40px status column.
 *
 * Desktop cannot run the phone app; `app.emulateMobile(true)` applies the phone
 * body classes and layout at a phone-sized window.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2579
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const note = `Issue2579-mobile-${Date.now()}.md`;
const body = '## Tasks\n[[Buy groceries]]\n- [[Plan vacation]]\n- [ ] [[Daily standup]]\n- [ ] Control checkbox line\n';
let instance: ObsidianApp;
let page: Page;
let originalProperties: unknown;

test.setTimeout(180000);

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

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, { width: 390, height: 844 });
  await setMobile(true);
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await page.evaluate(async ({ note, originalProperties }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      if (originalProperties !== undefined) {
        plugin.settings.inlineVisibleProperties = originalProperties;
        await plugin.saveSettings();
      }
      const file = app.vault.getAbstractFileByPath(note);
      if (file) await app.vault.delete(file);
    }, { note, originalProperties });
    await setMobile(false);
  } finally {
    await closeObsidian(instance);
  }
});

test('task links with no visible properties stay on one row in phone Live Preview', async () => {
  originalProperties = await page.evaluate(async ({ note, body }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const original = plugin.settings.inlineVisibleProperties;
    plugin.settings.inlineVisibleProperties = [];
    await plugin.saveSettings();
    const file = await app.vault.create(note, body);
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file, { state: { mode: 'source', source: false } });
    // Keep the caret off the task links so every one renders as a widget.
    leaf.view.editor.setCursor(0, 0);
    return original;
  }, { note, body });

  const lines = page.locator('.workspace-leaf.mod-active .markdown-source-view .cm-line');
  await expect(lines.locator('.tasknotes-inline-widget')).toHaveCount(3);

  const rows = await page.evaluate(() => {
    const all = [...document.querySelectorAll<HTMLElement>('.workspace-leaf.mod-active .markdown-source-view .cm-line')];
    const center = (el: Element | null) => {
      if (!el) return null;
      const box = el.getBoundingClientRect();
      return box.top + box.height / 2;
    };
    return all.filter(line => line.querySelector('.tasknotes-inline-widget')).map(line => {
      const lineBox = line.getBoundingClientRect();
      const title = line.querySelector('.task-card__title')!;
      const card = line.querySelector('.task-card')!.getBoundingClientRect();
      const convert = line.querySelector('.instant-convert-button');
      return {
        text: line.textContent ?? '',
        height: lineBox.height,
        titleIndent: title.getBoundingClientRect().left - card.left,
        titleCenter: center(title),
        checkboxCenter: center(line.querySelector('input[type="checkbox"]')),
        convertCenter: center(convert),
        cardTop: card.top,
        cardBottom: card.bottom,
      };
    });
  });

  expect(rows).toHaveLength(3);
  for (const row of rows) {
    // One touch-target row; the checkbox line used to take about 94px.
    expect(row.height, row.text).toBeLessThanOrEqual(48);
    // No empty status column in front of the title.
    expect(row.titleIndent, row.text).toBeLessThanOrEqual(4);
  }
  const taskItem = rows.find(row => row.checkboxCenter !== null)!;
  expect(Math.abs(taskItem.checkboxCenter! - taskItem.titleCenter!)).toBeLessThanOrEqual(4);
  expect(taskItem.convertCenter).not.toBeNull();
  expect(taskItem.convertCenter!).toBeGreaterThan(taskItem.cardTop);
  expect(taskItem.convertCenter!).toBeLessThan(taskItem.cardBottom);
});
