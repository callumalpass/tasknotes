import { test, expect, type Locator, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
const folder = `NarrowReading-${Date.now()}`;
const taskPath = `${folder}/Review.md`;
const title = 'Ship the supplier onboarding plan with accessibility and operations before launch';

test.beforeAll(async () => {
  instance = await launchObsidian();
  await instance.page.evaluate(async ({ folder, taskPath, title }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    const today = (window as any).moment().format('YYYY-MM-DD');
    await app.vault.create(taskPath, `---\ntitle: ${title}\ntags: [task, supplier-onboarding, accessibility, operations, launch-review]\nstatus: ${plugin.settings.defaultTaskStatus}\npriority: ${plugin.settings.defaultTaskPriority}\nscheduled: ${today}T10:00\ndue: ${today}\ntimeEstimate: 60\n---\n`);
    await app.vault.create(`${folder}/Inline.md`, `# Review\n\n[[${folder}/Review]]\n`);
    for (let index = 0; index < 3; index++) {
      const duration = [15, 30, 90][index];
      await app.vault.create(`${folder}/Collision-${index}.md`, `---\ntitle: Review overlapping supplier appointment ${index + 1}\ntags: [task]\nstatus: ${plugin.settings.defaultTaskStatus}\nscheduled: ${today}T10:00\ntimeEstimate: ${duration}\n---\n`);
    }
    await app.vault.create(`${folder}/Deadline.md`, `---\ntitle: Confirm the supplier onboarding deadline with accessibility and operations\ntags: [task]\nstatus: ${plugin.settings.defaultTaskStatus}\ndue: ${today}\n---\n`);
    const completed = plugin.statusManager.getCompletedStatuses()[0];
    if (completed) await app.vault.create(`${folder}/Completed.md`, `---\ntitle: Completed control\ntags: [task]\nstatus: ${completed}\n---\n`);
    const neighbour = plugin.statusManager.getAllStatuses().find((status: any) => !status.isCompleted && status.value !== plugin.settings.defaultTaskStatus);
    if (neighbour) await app.vault.create(`${folder}/Neighbour.md`, `---\ntitle: Neighbouring column control\ntags: [task]\nstatus: ${neighbour.value}\n---\n`);
  }, { folder, taskPath, title });
  await expect.poll(() => instance.page.evaluate(async taskPath => Boolean(await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath)), taskPath)).toBe(true);
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      for (const leaf of app.workspace.getLeavesOfType('bases')) if (leaf.view.file?.path.startsWith(folder)) leaf.detach();
      const entry = app.vault.getAbstractFileByPath(folder);
      if (entry) await app.vault.delete(entry, true);
    }, folder);
  } finally { await closeObsidian(instance); }
});

async function openSurface(surface: string) {
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
    views: [{ type: surface === 'list' ? 'tasknotesTaskList' : surface === 'board' ? 'tasknotesKanban' : 'tasknotesCalendar',
      name: surface, groupBy: { property: 'status', direction: 'ASC' }, columnWidth: 340,
      calendarView: surface === 'agenda' ? 'listWeek' : 'timeGridWeek', slotMinTime: '08:00:00', slotMaxTime: '18:00:00',
      showTimeblocks: false, showTimeEntries: false,
      showDue: true,
      order: ['status', 'priority', 'tags', 'scheduled', 'due'] }],
  });
  await instance.page.evaluate(async ({ folder, surface, content }) => {
    const app = (window as any).app;
    const path = `${folder}/${surface === 'inline' ? 'Inline.md' : `${surface}.base`}`;
    const file = app.vault.getAbstractFileByPath(path) || await app.vault.create(path, content);
    await app.workspace.getLeaf(false).openFile(file, surface === 'inline' ? { state: { mode: 'preview' } } : undefined);
  }, { folder, surface, content });
}

