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

  // Use obsidian:// URI to open specific vault
  const vaultUri = `obsidian://open?path=${encodeURIComponent(E2E_VAULT_DIR)}`;

  // Pass the vault path directly as an argument
  const obsidianProcess = spawn(obsidianBinary, [
    '--no-sandbox',
    `--remote-debugging-port=${remoteDebuggingPort}`,
    vaultUri,
  ], {
    cwd: UNPACKED_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      // Set home to a temp directory to avoid using user's vault config
      OBSIDIAN_CONFIG_DIR: path.join(PROJECT_ROOT, '.obsidian-config-e2e'),
    },
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

  // Handle "Trust this vault" dialog - this enables community plugins
  const trustButton = page.locator('button:has-text("Trust author and enable plugins")');
  if (await trustButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await trustButton.click();
    await page.waitForTimeout(2000);
  }

  // Alternative trust button text
  const trustButton2 = page.locator('button:has-text("Trust")');
  if (await trustButton2.isVisible({ timeout: 1000 }).catch(() => false)) {
    await trustButton2.click();
    await page.waitForTimeout(1000);
  }

  // Handle "Turn on community plugins" dialog if it appears
  const enablePluginsButton = page.locator('button:has-text("Turn on community plugins")');
  if (await enablePluginsButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await enablePluginsButton.click();
    await page.waitForTimeout(2000);
  }

  // Handle any "Enable" button for plugins
  const enableButton = page.locator('button:has-text("Enable community plugins")');
  if (await enableButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await enableButton.click();
    await page.waitForTimeout(1000);
  }

  // Wait for the workspace to be ready
  await page.waitForSelector('.workspace', { timeout: 30000 });

  // Wait for TaskNotes plugin to fully initialize
  // The plugin adds its sidebar items and commands after loading
  await page.waitForTimeout(2000);

  // Verify TaskNotes is loaded by checking for its ribbon icon or commands
  // Try to verify the plugin is active by checking command availability
  try {
    await page.keyboard.press('Control+p');
    await page.waitForSelector('.prompt', { timeout: 5000 });
    const promptInput = page.locator('.prompt-input');
    await promptInput.fill('TaskNotes');
    await page.waitForTimeout(500);
    const suggestion = page.locator('.suggestion-item');
    const hasSuggestions = await suggestion.first().isVisible({ timeout: 3000 }).catch(() => false);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    if (!hasSuggestions) {
      console.warn('Warning: TaskNotes commands not found. Plugin may not be loaded.');
    }
  } catch (e) {
    console.warn('Could not verify TaskNotes plugin status:', e);
  }

  return { browser, process: obsidianProcess, page };
}

export async function closeObsidian(app: ObsidianApp): Promise<void> {
  if (app.browser) {
    // Close all open tabs/pages before closing the browser
    for (const context of app.browser.contexts()) {
      for (const page of context.pages()) {
        await page.close().catch(() => {});
      }
    }
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
  // Clear any existing text in the prompt input
  const promptInput = page.locator('.prompt-input');
  await promptInput.fill('');
}

export async function runCommand(page: Page, command: string): Promise<void> {
  await openCommandPalette(page);
  // Type the command
  await page.keyboard.type(command, { delay: 30 });
  await page.waitForTimeout(500); // Wait for search to filter

  // Wait for suggestions to appear
  const suggestion = page.locator('.suggestion-item').first();
  try {
    await suggestion.waitFor({ timeout: 3000, state: 'visible' });
    await page.keyboard.press('Enter');
  } catch {
    // If no suggestions found, still try to press Enter and close palette
    await page.keyboard.press('Escape');
    throw new Error(`Command not found: "${command}". Make sure TaskNotes plugin is loaded.`);
  }
}

export async function waitForNotice(page: Page, text?: string): Promise<void> {
  const notice = page.locator('.notice');
  await notice.waitFor({ timeout: 10000 });
  if (text) {
    await notice.filter({ hasText: text }).waitFor({ timeout: 5000 });
  }
}
