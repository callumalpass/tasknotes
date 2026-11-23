import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { closeObsidian, launchObsidian } from "../obsidian";

const vaultRoot = path.resolve(
	process.env.TASKNOTES_E2E_VAULT_DIR ?? path.join(__dirname, "../../tasknotes-e2e-vault")
);
const relativeDataPath = ".obsidian/plugins/tasknotes/data.json";
const dataPath = path.join(vaultRoot, relativeDataPath);

test("retries a timed-out settings read even when the file appears absent", async () => {
	const instance = await launchObsidian();
	const { page } = instance;
	try {
		const originalData = fs.readFileSync(dataPath, "utf8");
		await page.evaluate(async () => {
			const { plugins } = (window as any).app;
			await plugins.disablePlugin("tasknotes");
		});
		try {
			const propertyName = "issue2645Fixture";
			fs.writeFileSync(
				dataPath,
				JSON.stringify({ ...JSON.parse(originalData), taskPropertyName: propertyName })
			);

			const result = await page.evaluate(async (targetPath) => {
				const { plugins, vault } = (window as any).app;
				const { adapter } = vault;
				const originalRead = adapter.read;
				const originalExists = adapter.exists;
				let reads = 0;
				adapter.read = async function (filePath: string) {
					if (filePath === targetPath && ++reads === 1) {
						throw Object.assign(new Error("Simulated settings read timeout"), {
							code: "ETIMEDOUT",
						});
					}
					return originalRead.call(this, filePath);
				};
				adapter.exists = async function (filePath: string, insensitive?: boolean) {
					if (filePath === targetPath && reads === 1) return false;
					return originalExists.call(this, filePath, insensitive);
				};
				try {
					await plugins.enablePlugin("tasknotes");
					return {
						reads,
						propertyName: plugins.plugins.tasknotes?.settings?.taskPropertyName,
					};
				} finally {
					adapter.read = originalRead;
					adapter.exists = originalExists;
				}
			}, relativeDataPath);

			expect(result.reads).toBeGreaterThanOrEqual(2);
			expect(result.propertyName).toBe(propertyName);
			await expect(
				page.locator(".notice").filter({ hasText: "TaskNotes did not start" })
			).toHaveCount(0);
		} finally {
			await page.evaluate(() => (window as any).app.plugins.disablePlugin("tasknotes"));
			fs.writeFileSync(dataPath, originalData);
			await page.evaluate(() => (window as any).app.plugins.enablePlugin("tasknotes"));
		}
	} finally {
		await closeObsidian(instance);
	}
});
