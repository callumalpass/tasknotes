/**
 * Inline conversion of a task line that names its note with a `[[path|note]]` link
 * (originally proposed in PR #1867).
 */
jest.unmock("rrule");

import { parse, stringify } from "yaml";
import { InstantTaskConvertService } from "../../../src/services/InstantTaskConvertService";
import { FieldMapper } from "../../../src/core/FieldMapper";
import { DEFAULT_FIELD_MAPPING, DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { MockObsidian, TFile } from "../../__mocks__/obsidian";
import { PluginFactory } from "../../helpers/mock-factories";

const NOTE_PATH = "Skills/Live technical storytelling with diagrams.md";
const NOTE_CONTENT = [
	"---",
	"type: skill",
	"status: open",
	"tags:",
	"  - interview",
	"---",
	"",
	"Existing notes about storytelling.",
	"",
].join("\n");

function splitNote(content: string): { frontmatter: Record<string, unknown>; body: string } {
	const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	return match
		? { frontmatter: parse(match[1]) ?? {}, body: match[2] }
		: { frontmatter: {}, body: content };
}

function createHarness(settings: Record<string, unknown> = {}, noteContent = NOTE_CONTENT) {
	const files = new Map<string, string>([[NOTE_PATH, noteContent]]);
	const noteFile = new TFile(NOTE_PATH);
	const sourceFile = new TFile("Inbox.md");

	const plugin = PluginFactory.createMockPlugin({
		settings: {
			...DEFAULT_SETTINGS,
			enableNaturalLanguageInput: false,
			useDefaultsOnInstantConvert: false,
			...settings,
		},
	});
	plugin.fieldMapper = new FieldMapper(DEFAULT_FIELD_MAPPING);
	plugin.app.workspace.getActiveFile = jest.fn(() => sourceFile);
	plugin.app.metadataCache.getFirstLinkpathDest = jest.fn((linkpath: string) =>
		`${linkpath}.md` === NOTE_PATH || linkpath === NOTE_PATH ? noteFile : null
	);
	plugin.app.fileManager.generateMarkdownLink = jest.fn(
		(file: TFile) => `[[${file.path.replace(/\.md$/, "")}]]`
	);
	plugin.app.vault.read = jest.fn(async (file: TFile) => files.get(file.path) ?? "");
	plugin.app.vault.process = jest.fn(
		async (file: TFile, update: (content: string) => string) => {
			const next = update(files.get(file.path) ?? "");
			files.set(file.path, next);
			return next;
		}
	);
	plugin.app.fileManager.processFrontMatter = jest.fn(
		async (file: TFile, update: (frontmatter: Record<string, unknown>) => void) => {
			const { frontmatter, body } = splitNote(files.get(file.path) ?? "");
			update(frontmatter);
			files.set(file.path, `---\n${stringify(frontmatter)}---\n${body}`);
		}
	);
	plugin.app.fileManager.trashFile = jest.fn();
	plugin.taskService = {
		createTask: jest.fn(async () => ({
			file: new TFile("TaskNotes/new.md"),
			taskInfo: {},
		})),
	};

	const service = new InstantTaskConvertService(
		plugin,
		plugin.statusManager,
		plugin.priorityManager
	);
	return { files, plugin, service, note: () => splitNote(files.get(NOTE_PATH) ?? "") };
}

function createEditor(lines: string[]) {
	return {
		getLine: jest.fn((line: number) => lines[line]),
		lineCount: jest.fn(() => lines.length),
		getSelection: jest.fn(() => ""),
		listSelections: jest.fn(() => []),
		replaceRange: jest.fn((text: string, from: { line: number }) => {
			lines[from.line] = text;
		}),
		getValue: jest.fn(() => lines.join("\n")),
	};
}

describe("InstantTaskConvertService: task lines that link their note", () => {
	beforeEach(() => {
		MockObsidian.reset();
	});

	it("reuses the linked note and adds only the task fields it is missing", async () => {
		const { plugin, service, note } = createHarness();
		const line =
			"- [ ] Live technical storytelling with diagrams #skill/interview [[Skills/Live technical storytelling with diagrams|note]] 📅 2026-05-08";
		const lines = [line];
		const editor = createEditor(lines);

		await service.instantConvertTask(editor as never, 0);

		expect(plugin.taskService.createTask).not.toHaveBeenCalled();
		const { frontmatter, body } = note();
		expect(frontmatter).toEqual(
			expect.objectContaining({
				type: "skill",
				status: "open",
				due: "2026-05-08",
				priority: "none",
			})
		);
		expect(frontmatter.tags).toEqual(["interview", "task", "skill/interview"]);
		expect(body).toBe("\nExisting notes about storytelling.\n");
		expect(lines[0]).toBe("- [[Skills/Live technical storytelling with diagrams]]");
	});

	it("keeps line text and selected details that the note does not hold", async () => {
		const { service, note } = createHarness();

		await (service as any).createTaskFile(
			{
				title: "Practise the opening [[Skills/Live technical storytelling with diagrams|note]]",
				isCompleted: false,
			},
			"  Use the whiteboard version"
		);

		expect(note().body).toBe(
			"\nExisting notes about storytelling.\n\nPractise the opening\n\nUse the whiteboard version\n"
		);
	});

	it("adds the identifying property alongside an existing value in property mode", async () => {
		const { service, note } = createHarness({
			taskIdentificationMethod: "property",
			taskPropertyName: "type",
			taskPropertyValue: "task",
		});

		await (service as any).createTaskFile(
			{
				title: "[[Skills/Live technical storytelling with diagrams|note]]",
				isCompleted: false,
			},
			""
		);

		expect(note().frontmatter.type).toEqual(["skill", "task"]);
		expect(note().frontmatter.tags).toEqual(["interview"]);
	});

	it("restores the note when the line cannot be replaced", async () => {
		const { files, plugin, service } = createHarness();
		const line = "- [ ] Review [[Skills/Live technical storytelling with diagrams|note]]";
		const lines = [line];
		const editor = createEditor(lines);
		editor.replaceRange.mockImplementation(() => {
			throw new Error("editor closed");
		});

		await service.instantConvertTask(editor as never, 0);

		expect(files.get(NOTE_PATH)).toBe(NOTE_CONTENT);
		expect(plugin.app.fileManager.trashFile).not.toHaveBeenCalled();
		expect(lines[0]).toBe(line);
	});

	it("creates a new task when the link does not resolve or has another alias", async () => {
		const { files, plugin, service } = createHarness();

		await (service as any).createTaskFile(
			{ title: "Review [[Missing/Note|note]]", isCompleted: false },
			""
		);
		await (service as any).createTaskFile(
			{
				title: "Review [[Skills/Live technical storytelling with diagrams|diagrams]]",
				isCompleted: false,
			},
			""
		);

		await (service as any).createTaskFile(
			{
				title: "Review ![[Skills/Live technical storytelling with diagrams|note]]",
				isCompleted: false,
			},
			""
		);

		expect(plugin.taskService.createTask).toHaveBeenCalledTimes(3);
		expect(files.get(NOTE_PATH)).toBe(NOTE_CONTENT);
	});

	it("keeps the note's value and records the line when they disagree", async () => {
		const { service, note } = createHarness(
			{},
			NOTE_CONTENT.replace("status: open\n", "status: open\ndue: 2026-10-01\n")
		);
		const lines = [
			"- [ ] Live technical storytelling with diagrams [[Skills/Live technical storytelling with diagrams|note]] 📅 2026-11-05",
		];

		await service.instantConvertTask(createEditor(lines) as never, 0);

		expect(note().frontmatter.due).toBe("2026-10-01");
		expect(note().body).toBe(
			"\nExisting notes about storytelling.\n\nLive technical storytelling with diagrams 📅 2026-11-05\n"
		);
	});

	it("keeps tags written as a string unless a tag has to be added", async () => {
		const tagged = NOTE_CONTENT.replace("tags:\n  - interview\n", "tags: interview, task\n");
		const { files, service } = createHarness({}, tagged);

		await (service as any).createTaskFile(
			{ title: "[[Skills/Live technical storytelling with diagrams|note]]", isCompleted: false },
			""
		);
		expect(files.get(NOTE_PATH)).toContain("tags: interview, task\n");

		await (service as any).createTaskFile(
			{
				title: "[[Skills/Live technical storytelling with diagrams|note]]",
				tags: ["demo"],
				isCompleted: false,
			},
			""
		);
		expect(splitNote(files.get(NOTE_PATH) ?? "").frontmatter.tags).toEqual([
			"interview",
			"task",
			"demo",
		]);
	});

	it("does not let NLP rename a checkbox task title that has inline fields", async () => {
		const { plugin, service } = createHarness({ enableNaturalLanguageInput: true });
		const lines = [
			"- [ ] Monthly skill review #skill/workflow [duration:: 30m] [scheduled:: 2026-05-08]",
		];

		await service.instantConvertTask(createEditor(lines) as never, 0);

		expect(plugin.taskService.createTask).toHaveBeenCalledWith(
			expect.objectContaining({ title: "Monthly skill review" })
		);
	});
});
