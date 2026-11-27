import { expect, test } from '@playwright/test';
import { closeObsidian, dismissObsidianModals, launchObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

let obsidian: ObsidianApp;

test.beforeAll(async () => {
  obsidian = await launchObsidian();
  const { page } = obsidian;
  await setObsidianViewport(page, { width: 1100, height: 800 });
  // Media DB 0.9.1 ships this rule without a plugin scope.
  await page.addStyleTag({ content: '.icon { position: absolute; width: 20px; height: 20px; top: calc(50% - 10px); }' });
});

test.afterEach(async () => {
  if (obsidian) await dismissObsidianModals(obsidian.page);
});

test.afterAll(async () => {
  if (obsidian) await closeObsidian(obsidian);
});

for (const mode of ['create', 'edit'] as const) {
  test(`${mode} modal icons stay inside their chips with the Media DB CSS rule`, async () => {
    const { page } = obsidian;
    await page.evaluate(async mode => {
      const plugin = (window as any).app.plugins.plugins.tasknotes;
      if (mode === 'create') {
        plugin.openTaskCreationModal();
      } else {
        const task = await plugin.cacheManager.getTaskInfo('TaskNotes/Fix login bug.md');
        if (!task) throw new Error('Task fixture is missing');
        plugin.openTaskEditModal(task);
      }
    }, mode);
    const modal = page.locator('.modal.mod-tasknotes');
    const toggle = modal.getByRole('button', { name: 'More fields', exact: true });
    await expect(toggle).toBeVisible();
    const chips = modal.locator('.tn-task-modal__action-bar > .tn-chip--property:visible');

    for (const expanded of ['false', 'true']) {
      if (await toggle.getAttribute('aria-expanded') !== expanded) await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', expanded);
      const layout = await chips.evaluateAll(elements => elements.map(chip => {
        const icon = chip.querySelector(':scope > span > svg')?.parentElement;
        const label = chip.querySelector('.action-icon__label');
        const chipBox = chip.getBoundingClientRect();
        const iconBox = icon?.getBoundingClientRect();
        const labelBox = label?.getBoundingClientRect();
        return {
          name: chip.getAttribute('aria-label'),
          separated: !!iconBox && !!labelBox && labelBox.left > iconBox.right,
          contained: !!iconBox && iconBox.height > 0 && iconBox.width > 0 &&
            iconBox.top >= chipBox.top && iconBox.bottom <= chipBox.bottom,
        };
      }));
      expect(layout.length).toBeGreaterThanOrEqual(7);
      for (const chip of layout) {
        expect(chip, `${chip.name} with More fields expanded=${expanded}`).toMatchObject({
          separated: true,
          contained: true,
        });
      }
    }
  });
}
