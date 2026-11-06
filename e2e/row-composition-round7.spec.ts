import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'fs';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport } from './obsidian';

const evidence = '/tmp/tasknotes-r7/row/acceptance';
const folder = `RowComposition-${Date.now()}`;

test.use({ trace: 'on' });

async function settle(page: Page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('task rows, board cards and standalone links compose by available width', async () => {
  test.setTimeout(240000);
  mkdirSync(evidence, { recursive: true });
  const instance = await launchObsidian();
  const page = instance.page;
  const measurements: unknown[] = [];
  let originalSettings: any;
  try {
    originalSettings = await page.evaluate(async ({ folder, list, board }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
      const settings = { taskIdentificationMethod: plugin.settings.taskIdentificationMethod, taskTag: plugin.settings.taskTag };
      plugin.settings.taskIdentificationMethod = 'tag';
      plugin.settings.taskTag = 'task';
      await app.vault.createFolder(folder);
      for (const [index, title, metadata] of [
        ['01', 'Review the research summary', 'priority: high\nscheduled: 2026-11-07\ndue: 2026-11-08'],
        ['02', 'No metadata task', ''],
        ['03', 'Plan the handover', 'priority: normal\nscheduled: 2026-11-08\ndue: 2026-11-09'],
        ['04', 'Review keyboard navigation', 'priority: low\ndue: 2026-11-09'],
        ['05', 'Check the mobile layout', 'priority: high\nscheduled: 2026-11-10\ndue: 2026-11-11'],
        ['06', 'Finish the outline', 'priority: low\ndue: 2026-11-12'],
        ['07', 'A longer title that should keep all of its words readable in a narrow desktop pane and on mobile', 'priority: high\nscheduled: 2026-11-07T09:30\ndue: 2026-11-08T15:45\ncontexts: [studio, focus, review]\nprojects: ["[[TaskNotes redesign]]"]\ntimeEstimate: 45'],
      ]) {
        await app.vault.create(`${folder}/${index}.md`, `---\ntitle: ${title}\nstatus: open\ntags: [task]\n${metadata}\n---\n${index === '02' ? '' : '\nNotes for this task.'}`);
      }
      await app.vault.create(`${folder}/List.base`, list);
      await app.vault.create(`${folder}/Board.base`, board);
      await app.vault.create(`${folder}/Inline.md`, '# Inline tasks\n\n- [[01]]\n- [[02]]\n\nDiscuss [[03]] with the team.\n');
      return settings;
    }, { folder,
      list: stringify({ filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] }, views: [{ type: 'tasknotesTaskList', name: 'List', order: ['status', 'priority', 'scheduled', 'due', 'contexts', 'projects', 'timeEstimate'], sort: [{ column: 'file.name', direction: 'ASC' }] }] }),
      board: stringify({ filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] }, views: [{ type: 'tasknotesKanban', name: 'Board', columnWidth: 300, groupBy: { property: 'status', direction: 'ASC' }, order: ['status', 'priority', 'scheduled', 'due', 'contexts', 'projects', 'timeEstimate'] }] }),
    });

    for (const surface of ['List.base', 'Board.base', 'Inline.md']) {
      await page.evaluate(async filepath => {
        const app = (window as any).app;
        const leaf = app.workspace.getLeaf(false);
        await leaf.openFile(app.vault.getAbstractFileByPath(filepath));
        if (filepath.endsWith('.md')) await leaf.setViewState({ type: 'markdown', state: { file: filepath, mode: 'source', source: false } });
      }, `${folder}/${surface}`);
      await expect(page.locator('.workspace-leaf.mod-active .task-card').first()).toBeVisible();
      for (const width of [1180, 700, 430, 400]) {
        for (const theme of ['light', 'dark']) {
          for (const mobile of width === 400 ? [false, true] : [false]) {
            await setObsidianViewport(page, { width, height: 800 });
            await page.evaluate(({ theme, mobile }) => {
              document.body.classList.toggle('is-mobile', mobile);
              document.body.classList.toggle('theme-light', theme === 'light');
              document.body.classList.toggle('theme-dark', theme === 'dark');
            }, { theme, mobile });
            await settle(page);
            const cards = page.locator('.workspace-leaf.mod-active .task-card');
            const first = cards.first();
            const geometry = await cards.evaluateAll(elements => elements.slice(0, 7).map(card => {
              const title = card.querySelector<HTMLElement>('.task-card__title-text')!;
              const status = card.querySelector<HTMLElement>('.task-card__status-dot')!;
              const metadata = card.querySelector<HTMLElement>('.task-card__metadata')!;
              return { height: card.getBoundingClientRect().height, width: card.getBoundingClientRect().width,
                top: card.getBoundingClientRect().top, bottom: card.getBoundingClientRect().bottom,
                title: title.getBoundingClientRect().toJSON(), status: status.getBoundingClientRect().toJSON(),
                metadataHeight: metadata.getBoundingClientRect().height, empty: card.classList.contains('task-card--metadata-empty'),
                dateFragments: Array.from(card.querySelectorAll<HTMLElement>('.task-card__date-slot:not([hidden]) .task-card__metadata-date > .task-card__date-value')).filter(label => getComputedStyle(label).display !== 'none' && label.scrollWidth > label.clientWidth + 1).length,
              };
            }));
            measurements.push({ surface, width, theme, mobile, geometry });
            if (surface !== 'Inline.md') {
              expect(geometry).toHaveLength(7);
              expect(geometry.every(row => row.dateFragments === 0)).toBe(true);
              if (width <= 430 || surface === 'Board.base') {
                expect(geometry[0].title.x).toBeGreaterThanOrEqual(geometry[0].status.right);
                expect(geometry[0].metadataHeight).toBeLessThanOrEqual(40.5);
                expect(geometry[1].empty).toBe(true);
                expect(geometry[1].height).toBeLessThanOrEqual(59);
                const controls = await first.locator('.task-card__status-dot, .task-card__priority-dot, .task-card__context-menu, .task-card__metadata-date:visible, .task-card__metadata-overflow:visible').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
                const minimumTarget = surface === 'Board.base' && !mobile ? 24 : 40;
                expect(controls.every(control => control.width >= minimumTarget && control.height >= minimumTarget)).toBe(true);
              }
              if (surface === 'List.base' && width <= 430) {
                expect(geometry[5].bottom - geometry[0].top).toBeLessThan(560);
                expect(geometry[5].bottom).toBeLessThan(700);
                expect(geometry[6].title.height).toBeGreaterThan(geometry[0].title.height);
              }
              if (surface === 'List.base' && width === 430) {
                await expect(first.locator('.task-card__date-slot--scheduled')).toBeVisible();
                await expect(first.locator('.task-card__date-slot--due')).toBeVisible();
              }
            } else if (width <= 430) {
              expect(geometry[0].title.x).toBeGreaterThanOrEqual(geometry[0].status.right);
              expect(geometry.every(row => row.dateFragments === 0)).toBe(true);
            }
            await page.screenshot({ path: `${evidence}/${surface.split('.')[0]}-${width}-${theme}${mobile ? '-mobile' : ''}.png` });
          }
        }
      }
    }

    await page.evaluate(async folder => {
      const app = (window as any).app;
      document.body.classList.remove('is-mobile');
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(`${folder}/List.base`));
    }, folder);
    await setObsidianViewport(page, { width: 1180, height: 800 });
    const first = page.locator('.tn-tasknotesTaskList .task-card').first();
    await expect(first).toBeVisible();
    const beforeHover = await first.boundingBox();
    await first.locator('.task-card__title-text').hover();
    await settle(page);
    expect(await first.boundingBox()).toEqual(beforeHover);
    await page.screenshot({ path: `${evidence}/list-hover.png` });
    await first.click({ modifiers: ['Shift'] });
    await expect(first).toHaveClass(/task-card--selected/);
    await first.focus();
    await page.keyboard.press('ArrowDown');
    await page.screenshot({ path: `${evidence}/list-selection-keyboard.png` });
    await page.keyboard.press('Escape');
    const status = first.locator('.task-card__status-dot');
    const originalStatus = await first.getAttribute('data-status');
    await status.click();
    await expect(first).not.toHaveAttribute('data-status', originalStatus!);
    await status.click({ modifiers: ['Shift'] });
    await expect(first).toHaveAttribute('data-status', originalStatus!);
    await setObsidianViewport(page, { width: 400, height: 800 });
    const overflow = page.locator('.tn-tasknotesTaskList .task-card__metadata-overflow:visible').last();
    await overflow.click();
    await expect(page.locator('.tn-popover[role="dialog"]')).toBeVisible();
    await page.screenshot({ path: `${evidence}/metadata-disclosure.png` });
    await page.keyboard.press('Escape');
    await expect(overflow).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.tn-tasknotesTaskList')).toBeFocused();
  } finally {
    writeFileSync(`${evidence}/geometry.json`, JSON.stringify(measurements, null, 2));
    await page.evaluate(async ({ folder, settings }) => {
      const app = (window as any).app;
      if (settings) Object.assign(app.plugins.plugins.tasknotes.settings, settings);
      const fixtures = app.vault.getAbstractFileByPath(folder);
      if (fixtures) await app.vault.delete(fixtures, true);
    }, { folder, settings: originalSettings }).catch(() => {});
    await closeObsidian(instance);
  }
});
