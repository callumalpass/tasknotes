import type { TFile } from "obsidian";
import {
	processVaultFile,
	processVaultFrontMatter,
} from "../../../src/core/VaultMutationService";

describe("VaultMutationService", () => {
	it("serializes frontmatter and content mutations for the same file", async () => {
		let releaseFirstWrite: (() => void) | undefined;
		const firstWriteGate = new Promise<void>((resolve) => {
			releaseFirstWrite = resolve;
		});
		const calls: string[] = [];
		const file = {} as TFile;
		const app = {
			fileManager: {
				processFrontMatter: jest.fn(async () => {
					calls.push("frontmatter:start");
					await firstWriteGate;
					calls.push("frontmatter:end");
				}),
			},
			vault: {
				process: jest.fn(async (_file: TFile, update: (content: string) => string) => {
					calls.push("content");
					return update("body");
				}),
			},
		};

		const first = processVaultFrontMatter(app, file, () => {});
		const second = processVaultFile(app, file, (content) => content);
		await Promise.resolve();
		await Promise.resolve();

		expect(app.fileManager.processFrontMatter).toHaveBeenCalledTimes(1);
		expect(app.vault.process).not.toHaveBeenCalled();
		releaseFirstWrite?.();
		await Promise.all([first, second]);
		expect(calls).toEqual(["frontmatter:start", "frontmatter:end", "content"]);
	});

	it("does not block mutations to different files", async () => {
		let releaseWrites: (() => void) | undefined;
		const writeGate = new Promise<void>((resolve) => {
			releaseWrites = resolve;
		});
		let activeWrites = 0;
		let maximumActiveWrites = 0;
		const app = {
			fileManager: {
				processFrontMatter: jest.fn(async () => {
					activeWrites += 1;
					maximumActiveWrites = Math.max(maximumActiveWrites, activeWrites);
					await writeGate;
					activeWrites -= 1;
				}),
			},
		};

		const first = processVaultFrontMatter(app, {} as TFile, () => {});
		const second = processVaultFrontMatter(app, {} as TFile, () => {});
		await Promise.resolve();
		await Promise.resolve();

		expect(app.fileManager.processFrontMatter).toHaveBeenCalledTimes(2);
		expect(maximumActiveWrites).toBe(2);
		releaseWrites?.();
		await Promise.all([first, second]);
	});

	it("continues a same-file queue after a failed mutation", async () => {
		const app = {
			fileManager: {
				processFrontMatter: jest
					.fn()
					.mockRejectedValueOnce(new Error("write failed"))
					.mockResolvedValueOnce(undefined),
			},
		};
		const file = {} as TFile;

		const first = processVaultFrontMatter(app, file, () => {});
		const second = processVaultFrontMatter(app, file, () => {});

		await expect(first).rejects.toThrow("write failed");
		await expect(second).resolves.toBeUndefined();
		expect(app.fileManager.processFrontMatter).toHaveBeenCalledTimes(2);
	});
});
