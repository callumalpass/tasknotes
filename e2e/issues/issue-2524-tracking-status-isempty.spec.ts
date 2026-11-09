import { test, expect } from '@playwright/test';
import { launchObsidian, closeObsidian, type ObsidianApp } from '../obsidian';

// #2524: in Bases, `!prop` is null (not true) for a missing property, so the old
// generated `!time_entries || list(time_entries).length == 0` never matched tasks
// without time entries. The generated formulas now use isEmpty().
const DIR = 'e2e-2524';
const BASE = `${DIR}/check.base`;
const NOTES: Record<string, string> = {
  'a-missing': '---\ntitle: a\n---\n',
  'b-null': '---\ntime_entries:\ntimeEstimate:\n---\n',
  'c-empty-zero': '---\ntime_entries: []\ntimeEstimate: 0\n---\n',
  'd-set': '---\ntime_entries:\n  - startTime: 2026-01-01T10:00:00Z\n    endTime: 2026-01-01T10:20:00Z\ntimeEstimate: 30\n---\n',
};
const BASE_SOURCE = `filters:
  and:
    - file.inFolder("${DIR}")
    - file.ext == "md"
formulas:
  oldEntries: 'if(!time_entries || list(time_entries).length == 0, "none", "some")'
  newEntries: 'if(time_entries.isEmpty(), "none", "some")'
  oldEstimate: 'if(!timeEstimate || timeEstimate == 0 || timeEstimate == null, "none", "some")'
  newEstimate: 'if(timeEstimate.isEmpty() || timeEstimate == 0, "none", "some")'
views:
  - type: table
    name: Check
    order:
      - file.name
      - formula.oldEntries
      - formula.newEntries
      - formula.oldEstimate
      - formula.newEstimate
    sort:
      - property: file.name
        direction: ASC
`;

let instance: ObsidianApp;
test.beforeAll(async () => { instance = await launchObsidian(); });
test.afterAll(async () => {
  if (!instance) return;
  try {
    await instance.page.evaluate(async (dir) => {
      const app = (window as any).app;
      const folder = app.vault.getAbstractFileByPath(dir);
      if (folder) await app.vault.delete(folder, true);
    }, DIR);
  } finally {
    await closeObsidian(instance);
  }
});

test('isEmpty() detects missing, null and empty time entries and estimates', async () => {
  const page = instance.page;
  await page.evaluate(async ({ dir, base, baseSource, notes }) => {
    const app = (window as any).app;
    await new Promise<void>(resolve => app.workspace.onLayoutReady(resolve));
    const existing = app.vault.getAbstractFileByPath(dir);
    if (existing) await app.vault.delete(existing, true);
    await app.vault.createFolder(dir);
    for (const [name, body] of Object.entries(notes)) await app.vault.create(`${dir}/${name}.md`, body);
    const file = await app.vault.create(base, baseSource);
    await app.workspace.getLeaf(true).openFile(file);
  }, { dir: DIR, base: BASE, baseSource: BASE_SOURCE, notes: NOTES });

  const rows = page.locator('.workspace-leaf-content[data-type="bases"] .bases-tbody .bases-tr');
  await expect.poll(async () => rows.evaluateAll(trs => trs.map(tr =>
    Array.from(tr.querySelectorAll('.bases-td')).map(td => (td.textContent ?? '').trim()).join('|'),
  )), { timeout: 20000 }).toEqual([
    // name | oldEntries | newEntries | oldEstimate | newEstimate
    'a-missing|some|none|none|none',
    'b-null|some|none|none|none',
    'c-empty-zero|none|none|none|none',
    'd-set|some|some|some|some',
  ]);
});
