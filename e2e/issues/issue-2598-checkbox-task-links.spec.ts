/**
 * Issue #2598: task links on Markdown checkbox lines looked broken in Live Preview.
 *
 * A task link alone in a bullet under a checkbox item opened blank lines above and
 * below it (fixed with #2579). On `- [ ] [[task]]` lines, Live Preview counted the
 * `[ ]` as sentence text, so the widget dropped its priority and dates and sat lower
 * than the checkbox, while Reading view showed the full one-line card.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2598
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

const note = `Issue2598-${Date.now()}.md`;
const body = '## Tasks\n- [ ] [[Buy groceries]]\n- [ ] review the integration fix, for\n\t- [[Plan vacation]]\n- [ ] [[Daily standup]]\n- [ ] Control checkbox line\n';
let instance: ObsidianApp;
let page: Page;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
});

test.afterAll(async () => {
  if (!instance) return;
  await page.evaluate(async note => {
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(note);
    if (file) await app.vault.delete(file);
  }, note);
  await closeObsidian(instance);
});

test('task links on checkbox lines render as one-line cards in Live Preview', async () => {
  await page.evaluate(async ({ note, body }) => {
    const app = (window as any).app;
    const file = await app.vault.create(note, body);
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file, { state: { mode: 'source', source: false } });
    // Keep the caret off the task links so every one renders as a widget.
    leaf.view.editor.setCursor(0, 0);
  }, { note, body });

  const lines = page.locator('.workspace-leaf.mod-active .markdown-source-view .cm-line');
  await expect(lines.locator('.tasknotes-inline-widget')).toHaveCount(3);

  const rows = await page.evaluate(() => {
    const all = [...document.querySelectorAll<HTMLElement>('.workspace-leaf.mod-active .markdown-source-view .cm-line')];
    return all.map(line => {
      const widget = line.querySelector<HTMLElement>('.tasknotes-inline-widget');
      const checkbox = line.querySelector<HTMLElement>('input[type="checkbox"]');
      const title = line.querySelector<HTMLElement>('.task-card__title');
      return {
        text: line.textContent ?? '',
        height: line.getBoundingClientRect().height,
        sentence: widget?.classList.contains('tasknotes-inline-widget--sentence') ?? null,
        hasPriority: !!line.querySelector('.task-card__priority-dot'),
        checkboxCenter: checkbox ? checkbox.getBoundingClientRect().top + checkbox.getBoundingClientRect().height / 2 : null,
        titleCenter: title ? title.getBoundingClientRect().top + title.getBoundingClientRect().height / 2 : null,
      };
    });
  });

  const control = rows.find(row => row.text.includes('Control checkbox line'))!;
  const taskRows = rows.filter(row => row.sentence !== null);
  expect(taskRows).toHaveLength(3);
  for (const row of taskRows) {
    expect(row.sentence).toBe(false);
    expect(row.hasPriority).toBe(true);
    expect(row.height).toBeLessThan(control.height * 1.5);
  }
  for (const row of taskRows.filter(row => row.checkboxCenter !== null)) {
    expect(Math.abs(row.checkboxCenter! - row.titleCenter!)).toBeLessThanOrEqual(3);
  }
});
