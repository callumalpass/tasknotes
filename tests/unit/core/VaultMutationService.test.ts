import type { TFile } from "obsidian";
import {
	processVaultFile,
	processVaultFrontMatter,
} from "../../../src/core/VaultMutationService";

describe("VaultMutationService", () => {
	function writeFixture() {
		const file = { path: "Tasks/task.md" } as TFile;
		const original = "---\ntags: [task]\n---\nOriginal body\n";
		const files = new Map([[file.path, original]]);
		const read = jest.fn(async (path: string) => {
			const content = files.get(path);
			if (content === undefined) throw new Error(`Missing file: ${path}`);
			return content;
		});
		const write = jest.fn(async (path: string, content: string) => { files.set(path, content); });
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
			vault: { configDir: ".obsidian", adapter: { read, write }, process },
		};
		const timeout = Object.assign(new Error("ETIMEDOUT: connection timed out, write"), {
			code: "ETIMEDOUT",
		});
		/** Make writes to the task truncate it and time out; other writes succeed. */
		const failTaskWrites = () => {
			const normalWrite = write.getMockImplementation()!;
			write.mockImplementation(async (path, content) => {
				if (path !== file.path) return normalWrite(path, content);
				files.set(path, "");
				throw timeout;
			});
		};
		const recoveryCopies = () => [...files.keys()].filter((path) => path.startsWith(".obsidian/"));
		return {
			app, file, files, original, process, processFrontMatter, read, timeout, write,
			failTaskWrites, recoveryCopies,
		};
	}

	it("adds no file writes when a frontmatter write succeeds", async () => {
		const { app, file, files, read, write } = writeFixture();

		await processVaultFrontMatter(app, file, () => {});

		expect(write.mock.calls.map(([path]) => path)).toEqual([file.path]);
		expect(read).toHaveBeenCalledTimes(1);
		expect([...files.keys()]).toEqual([file.path]);
	});

	it("adds no file reads or writes when a content write succeeds", async () => {
		const { app, file, files, read, write } = writeFixture();

		await processVaultFile(app, file, (content) => content + "More\n");

		expect(write.mock.calls.map(([path]) => path)).toEqual([file.path]);
		expect(read).toHaveBeenCalledTimes(1);
		expect(files.get(file.path)).toMatch(/More\n$/);
	});

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

	it("restores a note emptied by a failed content write", async () => {
		const { app, file, files, original, process, timeout } = writeFixture();
		process.mockImplementationOnce(async (_target, update) => {
			update(original);
			files.set(file.path, "");
			throw timeout;
		});

		await expect(processVaultFile(app, file, (content) => content + "New body")).rejects.toBe(timeout);
		expect([...files]).toEqual([[file.path, original]]);
	});

	it("rethrows without a copy when the update fails before writing", async () => {
		const { app, file, files, original } = writeFixture();
		const failure = new Error("Invalid update");

		await expect(processVaultFile(app, file, () => { throw failure; })).rejects.toBe(failure);
		expect([...files]).toEqual([[file.path, original]]);
	});

	it("saves a recovery copy when the original and recovery writes time out", async () => {
		const { app, file, files, original, timeout, failTaskWrites, recoveryCopies } = writeFixture();
		failTaskWrites();

		const error = await processVaultFile(app, file, (content) => content + "New body").catch(
			(error: unknown) => error
		);
		const [copy] = recoveryCopies();

		expect(copy).toMatch(/^\.obsidian\/tasknotes-recovery-.+-task\.md$/);
		expect(files.get(copy)).toBe(original);
		expect(error).toEqual(expect.objectContaining({
			message: `ETIMEDOUT: connection timed out, write; TaskNotes could not confirm the note was restored. Previous contents saved in ${copy}`,
			cause: timeout,
			code: "ETIMEDOUT",
			recoveryError: timeout,
			recoveryPath: copy,
		}));
	});

	it("logs the previous contents when no recovery copy can be saved", async () => {
		const { app, file, files, original, timeout, write, recoveryCopies } = writeFixture();
		write.mockImplementation(async (path) => {
			if (path === file.path) files.set(path, "");
			throw timeout;
		});
		const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
		const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});

		try {
			await expect(processVaultFrontMatter(app, file, () => {})).rejects.toThrow(
				"could not confirm the note was restored or save a recovery copy"
			);
			expect(recoveryCopies()).toEqual([]);
			expect(consoleError).toHaveBeenCalledWith(
				expect.stringContaining("recover-failed-write"),
				expect.objectContaining({ path: file.path, previousContent: original }),
				timeout
			);
		} finally {
			consoleError.mockRestore();
			consoleWarn.mockRestore();
		}
	});

	it.each(["", "An independent edit"])("does not overwrite divergence (initial read %j)", async (readback) => {
		const { app, file, files, original, process, processFrontMatter, timeout, recoveryCopies } = writeFixture();
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
			"Previous contents saved in .obsidian/tasknotes-recovery-"
		);
		expect(files.get(file.path)).toBe(independentEdit);
		expect(recoveryCopies().map((copy) => files.get(copy))).toEqual([original]);
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
