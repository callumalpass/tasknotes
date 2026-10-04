import { parse } from "yaml";
import { KanbanView } from "../../../src/bases/KanbanView";
import { StatusManager } from "../../../src/services/StatusManager";
import { PriorityManager } from "../../../src/services/PriorityManager";
import { getVisibleKanbanSwimLaneColumnKeys } from "../../../src/bases/kanbanGrouping";

const statuses = ["ready", "in-progress", "done", "inbox", "blocked", "next", "waiting", "ordered", "shipped", "received", "returned"];
const shopping = ["ordered", "shipped", "received", "returned"];

function makeView(yaml: string) {
	const statusConfigs = statuses.map((value, order) => ({
		id: value, value, label: value, color: "#808080", isCompleted: value === "done",
		order, autoArchive: false, autoArchiveDelay: 0,
	}));
	const plugin = {
		app: {},
		fieldMapper: { toUserField: (field: string) => field, isRecognizedProperty: () => true },
		statusManager: new StatusManager(statusConfigs, "ready"),
		priorityManager: new PriorityManager([]),
		settings: { customStatuses: statusConfigs, fieldMapping: { sortOrder: "tasknotes_manual_order" } },
	};
	const view = new KanbanView({}, document.createElement("div"), plugin as any) as any;
	const settings = parse(yaml).views[0];
	view.config = { get: (key: string) => settings[key] };
	view.readViewOptions();
	view.boardEl = document.createElement("div");
	view.getGroupByPropertyId = () => "note.status";
	view.getVisibleProperties = () => [];
	view.createColumn = jest.fn(async (key: string) => {
		const el = document.createElement("div");
		el.dataset.group = key;
		return el;
	});
	return view;
}

function base(placement: string, extra = "") {
	const indent = placement === "direct" ? "    " : "      ";
	return `views:\n  - type: tasknotesKanban\n    name: Purchase Board\n${placement === "direct" ? "" : `    ${placement}:\n`}${indent}hideEmptyColumns: true\n${indent}columnWidth: 300\n${indent}pinnedColumns: ordered, shipped, received, returned\n${extra}`;
}

function groups() {
	return new Map(statuses.map(key => [key, key === "received" ? [{ path: "Amazon.md", status: key }] : []]));
}

describe("Issue #2382: filtered Kanban boards with legacy nested settings", () => {
	it.each(["direct", "config", "options"])("renders only four shopping columns for %s settings", async placement => {
		const view = makeView(base(placement));
		const filteredGroups = groups();
		await view.renderFlat(filteredGroups, filteredGroups);
		expect([...view.boardEl.children].map((el: HTMLElement) => el.dataset.group)).toEqual(shopping);
		expect(view.boardEl.style.getPropertyValue("--kanban-column-width")).toBe("300px");
		const swimlanes = new Map([["Shopping", filteredGroups]]);
		expect(getVisibleKanbanSwimLaneColumnKeys(statuses, swimlanes, view.hideEmptyColumns, view.pinnedColumns)).toEqual(shopping);
	});

	it("lets direct false override nested hiding", async () => {
		const view = makeView(base("options", "    hideEmptyColumns: false\n"));
		const filteredGroups = groups();
		await view.renderFlat(filteredGroups, filteredGroups);
		expect(view.boardEl.children).toHaveLength(11);
	});

	it("lets direct empty pinning override legacy pins", async () => {
		const view = makeView(base("config", '    pinnedColumns: ""\n'));
		const filteredGroups = groups();
		await view.renderFlat(filteredGroups, filteredGroups);
		expect([...view.boardEl.children].map((el: HTMLElement) => el.dataset.group)).toEqual(["received"]);
	});

	it("does not treat pinned columns as a whitelist", async () => {
		const view = makeView(base("options"));
		const filteredGroups = groups();
		filteredGroups.set("ready", [{ path: "GTD.md", status: "ready" }]);
		await view.renderFlat(filteredGroups, filteredGroups);
		expect(view.createColumn.mock.calls.map(([key]: [string]) => key)).toContain("ready");
	});

	it("reads grouping and other options from legacy files", () => {
		const view = makeView(`views:\n  - type: tasknotesKanban\n    name: Board\n    config:\n      swimLane: formula.stage\n      explodeListColumns: false\n      columnOrder: '{"status":["received","ordered"]}'\n      wipLimits: '{"received":5}'\n    options:\n      enableSearch: true\n      hideTopLevelSubtasks: true\n`);
		expect(view.swimLanePropertyId).toBe("formula.stage");
		expect(view.explodeListColumns).toBe(false);
		expect(view.columnOrders).toEqual({ status: ["received", "ordered"] });
		expect(view.wipLimits).toEqual({ received: 5 });
		expect(view.enableSearch).toBe(true);
		expect(view.hideTopLevelSubtasks).toBe(true);
	});
});
