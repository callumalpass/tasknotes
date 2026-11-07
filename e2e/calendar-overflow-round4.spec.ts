import { test, expect } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
const folder = `CalendarOverflowP-${Date.now()}`;

test.beforeAll(async () => {
  instance = await launchObsidian();
  await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    const status = app.plugins.plugins.tasknotes.settings.defaultTaskStatus;
    const today = (window as any).moment().format('YYYY-MM-DD');
    for (let index = 0; index < 8; index++) {
      await app.vault.create(`${folder}/Appointment-${index}.md`, `---\ntitle: Review supplier onboarding appointment ${index + 1} with accessibility and operations\ntags: [task]\nstatus: ${status}\nscheduled: ${today}T10:00\ntimeEstimate: 60\ndue: ${today}\n---\n`);
    }
  }, folder);
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

async function openCalendar(showMonthDayPanel = true) {
  const page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  const content = stringify({ filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] }, views: [{ type: 'tasknotesCalendar', name: 'Overflow', calendarView: 'timeGridWeek', showMonthDayPanel, showDue: true, showTimeblocks: false, showTimeEntries: false }] });
  await page.evaluate(async ({ folder, content }) => {
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(`${folder}/Overflow.base`) ?? await app.vault.create(`${folder}/Overflow.base`, content);
    if (await app.vault.read(file) !== content) await app.vault.modify(file, content);
    await app.workspace.getLeaf(false).openFile(file);
  }, { folder, content });
}

test('week stays overviewable and overflow remains readable and reachable after resize', async ({}, testInfo) => {
  const page = instance.page;
  await openCalendar();
  const grid = page.locator('.workspace-leaf.mod-active .tnc-tg-scroll');
  await expect(grid).toBeVisible();
  await page.locator('.tnc-btn-view-day').click();
  await page.locator('.tnc-btn-view-week').click();
  await expect(page.locator('.tnc-item, .tnc-more').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('week.png') });
  expect(await grid.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(2);
  const more = page.locator('.tnc-more--collision').first();
  await more.click();
  const popover = page.locator('.tnc-popover');
  await expect(popover).toBeVisible();
  await setObsidianViewport(page, { width: 440, height: 800 });
  await page.evaluate(() => document.body.classList.add('is-mobile'));
  if (!await popover.count()) {
    await expect(popover).toBeHidden();
    await more.click();
  }
  await expect.poll(() => popover.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return { bounds: bounds.toJSON(), viewport: [innerWidth, innerHeight], inside: bounds.left >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight };
  })).toMatchObject({ inside: true });
  await expect(popover.locator('.tnc-popover-close')).toBeInViewport();
  await expect(popover.locator('.tnc-item').first()).toBeVisible();
  await expect.poll(() => popover.locator('.tnc-item').first().evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(40);
  await page.keyboard.press('End');
  await expect(popover.locator('.tnc-item').last()).toBeFocused();
  await expect(popover.locator('.tnc-item').last()).toBeInViewport();
  await page.keyboard.press('Home');
  await expect(popover.locator('.tnc-item').first()).toBeFocused();
  await page.locator('.notice-container .notice').evaluateAll(elements => elements.forEach(element => element.remove()));
  await page.screenshot({ path: testInfo.outputPath('mobile-overflow.png') });
  await page.evaluate(() => {
    document.body.classList.remove('theme-light');
    document.body.classList.add('theme-dark');
  });
  await page.screenshot({ path: testInfo.outputPath('mobile-overflow-dark.png') });
  await page.keyboard.press('Escape');
  await expect(popover).toBeHidden();
  await page.locator('.tnc-btn-today').click();
  await expect(page.locator('.tnc-dh.is-today')).toBeInViewport();
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(() => document.body.classList.remove('is-mobile'));
  await expect(page.locator('.tnc-tg-day-navigation')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('week-dark.png') });
});

test('month bars use one line and overflow allocates readable title height', async ({}, testInfo) => {
  const page = instance.page;
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await openCalendar(false);
  await page.evaluate(() => document.body.classList.remove('is-mobile'));
  await page.evaluate(async folder => {
    const app = (window as any).app;
    const today = (window as any).moment().format('YYYY-MM-DD');
    const status = app.plugins.plugins.tasknotes.settings.defaultTaskStatus;
    for (let index = 0; index < 10; index++) {
      await app.vault.create(`${folder}/Deadline-${index}.md`, `---\ntitle: Confirm the supplier onboarding deadline ${index + 1} with accessibility and operations\ntags: [task]\nstatus: ${status}\nscheduled: ${today}\n---\n`);
    }
  }, folder);
  await page.locator('.tnc-btn-view-month').click();
  const title = page.locator('.tnc-dg .tnc-item--bar .tn-calendar-event-title').first();
  await expect(title).toBeVisible();
  expect(await title.evaluate(element => getComputedStyle(element).whiteSpace)).toBe('nowrap');
  expect(await title.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
  for (const width of [1180, 440]) {
    await setObsidianViewport(page, { width, height: 800 });
    const more = page.locator(width < 520 ? '.tnc-dg--compact .tnc-dg-day.is-today' : '.tnc-dg .tnc-more').first();
    await expect(more).toBeVisible();
    await more.click();
    const popover = page.locator('.tnc-popover');
    await expect(popover.locator('.tnc-item--bar').first()).toBeVisible();
    await expect(popover.locator('.tnc-popover-close')).toBeInViewport();
    const text = popover.locator('.tn-calendar-event-title').first();
    expect(await text.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    await page.evaluate(async ({ folder, width }) => {
      const app = (window as any).app;
      const file = app.vault.getAbstractFileByPath(`${folder}/Deadline-0.md`);
      await app.fileManager.processFrontMatter(file, (frontmatter: any) => {
        frontmatter.title = `${frontmatter.title} refreshed-${width}`;
      });
    }, { folder, width });
    await expect(popover).toContainText(`refreshed-${width}`);
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(`theme-${theme}`);
      }, theme);
      await page.screenshot({ path: testInfo.outputPath(`month-${width}-${theme}.png`) });
    }
    await page.keyboard.press('Escape');
    await expect(more).toBeFocused();
  }
});
