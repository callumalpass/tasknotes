import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let app: ObsidianApp;
const folder = `e2e-calendar-design-${Date.now()}`;
let dailyNotesFolder: string | undefined;
test.beforeAll(async () => {
  app = await launchObsidian();
  dailyNotesFolder = await app.page.evaluate(async (folder) => {
    const app = (window as any).app;
    const now = new Date();
    const day = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const today = day(now);
    const yesterday = day(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    await app.vault.createFolder(folder);
    const dailyNotes = app.internalPlugins.getEnabledPluginById('daily-notes');
    const previousFolder = dailyNotes.options.folder;
    dailyNotes.options.folder = folder;
    await app.vault.create(`${folder}/${today}.md`, `---
timeblocks:
  - id: calendar-design-focus
    title: Focus on calendar polish
    startTime: '13:00'
    endTime: '14:00'
    description: Keep the vault visible while planning.
    attachments: ['[[Design task]]']
---
`);
    await app.vault.create(`${folder}/Design task.md`, `---
title: Review calendar interaction details
tags: [task, design]
status: open
priority: high
scheduled: ${today}T10:00
due: ${yesterday}
timeEstimate: 60
timeEntries:
  - startTime: '${new Date(`${today}T11:00`).toISOString()}'
    endTime: '${new Date(`${today}T11:30`).toISOString()}'
---
`);
    const titles = ['Reconcile supplier invoices', 'Review onboarding changes', 'Prepare customer research', 'Plan accessibility fixes', 'Send weekly project update'];
    for (let offset = -3; offset <= 3; offset++) {
      const date = day(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
      for (const [index, title] of titles.entries()) {
        await app.vault.create(`${folder}/Busy ${offset} ${index}.md`, `---
title: ${title}${offset === 0 ? '' : ` (${['Acme', 'Atlas', 'Cedar', 'Delta', 'Ember', 'Folio', 'Grove'][offset + 3]})`}
tags: [task]
status: open
priority: normal
scheduled: ${date}T${String(8 + index * 2).padStart(2, '0')}:00
timeEstimate: ${index === 0 ? 30 : 60}
---
`);
      }
    }
    await app.vault.create(`${folder}/Daily review.md`, `---
title: Daily project review
tags: [task]
status: open
scheduled: ${today}T09:00
recurrence: FREQ=DAILY
timeEstimate: 30
---
`);
    const base = await app.vault.create(`${folder}/Calendar.base`, `filters:
  and:
    - file.inFolder("${folder}")
views:
  - type: tasknotesCalendar
    name: Calendar design
    calendarView: timeGridWeek
    showOverdueOnToday: true
    showTimeEntries: true
    showTimeblocks: true
    slotMinTime: '08:00:00'
    slotMaxTime: '18:00:00'
    order: [status, priority, due, file.tags]
`);
    const leaf = app.workspace.getLeaf(true);
    await leaf.openFile(base);
    app.workspace.setActiveLeaf(leaf, { focus: true });
    return previousFolder;
  }, folder);
  await expect(app.page.locator('.workspace-leaf.mod-active .tnc')).toBeVisible({ timeout: 20000 });
});

test.afterAll(async () => {
  if (!app) return;
  try {
    await app.page.evaluate(async ({ folder, dailyNotesFolder }) => {
      const app = (window as any).app;
      app.internalPlugins.getEnabledPluginById('daily-notes').options.folder = dailyNotesFolder;
      for (const leaf of app.workspace.getLeavesOfType('bases')) {
        if (leaf.view.file?.path.startsWith(folder)) leaf.detach();
      }
      const file = app.vault.getAbstractFileByPath(folder);
      if (file) await app.vault.delete(file, true);
    }, { folder, dailyNotesFolder });
  } finally {
    await closeObsidian(app);
  }
});

test('narrow defaults are temporary and explicit view choices survive resizing', async () => {
  const page = app.page;
  await page.evaluate(() => {
    const app = (window as any).app;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
  });
  const calendar = page.locator('.workspace-leaf.mod-active .tnc');
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme);
      document.querySelectorAll('.notice').forEach(element => element.remove());
    }, theme);
    await setObsidianViewport(page, { width: 400, height: 800 });
    await expect(calendar.locator('.tnc-btn-view-list')).toHaveAttribute('aria-pressed', 'true');
    await expect(calendar.locator('.task-card__title').first()).toBeVisible();
    await page.screenshot({ path: `test-results/calendar-design/${theme}-400-default-agenda.png`, clip: { x: 0, y: 0, width: 400, height: 800 } });
    const base = await page.evaluate(async folder => {
      const app = (window as any).app;
      return app.vault.read(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
    }, folder);
    expect(base).toContain('calendarView: timeGridWeek');
    await setObsidianViewport(page, { width: 1180, height: 800 });
    await expect(calendar.locator('.tnc-btn-view-week')).toHaveAttribute('aria-pressed', 'true');
  }
  await calendar.locator('.tnc-btn-view-month').click();
  await setObsidianViewport(page, { width: 400, height: 800 });
  await expect(calendar.locator('.tnc-btn-view-month')).toHaveAttribute('aria-pressed', 'true');
});

