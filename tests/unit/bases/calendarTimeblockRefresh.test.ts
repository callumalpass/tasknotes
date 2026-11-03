import { BasesViewBase } from "../../../src/bases/BasesViewBase";
import { CalendarView } from "../../../src/bases/CalendarView";

jest.mock("obsidian-daily-notes-interface", () => ({
	...jest.requireActual("obsidian-daily-notes-interface"),
	getDateFromFile: (file: { basename: string }) =>
		/^\d{4}-\d{2}-\d{2}$/.test(file.basename) ? {} : null,
}));

const daily = { path: "2026-11-02.md", basename: "2026-11-02" };
const withBlocks = (blocks: unknown[]) => ({ frontmatter: { timeblocks: blocks } });

function mountCalendar() {
	jest.useFakeTimers();
	jest.spyOn(BasesViewBase.prototype, "onload").mockImplementation(() => {});
	let onChanged: (file: unknown, data: string, cache: unknown) => void = () => {};
	const cleanups: Array<() => void> = [];
	const refetchEvents = jest.fn();
	const root = document.createElement("div");
	document.body.appendChild(root);
	const view = Object.assign(Object.create(CalendarView.prototype), {
		plugin: {
			emitter: { on: jest.fn(), offref: jest.fn() },
			app: {
				vault: { getMarkdownFiles: () => [daily] },
				metadataCache: {
					getFileCache: () => withBlocks([{ id: "a", title: "Original" }]),
					on: (_name: string, cb: typeof onChanged) => (onChanged = cb),
				},
			},
		},
		rootElement: root,
		viewOptions: { showTimeblocks: true },
		readViewOptions: jest.fn(),
		getConfigSnapshot: jest.fn(),
		getDataSignature: jest.fn(),
		getControllerViewName: jest.fn(),
		register: (cleanup: () => void) => cleanups.push(cleanup),
		registerEvent: jest.fn(),
		refetchEvents,
		render: jest.fn(),
	});
	view.onload();
	return { view, root, refetchEvents, cleanups, change: (file: unknown, cache: unknown) => onChanged(file, "", cache) };
}

describe("CalendarView refetches timeblocks after outside daily-note edits", () => {
	afterEach(() => {
		document.body.replaceChildren();
		jest.restoreAllMocks();
		jest.useRealTimers();
	});

	it("ignores the first body-only edit and changes to other frontmatter", () => {
		const { change, refetchEvents } = mountCalendar();
		change(daily, { frontmatter: { timeblocks: [{ id: "a", title: "Original" }], mood: "happy" } });
		change({ path: "2026-11-03.md", basename: "2026-11-03" }, { frontmatter: {} });
		change({ path: "Notes/Idea.md", basename: "Idea" }, withBlocks([{ id: "b" }]));
		jest.advanceTimersByTime(300);
		expect(refetchEvents).not.toHaveBeenCalled();
	});

	it("debounces changes and refreshes additions, edits, and removals", () => {
		const { change, refetchEvents } = mountCalendar();
		change(daily, withBlocks([{ id: "a", title: "Changed" }]));
		jest.advanceTimersByTime(200);
		change(daily, withBlocks([{ id: "a", title: "Latest" }]));
		jest.advanceTimersByTime(299);
		expect(refetchEvents).not.toHaveBeenCalled();
		jest.advanceTimersByTime(1);
		expect(refetchEvents).toHaveBeenCalledTimes(1);
		change(daily, withBlocks([{ id: "a", title: "Latest" }]));
		jest.advanceTimersByTime(300);
		expect(refetchEvents).toHaveBeenCalledTimes(1);
		change(daily, { frontmatter: {} });
		jest.advanceTimersByTime(300);
		expect(refetchEvents).toHaveBeenCalledTimes(2);
		change({ path: "2026-11-03.md", basename: "2026-11-03" }, withBlocks([{ id: "b" }]));
		jest.advanceTimersByTime(300);
		expect(refetchEvents).toHaveBeenCalledTimes(3);
	});

	it("skips hidden timeblocks and disconnected views and cancels pending work on unload", () => {
		const { view, root, change, cleanups, refetchEvents } = mountCalendar();
		view.viewOptions.showTimeblocks = false;
		change(daily, withBlocks([{ id: "b" }]));
		jest.advanceTimersByTime(300);
		view.viewOptions.showTimeblocks = true;
		root.remove();
		change(daily, withBlocks([{ id: "c" }]));
		jest.advanceTimersByTime(300);
		document.body.appendChild(root);
		change(daily, withBlocks([{ id: "d" }]));
		cleanups.forEach((cleanup) => cleanup());
		jest.advanceTimersByTime(300);
		expect(refetchEvents).not.toHaveBeenCalled();
	});
});
