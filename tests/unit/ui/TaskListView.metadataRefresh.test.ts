import { App, MockObsidian } from "../../helpers/obsidian-runtime";
import { TaskListView } from "../../../src/bases/TaskListView";
import { FieldMapper } from "../../../src/services/FieldMapper";
import { DEFAULT_FIELD_MAPPING } from "../../../src/settings/defaults";
import { TaskFactory } from "../../helpers/mock-factories";
import { createTaskCard } from "../../../src/ui/TaskCard";
import { getTaskCardPropertyValue } from "../../../src/ui/taskCardPropertyAccess";
import type { TaskInfo } from "../../../src/types";

jest.mock("tasknotes-nlp-core", () => ({ NaturalLanguageParserCore: class {} }), { virtual: true });
jest.mock("../../../src/ui/TaskCard", () => ({
	createTaskCard: jest.fn(),
}));

describe("TaskListView metadata refresh", () => {
	let view: any;
	let container: HTMLElement;

	beforeEach(() => {
		jest.useFakeTimers();
		MockObsidian.reset();
		container = document.createElement("div");
		document.body.appendChild(container);
		const plugin = {
			app: new App(),
			fieldMapper: new FieldMapper(DEFAULT_FIELD_MAPPING),
			settings: { fieldMapping: DEFAULT_FIELD_MAPPING },
		};
		view = new TaskListView({}, container, plugin as any);
		view.itemsContainer = container;
		view.configureCardForManualReordering = jest.fn();
		jest.mocked(createTaskCard).mockImplementation((task, plugin, properties = []) => {
			const card = document.createElement("div");
			card.className = "task-card";
			card.textContent = JSON.stringify(properties.map((property) =>
				getTaskCardPropertyValue(task, property, plugin)
			));
			return card;
		});
	});

	afterEach(() => {
		view.destroyVirtualScroller();
		jest.clearAllTimers();
		jest.useRealTimers();
		jest.clearAllMocks();
		document.body.innerHTML = "";
	});

	it.each(["renderFlatNormal", "renderFlatVirtual"])(
		"%s refreshes added, replaced and cleared metadata without changing path or order",
		async (renderMethod) => {
			let task = TaskFactory.createTask({ contexts: ["home"], tags: ["original"] });
			const properties = ["contexts", "tags"];
			await view[renderMethod]([task], properties, {});
			expect(container.querySelector(".task-card")?.textContent).toBe('[["home"],["original"]]');
			for (const patch of [
				{ contexts: ["work"], tags: ["original", "added"] },
				{ contexts: [], tags: [] },
			]) {
				task = { ...task, ...patch };
				await view[renderMethod]([task], properties, {});
				expect(container.querySelector(".task-card")?.textContent).toBe(
					JSON.stringify([patch.contexts, patch.tags])
				);
			}
		}
	);

	it.each(["file.tags", "formula.summary", "arbitraryField"])(
		"refreshes lazy %s values even when TaskInfo is unchanged",
		async (property) => {
			let value = "before";
			const basesData = { getValue: () => value };
			// Real Bases entries may contain cycles; they must not be serialized.
			Object.assign(basesData, { self: basesData });
			const task = TaskFactory.createTask({ basesData, customProperties: undefined });
			await view.renderFlatNormal([task], [property], {});
			expect(container.textContent).toBe('["before"]');
			value = "after";
			await view.renderFlatNormal([task], [property], {});
			expect(container.textContent).toBe('["after"]');
		}
	);

	it("refreshes properties read directly from the metadata cache", async () => {
		const frontmatter = { external: "before" };
		jest.spyOn(view.plugin.app.metadataCache, "getCache").mockReturnValue({ frontmatter });
		const task = TaskFactory.createTask({ basesData: undefined, customProperties: undefined });
		await view.renderFlatNormal([task], ["external"], {});
		expect(container.textContent).toBe('["before"]');
		frontmatter.external = "after";
		await view.renderFlatNormal([task], ["external"], {});
		expect(container.textContent).toBe('["after"]');
	});

	it("refreshes through the debounced Bases data-update lifecycle", async () => {
		let task = TaskFactory.createTask({ contexts: ["home"] });
		view.rootElement = container;
		view.updateRelevantPathsCache = jest.fn();
		view.render = () => view.renderFlatNormal([task], ["contexts"], {});
		await view.render();
		task = { ...task, contexts: [] };
		view.onDataUpdated();
		await jest.advanceTimersByTimeAsync(500);
		expect(container.textContent).toBe("[[]]");
	});

	it("reuses cards when data and resolved properties have not changed", async () => {
		const task = TaskFactory.createTask({ contexts: ["home"] });
		await view.renderFlatNormal([task], ["contexts"], {});
		const card = container.firstElementChild;
		await view.renderFlatNormal([{ ...task, contexts: ["home"] }], ["contexts"], {});
		expect(container.firstElementChild).toBe(card);
		expect(createTaskCard).toHaveBeenCalledTimes(1);
	});

	it.each<Partial<TaskInfo>>([
		{ projects: ["project.md"] },
		{ timeEstimate: 42 },
		{ customProperties: { nested: { value: "changed" } } },
		{ isBlocked: true },
		{ hasSubtasks: true },
		{ skipped_instances: ["2026-01-01"] },
		{ timeEntries: [{ startTime: "2026-01-01T12:00:00Z" }] },
	])("invalidates cards for changed task data: %j", async (patch) => {
		const task = TaskFactory.createTask();
		await view.renderFlatNormal([task], [], {});
		const card = container.firstElementChild;
		await view.renderFlatNormal([{ ...task, ...patch }], [], {});
		expect(container.firstElementChild).not.toBe(card);
	});

	it("detects same-length array edits and in-place nested edits", async () => {
		const task = TaskFactory.createTask({
			blocking: ["first.md"],
			customProperties: { nested: { value: "before" } },
		});
		await view.renderFlatNormal([task], [], {});
		const firstCard = container.firstElementChild;
		task.blocking = ["second.md"];
		await view.renderFlatNormal([task], [], {});
		expect(container.firstElementChild).not.toBe(firstCard);
		const secondCard = container.firstElementChild;
		(task.customProperties!.nested as { value: string }).value = "after";
		await view.renderFlatNormal([task], [], {});
		expect(container.firstElementChild).not.toBe(secondCard);
	});
});