test('public view buttons share kit styles across themes and narrow panes', async () => {
  test.setTimeout(180000);
  const page = app.page;
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate((theme) => {
      const app = (window as any).app;
      app.customCss?.setTheme('');
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme);
    }, theme);
    for (const width of [1180, 400]) {
      await page.evaluate(() => {
        const app = (window as any).app;
        app.workspace.leftSplit.collapse();
        app.workspace.rightSplit.collapse();
      });
      await setObsidianViewport(page, { width, height: 800 });
      const calendar = page.locator('.workspace-leaf.mod-active .tnc');
      for (const mode of ['month', 'week', 'days', 'day', 'year', 'list']) {
        await calendar.locator(`.tnc-btn-view-${mode}`).click();
        await expect(calendar.locator(`.tnc-btn-view-${mode}`)).toHaveAttribute('aria-pressed', 'true');
        await expect(calendar.locator('.tnc-toolbar-views .tnc-btn-view')).toHaveCount(6);
        const toolbarLine = await calendar.locator('.tnc-toolbar-start').evaluate(element => {
          const title = element.querySelector('.tnc-title')!.getBoundingClientRect();
          const navigation = element.querySelector('.tnc-toolbar-nav')!.getBoundingClientRect();
          return Math.abs((title.top + title.bottom) / 2 - (navigation.top + navigation.bottom) / 2);
        });
        expect(toolbarLine).toBeLessThan(3);
        if (mode === 'week') {
          const event = calendar.locator('.tnc-item[data-task-path] .tn-calendar-event-title').first();
          await expect(event).toBeVisible();
          const style = await calendar.locator('.tnc-item[data-task-path]').first().evaluate(element => {
            const css = getComputedStyle(element);
            return { left: css.borderLeftWidth, top: css.borderTopWidth };
          });
          expect(style).toEqual({ left: '2px', top: '0px' });
          await expect(calendar.locator('.tnc-item[data-event-type="timeblock"]').first()).toBeVisible();
          await expect(calendar.locator('.tnc-item[data-event-type="due"]').first()).toHaveAttribute('aria-label', /^Deadline:/);
          if (width === 1180) {
            await expect(calendar.locator('[data-task-path$="Busy 0 2.md"] .tnc-item-time')).toBeVisible();
          }
        }
        if (mode === 'list') {
          await expect(calendar.locator('[data-event-type="due"] .tn-calendar-list-deadline').first()).toHaveText('Deadline');
          await expect(calendar.locator('[data-event-type="scheduled"] .tn-calendar-list-stamp').first()).toContainText('08:00');
          await expect(calendar.locator('.task-card__metadata-date--overdue').first()).toBeVisible();
          await expect(calendar.locator('.timeblock-card__time')).toHaveText('13:00 - 14:00');
          await expect(calendar.locator('.timeblock-card__attachments')).toContainText('1 attachment');
        }
        await page.mouse.move(5, 5);
        await page.screenshot({ path: `test-results/calendar-design/${theme}-${width}-${mode}.png`, clip: { x: 0, y: 0, width, height: 800 } });
      }
      const comparison = await calendar.evaluate(calendar => {
        const kit = document.createElement('div');
        kit.className = 'tn-segmented';
        const button = kit.appendChild(document.createElement('button'));
        button.className = 'tn-segmented__item is-selected';
        calendar.appendChild(kit);
        const actual = calendar.querySelector('.tnc-btn-view[aria-pressed="true"]')!;
        const properties = ['height', 'padding', 'border-radius', 'background-color', 'color', 'font-size', 'box-shadow'];
        const read = (element: Element) => Object.fromEntries(properties.map(property => [property, getComputedStyle(element).getPropertyValue(property)]));
        const result = { kit: read(button), calendar: read(actual) };
        kit.remove();
        return result;
      });
      expect(comparison.calendar).toEqual(comparison.kit);
    }
  }
});

