import { test, expect, type Page } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
const folder = `ListRedesign-${Date.now()}`;
const longTag = 'a-tag-with-a-very-long-unbroken-segment-' + 'x'.repeat(90);

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await page.evaluate(async ({ folder, longTag }) => {
    const app = (window as any).app;
    app.plugins.plugins.tasknotes.settings.hideIdentifyingTagsInCards = true;
    await app.vault.createFolder(folder);
    for (let index = 0; index < 6; index++) {
      await app.vault.create(`${folder}/Task ${index}.md`,
        `---\ntags: [task, design, accessibility, ${index === 3 ? longTag : 'release'}]\ncontexts: [studio, phone]\nprojects: [\"[[${folder}/Task 1|Website redesign]]\"]\ntitle: ${index === 3 ? 'Review the redesigned onboarding flow with the accessibility team before the November launch' : ['Prepare launch checklist', 'Website redesign', 'Book a review with the product team', '', 'Publish the updated design tokens', 'Send final handoff notes to engineering'][index]}\nstatus: ${index < 4 ? 'open' : 'done'}\npriority: high\ndue: 2027-02-27${index === 2 ? 'T15:30:00' : ''}\nscheduled: 2027-02-25\n${index % 2 ? 'recurrence: FREQ=DAILY\n' : ''}${index === 2 ? `blockedBy: [\"[[${folder}/Task 0]]\"]\n` : ''}---\n${index % 2 ? 'Task details to make indicator widths differ.' : ''}`);
    }
  }, { folder, longTag });
});

