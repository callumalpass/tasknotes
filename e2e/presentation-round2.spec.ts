import { test, expect, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { readFileSync } from 'node:fs';
import { DEFAULT_PRIORITIES, DEFAULT_STATUSES } from '../src/settings/defaults';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
let dailyNotesFolder: string;
const folder = `PresentationR2-${Date.now()}`;
const title = 'Review the supplier onboarding plan with accessibility and operations before launch';
const taskPath = `${folder}/Review.md`;
const themeCss = process.env.TASKNOTES_E2E_PRESENTATION_THEME_CSS;
const themeSuffix = themeCss ? `-${process.env.TASKNOTES_E2E_PRESENTATION_THEME_NAME || 'theme'}` : '';
const screenshots = process.env.TASKNOTES_E2E_PRESENTATION_SCREENSHOTS || 'test-results';

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  if (themeCss) await page.addStyleTag({ content: readFileSync(themeCss, 'utf8') });
  await setObsidianViewport(page, { width: 1180, height: 800 });
  dailyNotesFolder = await page.evaluate(async ({ folder, title, taskPath, statuses, priorities }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    plugin.settings.enableModalSplitLayout = false;
    plugin.settings.customStatuses = statuses;
    plugin.settings.customPriorities = priorities;
    plugin.statusManager.updateStatuses(statuses);
    plugin.priorityManager.updatePriorities(priorities);
    await app.vault.createFolder(folder);
    const today = (window as any).moment().format('YYYY-MM-DD');
    const dailyNotes = app.internalPlugins.getEnabledPluginById('daily-notes');
    const originalFolder = dailyNotes.options.folder;
    dailyNotes.options.folder = folder;
    await app.vault.create(`${folder}/${today}.md`, `---\ntimeblocks:\n  - id: presentation-focus\n    title: Supplier handoff focus\n    startTime: '13:00'\n    endTime: '14:00'\n---\n`);
    await app.vault.create(taskPath, `---\ntags: [task, launch, review]\ncontexts: [office]\nprojects: ["[[Supplier onboarding]]"]\ntitle: ${title}\nstatus: ${plugin.settings.defaultTaskStatus}\npriority: ${plugin.settings.defaultTaskPriority}\nscheduled: ${today}T10:00\ndue: ${today}\n---\n\nCheck the supplier plan and confirm the handoff.\n`);
    await app.vault.create(`${folder}/Inline.md`, `# Launch review\n\nPlease review [[${folder}/Review]] before the handoff.\n`);
    return originalFolder;
  }, { folder, title, taskPath, statuses: DEFAULT_STATUSES, priorities: DEFAULT_PRIORITIES });
  await expect.poll(() => page.evaluate(async taskPath => Boolean(await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(taskPath)), taskPath)).toBe(true);
  const secretNotice = page.getByText("Don't show again", { exact: true });
  if (await secretNotice.isVisible()) await secretNotice.click();
});

test.afterAll(async () => {
  try {
    if (page && !page.isClosed()) await page.evaluate(async ({ folder, dailyNotesFolder }) => {
      const app = (window as any).app;
      app.internalPlugins.getEnabledPluginById('daily-notes').options.folder = dailyNotesFolder;
      for (const leaf of app.workspace.getLeavesOfType('bases')) if (leaf.view.file?.path.startsWith(folder)) leaf.detach();
      const entry = app.vault.getAbstractFileByPath(folder);
      if (entry) await app.vault.delete(entry, true);
    }, { folder, dailyNotesFolder });
  } finally { if (instance) await closeObsidian(instance); }
});

async function openSurface(surface: string) {
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
    views: [{ type: surface === 'list' ? 'tasknotesTaskList' : surface === 'board' ? 'tasknotesKanban' : 'tasknotesCalendar',
      name: surface, groupBy: { property: 'status', direction: 'ASC' }, columnWidth: 340,
      calendarView: surface === 'agenda' ? 'listWeek' : 'dayGridMonth',
      order: ['status', 'priority', 'projects', 'tags', 'contexts', 'scheduled', 'due'] }],
  });
  await page.evaluate(async ({ folder, surface, content }) => {
    const app = (window as any).app;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    const path = `${folder}/${surface}.base`;
    const file = app.vault.getAbstractFileByPath(path) || await app.vault.create(path, content);
    await app.workspace.getLeaf(false).openFile(file);
  }, { folder, surface, content });
}

test('board reserves both configured date slots before chips', async () => {
  await openSurface('board');
  const card = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${taskPath}"]`).first();
  await expect(card).toBeVisible();
  await page.screenshot({ path: `${screenshots}/presentation-board-repro${themeSuffix}.png` });
  for (const role of ['due', 'scheduled']) {
    const date = card.locator(`.task-card__metadata-date--${role}`);
    await expect(date).toBeVisible();
    await expect(date.locator('.task-card__date-value')).toBeVisible();
    expect(await date.evaluate(element => {
      const rect = element.querySelector('.task-card__date-value')!.getBoundingClientRect();
      return [element, element.closest('.task-card__date-slot')!, element.closest('.task-card__metadata')!].every(parent => {
        const bounds = parent.getBoundingClientRect();
        return rect.left >= bounds.left && rect.right <= bounds.right + 1;
      });
    })).toBe(true);
  }
});