test('dense recurring days retain readable titles and every overflow item', async () => {
  const page = app.page;
  await page.evaluate(async folder => {
    const app = (window as any).app;
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    await app.vault.createFolder(`${folder}/Dense`);
    for (let index = 0; index < 35; index++) {
      await app.vault.create(`${folder}/Dense/Check ${index}.md`, `---\ntitle: Recurring project check ${index + 1}\ntags: [task]\nstatus: open\nscheduled: ${today}\nrecurrence: FREQ=DAILY\n---\n`);
    }
    const base = await app.vault.create(`${folder}/Dense.base`, `filters:\n  and:\n    - file.inFolder("${folder}/Dense")\nviews:\n  - type: tasknotesCalendar\n    name: Dense calendar\n    calendarView: dayGridMonth\n    showTimeblocks: false\n    showPropertyBasedEvents: false\n`);
    await app.workspace.getLeaf(true).openFile(base);
  }, folder);
  const calendar = page.locator('.workspace-leaf.mod-active .tnc');
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme);
    }, theme);
    await setObsidianViewport(page, { width: 1180, height: 800 });
    await expect(calendar.locator('.tnc-more').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `test-results/calendar-design/${theme}-1180-dense-month.png`, clip: { x: 0, y: 0, width: 1180, height: 800 } });
    await calendar.locator('.tnc-more').first().click();
    await expect(calendar.locator('.tnc-popover .tnc-item')).toHaveCount(35);
    await expect(calendar.locator('.tnc-popover .tn-calendar-event-title').first()).toBeVisible();
    await page.screenshot({ path: `test-results/calendar-design/${theme}-1180-dense-overflow.png`, clip: { x: 0, y: 0, width: 1180, height: 800 } });
    await page.keyboard.press('Escape');
  }
  await page.evaluate(async folder => {
    const app = (window as any).app;
    await app.vault.delete(app.vault.getAbstractFileByPath(`${folder}/Dense`), true);
    const leaf = app.workspace.getMostRecentLeaf();
    await leaf.openFile(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
  }, folder);
});

test('timeblocks retain drag and resize in both themes', async () => {
  const page = app.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  const calendar = page.locator('.workspace-leaf.mod-active .tnc');
  const readBlock = () => page.evaluate(folder => {
    const app = (window as any).app;
    const file = app.vault.getMarkdownFiles().find((file: any) => file.path.startsWith(folder) && app.metadataCache.getFileCache(file)?.frontmatter?.timeblocks);
    return file ? app.metadataCache.getFileCache(file)?.frontmatter?.timeblocks?.[0] : undefined;
  }, folder);
  await expect.poll(readBlock).toMatchObject({ startTime: '13:00', endTime: '14:00' });
  const originalBlock = await readBlock();
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme);
    }, theme);
    await calendar.locator('.tnc-btn-view-days').click();
    await expect.poll(() => page.evaluate(async folder => {
      const app = (window as any).app;
      return app.vault.read(app.vault.getAbstractFileByPath(`${folder}/Calendar.base`));
    }, folder)).toMatch(/calendarView: ["']?timeGridCustom/);
    const block = calendar.locator('.tnc-item[data-event-type="timeblock"]');
    await expect(block).toBeVisible();
    let box = (await block.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 10);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 10 + box.height, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => (await readBlock())?.startTime).toBe('14:00');
    await expect(block).toContainText('14:00 – 15:00');
    await expect(calendar.locator('.tnc-btn-view-days')).toHaveAttribute('aria-pressed', 'true');
    box = (await block.boundingBox())!;
    const handle = block.locator('.tnc-resize-end');
    await handle.hover();
    const resize = (await handle.boundingBox())!;
    await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2);
    await page.mouse.down();
    await page.mouse.move(resize.x + resize.width / 2, resize.y + resize.height / 2 + box.height, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => (await readBlock())?.endTime).toBe('16:00');
    await expect(calendar.locator('.tnc-btn-view-days')).toHaveAttribute('aria-pressed', 'true');
    await page.evaluate(async ({ folder, originalBlock }) => {
      const app = (window as any).app;
      const file = app.vault.getMarkdownFiles().find((file: any) => file.path.startsWith(folder) && app.metadataCache.getFileCache(file)?.frontmatter?.timeblocks);
      await app.fileManager.processFrontMatter(file, (frontmatter: any) => {
        frontmatter.timeblocks[0] = originalBlock;
      });
    }, { folder, originalBlock });
    await expect.poll(async () => (await readBlock())?.startTime).toBe('13:00');
    await calendar.locator('.tnc-btn-next').click();
    await expect(block).toHaveCount(0);
    await calendar.locator('.tnc-btn-prev').click();
    await expect(block).toContainText('13:00');
  }
});

