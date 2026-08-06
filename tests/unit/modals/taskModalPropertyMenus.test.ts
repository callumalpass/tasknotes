import {
	finalizeTaskModalChipListEditorValues,
	formatTaskModalChipListEditorLabel,
} from "../../../src/modals/taskModalChipListEditor";
import {
	showTaskModalContextsInput,
	showTaskModalTagsInput,
} from "../../../src/modals/taskModalPropertyMenus";

const mockShowTaskModalChipListEditor = jest.fn();

jest.mock("../../../src/modals/taskModalChipListEditor", () => {
	const actual = jest.requireActual("../../../src/modals/taskModalChipListEditor");
	return {
		...actual,
		showTaskModalChipListEditor: (...args: unknown[]) =>
			mockShowTaskModalChipListEditor(...args),
	};
});

function createPlugin() {
	return {
		app: {},
		settings: {
			taskTag: "task",
			taskIdentificationMethod: "tag",
			hideIdentifyingTagsInCards: false,
		},
		cacheManager: {
			getAllContexts: jest.fn(() => ["home", "office", "errands"]),
			getAllTags: jest.fn(() => ["review", "writing"]),
		},
	};
}

function createMenuContext(overrides: Partial<Parameters<typeof showTaskModalContextsInput>[0]> = {}) {
	return {
		plugin: createPlugin() as never,
		translate: (key: string, params?: Record<string, string | number>) =>
			params ? `${key}:${JSON.stringify(params)}` : key,
		getContexts: () => "home, office",
		setContexts: jest.fn(),
		getTags: () => "review, writing",
		setTags: jest.fn(),
		getTimeEstimate: () => 0,
		setTimeEstimate: jest.fn(),
		onChange: jest.fn(),
		...overrides,
	};
}

describe("taskModalPropertyMenus", () => {
	beforeEach(() => {
		mockShowTaskModalChipListEditor.mockReset();
	});

	it("opens the contexts chip editor with current values", async () => {
		const context = createMenuContext();
		mockShowTaskModalChipListEditor.mockResolvedValue(null);

		await showTaskModalContextsInput(context);

		expect(mockShowTaskModalChipListEditor).toHaveBeenCalledWith(
			context.plugin.app,
			context.plugin,
			expect.objectContaining({
				title: "modals.task.contextsLabel",
				placeholder: "contextMenus.task.organization.addContext",
				variant: "contexts",
				initialValues: ["home", "office"],
			}),
			["home", "office"]
		);
	});

	it("saves updated contexts from the chip editor", async () => {
		const context = createMenuContext();
		mockShowTaskModalChipListEditor.mockResolvedValue(["home", "errands"]);

		await showTaskModalContextsInput(context);

		expect(context.setContexts).toHaveBeenCalledWith("home, errands");
		expect(context.onChange).toHaveBeenCalled();
	});

	it("opens the tags chip editor with current values", async () => {
		const context = createMenuContext();
		mockShowTaskModalChipListEditor.mockResolvedValue(null);

		await showTaskModalTagsInput(context);

		expect(mockShowTaskModalChipListEditor).toHaveBeenCalledWith(
			context.plugin.app,
			context.plugin,
			expect.objectContaining({
				title: "modals.task.tagsLabel",
				placeholder: "contextMenus.task.addTag",
				variant: "tags",
				initialValues: ["review", "writing"],
			}),
			["review", "writing"]
		);
	});
});

describe("taskModalChipListEditor helpers", () => {
	it("formats tag chip labels with a hash prefix", () => {
		expect(formatTaskModalChipListEditorLabel("tags", "review")).toBe("#review");
		expect(formatTaskModalChipListEditorLabel("contexts", "home")).toBe("home");
	});

	it("finalizes chip editor values including pending input", () => {
		expect(
			finalizeTaskModalChipListEditorValues(["home"], "office, errands", "contexts")
		).toEqual(["home", "office", "errands"]);

		expect(finalizeTaskModalChipListEditorValues(["review"], "writing", "tags")).toEqual([
			"review",
			"writing",
		]);
	});
});