async function capture(page: Page, name: string, target?: Locator) {
  await page.locator('.notice-container .notice').evaluateAll(elements => elements.forEach(element => element.remove()));
  await expect.poll(async () => {
    if (target) await target.evaluate(element => element.scrollIntoView({ block: 'nearest', inline: 'center' }));
    await page.screenshot({ path: `test-results/narrow-reading-r3/${name}.png`, clip: { x: 0, y: 0, ...page.viewportSize()! } });
    return !target || await target.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      return bounds.left >= element.closest('.tnc-tg-scroll')!.getBoundingClientRect().left && bounds.right <= innerWidth;
    });
  }).toBe(true);
}

for (const theme of ['light', 'dark']) for (const width of [400, 430]) {
  test(`${theme} ${width}: full-width titles, essential dates and grouped touch actions`, async () => {
    const page = instance.page;
    await setObsidianViewport(page, { width, height: 800 });
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(`theme-${theme}`, 'is-mobile');
    }, theme);
    for (const surface of ['list', 'agenda', 'inline']) {
      await openSurface(surface);
      const card = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${taskPath}"]:visible`).first();
      await expect(card).toBeVisible();
      await card.scrollIntoViewIfNeeded();
      await capture(page, `${theme}-${width}-${surface}`);
      await expect(card.locator('.task-card__title-text')).toHaveText(title);
      const geometry = await card.evaluate(element => {
        const title = element.querySelector<HTMLElement>('.task-card__title-text')!;
        const status = element.querySelector<HTMLElement>('.task-card__status-dot')!;
        const menu = element.querySelector<HTMLElement>('.task-card__context-menu')!;
        return { width: element.clientWidth, titleWidth: title.getBoundingClientRect().width,
          wraps: getComputedStyle(title).whiteSpace === 'normal',
          statusHeight: status.getBoundingClientRect().height, menuHeight: menu.getBoundingClientRect().height };
      });
      expect(geometry.wraps).toBe(true);
      expect(geometry.titleWidth).toBeGreaterThan((geometry.width - 80) * .85);
      expect(geometry.statusHeight).toBeGreaterThanOrEqual(40);
      expect(geometry.menuHeight).toBeGreaterThanOrEqual(40);
      if (surface !== 'inline') {
        const rows = await card.evaluate(element => {
          const bounds = element.getBoundingClientRect();
          const title = element.querySelector('.task-card__title-text')!.getBoundingClientRect();
          const actions = ['.task-card__status-dot', '.task-card__priority-dot', '.task-card__metadata-date--due', '.task-card__context-menu']
            .map(selector => element.querySelector(selector)!.getBoundingClientRect());
          const metadata = element.querySelector('.task-card__metadata-values')!.getBoundingClientRect();
          return { titleInside: title.top >= bounds.top && title.bottom <= bounds.bottom,
            actionsBelowTitle: actions.every(action => action.top >= title.bottom - 1),
            actionRowSpread: Math.max(...actions.map(action => action.top)) - Math.min(...actions.map(action => action.top)),
            metadataBelowActions: metadata.top >= Math.max(...actions.map(action => action.bottom)) - 1 };
        });
        expect(rows.titleInside, surface).toBe(true);
        expect(rows.actionsBelowTitle, surface).toBe(true);
        expect(rows.actionRowSpread, surface).toBeLessThanOrEqual(1);
        expect(rows.metadataBelowActions, surface).toBe(true);
      }
      const drag = card.locator('.task-card__drag-handle');
      if (await drag.count()) {
        const dragBox = await drag.boundingBox();
        const statusBox = await card.locator('.task-card__status-dot').boundingBox();
        expect(dragBox!.x).toBeGreaterThanOrEqual(statusBox!.x + statusBox!.width);
        expect(Math.abs(dragBox!.y - statusBox!.y)).toBeLessThanOrEqual(1);
      }
      await expect(card.locator('.task-card__metadata-date--due')).toBeVisible();
      if (surface === 'agenda') {
        await expect(card.locator('.task-card__metadata-date--scheduled')).toHaveCount(0);
        await expect(card.locator('..').locator('.tn-calendar-list-stamp')).toContainText('10:00');
        const due = card.locator('.task-card__metadata-date--due > span:last-child');
        expect(await due.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      } else await expect(card.locator('.task-card__metadata-date--scheduled')).toBeVisible();
      await capture(page, `${theme}-${width}-${surface}`);
      const overflow = card.locator('.task-card__metadata-overflow:visible');
      if (await overflow.count()) {
        if (theme === 'dark') {
          await overflow.focus();
          await page.keyboard.press('Enter');
        } else await overflow.click();
        await expect(page.locator('.tn-popover[role="dialog"]')).toBeVisible();
        await expect(page.locator('.modal-container:visible')).toHaveCount(0);
        await page.keyboard.press('Escape');
        await expect(page.locator('.tn-popover')).toHaveCount(0);
      }
    }
  });
}

