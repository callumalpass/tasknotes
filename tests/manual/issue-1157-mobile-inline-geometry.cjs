// Run against YOUR isolated Obsidian, never a user/shared vault:
// EDITOR_CDP=http://localhost:9404 EDITOR_EVIDENCE=/absolute/evidence/dir node tests/manual/issue-1157-mobile-inline-geometry.cjs
// The harness measures real Live Preview widgets; jsdom cannot do layout.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  assert(process.env.EDITOR_CDP && process.env.EDITOR_EVIDENCE, 'Set isolated CDP and evidence paths');
  const browser = await chromium.connectOverCDP(process.env.EDITOR_CDP);
  try {
    const page = browser.contexts()[0].pages().find(p => p.url().includes('index.html'));
    await page.setViewportSize({ width: 390, height: 844 });
    if (!await page.evaluate(() => document.body.classList.contains('is-mobile'))) {
      await page.evaluate(() => app.emulateMobile(true));
      await page.waitForTimeout(6000);
    }
    await page.waitForFunction(() => typeof app !== 'undefined' && !!app.plugins.plugins.tasknotes);
    fs.mkdirSync(process.env.EDITOR_EVIDENCE, { recursive: true });
    const results = [];
    for (const kind of ['spaced', 'unbroken', 'linked']) {
      for (const properties of [true, false]) {
        await page.evaluate(async ({ kind, properties }) => {
          const plugin = app.plugins.plugins.tasknotes;
          plugin.settings.inlineVisibleProperties = properties
            ? ['status', 'priority', 'scheduled', 'due', 'recurrence'] : ['status', 'priority'];
          const text = kind === 'unbroken' ? 'LongUnbrokenTitle'.repeat(16)
            : kind === 'linked' ? `[[Editor geometry target|${'Long linked title '.repeat(16)}]]`
              : 'Long spaced title '.repeat(16);
          const taskPath = `Editor geometry ${kind} ${properties}.md`;
          const body = `---\ntitle: ${JSON.stringify(text)}\nstatus: open\npriority: high\ntags:\n  - task\nscheduled: 2026-10-03\ndue: 2026-10-04\nrecurrence: FREQ=WEEKLY;BYDAY=MO,WE,FR\n---\n`;
          let task = app.vault.getAbstractFileByPath(taskPath);
          if (task) await app.vault.modify(task, body);
          else await app.vault.create(taskPath, body);
          const sourcePath = `Editor geometry source ${kind} ${properties}.md`;
          const sourceBody = `- [[${taskPath}]]\n    - parent\n        - parent\n            - parent\n                - [[${taskPath}]]\n\nCursor here\n`;
          let source = app.vault.getAbstractFileByPath(sourcePath);
          if (!source) source = await app.vault.create(sourcePath, sourceBody);
          await app.workspace.getLeaf(false).openFile(source);
          await app.workspace.activeLeaf.setViewState({ type: 'markdown', state: { file: source.path, mode: 'source', source: false } });
          app.workspace.activeLeaf.view.editor.setCursor({ line: 6, ch: 0 });
        }, { kind, properties });
        await page.waitForFunction(() => document.querySelectorAll('.cm-line .task-card--layout-inline').length === 2);
        // Optional before-fix stylesheet override, confined to this isolated window.
        if (process.env.EDITOR_CSS) {
          await page.evaluate(css => {
            document.getElementById('editor-css-override')?.remove();
            const style = document.createElement('style');
            style.id = 'editor-css-override'; style.textContent = css; document.head.append(style);
          }, fs.readFileSync(process.env.EDITOR_CSS, 'utf8'));
        }
        for (const available of [286, 160, 128]) {
          const metrics = await page.evaluate(({ available, properties }) => {
            const cards = [...document.querySelectorAll('.cm-line .task-card--layout-inline')];
            const card = cards[available === 286 ? 0 : 1];
            const line = card.closest('.cm-line');
            const padding = parseFloat(getComputedStyle(line).paddingLeft);
            line.style.width = `${available + padding}px`;
            const title = card.querySelector('.task-card__title-text');
            const status = card.querySelector('.task-card__status-dot');
            const priority = card.querySelector('.task-card__priority-dot');
            const menu = card.querySelector('.task-card__context-menu');
            const metadata = card.querySelector('.task-card__metadata');
            const rect = e => e.getBoundingClientRect().toJSON();
            const style = getComputedStyle(title);
            if (properties) metadata.scrollLeft = 30;
            return {
              available, padding, line: rect(line), lineScroll: line.scrollWidth,
              indicatorSize: parseFloat(getComputedStyle(card).getPropertyValue('--tn-mobile-inline-indicator-size')),
              menuSize: parseFloat(getComputedStyle(card).getPropertyValue('--tn-mobile-inline-menu-size')),
              gapBudget: parseFloat(getComputedStyle(card).fontSize) * 0.85,
              title: rect(title), status: rect(status), priority: rect(priority), menu: rect(menu),
              client: title.clientWidth, scrollTitle: title.scrollWidth,
              ellipsis: style.textOverflow, whiteSpace: style.whiteSpace, overflow: style.overflowX,
              links: title.querySelectorAll('a').length,
              properties: metadata.children.length, metadataWidth: metadata.clientWidth,
              metadataScroll: metadata.scrollLeft,
              propertyActions: metadata.querySelectorAll('[role="button"][tabindex="0"]').length,
              pageWidth: document.documentElement.clientWidth, pageScroll: document.documentElement.scrollWidth,
            };
          }, { available, properties });
          results.push({ kind, propertiesEnabled: properties, ...metrics });
          fs.writeFileSync(path.join(process.env.EDITOR_EVIDENCE, 'geometry.json'), JSON.stringify(results, null, 2));
          assert(metrics.title.width > 0 && metrics.title.width <= available - 2 * metrics.indicatorSize - metrics.menuSize - metrics.gapBudget + 1, 'reserve indicator space');
          assert(Math.abs(metrics.title.bottom - metrics.status.bottom) < 3, 'title must remain beside status');
          assert(metrics.title.left >= metrics.priority.right, 'title must follow priority');
          assert(metrics.title.right <= metrics.line.right + 1, 'title inside line');
          assert(metrics.lineScroll <= metrics.line.width + 1, 'no line overflow');
          assert(metrics.pageScroll <= metrics.pageWidth, 'no page overflow');
          assert.equal(metrics.ellipsis, 'ellipsis');
          assert.equal(metrics.whiteSpace, 'nowrap');
          assert.equal(metrics.overflow, 'hidden');
          assert(metrics.scrollTitle > metrics.client, 'long title is truncated');
          assert.equal(metrics.status.width, metrics.indicatorSize); assert.equal(metrics.priority.width, metrics.indicatorSize);
          assert.equal(metrics.menu.width, metrics.menuSize);
          if (kind === 'linked') assert(metrics.links > 0, 'linked title is rendered');
          if (properties) {
            assert(metrics.properties > 0 && metrics.propertyActions > 0, 'properties remain accessible');
            assert(metrics.metadataWidth <= available, 'metadata strip bounded by line');
            assert(metrics.metadataScroll > 0, 'properties scroll locally');
          } else {
            assert.equal(metrics.properties, 0);
            assert(metrics.menu.top < metrics.title.bottom && metrics.menu.bottom > metrics.title.top,
              'property-free menu stays on title line');
            assert(metrics.menu.left >= metrics.title.right, 'menu does not overlap title');
          }
          await page.screenshot({ path: path.join(process.env.EDITOR_EVIDENCE, `${kind}-${properties}-${available}.png`) });
        }
      }
    }
    console.log(`PASS: ${results.length} rendered cases at 390px, first-level/deep bullets, 286/160/128px lines.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
