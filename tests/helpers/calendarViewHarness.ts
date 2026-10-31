import type { CalendarOptions } from "@tasknotes/calendar";
import { CalendarView } from "../../src/bases/CalendarView";
import type { CalendarEventProps } from "../../src/bases/calendarEngine";
import type TaskNotesPlugin from "../../src/main";
import { DEFAULT_CALENDAR_VIEW_SETTINGS } from "../../src/settings/defaults";

type CalendarViewInternals = {
	config: unknown;
	readViewOptions(): void;
	buildCalendarOptions(): Partial<CalendarOptions<CalendarEventProps>>;
};

/** A CalendarView with the given Bases view config, mounted in a plain or embedded container. */
export function createConfiguredCalendarView(
	values: Record<string, unknown>,
	{ embedded = false, sort = [] as unknown[] } = {}
): CalendarView {
	const host = document.createElement("div");
	if (embedded) host.className = "internal-embed markdown-embed";
	const container = document.createElement("div");
	host.appendChild(container);
	document.body.appendChild(host);

	const plugin = {
		settings: { calendarViewSettings: { ...DEFAULT_CALENDAR_VIEW_SETTINGS }, uiLanguage: "en" },
		fieldMapper: {},
		i18n: { translate: (key: string) => key },
	} as unknown as TaskNotesPlugin;

	const view = new CalendarView({}, container, plugin);
	const internals = view as unknown as CalendarViewInternals;
	internals.config = {
		get: (key: string) => values[key],
		getSort: () => sort,
		getOrder: () => [],
	};
	internals.readViewOptions();
	return view;
}

/** The options CalendarView passes to the calendar for the given Bases view config. */
export function calendarOptionsFor(
	values: Record<string, unknown>,
	context: { embedded?: boolean; sort?: unknown[] } = {}
): Partial<CalendarOptions<CalendarEventProps>> {
	const view = createConfiguredCalendarView(values, context);
	return (view as unknown as CalendarViewInternals).buildCalendarOptions();
}
