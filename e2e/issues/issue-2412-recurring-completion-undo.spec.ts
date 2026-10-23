import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

let instance: ObsidianApp;

test.beforeAll(async () => { instance = await launchObsidian(); });
test.afterAll(async () => { if (instance) await closeObsidian(instance); });

async function createTask(title: string, extra: Record<string, unknown> = {}) {
  return instance.page.evaluate(async ({ title, extra }) => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    plugin.settings.maintainDueDateOffsetInRecurring = true;
    plugin.settings.resetCheckboxesOnRecurrence = true;
    const { taskInfo } = await plugin.taskService.createTask({
      title, scheduled: '2035-10-21', due: '2035-10-23',
      recurrence: 'DTSTART:20351021;FREQ=YEARLY', tags: ['task'],
      details: '- [x] Review', ...extra,
    });
    return taskInfo.path as string;
  }, { title, extra });
}

async function complete(path: string, date?: string) {
  return instance.page.evaluate(async ({ path, date }) => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const task = await plugin.cacheManager.getTaskInfo(path);
    await plugin.toggleRecurringTaskComplete(task, date ? new Date(`${date}T00:00:00Z`) : undefined);
  }, { path, date });
}

async function state(path: string) {
  return instance.page.evaluate(async path => {
    const app = (window as any).app;
    const task = await app.plugins.plugins.tasknotes.cacheManager.getTaskInfo(path);
    const content = await app.vault.read(app.vault.getAbstractFileByPath(path));
    return { task, content };
  }, path);
}

function notice(title: string) {
  return instance.page.locator('.notice').filter({ hasText: title });
}

test('annual checkoff shows years and Undo restores that occurrence, due offset and checklist', async () => {
  const title = 'Issue 2412 annual undo';
  const path = await createTask(title);
  await complete(path);
  await expect(notice(title)).toContainText('Completed occurrence: 21 Oct 2035');
  await expect(notice(title)).toContainText('Next: 21 Oct 2036');
  expect((await state(path)).task.scheduled).toBe('2036-10-21');
  expect((await state(path)).task.due).toBe('2036-10-23');
  await notice(title).getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await state(path)).task.scheduled).toBe('2035-10-21');
  expect((await state(path)).task.complete_instances ?? []).toEqual([]);
  expect((await state(path)).task.due).toBe('2035-10-23');
  expect((await state(path)).content).toContain('- [x] Review');
});

test('stale Undo cannot undo a later completion; latest Undo removes only its own occurrence', async () => {
  const title = 'Issue 2412 consecutive';
  const path = await createTask(title);
  await complete(path);
  await complete(path);
  const notices = notice(title);
  await expect(notices).toHaveCount(2);
  await notices.first().getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(instance.page.locator('.notice').filter({ hasText: 'Cannot undo:' })).toBeVisible();
  expect((await state(path)).task.scheduled).toBe('2037-10-21');
  await notice(title).last().getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await state(path)).task.scheduled).toBe('2036-10-21');
  expect((await state(path)).task.complete_instances).toEqual(['2035-10-21']);
});

test('Undo preserves unrelated edits but refuses a changed recurrence rule', async () => {
  const title = 'Issue 2412 edits';
  const path = await createTask(title);
  await complete(path);
  await instance.page.evaluate(async path => {
    const app = (window as any).app;
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (fm: any) => {
      fm.title = 'Renamed after completion'; fm.priority = 'high';
    });
  }, path);
  await notice(title).getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await state(path)).task.scheduled).toBe('2035-10-21');
  expect((await state(path)).content).toContain('Renamed after completion');
  expect((await state(path)).content).toContain('priority: high');
  await complete(path);
  await instance.page.evaluate(async path => {
    const app = (window as any).app;
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (fm: any) => {
      fm.recurrence = 'DTSTART:20351021;FREQ=MONTHLY';
    });
  }, path);
  await notice('Renamed after completion').getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await state(path)).content).toContain('FREQ=MONTHLY');
  expect((await state(path)).task.scheduled).toBe('2036-10-21');
});

test('bounded series show no next occurrence', async () => {
  const title = 'Issue 2412 last occurrence';
  const path = await createTask(title, { recurrence: 'DTSTART:20351021;FREQ=YEARLY;COUNT=1' });
  await complete(path);
  await expect(notice(title)).toContainText('No next occurrence');
  await notice(title).getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await state(path)).task.complete_instances ?? []).toEqual([]);
});

test('completion-anchored Undo restores the original anchor and timed schedule', async () => {
  const title = 'Issue 2412 completion anchor';
  const path = await createTask(title, {
    scheduled: '2035-10-21T09:30', due: '2035-10-23T09:30',
    recurrence: 'DTSTART:20351021T093000Z;FREQ=YEARLY', recurrence_anchor: 'completion',
  });
  await complete(path, '2035-10-22');
  expect((await state(path)).task.recurrence).toContain('20351022T093000Z');
  await notice(title).getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await state(path)).task.recurrence).toContain('20351021T093000Z');
  expect((await state(path)).task.scheduled).toBe('2035-10-21T09:30');
});

