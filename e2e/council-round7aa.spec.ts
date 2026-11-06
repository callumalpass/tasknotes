import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, openTaskNotesSettings, closeObsidianSettings, expectTouchTarget } from './obsidian';

const evidence = '/tmp/tasknotes-r7/aa/regression';
const folder = `CouncilAA-${Date.now()}`;

test('council AA: compact task composition, disclosures, search, month counts and gesture tooltips', async () => {
  test.setTimeout(300000);
  mkdirSync(evidence, { recursive: true });
  const instance = await launchObsidian();
  const page = instance.page;
  page.setDefaultTimeout(10000);
  const measurements: Record<string, unknown> = {};
  const capture = async (name: string, target: Page = page) => {
    await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const size = target.viewportSize()!;
    await target.screenshot({ path: `${evidence}/${name}.png`, clip: { x: 0, y: 0, ...size } });
  };
  const resize = async (width: number, theme: string) => {
    await page.evaluate(({ width, theme }) => {
      const nativeWindow = (window as any).require('electron').remote.getCurrentWindow();
      nativeWindow.setMinimumSize(320, 500);
      if (nativeWindow.isMaximized()) nativeWindow.unmaximize();
      document.body.classList.toggle('is-mobile', width === 400);
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(`theme-${theme}`);
    }, { width, theme });
    await setObsidianViewport(page, { width, height: 820 });
    await expect.poll(() => page.evaluate(() => (window as any).require('electron').remote.getCurrentWindow().getContentSize())).toEqual([width, 820]);
  };
  const open = async (name: string) => {
    await page.evaluate(async ({ folder, name }) => {
      const app = (window as any).app;
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(`${folder}/${name}`));
    }, { folder, name });
  };
  try {
    const filter = { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] };
    const order = ['status', 'priority', 'scheduled', 'due', 'projects', 'contexts', 'file.tags'];
    const bases = {
      'List.base': { filters: filter, views: [{ type: 'tasknotesTaskList', name: 'Delivery', order, enableSearch: true }] },
      'Board.base': { filters: filter, views: [{ type: 'tasknotesKanban', name: 'Delivery', groupBy: { property: 'status', direction: 'ASC' }, columnWidth: 300, hideEmptyColumns: false, order }] },
      'Agenda.base': { filters: filter, views: [{ type: 'tasknotesCalendar', name: 'Agenda', calendarView: 'listWeek', showDateStrip: true, showOverdueOnToday: false, showTimeEntries: true, order }] },
      'Calendar.base': { filters: filter, views: [{ type: 'tasknotesCalendar', name: 'Calendar', calendarView: 'dayGridMonth', showMonthDayPanel: true, showOverdueOnToday: false, showTimeEntries: true, showTimeblocks: true, slotMinTime: '08:00:00', slotMaxTime: '18:00:00', order }] },
    };
    const dates = await page.evaluate(async ({ folder, bases }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      (window as any).aaSettings = JSON.parse(JSON.stringify(plugin.settings));
      const daily = app.internalPlugins.getEnabledPluginById('daily-notes');
      (window as any).aaDailyFolder = daily.options.folder;
      daily.options.folder = folder;
      plugin.settings.taskIdentificationMethod = 'tag';
      plugin.settings.taskTag = 'task';
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
      await app.vault.createFolder(folder);
      const day = (offset: number) => {
        const date = new Date();
        date.setDate(date.getDate() + offset);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      };
      for (let index = 0; index < 20; index++) {
        const title = index < 5 ? `Review release ${index}` : `Delivery task ${index}`;
        await app.vault.create(`${folder}/Task ${index}.md`, `---\ntags: [task]\ntitle: ${title}\nstatus: open\npriority: normal\nscheduled: ${day(index % 2)}${index === 0 ? 'T10:00' : ''}\ntimeEstimate: 60\ndue: ${day(1)}\n${index === 1 ? `blockedBy: ['[[${folder}/Task 2]]']\n` : ''}${index === 2 ? `timeEntries:\n  - startTime: '${day(0)}T12:00:00'\n    endTime: '${day(0)}T12:35:00'\n` : ''}---\nSupporting task details.\n`);
      }
      await app.vault.create(`${folder}/Inline.md`, `# Delivery notes\n\nBefore [[${folder}/Task 0|review]], then [[${folder}/Task 1|approve]] and ship.\n\n[[${folder}/Task 2]]\n`);
      await app.vault.create(`${folder}/${day(0)}.md`, `---\ntimeblocks:\n  - id: council-aa\n    title: Release focus block\n    startTime: '13:00'\n    endTime: '14:00'\n---\n`);
      for (const [name, content] of Object.entries(bases)) await app.vault.create(`${folder}/${name}`, content);
      return { today: day(0), tomorrow: day(1) };
    }, { folder, bases: Object.fromEntries(Object.entries(bases).map(([name, value]) => [name, stringify(value)])) });
    await expect.poll(() => page.evaluate(async folder => Boolean(await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/Task 19.md`)), folder)).toBe(true);

    for (const theme of ['light', 'dark']) for (const width of [1180, 400]) {
      await resize(width, theme);
      for (const surface of ['List', 'Board', 'Agenda', 'Calendar']) {
        await open(`${surface}.base`);
        await expect(page.locator('.workspace-leaf.mod-active .task-card').first()).toBeVisible();
        const geometry = await page.locator('.workspace-leaf.mod-active .task-card').evaluateAll(cards => cards.slice(0, 8).map(card => ({
          title: card.querySelector('.task-card__title-text')?.textContent,
          height: card.getBoundingClientRect().height,
          width: card.getBoundingClientRect().width,
          titleWidth: card.querySelector('.task-card__title-text')!.getBoundingClientRect().width,
          dates: Array.from(card.querySelectorAll<HTMLElement>('.task-card__metadata-date > span:last-child')).map(value => ({ text: value.textContent, width: value.clientWidth, scrollWidth: value.scrollWidth })),
        })));
        measurements[`${surface}-${theme}-${width}`] = geometry;
        if (width === 400) {
          const short = geometry.find(row => row.title === 'Review release 0') ?? geometry.find(row => row.title === 'Delivery task 10');
          expect(short).toBeTruthy();
          expect(short!.height).toBeLessThan(100);
          expect(geometry.some(row => row.dates.length > 0)).toBe(true);
          for (const row of geometry) for (const date of row.dates) expect(date.scrollWidth).toBeLessThanOrEqual(date.width + 1);
          const card = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${folder}/Task 0.md"]`).first();
          await card.scrollIntoViewIfNeeded();
          const targets = await card.locator('[role=button]:visible').evaluateAll(elements => elements.map(element => ({ label: element.getAttribute('aria-label'), bounds: element.getBoundingClientRect().toJSON() })));
          for (const target of targets) { expect(target.bounds.width).toBeGreaterThanOrEqual(40); expect(target.bounds.height).toBeGreaterThanOrEqual(40); }
          for (let first = 0; first < targets.length; first++) for (let second = first + 1; second < targets.length; second++) {
            const left = targets[first].bounds;
            const right = targets[second].bounds;
            expect(Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1).toBe(false);
          }
        }
        await capture(`after-${surface.toLowerCase()}-${theme}-${width}`);
        if (surface === 'Calendar') {
          const more = page.locator('.tnc-dg .tnc-more').filter({ hasText: /^\+/ }).first();
          if (width === 400) {
            await expect(more).toHaveText(/^\+\d+$/);
            await expect(more).toHaveAccessibleName(/more/);
            expect(await more.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
          }
          await more.click();
          await expect(page.locator('.tnc-popover')).toBeVisible();
          await page.keyboard.press('Escape');
          const titleXs = await page.locator('.tn-calendar-day-panel .tn-calendar-list-entry').evaluateAll(entries => entries.map(entry => entry.querySelector('.task-card__title-text')!.getBoundingClientRect().x));
          expect(new Set(titleXs.map(value => Math.round(value))).size).toBeLessThanOrEqual(1);
        }
      }

      await open('Inline.md');
      await page.evaluate(async ({ folder }) => (window as any).app.workspace.getMostRecentLeaf().setViewState({ type: 'markdown', state: { file: `${folder}/Inline.md`, mode: 'preview' } }), { folder });
      const sentence = page.locator('.markdown-preview-view .tasknotes-inline-widget--sentence').first();
      await expect(sentence).toBeVisible();
      expect(await sentence.locator('.task-card').evaluate(element => getComputedStyle(element).display)).toBe('inline');
      const menu = sentence.locator('.task-card__context-menu');
      const menuBox = (await menu.boundingBox())!;
      const paragraphBottom = await sentence.evaluate(element => element.closest('p')!.getBoundingClientRect().bottom);
      expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(paragraphBottom + 1);
      expect(await menu.evaluate(element => getComputedStyle(element).position)).toBe(width === 400 ? 'relative' : 'static');
      if (width === 400) await expectTouchTarget(menu);
      await menu.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.menu')).toBeVisible();
      await page.keyboard.press('Escape');
      await capture(`after-inline-${theme}-${width}`);

      const settingsPage = await openTaskNotesSettings(page);
      settingsPage.setDefaultTimeout(10000);
      await settingsPage.evaluate(({theme, width}) => {
        const nativeWindow = (window as any).require('electron').remote.getCurrentWindow();
        nativeWindow.setMinimumSize(320, 500);
        if (nativeWindow.isMaximized()) nativeWindow.unmaximize();
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
        document.body.classList.toggle('is-mobile', width === 400);
      }, {theme, width});
      await setObsidianViewport(settingsPage, {width: 1180, height: 820});
      await settingsPage.getByRole('tab', { name: 'Task properties', exact: true }).click();
      await setObsidianViewport(settingsPage, {width, height: 820});
      await expect.poll(() => settingsPage.evaluate(() => (window as any).require('electron').remote.getCurrentWindow().getContentSize())).toEqual([width, 820]);
      await expect(settingsPage.getByRole('tab', { name: 'Task properties', exact: true, includeHidden: true })).toHaveAttribute('aria-selected', 'true');
      const disclosures = settingsPage.locator('.tasknotes-settings__card--collapsible');
      const hiddenSections = await disclosures.evaluateAll(cards => cards.filter(card => card.classList.contains('tasknotes-settings__card--collapsed')).flatMap(card => Array.from(card.querySelectorAll<HTMLElement>(':scope > .tasknotes-settings__card-content, :scope > .tasknotes-settings__card-actions')).map(section => ({ inert: section.inert, hidden: section.hidden }))));
      expect(hiddenSections.length).toBeGreaterThan(0);
      expect(hiddenSections.every(section => section.inert && section.hidden)).toBe(true);
      const disclosure = disclosures.first().locator('.tasknotes-settings__card-disclosure');
      expect(await disclosure.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
      await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
      await disclosure.focus();
      await settingsPage.keyboard.press('Enter');
      await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
      await settingsPage.keyboard.press('Space');
      await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
      await settingsPage.keyboard.press('Tab');
      expect(await settingsPage.evaluate(() => Boolean(document.activeElement?.closest('.tasknotes-settings__card--collapsed .tasknotes-settings__card-content')))).toBe(false);
      await disclosure.focus();
      await capture(`after-settings-${theme}-${width}`, settingsPage);
      await closeObsidianSettings(page, settingsPage);
    }

    await resize(1180, 'light');
    await open('List.base');
    const search = page.getByPlaceholder('Search tasks...');
    for (const [query, count] of [['zzznomatch', 0], ['Review release', 5], ['', 20]] as const) {
      await search.fill(query);
      await expect(page.locator('.bases-toolbar-result-count .text-button-label')).toHaveText(`${count} of 20 tasks`);
      await expect(page.locator('.workspace-leaf.mod-active .task-card')).toHaveCount(count);
      await capture(`after-search-${count}`);
    }

    await open('Calendar.base');
    await expect.poll(() => page.evaluate(() => Boolean((window as any).app.workspace.getMostRecentLeaf().view.controller.view.calendar))).toBe(true);
    await page.evaluate(() => {
      const view = (window as any).app.workspace.getMostRecentLeaf().view.controller.view;
      view.viewOptions.showTimeblocks = true;
      view.calendar.changeView('day');
      view.calendar.gotoDate(new Date());
      void view.refetchEvents();
    });
    for (const action of ['move', 'resize', 'timeblock'] as const) {
      const event = action === 'timeblock' ? page.locator('[data-id="timeblock-council-aa"]') : page.locator(`.tnc-item[data-event-type="scheduled"][data-task-path="${folder}/Task 0.md"]`).first();
      await event.scrollIntoViewIfNeeded();
      const box = (await event.boundingBox())!;
      await page.mouse.move(box.x + Math.min(90, box.width / 2), box.y + 14);
      if (action !== 'timeblock') await expect(page.locator('.tooltip')).toBeVisible();
      const grip = action === 'resize' ? await event.locator('.tnc-resize').last().boundingBox() : null;
      const start = grip ? { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 } : { x: box.x + Math.min(90, box.width / 2), y: box.y + 14 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + 10, start.y + 45, { steps: 8 });
      await expect(page.locator('.tnc-dragging')).toBeVisible();
      await expect(page.locator('.tooltip:visible')).toHaveCount(0);
      await capture(`after-calendar-held-${action}`);
      await expect(page.locator('.tnc-dragging .is-dragging .tnc-item-time').first()).toBeVisible();
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect(page.locator('.tnc-dragging')).toHaveCount(0);
      await expect(page.locator('body')).not.toHaveClass(/tn-calendar-gesture/);
      await capture(`after-calendar-cancel-${action}`);
    }
    measurements.dates = dates;
  } finally {
    writeFileSync(`${evidence}/measurements.json`, JSON.stringify(measurements, null, 2));
    await page.evaluate(async folder => {
      const app = (window as any).app;
      if ((window as any).aaSettings) app.plugins.plugins.tasknotes.settings = (window as any).aaSettings;
      app.internalPlugins.getEnabledPluginById('daily-notes').options.folder = (window as any).aaDailyFolder;
      await app.workspace.getMostRecentLeaf().setViewState({ type: 'empty' });
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
      document.body.classList.remove('is-mobile');
    }, folder).catch(() => {});
    await closeObsidian(instance);
  }
});
