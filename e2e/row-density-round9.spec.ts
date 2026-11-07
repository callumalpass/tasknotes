import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport } from './obsidian';

const output = process.env.TASKNOTES_R9_EVIDENCE ?? '/tmp/tasknotes-r9-rows';
const folder = `RowDensity-${Date.now()}`;

test('list density follows pane width without hover jumps or lost date meaning', async () => {
  test.setTimeout(240000);
  mkdirSync(output, { recursive: true });
  const instance = await launchObsidian();
  const page = instance.page;
  const measurements: unknown[] = [];
  const settings = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).app.plugins.plugins.tasknotes.settings)));
  try {
    await page.evaluate(async ({ folder, base }) => {
      const app = (window as any).app;
      app.plugins.plugins.tasknotes.settings.hideIdentifyingTagsInCards = false;
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
      await app.vault.createFolder(folder);
      for (let index = 0; index < 24; index++) {
        const title = index === 2 ? 'Review the accessibility handover with the research and operations teams before the next release' : `Review research summary ${index + 1}`;
        const status = index === 3 ? 'custom-unconfigured' : 'open';
        await app.vault.create(`${folder}/${String(index).padStart(2, '0')}.md`, `---\ntitle: ${title}\ntags: [task, research, release]\nstatus: ${status}\npriority: high\nscheduled: 2026-11-07\ndue: 2026-11-09\ncontexts: [studio, focus, review]\ntimeEstimate: 45\n---\n\nNotes for this task.`);
      }
      await app.workspace.getLeaf(false).openFile(await app.vault.create(`${folder}/List.base`, base));
    }, { folder, base: stringify({ filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] }, views: [{ type: 'tasknotesTaskList', name: 'Rows', order: ['status', 'priority', 'scheduled', 'due', 'tags', 'contexts', 'timeEstimate'], sort: [{ column: 'file.name', direction: 'ASC' }] }] }) });
    const cards = page.locator('.workspace-leaf.mod-active .tn-tasknotesTaskList .task-card');
    await expect(cards.first()).toBeVisible();
    for (const width of [1180, 960, 820, 700, 430, 400, 390]) {
      for (const theme of ['light', 'dark']) {
        await setObsidianViewport(page, { width, height: 800 });
        await page.evaluate(({ theme, width }) => {
          document.body.classList.toggle('theme-light', theme === 'light');
          document.body.classList.toggle('theme-dark', theme === 'dark');
          document.body.classList.toggle('is-mobile', width <= 430);
          document.querySelector('.tn-tasknotesTaskList')?.scrollTo(0, 0);
        }, { theme, width });
        await page.mouse.move(1, 1);
        await expect.poll(() => cards.first().locator('.task-card__metadata').evaluate(element => element.clientWidth)).toBeGreaterThan(0);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const geometry = await cards.evaluateAll(elements => elements.map(card => {
          const bounds = card.getBoundingClientRect();
          const title = card.querySelector<HTMLElement>('.task-card__title-text')!.getBoundingClientRect();
          const metadata = card.querySelector<HTMLElement>('.task-card__metadata')!.getBoundingClientRect();
          const dates = [...card.querySelectorAll<HTMLElement>('.task-card__date-slot')].map(slot => ({ x: slot.getBoundingClientRect().x, width: slot.getBoundingClientRect().width, hidden: slot.hidden, label: slot.firstElementChild?.getAttribute('aria-label') }));
          return { height: bounds.height, width: bounds.width, right: bounds.right, top: bounds.top, bottom: bounds.bottom, title: { x: title.x, y: title.y, height: title.height }, metadata: { x: metadata.x, y: metadata.y }, dates };
        }));
        const screen = await page.locator('.tn-bases-items-container').boundingBox();
        const visible = geometry.filter(row => row.top >= screen!.y && row.bottom <= Math.min(800, screen!.y + screen!.height)).length;
        measurements.push({ width, theme, mobileEmulated: width <= 430, visible, geometry });
        if (width >= 960) {
          expect(geometry.every(row => row.height === 40)).toBe(true);
          expect(visible).toBeGreaterThanOrEqual(16);
          expect(Math.abs(geometry[0].title.y - geometry[0].metadata.y)).toBeLessThan(4);
          for (const row of geometry) {
            expect(row.dates.every(date => !date.hidden && date.x >= row.metadata.x && date.x + date.width <= row.right)).toBe(true);
            expect(row.dates.map(date => date.x)).toEqual(geometry[0].dates.map(date => date.x));
          }
        } else if (width <= 430) {
          expect(geometry[0].height).toBeLessThanOrEqual(73);
          expect(visible).toBeGreaterThanOrEqual(8);
          expect(geometry[0].metadata.x).toBe(geometry[0].title.x);
          expect(geometry[2].title.height).toBeGreaterThan(geometry[0].title.height);
          await expect(cards.first().locator('.task-card__context-menu')).toHaveCSS('opacity', '0');
        } else {
          expect(geometry[0].height).toBe(58);
          expect(geometry[0].metadata.y).toBeGreaterThan(geometry[0].title.y);
        }
        expect(geometry[0].dates[0].label).toMatch(/^Scheduled:/);
        expect(geometry[0].dates[1].label).toMatch(/^Due:/);
        const before = await cards.first().boundingBox();
        await cards.first().locator('.task-card__title-text').hover();
        expect(await cards.first().boundingBox()).toEqual(before);
        await page.mouse.move(1, 1);
        await page.locator('.notice-container .notice').filter({ hasText: 'Secrets are stored without encryption' }).evaluateAll(notices => notices.forEach(notice => notice.remove()));
        await page.screenshot({ path: `${output}/${width}-${theme}.png` });
      }
    }
    await setObsidianViewport(page, { width: 1180, height: 800 });
    await page.evaluate(() => document.body.classList.remove('is-mobile'));
    const root = page.locator('.workspace-leaf.mod-active .tn-tasknotesTaskList');
    await root.evaluate(element => { element.style.width = '700px'; });
    await expect.poll(() => cards.first().evaluate(element => element.getBoundingClientRect().height)).toBe(58);
    await root.evaluate(element => { element.style.removeProperty('width'); });
    await expect.poll(() => cards.first().evaluate(element => element.getBoundingClientRect().height)).toBe(40);
    await page.evaluate(async folder => {
      const app = (window as any).app;
      await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(`${folder}/01.md`), (frontmatter: any) => { delete frontmatter.scheduled; });
    }, folder);
    const second = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${folder}/01.md"]`);
    await expect(second.locator('.task-card__date-slot--scheduled')).toBeEmpty();
    expect((await second.locator('.task-card__date-slot--due').boundingBox())!.x).toBe((await cards.first().locator('.task-card__date-slot--due').boundingBox())!.x);
    const status = cards.first().locator('.task-card__status-dot');
    const original = await cards.first().getAttribute('data-status');
    await status.click();
    await expect(cards.first()).not.toHaveAttribute('data-status', original!);
    await expect(page.locator('.tn-toast')).toHaveCount(1);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(cards.first()).toHaveAttribute('data-status', original!);

    await setObsidianViewport(page, { width: 400, height: 800 });
    await page.evaluate(async folder => {
      document.body.classList.add('is-mobile');
      const app = (window as any).app;
      const base = await app.vault.read(app.vault.getAbstractFileByPath(`${folder}/List.base`));
      await app.workspace.getLeaf(false).openFile(await app.vault.create(`${folder}/Touch.base`, base));
    }, folder);
    await expect(cards.first()).toBeVisible();
    const touch = await page.context().newCDPSession(page);
    await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    try {
      const title = (await cards.first().locator('.task-card__title-text').boundingBox())!;
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: title.x + 20, y: title.y + title.height / 2 }] });
      await expect(page.locator('.menu')).toBeVisible();
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect(page.locator('.menu')).toBeVisible();
      await page.screenshot({ path: `${output}/400-long-press.png` });
      await page.keyboard.press('Escape');
      const handle = cards.first().locator('.task-card__drag-handle');
      try {
        await expect(handle).toHaveCSS('opacity', '1');
      } catch (error) {
        writeFileSync(`${output}/focus-failure.json`, JSON.stringify(await page.evaluate(() => ({
          active: document.activeElement?.outerHTML.slice(0, 500),
          menus: [...document.querySelectorAll<HTMLElement>('.menu')].map(menu => ({ html: menu.outerHTML.slice(0, 500), visible: menu.checkVisibility(), opacity: getComputedStyle(menu).opacity })),
          row: document.querySelector('.workspace-leaf.mod-active .task-card')?.outerHTML.slice(0, 500),
          notices: [...document.querySelectorAll('.notice')].map(notice => notice.textContent),
        })), null, 2));
        throw error;
      }
      await expect(cards.first().locator('.task-card__context-menu')).toHaveCSS('opacity', '1');
      await cards.first().locator('.task-card__context-menu').click();
      await expect(page.locator('.menu')).toBeVisible();
      await page.keyboard.press('Escape');
      await cards.first().locator('.task-card__status-dot').focus();
      const targets = await cards.first().evaluate(card => [...card.querySelectorAll<HTMLElement>('.task-card__status-dot, .task-card__priority-dot, .task-card__metadata-date, .task-card__metadata-overflow, .task-card__context-menu, .task-card__drag-handle')]
        .filter(element => element.checkVisibility() && getComputedStyle(element).opacity !== '0')
        .map(element => ({ name: element.className, ...element.getBoundingClientRect().toJSON() })));
      for (const [index, target] of targets.entries()) {
        expect(target.width, target.name).toBeGreaterThanOrEqual(40);
        expect(target.height, target.name).toBeGreaterThanOrEqual(40);
        for (const other of targets.slice(index + 1)) {
          expect(target.right <= other.left || other.right <= target.left || target.bottom <= other.top || other.bottom <= target.top, `${target.name} overlaps ${other.name}`).toBe(true);
        }
      }
      const bounds = (await handle.boundingBox())!;
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
      await expect(page.locator('.task-list-view__touch-ghost')).toBeVisible();
      await page.screenshot({ path: `${output}/400-handle-drag.png` });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await expect(page.locator('.task-list-view__touch-ghost')).toHaveCount(0);
    } finally {
      await touch.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      await touch.detach();
    }

    await page.evaluate(async folder => {
      const app = (window as any).app;
      app.plugins.plugins.tasknotes.settings.showExpandableSubtasks = true;
      document.body.classList.remove('is-mobile');
      await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(`${folder}/01.md`), (frontmatter: any) => { frontmatter.projects = [`[[${folder}/00]]`]; });
    }, folder);
    await expect.poll(() => page.evaluate(folder => (window as any).app.plugins.plugins.tasknotes.projectSubtasksService.isTaskUsedAsProjectSync(`${folder}/00.md`), folder)).toBe(true);
    await page.evaluate(async folder => {
      const app = (window as any).app;
      const base = await app.vault.read(app.vault.getAbstractFileByPath(`${folder}/List.base`));
      await app.workspace.getLeaf(false).openFile(await app.vault.create(`${folder}/Subtasks.base`, base));
    }, folder);
    const parent = page.locator(`.workspace-leaf.mod-active .task-card[data-task-path="${folder}/00.md"]`);
    await parent.locator('.task-card__chevron').click();
    const subtask = parent.locator('.task-card--subtask').first();
    await expect(subtask).toBeVisible();
    for (const width of [1180, 400]) for (const theme of ['light', 'dark']) {
      await setObsidianViewport(page, { width, height: 800 });
      await page.evaluate(({ width, theme }) => {
        document.body.classList.toggle('is-mobile', width === 400);
        document.body.classList.toggle('theme-light', theme === 'light');
        document.body.classList.toggle('theme-dark', theme === 'dark');
      }, { width, theme });
      await expect(subtask.locator('.task-card__title-text')).toBeVisible();
      await expect(subtask.locator('.task-card__metadata-date--due')).toBeVisible();
      await page.screenshot({ path: `${output}/subtasks-${width}-${theme}.png` });
    }
    await page.evaluate(async folder => {
      const app = (window as any).app;
      const file = await app.vault.create(`${folder}/Embedded.md`, `# Embedded task list\n\n![[${folder}/List.base]]\n`);
      const leaf = app.workspace.getLeaf(false);
      await leaf.openFile(file);
      await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'preview' } });
    }, folder);
    const embedded = page.locator('.workspace-leaf.mod-active .internal-embed .tn-tasknotesTaskList .task-card').first();
    await expect(embedded).toBeVisible();
    for (const width of [1180, 400]) for (const theme of ['light', 'dark']) {
      await setObsidianViewport(page, { width, height: 800 });
      await page.evaluate(({ width, theme }) => {
        document.body.classList.toggle('is-mobile', width === 400);
        document.body.classList.toggle('theme-light', theme === 'light');
        document.body.classList.toggle('theme-dark', theme === 'dark');
      }, { width, theme });
      await expect(embedded.locator('.task-card__title-text').first()).toBeVisible();
      await expect(embedded.locator('.task-card__metadata-date--due').first()).toBeVisible();
      await page.screenshot({ path: `${output}/embedded-${width}-${theme}.png` });
    }
  } finally {
    writeFileSync(`${output}/geometry.json`, JSON.stringify(measurements, null, 2));
    try {
      await page.evaluate(async ({ folder, settings }) => {
        const app = (window as any).app;
        for (const leaf of [...app.workspace.getLeavesOfType('bases'), ...app.workspace.getLeavesOfType('markdown')]) if (leaf.view.file?.path.startsWith(folder)) leaf.detach();
        const directory = app.vault.getAbstractFileByPath(folder);
        if (directory) await app.vault.delete(directory, true);
        Object.assign(app.plugins.plugins.tasknotes.settings, settings);
        await app.plugins.plugins.tasknotes.saveSettings();
      }, { folder, settings });
    } finally {
      await closeObsidian(instance);
    }
  }
});
