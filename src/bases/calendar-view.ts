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
import { getTodayLocal, normalizeCalendarBoundariesToUTC, parseDateToUTC, getTodayString } from "../utils/dateUtils";
import { generateCalendarEvents, CalendarEvent, generateTaskTooltip, applyRecurringTaskStyling, handleRecurringTaskDrop, getTargetDateForEvent, handleTimeblockCreation, handleTimeblockDrop, handleTimeblockResize, showTimeblockInfoModal, applyTimeblockStyling, generateTimeblockTooltip, handleDateTitleClick, addTaskHoverPreview, createICSEvent } from "./calendar-core";
import { getBasesSortComparator } from "./sorting";
import { TaskContextMenu } from "../components/TaskContextMenu";
import { TFile } from "obsidian";
import { ICSEventInfoModal } from "../modals/ICSEventInfoModal";
import { createTaskCard } from "../ui/TaskCard";
import { createICSEventCard } from "../ui/ICSCard";
import { createPropertyEventCard } from "../ui/PropertyEventCard";

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
		let basesEntryByPath: Map<string, any> = new Map(); // Map task path to Bases entry for enrichment

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

		// Handle date selection for task creation
		const handleDateSelect = (selectInfo: any) => {
			const { start, end, allDay, jsEvent } = selectInfo;

			// Check if timeblocking is enabled and Shift key is held
			const showTimeblocks = (currentViewContext?.config?.get('showTimeblocks') as boolean) ?? false;
			const isTimeblockMode =
				plugin.settings.calendarViewSettings.enableTimeblocking &&
				showTimeblocks &&
				jsEvent &&
				jsEvent.shiftKey;

			if (isTimeblockMode) {
				// Create timeblock
				handleTimeblockCreation(start, end, allDay, plugin);
			} else {
				// Create task with pre-populated date
				const scheduledDate = allDay
					? format(start, "yyyy-MM-dd")
					: format(start, "yyyy-MM-dd'T'HH:mm");

				const { TaskCreationModal } = require("../modals/TaskCreationModal");
				const modal = new TaskCreationModal(plugin.app, plugin, {
					prePopulatedValues: { scheduled: scheduledDate },
				});
				modal.open();
			}

			// Clear selection
			calendar?.unselect();
		};

		// Handle event drag and drop
		const handleEventDrop = async (dropInfo: any) => {
			if (!dropInfo?.event?.extendedProps) {
				console.warn("[TaskNotes][Bases][Calendar] Event dropped without extendedProps");
				return;
			}

			const {
				taskInfo,
				timeblock,
				eventType,
				isRecurringInstance,
				isNextScheduledOccurrence,
				isPatternInstance,
				filePath,
			} = dropInfo.event.extendedProps;

			// Handle timeblock drops
			if (eventType === "timeblock") {
				const originalDate = format(dropInfo.oldEvent.start, "yyyy-MM-dd");
				await handleTimeblockDrop(dropInfo, timeblock, originalDate, plugin);
				return;
			}

			// Handle property-based event drops
			if (eventType === "property-based" && filePath) {
				try {
					const file = plugin.app.vault.getAbstractFileByPath(filePath);
					if (!file || !(file instanceof TFile)) {
						dropInfo.revert();
						return;
					}

					const startDatePropertyId = currentViewContext?.config?.getAsPropertyId?.('startDateProperty');
					const endDatePropertyId = currentViewContext?.config?.getAsPropertyId?.('endDateProperty');

					if (!startDatePropertyId) {
						dropInfo.revert();
						return;
					}

					// Strip property prefix (e.g., "note.dateCreated" -> "dateCreated")
					const startDateProperty = startDatePropertyId.includes('.')
						? startDatePropertyId.split('.').pop()
						: startDatePropertyId;
					const endDateProperty = endDatePropertyId && endDatePropertyId.includes('.')
						? endDatePropertyId.split('.').pop()
						: endDatePropertyId;

					// Calculate time shift (in milliseconds)
					const oldStart = dropInfo.oldEvent.start;
					const newStart = dropInfo.event.start;
					const timeDiffMs = newStart.getTime() - oldStart.getTime();

					// Update frontmatter
					await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
						// Update start date
						const oldStartValue = frontmatter[startDateProperty];
						if (oldStartValue) {
							const oldStartDate = new Date(oldStartValue);
							const newStartDate = new Date(oldStartDate.getTime() + timeDiffMs);
							frontmatter[startDateProperty] = format(newStartDate, dropInfo.event.allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm");
						}

						// Update end date if configured
						if (endDateProperty) {
							const oldEndValue = frontmatter[endDateProperty];
							if (oldEndValue) {
								const oldEndDate = new Date(oldEndValue);
								const newEndDate = new Date(oldEndDate.getTime() + timeDiffMs);
								frontmatter[endDateProperty] = format(newEndDate, dropInfo.event.allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm");
							}
						}
					});
				} catch (error) {
					console.error("[TaskNotes][Bases][Calendar] Error updating property-based event:", error);
					dropInfo.revert();
				}
				return;
			}

			// Only allow scheduled and recurring events to be moved
			if (eventType === "timeEntry" || eventType === "ics" || eventType === "due") {
				dropInfo.revert();
				return;
			}

			try {
				const isRecurringUpdate =
					isRecurringInstance || isNextScheduledOccurrence || isPatternInstance;

				// Use shared recurring task drop handler
				if (isRecurringUpdate) {
					await handleRecurringTaskDrop(dropInfo, taskInfo, plugin);
				} else {
					// Handle non-recurring events normally
					const newStart = dropInfo.event.start;
					const allDay = dropInfo.event.allDay;
					const newDateString = allDay
						? format(newStart, "yyyy-MM-dd")
						: format(newStart, "yyyy-MM-dd'T'HH:mm");

					await plugin.taskService.updateProperty(taskInfo, "scheduled", newDateString);
				}
			} catch (error) {
				console.error("[TaskNotes][Bases][Calendar] Error updating task date:", error);
				dropInfo.revert();
			}
		};

		// Handle event resize
		const handleEventResize = async (resizeInfo: any) => {
			if (!resizeInfo?.event?.extendedProps) {
				console.warn("[TaskNotes][Bases][Calendar] Event resized without extendedProps");
				return;
			}

			const { taskInfo, timeblock, eventType, filePath } = resizeInfo.event.extendedProps;

			// Handle timeblock resize
			if (eventType === "timeblock") {
				const originalDate = format(resizeInfo.event.start, "yyyy-MM-dd");
				await handleTimeblockResize(resizeInfo, timeblock, originalDate, plugin);
				return;
			}

			// Handle property-based event resize
			if (eventType === "property-based" && filePath) {
				try {
					const file = plugin.app.vault.getAbstractFileByPath(filePath);
					if (!file || !(file instanceof TFile)) {
						resizeInfo.revert();
						return;
					}

					const endDatePropertyId = currentViewContext?.config?.getAsPropertyId?.('endDateProperty');

					if (!endDatePropertyId) {
						// No end date property configured, can't resize
						resizeInfo.revert();
						return;
					}

					// Strip property prefix (e.g., "note.dateModified" -> "dateModified")
					const endDateProperty = endDatePropertyId.includes('.')
						? endDatePropertyId.split('.').pop()
						: endDatePropertyId;

					const newEnd = resizeInfo.event.end;
					if (!newEnd) {
						resizeInfo.revert();
						return;
					}

					// Update frontmatter
					await plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
						frontmatter[endDateProperty] = format(newEnd, resizeInfo.event.allDay ? "yyyy-MM-dd" : "yyyy-MM-dd'T'HH:mm");
					});
				} catch (error) {
					console.error("[TaskNotes][Bases][Calendar] Error resizing property-based event:", error);
					resizeInfo.revert();
				}
				return;
			}

			// Only scheduled and recurring events can be resized
			if (eventType !== "scheduled" && eventType !== "recurring") {
				resizeInfo.revert();
				return;
			}

			try {
				const start = resizeInfo.event.start;
				const end = resizeInfo.event.end;

				if (start && end) {
					const durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
					await plugin.taskService.updateProperty(taskInfo, "timeEstimate", durationMinutes);
				}
			} catch (error) {
				console.error("[TaskNotes][Bases][Calendar] Error updating task duration:", error);
				resizeInfo.revert();
			}
		};

		// Handle event mount - add tooltips and context menus
		const handleEventDidMount = (arg: any) => {
			if (!arg?.event?.extendedProps) {
				return;
			}

			const { taskInfo, timeblock, icsEvent, eventType, isCompleted, basesEntry } = arg.event.extendedProps;

			// Custom rendering for list view - replace with card components
			if (arg.view.type === 'listWeek') {
				// Clear the default content
				arg.el.innerHTML = '';

				let cardElement: HTMLElement | null = null;

				// Get visible properties from Bases view configuration and map to TaskCard property IDs
				let visibleProperties: string[] | undefined = undefined;
				if (currentViewContext?.config?.getOrder) {
					const basesProperties = currentViewContext.config.getOrder();
					visibleProperties = basesProperties.map((propId: string) => {
						// Map Bases property IDs to TaskCard property IDs
						// "note.status" → "status", "note.due" → "due", etc.
						if (propId.startsWith('note.')) {
							return propId.substring(5); // Remove "note." prefix
						}
						// Keep file properties, formulas, and user properties as-is
						return propId;
					});
				}

				// Render task events with TaskCard
				if (taskInfo && eventType !== 'ics' && eventType !== 'property-based') {
					// Enrich TaskInfo with Bases data for formula and file property access
					const enrichedTask = { ...taskInfo };
					const basesEntry = basesEntryByPath.get(taskInfo.path);

					if (basesEntry) {
						// Add basesData for formula results
						enrichedTask.basesData = {
							formulaResults: {
								cachedFormulaOutputs: {} as Record<string, any>
							}
						};

						// Populate formula results from Bases entry
						if (visibleProperties) {
							for (const propId of visibleProperties) {
								if (propId.startsWith('formula.')) {
									const formulaName = propId.substring(8);
									try {
										const value = basesEntry.getValue?.(propId);
										if (value) {
											enrichedTask.basesData.formulaResults.cachedFormulaOutputs[formulaName] = value;
										}
									} catch (error) {
										console.debug('[TaskNotes][Bases][Calendar] Error getting formula:', propId, error);
									}
								}
							}
						}

						// Add file properties if not already present
						if (!enrichedTask.dateCreated) {
							try {
								const ctimeValue = basesEntry.getValue?.('file.ctime');
								if (ctimeValue?.data) enrichedTask.dateCreated = ctimeValue.data;
							} catch (error) {
								console.debug('[TaskNotes][Bases][Calendar] Error getting file.ctime:', error);
							}
						}
						if (!enrichedTask.dateModified) {
							try {
								const mtimeValue = basesEntry.getValue?.('file.mtime');
								if (mtimeValue?.data) enrichedTask.dateModified = mtimeValue.data;
							} catch (error) {
								console.debug('[TaskNotes][Bases][Calendar] Error getting file.mtime:', error);
							}
						}
					}

					// Get the target date from the event for proper recurring task completion
					// Use UTC anchor pattern: FullCalendar gives us a Date object, format to YYYY-MM-DD string then parse to UTC
					let targetDate: Date;
					if (arg.event.start) {
						const dateStr = format(arg.event.start, 'yyyy-MM-dd');
						targetDate = parseDateToUTC(dateStr);
					} else {
						const todayStr = getTodayString();
						targetDate = parseDateToUTC(todayStr);
					}

					cardElement = createTaskCard(enrichedTask, plugin, visibleProperties, {
						targetDate: targetDate,
						showDueDate: true,
						showCheckbox: false,
						showArchiveButton: false,
						showTimeTracking: false,
						showRecurringControls: true,
						groupByDate: false,
					});
				}
				// Render ICS events with ICSCard
				else if (icsEvent && eventType === 'ics') {
					cardElement = createICSEventCard(icsEvent, plugin);
				}
				// Render property-based events with PropertyEventCard
				else if (eventType === 'property-based' && basesEntry) {
					cardElement = createPropertyEventCard(
						basesEntry,
						plugin,
						currentViewContext?.config
					);
				}

				// Replace the event element content with the card
				if (cardElement) {
					arg.el.appendChild(cardElement);
					// Remove default FullCalendar classes that interfere with card styling
					arg.el.classList.remove('fc-event', 'fc-event-start', 'fc-event-end');
					return; // Skip default handling
				}
			}

			// Set event type attribute
			arg.el.setAttribute("data-event-type", eventType || "unknown");

			// Handle timeblock events
			if (eventType === "timeblock" && timeblock) {
				// Apply timeblock styling
				applyTimeblockStyling(arg.el, timeblock);

				// Ensure timeblocks are editable
				if (arg.event.setProp) {
					arg.event.setProp("editable", true);
				}

				// Add tooltip
				const { setTooltip } = require("obsidian");
				const tooltipText = generateTimeblockTooltip(timeblock);
				setTooltip(arg.el, tooltipText, { placement: "top" });
				return;
			}

			// Add data attributes and classes for tasks
			if (taskInfo && taskInfo.path) {
				arg.el.setAttribute("data-task-path", taskInfo.path);
				arg.el.classList.add("fc-task-event");

				// Add tag classes to tasks
				if (taskInfo.tags && taskInfo.tags.length > 0) {
					taskInfo.tags.forEach((tag: string) => {
						const sanitizedTag = tag.replace(/[^a-zA-Z0-9-_]/g, "");
						if (sanitizedTag) {
							arg.el.classList.add(`fc-tag-${sanitizedTag}`);
						}
					});
				}

				// Set editable based on event type
				if (arg.event.setProp) {
					switch (eventType) {
						case "scheduled":
						case "recurring":
							arg.event.setProp("editable", true);
							break;
						case "due":
						case "timeEntry":
							arg.event.setProp("editable", false);
							break;
						default:
							arg.event.setProp("editable", true);
					}
				}

				// Apply recurring task styling (handles completion styling as well)
				applyRecurringTaskStyling(arg.el, arg.event.extendedProps);
			}

			// Add hover tooltip for tasks and ICS events
			const { setTooltip } = require("obsidian");
			if (taskInfo) {
				const tooltipText = generateTaskTooltip(taskInfo, plugin);
				setTooltip(arg.el, tooltipText);
			} else if (icsEvent) {
				const tooltipText = icsEvent.description
					? `${icsEvent.title}\n\n${icsEvent.description}`
					: icsEvent.title;
				setTooltip(arg.el, tooltipText);
			}

			// Add hover preview for tasks (Ctrl+hover to preview daily note)
			if (taskInfo && eventType !== "ics") {
				addTaskHoverPreview(arg.el, taskInfo, plugin, "tasknotes-bases-calendar");
			}

			// Add context menu for tasks (right-click)
			if (taskInfo && eventType !== "timeEntry") {
				arg.el.addEventListener("contextmenu", (e: MouseEvent) => {
					e.preventDefault();
					e.stopPropagation();

					// Use shared UTC-anchored target date logic
					const targetDate = getTargetDateForEvent(arg);

					// Use shared TaskContextMenu component
					const contextMenu = new TaskContextMenu({
						task: taskInfo,
						plugin: plugin,
						targetDate: targetDate,
						onUpdate: () => {
							// Refresh calendar events when task is updated
							if (calendar) {
								calendar.refetchEvents();
							}
						},
					});
					contextMenu.show(e);
				});
			}
		};

		// Create calendar event from property-based dates
		const createPropertyBasedEvent = (entry: any, startDate: string, endDate?: string): CalendarEvent | null => {
			try {
				const file = entry.file;
				if (!file) return null;

				// Parse start date
				const hasTime = startDate.includes('T');

				// Calculate end date if not provided
				let eventEnd = endDate;
				if (!eventEnd && !hasTime) {
					// For all-day events without end date, use next day
					const start = new Date(startDate);
					const end = new Date(start);
					end.setDate(end.getDate() + 1);
					eventEnd = format(end, "yyyy-MM-dd");
				}

				return {
					id: `property-${file.path}`,
					title: file.basename || file.name,
					start: startDate,
					end: eventEnd,
					allDay: !hasTime,
					backgroundColor: "var(--color-accent)",
					borderColor: "var(--color-accent)",
					textColor: "var(--text-on-accent)",
					editable: true, // Allow drag and resize
					extendedProps: {
						eventType: "property-based" as const,
						filePath: file.path,
						file: file,
						basesEntry: entry, // Include full Bases entry for property access
					},
				};
			} catch (error) {
				console.error("[TaskNotes][Bases][Calendar] Error creating property-based event:", error);
				return null;
			}
		};

		// Get calendar events from tasks and property-based entries
		const getCalendarEvents = async (viewContext?: any): Promise<CalendarEvent[]> => {
			try {
				// Use stored context if available, otherwise fall back to controller
				const ctx = currentViewContext || viewContext || controller;

				// Skip if no data
				if (!ctx.data?.data) {
					return [];
				}

				const dataItems = extractDataItems(ctx);

				// Filter to only actual TaskNotes by checking if they're in the cache
				const taskNoteItems: BasesDataItem[] = [];
				const allCachedTasks = await plugin.cacheManager.getAllTasks();
				const cachedTaskPaths = new Set(allCachedTasks.map(t => t.path));

				// Clear and rebuild the Bases entry mapping for task enrichment
				basesEntryByPath.clear();

				// Store Bases entries by path for enrichment
				if (ctx.data?.data) {
					for (const entry of ctx.data.data) {
						if (entry.file?.path) {
							basesEntryByPath.set(entry.file.path, entry);
						}
					}
				}

				for (const item of dataItems) {
					if (item.path && cachedTaskPaths.has(item.path)) {
						taskNoteItems.push(item);
					}
				}

				const taskNotes = await identifyTaskNotesFromBasesData(taskNoteItems, plugin);

				// Get calendar's visible date range for recurring task generation
				const today = getTodayLocal();
				const rawVisibleStart = calendar?.view?.activeStart || startOfDay(today);
				const rawVisibleEnd = calendar?.view?.activeEnd || endOfDay(today);

				const { utcStart: visibleStart, utcEnd: visibleEnd } =
					normalizeCalendarBoundariesToUTC(rawVisibleStart, rawVisibleEnd);

				// Get view options from config (public API 1.10.0+)
				const calendarDefaults = plugin.settings.calendarViewSettings;
				const showScheduled = (ctx?.config?.get('showScheduled') as boolean) ?? calendarDefaults.defaultShowScheduled;
				const showDue = (ctx?.config?.get('showDue') as boolean) ?? calendarDefaults.defaultShowDue;
				const showRecurring = (ctx?.config?.get('showRecurring') as boolean) ?? calendarDefaults.defaultShowRecurring;
				const showTimeEntries = (ctx?.config?.get('showTimeEntries') as boolean) ?? calendarDefaults.defaultShowTimeEntries;
				const showTimeblocks = (ctx?.config?.get('showTimeblocks') as boolean) ?? calendarDefaults.defaultShowTimeblocks;
				const startDateProperty = ctx?.config?.getAsPropertyId?.('startDateProperty');
				const endDateProperty = ctx?.config?.getAsPropertyId?.('endDateProperty');

				// Build list of selected ICS calendars from individual toggle options
				const selectedICSCalendars: string[] = [];
				if (plugin.icsSubscriptionService) {
					const subscriptions = plugin.icsSubscriptionService.getSubscriptions();
					for (const sub of subscriptions) {
						const isEnabled = (ctx?.config?.get(`showICS_${sub.id}`) as boolean) ?? true;
						if (isEnabled) {
							selectedICSCalendars.push(sub.id);
						}
					}
				}

				const events: CalendarEvent[] = [];

				// Generate calendar events from TaskNotes using shared logic
				if (taskNotes.length > 0) {
					const taskEvents = await generateCalendarEvents(taskNotes, plugin, {
						showScheduled: showScheduled,
						showDue: showDue,
						showTimeEntries: showTimeEntries,
						showRecurring: showRecurring,
						showICSEvents: false, // ICS events handled separately in Bases
						showTimeblocks: showTimeblocks && plugin.settings.calendarViewSettings.enableTimeblocking,
						visibleStart,
						visibleEnd,
					});
					events.push(...taskEvents);
				}

				// Generate events from non-TaskNotes using configured properties
				if (startDateProperty && ctx.data?.data) {
					const taskNotePaths = new Set(taskNotes.map(t => t.path));
					let propertyEventCount = 0;

					for (const entry of ctx.data.data) {
						try {
							const file = entry.file;

							// Skip if no file or is already a TaskNote
							if (!file || taskNotePaths.has(file.path)) continue;

							// Try to get start date from configured property
							const startValue = entry.getValue?.(startDateProperty);
							if (!startValue) continue;

							// Extract date from Bases Value object
							// Bases returns objects like: { icon: 'lucide-calendar', date: Date, time: boolean }
							let dateValue: Date | string | null = null;

							if (startValue.date instanceof Date) {
								dateValue = startValue.date;
							} else if (startValue.data instanceof Date) {
								dateValue = startValue.data;
							} else if (typeof startValue.data === 'string') {
								dateValue = startValue.data;
							} else if (startValue instanceof Date) {
								dateValue = startValue;
							}

							if (!dateValue) continue;

							// Convert to date string
							let startDateStr: string;
							if (dateValue instanceof Date) {
								const hasTime = startValue.time === true;
								startDateStr = hasTime
									? format(dateValue, "yyyy-MM-dd'T'HH:mm")
									: format(dateValue, "yyyy-MM-dd");
							} else {
								startDateStr = dateValue;
							}

							// Try to get end date if property is configured
							let endDateStr: string | undefined;
							if (endDateProperty) {
								const endValue = entry.getValue?.(endDateProperty);
								if (endValue) {
									let endDateValue: Date | string | null = null;

									if (endValue.date instanceof Date) {
										endDateValue = endValue.date;
									} else if (endValue.data instanceof Date) {
										endDateValue = endValue.data;
									} else if (typeof endValue.data === 'string') {
										endDateValue = endValue.data;
									} else if (endValue instanceof Date) {
										endDateValue = endValue;
									}

									if (endDateValue) {
										if (endDateValue instanceof Date) {
											const hasTime = endValue.time === true;
											endDateStr = hasTime
												? format(endDateValue, "yyyy-MM-dd'T'HH:mm")
												: format(endDateValue, "yyyy-MM-dd");
										} else {
											endDateStr = endDateValue;
										}
									}
								}
							}

							// Create event
							const event = createPropertyBasedEvent(entry, startDateStr, endDateStr);
							if (event) {
								events.push(event);
								propertyEventCount++;
							}
						} catch (error) {
							console.warn("[TaskNotes][Bases][Calendar] Error processing entry:", error);
						}
					}
				}

				// Generate events from selected ICS calendars
				if (selectedICSCalendars.length > 0 && plugin.icsSubscriptionService) {
					const allICSEvents = plugin.icsSubscriptionService.getAllEvents();
					for (const icsEvent of allICSEvents) {
						// Only include events from selected calendars
						if (selectedICSCalendars.includes(icsEvent.subscriptionId)) {
							const calendarEvent = createICSEvent(icsEvent, plugin);
							if (calendarEvent) {
								events.push(calendarEvent);
							}
						}
					}
				}

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
				slotDuration: normalizeTime(settings.slotDuration, "00:30:00"),
				scrollTime: normalizeTime(settings.scrollTime || "08:00:00", "08:00:00"),
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

				// Get display options from config with defaults
				const weekNumbers = (currentViewContext?.config?.get('weekNumbers') as boolean) ?? calendarSettings.weekNumbers;
				const nowIndicator = (currentViewContext?.config?.get('nowIndicator') as boolean) ?? calendarSettings.nowIndicator;

				// Get calendar settings from config with defaults
				const slotMinTime = (currentViewContext?.config?.get('slotMinTime') as string) ?? calendarSettings.slotMinTime;
				const slotMaxTime = (currentViewContext?.config?.get('slotMaxTime') as string) ?? calendarSettings.slotMaxTime;
				const slotDuration = (currentViewContext?.config?.get('slotDuration') as string) ?? calendarSettings.slotDuration;
				const firstDayStr = (currentViewContext?.config?.get('firstDay') as string) ?? String(calendarSettings.firstDay);
				const firstDay = parseInt(firstDayStr, 10);

				// Validate and sanitize time settings
				const sanitizedTimeSettings = sanitizeTimeSettings({
					slotMinTime,
					slotMaxTime,
					slotDuration,
				});

				// Get calendar view and custom day count from config with validation
				const configView = (currentViewContext?.config?.get('calendarView') as string) ?? calendarSettings.defaultView;
				const customDayCount = (currentViewContext?.config?.get('customDayCount') as number) ?? calendarSettings.customDayCount ?? 3;
				const validViews = ['dayGridMonth', 'timeGridWeek', 'timeGridCustom', 'timeGridDay', 'listWeek', 'multiMonthYear'];
				const defaultView = validViews.includes(configView)
					? configView
					: "dayGridMonth";
				if (!validViews.includes(configView)) {
					console.warn(`[TaskNotes][Bases][Calendar] Invalid calendarView: "${configView}", using "dayGridMonth"`);
				}

				// Validate numeric settings
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
						right: "multiMonthYear,dayGridMonth,timeGridWeek,timeGridCustom,timeGridDay,listWeek",
					},
					buttonText: {
						today: "Today",
						month: "M",
						week: "W",
						day: "D",
						year: "Y",
						list: "L",
					},
					views: {
						timeGridCustom: {
							type: 'timeGrid',
							duration: { days: customDayCount },
							buttonText: `${customDayCount}D`,
						},
					},
					height: "100%",
					editable: true, // Enable drag and drop
					selectable: true, // Enable date selection for task creation
					locale: navigator.language || "en",
					firstDay: firstDay,
					weekNumbers: !!weekNumbers,
					weekends: calendarSettings.showWeekends ?? true,
					nowIndicator: nowIndicator ?? true,
					// Enable clickable date titles
					navLinks: true,
					navLinkDayClick: (date: Date) => handleDateTitleClick(date, plugin),
					slotMinTime: sanitizedTimeSettings.slotMinTime,
					slotMaxTime: sanitizedTimeSettings.slotMaxTime,
					scrollTime: sanitizedTimeSettings.scrollTime,
					slotDuration: sanitizedTimeSettings.slotDuration,
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
					// Event handlers
					select: handleDateSelect,
					eventDrop: handleEventDrop,
					eventResize: handleEventResize,
					eventDidMount: handleEventDidMount,
					eventAllow: (dropInfo: any) => {
						// Allow all drops to proceed visually
						return true;
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
					// Event click handler - open task file or timeblock modal
					eventClick: (info: any) => {
						try {
							const { taskInfo, timeblock, eventType, filePath, icsEvent, subscriptionName } = info.event.extendedProps || {};
							const jsEvent = info.jsEvent;

							// Handle timeblock click
							if (eventType === "timeblock" && timeblock) {
								const originalDate = format(info.event.start, "yyyy-MM-dd");
								showTimeblockInfoModal(timeblock, info.event.start, originalDate, plugin);
								return;
							}

							// Handle ICS event click - show info modal
							if (eventType === "ics" && icsEvent) {
								const modal = new ICSEventInfoModal(plugin.app, plugin, icsEvent, subscriptionName);
								modal.open();
								return;
							}

							// Handle property-based event click - Ctrl/Cmd+click opens in new tab
							if (eventType === "property-based" && filePath) {
								const openInNewTab = jsEvent && (jsEvent.ctrlKey || jsEvent.metaKey);
								plugin.app.workspace.openLinkText(filePath, "", openInNewTab);
								return;
							}

							// Handle task click - Ctrl/Cmd+click opens in new tab
							if (taskInfo?.path) {
								const openInNewTab = jsEvent && (jsEvent.ctrlKey || jsEvent.metaKey);
								plugin.app.workspace.openLinkText(taskInfo.path, "", openInNewTab);
							}
						} catch (error) {
							console.error("[TaskNotes][Bases][Calendar] Error in eventClick:", error);
						}
					},
					// Track view changes and sync to config
					datesSet: (info: any) => {
						try {
							if (currentViewContext?.config && info.view?.type) {
								const newView = info.view.type;
								const currentConfigView = currentViewContext.config.get('calendarView');

								// Only update if the view actually changed
								if (currentConfigView !== newView) {
									currentViewContext.config.set('calendarView', newView);
								}
							}
						} catch (error) {
							console.debug("[TaskNotes][Bases][Calendar] Error syncing view to config:", error);
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

				// Check if view or custom day count needs to be changed
				if (calendar && viewContext?.config) {
					const configView = viewContext.config.get('calendarView') as string;
					const currentView = calendar.view?.type;
					const newCustomDayCount = (viewContext.config.get('customDayCount') as number) ?? plugin.settings.calendarViewSettings.customDayCount ?? 3;

					// Update custom day view configuration if count changed
					const currentCustomView = (calendar as any).options?.views?.timeGridCustom;
					if (currentCustomView && currentCustomView.duration?.days !== newCustomDayCount) {
						try {
							calendar.setOption('views', {
								timeGridCustom: {
									type: 'timeGrid',
									duration: { days: newCustomDayCount },
									buttonText: `${newCustomDayCount}D`,
								},
							});
							// Re-render if currently on custom view
							if (currentView === 'timeGridCustom') {
								calendar.changeView('timeGridCustom');
							}
						} catch (viewError) {
							console.debug("[TaskNotes][Bases][Calendar] Error updating custom view:", viewError);
						}
					}

					// Change view if different from current
					if (configView && currentView && configView !== currentView) {
						try {
							calendar.changeView(configView);
						} catch (viewError) {
							console.debug("[TaskNotes][Bases][Calendar] Error changing view:", viewError);
						}
					}
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
