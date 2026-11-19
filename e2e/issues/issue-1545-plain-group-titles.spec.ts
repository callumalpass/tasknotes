/**
 * PR #1545: plain group values (e.g. a context "STY") must not resolve to an
 * unrelated note that happens to share the name. Project links keep rendering
 * as links in Task List and Kanban group headers.
 */
import { test, expect } from '@playwright/test';
import { stringify } from 'yaml';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

const stamp = Date.now();
const folder = `Issue1545-${stamp}`;
const context = `Sty${stamp}`;
// A root-level project note and a nested one with a frontmatter title.
const rootProject = `RootProject${stamp}`;
let instance: ObsidianApp;

type Header = { text: string; href: string | null };

async function renderHeaders(name: string, type: string, property: string, options: Record<string, unknown>): Promise<Header[]> {
  const view = {
    type,
    name,
    ...options,
    filters: { and: [`file.inFolder("${folder}/Tasks")`] },
    groupBy: { property, direction: 'ASC' },
  };
  await instance.page.evaluate(async ({ path, content }) => {
    const app = (window as any).app;
    const file = await app.vault.create(path, content);
    await app.workspace.getLeaf(false).openFile(file);
  }, { path: `${folder}/${name}.base`, content: stringify({ views: [view] }) });
  const selector = type === 'tasknotesKanban'
    ? '.workspace-leaf.mod-active .kanban-view__column-title'
    : '.workspace-leaf.mod-active .task-group-title';
  const titles = instance.page.locator(selector);
  await expect(titles.first()).toBeVisible();
  await expect.poll(() => titles.count()).toBeGreaterThanOrEqual(2);
  return titles.evaluateAll(elements => elements.map(element => ({
    text: element.textContent?.trim() ?? '',
    href: element.querySelector('a')?.getAttribute('data-href') ?? null,
  })));
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  await instance.page.evaluate(async ({ folder, context, rootProject }) => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    await app.vault.createFolder(`${folder}/Tasks`);
    await app.vault.createFolder(`${folder}/Notes`);
    await app.vault.createFolder(`${folder}/Projects`);
    // Unrelated note whose basename matches the plain context value case-insensitively.
    await app.vault.create(`${folder}/Notes/${context.toLowerCase()}.md`, '---\ntitle: Unrelated note\n---\n');
    await app.vault.create(`${rootProject}.md`, '# Root project\n');
    await app.vault.create(`${folder}/Projects/Nested.md`, '---\ntitle: Nested title\n---\n');
    const contextsField = plugin.fieldMapper.toUserField('contexts');
    const projectsField = plugin.fieldMapper.toUserField('projects');
    await app.vault.create(`${folder}/Tasks/Plain context.md`,
      `---\ntags: [task]\nstatus: open\n${contextsField}: [${context}]\n${projectsField}: ["[[${rootProject}]]"]\n---\n`);
    await app.vault.create(`${folder}/Tasks/Nested project.md`,
      `---\ntags: [task]\nstatus: open\n${contextsField}: [other${context}]\n${projectsField}: ["[[${folder}/Projects/Nested]]"]\n---\n`);
  }, { folder, context, rootProject });
  await expect.poll(() => instance.page.evaluate(async folder => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const tasks = await Promise.all(['Plain context', 'Nested project'].map(name => plugin.cacheManager.getTaskInfo(`${folder}/Tasks/${name}.md`)));
    return tasks.filter(Boolean).length;
  }, folder)).toBe(2);
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async ({ folder, rootProject }) => {
      const app = (window as any).app;
      for (const path of [folder, `${rootProject}.md`]) {
        const file = app.vault.getAbstractFileByPath(path);
        if (file) await app.vault.delete(file, true);
      }
    }, { folder, rootProject });
  } finally { await closeObsidian(instance); }
});

const views: Array<[string, string, Record<string, unknown>]> = [
  ['Task List', 'tasknotesTaskList', {}],
  ['Kanban', 'tasknotesKanban', {}],
  // Without exploded list columns Kanban titles come from Bases group keys, like Task List.
  ['Kanban (lists not exploded)', 'tasknotesKanban', { explodeListColumns: false }],
];

for (const [label, type, options] of views) {
  const slug = label.replace(/\W+/g, '-');

  test(`${label}: plain context stays text despite a note with that name`, async () => {
    const headers = await renderHeaders(`contexts-${slug}`, type, 'note.contexts', options);
    expect.soft(headers).toContainEqual({ text: context, href: null });
    expect.soft(headers.map(header => header.text)).not.toContain('Unrelated note');
  });

  test(`${label}: root-level and nested project links still render as links`, async () => {
    const headers = await renderHeaders(`projects-${slug}`, type, 'note.projects', options);
    expect.soft(headers).toContainEqual({ text: rootProject, href: rootProject });
    expect.soft(headers).toContainEqual({ text: 'Nested title', href: `${folder}/Projects/Nested` });
  });
}
