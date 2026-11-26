import { observeTranslation as mockObserveTranslation } from "../../helpers/real-i18n";
import type { BasesEntry, BasesViewConfig } from "obsidian";
import type TaskNotesPlugin from "../../../src/main";
import { createPropertyEventCard } from "../../../src/ui/PropertyEventCard";
import { cleanupTaskCardMetadata } from "../../../src/ui/taskCardMetadata";

function createPlugin(wrapTaskCardProperties: boolean): TaskNotesPlugin {
	return {
		settings: { wrapTaskCardProperties },
		app: { workspace: { openLinkText: jest.fn(), trigger: jest.fn() } },
		i18n: { translate: mockObserveTranslation() },
	} as unknown as TaskNotesPlugin;
}

const entry = {
	file: { path: "Notes/Meeting.md", basename: "Meeting", name: "Meeting.md" },
	getValue: jest.fn(() => null),
} as unknown as BasesEntry;

const viewConfig = {
	getOrder: () => ["note.status"],
	getDisplayName: (id: string) => id,
	get: () => undefined,
} as unknown as BasesViewConfig;

describe("createPropertyEventCard", () => {
	const original = window.ResizeObserver;
	const observe = jest.fn();

	beforeEach(() => {
		observe.mockClear();
		window.ResizeObserver = class {
			observe = observe;
			unobserve() {}
			disconnect() {}
		} as unknown as typeof ResizeObserver;
	});

	afterEach(() => {
		document.querySelectorAll<HTMLElement>(".task-card__metadata").forEach(cleanupTaskCardMetadata);
		window.ResizeObserver = original;
	});

	it("wraps its properties instead of fitting them behind +N when cards show all properties (#2716)", () => {
		const card = createPropertyEventCard(entry, createPlugin(true), viewConfig);
		const metadata = card.querySelector(".task-card__metadata")!;
		expect(metadata.classList.contains("task-card__metadata--wrap")).toBe(true);
		expect(card.classList.contains("task-card--metadata-wrap")).toBe(true);
		expect(observe).not.toHaveBeenCalled();
	});

	it("fits its properties on one line when cards do not show all properties", () => {
		const card = createPropertyEventCard(entry, createPlugin(false), viewConfig);
		const metadata = card.querySelector(".task-card__metadata")!;
		expect(metadata.classList.contains("task-card__metadata--wrap")).toBe(false);
		expect(observe).toHaveBeenCalledWith(metadata);
	});
});
