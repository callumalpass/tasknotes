import { test, expect, type Locator } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport } from './obsidian';

test('AD: modal isolation, Year reveal, aligned metadata, drop feedback and mini focus', async () => {
  test.setTimeout(300000);
  const phase = process.env.TASKNOTES_AD_PHASE || 'after';
  const evidence = `/tmp/tasknotes-r7/ad/${phase}`;
  mkdirSync(evidence, { recursive: true });
  const instance = await launchObsidian();
  const page = instance.page;
  const folder = `ReviewAD-${Date.now()}`;
  const observations: Record<string, unknown> = {};
  const verify = phase !== 'before';
  const capture = async (name: string) => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `${evidence}/${name}.png` });
  };
  const open = async (name: string) => {
    await page.evaluate(async ({ folder, name }) => {
      const app = (window as any).app;
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(`${folder}/${name}.base`));
    }, { folder, name });
    await page.waitForTimeout(400);
  };
  const card = (index: number) => page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${folder}/${index}.md"]`).first();
  const lift = async (source: Locator, x: number, y: number) => {
    const bounds = (await source.boundingBox())!;
    await page.mouse.move(bounds.x + 12, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 25, bounds.y + bounds.height / 2 + 7, { steps: 6 });
    await page.mouse.move(x, y, { steps: 12 });
    await page.waitForTimeout(100);
  };
  const cancelDrag = async () => { await page.keyboard.press('Escape'); await page.mouse.up(); };
  try {
    const fields = await page.evaluate(async folder => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      plugin.settings.singleClickAction = 'edit';
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
      await app.vault.createFolder(folder);
      const sort = plugin.fieldMapper.toUserField('sortOrder');
      const today = new Date();
      const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      for (let index = 0; index < 9; index++) {
        await app.vault.create(`${folder}/${index}.md`, `---\ntitle: ${index === 0 ? 'Task without context' : index === 1 ? 'Task with office context' : `Delivery item ${index}`}\ntags: ${index ? '[task, delivery, review]' : '[task]'}\nstatus: ${index === 8 ? 'done' : 'open'}\npriority: normal\nscheduled: ${index < 2 ? date : index === 2 ? `${date}T09:15` : '2026-11-14'}\ndue: ${index < 2 ? date : index === 2 ? '2026-11-08' : '2026-11-15'}\n${sort}: tn${String(index).padStart(10, '0')}\n${index ? 'contexts: [office]\nprojects: [Project]\ntimeEstimate: 35\n' : ''}---\n\nDelivery details.\n`);
      }
      return { sort, date };
    }, folder);
    const filters = { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] };
    const order = ['status', 'priority', 'contexts', 'projects', 'file.tags', 'scheduled', 'due', 'timeEstimate'];
    const bases = {
      List: { filters, views: [{ type: 'tasknotesTaskList', name: 'List', order: ['status', 'priority', 'contexts', 'projects', 'scheduled', 'due'] }] },
      Invalid: { filters, formulas: { bucket: 'if(status == "open", "Open work", "Other work")' }, views: [{ type: 'tasknotesTaskList', name: 'List', groupBy: { property: 'formula.bucket', direction: 'ASC' }, order }] },
      Board: { filters, views: [{ type: 'tasknotesKanban', name: 'Board', groupBy: { property: 'status', direction: 'ASC' }, order, sort: [{ column: fields.sort, direction: 'ASC' }] }] },
      Year: { filters, views: [{ type: 'tasknotesCalendar', name: 'Year', calendarView: 'multiMonthYear', order }] },
      Mini: { filters, views: [{ type: 'tasknotesMiniCalendar', name: 'Mini' }] },
    };
    await page.evaluate(async ({ folder, files }) => {
      const app = (window as any).app;
      for (const [name, content] of files) await app.vault.create(`${folder}/${name}.base`, content);
    }, { folder, files: Object.entries(bases).map(([name, value]) => [name, stringify(value)]) });
    for (const theme of ['light', 'dark']) for (const width of [1180, 400]) {
      await page.evaluate(({ theme, width }) => {
        const native = (window as any).require('electron').remote.getCurrentWindow();
        native.setMinimumSize(320, 500);
        if (native.isMaximized()) native.unmaximize();
        document.body.classList.toggle('is-mobile', width === 400);
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
      }, { theme, width });
      await setObsidianViewport(page, { width, height: 800 });
      await expect.poll(() => page.evaluate(() => (window as any).require('electron').remote.getCurrentWindow().getContentSize())).toEqual([width, 800]);
      const variant = `${theme}-${width}`;
      await open('List');
      const warning = page.getByText("Don't show again", { exact: true });
      if (await warning.isVisible()) await warning.click();
      await expect(card(0)).toBeVisible();
      await capture(`list-${variant}`);
      const dates = await page.locator('.tn-tasknotesTaskList .task-card').evaluateAll(cards => cards.map(card => ({ title: card.querySelector('.task-card__title-text')?.textContent, height: card.getBoundingClientRect().height, dates: Array.from(card.querySelectorAll('.task-card__date-slot')).map(slot => ({ left: slot.getBoundingClientRect().left, width: slot.getBoundingClientRect().width })) })));
      observations[`alignment-${variant}`] = dates;
      if (verify && width === 1180) expect.soft(Math.abs(dates[0].dates[0].left - dates[1].dates[0].left)).toBeLessThan(2);
      await card(1).locator('.task-card__status-dot').focus();
      await capture(`list-focus-${variant}`);
      await card(0).locator('.task-card__title-text').hover();
      await capture(`list-hover-${variant}`);
      if (width === 1180) {
        const before = await page.evaluate(async folder => {
          const app = (window as any).app;
          return Promise.all([0, 1].map(index => app.vault.read(app.vault.getAbstractFileByPath(`${folder}/${index}.md`))));
        }, folder);
        await card(0).locator('.task-card__title-text').click();
        await page.keyboard.press('s');
        await expect(page.locator('.modal-container')).toBeVisible();
        await page.waitForTimeout(250);
        const backgroundPickers = await page.locator('body > .tn-popover').count();
        observations[`modal-race-${variant}`] = { backgroundPickers };
        await capture(`modal-race-${variant}`);
        if (verify) expect.soft(backgroundPickers).toBe(0);
        await page.keyboard.press('Escape');
        if (await page.locator('.modal-container').count()) await page.keyboard.press('Escape');
        await expect(page.locator('.modal-container')).toHaveCount(0);
        while (await page.locator('body > .tn-popover').count()) await page.keyboard.press('Escape');
        const after = await page.evaluate(async folder => {
          const app = (window as any).app;
          return Promise.all([0, 1].map(index => app.vault.read(app.vault.getAbstractFileByPath(`${folder}/${index}.md`))));
        }, folder);
        if (verify) expect.soft(after).toEqual(before);
      }
      await open('Board');
      await expect(card(0)).toBeVisible();
      await capture(`board-${variant}`);
      await card(0).hover();
      await capture(`board-hover-${variant}`);
      await card(0).locator('.task-card__status-dot').focus();
      await capture(`board-focus-${variant}`);
      const counts = await page.locator('.kanban-view__card-wrapper .task-card__metadata-overflow:not([hidden])').evaluateAll(elements => elements.map(element => ({ text: element.textContent, width: element.clientWidth, required: element.scrollWidth })));
      observations[`board-counts-${variant}`] = counts;
      if (verify) for (const count of counts) expect.soft(count.required).toBeLessThanOrEqual(count.width + 1);
      if (width === 1180) {
        const target = (await card(0).boundingBox())!;
        await lift(card(0), target.x + target.width / 2, target.y + target.height - 3);
        await capture(`board-held-${variant}`);
        const markers = await page.locator('.kanban-view__card-wrapper--drop-marker, .kanban-view__cards--drop-marker-end').count();
        observations[`board-marker-${variant}`] = markers;
        if (verify) expect.soft(markers).toBeGreaterThan(0);
        await cancelDrag();
      }
      await open('Year');
      await expect(page.locator('.tnc-year')).toBeVisible();
      const monthVisible = () => page.locator(`.tnc-ym-day[data-date="${fields.date}"]`).evaluate(element => {
        const month = element.closest('.tnc-ym')!.getBoundingClientRect();
        const scroller = element.closest('.tnc-year-scroll')!.getBoundingClientRect();
        return month.top >= scroller.top - 1 && month.bottom <= scroller.bottom + 1;
      });
      observations[`year-entry-${variant}`] = await monthVisible();
      if (verify) expect.soft(await monthVisible()).toBe(true);
      await page.locator('.tnc-year-scroll').evaluate(element => { element.scrollTop = 0; });
      await page.getByRole('button', { name: 'Today', exact: true }).click();
      await page.waitForTimeout(250);
      observations[`year-today-${variant}`] = await monthVisible();
      await capture(`year-today-${variant}`);
      if (verify) expect.soft(await monthVisible()).toBe(true);
      await open('Mini');
      const day = page.locator('.mini-calendar-view__day--today');
      await expect(day).toBeVisible();
      await day.click();
      await expect(page.locator('.modal-container')).toBeVisible();
      await capture(`mini-chooser-${variant}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
      const gridFocused = await page.evaluate(() => document.activeElement?.classList.contains('mini-calendar-view__grid'));
      observations[`mini-focus-${variant}`] = gridFocused;
      if (verify) expect.soft(gridFocused).toBe(true);
      await page.keyboard.press('ArrowRight');
      await capture(`mini-return-${variant}`);
      if (width === 1180) {
        await open('Invalid');
        const header = page.locator('.task-group-header').filter({ hasText: 'Open work' }).first();
        const bounds = (await header.boundingBox())!;
        await lift(card(8), bounds.x + 180, bounds.y + bounds.height / 2);
        const hint = page.locator('.task-list-view__movement-feedback');
        await expect(hint).toBeVisible();
        const visible = await hint.evaluate(element => {
          const rect = element.getBoundingClientRect();
          return { top: rect.top, hit: element.ownerDocument.elementFromPoint(rect.left + 5, rect.top + 5)?.className, rootTop: element.closest('.tn-tasknotesTaskList')!.getBoundingClientRect().top };
        });
        observations[`invalid-${variant}`] = visible;
        await capture(`list-invalid-${variant}`);
        if (verify) expect.soft(visible.top).toBeGreaterThanOrEqual(visible.rootTop);
        await cancelDrag();
      }
    }
  } finally {
    writeFileSync(`${evidence}/observations.json`, JSON.stringify(observations, null, 2));
    await page.evaluate(async folder => {
      const app = (window as any).app;
      await app.workspace.getLeaf(false).setViewState({ type: 'empty', active: true });
      const target = app.vault.getAbstractFileByPath(folder);
      if (target) await app.vault.delete(target, true);
    }, folder).catch(() => {});
    await closeObsidian(instance);
  }
});
