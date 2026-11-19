import { test, expect, type Locator, type Page } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
let page: Page;
const viewport = { width: 400, height: 850 };
const modal = () => page.locator('.modal.mod-tasknotes');
const title = () => modal().locator('.modal-split-primary .cm-content, .modal-split-primary textarea');

async function setKeyboardHeight(height: number): Promise<void> {
  await page.evaluate(height => document.body.style.setProperty('--keyboard-height', `${height}px`), height);
}

async function expectAboveKeyboard(target: Locator, height: number): Promise<void> {
  await expect(target).toBeVisible();
  await expect.poll(async () => {
    const bounds = await target.boundingBox();
    return bounds !== null && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height - height + 1;
  }).toBe(true);
}

async function expectComposerFits(height: number): Promise<void> {
  await expectAboveKeyboard(modal(), height);
  await expectAboveKeyboard(title(), height);
  const createButton = modal().getByRole('button', { name: 'Create task', exact: true });
  await expectAboveKeyboard(createButton, height);
  await expect.poll(() => createButton.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    return element.contains(element.ownerDocument.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2));
  })).toBe(true);
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  await setObsidianViewport(page, viewport);
});

test.afterAll(async () => {
  if (instance) await closeObsidian(instance);
});

test.beforeEach(async () => {
  await setObsidianViewport(page, viewport);
  await page.evaluate(() => document.body.classList.add('is-mobile', 'is-phone'));
  await setKeyboardHeight(0);
  await page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.settings.enableNaturalLanguageInput = true;
    plugin.openTaskCreationModal();
  });
  await expect(title()).toBeFocused();
});

test.afterEach(async () => {
  await page.keyboard.press('Escape');
  await expect(modal()).toHaveCount(0);
  await page.evaluate(() => {
    document.body.classList.remove('is-mobile', 'is-phone', 'mod-toolbar-open');
    document.body.style.removeProperty('--keyboard-height');
    document.body.style.removeProperty('--mobile-toolbar-height');
    document.querySelector('.tn-keyboard-test-toolbar')?.remove();
  });
});

test('compact composer follows late keyboard opening, resizing and dismissal', async () => {
  await expectComposerFits(0);
  const initialBounds = await modal().boundingBox();
  for (const height of [320, 400, 0, 320, 0]) {
    await setKeyboardHeight(height);
    await expectComposerFits(height);
  }
  await expect.poll(async () => (await modal().boundingBox())?.y).toBeCloseTo(initialBounds!.y, 0);
});

test('expanded fields scroll without covering the title or save controls', async () => {
  await setKeyboardHeight(320);
  await modal().getByRole('button', { name: 'More fields', exact: true }).click();
  await expectComposerFits(320);
  const details = modal().locator('.tn-task-modal__markdown-editor--details .cm-content, textarea.details-input');
  await details.click();
  await expect(details).toBeFocused();
  await expectAboveKeyboard(details, 320);
  await expectAboveKeyboard(modal().getByRole('button', { name: 'Create task', exact: true }), 320);
  await title().click();
  await expectComposerFits(320);
  await setKeyboardHeight(0);
  await expectComposerFits(0);
});

test('a narrow desktop composer ignores mobile keyboard offsets', async () => {
  await page.evaluate(() => document.body.classList.remove('is-mobile', 'is-phone'));
  const initialBounds = await modal().boundingBox();
  await setKeyboardHeight(320);
  await expectComposerFits(0);
  await expect.poll(async () => (await modal().boundingBox())?.y).toBeCloseTo(initialBounds!.y, 0);
});

test('plain-title mode also fits with expanded fields and a keyboard', async () => {
  await page.keyboard.press('Escape');
  await expect(modal()).toHaveCount(0);
  await page.evaluate(() => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.settings.enableNaturalLanguageInput = false;
    plugin.openTaskCreationModal();
  });
  await expect(title()).toBeFocused();
  await setKeyboardHeight(320);
  await expectComposerFits(320);
  await expect(modal().locator('.tn-task-modal__markdown-editor--details .cm-content')).toBeVisible();
});

test('a wider mobile composer stays within the keyboard-reduced height', async () => {
  await setObsidianViewport(page, { width: 800, height: viewport.height });
  await setKeyboardHeight(400);
  await modal().getByRole('button', { name: 'More fields', exact: true }).click();
  await expectComposerFits(400);
});

test('the mobile formatting toolbar cannot cover the save controls', async () => {
  await page.evaluate(() => {
    document.body.classList.add('mod-toolbar-open');
    document.body.style.setProperty('--mobile-toolbar-height', '52px');
    const toolbar = document.createElement('div');
    toolbar.className = 'mobile-toolbar tn-keyboard-test-toolbar';
    document.body.appendChild(toolbar);
  });
  await setKeyboardHeight(320);
  await expectComposerFits(372);
  await setKeyboardHeight(0);
  await expectComposerFits(52);
  await page.evaluate(() => {
    document.body.classList.remove('mod-toolbar-open');
    document.querySelector('.tn-keyboard-test-toolbar')?.remove();
  });
  await expectComposerFits(0);
});
