import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const generator = fileURLToPath(new URL('../../generate-release-notes-import.mjs', import.meta.url));

test('an untagged current release is bundled before older releases', () => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'tasknotes-release-notes-'));
  try {
    mkdirSync(path.join(fixture, 'docs/releases'), { recursive: true });
    mkdirSync(path.join(fixture, 'src'));
    writeFileSync(path.join(fixture, 'manifest.json'), JSON.stringify({ version: '5.0.0-beta.7' }));
    for (const version of ['4.14.0', '5.0.0-beta.6', '5.0.0-beta.7']) {
      writeFileSync(path.join(fixture, `docs/releases/${version}.md`), `# ${version}\n`);
    }
    const result = spawnSync(process.execPath, [generator], {
      cwd: fixture,
      encoding: 'utf8',
      // Do not let an inherited Git worktree override the isolated fixture.
      env: { ...process.env, GIT_DIR: path.join(fixture, 'no-git-repository') },
    });
    assert.equal(result.status, 0, result.stderr);
    const generated = readFileSync(path.join(fixture, 'src/releaseNotes.ts'), 'utf8');
    assert.match(generated, /import releaseNotes0 from "\.\.\/docs\/releases\/5\.0\.0-beta\.7\.md"/);
    assert.match(generated, /version: "5\.0\.0-beta\.7",\s+content: releaseNotes0,\s+date: null,\s+isCurrent: true/);
    assert.ok(!generated.includes('4.14.0'), 'older major releases stay outside the bundle');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
