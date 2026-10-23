import { test, expect, type Page } from '@playwright/test';
import { parse } from 'yaml';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

// Recorded manually on desk before/after the backport. Do not reuse a user's vault.
const folder = `Issue2148-${Date.now()}`;
let instance: ObsidianApp;
let page: Page;
let originalSettings: any;

async function read(name: string) {
  return page.evaluate(async path => {
    const app = (window as any).app;
    const file = app.vault.getAbstractFileByPath(path);
    return { text: await app.vault.read(file), mtime: file.stat.mtime };
  }, `${folder}/${name}.md`);
}

async function open(name: string) {
  await page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    await plugin.openTaskEditModal(await plugin.cacheManager.getTaskInfo(path));
  }, `${folder}/${name}.md`);
  await expect(page.locator('.modal').getByPlaceholder('Task title...')).toBeVisible();
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  page = instance.page;
  originalSettings = await page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const original = {
      storeTitleInFilename: plugin.settings.storeTitleInFilename,
      taskIdentificationMethod: plugin.settings.taskIdentificationMethod,
      taskPropertyName: plugin.settings.taskPropertyName,
      taskPropertyValue: plugin.settings.taskPropertyValue,
      userFields: plugin.settings.userFields,
      modalFieldsConfig: JSON.parse(JSON.stringify(plugin.settings.modalFieldsConfig)),
    };
    Object.assign(plugin.settings, {
      storeTitleInFilename: false, taskIdentificationMethod: 'property',
      taskPropertyName: 'tasknote', taskPropertyValue: 'true',
      userFields: [{ id: 'issue2148-list', key: 'custom_list', displayName: 'Custom list', type: 'list' }],
    });
    plugin.fieldMapper.updateUserFields(plugin.settings.userFields);
    plugin.settings.modalFieldsConfig.fields.push({
      id: 'issue2148-list', fieldType: 'user', group: 'custom', displayName: 'Custom list',
      visibleInCreation: true, visibleInEdit: true, order: 0, enabled: true,
    });
    await app.vault.createFolder(folder);
    const contexts = plugin.fieldMapper.toUserField('contexts');
    const projects = plugin.fieldMapper.toUserField('projects');
    const blockedBy = plugin.fieldMapper.toUserField('blockedBy');
    const status = plugin.fieldMapper.toUserField('status');
    const fields = [contexts, projects, 'tags', blockedBy, 'custom_list'];
    for (const [name, props] of [
      ['Null', fields.map(field => `${field}:`).join('\n')],
      ['Empty', fields.map(field => `${field}: []`).join('\n')],
      ['Missing', ''], ['Untouched', fields.map(field => `${field}:`).join('\n')],
      ['Last', `${contexts}: [work]\n${projects}: ["[[Project]]"]\ntags: [last-tag]\n${blockedBy}: [{uid: "[[Other Task]]", reltype: FINISHTOSTART}]\ncustom_list: [last-item]`],
    ]) {
      await app.vault.create(`${folder}/${name}.md`, `---\ntitle: ${name}\n${status}: open\npriority: normal\ntasknote: true\n${props}\n---\nBody\n`);
    }
    return original;
  }, folder);
});

test.afterAll(async () => {
  try {
    if (originalSettings && page && !page.isClosed()) {
      await page.evaluate(async ({ originalSettings, folder }) => {
        const app = (window as any).app;
        const plugin = app.plugins.plugins.tasknotes;
        Object.assign(plugin.settings, originalSettings);
        plugin.fieldMapper.updateUserFields(plugin.settings.userFields);
        const fixture = app.vault.getAbstractFileByPath(folder);
        if (fixture) await app.vault.delete(fixture, true);
      }, { originalSettings, folder });
    }
  } finally {
    if (instance) await closeObsidian(instance);
  }
});

test('nullable lists open blank; no-op saves preserve bytes and unrelated files', async () => {
  const untouched = await read('Untouched');
  for (const name of ['Null', 'Empty', 'Missing']) {
    const before = await read(name);
    await open(name);
    const modal = page.locator('.modal');
    await expect(modal.getByPlaceholder('context1, context2')).toHaveValue('');
    await expect(modal.getByPlaceholder('tag1, tag2')).toHaveValue('');
    await expect(modal.locator('.setting-item').filter({ hasText: 'Custom list' }).locator('input')).toHaveValue('');
    await expect(modal.getByRole('button', { name: 'Remove project', exact: true })).toHaveCount(0);
    await modal.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(modal).toHaveCount(0);
    expect(await read(name)).toEqual(before);
  }
  expect(await read('Untouched')).toEqual(untouched);
});

test('adding a context to YAML null never carries a fake null string into the file', async () => {
  await open('Null');
  const modal = page.locator('.modal');
  await modal.getByPlaceholder('context1, context2').fill('work');
  await modal.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(modal).toHaveCount(0);
  const key = await page.evaluate(() => (window as any).app.plugins.plugins.tasknotes.fieldMapper.toUserField('contexts'));
  const frontmatter = parse((await read('Null')).text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]);
  expect(frontmatter[key]).toEqual(['work']);
});

test('clearing the last item in every list does not persist null strings', async () => {
  await open('Last');
  const modal = page.locator('.modal');
  await modal.getByPlaceholder('context1, context2').fill('');
  await modal.getByPlaceholder('tag1, tag2').fill('');
  await modal.getByRole('button', { name: 'Remove project', exact: true }).click();
  await modal.getByRole('button', { name: 'Remove task', exact: true }).click();
  await modal.locator('.setting-item').filter({ hasText: 'Custom list' }).locator('input').fill('');
  await modal.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(modal).toHaveCount(0);
  const keys = await page.evaluate(() => {
    const mapper = (window as any).app.plugins.plugins.tasknotes.fieldMapper;
    return ['contexts', 'projects', 'blockedBy'].map(field => mapper.toUserField(field));
  });
  const frontmatter = parse((await read('Last')).text.match(/^---\r?\n([\s\S]*?)\r?\n---/)![1]);
  for (const key of [...keys, 'tags']) expect(frontmatter).not.toHaveProperty(key);
  expect(frontmatter.custom_list).toEqual([]);
});
