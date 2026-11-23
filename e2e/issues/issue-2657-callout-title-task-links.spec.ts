import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

const note = `Issue2657-${Date.now()}.md`;
const body = [
  '> [!note] [[Buy groceries]]',
  '> [[Plan vacation]]',
  '',
  '> [!tip] Next: [[Buy groceries]]',
  '',
  'Body text.',
  '',
].join('\n');

let instance: ObsidianApp;

test.beforeAll(async () => {
  instance = await launchObsidian();
  await instance.page.evaluate(async ({ note, body }) => {
    await (window as any).app.vault.create(note, body);
  }, { note, body });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async note => {
      const { vault } = (window as any).app;
      const file = vault.getAbstractFileByPath(note);
      if (file) await vault.delete(file);
    }, note);
  } finally {
    await closeObsidian(instance);
  }
});

for (const [label, mode, view] of [
  ['Reading View', 'preview', 'markdown-reading-view'],
  ['Live Preview', 'source', 'markdown-source-view'],
] as const) {
  test(`task links fit their callout titles in ${label}`, async ({}, testInfo) => {
    const { page } = instance;
    await page.evaluate(async ({ note, mode }) => {
      const app = (window as any).app;
      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(app.vault.getAbstractFileByPath(note), { state: { mode, source: false } });
      if (mode === 'source') leaf.view.editor.setCursor(leaf.view.editor.lastLine(), 0);
    }, { note, mode });

    const root = page.locator(`.workspace-leaf.mod-active .${view}`);
    const standalone = root.locator('.callout[data-callout="note"] .callout-title .tasknotes-inline-widget');
    const inline = root.locator('.callout[data-callout="tip"] .callout-title .tasknotes-inline-widget');
    const bodyCard = root.locator('.callout-content .tasknotes-inline-widget');
    await expect(standalone.locator('.task-card__title-text')).toHaveText('Buy groceries');
    await expect(standalone.locator('.task-card__status-dot')).toBeVisible();
    await expect(standalone.locator('.task-card__metadata')).toBeVisible();
    await expect(standalone).not.toHaveClass(/tasknotes-inline-widget--sentence/);
    await expect(inline).toHaveClass(/tasknotes-inline-widget--sentence/);
    await expect(bodyCard.locator('.task-card__title-text')).toHaveText('Plan vacation');
    await expect(bodyCard).not.toHaveClass(/tasknotes-inline-widget--sentence/);

    await page.screenshot({ path: testInfo.outputPath('callout-titles.png') });
    const layout = await standalone.evaluate(widget => {
      const card = widget.querySelector<HTMLElement>('.task-card--layout-inline')!;
      const title = card.querySelector<HTMLElement>('.task-card__title-text')!;
      const titleRange = document.createRange();
      titleRange.selectNodeContents(title);
      return {
        visibleTitleWidth: title.clientWidth,
        textWidth: title.scrollWidth,
        textRows: titleRange.getClientRects().length,
        cardWidth: card.getBoundingClientRect().width,
        widgetWidth: widget.getBoundingClientRect().width,
        containerType: getComputedStyle(widget).containerType,
      };
    });
    expect(layout.textRows, JSON.stringify(layout)).toBe(1);
    expect(layout.visibleTitleWidth).toBeGreaterThan(0);
    expect(layout.visibleTitleWidth + 1).toBeGreaterThanOrEqual(layout.textWidth);
  });
}
