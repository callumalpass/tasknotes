/**
 * TaskNotes Calendar Bases View
 *
 * Provides FullCalendar integration within Bases plugin (Obsidian 1.10.0+ only)
 * Uses public Bases API for data access and view lifecycle
 */

import TaskNotesPlugin from "../main";
import { BasesDataItem, identifyTaskNotesFromBasesData } from "./helpers";
import { Calendar } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import multiMonthPlugin from "@fullcalendar/multimonth";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import { startOfDay, endOfDay, format } from "date-fns";
import { getTodayLocal, normalizeCalendarBoundariesToUTC } from "../utils/dateUtils";
import { generateCalendarEvents, CalendarEvent } from "./calendar-core";
import { getBasesSortComparator } from "./sorting";

interface BasesContainerLike {
	results?: Map<any, any>;
	query?: {
		on?: (event: string, cb: () => void) => void;
		off?: (event: string, cb: () => void) => void;
	};
	viewContainerEl?: HTMLElement;
	controller?: { results?: Map<any, any>; [key: string]: any };
}

export function buildTasknotesCalendarViewFactory(plugin: TaskNotesPlugin) {
	return function tasknotesCalendarViewFactory(
		basesContainer: BasesContainerLike,
		containerEl?: HTMLElement
	) {
		let currentRoot: HTMLElement | null = null;
		let calendar: Calendar | null = null;
		let initRetryCount = 0;
		const MAX_INIT_RETRIES = 10;
		let currentViewContext: any = null; // Store current view context for event generation

		// Detect which API is being used (should only be public API 1.10.0+)
		const viewContainerEl = containerEl || basesContainer.viewContainerEl;
		const controller = basesContainer as any;

		if (!viewContainerEl) {
			console.error("[TaskNotes][Bases][Calendar] No viewContainerEl found");
			return {
				destroy: () => {},
				load: () => {},
				unload: () => {},
				refresh: () => {},
				onDataUpdated: () => {},
				onResize: () => {},
				getEphemeralState: () => ({ scrollTop: 0 }),
				setEphemeralState: () => {},
			};
		}

		// Clear container
		viewContainerEl.innerHTML = "";

		// Root container
		const root = document.createElement("div");
		root.className = "tn-bases-integration tasknotes-plugin advanced-calendar-view";
		root.style.cssText = "height: 100%; display: flex; flex-direction: column;";
		viewContainerEl.appendChild(root);
		currentRoot = root;

		// Calendar container
		const calendarEl = document.createElement("div");
		calendarEl.id = "bases-calendar";
		calendarEl.style.cssText = "flex: 1; min-height: 0; overflow: auto;";
		root.appendChild(calendarEl);

		// Extract data items from Bases (public API 1.10.0+)
		const extractDataItems = (viewContext?: any): BasesDataItem[] => {
			const dataItems: BasesDataItem[] = [];
			const ctx = viewContext || controller;

			// Use public API (1.10.0+)
			if (ctx.data?.data && Array.isArray(ctx.data.data)) {
				for (const entry of ctx.data.data) {
					dataItems.push({
						key: entry.file?.path || "",
						data: entry,
						file: entry.file,
						path: entry.file?.path,
						properties: (entry as any).frontmatter || (entry as any).properties,
					});
				}
			}

			return dataItems;
		};

		// Get calendar events from tasks
		const getCalendarEvents = async (viewContext?: any): Promise<CalendarEvent[]> => {
			try {
				// Use stored context if available, otherwise fall back to controller
				const ctx = currentViewContext || viewContext || controller;

				// Skip if no data
				if (!ctx.data?.data) {
					return [];
				}

				const dataItems = extractDataItems(ctx);
				const taskNotes = await identifyTaskNotesFromBasesData(dataItems, plugin);

				if (taskNotes.length === 0) {
					return [];
				}

				// Get calendar's visible date range for recurring task generation
				const today = getTodayLocal();
				const rawVisibleStart = calendar?.view?.activeStart || startOfDay(today);
				const rawVisibleEnd = calendar?.view?.activeEnd || endOfDay(today);

				const { utcStart: visibleStart, utcEnd: visibleEnd } =
					normalizeCalendarBoundariesToUTC(rawVisibleStart, rawVisibleEnd);

				// Generate calendar events using shared logic
				const events = await generateCalendarEvents(taskNotes, plugin, {
					showScheduled: true,
					showDue: true,
					showTimeEntries: true,
					showRecurring: true,
					showICSEvents: false, // ICS events not available in Bases context
					showTimeblocks: false, // Timeblocks not available in Bases context
					visibleStart,
					visibleEnd,
				});

				// Validate events
				return events.filter((event) => {
					if (!event.extendedProps || !event.id) {
						console.error(
							"[TaskNotes][Bases][Calendar] Invalid event, filtering out:",
							event
						);
						return false;
					}
					return true;
				});
			} catch (error) {
				console.error("[TaskNotes][Bases][Calendar] Error getting calendar events:", error);
				return [];
			}
		};

		// Sanitize time settings to prevent FullCalendar crashes
		const sanitizeTimeSettings = (settings: any) => {
			const isValidTimeFormat = (time: string): boolean => {
				return typeof time === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(time);
			};

			// Normalize to HH:MM:SS format
			const normalizeTime = (time: string, defaultVal: string): string => {
				if (!isValidTimeFormat(time)) {
					console.warn(`[TaskNotes][Bases][Calendar] Invalid time format: "${time}", using default "${defaultVal}"`);
					return defaultVal;
				}
				// Add seconds if not present (FullCalendar expects HH:MM:SS)
				return time.includes(':') && time.split(':').length === 2 ? `${time}:00` : time;
			};

			return {
				slotMinTime: normalizeTime(settings.slotMinTime, "00:00:00"),
				slotMaxTime: normalizeTime(settings.slotMaxTime, "24:00:00"),
				scrollTime: normalizeTime(settings.scrollTime, "08:00:00"),
			};
		};

		// Initialize FullCalendar
		const initializeCalendar = () => {
			if (!calendarEl) {
				console.error("[TaskNotes][Bases][Calendar] Calendar element not found");
				return;
			}

			// Check if element is attached to DOM and has dimensions
			if (!calendarEl.isConnected || calendarEl.clientHeight === 0) {
				if (initRetryCount >= MAX_INIT_RETRIES) {
					console.error("[TaskNotes][Bases][Calendar] Failed to initialize after max retries");
					return;
				}
				initRetryCount++;
				// Retry on next frame
				requestAnimationFrame(() => initializeCalendar());
				return;
			}

			try {
				const calendarSettings = plugin.settings.calendarViewSettings || {};

				// Validate and sanitize time settings
				const sanitizedTimeSettings = sanitizeTimeSettings(calendarSettings);

				// Validate slotDuration
				const isValidDuration = (dur: string): boolean => {
					return typeof dur === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(dur);
				};
				const slotDuration = isValidDuration(calendarSettings.slotDuration)
					? calendarSettings.slotDuration
					: "00:30:00";

				// Validate defaultView
				const validViews = ['dayGridMonth', 'timeGridWeek', 'timeGridDay', 'listWeek', 'multiMonthYear'];
				const defaultView = validViews.includes(calendarSettings.defaultView)
					? calendarSettings.defaultView
					: "dayGridMonth";
				if (!validViews.includes(calendarSettings.defaultView)) {
					console.warn(`[TaskNotes][Bases][Calendar] Invalid defaultView: "${calendarSettings.defaultView}", using "dayGridMonth"`);
				}

				// Validate numeric settings
				const firstDay = typeof calendarSettings.firstDay === 'number' &&
					calendarSettings.firstDay >= 0 && calendarSettings.firstDay <= 6
					? calendarSettings.firstDay
					: 0;
				const eventMinHeight = typeof calendarSettings.eventMinHeight === 'number' &&
					calendarSettings.eventMinHeight > 0
					? calendarSettings.eventMinHeight
					: 20;

				calendar = new Calendar(calendarEl, {
					plugins: [
						dayGridPlugin,
						timeGridPlugin,
						multiMonthPlugin,
						listPlugin,
						interactionPlugin,
					],
					initialView: defaultView,
					initialDate: new Date(),
					headerToolbar: {
						left: "prev,next today",
						center: "title",
						right: "dayGridMonth,timeGridWeek,timeGridDay",
					},
					buttonText: {
						today: "Today",
						month: "M",
						week: "W",
						day: "D",
					},
					height: "100%",
					editable: false, // Disable editing in Bases view for simplicity
					selectable: false,
					locale: navigator.language || "en",
					firstDay: firstDay,
					weekNumbers: !!calendarSettings.weekNumbers,
					weekends: calendarSettings.showWeekends ?? true,
					nowIndicator: calendarSettings.nowIndicator ?? true,
					slotMinTime: sanitizedTimeSettings.slotMinTime,
					slotMaxTime: sanitizedTimeSettings.slotMaxTime,
					scrollTime: sanitizedTimeSettings.scrollTime,
					slotDuration: slotDuration,
					allDaySlot: true,
					eventMinHeight: eventMinHeight,
					eventTimeFormat: {
						hour: "2-digit",
						minute: "2-digit",
						hour12: calendarSettings.timeFormat === "12",
					},
					slotLabelFormat: {
						hour: "2-digit",
						minute: "2-digit",
						hour12: calendarSettings.timeFormat === "12",
					},
					// Get events function
					events: async (fetchInfo: any) => {
						try {
							return await getCalendarEvents();
						} catch (error) {
							console.error("[TaskNotes][Bases][Calendar] Error in events callback:", error);
							return [];
						}
					},
					// Event click handler - open task file
					eventClick: (info: any) => {
						try {
							const taskInfo = info.event.extendedProps?.taskInfo;
							if (taskInfo?.path) {
								plugin.app.workspace.openLinkText(taskInfo.path, "", false);
							}
						} catch (error) {
							console.error("[TaskNotes][Bases][Calendar] Error in eventClick:", error);
						}
					},
				});

				// Render calendar
				requestAnimationFrame(() => {
					if (calendar) {
						try {
							calendar.render();
						} catch (renderError) {
							console.error("[TaskNotes][Bases][Calendar] Error rendering calendar:", renderError);
						}
					}
				});
			} catch (error) {
				console.error("[TaskNotes][Bases][Calendar] Error initializing calendar:", error);
				// Show error message in the container
				if (calendarEl) {
					calendarEl.innerHTML = `
						<div style="padding: 20px; text-align: center; color: var(--text-error);">
							<div style="margin-bottom: 10px;">Failed to initialize calendar</div>
							<div style="font-size: 0.9em; opacity: 0.8;">${error instanceof Error ? error.message : String(error)}</div>
						</div>
					`;
				}
			}
		};

		// Render function
		const render = async function (this: any) {
			if (!currentRoot) return;

			try {
				const viewContext = this?.data ? this : controller;

				// Store the view context for event generation
				currentViewContext = viewContext;

				// Skip rendering if no data
				if (!viewContext.data?.data) {
					return;
				}

				// Initialize calendar if not yet initialized
				if (!calendar) {
					initializeCalendar();
				}

				// Refresh calendar events
				if (calendar) {
					calendar.refetchEvents();
				}
			} catch (error) {
				console.error("[TaskNotes][Bases][Calendar] Error rendering:", error);
			}
		};

		// Set up lifecycle
		let queryListener: (() => void) | null = null;

		const component = {
			focus() {
				try {
					if (currentRoot && currentRoot.isConnected && typeof currentRoot.focus === "function") {
						currentRoot.focus();
					}
				} catch (e) {
					console.debug("[TaskNotes][Bases][Calendar] Failed to focus:", e);
				}
			},
			load() {
				const query = controller.query || basesContainer.query;
				if (query?.on && !queryListener) {
					queryListener = () => void render.call(this);
					try {
						query.on("change", queryListener);
					} catch (e) {
						console.debug("[TaskNotes][Bases][Calendar] Query listener registration failed:", e);
					}
				}

				void render.call(this);
			},
			unload() {
				const query = controller.query || basesContainer.query;
				if (queryListener && query?.off) {
					try {
						query.off("change", queryListener);
					} catch (e) {
						console.debug("[TaskNotes][Bases][Calendar] Query listener cleanup failed:", e);
					}
				}
				queryListener = null;

				// Destroy calendar
				if (calendar) {
					calendar.destroy();
					calendar = null;
				}
			},
			refresh() {
				void render.call(this);
			},
			onDataUpdated() {
				void render.call(this);
			},
			onResize() {
				if (calendar) {
					calendar.updateSize();
				}
			},
			getEphemeralState() {
				// Save current calendar view and date
				const state: any = {};
				if (calendar) {
					const view = calendar.view;
					state.viewType = view.type;
					state.currentDate = calendar.getDate().toISOString();
				}
				return state;
			},
			setEphemeralState(state: any) {
				if (!state || !calendar) return;

				try {
					// Restore calendar view and date
					if (state.viewType) {
						calendar.changeView(state.viewType);
					}
					if (state.currentDate) {
						calendar.gotoDate(new Date(state.currentDate));
					}
				} catch (e) {
					console.debug("[TaskNotes][Bases][Calendar] Failed to restore state:", e);
				}
			},
			destroy() {
				const query = controller.query || basesContainer.query;
				if (queryListener && query?.off) {
					try {
						query.off("change", queryListener);
					} catch (e) {
						// Ignore
					}
				}

				if (calendar) {
					calendar.destroy();
					calendar = null;
				}

				if (currentRoot) {
					currentRoot.remove();
					currentRoot = null;
				}

				queryListener = null;
			},
		};

		return component;
	};
}
