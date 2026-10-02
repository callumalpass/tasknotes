jest.mock("obsidian", () => ({
	...jest.requireActual("obsidian"),
	BasesEntry: class { constructor(_context: unknown, public file: { path: string }) {} },
}));
import { firstPopulatedRelationshipView, initializeRelationshipViewSelection } from "../../../src/editor/relationshipViewSelection";

function fixture() {
	let listener: () => void = () => {};
	const controller = {
		viewName: "Subtasks",
		query: { views: [{ name: "Subtasks" }, { name: "Blocked By" }] },
		buildBasesContext: jest.fn((filters) => ({ filter: { test: (entry: any) => entry.file.path === filters } })),
		selectView: jest.fn((name: string) => { controller.viewName = name; }),
		events: { on: jest.fn((_name, callback) => { listener = callback; return {}; }), offref: jest.fn() },
	};
	controller.query.views = [{ name: "Subtasks", filters: "missing.md" }, { name: "Blocked By", filters: "blocker.md" }] as any;
	const disposers: Array<() => void> = [];
	const component = { _children: [{ controller }], register: (dispose: () => void) => disposers.push(dispose) };
	const plugin = { app: { vault: { getMarkdownFiles: () => [{ path: "blocker.md" }] }, metadataCache: { isUserIgnored: () => false } } };
	return { controller, component, plugin, disposers, select: (name: string) => { controller.viewName = name; listener(); } };
}

describe("relationship view selection", () => {
	it("selects the first populated host-filtered view, ignoring excluded files", () => {
		const { controller } = fixture();
		const files = [{ path: "missing.md" }, { path: "blocker.md" }];
		expect(firstPopulatedRelationshipView(controller as never, files as never, path => path === "missing.md", (_ctx, file) => ({ file }) as never)).toBe("Blocked By");
	});
	it("keeps explicit empty-view selection when the widget is recreated", () => {
		const f = fixture();
		initializeRelationshipViewSelection(f.plugin as never, "note.md", document.createElement("div"), f.component as never);
		expect(f.controller.selectView).toHaveBeenLastCalledWith("Blocked By");
		f.select("Subtasks");
		f.disposers.forEach(dispose => dispose());
		initializeRelationshipViewSelection(f.plugin as never, "note.md", document.createElement("div"), f.component as never);
		expect(f.controller.selectView).toHaveBeenLastCalledWith("Subtasks");
		f.disposers.forEach(dispose => dispose());
	});
	it("retains the default when all views are empty", () => {
		const f = fixture();
		f.plugin.app.vault.getMarkdownFiles = () => [];
		initializeRelationshipViewSelection(f.plugin as never, "note.md", document.createElement("div"), f.component as never);
		expect(f.controller.selectView).not.toHaveBeenCalled();
		f.disposers.forEach(dispose => dispose());
	});
});
