import { Page, chromium, Browser } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

const PROJECT_ROOT = path.resolve(__dirname, '..');
const UNPACKED_DIR = path.join(PROJECT_ROOT, '.obsidian-unpacked');
const E2E_VAULT_DIR = path.join(PROJECT_ROOT, 'tasknotes-e2e-vault');

export interface ObsidianApp {
  browser?: Browser;
  process?: ChildProcess;
  page: Page;
}

export async function launchObsidian(): Promise<ObsidianApp> {
  // Check that setup has been run
  const obsidianBinary = path.join(UNPACKED_DIR, 'obsidian');
  if (!fs.existsSync(obsidianBinary)) {
    throw new Error(
      'Obsidian unpacked directory not found. Run `npm run e2e:setup` first.'
    );
  }

  // Launch Obsidian manually and connect via CDP
  const remoteDebuggingPort = 9222;

  // Pass the vault path directly as an argument
  const obsidianProcess = spawn(obsidianBinary, [
    '--no-sandbox',
    `--remote-debugging-port=${remoteDebuggingPort}`,
    E2E_VAULT_DIR,
  ], {
    cwd: UNPACKED_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Wait for DevTools to be ready
  let cdpUrl = '';
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for DevTools')), 30000);

    obsidianProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        cdpUrl = match[1];
        clearTimeout(timeout);
        resolve();
      }
    });

    obsidianProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  console.log('Connecting to CDP:', cdpUrl);

  // Connect to Obsidian via CDP
  const browser = await chromium.connectOverCDP(cdpUrl);

  // Get the first page/context
  let contexts = browser.contexts();
  let page: Page;

  if (contexts.length > 0 && contexts[0].pages().length > 0) {
    page = contexts[0].pages()[0];
  } else {
    // Wait for a context and page to be created
    if (contexts.length === 0) {
      await new Promise<void>((resolve) => {
        const checkContexts = () => {
          contexts = browser.contexts();
          if (contexts.length > 0) {
            resolve();
          } else {
            setTimeout(checkContexts, 100);
          }
        };
        checkContexts();
      });
    }
    const context = contexts[0];
    if (context.pages().length > 0) {
      page = context.pages()[0];
    } else {
      page = await context.waitForEvent('page');
    }
  }

  // Wait for Obsidian to fully load
  await page.waitForLoadState('domcontentloaded');

  // Give Obsidian time to initialize
  await page.waitForTimeout(3000);

  // Handle "Trust this vault" dialog
  const trustButton = page.locator('button:has-text("Trust")');
  if (await trustButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await trustButton.click();
    await page.waitForTimeout(1000);
  }

  // Wait for the workspace to be ready
  await page.waitForSelector('.workspace', { timeout: 30000 });

  return { browser, process: obsidianProcess, page };
}

export async function closeObsidian(app: ObsidianApp): Promise<void> {
  if (app.browser) {
    await app.browser.close();
  }
  if (app.process) {
    app.process.kill();
  }
}

export async function openCommandPalette(page: Page): Promise<void> {
  // Use Ctrl+P to open command palette
  await page.keyboard.press('Control+p');
  await page.waitForSelector('.prompt', { timeout: 5000 });
}

export async function runCommand(page: Page, command: string): Promise<void> {
  await openCommandPalette(page);
  await page.keyboard.type(command, { delay: 50 });
  await page.waitForTimeout(300); // Wait for search to filter
  await page.keyboard.press('Enter');
}

export async function waitForNotice(page: Page, text?: string): Promise<void> {
  const notice = page.locator('.notice');
  await notice.waitFor({ timeout: 10000 });
  if (text) {
    await notice.filter({ hasText: text }).waitFor({ timeout: 5000 });
  }
}
