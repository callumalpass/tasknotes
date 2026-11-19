import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from './obsidian';

let instance: ObsidianApp;
const folder = 'CalendarSideBySide';
const root = '.workspace-leaf.mod-active #bases-calendar';

async function openBase(name: string, extra = ''): Promise<void> {
  await instance.page.evaluate(async ({ folder, name, extra }) => {
    const app = (window as any).app;
    const path = `${folder}/${name}.base`;
    await app.vault.create(path, `filters:\n  and:\n    - file.inFolder("${folder}")\nviews:\n  - type: tasknotesCalendar\n    name: Calendar\n    calendarView: timeGridDay\n    showMonthDayPanel: false\n    showScheduled: true\n${extra}`);
    const leaf = (window as any).sideLeaf ?? app.workspace.getLeaf(true);
    (window as any).sideLeaf = leaf;
    await leaf.openFile(app.vault.getAbstractFileByPath(path));
    app.workspace.setActiveLeaf(leaf, { focus: true });
  }, { folder, name, extra });
  await expect(instance.page.locator(`${root} .tnc-col`).first()).toBeVisible({ timeout: 20000 });
}

async function view(name: string, width: number): Promise<void> {
  await setObsidianViewport(instance.page, { width, height: 820 });
  await instance.page.evaluate(name => {
    (window as any).sideLeaf.view.controller.view.calendar.changeView(name, '2026-11-07');
  }, name);
  await expect(instance.page.locator(`${root} .tnc-item--timed`).first()).toBeVisible();
}

test.beforeAll(async () => {
  instance = await launchObsidian();
  await instance.page.clock.setFixedTime(new Date('2026-11-07T08:00:00'));
  await instance.page.evaluate(async folder => {
    const app = (window as any).app;
    const plugin = app.plugins.plugins.tasknotes;
    plugin.settings.taskIdentificationMethod = 'tag';
    plugin.settings.taskTag = 'task';
    await app.vault.createFolder(folder);
    for (let index = 0; index < 3; index++) {
      await app.vault.create(`${folder}/Overlap${index}.md`, `---\ntitle: Overlapping review ${index}\ntags: [task]\nstatus: open\nscheduled: 2026-11-07T10:${index}0\ntimeEstimate: 60\n---\n`);
    }
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
  }, folder);
  await openBase('Calendar');
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      (window as any).sideLeaf?.detach();
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally { await closeObsidian(instance); }
});

test('overlapping events sit side by side as separate items', async () => {
  for (const [name, width] of [['day', 1280], ['week', 1280], ['week', 390]] as const) {
    await view(name, width);
    const items = instance.page.locator(`${root} .tnc-item--timed`).filter({ hasText: 'Overlapping review' });
    await expect(items).toHaveCount(3);
    await expect(instance.page.locator(`${root} .tnc-more--collision`)).toHaveCount(0);
    const lefts = await items.evaluateAll(elements => elements.map(element => Math.round(element.getBoundingClientRect().left)));
    expect(new Set(lefts).size).toBe(3);
  }

  // A neutral card carries the colour only as its leading edge, and stays readable.
  const look = await instance.page.locator(`${root} .tnc-item--timed`).first().evaluate(element => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    const rgb = (color: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
    const luminance = ([r, g, b]: number[]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    const style = getComputedStyle(element);
    const text = luminance(rgb(getComputedStyle(element.querySelector('.tn-calendar-event-title')!).color));
    const fill = luminance(rgb(style.backgroundColor));
    return { edge: style.borderLeftWidth, contrast: (Math.max(text, fill) + 0.05) / (Math.min(text, fill) + 0.05) };
  });
  expect(look.edge).toBe('3px');
  expect(look.contrast).toBeGreaterThanOrEqual(4.5);
});

test('the simultaneous-events limit still folds the rest into a count', async () => {
  await openBase('Limited', '    eventMaxStack: 2\n');
  await view('day', 1280);
  await expect(instance.page.locator(`${root} .tnc-item--timed`).filter({ hasText: 'Overlapping review' })).toHaveCount(1);
  await expect(instance.page.locator(`${root} .tnc-more--stack:not(.tnc-more--collision)`)).toHaveText('+2');
});