test('edits arriving during completion are never captured as reversible writes', async () => {
  const title = 'Issue 2412 concurrent body edit';
  const path = await createTask(title);
  await instance.page.evaluate(async path => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const service = plugin.taskService;
    const original = service.webhookNotifier;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let entered!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; });
    service.webhookNotifier = { triggerWebhook: async () => { entered(); await gate; } };
    try {
      const task = await plugin.cacheManager.getTaskInfo(path);
      const pending = plugin.toggleRecurringTaskComplete(task);
      await ready;
      await app.vault.process(app.vault.getAbstractFileByPath(path), (content: string) => content + '\nNew work during completion');
      release();
      await pending;
    } finally { release(); service.webhookNotifier = original; }
  }, path);
  await notice(title).getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(instance.page.locator('.notice').filter({ hasText: 'Cannot undo:' }).last()).toBeVisible();
  expect((await state(path)).task.scheduled).toBe('2036-10-21');
  expect((await state(path)).content).toContain('New work during completion');
});

test('already-completed virtual dates are not materialized when reopening them', async () => {
  const title = 'Issue 2412 historical virtual completion';
  const path = await createTask(title);
  await complete(path);
  await instance.page.evaluate(async path => {
    const app = (window as any).app;
    await app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(path), (fm: any) => {
      fm.occurrence_materialization = 'on_completion';
    });
  }, path);
  await expect.poll(async () => (await state(path)).task.occurrence_materialization).toBe('on_completion');
  await complete(path, '2035-10-21');
  expect((await state(path)).task.complete_instances ?? []).not.toContain('2035-10-21');
  const occurrence = await instance.page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const parent = await plugin.cacheManager.getTaskInfo(path);
    return plugin.taskService.findMaterializedOccurrence(parent, new Date('2035-10-21T00:00:00Z'));
  }, path);
  expect(occurrence).toBeFalsy();
});

test('materialized completion receipts exclude later parent completions during webhooks', async () => {
  const title = 'Issue 2412 concurrent materialized';
  const path = await createTask(title, { occurrence_materialization: 'on_completion' });
  await instance.page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const service = plugin.taskService;
    const original = service.webhookNotifier;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let entered!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; });
    service.webhookNotifier = { triggerWebhook: async (event: string) => {
      if (event === 'recurring.instance.completed') { entered(); await gate; }
    } };
    try {
      const parent = await plugin.cacheManager.getTaskInfo(path);
      const pending = plugin.toggleRecurringTaskComplete(parent);
      await ready;
      service.webhookNotifier = original;
      await service.toggleRecurringTaskCompleteWithOccurrenceNotes(
        await plugin.cacheManager.getTaskInfo(path), new Date('2036-10-21T00:00:00Z'));
      release();
      await pending;
    } finally { release(); service.webhookNotifier = original; }
  }, path);
  await notice(title).getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(instance.page.locator('.notice').filter({ hasText: 'Cannot undo:' }).last()).toBeVisible();
  expect((await state(path)).task.complete_instances).toEqual(['2035-10-21', '2036-10-21']);
  expect((await state(path)).task.scheduled).toBe('2037-10-21');
});

test('a failed occurrence write rolls back the parent Undo rather than leaving partial state', async () => {
  const title = 'Issue 2412 atomic Undo';
  const path = await createTask(title, { occurrence_materialization: 'on_completion' });
  await complete(path);
  const occurrencePath = await instance.page.evaluate(async path => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    const parent = await plugin.cacheManager.getTaskInfo(path);
    const occurrence = await plugin.taskService.findMaterializedOccurrence(parent, new Date('2035-10-21T00:00:00Z'));
    const original = app.vault.process.bind(app.vault);
    app.vault.process = async (file: any, update: any) => {
      if (file.path === occurrence.path) {
        app.vault.process = original;
        throw new Error('Issue 2412 injected second-file write failure');
      }
      return original(file, update);
    };
    return occurrence.path as string;
  }, path);
  await notice(title).getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(instance.page.locator('.notice').filter({ hasText: 'Could not undo the recurring task change.' })).toBeVisible();
  expect((await state(path)).task.scheduled).toBe('2036-10-21');
  expect((await state(path)).task.complete_instances).toEqual(['2035-10-21']);
  expect((await state(occurrencePath)).task.status).toBe('done');
  expect((await state(path)).content).toContain('2036-10-21');
  expect((await state(occurrencePath)).content).toContain('status: done');
});

test('note-backed occurrence Undo restores parent and occurrence without deleting notes', async () => {
  const title = 'Issue 2412 materialized';
  const path = await createTask(title, { occurrence_materialization: 'on_completion' });
  await complete(path);
  const occurrencePath = await instance.page.evaluate(async path => {
    const plugin = (window as any).app.plugins.plugins.tasknotes;
    const parent = await plugin.cacheManager.getTaskInfo(path);
    const occurrence = await plugin.taskService.findMaterializedOccurrence(parent, new Date('2035-10-21T00:00:00Z'));
    return occurrence.path as string;
  }, path);
  expect((await state(occurrencePath)).task.status).toBe('done');
  await notice(title).getByRole('button', { name: 'Undo', exact: true }).click();
  await expect.poll(async () => (await state(path)).task.scheduled).toBe('2035-10-21');
  expect((await state(occurrencePath)).task.status).toBe('open');
  expect((await state(path)).task.complete_instances ?? []).toEqual([]);
});