test.afterAll(async () => {
  try {
    if (page && !page.isClosed()) await page.evaluate(async folder => {
      const app = (window as any).app;
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally {
    if (instance) await closeObsidian(instance);
  }
});

for (const theme of ['theme-light', 'theme-dark']) {
  test(`${theme}: aligned dates, chips, group actions and narrow wrapping`, async () => {
    await setObsidianViewport(page, { width: 1180, height: 800 });
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
      document.body.classList.add(theme);
    }, theme);
    const content = stringify({
      filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
      views: [{ type: 'tasknotesTaskList', name: 'List', groupBy: { property: 'status', direction: 'DESC' },
        order: ['status', 'priority', 'projects', 'tags', 'contexts', 'scheduled', 'due'], enableSearch: true }],
    });
    await page.evaluate(async ({ path, content }) => {
      const app = (window as any).app;
      await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
    }, { path: `${folder}/${theme}.base`, content });
    const items = page.locator('.workspace-leaf.mod-active .tn-bases-items-container');
    await expect(items.locator('.task-card')).toHaveCount(6);
    const secretNotice = page.getByText("Don't show again", { exact: true });
    if (await secretNotice.isVisible()) await secretNotice.click();
    await page.screenshot({ path: `test-results/list-redesign-${theme}-before-assertions.png` });
    const dates = items.locator('.task-card__metadata-date--due');
    await expect(dates).toHaveCount(6);
    const positions = await dates.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().x));
    expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(1);
    expect(await dates.evaluateAll(elements => elements.every(element => {
      const text = element.querySelector('.task-card__date-value')!;
      return text.getBoundingClientRect().right <= element.getBoundingClientRect().right;
    }))).toBe(true);
    await expect(items.locator('.task-card__title .task-card__badges').first()).toHaveCount(1);
    const tag = items.locator('.task-card__metadata-property--tags .tag').first();
    expect(await tag.evaluate(element => getComputedStyle(element).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
    await expect(items.locator('.tag').filter({ hasText: '#task' })).toHaveCount(0);
    await expect(items.locator('.tag').filter({ hasText: longTag })).toBeHidden();
    const longTagCard = items.locator(`.task-card[data-task-path="${folder}/Task 3.md"]`);
    await expect(longTagCard.locator('.task-card__metadata-overflow')).toBeVisible();
    expect(await longTagCard.locator('.task-card__metadata-overflow').getAttribute('aria-label')).toContain(longTag);
    await expect(items.locator('.task-group-title').first()).toHaveText('Open');
    for (const [path, toggle, expansion] of [
      ['Task 1', '.task-card__chevron', '.task-card__subtasks'],
      ['Task 0', '.task-card__blocking-toggle', '.task-card__blocking'],
      ['Task 2', '.task-card__blocked-toggle', '.task-card__blocked-by'],
    ]) {
      const card = items.locator(`.task-card[data-task-path="${folder}/${path}.md"]`).first();
      await card.locator(toggle).first().click();
      await expect(card.locator(expansion).first()).toBeVisible();
      if (process.env.TASKNOTES_R7_EVIDENCE) {
        await card.locator(`${expansion} .task-card`).first().hover();
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        await page.screenshot({ path: `${process.env.TASKNOTES_R7_EVIDENCE}/${theme}-1180-${path.replace(' ', '-')}-expanded-hover.png` });
      }
      await card.locator(toggle).first().click();
      await expect(card.locator(expansion)).toHaveCount(0);
    }
    await expect(items.locator('.task-group-glyph[data-tn-glyph]').first()).toBeVisible();
    const group = items.locator('.task-list-group > .task-group').first();
    await group.hover();
    await expect(group.locator('.task-group-add')).toHaveCSS('opacity', '1');
    await group.locator('.task-group-add').click();
    await expect(page.locator('.modal.mod-tasknotes')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(group.locator('.task-group-toggle')).toHaveAttribute('aria-expanded', 'true');
    await group.locator('.task-group-toggle').click();
    await expect(group.locator('.task-group-toggle')).toHaveAttribute('aria-expanded', 'false');
    await group.locator('.task-group-toggle').click();
    await page.screenshot({ path: `test-results/list-redesign-${theme}-wide.png` });
    await page.evaluate(() => (window as any).app.workspace.leftSplit.expand());
    await page.screenshot({ path: `test-results/list-redesign-${theme}-sidebar.png` });
    const toolbar = page.locator('.workspace-leaf.mod-active .bases-toolbar');
    expect(await toolbar.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    const newTask = toolbar.locator('.tn-bases-new-task-btn');
    expect(await newTask.evaluate(element => element.getBoundingClientRect().right - element.closest('.bases-toolbar')!.getBoundingClientRect().right)).toBeLessThanOrEqual(1);
    await page.evaluate(() => (window as any).app.workspace.leftSplit.collapse());
    await setObsidianViewport(page, { width: 600, height: 800 });
    await page.screenshot({ path: `test-results/list-redesign-${theme}-pane.png` });
    await setObsidianViewport(page, { width: 430, height: 800 });
    await page.evaluate(() => {
      document.body.classList.add('is-mobile');
      document.body.style.setProperty('--font-text-size', '20px');
    });
    const longCard = items.locator(`.task-card[data-task-path="${folder}/Task 3.md"]`);
    await longCard.scrollIntoViewIfNeeded();
    await expect(longCard.locator('.task-card__title-text')).toHaveCSS('font-size', '16.25px');
    const longTagElement = longCard.locator('.tag').filter({ hasText: longTag });
    await expect(longTagElement).toHaveCSS('white-space', 'nowrap');
    await expect(longTagElement).toBeHidden();
    await expect(longCard.locator('.task-card__title-text')).toHaveCSS('white-space', 'normal');
    const count = items.locator('.task-list-view__group-header .agenda-view__item-count').first();
    expect(await count.evaluate(element => {
      const label = element.parentElement!.querySelector('.task-group-title')!.getBoundingClientRect();
      const rect = element.getBoundingClientRect();
      return Math.abs((rect.top + rect.bottom) / 2 - (label.top + label.bottom) / 2);
    })).toBeLessThanOrEqual(1);
    await expect.poll(() => items.locator('.task-card__metadata-values').evaluateAll(elements => elements.every(element => Array.from(element.querySelectorAll('.tag, .context-tag, .task-card__project-link')).every(chip => {
      if (!(chip as HTMLElement).offsetParent) return true;
      const bounds = chip.getBoundingClientRect();
      const parent = element.getBoundingClientRect();
      return bounds.left >= parent.left && bounds.right <= parent.right + 1;
    })))).toBe(true);
    await expect(longCard.locator('.task-card__context-menu')).toHaveCSS('opacity', '1');
    await longCard.locator('.task-card__context-menu').focus();
    await expect(longCard.locator('.task-card__context-menu')).toHaveCSS('opacity', '1');
    const hiddenDates = longCard.locator('.task-card__date-slot[hidden]');
    await expect(hiddenDates).toHaveCount(0);
    await expect(longCard.locator('.task-card__date-slot:not([hidden])')).toHaveCount(2);
    const summary = longCard.locator('.task-card__metadata-overflow');
    await expect(summary).toBeVisible();
    await expect(summary).toHaveAttribute('tabindex', '0');
    for (const field of ['scheduled', 'due']) {
      const date = longCard.locator(`.task-card__date-slot--${field}`);
      await expect(date).toBeVisible();
      await expect(date.locator('[aria-label]')).toHaveAttribute('aria-label', new RegExp(`${field}: Feb ${field === 'scheduled' ? '25' : '27'}, 2027`, 'i'));
    }
    expect(await items.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `test-results/list-redesign-${theme}-narrow.png` });
    await items.evaluate(element => (element as HTMLElement).style.width = '170px');
    await expect(longCard.locator('.task-card__metadata')).toBeVisible();
    await expect(longCard.locator('.task-card__title-text')).toHaveCSS('white-space', 'normal');
    await page.screenshot({ path: `test-results/list-redesign-${theme}-170px.png` });
    expect(await items.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    await items.evaluate(element => (element as HTMLElement).style.removeProperty('width'));
    await page.evaluate(() => {
      document.body.classList.remove('is-mobile');
      document.body.style.removeProperty('--font-text-size');
    });
  });
  test(`${theme}: 170px mobile list property grid stays within the pane`, async () => {
    await setObsidianViewport(page, { width: 400, height: 800 });
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme, 'is-mobile');
      document.body.style.setProperty('--font-text-size', '20px');
    }, theme);
    try {
      const content = stringify({
        filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
        views: [{ type: 'tasknotesTaskList', name: 'Narrow list', groupBy: { property: 'status', direction: 'DESC' },
          order: ['status', 'priority', 'projects', 'tags', 'contexts', 'scheduled', 'due'], enableSearch: true }],
      });
      await page.evaluate(async ({ path, content }) => {
        const app = (window as any).app;
        await app.workspace.getLeaf(false).openFile(await app.vault.create(path, content));
        app.workspace.leftSplit.collapse();
        app.workspace.rightSplit.collapse();
      }, { path: `${folder}/${theme}-170px.base`, content });
      const items = page.locator('.workspace-leaf.mod-active .tn-bases-items-container');
      await expect(items.locator('.task-card')).toHaveCount(6);
      await items.evaluate(element => (element as HTMLElement).style.width = '170px');
      const longCard = items.locator(`.task-card[data-task-path="${folder}/Task 3.md"]`);
      await longCard.scrollIntoViewIfNeeded();
      await expect(longCard.locator('.task-card__metadata')).toBeVisible();
      await expect(longCard.locator('.task-card__title-text')).toHaveCSS('white-space', 'normal');
      await expect(items).toHaveCSS('width', '170px');
      await page.screenshot({ path: `test-results/list-redesign-${theme}-170px-focused.png` });
      expect(await items.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      const controls = longCard.locator('.task-card__drag-handle, .task-card__context-menu, .task-card__metadata-overflow');
      await expect(controls).toHaveCount(3);
      const sizes = await controls.evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
      expect(sizes.every(size => size.width >= 40 && size.height >= 40)).toBe(true);
    } finally {
      await page.evaluate(() => {
        document.body.classList.remove('is-mobile');
        document.body.style.removeProperty('--font-text-size');
      });
    }
  });
}

test('shared compact cards and inline task links retain their layout', async () => {
  await setObsidianViewport(page, { width: 1180, height: 800 });
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
    views: [{ type: 'tasknotesKanban', name: 'Compact', cardLayout: 'compact',
      groupBy: { property: 'status', direction: 'ASC' }, order: ['status', 'priority', 'tags', 'due'] }],
  });
  await page.evaluate(async ({ folder, content }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(`${folder}/Compact.base`, content));
  }, { folder, content });
  const compact = page.locator('.workspace-leaf.mod-active .task-card--layout-compact');
  await expect(compact).toHaveCount(6);
  await expect(compact.first().locator('.task-card__title .task-card__badges')).toHaveCount(1);
  expect(await compact.first().evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  for (const theme of ['theme-light', 'theme-dark']) {
    await page.evaluate(theme => {
      document.body.classList.remove('theme-light', 'theme-dark');
      document.body.classList.add(theme);
    }, theme);
    await page.screenshot({ path: `test-results/list-redesign-compact-${theme}.png` });
  }
  await page.evaluate(async folder => {
    const app = (window as any).app;
    const file = await app.vault.create(`${folder}/Inline.md`, `# Inline tasks\n\n[[${folder}/Task 1]]\n\nAfter the task.\n`);
    const leaf = app.workspace.getLeaf(false);
    await leaf.openFile(file);
    await leaf.setViewState({ type: 'markdown', state: { file: file.path, mode: 'source', source: false } });
    leaf.view.editor?.setCursor({ line: 4, ch: 0 });
  }, folder);
  const inline = page.locator('.workspace-leaf.mod-active .task-card--layout-inline');
  await expect(inline).toHaveCount(1);
  await expect(inline.locator('.task-card__title-text')).toHaveText('Website redesign');
  await expect(inline.locator('.task-card__badges')).toHaveCount(0);
  await expect(inline.locator('.task-card__metadata')).toBeVisible();
  await page.screenshot({ path: 'test-results/list-redesign-inline.png' });
});