test('narrow calendar shares agenda navigation and retains week selection and secondary actions', async () => {
  const page = instance.page;
  await setObsidianViewport(page, { width: 400, height: 800 });
  await page.evaluate(() => document.body.classList.add('is-mobile'));
  await openSurface('agenda');
  const calendar = page.locator('.workspace-leaf.mod-active .tnc');
  const selector = calendar.locator('.tnc-toolbar-view-select');
  await expect(selector).toBeVisible();
  await expect(calendar.locator('.tnc-toolbar-nav')).toBeHidden();
  await expect(calendar.locator('.tnc-strip-head')).toBeVisible();
  await expect(calendar.locator('.tnc-strip-today')).toBeHidden();
  await expect(calendar.locator('.tnc-strip-prev:visible')).toHaveCount(1);
  await expect(calendar.locator('.tnc-strip-next:visible')).toHaveCount(1);
  await calendar.locator('.tnc-strip-next').click();
  await calendar.locator('.tnc-strip-grid button').first().click();
  await expect(calendar.locator('.tnc-strip-today:visible')).toHaveCount(1);
  await calendar.locator('.tnc-strip-today').click();
  await expect(calendar.locator('.tnc-strip-today')).toBeHidden();
  const navigation = await calendar.locator('.tnc-strip-head').boundingBox();
  const selection = await selector.boundingBox();
  expect(navigation!.y).toBeGreaterThan(selection!.y);
  expect(navigation!.x + navigation!.width).toBeLessThanOrEqual(400);
  expect(selection!.height).toBeGreaterThanOrEqual(40);
  expect(await selector.evaluate(element => getComputedStyle(element).appearance)).toBe('auto');
  expect(await selector.evaluate(element => getComputedStyle(element).borderTopColor)).not.toBe('rgba(0, 0, 0, 0)');
  await calendar.locator('.tnc-btn-overflow').click();
  await expect(page.locator('.tn-picker__row').filter({ hasText: 'Select tasks' })).toBeVisible();
  await expect(page.locator('.tn-picker__row').filter({ hasText: 'Refresh calendar subscriptions' })).toBeVisible();
  await page.keyboard.press('Escape');
  await selector.selectOption('week');
  await expect(calendar.locator('.tnc-tg')).toBeVisible();
  await expect(calendar.locator('.tnc-toolbar-nav')).toBeVisible();
  const weekNavigation = await calendar.locator('.tnc-toolbar-nav').boundingBox();
  const weekSelection = await selector.boundingBox();
  expect(Math.abs(weekNavigation!.y - weekSelection!.y)).toBeLessThan(4);
  await calendar.locator('.tnc-btn-today').click();
  await calendar.locator('.tnc-more--collision').first().click();
  const timedTask = calendar.locator('.tnc-popover .tnc-item').filter({ hasText: title }).first();
  await expect(timedTask).toBeInViewport();
  await expect(timedTask.locator('.tnc-item-time')).toBeVisible();
  await page.screenshot({ path: 'test-results/narrow-reading-r3/400-week.png' });
  await page.keyboard.press('Escape');
});

