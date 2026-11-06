import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport } from './obsidian';

test('council AC: responsive task controls, panel lifecycle, history and held collisions', async () => {
  test.setTimeout(360000);
  const phase = process.env.TASKNOTES_AC_PHASE || 'after';
  const evidence = `/tmp/tasknotes-r7/ac/${phase}`;
  mkdirSync(evidence, { recursive: true });
  const instance = await launchObsidian();
  const page = instance.page;
  page.setDefaultTimeout(10000);
  const folder = `CouncilAC-${Date.now()}`;
  const observations: Record<string, unknown> = {};
  const verify = phase !== 'before';
  const capture = async (name: string) => {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: `${evidence}/${name}.png` });
  };
  const appearance = async (width: number, theme: string) => {
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
  const view = async (type: string) => {
    await page.evaluate(async type => { await (window as any).app.workspace.getLeaf(false).setViewState({ type, active: true }); }, type);
  };
  const geometry = async (selector: string) => page.locator(selector).first().evaluate(card => {
    const bounds = card.getBoundingClientRect();
    const controls = Array.from(card.querySelectorAll<HTMLElement>('.task-card__status-dot, .task-card__priority-dot, .task-card__context-menu, .task-card__drag-handle, .task-card__metadata-date')).filter(element => element.getClientRects().length).map(element => {
      const rect = element.getBoundingClientRect();
      return { className: element.className, rect: rect.toJSON(), hit: document.elementFromPoint(rect.left + 4, rect.bottom - 10)?.closest('[role="button"],button')?.className, opacity: getComputedStyle(element).opacity };
    });
    return { bounds: bounds.toJSON(), clientWidth: card.clientWidth, scrollWidth: card.scrollWidth, title: card.querySelector('.task-card__title-text')!.getBoundingClientRect().toJSON(), controls };
  });
  try {
    const filter = { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] };
    const order = ['status', 'priority', 'scheduled', 'due', 'contexts', 'file.tags'];
    const bases = {
      'List.base': { filters: filter, views: [{ type: 'tasknotesTaskList', name: 'Delivery', order }] },
      'Board.base': { filters: filter, views: [{ type: 'tasknotesKanban', name: 'Delivery', groupBy: { property: 'status', direction: 'ASC' }, order }] },
      'Month.base': { filters: filter, views: [{ type: 'tasknotesCalendar', name: 'Month', calendarView: 'dayGridMonth', showMonthDayPanel: true, showOverdueOnToday: false, order }] },
      'Day.base': { filters: filter, views: [{ type: 'tasknotesCalendar', name: 'Day', calendarView: 'timeGridDay', slotMinTime: '08:00:00', slotMaxTime: '18:00:00', showOverdueOnToday: false, order }] },
    };
    await page.evaluate(async ({ folder, bases }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      (window as any).acSettings = JSON.parse(JSON.stringify(plugin.settings));
      (window as any).acHistory = await plugin.pomodoroService.getSessionHistory();
      (window as any).acLastTask = await plugin.pomodoroService.getLastSelectedTaskPath();
      plugin.settings.taskIdentificationMethod = 'tag';
      plugin.settings.taskTag = 'task';
      plugin.settings.pomodoroStorageLocation = 'plugin';
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
      await app.vault.createFolder(folder);
      const today = (window as any).moment().format('YYYY-MM-DD');
      for (let index = 0; index < 25; index++) {
        await app.vault.create(`${folder}/${index}.md`, `---\ntags: [task, release]\ntitle: ${index < 3 ? `Collision review ${index}` : `Delivery review ${index}`}\nstatus: open\npriority: normal\nscheduled: ${today}${index < 3 ? 'T10:00' : ''}\ntimeEstimate: 60\ndue: ${today}\ncontexts: [work, studio]\n---\nSupporting details.\n`);
      }
      await app.vault.create(`${folder}/Prose.md`, `# Delivery notes\n\nBefore [[${folder}/0|review]], then [[${folder}/1|approve]] and ship.\n\n[[${folder}/2]]\n`);
      for (const [name, contents] of Object.entries(bases)) await app.vault.create(`${folder}/${name}`, contents as string);
      await plugin.pomodoroService.saveSessionHistory(['0.md', 'Missing.md'].map((name, index) => ({ id: `council-ac-${index}`, type: 'work', startTime: new Date(Date.now() - (index + 1) * 3600000).toISOString(), endTime: new Date(Date.now() - (index + 1) * 3600000 + 1500000).toISOString(), plannedDuration: 25, taskPath: `${folder}/${name}`, completed: true, activePeriods: [] })));
      await plugin.pomodoroService.saveLastSelectedTask(`${folder}/0.md`);
    }, { folder, bases: Object.fromEntries(Object.entries(bases).map(([name, contents]) => [name, stringify(contents)])) });
    await expect.poll(() => page.evaluate(async folder => !!await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/24.md`), folder)).toBe(true);
    const warning = page.locator('.notice').filter({ hasText: 'Secrets are stored without encryption' });
    if (await warning.isVisible()) await warning.getByText("Don't show again", { exact: true }).click();
    for (const theme of (process.env.TASKNOTES_AC_LIFECYCLE ? [] : ['light', 'dark'])) for (const width of [1180, 400]) {
      await appearance(width, theme);
      const variant = `${theme}-${width}`;
      for (const surface of ['List', 'Board', 'Month']) {
        await open(`${surface}.base`);
        const selector = surface === 'List' ? '.tn-tasknotesTaskList .task-card' : surface === 'Board' ? '.kanban-view__card-wrapper .task-card' : '.tn-calendar-day-panel .task-card';
        await expect(page.locator(selector).first()).toBeVisible();
        await page.locator(selector).first().scrollIntoViewIfNeeded();
        const measured = await geometry(selector);
        observations[`${surface}-${variant}`] = measured;
        await capture(`${surface.toLowerCase()}-${variant}`);
        const surfaceCard = page.locator(selector).first();
        await surfaceCard.hover();
        await capture(`${surface.toLowerCase()}-hover-${variant}`);
        await surfaceCard.locator('.task-card__status-dot').focus();
        await capture(`${surface.toLowerCase()}-focus-${variant}`);
        if (verify) {
          const hits = await surfaceCard.locator('.task-card__status-dot').evaluate(element => {
            const bounds = element.getBoundingClientRect();
            return [2, bounds.width / 2, bounds.width - 2].flatMap(offsetX => [2, bounds.height / 2, bounds.height - 2].map(offsetY => element.contains(document.elementFromPoint(bounds.left + offsetX, bounds.top + offsetY))));
          });
          expect(hits.every(Boolean)).toBe(true);
        }
        if (width === 400 && verify) {
          expect(measured.scrollWidth).toBeLessThanOrEqual(measured.clientWidth + 1);
          const status = measured.controls.find(control => control.className.includes('__status-dot'))!;
          const priority = measured.controls.find(control => control.className.includes('__priority-dot'))!;
          expect(status.rect.top).toBeGreaterThanOrEqual(measured.title.bottom);
          expect(Math.abs(status.rect.top - priority.rect.top)).toBeLessThan(2);
          expect(status.rect.width).toBeGreaterThanOrEqual(40);
          expect(status.rect.height).toBeGreaterThanOrEqual(40);
          expect(status.hit).toContain('__status-dot');
          for (const control of measured.controls.filter(control => !control.className.includes('__drag-handle'))) expect(control.rect.right).toBeLessThanOrEqual(measured.bounds.right + 1);
        }
        if (width === 400 && surface === 'List') {
          const card = page.locator(selector).first();
          const status = card.locator('.task-card__status-dot');
          const rect = (await status.boundingBox())!;
          const taskPath = await card.getAttribute('data-task-path');
          const previous = await page.evaluate(async taskPath => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath)).status, taskPath);
          const touch = await page.context().newCDPSession(page);
          await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rect.x + 4, y: rect.y + rect.height - 10 }] });
          await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await page.waitForTimeout(250);
          observations[`status-touch-${variant}`] = { previous, current: await page.evaluate(async taskPath => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath)).status, taskPath), moveOpen: await page.getByText('Move task', { exact: true }).isVisible() };
          if (verify) await expect.poll(() => page.evaluate(async taskPath => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath)).status, taskPath)).not.toBe(previous);
          await page.keyboard.press('Escape');
          await touch.detach();
          await page.mouse.move(1, 1);
          await card.locator('.task-card__drag-handle').press('Enter');
          await expect(page.locator('.menu:visible')).toBeVisible();
          const originalHandle = await card.locator('.task-card__drag-handle').elementHandle();
          await page.evaluate(async taskPath => {
            const plugin = (window as any).app.plugins.plugins.tasknotes;
            const task = await plugin.cacheManager.getTaskInfo(taskPath);
            await plugin.updateTaskProperty(task, 'priority', task.priority === 'normal' ? 'high' : 'normal');
          }, taskPath);
          await expect.poll(() => originalHandle!.evaluate(element => element.isConnected)).toBe(false);
          await expect(page.locator('.menu:visible')).toBeVisible();
          await page.keyboard.press('ArrowDown');
          await expect(page.locator('.menu:visible .menu-item.selected')).toBeVisible();
          await capture(`list-move-keyboard-${variant}`);
          await page.keyboard.press('Escape');
          await expect(page.locator('.menu:visible')).toHaveCount(0);
        }
      }
      await page.evaluate(async folder => {
        const plugin = (window as any).app.plugins.plugins.tasknotes;
        const task = await plugin.cacheManager.getTaskInfo(`${folder}/0.md`);
        if (task.status !== 'open') await plugin.updateTaskProperty(task, 'status', 'open');
        await plugin.pomodoroService.saveLastSelectedTask(`${folder}/0.md`);
      }, folder);
      await view('tasknotes-pomodoro-view');
      const pomodoro = '.pomodoro-view__task-card-container .task-card:visible';
      await expect(page.locator(pomodoro)).toBeVisible();
      observations[`pomodoro-${variant}`] = await geometry(pomodoro);
      await capture(`pomodoro-${variant}`);
      if (width === 400 && verify) {
        const measured = await geometry(pomodoro);
        expect(measured.scrollWidth).toBeLessThanOrEqual(measured.clientWidth + 1);
        for (const control of measured.controls) {
          expect(control.rect.left).toBeGreaterThanOrEqual(measured.bounds.left);
          expect(control.rect.right).toBeLessThanOrEqual(measured.bounds.right + 1);
        }
        await page.mouse.move(1, 1);
        await page.locator(pomodoro).locator('.task-card__context-menu').press('Enter');
        await expect(page.locator('.menu:visible')).toBeVisible();
        await capture(`pomodoro-menu-${variant}`);
        await page.keyboard.press('Escape');
        await page.evaluate(async folder => {
          const plugin = (window as any).app.plugins.plugins.tasknotes;
          plugin.settings.defaultVisibleProperties = ['status', 'priority'];
          (window as any).app.workspace.activeLeaf.view.updateTaskCardDisplay(await plugin.cacheManager.getTaskInfo(`${folder}/0.md`));
        }, folder);
        const withoutMetadata = await geometry(pomodoro);
        observations[`pomodoro-no-metadata-${variant}`] = withoutMetadata;
        expect(withoutMetadata.scrollWidth).toBeLessThanOrEqual(withoutMetadata.clientWidth + 1);
        for (const control of withoutMetadata.controls) expect(control.rect.right).toBeLessThanOrEqual(withoutMetadata.bounds.right + 1);
        await capture(`pomodoro-no-metadata-${variant}`);
        await page.evaluate(() => { (window as any).app.plugins.plugins.tasknotes.settings.defaultVisibleProperties = (window as any).acSettings.defaultVisibleProperties; });
      }
      await view('tasknotes-pomodoro-stats-view');
      await expect(page.locator('.pomodoro-stats-view__session-item:visible')).toHaveCount(2);
      observations[`history-${variant}`] = await page.locator('.pomodoro-stats-view__session-task:visible').allTextContents();
      if (verify) {
        await expect(page.locator('.pomodoro-stats-view__session-task:visible')).toHaveText(['Collision review 0', 'Missing']);
      }
      if (width === 400) {
        await capture(`history-overview-${variant}`);
        await page.locator('.pomodoro-stats-view__session-item:visible').last().scrollIntoViewIfNeeded();
      }
      await capture(`history-${variant}`);
      await open('Prose.md');
      await page.evaluate(async () => { const view = (window as any).app.workspace.activeLeaf.view; await view.setState({ ...view.getState(), mode: 'preview' }, { history: false }); });
      const sentence = page.locator('.tasknotes-inline-widget--sentence:visible').first();
      await expect(sentence).toBeVisible();
      observations[`sentence-${variant}`] = await geometry('.tasknotes-inline-widget--sentence:visible .task-card');
      await capture(`sentence-${variant}`);
      if (width === 400 && verify) {
        for (const selector of ['.task-card__status-dot', '.task-card__context-menu']) {
          const control = sentence.locator(selector);
          await expect.poll(() => control.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(0);
          expect(await control.evaluate(element => element.getBoundingClientRect().width)).toBeLessThanOrEqual(24);
          await expect.poll(() => sentence.locator('.task-card__inline-controls').evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(40);
          await expect.poll(() => control.evaluate(element => {
            const bounds = element.getBoundingClientRect();
            return element.contains(document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top - 6));
          })).toBe(true);
          await page.mouse.move(1, 1);
          const previousStatus = selector.includes('status-dot')
            ? await page.evaluate(async folder => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/0.md`)).status, folder)
            : null;
          await control.press('Enter');
          if (selector.includes('context-menu')) await expect(page.locator('.menu:visible')).toBeVisible();
          else await expect.poll(() => page.evaluate(async folder => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/0.md`)).status, folder)).not.toBe(previousStatus);
          await capture(`sentence-${selector.includes('context-menu') ? 'menu' : 'status'}-${variant}`);
          await page.keyboard.press('Escape');
        }
        const status = sentence.locator('.task-card__status-dot');
        const bounds = (await status.boundingBox())!;
        const touch = await page.context().newCDPSession(page);
        const previous = await page.evaluate(async folder => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/0.md`)).status, folder);
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y - 6 }] });
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await expect.poll(() => page.evaluate(async folder => (await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/0.md`)).status, folder)).not.toBe(previous);
        await touch.detach();
      }
    }
    await appearance(1180, 'light');
    await open('Month.base');
    for (let iteration = 0; iteration < 4; iteration++) {
      const more = page.locator('.tnc-dg .tnc-more').filter({ hasText: /^\+/ }).first();
      await more.click();
      await expect(page.locator('.tnc-popover')).toBeVisible();
      await page.keyboard.press('Escape');
      const selected = await page.locator('.tnc-dg-day.tn-calendar-day-selected').getAttribute('data-date');
      await appearance(1180, 'dark');
      await appearance(400, 'dark');
      await appearance(1180, 'light');
      await page.waitForTimeout(250);
      observations[`panel-roundtrip-${iteration}`] = await page.locator('.tn-calendar-day-panel').evaluate(panel => ({ text: panel.textContent, height: panel.firstElementChild?.getBoundingClientRect().height, connected: panel.isConnected, scrollTop: panel.scrollTop, nodes: [panel, ...panel.querySelectorAll('.tnc, .tnc-view, .tnc-list, .tnc-list-scroll, .tnc-list-body')].map(element => ({ classes: element.className, style: element.getAttribute('style'), hidden: element.hasAttribute('hidden'), bounds: element.getBoundingClientRect().toJSON(), display: getComputedStyle(element).display, height: getComputedStyle(element).height, overflow: getComputedStyle(element).overflow, flex: getComputedStyle(element).flex })) }));
      await capture(`panel-roundtrip-${iteration}`);
      observations[`panel-dom-${iteration}`] = await page.locator('.tn-calendar-day-panel').evaluate(panel => ({ html: panel.outerHTML.slice(0, 5000), nodes: [panel, ...panel.querySelectorAll('.tnc, .tnc-view')].map(element => ({ parent: element.parentElement?.className, connected: element.isConnected, visibility: getComputedStyle(element).visibility, contentVisibility: getComputedStyle(element).contentVisibility, contain: getComputedStyle(element).contain, rectCount: element.getClientRects().length })) }));
      if (!verify && iteration === 3) observations.panelRecovery = await page.locator('.tn-calendar-day-panel').evaluate(panel => {
        const root = panel.querySelector<HTMLElement>('.tnc')!;
        const before = root.offsetHeight;
        (panel as HTMLElement).style.containerType = 'normal';
        const withoutContainment = root.offsetHeight;
        (panel as HTMLElement).style.removeProperty('container-type');
        const restored = root.offsetHeight;
        return { before, withoutContainment, restored };
      });
      if (verify) {
        await expect(page.locator('.tn-calendar-day-panel .task-card')).toHaveCount(25);
        await expect(page.locator('.tnc-dg-day.tn-calendar-day-selected')).toHaveAttribute('data-date', selected!);
        expect(await page.locator('.tn-calendar-day-panel > .tnc').evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(100);
      }
    }
    await page.evaluate(async folder => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      for (const index of [0, 1, 2]) {
        const task = await plugin.cacheManager.getTaskInfo(`${folder}/${index}.md`);
        if (task.status !== 'open') await plugin.updateTaskProperty(task, 'status', 'open');
      }
    }, folder);
    for (const theme of ['light', 'dark']) for (const width of [1180, 400]) {
      await appearance(width, theme);
      await open('Day.base');
      observations[`day-entry-${theme}-${width}`] = await page.locator('.tnc-toolbar-view-select').first().inputValue();
      if (width === 400) await page.locator('.tnc-toolbar-view-select:visible').selectOption('day');
      else await page.locator('.tnc-btn-view-day:visible').click();
      await expect(page.locator('.tnc--day')).toBeVisible();
      observations[`day-state-${theme}-${width}`] = await page.locator('.tnc--day').evaluate(root => ({
        text: root.textContent,
        bounds: root.getBoundingClientRect().toJSON(),
      }));
      await capture(`calendar-entry-${theme}-${width}`);
      const timed = page.locator('.tnc-item--timed');
      const stack = page.locator('.tnc-more--collision');
      if (width === 400) {
        await expect(stack.locator('.tnc-collision-count')).toHaveText('3');
        await capture(`calendar-rest-${theme}-${width}`);
        await stack.hover();
        await capture(`calendar-hover-${theme}-${width}`);
        await page.mouse.move(1, 1);
        await stack.focus();
        await capture(`calendar-focus-${theme}-${width}`);
        await page.keyboard.press('Enter');
        await expect(page.locator('.tnc-popover .tnc-item')).toHaveCount(3);
        await capture(`calendar-expanded-${theme}-${width}`);
      } else {
        await expect(timed).toHaveCount(3);
      }
      const source = page.locator(`.tnc-item[data-id="scheduled-${folder}/0.md"]`);
      await source.scrollIntoViewIfNeeded();
      if (width === 1180) {
        await capture(`calendar-rest-${theme}-${width}`);
        await source.hover();
        await capture(`calendar-hover-${theme}-${width}`);
        await source.focus();
        await capture(`calendar-focus-${theme}-${width}`);
      }
      const held = (await source.boundingBox())!;
      const column = (await page.locator('.tnc-tg-body .tnc-col').boundingBox())!;
      const pointerX = held.x + Math.min(60, held.width / 2);
      await page.mouse.move(pointerX, held.y + 12);
      await page.mouse.down();
      await page.mouse.move(width === 400 ? column.x + column.width / 2 : pointerX + 5, width === 400 ? column.y + column.height * 0.3 + 12 : held.y + held.height + 12, { steps: 12 });
      await page.waitForTimeout(1300);
      observations[`held-${theme}-${width}`] = await timed.evaluateAll(elements => elements.map(element => ({ text: element.textContent, classes: element.className, rect: element.getBoundingClientRect().toJSON(), visibility: getComputedStyle(element).visibility, opacity: getComputedStyle(element).opacity })));
      await capture(`calendar-held-${theme}-${width}`);
      if (verify) {
        await expect(page.locator('.tnc-item.is-dragging')).toBeVisible();
        await expect(page.locator('.tnc-drag-origin')).toHaveCount(0);
        await expect(timed).toHaveCount(3);
        if (width === 400) await expect(stack).toHaveCount(0);
      }
      await page.keyboard.press('Escape');
      await page.mouse.up();
      if (width === 400) {
        await expect(stack.locator('.tnc-collision-count')).toHaveText('3');
        await expect(timed).toHaveCount(0);
      }
      await capture(`calendar-cancelled-${theme}-${width}`);
    }
  } finally {
    writeFileSync(`${evidence}/geometry.json`, JSON.stringify(observations, null, 2));
    await page.evaluate(async folder => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      if ((window as any).acHistory) await plugin.pomodoroService.saveSessionHistory((window as any).acHistory);
      await plugin.pomodoroService.saveLastSelectedTask((window as any).acLastTask);
      Object.assign(plugin.settings, (window as any).acSettings);
      for (const leaf of app.workspace.getLeavesOfType('bases')) leaf.detach();
      const created = app.vault.getAbstractFileByPath(folder);
      if (created) await app.vault.delete(created, true);
    }, folder).catch(() => {});
    await closeObsidian(instance);
  }
});
