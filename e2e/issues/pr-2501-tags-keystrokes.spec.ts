import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

let instance: ObsidianApp;
let original: { width: number; height: number; mobile: boolean } | undefined;
test.beforeAll(async () => {
  instance = await launchObsidian();
  original = await instance.page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
    mobile: document.body.classList.contains('is-mobile'),
  }));
});
test.afterAll(async () => {
  if (!instance) return;
  try {
    if (original && !instance.page.isClosed()) {
      await setObsidianViewport(instance.page, original);
      await instance.page.evaluate(mobile => document.body.classList.toggle('is-mobile', mobile), original.mobile);
    }
  } finally {
    await closeObsidian(instance);
  }
});

async function openCreate(mobile: boolean, nlp: boolean): Promise<void> {
  const page = instance.page;
  await setObsidianViewport(page, { width: mobile ? 430 : 1400, height: 1000 });
  await page.evaluate(async ({ mobile, nlp }) => {
    const app = (window as any).app;
    await new Promise<void>(resolve => app.workspace.onLayoutReady(resolve));
    document.body.classList.toggle('is-mobile', mobile);
    const plugin = app.plugins.plugins.tasknotes;
    plugin.i18n.setLocale('en');
    plugin.settings.enableNaturalLanguageInput = nlp;
    plugin.openTaskCreationModal();
  }, { mobile, nlp });
}

for (const mobile of [false, true]) {
  test(`typing comma-separated tags preserves the separator in the create modal${mobile ? ' (phone layout)' : ''}`, async () => {
    const page = instance.page;
    await openCreate(mobile, false);
    const tags = page.locator('.modal.mod-tasknotes input[placeholder="tag1, tag2"]');
    await expect(tags).toBeVisible();

    // Control: a single input event supplies an already-complete list.
    await tags.fill('work, home');
    await expect(tags).toHaveValue('work, home');
    await tags.fill('');

    // Real typing must retain the comma before the second tag is entered.
    await tags.pressSequentially('work, home', { delay: 50 });
    await expect(tags).toHaveValue('work, home');

    // Sanitising still applies once the field is left.
    await tags.pressSequentially(', ', { delay: 50 });
    await expect(tags).toHaveValue('work, home, ');
    const contexts = page.locator('.modal.mod-tasknotes input[placeholder="context1, context2"]');
    await contexts.click();
    await expect(tags).toHaveValue('work, home');

    await contexts.pressSequentially('office, phone', { delay: 50 });
    await expect(contexts).toHaveValue('office, phone');
    await page.locator('.modal.mod-tasknotes').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.locator('.modal').filter({ hasText: 'Unsaved changes' }).getByRole('button', { name: 'Discard changes', exact: true }).click();
    await expect(page.locator('.modal.mod-tasknotes')).toHaveCount(0);
  });

  for (const nlp of [false, true]) {
    test(`initial create focus still reaches the primary input (mobile=${mobile}, NLP=${nlp})`, async () => {
      const page = instance.page;
      await openCreate(mobile, nlp);
      const modal = page.locator('.modal.mod-tasknotes');
      const primary = nlp
        ? modal.locator('.tn-task-modal__markdown-editor--nlp .cm-content').first()
        : modal.locator('textarea.title-input');
      await expect(primary).toBeFocused();
      await modal.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(modal).toHaveCount(0);
    });
  }
}
