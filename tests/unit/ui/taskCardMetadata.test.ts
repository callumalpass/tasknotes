import type TaskNotesPlugin from "../../../src/main";
import type { TaskInfo } from "../../../src/types";
import {
	renderTaskCardMetadata,
	renderTaskCardMetadataLine,
} from "../../../src/ui/taskCardMetadata";

jest.mock("obsidian");

function createTask(overrides: Partial<TaskInfo> = {}): TaskInfo {
	return {
		title: "Task",
		status: "open",
		priority: "normal",
		path: "Tasks/task.md",
		archived: false,
		...overrides,
	};
}

function createPlugin(): TaskNotesPlugin {
	return {
		settings: {},
		app: {
			metadataCache: {
				getFirstLinkpathDest: jest.fn(() => null),
				getCache: jest.fn(() => ({ frontmatter: {} })),
			},
			vault: {
				getAbstractFileByPath: jest.fn(() => null),
			},
			workspace: {
				openLinkText: jest.fn(),
			},
		},
		fieldMapper: {
			isPropertyForField: jest.fn(() => false),
			lookupMappingKey: jest.fn((propertyId: string) => propertyId),
			toUserField: jest.fn((field: string) => field),
		},
		i18n: {
			translate: jest.fn((key: string) => {
				const translations: Record<string, string> = {
					"ui.taskCard.blockedBadge": "Blocked",
					"ui.taskCard.blockedBadgeTooltip": "This task is blocked",
					"ui.taskCard.blockingBadge": "Blocking",
					"ui.taskCard.blockingBadgeTooltip": "This task is blocking another task",
					"ui.taskCard.googleCalendarSyncTooltip": "Synced to Google Calendar",
					"ui.taskCard.labels.due": "Due",
				};
				return translations[key] ?? key;
			}),
		},
	} as unknown as TaskNotesPlugin;
}

function createMetadataHost() {
	const card = document.createElement("div");
	card.className = "task-card";
	const metadataLine = document.createElement("div");
	metadataLine.className = "task-card__metadata";
	card.appendChild(metadataLine);
	document.body.appendChild(card);
	return { card, metadataLine };
}

describe("taskCardMetadata", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		jest.clearAllMocks();
	});

	it("renders blocked metadata as an interactive blocked-by expansion control", () => {
		const plugin = createPlugin();
		const { card, metadataLine } = createMetadataHost();
		const onBlockedByToggle = jest.fn();
		const parentClick = jest.fn();
		card.addEventListener("click", parentClick);

		const elements = renderTaskCardMetadata({
			metadataLine,
			card,
			task: createTask({
				isBlocked: true,
				blockedBy: [{ uid: "Tasks/blocker.md", reltype: "FINISHTOSTART" }],
			}),
			plugin,
			visibleProperties: ["blocked"],
			onBlockedByToggle,
		});

		const blockedPill = metadataLine.querySelector<HTMLElement>(
			".task-card__metadata-pill--blocked"
		);
		expect(elements).toEqual([blockedPill]);
		expect(blockedPill?.textContent).toBe("Blocked (1)");
		expect(blockedPill?.getAttribute("role")).toBe("button");
		expect(blockedPill?.getAttribute("aria-expanded")).toBe("false");

		blockedPill?.click();

		expect(onBlockedByToggle).toHaveBeenCalledTimes(1);
		expect(parentClick).not.toHaveBeenCalled();
	});

	it("renders blocking and Google Calendar sync pills from the same metadata path", () => {
		const plugin = createPlugin();
		const { card, metadataLine } = createMetadataHost();

		const elements = renderTaskCardMetadata({
			metadataLine,
			card,
			task: createTask({
				isBlocking: true,
				blocking: ["Tasks/dependent-a.md", "Tasks/dependent-b.md"],
				googleCalendarEventId: "gcal-123",
			}),
			plugin,
			visibleProperties: ["blocking", "googleCalendarSync"],
			onBlockedByToggle: jest.fn(),
		});

		expect(elements).toHaveLength(2);
		expect(metadataLine.querySelector(".task-card__metadata-pill--blocking")?.textContent).toBe(
			"Blocking (2)"
		);
		expect(metadataLine.querySelector(".task-card__metadata-pill--google-calendar")).not.toBeNull();
		expect(metadataLine.textContent).not.toContain("Tasks/task.md");
	});

	it("clears stale metadata and hides the line when no configured property renders", () => {
		const plugin = createPlugin();
		const { card, metadataLine } = createMetadataHost();
		metadataLine.textContent = "stale metadata";

		const elements = renderTaskCardMetadata({
			metadataLine,
			card,
			task: createTask(),
			plugin,
			visibleProperties: ["googleCalendarSync"],
			onBlockedByToggle: jest.fn(),
		});

		expect(elements).toEqual([]);
		expect(metadataLine.textContent).toBe("");
		expect(metadataLine.style.display).toBe("none");
	});

	it("wires blocked metadata toggles through the shared metadata-line adapter", () => {
		const plugin = createPlugin();
		const { card, metadataLine } = createMetadataHost();
		const toggleBlockedByTasks = jest.fn();

		renderTaskCardMetadataLine({
			metadataLine,
			card,
			task: createTask({
				isBlocked: true,
				blockedBy: [{ uid: "Tasks/blocker.md", reltype: "FINISHTOSTART" }],
			}),
			plugin,
			visibleProperties: ["blocked"],
			handlers: {
				toggleBlockedByTasks,
			},
		});

		metadataLine.querySelector<HTMLElement>(".task-card__metadata-pill--blocked")?.click();

		expect(toggleBlockedByTasks).toHaveBeenCalledWith(card, expect.any(Object), true);
	});
});
