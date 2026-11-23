/**
 * Issue #2579: standalone task links in live preview took about three lines each.
 *
 * The non-sentence widget wrapper was display:block, so CodeMirror's widget
 * buffers either side of it opened empty line boxes above and below the card.
 * A task link on its own line (or bullet) should sit on one line, like 4.x.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2579
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

const note = `Issue2579-${Date.now()}.md`;
let instance: ObsidianApp;
let page: Page;
let originalProperties: unknown;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
});

test.afterAll(async () => {
  if (!instance) return;
  await page.evaluate(async ({ note, originalProperties }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    plugin.settings.inlineVisibleProperties = originalProperties;
    await plugin.saveSettings();
    const file = app.vault.getAbstractFileByPath(note);
    if (file) await app.vault.delete(file);
  }, { note, originalProperties });
  await closeObsidian(instance);
});

test('standalone task links take one line each in live preview', async () => {
  originalProperties = await page.evaluate(async note => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const original = plugin.settings.inlineVisibleProperties;
    plugin.settings.inlineVisibleProperties = [];
    await plugin.saveSettings();
    const body = '[[Buy groceries]]\n[[Fix login bug]]\n\n- [[Buy groceries]]\n- [[Fix login bug]]\n\nControl line\n';
    const file = await app.vault.create(note, body);
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file, { state: { mode: 'source', source: false } });
    // Keep the caret off the task links so every one renders as a widget.
    leaf.view.editor.setCursor(leaf.view.editor.lastLine(), 0);
    return original;
  }, note);

  const lines = page.locator('.workspace-leaf.mod-active .cm-line');
  await expect(lines.locator('.tasknotes-inline-widget')).toHaveCount(4);

  const heights = await page.evaluate(() => {
    const all = [...document.querySelectorAll<HTMLElement>('.workspace-leaf.mod-active .cm-line')];
    const height = (el: HTMLElement) => el.getBoundingClientRect().height;
    const control = all.find(line => line.textContent === 'Control line')!;
    return {
      control: height(control),
      widgets: all.filter(line => line.querySelector('.tasknotes-inline-widget')).map(height),
    };
  });

  expect(heights.widgets).toHaveLength(4);
  for (const height of heights.widgets) {
    expect(height).toBeLessThan(heights.control * 1.5);
  }
});
