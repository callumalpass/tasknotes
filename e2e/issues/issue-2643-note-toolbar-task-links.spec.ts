/**
 * Issue #2643: task links in Note Toolbar callout toolbars broke the toolbar layout.
 *
 * Note Toolbar turns `> [!note-toolbar]` callouts into toolbars whose list items are
 * flex rows. Each item holds only a link, so TaskNotes gave task links the full
 * standalone card. That card is a size container with no width of its own, so as a
 * flex item it collapsed into a narrow two-row card that wrapped the title and
 * overlapped the next item. Links in these toolbars now get the compact in-sentence
 * widget; links in ordinary callouts keep the full card.
 *
 * The Note Toolbar plugin is not installed; its callout rules (from styles.css in
 * Note Toolbar 1.36.13) are injected instead.
 *
 * @see https://github.com/callumalpass/tasknotes/issues/2643
 */
import { test, expect, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

const note = `Issue2643-${Date.now()}.md`;
const body = [
  '> [!note-toolbar]',
  '> - [[Welcome]]',
  '> - ›',
  '> - [[Buy groceries]]',
  '> - ›',
  '> - Grafana',
  '',
  'Body text.',
  '',
  '> [!note]',
  '> - [[Plan vacation]]',
  '',
].join('\n');

const NOTE_TOOLBAR_CSS = `
body .callout[data-callout=note-toolbar] { padding: 0; width: 100%; }
body .callout[data-callout=note-toolbar] .callout-title { display: none; }
body .callout[data-callout=note-toolbar] .callout-content ul { display: flex; flex-wrap: wrap; gap: 0rem; padding-inline-start: 0; }
body .callout[data-callout=note-toolbar] .callout-content li { align-items: center; display: flex; list-style: none; padding: 0; margin: 0 0.5em 0 0; }
body .callout[data-callout=note-toolbar] .callout-content li .list-bullet { display: none; }
`;

let instance: ObsidianApp;
let page: Page;

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await page.evaluate(async ({ note, body }) => {
    await (window as any).app.vault.create(note, body);
  }, { note, body });
  await page.evaluate(css => {
    const style = document.createElement('style');
    style.id = 'issue-2643-note-toolbar';
    style.textContent = css;
    document.head.appendChild(style);
  }, NOTE_TOOLBAR_CSS);
});

test.afterAll(async () => {
  if (!instance) return;
  await page.evaluate(async note => {
    document.getElementById('issue-2643-note-toolbar')?.remove();
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(note);
    if (file) await app.vault.delete(file);
  }, note);
  await closeObsidian(instance);
});

async function measureToolbar(page: Page, root: string) {
  return page.evaluate(root => {
    const scope = document.querySelector<HTMLElement>(root)!;
    const toolbar = scope.querySelector<HTMLElement>('.callout[data-callout="note-toolbar"]')!;
    const items = [...toolbar.querySelectorAll<HTMLElement>('.callout-content li')];
    const widget = toolbar.querySelector<HTMLElement>('.tasknotes-inline-widget');
    const plain = items.find(item => item.textContent?.trim() === 'Grafana')!;
    const welcome = items.find(item => item.textContent?.trim() === 'Welcome')!;
    const card = scope.querySelector<HTMLElement>('.callout[data-callout="note"] .tasknotes-inline-widget');
    const rect = (el: Element) => el.getBoundingClientRect();
    return {
      sentence: widget?.classList.contains('tasknotes-inline-widget--sentence') ?? null,
      hasStatus: !!widget?.querySelector('.task-card__status-dot'),
      widgetLeft: widget ? rect(widget).left : 0,
      widgetRight: widget ? rect(widget).right : 0,
      widgetHeight: widget ? rect(widget).height : 0,
      titleHeight: widget ? rect(widget.querySelector('.task-card__title')!).height : 0,
      plainLeft: rect(plain).left,
      plainHeight: rect(plain).height,
      plainTop: rect(plain).top,
      welcomeTop: rect(welcome).top,
      lineHeight: parseFloat(getComputedStyle(plain).lineHeight) || rect(plain).height,
      controlSentence: card ? card.classList.contains('tasknotes-inline-widget--sentence') : null,
    };
  }, root);
}

function expectOneRowToolbar(m: Awaited<ReturnType<typeof measureToolbar>>) {
  expect(m.sentence).toBe(true);
  expect(m.hasStatus).toBe(true);
  // The task item stays before the plain "Grafana" item, on the same row.
  expect(m.widgetRight).toBeLessThanOrEqual(m.plainLeft + 1);
  expect(Math.abs(m.plainTop - m.welcomeTop)).toBeLessThanOrEqual(4);
  // The title does not wrap: no taller than about one line.
  expect(m.titleHeight).toBeLessThan(m.lineHeight * 1.6);
  expect(m.widgetHeight).toBeLessThan(m.plainHeight * 2);
  // Control: a task link alone in an ordinary callout keeps the full card.
  expect(m.controlSentence).toBe(false);
}

test('task links in a Note Toolbar callout stay on one row in Reading view', async () => {
  await page.evaluate(async note => {
    const app = (window as any).app;
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(app.vault.getAbstractFileByPath(note), { state: { mode: 'preview' } });
  }, note);

  const root = '.workspace-leaf.mod-active .markdown-reading-view';
  await expect(page.locator(`${root} .callout[data-callout="note-toolbar"] .tasknotes-inline-widget`)).toHaveCount(1);
  await expect(page.locator(`${root} .callout[data-callout="note"] .tasknotes-inline-widget`)).toHaveCount(1);
  expectOneRowToolbar(await measureToolbar(page, root));
});

test('task links in a Note Toolbar callout stay on one row in Live Preview', async () => {
  await page.evaluate(async note => {
    const app = (window as any).app;
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(app.vault.getAbstractFileByPath(note), { state: { mode: 'source', source: false } });
    // Keep the caret below both callouts so they render as widgets.
    const editor = leaf.view.editor;
    editor.setCursor(editor.lastLine(), 0);
  }, note);

  const root = '.workspace-leaf.mod-active .markdown-source-view';
  await expect(page.locator(`${root} .callout[data-callout="note-toolbar"] .tasknotes-inline-widget`)).toHaveCount(1);
  await expect(page.locator(`${root} .callout[data-callout="note"] .tasknotes-inline-widget`)).toHaveCount(1);
  expectOneRowToolbar(await measureToolbar(page, root));
});
