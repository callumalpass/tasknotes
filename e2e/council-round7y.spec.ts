import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, setObsidianViewport, openTaskNotesSettings, closeObsidianSettings } from './obsidian';

const phase = process.env.TASKNOTES_R7_PHASE ?? 'after';
const evidence = `/tmp/tasknotes-r7/y/${phase}`;
const folder = `CouncilY-${Date.now()}`;

test('council findings retain task controls, focus and coherent secondary surfaces', async () => {
  test.setTimeout(240000);
  mkdirSync(evidence, { recursive: true });
  const instance = await launchObsidian();
  const page = instance.page;
  page.setDefaultTimeout(10000);
  const observations: Record<string, unknown> = {};
  const capture = async (name: string, target: Page = page) => {
    await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const viewport = target.viewportSize()!;
    await target.screenshot({ path: `${evidence}/${name}.png`, clip: { x: 0, y: 0, width: viewport.width, height: viewport.height } });
  };
  const open = async (name: string) => {
    await page.evaluate(async ({ folder, name }) => {
      const app = (window as any).app;
      await app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(`${folder}/${name}`));
    }, { folder, name });
  };
  try {
    await page.evaluate(async ({ folder, board, list }) => {
      const app = (window as any).app;
      const plugin = app.plugins.plugins.tasknotes;
      plugin.settings.taskIdentificationMethod = 'tag';
      plugin.settings.taskTag = 'task';
      plugin.settings.enableModalSplitLayout = true;
      plugin.settings.customStatuses = [ ['open', 'Planned'], ['in-progress', 'In progress'], ['review', 'In review'] ].map(([value, label], order) => ({ id: value, value, label, order, color: 'var(--text-muted)', isCompleted: false }));
      plugin.statusManager.updateStatuses(plugin.settings.customStatuses);
      app.workspace.leftSplit.collapse();
      app.workspace.rightSplit.collapse();
      await app.vault.createFolder(folder);
      await app.vault.create(`${folder}/Project.md`, '# Design delivery');
      for (let index = 0; index < 4; index++) {
        await app.vault.create(`${folder}/${index}.md`, `---\ntags: [task, design, review, release]\ntitle: ${index === 0 ? 'Prepare a detailed launch checklist with accessibility, documentation, localization and final delivery checks for every supported workflow' : `Review delivery ${index}`}\nstatus: ${index === 3 ? 'review' : 'open'}\npriority: high\nscheduled: 2026-11-06\ndue: 2026-11-09\ncontexts: [studio, focus]\nprojects: ["[[${folder}/Project]]"]\n${index === 0 ? 'recurrence: "DTSTART:20261106T090000\\nRRULE:FREQ=DAILY"\n' : ''}timeEstimate: 60\ntimeEntries:\n  - startTime: '2026-11-06T00:00:00Z'\n    endTime: '2026-11-06T01:00:00Z'\n---\nSupporting details stay accessible.\n`);
      }
      await app.vault.create(`${folder}/Board.base`, board);
      await app.vault.create(`${folder}/List.base`, list);
      await app.vault.create(`${folder}/Prose.md`, `# Delivery notes\n\nCheck [[${folder}/0]], then ship.\n\n[[${folder}/1]]\n`);
    }, { folder, board: stringify({ filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] }, views: [{ type: 'tasknotesKanban', name: 'Delivery', groupBy: { property: 'status', direction: 'ASC' }, columnWidth: 300, hideEmptyColumns: false, order: ['status', 'priority', 'scheduled', 'due', 'projects', 'contexts', 'file.tags'] }] }), list: stringify({ filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] }, views: [{ type: 'tasknotesTaskList', name: 'Delivery', groupBy: { property: 'status', direction: 'ASC' }, order: ['status', 'priority', 'scheduled', 'due', 'projects', 'contexts', 'file.tags'], enableSearch: true }] }) });
    await expect.poll(() => page.evaluate(async folder => !!await (window as any).app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(`${folder}/0.md`), folder)).toBe(true);
    const warning = page.locator('.notice').filter({ hasText: 'Secrets are stored without encryption' });
    if (await warning.isVisible()) await warning.getByText("Don't show again", { exact: true }).click();
    for (const theme of ['light', 'dark']) {
      for (const width of [1180, 400]) {
        await setObsidianViewport(page, { width, height: 800 });
        await page.evaluate(({ theme, width }) => {
          document.body.classList.remove('theme-light', 'theme-dark', 'is-mobile');
          document.body.classList.add(`theme-${theme}`);
          document.body.classList.toggle('is-mobile', width === 400);
        }, { theme, width });
        const variant = `${theme}-${width}`;
        await open('Board.base');
        const card = page.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/0.md"]`);
        await expect(card).toBeVisible();
        await capture(`board-${variant}-rest`);
        await card.hover();
        await capture(`board-${variant}-hover`);
        observations[`board-${variant}`] = await card.evaluate(element => {
          const title = element.querySelector<HTMLElement>('.task-card__title-text')!;
          return { title: title.getBoundingClientRect().toJSON(), lineHeight: getComputedStyle(title).lineHeight, clamp: getComputedStyle(title).webkitLineClamp, metadata: element.querySelector('.task-card__metadata')?.getBoundingClientRect().toJSON(), overflow: [...element.querySelectorAll('.task-card__metadata-overflow')].map(item => ({ text: item.textContent, hidden: (item as HTMLElement).hidden })) };
        });
        if (phase !== 'before') {
          const geometry = observations[`board-${variant}`] as any;
          expect(geometry.title.height).toBeLessThanOrEqual(parseFloat(geometry.lineHeight) * 2 + 1);
          expect(geometry.overflow.filter((item: any) => !item.hidden && item.text === '+0')).toEqual([]);
        }
        if (width === 1180 && theme === 'light') {
          const moved = page.locator(`.kanban-view__card-wrapper[data-task-path="${folder}/1.md"]`);
          const rail = page.locator('.kanban-view__column[data-group="in-progress"]');
          const dropOnRail = async () => {
            const start = (await moved.boundingBox())!;
            const end = (await rail.boundingBox())!;
            await page.mouse.move(start.x + 110, start.y + 18);
            await page.mouse.down();
            await page.mouse.move(start.x + 130, start.y + 18, { steps: 6 });
            await page.mouse.move(end.x + end.width / 2, end.y + 75, { steps: 8 });
            await capture(`board-${variant}-collapsed-target`);
            await page.mouse.up();
            await page.waitForTimeout(750);
          };
          await page.evaluate(folder => {
            const app = (window as any).app;
            (window as any).councilYOriginalWrite = app.fileManager.processFrontMatter;
            app.fileManager.processFrontMatter = async (file: any, ...args: any[]) => {
              if (file.path === `${folder}/1.md`) throw new Error('Council write failure fixture');
              return (window as any).councilYOriginalWrite.call(app.fileManager, file, ...args);
            };
          }, folder);
          try {
            await dropOnRail();
            observations['failed-drop'] = await page.locator('.tn-toast').allTextContents();
          if (phase !== 'before') {
            expect(String(observations['failed-drop'])).toContain('Review delivery 1');
            expect(String(observations['failed-drop'])).not.toMatch(/· 0/);
          }
            await capture(`board-${variant}-failed-drop`);
          } finally {
            await page.evaluate(() => { (window as any).app.fileManager.processFrontMatter = (window as any).councilYOriginalWrite; });
          }
          await dropOnRail();
          observations['settled-overflow'] = await page.locator('.task-card__metadata-overflow:visible').allTextContents();
          if (phase !== 'before') expect(observations['settled-overflow']).not.toContain('+0');
          await capture(`board-${variant}-settled-drop`);
          await page.evaluate(async folder => { const app = (window as any).app; await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(`${folder}/1.md`), (frontmatter: any) => { frontmatter.status = 'open'; }); }, folder);
        }
        await open('List.base');
        const toggle = page.locator('.task-group-toggle').first();
        await expect(toggle).toBeVisible();
        const group = await toggle.evaluate(element => element.closest<HTMLElement>('[data-group-key]')!.dataset.groupKey);
        await toggle.focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        observations[`group-focus-${variant}`] = await page.evaluate(() => ({ tag: document.activeElement?.tagName, className: document.activeElement?.className }));
        await capture(`list-${variant}-collapsed-focus`);
        if (phase !== 'before') await expect(page.locator(`[data-group-key="${group}"] .task-group-toggle`)).toBeFocused();
        await page.keyboard.press('Enter');
        const restoredToggle = page.locator(`[data-group-key="${group}"] .task-group-toggle`).first();
        if (phase === 'before' && await restoredToggle.getAttribute('aria-expanded') === 'false') await restoredToggle.click();
        if (phase !== 'before') await expect(restoredToggle).toHaveAttribute('aria-expanded', 'true');
        await capture(`list-${variant}-rest`);
        const contrast = await page.locator('.tn-search-box__input').first().evaluate(input => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const context = canvas.getContext('2d')!;
          context.fillStyle = getComputedStyle(document.body).getPropertyValue('--background-primary');
          context.fillRect(0, 0, 1, 1);
          const ancestors: Element[] = [];
          for (let element: Element | null = input; element; element = element.parentElement) ancestors.unshift(element);
          for (const element of ancestors) {
            context.fillStyle = getComputedStyle(element).backgroundColor;
            context.fillRect(0, 0, 1, 1);
          }
          const luminance = (pixel: Uint8ClampedArray) => [...pixel].slice(0, 3).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
          const background = luminance(context.getImageData(0, 0, 1, 1).data);
          const placeholder = getComputedStyle(input, '::placeholder');
          context.fillStyle = placeholder.color;
          context.globalAlpha = Number(placeholder.opacity);
          context.fillRect(0, 0, 1, 1);
          const foreground = luminance(context.getImageData(0, 0, 1, 1).data);
          return { color: placeholder.color, ratio: (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05) };
        });
        observations[`placeholder-${variant}`] = contrast;
        if (phase !== 'before') expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);
        if (width === 1180) {
          const source = page.locator(`.task-card[data-task-path="${folder}/1.md"]`).first();
          const target = page.locator('.task-group[data-group-key="review"]');
          if (await source.isVisible() && await target.isVisible()) {
            await expect.poll(async () => {
              const initial = await source.boundingBox();
              await page.waitForTimeout(200);
              return JSON.stringify(await source.boundingBox()) === JSON.stringify(initial);
            }).toBe(true);
            const start = (await source.boundingBox())!;
            await page.mouse.move(start.x + 150, start.y + 15);
            await page.mouse.down();
            await page.mouse.move(start.x + 170, start.y + 15, { steps: 5 });
            await expect(page.locator('.task-list-view__touch-ghost')).toBeVisible();
            const end = (await target.boundingBox())!;
            await page.mouse.move(end.x + 150, end.y + 15, { steps: 8 });
            if (phase !== 'before') await expect(page.locator('.task-list-view__movement-feedback')).toContainText('In review');
            await capture(`list-${variant}-drag-target`);
            observations[`drag-${variant}`] = await page.locator('.task-list-view__movement-feedback').allTextContents();
            if (phase !== 'before') {
              expect(String(observations[`drag-${variant}`])).toContain('In review');
              await expect(page.locator('.task-card.task-list-view__move-target')).toHaveCount(0);
            }
            await page.keyboard.press('Escape');
            await page.mouse.up();
          }
        }
        await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal());
        await expect(page.locator('.nl-input-container')).toBeVisible();
        observations[`title-${variant}`] = await page.locator('.nl-input-container').evaluate(element => [...element.querySelectorAll('[role="textbox"]')].map(item => ({ label: item.getAttribute('aria-label'), className: item.className })));
        if (phase !== 'before') expect(observations[`title-${variant}`]).toEqual([{ label: 'Title', className: 'cm-content cm-lineWrapping' }]);
        await capture(`create-${variant}-compact`);
        const modalWidth = await page.locator('.modal.mod-tasknotes').evaluate(element => element.getBoundingClientRect().width);
        await page.locator('.tn-task-modal__details-toggle').click();
        await page.waitForTimeout(200);
        observations[`modal-width-${variant}`] = { before: modalWidth, after: await page.locator('.modal.mod-tasknotes').evaluate(element => element.getBoundingClientRect().width) };
        if (phase !== 'before') expect((observations[`modal-width-${variant}`] as any).after).toBe(modalWidth);
        await capture(`create-${variant}-expanded`);
        await page.keyboard.press('Escape');
        await page.evaluate(async () => { await (window as any).app.workspace.getLeaf(false).setViewState({ type: 'tasknotes-pomodoro-view', active: true }); });
        await page.locator('.pomodoro-view__task-select-button:visible').first().click();
        await expect(page.locator('.task-selector-with-create-modal .suggestion-item').first()).toBeVisible();
        await page.locator('.task-selector-with-create-modal .suggestion-item').nth(1).hover();
        await page.keyboard.press('ArrowDown');
        await capture(`selector-${variant}-pointer-keyboard`);
        observations[`selector-${variant}`] = await page.locator('.task-selector-with-create-modal .suggestion-item').evaluateAll(elements => elements.filter(element => element.classList.contains('is-selected') || element.matches(':hover')).map(element => ({ selected: element.classList.contains('is-selected'), hover: element.matches(':hover'), background: getComputedStyle(element).backgroundColor })));
        if (phase !== 'before') {
          await expect(page.locator('.task-selector-with-create-modal .suggestion-item.is-selected')).toHaveCount(1);
          const backgrounds = await page.locator('.task-selector-with-create-modal .suggestion-item:hover:not(.is-selected), .task-selector-with-create-modal .task-card').evaluateAll(elements => elements.map(element => {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 1;
            const context = canvas.getContext('2d')!;
            context.fillStyle = getComputedStyle(element).backgroundColor;
            context.fillRect(0, 0, 1, 1);
            return { className: element.className, color: context.fillStyle, alpha: context.getImageData(0, 0, 1, 1).data[3] };
          }));
          observations[`selector-backgrounds-${variant}`] = backgrounds;
          expect(backgrounds.filter(background => background.alpha > 0)).toEqual([]);
        }
        await page.keyboard.press('Escape');
        await page.evaluate(async () => { await (window as any).app.workspace.getLeaf(false).setViewState({ type: 'tasknotes-stats-view', active: true }); });
        await expect(page.locator('.stats-view:visible').first()).toBeVisible();
        await capture(`stats-${variant}`);
        await open('Prose.md');
        await page.evaluate(async () => { await (window as any).app.workspace.getLeaf(false).setViewState({ type: 'markdown', state: { mode: 'preview', file: (window as any).app.workspace.getActiveFile()?.path } }); });
        await capture(`references-${variant}`);
        await expect(page.locator('.markdown-preview-view:visible').first()).toContainText(', then ship.');
      }
    }
    if (phase !== 'before') {
      await setObsidianViewport(page, { width: 1280, height: 800 });
      await page.evaluate(() => document.body.classList.remove('is-mobile'));
      const taskCount = await page.evaluate(() => (window as any).app.vault.getMarkdownFiles().length);
      await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.openTaskCreationModal());
      await page.locator('.nl-input-container [role="textbox"]').fill('Draft composer width check');
      const details = page.locator('.tn-task-modal__markdown-editor--details [contenteditable="true"]');
      await details.fill('Supporting details remain readable when both columns are populated.');
      const compactWidth = await page.locator('.modal.mod-tasknotes').evaluate(element => element.getBoundingClientRect().width);
      await page.locator('.tn-task-modal__details-toggle').click();
      const expanded = page.locator('.modal.mod-tasknotes');
      await expect(expanded).toHaveClass(/mod-tasknotes/);
      await expect.poll(() => expanded.evaluate(element => element.getBoundingClientRect().width)).toBe(compactWidth);
      expect(await page.locator('.modal-split-right').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(280);
      await capture('create-dark-1280-populated-expanded');
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
      await expect(page.locator('.modal.mod-tasknotes')).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).app.vault.getMarkdownFiles().length)).toBe(taskCount);
    }
    await setObsidianViewport(page, { width: 1180, height: 800 });
    await page.evaluate(() => document.body.classList.remove('is-mobile'));
    const settingsPage = await openTaskNotesSettings(page, 'Task properties');
    try {
      const statusCard = settingsPage.locator('[data-card-id="property-status"]');
      if (await statusCard.evaluate(element => element.classList.contains('tasknotes-settings__card--collapsed'))) {
        await statusCard.locator('.tasknotes-settings__card-header').first().click();
      }
      for (const theme of ['light', 'dark']) {
        for (const width of [1180, 400]) {
          await setObsidianViewport(settingsPage, { width, height: 800 });
          for (const target of [page, settingsPage]) {
            await target.evaluate(theme => { document.body.classList.remove('theme-light', 'theme-dark'); document.body.classList.add(`theme-${theme}`); }, theme);
          }
          await expect(settingsPage.locator('body')).toHaveClass(new RegExp(`theme-${theme}`));
          observations[`settings-theme-${theme}-${width}`] = await settingsPage.locator('body').evaluate(element => ({ className: element.className, background: getComputedStyle(element).backgroundColor }));
          await statusCard.scrollIntoViewIfNeeded();
          await capture(`settings-${theme}-${width}`, settingsPage);
          if (phase !== 'before') {
            const disclosure = statusCard.locator('.tasknotes-settings__field-help').first();
            await disclosure.scrollIntoViewIfNeeded();
            await expect(disclosure.locator('summary')).toBeVisible();
            await disclosure.locator('summary').focus();
            await expect(disclosure.locator('summary')).toBeFocused();
            await settingsPage.keyboard.press('Enter');
            await expect(disclosure).toHaveAttribute('open', '');
            await capture(`settings-${theme}-${width}-expanded`, settingsPage);
            await settingsPage.keyboard.press('Enter');
            await expect(disclosure).not.toHaveAttribute('open', '');
            const valuesHelp = statusCard.locator('.tasknotes-settings__field-help').nth(1);
            await valuesHelp.locator('summary').scrollIntoViewIfNeeded();
            await valuesHelp.locator('summary').focus();
            await expect(valuesHelp.locator('summary')).toBeFocused();
            await settingsPage.keyboard.press('Enter');
            await expect(valuesHelp).toHaveAttribute('open', '');
            await capture(`settings-${theme}-${width}-values-help`, settingsPage);
            await settingsPage.keyboard.press('Enter');
            await expect(valuesHelp).not.toHaveAttribute('open', '');
          }
        }
      }
    } finally { await closeObsidianSettings(page, settingsPage); }
  } finally {
    writeFileSync(`${evidence}/observations.json`, JSON.stringify(observations, null, 2));
    await closeObsidian(instance);
  }
});
