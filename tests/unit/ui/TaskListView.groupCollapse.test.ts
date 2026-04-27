import { App, MockObsidian } from "../../__mocks__/obsidian";
import { TaskListView } from "../../../src/bases/TaskListView";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";

jest.mock("obsidian");
jest.mock(
	"tasknotes-nlp-core",
	() => ({
		NaturalLanguageParserCore: class {},
	}),
	{ virtual: true }
);
jest.mock("../../../src/bases/groupTitleRenderer", () => ({
	renderGroupTitle: jest.fn((container: HTMLElement, title: string) => {
		container.textContent = title;
	}),
}));

describe("TaskListView group collapse controls", () => {
	const createView = () => {
		const plugin = {
			app: new App(),
			fieldMapper: new FieldMapper(DEFAULT_FIELD_MAPPING),
			settings: {
				fieldMapping: DEFAULT_FIELD_MAPPING,
			},
		};
		const containerEl = document.createElement("div");
		document.body.appendChild(containerEl);
		const view = new TaskListView({}, containerEl, plugin as any);
		(view as any).app = {
			metadataCache: {
				getFirstLinkpathDest: jest.fn(() => null),
			},
			workspace: {},
		};
		return view;
	};

	beforeEach(() => {
		MockObsidian.reset();
		document.body.innerHTML = "";
	});

	afterEach(() => {
		document.body.innerHTML = "";
	});

	it("initializes new groups as collapsed when the default state is Collapsed", () => {
		const view = createView();
		(view as any).defaultCollapsedState = "Collapsed";

		(view as any).initializeCollapseStateForSnapshot(
			["Open"],
			new Map([["Open", ["Open:Urgent", "Open:Today"]]])
		);

		expect((view as any).collapsedGroups.has("Open")).toBe(true);
		expect((view as any).collapsedSubGroups.has("Open:Urgent")).toBe(true);
		expect((view as any).collapsedSubGroups.has("Open:Today")).toBe(true);
	});

	it("preserves restored ephemeral state over the default collapse seed on the first snapshot", () => {
		const view = createView();
		(view as any).defaultCollapsedState = "Collapsed";

		view.setEphemeralState({
			scrollTop: 0,
			collapsedGroups: ["Done"],
			collapsedSubGroups: ["Done:Later"],
		});

		(view as any).initializeCollapseStateForSnapshot(
			["Done", "Open"],
			new Map([
				["Done", ["Done:Later"]],
				["Open", ["Open:Urgent"]],
			])
		);

		expect((view as any).collapsedGroups.has("Done")).toBe(true);
		expect((view as any).collapsedSubGroups.has("Done:Later")).toBe(true);
		expect((view as any).collapsedGroups.has("Open")).toBe(false);
		expect((view as any).collapsedSubGroups.has("Open:Urgent")).toBe(false);
	});

	it("still applies the collapsed default when restored ephemeral state is empty", () => {
		const view = createView();
		(view as any).defaultCollapsedState = "Collapsed";

		view.setEphemeralState({
			scrollTop: 0,
			collapsedGroups: [],
			collapsedSubGroups: [],
		});

		(view as any).initializeCollapseStateForSnapshot(
			["Open"],
			new Map([["Open", ["Open:Urgent"]]])
		);

		expect((view as any).collapsedGroups.has("Open")).toBe(true);
		expect((view as any).collapsedSubGroups.has("Open:Urgent")).toBe(true);
	});

	it("reads defaultCollapsedState correctly from config.get", () => {
		const view = createView();
		(view as any).config = {
			get: jest.fn((key: string) => {
				// Bases returns array indices as strings for string[] dropdowns
				if (key === "defaultCollapsedState") return "1"; // "1" = "Collapsed"
				if (key === "enableSearch") return false;
				if (key === "expandedRelationshipFilterMode") return "0"; // "0" = "inherit"
				return undefined;
			}),
			getAsPropertyId: jest.fn(() => null),
		};

		(view as any).readViewOptions();

		expect((view as any).defaultCollapsedState).toBe("Collapsed");
	});

	it("collapses and expands subgroups within a primary group without affecting the parent", () => {
		const view = createView();
		(view as any).currentSubGroupKeysByParent = new Map([
			["Open", ["Open:Urgent", "Open:Today"]],
		]);

		(view as any).setSubGroupsCollapsed("Open", true);

		expect((view as any).collapsedGroups.has("Open")).toBe(false);
		expect((view as any).collapsedSubGroups.has("Open:Urgent")).toBe(true);
		expect((view as any).collapsedSubGroups.has("Open:Today")).toBe(true);

		(view as any).setSubGroupsCollapsed("Open", false);

		expect((view as any).collapsedGroups.has("Open")).toBe(false);
		expect((view as any).collapsedSubGroups.has("Open:Urgent")).toBe(false);
		expect((view as any).collapsedSubGroups.has("Open:Today")).toBe(false);
	});

	it("collapses and expands all primary groups without affecting subgroups", () => {
		const view = createView();
		(view as any).currentPrimaryGroupKeys = ["Open", "Done"];
		(view as any).currentSubGroupKeysByParent = new Map([
			["Open", ["Open:Urgent"]],
			["Done", ["Done:Later"]],
		]);

		(view as any).setAllPrimaryGroupsCollapsed(true);

		expect((view as any).collapsedGroups.has("Open")).toBe(true);
		expect((view as any).collapsedGroups.has("Done")).toBe(true);
		expect((view as any).collapsedSubGroups.size).toBe(0);

		(view as any).setAllPrimaryGroupsCollapsed(false);

		expect((view as any).collapsedGroups.size).toBe(0);
		expect((view as any).collapsedSubGroups.size).toBe(0);
	});

	it("collapses and expands all groups and subgroups together", () => {
		const view = createView();
		(view as any).currentPrimaryGroupKeys = ["Open", "Done"];
		(view as any).currentSubGroupKeysByParent = new Map([
			["Open", ["Open:Urgent"]],
			["Done", ["Done:Later"]],
		]);

		(view as any).setAllGroupsAndSubGroupsCollapsed(true);

		expect((view as any).collapsedGroups.has("Open")).toBe(true);
		expect((view as any).collapsedGroups.has("Done")).toBe(true);
		expect((view as any).collapsedSubGroups.has("Open:Urgent")).toBe(true);
		expect((view as any).collapsedSubGroups.has("Done:Later")).toBe(true);

		(view as any).setAllGroupsAndSubGroupsCollapsed(false);

		expect((view as any).collapsedGroups.size).toBe(0);
		expect((view as any).collapsedSubGroups.size).toBe(0);
	});
});