test('collisions expand without widening the week, timed lines fit and deadlines use one line', async () => {
  const page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(() => document.body.classList.remove('is-mobile'));
  await openSurface('calendar');
  const grid = page.locator('.workspace-leaf.mod-active .tnc-tg');
  await expect(grid).toBeVisible();
  await expect.poll(() => grid.evaluate(element => Number(getComputedStyle(element).getPropertyValue('--tnc-collision-columns')))).toBeGreaterThanOrEqual(3);
  expect(await grid.locator('.tnc-tg-scroll').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(2);
  await grid.locator('.tnc-more--collision').first().click();
  const appointments = page.locator('.tnc-popover .tnc-item');
  await expect(appointments).toHaveCount(4);
  for (const appointmentTitle of [title, ...Array.from({ length: 3 }, (_, index) => `Review overlapping supplier appointment ${index + 1}`)]) {
    await expect(appointments.filter({ hasText: appointmentTitle })).toHaveCount(1);
  }
  await expect(appointments.filter({ hasText: 'Confirm the supplier onboarding deadline' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.locator('.tnc-btn-view-day').click();
  await expect(page.locator('.tnc-btn-view-day')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => grid.locator('.tnc-tg-head [data-date]').count()).toBe(1);
  const events = grid.locator('.tnc-item--timed');
  await expect(events).toHaveCount(4);
  await expect.poll(() => events.evaluateAll(elements => elements.length === 4 && elements.every(element => {
    const title = element.querySelector<HTMLElement>('.tnc-item-title');
    const time = element.querySelector<HTMLElement>('.tnc-item-time');
    const styledTitle = element.querySelector<HTMLElement>('.tn-calendar-event-title');
    if (!title || !time || !styledTitle) return false;
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const height = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const timeBox = time.getBoundingClientRect();
    const titleBox = title.getBoundingClientRect();
    const visibleTime = getComputedStyle(time).display !== 'none' && timeBox.height > 0;
    return bounds.width > 160 && bounds.height > 0 && titleBox.height > 0 &&
      getComputedStyle(styledTitle).webkitLineClamp === (height >= 68 ? '3' : height >= 48 ? '2' : '1') &&
      visibleTime === (height > 35) &&
      (!visibleTime || (timeBox.y >= titleBox.bottom - 1 && timeBox.bottom <= bounds.bottom + 1));
  }))).toBe(true);
  const deadline = grid.locator('.tnc-item--bar[data-event-type="due"]').first();
  await expect(deadline).toBeVisible();
  expect((await deadline.boundingBox())!.height).toBeGreaterThanOrEqual(40);
  expect(await deadline.locator('.tn-calendar-event-title').evaluate(element => getComputedStyle(element).whiteSpace)).toBe('nowrap');
  await events.filter({ hasText: title }).first().scrollIntoViewIfNeeded();
  await capture(page, '1180-collisions', events.filter({ hasText: title }).first());
});

test('mobile board leaves room for neighbouring columns and a persistent scroll track', async () => {
  const page = instance.page;
  await setObsidianViewport(page, { width: 400, height: 800 });
  await page.evaluate(() => document.body.classList.add('is-mobile'));
  await openSurface('board');
  const board = page.locator('.workspace-leaf.mod-active .kanban-view__board');
  await expect(board).toBeVisible();
  await expect(board.locator('.task-card').first()).toBeVisible();
  await expect.poll(() => board.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  const column = board.locator('.kanban-view__column').first();
  expect((await column.boundingBox())!.width).toBeLessThanOrEqual((await board.boundingBox())!.width - 16);
  expect(await board.evaluate(element => getComputedStyle(element).scrollbarWidth)).toBe('thin');
  await capture(page, '400-board');
});
