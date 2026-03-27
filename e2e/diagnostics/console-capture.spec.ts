/**
 * Console Capture Diagnostic Test
 *
 * This test launches Obsidian and captures all console output for debugging.
 * Useful for investigating initialization issues, race conditions, and logging.
 *
 * Run with: npm run e2e -- e2e/diagnostics/console-capture.spec.ts
 *
 * Output is written to: test-results/console-capture.log
 */

import { test } from "@playwright/test";
import { launchObsidian, closeObsidian, ObsidianApp } from "../obsidian";
import * as fs from "fs";
import * as path from "path";

let app: ObsidianApp;
const consoleLogs: string[] = [];
const OUTPUT_DIR = "test-results";
const OUTPUT_FILE = "console-capture.log";

test.describe("Console Capture Diagnostics", () => {
	test.beforeAll(async () => {
		// Ensure output directory exists
		if (!fs.existsSync(OUTPUT_DIR)) {
			fs.mkdirSync(OUTPUT_DIR, { recursive: true });
		}

		app = await launchObsidian();

		// Capture all console messages
		app.page.on("console", (msg) => {
			const timestamp = new Date().toISOString();
			const type = msg.type().toUpperCase().padEnd(7);
			const text = msg.text();
			const logLine = `[${timestamp}] [${type}] ${text}`;
			consoleLogs.push(logLine);

			// Also print to test output for live viewing
			console.log(logLine);
		});

		// Capture page errors
		app.page.on("pageerror", (error) => {
			const timestamp = new Date().toISOString();
			const logLine = `[${timestamp}] [PAGEERR] ${error.message}\n${error.stack}`;
			consoleLogs.push(logLine);
			console.error(logLine);
		});
	});

	test.afterAll(async () => {
		// Write captured logs to file
		const outputPath = path.join(OUTPUT_DIR, OUTPUT_FILE);
		const header = `# Console Capture Log\n# Generated: ${new Date().toISOString()}\n# Total entries: ${consoleLogs.length}\n\n`;
		fs.writeFileSync(outputPath, header + consoleLogs.join("\n"));
		console.log(`\n=== Wrote ${consoleLogs.length} log entries to ${outputPath} ===`);

		if (app) {
			await closeObsidian(app);
		}
	});

	test("capture startup logs (10s)", async () => {
		const page = app.page;

		// Wait for plugin initialization
		console.log("\n=== Waiting 10 seconds for plugin initialization ===");
		await page.waitForTimeout(10000);

		// Summary of captured logs
		console.log("\n=== Log Summary ===");
		console.log(`Total entries: ${consoleLogs.length}`);

		// Count by type
		const byType = consoleLogs.reduce(
			(acc, log) => {
				if (log.includes("[LOG    ]")) acc.log++;
				else if (log.includes("[WARN   ]")) acc.warn++;
				else if (log.includes("[ERROR  ]")) acc.error++;
				else if (log.includes("[INFO   ]")) acc.info++;
				else acc.other++;
				return acc;
			},
			{ log: 0, warn: 0, error: 0, info: 0, other: 0 }
		);
		console.log(`By type: ${JSON.stringify(byType)}`);

		// Filter for specific tags
		const taskNotesLogs = consoleLogs.filter(
			(l) =>
				l.includes("TaskNotes") ||
				l.includes("BasesQueryWatcher") ||
				l.includes("BasesViewBase") ||
				l.includes("[TN") ||
				l.includes("DebugLog")
		);
		console.log(`TaskNotes-related entries: ${taskNotesLogs.length}`);
	});

	test("capture BasesQueryWatcher logs", async () => {
		const page = app.page;

		// Give more time for watcher to initialize
		await page.waitForTimeout(5000);

		// Filter for BasesQueryWatcher logs
		const watcherLogs = consoleLogs.filter((l) => l.includes("BasesQueryWatcher"));

		console.log("\n=== BasesQueryWatcher Logs ===");
		if (watcherLogs.length === 0) {
			console.log("No BasesQueryWatcher logs found (this may indicate the watcher is not logging)");
		} else {
			watcherLogs.forEach((l) => console.log(l));
		}

		// Also check for "monitoring" message
		const monitoringLogs = consoleLogs.filter((l) => l.toLowerCase().includes("monitoring"));
		console.log("\n=== Monitoring-related Logs ===");
		monitoringLogs.forEach((l) => console.log(l));
	});

	test("capture errors and warnings", async () => {
		const errorLogs = consoleLogs.filter(
			(l) => l.includes("[ERROR  ]") || l.includes("[WARN   ]") || l.includes("[PAGEERR]")
		);

		console.log("\n=== Errors and Warnings ===");
		if (errorLogs.length === 0) {
			console.log("No errors or warnings captured");
		} else {
			errorLogs.forEach((l) => console.log(l));
		}
	});

	test("filter by custom tag", async () => {
		// This test allows filtering by any tag - useful for targeted debugging
		const targetTag = process.env.DEBUG_TAG || "BasesQueryWatcher";

		const filteredLogs = consoleLogs.filter((l) =>
			l.toLowerCase().includes(targetTag.toLowerCase())
		);

		console.log(`\n=== Logs matching "${targetTag}" ===`);
		if (filteredLogs.length === 0) {
			console.log(`No logs found matching "${targetTag}"`);
		} else {
			filteredLogs.forEach((l) => console.log(l));
		}
	});
});