test('empty agendas remain legible at desktop and narrow widths', async () => {
  const page = app.page;
  await page.evaluate(async folder => {
    const app = (window as any).app;
    const file = await app.vault.create(`${folder}/Empty.base`, `filters:\n  and:\n    - file.inFolder("${folder}/empty")\nviews:\n  - type: tasknotesCalendar\n    name: Empty calendar\n    calendarView: listWeek\n    showTimeblocks: false\n    showTimeEntries: false\n    showPropertyBasedEvents: false\n`);
    await app.workspace.getLeaf(true).openFile(file);
  }, folder);
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme);
    }, theme);
    for (const width of [1180, 400]) {
      await setObsidianViewport(page, { width, height: 800 });
      await page.evaluate(width => document.body.classList.toggle('is-mobile', width === 400), width);
      await expect(page.locator('.workspace-leaf.mod-active .tnc-list-empty')).toBeVisible();
      await page.screenshot({ path: `test-results/calendar-design/${theme}-${width}-empty.png`, clip: { x: 0, y: 0, width, height: 800 } });
    }
  }
  await page.evaluate(() => document.body.classList.remove('is-mobile'));
});

test('mini calendar retains today, selection and note chooser', async () => {
  const page = app.page;
  await page.evaluate(async ({ folder }) => {
    const app = (window as any).app;
    const base = await app.vault.create(`${folder}/Mini.base`, `filters:
  and:
    - file.inFolder("${folder}")
views:
  - type: tasknotesMiniCalendar
    name: Mini design
    dateProperty: note.scheduled
    titleProperty: title
`);
    const leaf = app.workspace.getLeaf(true);
    await leaf.openFile(base);
    app.workspace.setActiveLeaf(leaf, { focus: true });
  }, { folder });
  const mini = page.locator('.workspace-leaf.mod-active .mini-calendar-bases-view');
  await expect(mini).toBeVisible();
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme);
    }, theme);
    for (const width of [1180, 400]) {
      await setObsidianViewport(page, { width, height: 800 });
      expect((await mini.boundingBox())!.width).toBeLessThanOrEqual(360);
      await expect(mini.locator('.mini-calendar-view__month-display')).toHaveCSS('text-transform', 'none');
      const todayCell = mini.locator('[aria-current="date"]');
      await expect(todayCell).toBeVisible();
      await page.screenshot({ path: `test-results/calendar-design/${theme}-${width}-mini.png`, clip: { x: 0, y: 0, width, height: 800 } });
      await todayCell.click();
      await expect(page.locator('.note-selector-modal__title').filter({ hasText: 'Review calendar' })).toBeVisible();
      await expect(page.locator('.note-selector-modal__title .tn-task-glyphs').first()).toBeVisible();
      await page.keyboard.press('Escape');
      await mini.locator('.mini-calendar-view__day:not(.mini-calendar-view__day--outside-month):not([aria-current="date"])').first().click();
      await expect(todayCell).toHaveAttribute('aria-selected', 'false');
      const todayStyle = await todayCell.evaluate(element => {
        const css = getComputedStyle(element);
        return { border: css.borderWidth, shadow: css.boxShadow };
      });
      expect(todayStyle).toEqual({ border: '0px', shadow: 'none' });
      await expect(todayCell).toHaveClass(/mini-calendar-view__day--intensity-/);
      await page.screenshot({ path: `test-results/calendar-design/${theme}-${width}-mini-independent-selection.png`, clip: { x: 0, y: 0, width, height: 800 } });
    }
  }
  await mini.locator('[aria-current="date"]').click();
  await page.locator('.note-selector-modal__title').filter({ hasText: 'Review calendar' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).app.workspace.getActiveFile()?.path)).toBe(`${folder}/Design task.md`);
});