test('empty lists use the shared empty state and creation action', async () => {
  const content = stringify({
    filters: { and: [`file.inFolder("${folder}/Missing")`, 'file.hasTag("task")'] },
    views: [{ type: 'tasknotesTaskList', name: 'Empty' }],
  });
  await page.evaluate(async ({ folder, content }) => {
    const app = (window as any).app;
    await app.workspace.getLeaf(false).openFile(await app.vault.create(`${folder}/Empty.base`, content));
  }, { folder, content });
  const empty = page.locator('.workspace-leaf.mod-active .tn-empty');
  await expect(empty).toBeVisible();
  await empty.getByRole('button', { name: 'New', exact: true }).click();
  await expect(page.locator('.modal.mod-tasknotes')).toBeVisible();
  await page.keyboard.press('Escape');
});

test('embedded bases, native priority menus and selected timer tasks share atomic metadata', async () => {
  test.setTimeout(90000);
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(async folder => {
    const app = (window as any).app;
    document.body.classList.remove('is-mobile');
    await app.vault.create(`${folder}/Embedded.base`, `filters:\n  and:\n    - file.inFolder("${folder}")\n    - file.hasTag("task")\nviews:\n  - type: tasknotesTaskList\n    name: Embedded\n    order: [status, priority, projects, tags, contexts, scheduled, due]\n`);
    const note = await app.vault.create(`${folder}/Embedded.md`, `# Project review\n\n![[${folder}/Embedded.base]]\n`);
    await app.workspace.getLeaf(false).openFile(note, { state: { mode: 'preview' } });
  }, folder);
  const embedded = page.locator('.internal-embed.bases-embed .task-card');
  await expect(embedded).toHaveCount(6);
  const embeddedOverflow = embedded.filter({ hasText: 'Review the redesigned onboarding' }).locator('.task-card__metadata-overflow');
  for (const theme of ['theme-light', 'theme-dark']) {
    for (const width of [1180, 430]) {
      await setObsidianViewport(page, { width, height: 800 });
      await page.evaluate(({ theme, width }) => {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(theme);
        document.body.classList.toggle('is-mobile', width === 430);
      }, { theme, width });
      await expect(embeddedOverflow).toBeVisible();
      const hiddenValues = (await embeddedOverflow.getAttribute('aria-label'))!.split(' · ');
      expect(hiddenValues).toContainEqual(expect.stringContaining(longTag));
      await embeddedOverflow.focus();
      await page.keyboard.press('Enter');
      const overflowDialog = page.getByRole('dialog').filter({ has: page.locator('.tn-picker__list') });
      await expect(overflowDialog).toBeVisible();
      await expect(overflowDialog.locator('.tn-picker__row')).toHaveText(hiddenValues);
      await page.keyboard.press('Escape');
      await expect(overflowDialog).toHaveCount(0);
      await expect(embeddedOverflow).toHaveAttribute('aria-expanded', 'false');
      await expect.poll(() => embeddedOverflow.evaluate(element => element.ownerDocument.activeElement === element.closest('.bases-view .tasknotes-plugin[tabindex]'))).toBe(true);
      await page.screenshot({ path: `test-results/list-redesign-embedded-${theme}-${width}.png` });
    }
  }
  await setObsidianViewport(page, { width: 1180, height: 800 });
  await page.evaluate(() => document.body.classList.remove('is-mobile'));
  await embedded.first().locator('.task-card__context-menu').click();
  await page.locator('.menu-item').filter({ has: page.locator('.menu-item-title', { hasText: /^Priority$/ }) }).hover();
  await expect(page.locator('.menu-item-icon[data-tn-glyph="bars"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'test-results/list-redesign-embedded.png' });
  await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    plugin.settings.defaultVisibleProperties = ['status', 'priority', 'projects', 'tags', 'contexts', 'scheduled', 'due'];
    const leaf = app.workspace.getLeaf(false);
    await leaf.setViewState({ type: 'tasknotes-pomodoro-view', active: true });
    app.workspace.setActiveLeaf(leaf, { focus: true });
    await leaf.view.selectTask(await plugin.cacheManager.getTaskByPath(`${folder}/Task 3.md`));
  }, folder);
  const timerCard = page.locator('.pomodoro-view__task-card-container .task-card');
  await expect(timerCard).toHaveCount(1);
  for (const theme of ['theme-light', 'theme-dark']) {
    for (const width of [1180, 430]) {
      await setObsidianViewport(page, { width, height: 800 });
      await page.evaluate(({ theme, width }) => {
        document.body.classList.remove('theme-light', 'theme-dark');
        document.body.classList.add(theme);
        document.body.classList.toggle('is-mobile', width === 430);
      }, { theme, width });
      for (const field of ['due', 'scheduled']) {
        const date = timerCard.locator(`.task-card__date-slot--${field}`);
        await expect(async () => {
          if (!await date.evaluate(element => element.hidden)) {
            expect(await date.isVisible()).toBe(true);
          } else {
            const summary = timerCard.locator('.task-card__metadata-overflow');
            expect(await summary.isVisible()).toBe(true);
            expect(await summary.getAttribute('tabindex')).toBe('0');
            expect(await summary.getAttribute('aria-label')).toContain(await date.locator('[aria-label]').getAttribute('aria-label'));
          }
        }).toPass({ timeout: 5000 });
      }
      await expect(timerCard.locator('.task-card__date-slot:not([hidden])')).not.toHaveCount(0);
      await expect.poll(() => timerCard.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `test-results/list-redesign-timer-${theme}-${width}.png` });
    }
  }
});