for (const workflow of ['default', 'custom']) {
  for (const theme of ['light', 'dark']) {
    for (const width of [1180, 430]) {
      test(`${workflow} ${theme} ${width}: same task across six surfaces`, async () => {
        test.setTimeout(120000);
        await setObsidianViewport(page, { width, height: 800 });
        await page.evaluate(async ({ workflow, theme, width, taskPath, folder }) => {
          const app = (window as any).app;
          const plugin = app.plugins.plugins.tasknotes;
          document.body.classList.remove('theme-light', 'theme-dark');
          document.body.classList.add(`theme-${theme}`);
          document.body.classList.toggle('is-mobile', width === 430);
          if (workflow === 'custom') {
            plugin.settings.customStatuses = Array.from({ length: 8 }, (_, order) => ({
              id: `workflow-${order}`, value: `workflow-${order}`,
              label: `Supplier onboarding review stage ${order + 1} awaiting stakeholder confirmation`,
              order, color: 'var(--color-blue)', isCompleted: order === 7,
              ...(order === 2 ? { icon: 'scan-eye' } : {}),
            }));
            plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
            await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(taskPath), (frontmatter: any) => { frontmatter.status = 'workflow-2'; });
          }
          for (const file of app.vault.getMarkdownFiles()) {
            if (file.path.startsWith(`${folder}/Control-`) && !plugin.settings.customStatuses.some((status: any) => file.basename === `Control-${status.id}`)) await app.vault.delete(file);
          }
          for (const status of plugin.settings.customStatuses) {
            const path = `${folder}/Control-${status.id}.md`;
            if (!app.vault.getAbstractFileByPath(path)) await app.vault.create(path, `---\ntitle: Confirm the ${status.label} handoff\nstatus: ${status.value}\ntags: [task]\n---\n`);
          }
        }, { workflow, theme, width, taskPath, folder });
        const prefix = `${screenshots}/presentation-${workflow}-${theme}-${width}${themeSuffix}`;
        for (const surface of ['list', 'board', 'agenda', 'calendar']) {
          await openSurface(surface);
          await setObsidianViewport(page, { width, height: 800 });
          const root = page.locator('.workspace-leaf.mod-active');
          if (surface === 'list') {
            const expectedGroups = await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.settings.customStatuses.slice().sort((left: any, right: any) => left.order - right.order).map((status: any) => status.value));
            await expect.poll(() => root.locator('.task-section[data-level="primary"]').evaluateAll(elements => elements.map(element => (element as HTMLElement).dataset.groupKey))).toEqual(expectedGroups);
          }
          if (surface === 'calendar') await expect(root.locator('.tnc')).toBeVisible();
          else {
            const card = root.locator(`.task-card[data-task-path="${taskPath}"]`).first();
            await expect(card).toBeVisible();
            await card.scrollIntoViewIfNeeded();
            await expect(card.locator('.task-card__title-text')).toHaveText(title);
            if (surface === 'board') {
              expect(await card.locator('.task-card__title-text').evaluate(element => {
                const style = getComputedStyle(element);
                return style.whiteSpace === 'normal' && element.getBoundingClientRect().height > parseFloat(style.lineHeight);
              })).toBe(true);
            }
            for (const role of surface === 'agenda' ? ['due'] : ['due', 'scheduled']) await expect(card.locator(`.task-card__metadata-date--${role}`)).toBeVisible();
            await expect(card.locator('.task-card__status-dot')).toBeVisible();
            await expect(card.locator('.task-card__priority-dot')).toBeVisible();
            if (surface === 'list' || surface === 'board') {
              const scheduled = card.locator('.task-card__metadata-date--scheduled');
              expect(await scheduled.evaluate(element => getComputedStyle(element).color)).not.toBe(await card.locator('.task-card__metadata-date--due').evaluate(element => getComputedStyle(element).color));
            }
          }
          await setObsidianViewport(page, { width, height: 800 });
          await page.screenshot({ path: `${prefix}-${surface}.png`, clip: { x: 0, y: 0, width, height: 800 } });
        }
        await page.evaluate(async taskPath => {
          const plugin = (window as any).app.plugins.plugins.tasknotes;
          await plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(taskPath));
        }, taskPath);
        await expect(page.locator('.modal.mod-tasknotes')).toBeVisible();
        await expect(page.locator('.modal [data-type="due-date"] .lucide-flag-triangle-right')).toBeVisible();
        await page.screenshot({ path: `${prefix}-modal.png`, clip: { x: 0, y: 0, width, height: 800 } });
        await page.keyboard.press('Escape');
        await page.evaluate(async folder => {
          const app = (window as any).app;
          await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(`${folder}/Inline.md`), { state: { mode: 'preview' } });
        }, folder);
        await expect(page.locator('.workspace-leaf.mod-active .task-card--layout-inline:visible').first()).toBeVisible();
        await page.screenshot({ path: `${prefix}-inline.png`, clip: { x: 0, y: 0, width, height: 800 } });
        await page.evaluate(async folder => {
          const app = (window as any).app;
          const leaf = app.workspace.getLeaf(false);
          await leaf.setViewState({ type: 'markdown', state: { file: `${folder}/Inline.md`, mode: 'source', source: false } });
          leaf.view.editor?.setCursor({ line: 0, ch: 0 });
        }, folder);
        await expect(page.locator('.workspace-leaf.mod-active .task-card--layout-inline:visible').first()).toBeVisible();
        await page.screenshot({ path: `${prefix}-inline-live.png`, clip: { x: 0, y: 0, width, height: 800 } });
      });
    }
  }
}

