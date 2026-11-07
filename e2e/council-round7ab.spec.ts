import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, openTaskNotesSettings, selectTaskNotesSettingsTab, closeObsidianSettings } from './obsidian';

const phase = process.env.TASKNOTES_R7_PHASE ?? 'after';
const evidence = `/tmp/tasknotes-r7/ab/${phase}`;
const folder = `CouncilAB-${Date.now()}`;

test('council AB: responsive composition, stable navigation and reconciled drag Undo', async () => {
  test.setTimeout(300000);
  mkdirSync(evidence, { recursive: true });
  const instance = await launchObsidian();
  const page = instance.page;
  page.setDefaultTimeout(10000);
  const observations: Record<string, unknown> = {};
  const capture = async (name: string, target: Page = page) => {
    await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await target.screenshot({ path: `${evidence}/${name}.png`, clip: { x: 0, y: 0, ...target.viewportSize()! } });
  };
  const appearance = async (width: number, theme: string, target: Page = page) => {
    await target.evaluate(({ width, theme }) => {
      const nativeWindow = (window as any).require('electron').remote.getCurrentWindow();
      nativeWindow.setMinimumSize(320, 500);
      if (nativeWindow.isMaximized()) nativeWindow.unmaximize();
      document.body.classList.toggle('is-mobile', width === 400);
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(`theme-${theme}`);
    }, { width, theme });
    await setObsidianViewport(target, { width, height: 820 });
    await expect.poll(() => target.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([width, 820]);
    observations[`viewport-${target === page ? 'workspace' : 'settings'}-${theme}-${width}`] = await target.evaluate(() => ({
      viewport: [window.innerWidth, window.innerHeight],
      nativeContent: (window as any).require('electron').remote.getCurrentWindow().getContentSize(),
    }));
  };
  const open = async (name: string) => {
    await page.evaluate(async ({ folder, name }) => {
      const app = (window as any).app;
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(`${folder}/${name}`));
    }, { folder, name });
  };
  const openView = async (type: string) => {
    await page.evaluate(async type => {
      const app = (window as any).app;
      await app.workspace.getLeaf(false).setViewState({ type, active: true });
    }, type);
  };
  try {
    const filters = { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] };
    const order = ['status', 'priority', 'scheduled', 'due', 'contexts', 'file.tags'];
    const bases = {
      'List.base': { filters, views: [{ type: 'tasknotesTaskList', name: 'Delivery', groupBy: { property: 'status', direction: 'ASC' }, order }] },
      'Board.base': { filters, views: [{ type: 'tasknotesKanban', name: 'Delivery', groupBy: { property: 'status', direction: 'ASC' }, columnWidth: 300, hideEmptyColumns: false, order }] },
      'Agenda.base': { filters, views: [{ type: 'tasknotesCalendar', name: 'Agenda', calendarView: 'listWeek', showDateStrip: true, showOverdueOnToday: false, order }] },
      'Month.base': { filters, views: [{ type: 'tasknotesCalendar', name: 'Month', calendarView: 'dayGridMonth', showMonthDayPanel: true, showOverdueOnToday: false, order }] },
    };
    await page.evaluate(async ({ folder, bases }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      (window as any).abSettings = JSON.parse(JSON.stringify(plugin.settings));
      (window as any).abHistory = await plugin.pomodoroService.getSessionHistory();
      plugin.settings.taskIdentificationMethod = 'tag';
      plugin.settings.taskTag = 'task';
      plugin.settings.pomodoroStorageLocation = 'plugin';
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
      await app.vault.createFolder(folder);
      const today = (window as any).moment().format('YYYY-MM-DD');
      for (let index = 0; index < 7; index++) {
        const title = index === 0 ? 'Prepare the release decision and share the final review with the team' : `Review delivery ${index}`;
        await app.vault.create(`${folder}/${index}.md`, `---\ntags: [task, release]\ntitle: ${title}\nstatus: ${index === 6 ? 'in-progress' : 'open'}\npriority: normal\nscheduled: ${today}${index === 1 ? 'T10:00' : ''}\ndue: ${today}\ncontexts: [work, studio]\n---\nSupporting details.\n`);
      }
      await app.vault.create(`${folder}/Prose.md`, `# Delivery notes\n\nReview [[${folder}/0|the release decision]], then share the decision.\n\nA plain [[${folder}/Plain note|the release decision]], then share the decision.\n`);
      await app.vault.create(`${folder}/Plain note.md`, 'A plain note.');
      for (const [name, contents] of Object.entries(bases)) await app.vault.create(`${folder}/${name}`, contents as string);
      await plugin.pomodoroService.saveSessionHistory([0, 1].map(index => ({
        id: `council-ab-${index}`, type: 'work', startTime: new Date(Date.now() - (index + 1) * 3600000).toISOString(),
        endTime: new Date(Date.now() - (index + 1) * 3600000 + 1500000).toISOString(), plannedDuration: 25,
        taskPath: index === 0 ? `${folder}/0.md` : undefined, completed: true, activePeriods: [],
      })));
      await plugin.pomodoroService.saveLastSelectedTask(`${folder}/0.md`);
    }, { folder, bases: Object.fromEntries(Object.entries(bases).map(([name, contents]) => [name, stringify(contents)])) });
    await expect.poll(() => page.evaluate(async folder => !!await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/0.md`), folder)).toBe(true);
    const warning = page.locator('.notice').filter({ hasText: 'Secrets are stored without encryption' });
    if (await warning.isVisible()) await warning.getByText("Don't show again", { exact: true }).click();
    for (const theme of ['light', 'dark']) for (const width of [1180, 400]) {
      await appearance(width, theme);
      const variant = `${theme}-${width}`;
      await open('Month.base');
      await expect(page.locator('.tn-calendar-day-panel .task-card').first()).toBeVisible();
      observations[`month-${variant}`] = await page.locator('.tn-calendar-day-panel').evaluate(panel => {
        const entry = panel.querySelector('.tn-calendar-list-entry')!;
        const title = entry.querySelector('.task-card__title')!;
        const stamp = entry.querySelector('.tn-calendar-list-stamp')!;
        return { panel: panel.getBoundingClientRect().toJSON(), entry: entry.getBoundingClientRect().toJSON(), title: title.getBoundingClientRect().toJSON(), stamp: stamp.getBoundingClientRect().toJSON() };
      });
      if (phase !== 'before') {
        const panel = page.locator('.tn-calendar-day-panel');
        const first = panel.locator('.task-card').first();
        expect(await panel.locator('.tn-calendar-list-stamp').first().evaluate(stamp => stamp.getBoundingClientRect().width)).toBe(0);
        expect(await first.locator('.task-card__title-text').evaluate(title => title.getBoundingClientRect().width)).toBeGreaterThan(200);
        await expect(first.locator('.task-card__context-menu')).toBeAttached();
        if (width === 400) {
          const bounds = await first.evaluate(card => ({ title: card.querySelector('.task-card__title-text')!.getBoundingClientRect().toJSON(), status: card.querySelector('.task-card__status-dot')!.getBoundingClientRect().toJSON() }));
          expect(bounds.status.right).toBeLessThanOrEqual(bounds.title.left + 1);
          const priority = await first.locator('.task-card__priority-dot').boundingBox();
          expect(bounds.status.right <= priority!.x + 1 || priority!.y >= bounds.status.bottom - 1).toBe(true);
        }
      }
      await capture(`month-${variant}`);
      await open('Agenda.base');
      await expect(page.locator('.tnc-strip')).toBeVisible();
      observations[`agenda-${variant}`] = await page.locator('.tnc').first().evaluate(calendar => ({ toolbar: calendar.querySelector('.tnc-toolbar')?.getBoundingClientRect().toJSON(), strip: calendar.querySelector('.tnc-strip')?.getBoundingClientRect().toJSON() }));
      await capture(`agenda-${variant}`);
      if (width === 400 && phase !== 'before') {
        const calendar = page.locator('.tn-calendar-agenda-strip .tnc').first();
        await expect(calendar.locator('.tnc-toolbar-nav')).toBeHidden();
        await expect(calendar.locator('.tnc-title')).toBeHidden();
        await expect(calendar.locator('.tnc-toolbar-view-select')).toBeVisible();
        const chrome = await calendar.evaluate(element => ['.tnc-toolbar', '.tnc-strip'].reduce((height, selector) => height + element.querySelector(selector)!.getBoundingClientRect().height, 0));
        expect(chrome).toBeLessThan(190);
        const strip = calendar.locator('.tnc-strip-title');
        if (await strip.getAttribute('aria-expanded') !== 'true') await strip.click();
        await expect(strip).toHaveAttribute('aria-expanded', 'true');
        await calendar.locator('.tnc-strip-nav').last().click();
        await calendar.locator('.tnc-strip-day').first().click();
        await expect(calendar.locator('.tnc-strip-today')).toBeVisible();
        await calendar.locator('.tnc-strip-today').click();
        await expect(calendar.locator('.tnc-strip-today')).toBeHidden();
        await calendar.locator('.tnc-btn-overflow').click();
        await expect(page.locator('.tn-picker:visible')).toBeVisible();
        await page.keyboard.press('Escape');
      }
      await open('List.base');
      await expect(page.locator('.tn-tasknotesTaskList .task-card:visible').first()).toBeVisible();
      await capture(`list-${variant}`);
      if (width === 400 && phase !== 'before') {
        const card = page.locator('.tn-tasknotesTaskList .task-card:visible').first();
        const metadata = card.locator('.task-card__metadata-values');
        const chips = await metadata.locator('.context-tag').evaluateAll(elements => elements.map(element => ({ text: element.textContent!, visible: element.getBoundingClientRect().width > 0, ...element.getBoundingClientRect().toJSON() })));
        expect(chips).toHaveLength(2);
        const visible = chips.filter(chip => chip.visible);
        if (visible.length === 2) {
          expect(Math.abs(visible[0].top - visible[1].top)).toBeLessThan(2);
          expect(visible[1].left).toBeGreaterThan(visible[0].left);
        }
        for (const chip of chips.filter(chip => !chip.visible)) {
          const overflow = card.locator('.task-card__metadata-overflow');
          await expect(overflow).toBeVisible();
          expect(await overflow.getAttribute('aria-label')).toContain(chip.text.replace(/^@/, ''));
        }
      }
      await open('Board.base');
      await expect(page.locator('.kanban-view__column-nav select')).toBeAttached();
      await page.waitForTimeout(250);
      observations[`board-${variant}`] = await page.locator('.kanban-view__column-nav select').evaluate(select => ({ value: (select as HTMLSelectElement).value, text: (select as HTMLSelectElement).selectedOptions[0]?.textContent }));
      await capture(`board-${variant}`);
      if (width === 400) {
        const select = page.locator('.kanban-view__column-nav select');
        if (phase !== 'before') {
          await select.selectOption('open');
          await expect(select).toHaveValue('open');
          const bounds = await page.locator('.kanban-view__column[data-group="open"]:visible').evaluate(column => ({ column: column.getBoundingClientRect().toJSON(), board: column.closest('.kanban-view__board')?.getBoundingClientRect().toJSON() }));
          expect(bounds.column.right).toBeLessThanOrEqual(width);
          await select.selectOption('none');
          await expect(select).toHaveValue('none');
          await page.waitForTimeout(350);
          const board = page.locator('.kanban-view__column[data-group="none"]:visible').locator('..');
          await board.hover();
          await page.mouse.wheel(310, 0);
          await expect(select).not.toHaveValue('none');
        }
        const option = await select.locator('option').allTextContents();
        const targetIndex = option.findIndex(label => label.startsWith('In progress'));
        const targetValue = await select.locator('option').nth(targetIndex).getAttribute('value');
        await select.selectOption(targetValue!);
        await page.waitForTimeout(350);
        await page.evaluate(async folder => {
          const plugin = (window as any).app.plugins.plugins.tasknotes;
          const task = await plugin.cacheManager.getTaskInfo(`${folder}/6.md`);
          await plugin.updateTaskProperty(task, 'priority', task.priority === 'high' ? 'normal' : 'high');
        }, folder);
        await page.waitForTimeout(600);
        observations[`board-refreshed-${variant}`] = await select.inputValue();
        await capture(`board-refreshed-${variant}`);
        if (phase !== 'before') await expect(select).toHaveValue(targetValue!);
      }
      await open('Prose.md');
      await page.evaluate(async () => { const view = (window as any).app.workspace.activeLeaf.view; await view.setState({ ...view.getState(), mode: 'preview' }, { history: false }); });
      await expect(page.locator('.tasknotes-inline-widget--sentence:visible').first()).toBeVisible();
      await capture(`sentence-${variant}`);
      if (phase !== 'before') {
        const sentence = page.locator('.tasknotes-inline-widget--sentence:visible').first();
        const menu = sentence.locator('.task-card__context-menu');
        expect(await menu.evaluate(element => !!(element.closest('.task-card')!.querySelector('.task-card__content')!.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
        await page.mouse.move(1, 1);
        await menu.focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('.menu:visible')).toBeVisible();
        await capture(`sentence-menu-${variant}`);
        await page.keyboard.press('Escape');
        await expect(page.locator('.menu:visible')).toHaveCount(0);
        await menu.click();
        await expect(page.locator('.menu:visible')).toBeVisible();
        await page.keyboard.press('Escape');
        if (width === 400) {
          await expect(page.locator('.menu:visible')).toHaveCount(0);
          const bounds = (await menu.boundingBox())!;
          const touch = await page.context().newCDPSession(page);
          await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
          await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await expect(page.locator('.menu:visible')).toBeVisible();
          await capture(`sentence-touch-${variant}`);
          await page.keyboard.press('Escape');
          await touch.detach();
        }
      }
      await openView('tasknotes-pomodoro-view');
      await expect(page.locator('.pomodoro-view__task-card-container .task-card:visible')).toBeVisible();
      await capture(`pomodoro-${variant}`);
      if (width === 400 && phase !== 'before') {
        const composition = await page.locator('.pomodoro-view__task-card-container .task-card:visible').evaluate(card => {
          const title = card.querySelector('.task-card__title-text')!;
          return { title: title.getBoundingClientRect().toJSON(), row: card.querySelector('.task-card__main-row')!.getBoundingClientRect().toJSON(), status: card.querySelector('.task-card__status-dot')!.getBoundingClientRect().toJSON(), priority: card.querySelector('.task-card__priority-dot')!.getBoundingClientRect().toJSON(), whiteSpace: getComputedStyle(title).whiteSpace, lineHeight: parseFloat(getComputedStyle(title).lineHeight), metadata: card.querySelector('.task-card__metadata')!.getBoundingClientRect().toJSON() };
        });
        expect(composition.whiteSpace).toBe('normal');
        expect(composition.title.width).toBeCloseTo(composition.row.width - composition.status.width - composition.priority.width, 0);
        expect(composition.title.height).toBeLessThanOrEqual(composition.lineHeight * 3 + 1);
        expect(await page.locator('.pomodoro-view__task-card-container .task-card__title-text:visible').evaluate(element => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
        expect(composition.metadata.top).toBeGreaterThanOrEqual(composition.title.bottom);
      }
      await openView('tasknotes-pomodoro-stats-view');
      await expect(page.locator('.pomodoro-stats-view__session-item:visible')).toHaveCount(2);
      await page.locator('.pomodoro-stats-view__session-item:visible').last().scrollIntoViewIfNeeded();
      observations[`history-${variant}`] = await page.locator('.pomodoro-stats-view__session-delete-button:visible').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().x));
      if (phase !== 'before') {
        const positions = observations[`history-${variant}`] as number[];
        expect(Math.abs(positions[0] - positions[1])).toBeLessThan(1);
      }
      await capture(`history-${variant}`);
      const settings = await openTaskNotesSettings(page);
      await appearance(1180, theme, settings);
      await selectTaskNotesSettingsTab(settings, 'Task properties');
      await appearance(width, theme, settings);
      const disclosure = settings.locator('.tasknotes-settings__card-disclosure').first();
      await disclosure.scrollIntoViewIfNeeded();
      if (await disclosure.getAttribute('aria-expanded') === 'true') await disclosure.click();
      if (phase !== 'before') await expect(disclosure.locator('.lucide-chevron-right')).toBeVisible();
      await capture(`settings-${variant}`, settings);
      await disclosure.focus();
      await settings.keyboard.press('Enter');
      if (phase !== 'before') await expect(disclosure.locator('.lucide-chevron-down')).toBeVisible();
      await capture(`settings-expanded-${variant}`, settings);
      await settings.keyboard.press('Space');
      await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
      await closeObsidianSettings(page, settings);
    }
    await appearance(1180, 'light');
    for (const surface of ['List', 'Board']) {
      await open(`${surface}.base`);
      const card = page.locator(`.task-card[data-task-path="${folder}/1.md"]:visible`);
      await expect(card).toBeVisible();
      const target = surface === 'List' ? page.locator('.task-group').filter({ has: page.locator('[data-group-key="in-progress"]') }).first() : page.locator('.kanban-view__column[data-group="in-progress"]');
      const header = surface === 'List' ? page.locator('.task-group-header').filter({ hasText: 'In progress' }).first() : target.locator('.kanban-view__column-header');
      await card.dragTo(header);
      await expect(page.locator('.tn-toast')).toContainText('Moved');
      await expect(card).toHaveAttribute('data-status', 'in-progress');
      const start = Date.now();
      await page.evaluate(({ folder, surface }) => {
        let pendingSeen = false;
        const snapshot = () => {
          const toast = document.querySelector('.tn-toast');
          if (toast?.querySelector('button[aria-busy="true"]:disabled')) pendingSeen = true;
          if (toast?.textContent !== 'Change undone.') return;
          const card = Array.from(document.querySelectorAll<HTMLElement>('.task-card')).find(card => card.dataset.taskPath === `${folder}/1.md` && card.offsetWidth > 0)!;
          const section = surface === 'List' ? card.closest('.task-list-group') : card.closest('[data-group]');
          const group = surface === 'List' ? section?.querySelector<HTMLElement>('[data-group-key]')?.dataset.groupKey : (section as HTMLElement)?.dataset.group;
          const count = section?.querySelector(surface === 'List' ? '.agenda-view__item-count' : '.kanban-view__column-count')?.textContent?.trim();
          (window as any).abUndoConfirmation = { status: card.dataset.status, group, count, pendingSeen, text: toast.textContent };
        };
        (window as any).abUndoConfirmation = null;
        (window as any).abUndoObserver = new MutationObserver(snapshot);
        (window as any).abUndoObserver.observe(document.body, { childList: true, attributes: true, subtree: true });
      }, { folder, surface });
      await page.locator('.tn-toast').getByRole('button', { name: 'Undo', exact: true }).click();
      await expect(card).toHaveAttribute('data-status', 'open');
      await expect(page.locator('.tn-toast')).toHaveText('Change undone.');
      const confirmation = await page.evaluate(() => { (window as any).abUndoObserver.disconnect(); return (window as any).abUndoConfirmation; });
      observations[`undo-confirmation-${surface}`] = confirmation;
      if (phase !== 'before') {
        expect(confirmation).toMatchObject({ status: 'open', group: 'open', pendingSeen: true });
        expect(confirmation.count).toMatch(/^\(?6\)?$/);
      }
      observations[`undo-${surface}`] = Date.now() - start;
      await capture(`undo-${surface}`);
    }
  } finally {
    writeFileSync(`${evidence}/observations.json`, JSON.stringify(observations, null, 2));
    if (!page.isClosed()) await page.evaluate(async folder => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      if ((window as any).abHistory) await plugin.pomodoroService.saveSessionHistory((window as any).abHistory);
      if ((window as any).abSettings) plugin.settings = (window as any).abSettings;
      const directory = app.vault.getAbstractFileByPath(folder);
      if (directory) await app.vault.delete(directory, true);
    }, folder).catch(() => {});
    await closeObsidian(instance);
  }
});
