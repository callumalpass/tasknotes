import type { TFile } from "obsidian";
import {
	processVaultFile,
	processVaultFrontMatter,
} from "../../../src/core/VaultMutationService";

describe("VaultMutationService", () => {
	function writeFixture() {
		const file = { path: "task.md" } as TFile;
		const original = "---\ntags: [task]\n---\nOriginal body\n";
		const files = new Map([[file.path, original]]);
		const read = jest.fn(async (path: string) => {
			const content = files.get(path);
			if (content === undefined) throw new Error(`Missing file: ${path}`);
			return content;
		});
		const write = jest.fn(async (path: string, content: string) => { files.set(path, content); });
		const remove = jest.fn(async (path: string) => { files.delete(path); });
		const process = jest.fn(async (target: TFile, update: (content: string) => string) => {
			const content = update(await read(target.path));
			await write(target.path, content);
			return content;
		});
		const processFrontMatter = jest.fn(async (_target: TFile, update: (frontmatter: Record<string, unknown>) => void) => {
			update({});
			await write(file.path, original.replace("tags:", "priority: high\ntags:"));
		});
		const app = {
			fileManager: { processFrontMatter },
			vault: { configDir: ".obsidian", adapter: { read, write, remove }, process },
		};
		const timeout = Object.assign(new Error("ETIMEDOUT: connection timed out, write"), {
			code: "ETIMEDOUT",
		});
		return { app, file, files, original, process, processFrontMatter, timeout, write };
	}

	it("restores the exact bytes if a frontmatter write truncates the note and times out", async () => {
		const { app, file, files, original, processFrontMatter, timeout } = writeFixture();
		const originalWithBom = "\uFEFF" + original.replaceAll("\n", "\r\n");
		files.set(file.path, originalWithBom);
		processFrontMatter.mockImplementationOnce(async () => {
			files.set(file.path, "");
			throw timeout;
		});

		await expect(processVaultFrontMatter(app, file, () => {})).rejects.toBe(timeout);
		expect([...files]).toEqual([[file.path, originalWithBom]]);
	});

	it("retains a verified copy when the original and recovery writes time out", async () => {
		const { app, file, files, original, timeout, write } = writeFixture();
		const normalWrite = write.getMockImplementation()!;
		write.mockImplementation(async (path, content) => {
			if (path !== file.path) return normalWrite(path, content);
			files.set(path, "");
			throw timeout;
		});
		const error = await processVaultFile(app, file, (content) => content + "New body").catch(
			(error: unknown) => error
		);
		const backup = [...files.keys()].find((path) => path.endsWith(".bak"))!;

		expect(error).toEqual(expect.objectContaining({
			message: expect.stringContaining(backup),
			cause: timeout,
			recoveryError: timeout,
		}));
		expect(JSON.parse(files.get(backup)!)).toEqual({ path: file.path, content: original });
	});

	it.each(["", "An independent edit"])("does not overwrite divergence (initial read %j)", async (readback) => {
		const { app, file, files, original, process, processFrontMatter, timeout } = writeFixture();
		const independentEdit = "An independent edit";
		processFrontMatter.mockImplementationOnce(async () => {
			files.set(file.path, readback);
			throw timeout;
		});
		process.mockImplementationOnce(async (_file, update) => {
			const content = update(independentEdit);
			files.set(file.path, content);
			return content;
		});

		await expect(processVaultFrontMatter(app, file, () => {})).rejects.toThrow(
			"previous task contents saved"
		);
		expect(files.get(file.path)).toBe(independentEdit);
		expect([...files.values()]).toContain(JSON.stringify({ path: file.path, content: original }));
	});

	it("does not attempt the task write when the recovery snapshot cannot be verified", async () => {
		const { app, file, files, original, processFrontMatter, write } = writeFixture();
		write.mockImplementationOnce(async (path) => { files.set(path, ""); });

		await expect(processVaultFrontMatter(app, file, () => {})).rejects.toThrow(
			"TaskNotes recovery copy could not be verified"
		);
		expect(processFrontMatter).not.toHaveBeenCalled();
		expect([...files]).toEqual([[file.path, original]]);
	});

	it("does not attempt the task write after an external change during backup", async () => {
		const { app, file, files, processFrontMatter, write } = writeFixture();
		write.mockImplementationOnce(async (path, content) => {
			files.set(path, content);
			files.set(file.path, "Newer edit");
		});

		await expect(processVaultFrontMatter(app, file, () => {})).rejects.toThrow(
			"Task changed while preparing its write"
		);
		expect(processFrontMatter).not.toHaveBeenCalled();
		expect([...files]).toEqual([[file.path, "Newer edit"]]);
	});

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
				adapter: { read: jest.fn(async () => "---\ntitle: x\n---\n") },
				process: jest.fn(async (_file: TFile, update: (content: string) => string) => {
					calls.push("content");
					return update("body");
				}),
			},
		};

		const first = processVaultFrontMatter(app, file, () => {});
		const second = processVaultFile(app, file, (content) => content);
		await new Promise((resolve) => setTimeout(resolve, 0));

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

	it("edits frontmatter behind a byte order mark instead of adding a second block", async () => {
		let content = "\uFEFF---\ntags:\n  - task\n---\nBody\n";
		const file = {} as TFile;
		const app = {
			fileManager: {
				// Like Obsidian: frontmatter only counts at the very start of the file.
				processFrontMatter: jest.fn(async () => {
					if (!content.startsWith("---\n")) content = "---\npriority: high\n---\n" + content;
					else content = content.replace("---\n", "---\npriority: high\n");
				}),
			},
			vault: {
				adapter: { read: jest.fn(async () => content) },
				process: jest.fn(async (_file: TFile, update: (current: string) => string) => (content = update(content))),
			},
		};

		await processVaultFrontMatter(app, file, () => {});

		expect(content).toBe("---\npriority: high\ntags:\n  - task\n---\nBody\n");
	});
});
