import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport } from './obsidian';

const evidence = '/tmp/tasknotes-r7/meta/acceptance';
const folder = `MetadataR7-${Date.now()}`;
test.use({ trace: 'on' });

async function settle(page: Page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('metadata atoms, board titles, source states, sticky reveal and inline targets', async () => {
  test.setTimeout(240000);
  mkdirSync(evidence, { recursive: true });
  const instance = await launchObsidian();
  const page = instance.page;
  page.setDefaultTimeout(10000);
  const measurements: any[] = [];
  let settings: any;
  const open = async (name: string) => {
    await page.evaluate(async ({ folder, name }) => {
      const app = (window as any).app;
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(`${folder}/${name}`));
    }, { folder, name });
    await settle(page);
  };
  try {
    const filters = { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] };
    const order = ['status', 'priority', 'scheduled', 'due', 'projects', 'contexts', 'file.tags', 'timeEstimate'];
    settings = await page.evaluate(async ({ folder, list, board, agenda, calendar, quiet }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      const settings = JSON.parse(JSON.stringify(plugin.settings));
      plugin.settings.taskIdentificationMethod = 'tag';
      plugin.settings.taskTag = 'task';
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
      const nativeWindow = (window as any).require('electron').remote.getCurrentWindow();
      nativeWindow.setMinimumSize(320, 500);
      if (nativeWindow.isMaximized()) nativeWindow.unmaximize();
      await app.vault.createFolder(folder);
      await app.vault.create(`${folder}/Product refresh.md`, '# Product refresh');
      for (let index = 0; index < 45; index++) {
        const title = index === 0
          ? 'Review the detailed research summary and confirm every upcoming project milestone with the entire delivery team before the final handover'
          : `Delivery task ${String(index).padStart(2, '0')}`;
        const rich = index < 2 ? `scheduled: 2026-11-06\ndue: 2026-11-07\nprojects: ['[[${folder}/Product refresh|Product refresh]]']\ncontexts: [home, studio]\ntimeEstimate: 45\n` : '';
        await app.vault.create(`${folder}/${String(index).padStart(2, '0')}.md`, `---\ntags: [task, review]\ntitle: ${title}\nstatus: open\npriority: normal\n${rich}---\n`);
      }
      await app.vault.create(`${folder}/List.base`, list);
      await app.vault.create(`${folder}/Board.base`, board);
      await app.vault.create(`${folder}/Agenda.base`, agenda);
      await app.vault.create(`${folder}/Calendar.base`, calendar);
      await app.vault.create(`${folder}/Quiet.base`, quiet);
      await app.vault.create(`${folder}/Inline.md`, `# Delivery notes\n\nBefore [[${folder}/01|review]], then [[${folder}/02|approve]] and ship.\n\n[[${folder}/00]]\n`);
      return settings;
    }, { folder,
      list: stringify({ filters, views: [{ type: 'tasknotesTaskList', name: 'List', groupBy: { property: 'status', direction: 'ASC' }, order, sort: [{ column: 'file.name', direction: 'ASC' }] }] }),
      board: stringify({ filters, views: [{ type: 'tasknotesKanban', name: 'Board', columnWidth: 300, groupBy: { property: 'status', direction: 'ASC' }, order, hideEmptyColumns: false }] }),
      agenda: stringify({ filters, views: [{ type: 'tasknotesCalendar', name: 'Agenda', calendarView: 'listWeek', initialDate: '2026-11-06', showDateStrip: true, order }] }),
      calendar: stringify({ filters, views: [{ type: 'tasknotesCalendar', name: 'Calendar', calendarView: 'dayGridMonth', initialDate: '2026-11-06', showMonthDayPanel: true, order }] }),
      quiet: stringify({ filters: { and: [`file.path == "${folder}/02.md"`] }, views: [{ type: 'tasknotesTaskList', name: 'Quiet', order: ['status'] }] }),
    });

    for (const surface of ['List.base', 'Board.base']) {
      await open(surface);
      const root = page.locator(surface === 'List.base' ? '.tn-tasknotesTaskList' : '.tn-tasknotesKanban');
      const first = root.locator(`.task-card[data-task-path="${folder}/00.md"]`).first();
      await expect(first).toBeVisible();
      for (const width of [1180, 760, 400]) {
        for (const theme of ['light', 'dark']) {
          await page.evaluate(({ theme, width }) => {
            document.body.classList.toggle('is-mobile', width === 400);
            document.body.classList.remove('theme-light', 'theme-dark');
            document.body.classList.add(`theme-${theme}`);
          }, { theme, width });
          await setObsidianViewport(page, { width, height: 800 });
          await settle(page);
          const geometry = await first.evaluate(card => {
            const atoms = Array.from(card.querySelectorAll<HTMLElement>('.task-card__metadata-values > :not(.task-card__metadata-chips), .task-card__metadata-chips :is(.tag, .context-tag, .task-card__project-link)')).filter(atom => !!atom.getClientRects().length);
            const lane = card.querySelector('.task-card__metadata-values')!.getBoundingClientRect();
            const title = card.querySelector<HTMLElement>('.task-card__title-text')!;
            return {
              atoms: atoms.map(atom => ({ text: atom.textContent, width: atom.clientWidth, scroll: atom.scrollWidth, right: atom.getBoundingClientRect().right, boundary: lane.right })),
              titleHeight: title.getBoundingClientRect().height,
              titleLineHeight: parseFloat(getComputedStyle(title).lineHeight),
              dates: card.querySelectorAll('.task-card__date-slot:not([hidden])').length,
              overflow: card.querySelector('.task-card__metadata-overflow')?.getAttribute('aria-label'),
            };
          });
          measurements.push({ surface, width, theme, geometry });
          await page.screenshot({ path: `${evidence}/${surface}-${width}-${theme}.png` });
          expect.soft(geometry.atoms.every(atom => atom.scroll <= atom.width + 1 && atom.right <= atom.boundary + 1)).toBe(true);
          if (surface === 'Board.base') {
            expect.soft(geometry.titleHeight).toBeLessThanOrEqual(geometry.titleLineHeight * 2 + 1);
            expect.soft(geometry.dates).toBe(2);
          }
          if (width === 400) {
            expect.soft(geometry.overflow).toContain('Product refresh');
            const overflow = first.locator('.task-card__metadata-overflow');
            const count = Number((await overflow.innerText()).slice(1));
            await overflow.click();
            await expect(page.locator('.tn-popover .tn-picker__row')).toHaveCount(count);
            await expect(page.locator('.tn-popover .tn-picker__row').filter({ hasText: 'Product refresh' })).toBeVisible();
            await page.keyboard.press('Escape');
          }
        }
      }
      await page.evaluate(() => document.body.classList.remove('is-mobile'));
      await setObsidianViewport(page, { width: 1180, height: 800 });
      const second = root.locator(`.task-card[data-task-path="${folder}/01.md"]`).first();
      await first.locator('.task-card__title-text').click({ modifiers: ['Control'] });
      await second.locator('.task-card__title-text').click({ modifiers: ['Control'] });
      await expect(first).toHaveClass(/task-card--selected/);
      await expect(second).toHaveClass(/task-card--selected/);
      const source = surface === 'Board.base' ? first.locator('..') : first;
      await first.scrollIntoViewIfNeeded();
      const title = (await first.locator('.task-card__title-text').boundingBox())!;
      await page.mouse.move(title.x + 20, title.y + 10);
      await page.mouse.down();
      await page.mouse.move(title.x + 42, title.y + 15, { steps: 6 });
      await expect(source).toHaveClass(surface === 'Board.base' ? /kanban-view__card--dragging/ : /task-card--dragging/);
      await settle(page);
      const sourceStates = await root.locator('.task-card--selected').evaluateAll(cards => cards.map(card => ({ opacity: getComputedStyle(card).opacity, className: card.parentElement?.className })));
      measurements.push({ surface, sourceStates });
      expect.soft(sourceStates.every(card => parseFloat(card.opacity) < 1)).toBe(true);
      if (surface === 'List.base') {
        const header = root.locator('.task-group-header').first();
        const bounds = (await header.boundingBox())!;
        await page.mouse.move(bounds.x + 20, bounds.y + bounds.height / 2, { steps: 6 });
        const feedback = root.locator('.task-list-view__movement-feedback');
        await expect(feedback).toContainText('Already in this group');
        const hint = (await feedback.boundingBox())!;
        measurements.push({ sameGroupFeedback: { header: bounds, hint } });
        expect.soft(hint.x).toBeLessThan(bounds.x + 40);
        expect.soft(hint.y + hint.height).toBeLessThanOrEqual(bounds.y + bounds.height);
      }
      const toolbar = page.locator('.bases-toolbar').first();
      if (await toolbar.count()) {
        const bounds = (await toolbar.boundingBox())!;
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { steps: 6 });
        await settle(page);
        measurements.push({ surface, invalidCursor: await toolbar.evaluate(element => getComputedStyle(element).cursor) });
        expect.soft(await toolbar.evaluate(element => getComputedStyle(element).cursor)).toBe('not-allowed');
      }
      await page.screenshot({ path: `${evidence}/${surface}-drag.png` });
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect(root.locator('.task-card--dragging, .kanban-view__card--dragging')).toHaveCount(0);
      await expect(page.locator('body')).not.toHaveClass(/tn-drag-invalid|tn-drag-active/);
      await page.keyboard.press('Escape');

      if (surface === 'List.base') {
        const entry = root.locator(`.task-card[data-task-path="${folder}/20.md"]`).first();
        await entry.scrollIntoViewIfNeeded();
        await entry.locator('.task-card__priority-dot').click();
        await page.keyboard.press('Escape');
        for (let index = 0; index < 24; index++) {
          await page.keyboard.press(index < 12 ? 'k' : 'j');
          await settle(page);
          const focus = await root.evaluate(element => {
            const card = element.querySelector('.tn-task-focused');
            if (!card) return null;
            const rect = card.getBoundingClientRect();
            const headers = Array.from(element.querySelectorAll('.task-list-virtual-sticky-header, .task-group-header')).map(header => header.getBoundingClientRect()).filter(header => header.height > 0 && header.top < rect.bottom && header.bottom > rect.top);
            return { top: rect.top, bottom: rect.bottom, occluded: headers.some(header => header.bottom > rect.top), hit: card.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)) };
          });
          measurements.push({ keyboard: index, focus });
          expect.soft(focus).not.toBeNull();
          expect.soft(focus?.occluded).toBe(false);
          expect.soft(focus?.hit).toBe(true);
        }
        await page.screenshot({ path: `${evidence}/list-sticky-focus.png` });
      } else {
        await first.locator('.task-card__priority-dot').click();
        await page.keyboard.press('Escape');
        for (const key of ['j', 'j', 'j', 'k', 'k', 'k']) {
          await page.keyboard.press(key);
          await settle(page);
          const hit = await root.locator('.tn-task-focused').first().evaluate(card => {
            const bounds = card.getBoundingClientRect();
            return card.contains(document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
          });
          expect.soft(hit).toBe(true);
        }
      }
    }
    for (const surface of ['Agenda.base', 'Calendar.base']) {
      await open(surface);
      if (surface === 'Calendar.base') {
        await page.locator('.tnc-dg-day[data-date="2026-11-06"]').click();
        await expect(page.locator('.tn-calendar-day-panel')).toBeVisible();
      }
      const root = page.locator(surface === 'Agenda.base' ? '#bases-calendar' : '.tn-calendar-day-panel').first();
      const card = root.locator(`.task-card[data-task-path="${folder}/00.md"]`).first();
      await expect(card).toBeVisible();
      for (const width of [1180, 400]) {
        for (const theme of ['light', 'dark']) {
          await page.evaluate(({ width, theme }) => {
            document.body.classList.toggle('is-mobile', width === 400);
            document.body.classList.remove('theme-light', 'theme-dark');
            document.body.classList.add(`theme-${theme}`);
          }, { width, theme });
          await setObsidianViewport(page, { width, height: 800 });
          await settle(page);
          const atoms = await card.locator('.task-card__metadata-chips :is(.tag, .context-tag, .task-card__project-link)').evaluateAll(elements => elements.filter(element => !!element.getClientRects().length).map(element => ({ width: element.clientWidth, scroll: element.scrollWidth, right: element.getBoundingClientRect().right, boundary: element.closest('.task-card__metadata-values')!.getBoundingClientRect().right })));
          measurements.push({ surface, width, theme, atoms });
          expect.soft(atoms.every(atom => atom.scroll <= atom.width + 1 && atom.right <= atom.boundary + 1)).toBe(true);
          await page.screenshot({ path: `${evidence}/${surface}-${width}-${theme}.png` });
        }
      }
    }
    await open('Quiet.base');
    await expect(page.locator('.tn-tasknotesTaskList .task-card--metadata-empty')).toBeVisible();
    await page.screenshot({ path: `${evidence}/no-metadata.png` });
    await open('Inline.md');
    await page.evaluate(async folder => {
      await (window as any).app.workspace.getMostRecentLeaf().setViewState({ type: 'markdown', state: { file: `${folder}/Inline.md`, mode: 'preview' } });
    }, folder);
    const sentence = page.locator('.markdown-preview-view .tasknotes-inline-widget--sentence').first();
    await expect(sentence).toBeVisible();
    for (const width of [1180, 400]) {
      for (const theme of ['light', 'dark']) {
        await page.evaluate(({ width, theme }) => {
          document.body.classList.toggle('is-mobile', width === 400);
          document.body.classList.remove('theme-light', 'theme-dark');
          document.body.classList.add(`theme-${theme}`);
        }, { width, theme });
        await setObsidianViewport(page, { width, height: 800 });
        await settle(page);
        const controls = await sentence.locator('.task-card__status-dot, .task-card__context-menu').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
        measurements.push({ width, theme, inline: controls });
        if (width === 400) expect.soft(controls.every(control => control.width >= 40 && control.height >= 40)).toBe(true);
        expect.soft(controls[0].right).toBeLessThanOrEqual(controls[1].left);
        await page.screenshot({ path: `${evidence}/inline-${width}-${theme}.png` });
      }
    }
  } finally {
    writeFileSync(`${evidence}/measurements.json`, JSON.stringify(measurements, null, 2));
    await page.evaluate(async ({ folder, settings }) => {
      const app = (window as any).app;
      if (settings) Object.assign(app.plugins.plugins.tasknotes.settings, settings);
      document.body.classList.remove('is-mobile');
      const generated = app.vault.getAbstractFileByPath(folder);
      if (generated) await app.vault.delete(generated, true);
    }, { folder, settings }).catch(() => {});
    await closeObsidian(instance);
  }
});
