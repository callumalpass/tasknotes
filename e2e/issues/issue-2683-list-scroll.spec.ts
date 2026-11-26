import { expect, test, type Locator } from '@playwright/test';
import { closeObsidian, launchObsidian, setObsidianViewport, type ObsidianApp } from '../obsidian';

const date = '2026-11-18';
const earlier = '2026-11-11';
const views = ['Agenda', 'Calendar'];
const folder = `Issue2683-${Date.now()}`;
let instance: ObsidianApp;

test.beforeAll(async () => {
  instance = await launchObsidian();
  await setObsidianViewport(instance.page, { width: 1200, height: 800 });
  await instance.page.evaluate(async ({ date, earlier, folder, views }) => {
    const app = (window as any).app;
    app.workspace.leftSplit.collapse();
    app.workspace.rightSplit.collapse();
    await app.vault.createFolder(folder);
    for (const [title, scheduled] of [['Opening task', date], ['Earlier task', earlier]]) {
      await app.vault.create(`${folder}/${title}.md`, `---\ntags: [task]\nstatus: open\nscheduled: ${scheduled}\n---\n`);
    }
    for (const name of views) {
      await app.vault.create(`${folder}/${name}.base`, JSON.stringify({
        filters: { and: [`file.inFolder("${folder}")`, 'file.hasTag("task")'] },
        views: [{
          type: 'tasknotesCalendar', name, calendarView: 'listWeek', initialDate: date,
          showScheduled: true, showOverdueOnToday: false, showAgendaStrip: true,
        }],
      }));
    }
  }, { date, earlier, folder, views });
});

test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async folder => {
      const app = (window as any).app;
      app.workspace.getLeavesOfType('bases').forEach((leaf: any) => leaf.detach());
      const fixture = app.vault.getAbstractFileByPath(folder);
      if (fixture) await app.vault.delete(fixture, true);
    }, folder);
  } finally {
    await closeObsidian(instance);
  }
});

async function listEdge(scroller: Locator, edge: 'first' | 'last'): Promise<string | null> {
  const sections = scroller.locator('.tnc-list-section[data-date]');
  return (edge === 'first' ? sections.first() : sections.last()).getAttribute('data-date');
}

for (const name of views) {
  test(`${name} list loads earlier days without moving the opening task`, async () => {
    const { page } = instance;
    await page.evaluate(async path => {
      const app = (window as any).app;
      await app.workspace.getLeaf(true).openFile(app.vault.getAbstractFileByPath(path));
    }, `${folder}/${name}.base`);
    const pane = page.locator('.workspace-leaf.mod-active');
    const scroller = pane.locator('.tnc-list-scroll');
    const opening = scroller.getByText('Opening task', { exact: true });
    await expect(opening).toBeInViewport();
    expect(await listEdge(scroller, 'first')).toBe(date);
    const openingY = (await opening.boundingBox())!.y;
    await scroller.hover({ position: { x: 120, y: 140 } });
    await page.mouse.wheel(0, -35);
    const past = scroller.getByText('Earlier task', { exact: true });
    await expect(past).toBeAttached();
    expect(await listEdge(scroller, 'first')).toBe(earlier);
    expect(Math.abs((await opening.boundingBox())!.y - openingY)).toBeLessThan(2);

    await page.mouse.wheel(0, -2000);
    await expect(past).toBeInViewport();
    const future = await listEdge(scroller, 'last');
    await page.mouse.wheel(0, 5000);
    await expect.poll(() => listEdge(scroller, 'last')).not.toBe(future);
  });
}