test('no configured priorities omit empty values but preserve unknown values and their full picker label', async () => {
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.settings.customPriorities = [];
    plugin.priorityManager.updatePriorities([]);
    document.body.classList.remove('is-mobile');
  });
  for (const priority of ['', 'none', 'low']) {
    await page.evaluate(async ({ taskPath, priority }) => {
      const app = (window as any).app;
      await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(taskPath), (frontmatter: any) => { frontmatter.priority = priority; });
    }, { taskPath, priority });
    await openSurface('list');
    const card = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${taskPath}"]`).first();
    await expect(card).toBeVisible();
    await expect(card.locator('.task-card__priority-dot')).toHaveCount(priority === 'low' ? 1 : 0);
    if (priority === 'low') {
      await card.locator('.task-card__priority-dot').click();
      const label = page.locator('.tn-picker__label').filter({ hasText: 'low (not configured)' });
      await expect(label).toBeVisible();
      expect(await label.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
      await page.screenshot({ path: 'test-results/presentation-unconfigured-priority.png' });
      await page.keyboard.press('Escape');
    }
  }
});

test('property-event agenda metadata never overlaps the title or embeds native date inputs', async () => {
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}/Property")`] },
    views: [{ type: 'tasknotesCalendar', name: 'Property events', calendarView: 'listWeek',
      startDateProperty: 'note.eventStart', endDateProperty: 'note.eventEnd', showPropertyBasedEvents: true,
      order: ['file.name', 'note.eventStart', 'note.eventEnd', 'file.ctime'] }],
  });
  await page.evaluate(async ({ folder, content }) => {
    const app = (window as any).app;
    await app.vault.createFolder(`${folder}/Property`);
    const today = (window as any).moment().format('YYYY-MM-DD');
    await app.vault.create(`${folder}/Property/Supplier workshop.md`, `---\neventStart: ${today}T11:00\neventEnd: ${today}T12:00\n---\n`);
    await app.workspace.getLeaf(false).openFile(await app.vault.create(`${folder}/Properties.base`, content));
  }, { folder, content });
  const card = page.locator('.workspace-leaf.mod-active .task-card--property-event').first();
  await expect(card).toBeVisible();
  await expect(card.locator('input')).toHaveCount(0);
  await expect(card.locator('.task-card__title-text')).toHaveText('Supplier workshop');
  await page.screenshot({ path: `${screenshots}/presentation-property-events${themeSuffix}.png` });
});

test('native empty-result count does not count separately fetched daily-note timeblocks', async () => {
  const originalFolder = await page.evaluate(async folder => {
    const app = (window as any).app;
    const dailyNotes = app.internalPlugins.getEnabledPluginById('daily-notes');
    const originalFolder = dailyNotes.options.folder;
    dailyNotes.options.folder = folder;
    const base = await app.vault.create(`${folder}/Empty.base`, `filters:\n  and:\n    - file.inFolder("${folder}/Missing")\nviews:\n  - type: tasknotesCalendar\n    name: Empty with timeblocks\n    calendarView: dayGridMonth\n    showTimeblocks: true\n`);
    await app.workspace.getLeaf(false).openFile(base);
    return originalFolder;
  }, folder);
  try {
    await expect(page.locator('.workspace-leaf.mod-active .tnc-item[data-event-type="timeblock"]').first()).toBeVisible();
    await expect(page.locator('.workspace-leaf.mod-active .bases-toolbar').getByText('0 results', { exact: true })).toBeVisible();
    await page.screenshot({ path: `${screenshots}/presentation-empty-count-timeblock${themeSuffix}.png` });
  } finally {
    await page.evaluate(originalFolder => { (window as any).app.internalPlugins.getEnabledPluginById('daily-notes').options.folder = originalFolder; }, originalFolder);
  }
});
