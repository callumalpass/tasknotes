import { TFile, FuzzySuggestModal, FuzzyMatch, setTooltip, Notice } from "obsidian";
import TaskNotesPlugin from "../main";
import { BasesViewBase } from "./BasesViewBase";
import { TaskInfo } from "../types";
import { format } from "date-fns";
import {
	formatDateForStorage,
	getTodayLocal,
	createUTCDateFromLocalCalendarDate,
	convertUTCToLocalCalendarDate,
	createSafeUTCDate,
	getDatePart,
} from "../utils/dateUtils";
import { isSameDay } from "../utils/helpers";
import { getAllDailyNotes, getDailyNote, appHasDailyNotesPluginLoaded, createDailyNote } from "obsidian-daily-notes-interface";

interface NoteEntry {
	file: TFile;
	title: string;
	path: string;
	dateValue: string; // The date string from the property
	basesEntry?: any; // Reference to Bases entry for additional data
}

export class MiniCalendarView extends BasesViewBase {
	type = "tasknotesMiniCalendar";
	private calendarEl: HTMLElement | null = null;

	// View options
	private dateProperty: string | null = null; // e.g., "note.dueDate", "file.ctime", "note.scheduled"
	private titleProperty: string | null = null; // e.g., "file.name", "note.title"
	private displayedMonth: number;
	private displayedYear: number;
	private selectedDate: Date; // UTC-anchored
	private configLoaded = false; // Track if we've successfully loaded config
	private isInitialRender = true; // Track if this is the first render
	private shouldRestoreFocus = false; // Track if focus should be restored after render

	// Multi-select mode
	private multiSelectMode = false;
	private selectedDates: Set<string> = new Set();

	// Data
	private notesByDate: Map<string, NoteEntry[]> = new Map();
	private monthCalculationCache: Map<string, { actualMonth: number; dateObj: Date; dateKey: string }> = new Map();

	// Keyboard navigation
	private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(controller: any, containerEl: HTMLElement, plugin: TaskNotesPlugin) {
		super(controller, containerEl, plugin);
		// BasesView now provides this.data, this.config, and this.app directly
		(this.dataAdapter as any).basesView = this;

		// Initialize with today
		const todayLocal = getTodayLocal();
		const todayUTC = createUTCDateFromLocalCalendarDate(todayLocal);
		this.selectedDate = todayUTC;
		this.displayedMonth = todayUTC.getUTCMonth();
		this.displayedYear = todayUTC.getUTCFullYear();
		// Note: Don't read config here - this.config is not set until after construction
		// readViewOptions() will be called in onload()
	}

	/**
	 * Component lifecycle: Called when view is first loaded.
	 * Override from Component base class.
	 */
	onload(): void {
		// Read view options now that config is available
		this.readViewOptions();
		// Call parent onload which sets up container and listeners
		super.onload();
	}

	/**
	 * Read view configuration options from BasesViewConfig.
	 */
	private readViewOptions(): void {
		// Guard: config may not be set yet if called too early
		if (!this.config || typeof this.config.get !== 'function') {
			return;
		}

		try {
			this.dateProperty = (this.config.get('dateProperty') as string) || 'file.ctime';
			this.titleProperty = (this.config.get('titleProperty') as string) || 'file.name';
			this.configLoaded = true;
		} catch (e) {
			console.error("[TaskNotes][MiniCalendarView] Error reading view options:", e);
		}
	}

	async render(): Promise<void> {
		if (!this.calendarEl || !this.rootElement) return;
		if (!this.data?.data) return;

		// Always re-read view options to catch config changes when switching views
		if (this.config) {
			this.readViewOptions();
		}

		try {
			// Check if the grid currently has focus before clearing
			const gridHadFocus = this.calendarEl.querySelector('.mini-calendar-view__grid') === document.activeElement;

			// Clear calendar
			this.calendarEl.empty();

			// Use raw Bases data (has getValue() method)
			const basesEntries = this.data.data;

			// Index notes by date
			this.indexNotesByDate(basesEntries);

			// Render calendar grid
			this.renderCalendarControls();
			this.renderCalendarGrid();

			// Focus strategy:
			// 1. Initial render: auto-focus to enable keyboard navigation
			// 2. User-initiated re-renders (navigation, interactions): restore focus
			// 3. Data update re-renders: only restore if it had focus before
			const shouldFocus = this.isInitialRender || this.shouldRestoreFocus || gridHadFocus;

			if (shouldFocus) {
				if (this.isInitialRender) {
					this.isInitialRender = false;
				}
				this.shouldRestoreFocus = false;

				// Focus the grid after rendering (with slight delay to ensure DOM is ready)
				setTimeout(() => {
					const grid = this.calendarEl?.querySelector('.mini-calendar-view__grid') as HTMLElement;
					if (grid) {
						grid.focus();
					}
				}, 10);
			}
		} catch (error: any) {
			console.error("[TaskNotes][MiniCalendarView] Error rendering:", error);
			this.renderError(error);
		}
	}

	private indexNotesByDate(dataItems: any[]): void {
		this.notesByDate.clear();

		if (!this.dateProperty) {
			return;
		}

		for (const item of dataItems) {
			try {
				const file = item.file;
				if (!file) continue;

				// Get date value from the configured property
				const dateValue = this.getDateValueFromProperty(item, this.dateProperty);
				if (!dateValue) continue;

				// Extract date part (handles both date-only and datetime strings)
				const dateKey = getDatePart(dateValue);
				if (!dateKey) continue;

				// Get title from configured property
				let title = file.basename || file.name;
				if (this.titleProperty) {
					try {
						// Try using getValue directly on the Bases item (preferred method)
						const titleValue = item.getValue?.(this.titleProperty);

						if (titleValue !== null && titleValue !== undefined) {
							// Bases values have a toString() method
							if (typeof titleValue === 'object' && titleValue.toString) {
								const stringValue = titleValue.toString();
								// Only use if toString() returns a non-null, non-empty value
								if (stringValue && stringValue !== 'null' && stringValue !== '') {
									title = stringValue;
								}
							} else if (typeof titleValue === 'string') {
								title = titleValue;
							} else {
								const stringValue = String(titleValue);
								if (stringValue && stringValue !== 'null' && stringValue !== '') {
									title = stringValue;
								}
							}
						} else {
							// Fallback to dataAdapter
							const adapterValue = this.dataAdapter.getPropertyValue(item, this.titleProperty);
							if (adapterValue !== null && adapterValue !== undefined) {
								if (typeof adapterValue === 'object' && adapterValue.toString) {
									const stringValue = adapterValue.toString();
									if (stringValue && stringValue !== 'null' && stringValue !== '') {
										title = stringValue;
									}
								} else if (typeof adapterValue === 'string') {
									title = adapterValue;
								} else {
									const stringValue = String(adapterValue);
									if (stringValue && stringValue !== 'null' && stringValue !== '') {
										title = stringValue;
									}
								}
							}
						}
					} catch (error) {
						console.warn("[TaskNotes][MiniCalendarView] Error getting title property:", error);
					}
				}

				// Create note entry
				const noteEntry: NoteEntry = {
					file: file,
					title: title,
					path: file.path,
					dateValue: dateValue,
					basesEntry: item,
				};

				// Add to map
				if (!this.notesByDate.has(dateKey)) {
					this.notesByDate.set(dateKey, []);
				}
				const notes = this.notesByDate.get(dateKey);
				if (notes) {
					notes.push(noteEntry);
				}
			} catch (error) {
				console.warn("[TaskNotes][MiniCalendarView] Error indexing note:", error);
			}
		}
	}

	private getDateValueFromProperty(item: any, propertyId: string): string | null {
		try {
			// Use BasesDataAdapter to get the property value (handles all Bases Value types)
			const value = this.dataAdapter.getPropertyValue(item, propertyId);

			if (!value) {
				return null;
			}

			// Normalize based on the native JavaScript value shape
			if (typeof value === "string") {
				return this.extractDateFromString(value);
			}

			if (typeof value === "number") {
				return this.toAnchoredDateString(new Date(value));
			}

			if (value instanceof Date) {
				return this.toAnchoredDateString(value);
			}

			if (typeof value === "object") {
				const maybeDate = (value as { date?: Date }).date;
				if (maybeDate instanceof Date) {
					return this.toAnchoredDateString(maybeDate);
				}

				const toISOString = (value as { toISOString?: () => string }).toISOString;
				if (typeof toISOString === "function") {
					return this.extractDateFromString(toISOString.call(value));
				}
			}

			return null;
		} catch (error) {
			console.warn("[TaskNotes][MiniCalendarView] Error getting date value:", error);
			return null;
		}
	}

	private extractDateFromString(rawValue: string): string | null {
		const trimmed = rawValue?.trim();
		if (!trimmed) {
			return null;
		}

		// YYYY-MM-DD already normalized (UTC anchor ready)
		if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
			return this.validateCalendarDate(trimmed);
		}

		// Handle ISO / timezone-aware or space-separated datetime strings
		if (
			trimmed.includes("T") ||
			/\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(trimmed) ||
			/[+-]\d{2}:\d{2}$/.test(trimmed)
		) {
			const sanitized =
				trimmed.includes(" ") && !trimmed.includes("T") ? trimmed.replace(" ", "T") : trimmed;
			const parsed = new Date(sanitized);
			if (!isNaN(parsed.getTime())) {
				return this.toAnchoredDateString(parsed);
			}
		}

		// Support common alternate separators like YYYY/MM/DD or YYYY.MM.DD
		const alternateSeparatorMatch = trimmed.match(/^(\d{4})[/.](\d{2})[/.](\d{2})$/);
		if (alternateSeparatorMatch) {
			const [, year, month, day] = alternateSeparatorMatch;
			return this.validateCalendarDate(`${year}-${month}-${day}`);
		}

		// As a last resort, pull the first YYYY-MM-DD from the string (e.g., filenames)
		const embeddedMatch = trimmed.match(/(\d{4}-\d{2}-\d{2})/);
		if (embeddedMatch) {
			return this.validateCalendarDate(embeddedMatch[1]);
		}

		return null;
	}

	private toAnchoredDateString(date: Date): string | null {
		if (!(date instanceof Date) || isNaN(date.getTime())) {
			return null;
		}

		const anchored = createUTCDateFromLocalCalendarDate(date);
		return formatDateForStorage(anchored);
	}

	private validateCalendarDate(value: string | null | undefined): string | null {
		if (!value) {
			return null;
		}

		const trimmed = value.trim();
		const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
		if (!match) {
			return null;
		}

		const [, yearStr, monthStr, dayStr] = match;
		const year = Number(yearStr);
		const monthIndex = Number(monthStr) - 1;
		const day = Number(dayStr);

		if (Number.isNaN(year) || Number.isNaN(monthIndex) || Number.isNaN(day)) {
			return null;
		}

		const safe = createSafeUTCDate(year, monthIndex, day);
		if (
			safe.getUTCFullYear() !== year ||
			safe.getUTCMonth() !== monthIndex ||
			safe.getUTCDate() !== day
		) {
			return null;
		}

		return formatDateForStorage(safe);
	}

	private renderCalendarControls(): void {
		if (!this.calendarEl) return;
		const controlsContainer = this.calendarEl.createDiv({ cls: "mini-calendar-view__controls" });
		const headerContainer = controlsContainer.createDiv({ cls: "mini-calendar-view__header" });

		// Navigation section
		const navSection = headerContainer.createDiv({ cls: "mini-calendar-view__navigation" });

		// Previous month button
		const prevButton = navSection.createEl("button", {
			text: "‹",
			cls: "mini-calendar-view__nav-button mini-calendar-view__nav-button--prev tn-btn tn-btn--icon tn-btn--ghost",
			attr: {
				"aria-label": "Previous month",
				title: "Previous month",
			},
		});
		prevButton.addEventListener("click", () => this.navigateToPreviousMonth());

		// Current month display
		navSection.createDiv({
			cls: "mini-calendar-view__month-display",
			text: format(convertUTCToLocalCalendarDate(this.selectedDate), "MMMM yyyy"),
		});

		// Next month button
		const nextButton = navSection.createEl("button", {
			text: "›",
			cls: "mini-calendar-view__nav-button mini-calendar-view__nav-button--next tn-btn tn-btn--icon tn-btn--ghost",
			attr: {
				"aria-label": "Next month",
				title: "Next month",
			},
		});
		nextButton.addEventListener("click", () => this.navigateToNextMonth());

		// Today button
		const todayButton = headerContainer.createEl("button", {
			text: "Today",
			cls: "mini-calendar-view__today-button tn-btn tn-btn--ghost tn-btn--sm",
			attr: {
				"aria-label": "Go to today",
				title: "Go to today",
			},
		});
		todayButton.addEventListener("click", () => this.navigateToToday());
	}

	private renderCalendarGrid(): void {
		if (!this.calendarEl) return;
		const gridContainer = this.calendarEl.createDiv({ cls: "mini-calendar-view__grid-container" });

		// Get current month/year from displayed date
		const currentMonth = this.displayedMonth;
		const currentYear = this.displayedYear;

		// Get first and last day of month
		const firstDayOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
		const lastDayOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0));

		const firstDaySetting = this.plugin.settings.calendarViewSettings.firstDay || 0;
		const firstDayOfWeek = (firstDayOfMonth.getUTCDay() - firstDaySetting + 7) % 7;

		// Create calendar grid
		const calendarGrid = gridContainer.createDiv({
			cls: "mini-calendar-view__grid",
			attr: {
				role: "grid",
				"aria-label": `Calendar for ${format(convertUTCToLocalCalendarDate(new Date(Date.UTC(currentYear, currentMonth, 1))), "MMMM yyyy")}`,
				tabindex: "0",
			},
		});

		// Set up keyboard navigation for the grid
		this.setupKeyboardNavigation(calendarGrid);

		// Make grid focusable and auto-focus when calendar is interacted with
		calendarGrid.addEventListener('click', () => {
			calendarGrid.focus();
		});

		// Day names header
		const calendarHeader = calendarGrid.createDiv({
			cls: "mini-calendar-view__grid-header",
			attr: { role: "row" },
		});

		// Add empty cell for week number column
		calendarHeader.createDiv({
			text: "",
			cls: "mini-calendar-view__week-header",
			attr: { role: "columnheader" },
		});

		const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		const reorderedDayNames = [
			...dayNames.slice(firstDaySetting),
			...dayNames.slice(0, firstDaySetting),
		];

		reorderedDayNames.forEach((dayName) => {
			calendarHeader.createDiv({
				text: dayName,
				cls: "mini-calendar-view__day-header",
				attr: { role: "columnheader", "aria-label": dayName },
			});
		});

		// Calculate grid layout
		const daysFromPrevMonth = firstDayOfWeek;
		const totalCells = 42; // 6 rows of 7 days
		const daysThisMonth = lastDayOfMonth.getUTCDate();
		const daysFromNextMonth = totalCells - daysThisMonth - daysFromPrevMonth;
		const lastDayOfPrevMonth = new Date(Date.UTC(currentYear, currentMonth, 0)).getUTCDate();

		// Render days - collect week data first
		const weeks: Date[][] = [];
		let currentWeekDays: Date[] = [];

		// Previous month days
		for (let i = 0; i < daysFromPrevMonth; i++) {
			const dayNum = lastDayOfPrevMonth - daysFromPrevMonth + i + 1;
			const dayDate = new Date(Date.UTC(currentYear, currentMonth - 1, dayNum));
			currentWeekDays.push(dayDate);
		}

		// Current month days
		for (let i = 1; i <= daysThisMonth; i++) {
			if (currentWeekDays.length === 7) {
				weeks.push(currentWeekDays);
				currentWeekDays = [];
			}

			const dayDate = new Date(Date.UTC(currentYear, currentMonth, i));
			currentWeekDays.push(dayDate);
		}

		// Next month days
		for (let i = 1; i <= daysFromNextMonth; i++) {
			if (currentWeekDays.length === 7) {
				weeks.push(currentWeekDays);
				currentWeekDays = [];
			}

			const dayDate = new Date(Date.UTC(currentYear, currentMonth + 1, i));
			currentWeekDays.push(dayDate);
		}

		// Push the last week if it has days
		if (currentWeekDays.length > 0) {
			weeks.push(currentWeekDays);
		}

		// Render each week row with week number
		weeks.forEach(weekDays => {
			this.renderWeekRow(calendarGrid, weekDays);
		});
	}

	private renderWeekRow(calendarGrid: HTMLElement, weekDays: Date[]): void {
		const weekRow = calendarGrid.createDiv({
			cls: "mini-calendar-view__week",
			attr: { role: "row" },
		});

		// Add week number cell
		const weekNum = this.getWeekNumber(weekDays[0]);
		const weekCell = weekRow.createDiv({
			cls: 'mini-calendar-week-number',
			text: `W${weekNum}`
		});

		weekCell.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.selectWeek(weekDays);

			// Return focus to the grid after handling the click
			const grid = this.calendarEl?.querySelector('.mini-calendar-view__grid') as HTMLElement;
			if (grid) {
				grid.focus();
			}
		});

		// Render day cells
		weekDays.forEach((dayDate, index) => {
			const currentMonth = this.displayedMonth;
			const currentYear = this.displayedYear;
			const isOutsideMonth = dayDate.getUTCMonth() !== currentMonth || dayDate.getUTCFullYear() !== currentYear;
			const dayNum = dayDate.getUTCDate();
			this.renderDay(weekRow, dayDate, dayNum, isOutsideMonth);
		});
	}

	private renderDay(weekRow: HTMLElement, dayDate: Date, dayNum: number, isOutsideMonth: boolean): void {
		const todayLocal = getTodayLocal();
		const today = createUTCDateFromLocalCalendarDate(todayLocal);

		const isToday = isSameDay(dayDate, today);
		const isSelected = isSameDay(dayDate, this.selectedDate);

		let classNames = "mini-calendar-view__day";
		if (isToday) classNames += " mini-calendar-view__day--today";
		if (isSelected) classNames += " mini-calendar-view__day--selected";
		if (isOutsideMonth) classNames += " mini-calendar-view__day--outside-month";

		const dayEl = weekRow.createDiv({
			cls: classNames,
			text: dayNum.toString(),
			attr: {
				role: "gridcell",
				"aria-label": format(convertUTCToLocalCalendarDate(dayDate), "EEEE, MMMM d, yyyy") + (isToday ? " (Today)" : ""),
				"aria-selected": isSelected ? "true" : "false",
				"aria-current": isToday ? "date" : null,
			},
		});

		// Add heatmap styling and tooltips if notes exist for this date
		const dateKey = formatDateForStorage(dayDate);
		const notesForDay = this.notesByDate.get(dateKey);

		if (notesForDay && notesForDay.length > 0) {
			// Add heat map intensity class
			const intensity = this.getHeatMapIntensity(notesForDay.length);
			dayEl.addClass(`mini-calendar-view__day--intensity-${intensity}`);

			// Add hover preview tooltip using Obsidian's built-in tooltip
			const tooltipText = this.createNotePreviewText(notesForDay);
			setTooltip(dayEl, tooltipText, { placement: 'top' });
		}

		// Click handler - select date or show fuzzy selector
		dayEl.addEventListener("click", (e: MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			this.handleDayClick(dayDate, e);

			// Return focus to the grid after handling the click
			const grid = this.calendarEl?.querySelector('.mini-calendar-view__grid') as HTMLElement;
			if (grid) {
				grid.focus();
			}
		});
	}

	private async handleDayClick(date: Date, event?: MouseEvent): Promise<void> {
		// Update selected date
		this.selectedDate = date;

		// Check for ctrl/cmd click to open daily note
		if (event && (event.ctrlKey || event.metaKey)) {
			await this.openDailyNoteForDate(date);
			return;
		}

		// Update selection visually (highlight the clicked date)
		this.refresh();

		// Check if date has notes
		const dateKey = formatDateForStorage(date);
		const notesForDay = this.notesByDate.get(dateKey);

		if (notesForDay && notesForDay.length > 0) {
			// Show fuzzy selector with notes
			const modal = new NoteSelectionModal(
				this.plugin.app,
				this.plugin,
				notesForDay,
				(selectedNote) => {
					if (selectedNote) {
						// Open the selected note
						this.plugin.app.workspace.getLeaf(false).openFile(selectedNote.file);
					}
				}
			);
			modal.open();
		}
	}

	private async openDailyNoteForDate(date: Date): Promise<void> {
		// Check if daily notes plugin is enabled
		if (!appHasDailyNotesPluginLoaded()) {
			new Notice(
				"Daily Notes core plugin is not enabled. Please enable it in Settings > Core plugins."
			);
			return;
		}

		// Convert date to moment for the API
		const localAnchor = convertUTCToLocalCalendarDate(date);
		const jsDate = new Date(
			localAnchor.getFullYear(),
			localAnchor.getMonth(),
			localAnchor.getDate(),
			12,
			0,
			0,
			0
		);
		const moment = (window as any).moment(jsDate);

		// Get all daily notes to check if one exists for this date
		const allDailyNotes = getAllDailyNotes();
		let dailyNote = getDailyNote(moment, allDailyNotes);

		if (!dailyNote) {
			// Daily note doesn't exist, create it
			try {
				dailyNote = await createDailyNote(moment);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				console.error("Failed to create daily note:", error);
				new Notice(`Failed to create daily note: ${errorMessage}`);
				return;
			}
		}

		// Open the daily note
		if (dailyNote) {
			await this.plugin.app.workspace.getLeaf(false).openFile(dailyNote);
		}
	}

	private navigateToPreviousMonth(): void {
		const newDate = new Date(this.selectedDate.getTime());
		newDate.setUTCMonth(this.selectedDate.getUTCMonth() - 1);
		this.selectedDate = newDate;
		this.displayedMonth = newDate.getUTCMonth();
		this.displayedYear = newDate.getUTCFullYear();
		this.monthCalculationCache.clear();
		this.shouldRestoreFocus = true;
		this.refresh();
	}

	private navigateToNextMonth(): void {
		const newDate = new Date(this.selectedDate.getTime());
		newDate.setUTCMonth(this.selectedDate.getUTCMonth() + 1);
		this.selectedDate = newDate;
		this.displayedMonth = newDate.getUTCMonth();
		this.displayedYear = newDate.getUTCFullYear();
		this.monthCalculationCache.clear();
		this.shouldRestoreFocus = true;
		this.refresh();
	}

	private navigateToToday(): void {
		const todayLocal = getTodayLocal();
		const todayUTC = createUTCDateFromLocalCalendarDate(todayLocal);
		this.selectedDate = todayUTC;
		this.displayedMonth = todayUTC.getUTCMonth();
		this.displayedYear = todayUTC.getUTCFullYear();
		this.monthCalculationCache.clear();
		this.shouldRestoreFocus = true;
		this.refresh();
	}

	/**
	 * Set up keyboard navigation for the calendar grid.
	 */
	private setupKeyboardNavigation(calendarGrid: HTMLElement): void {
		// Remove previous handler if it exists
		if (this.keyboardHandler) {
			calendarGrid.removeEventListener('keydown', this.keyboardHandler);
		}

		// Create new handler
		this.keyboardHandler = async (e: KeyboardEvent) => {
			// Arrow keys - navigate between days
			if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
				e.key === 'ArrowUp' || e.key === 'ArrowDown') {
				e.preventDefault();
				this.navigateByArrowKey(e.key);
				return;
			}

			// Page Up/Down - navigate months
			if (e.key === 'PageUp') {
				e.preventDefault();
				if (e.shiftKey) {
					// Shift+PageUp - previous year
					this.navigateToYear(-1);
				} else {
					this.navigateToPreviousMonth();
				}
				return;
			}

			if (e.key === 'PageDown') {
				e.preventDefault();
				if (e.shiftKey) {
					// Shift+PageDown - next year
					this.navigateToYear(1);
				} else {
					this.navigateToNextMonth();
				}
				return;
			}

			// Home/End - navigate to start/end of week or month
			if (e.key === 'Home') {
				e.preventDefault();
				if (e.ctrlKey || e.metaKey) {
					// Ctrl+Home - first day of month
					this.navigateToStartOfMonth();
				} else {
					// Home - start of week
					this.navigateToStartOfWeek();
				}
				return;
			}

			if (e.key === 'End') {
				e.preventDefault();
				if (e.ctrlKey || e.metaKey) {
					// Ctrl+End - last day of month
					this.navigateToEndOfMonth();
				} else {
					// End - end of week
					this.navigateToEndOfWeek();
				}
				return;
			}

			// T - jump to today
			if (e.key === 't' || e.key === 'T') {
				e.preventDefault();
				this.navigateToToday();
				return;
			}

			// Escape - clear multi-select mode
			if (e.key === 'Escape') {
				if (this.multiSelectMode) {
					e.preventDefault();
					this.multiSelectMode = false;
					this.selectedDates.clear();
					this.refresh();
				}
				return;
			}

			// Enter/Space - select date or open fuzzy selector
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				if (e.ctrlKey || e.metaKey) {
					await this.openDailyNoteForDate(this.selectedDate);
				} else {
					await this.handleDayClick(this.selectedDate);
				}
				return;
			}
		};

		calendarGrid.addEventListener('keydown', this.keyboardHandler);
	}

	/**
	 * Navigate by arrow key.
	 */
	private navigateByArrowKey(key: string): void {
		const newDate = new Date(this.selectedDate.getTime());

		switch (key) {
			case 'ArrowLeft':
				newDate.setUTCDate(newDate.getUTCDate() - 1);
				break;
			case 'ArrowRight':
				newDate.setUTCDate(newDate.getUTCDate() + 1);
				break;
			case 'ArrowUp':
				newDate.setUTCDate(newDate.getUTCDate() - 7);
				break;
			case 'ArrowDown':
				newDate.setUTCDate(newDate.getUTCDate() + 7);
				break;
		}

		this.selectedDate = newDate;

		// Update displayed month if we moved to a different month
		if (newDate.getUTCMonth() !== this.displayedMonth ||
			newDate.getUTCFullYear() !== this.displayedYear) {
			this.displayedMonth = newDate.getUTCMonth();
			this.displayedYear = newDate.getUTCFullYear();
			this.monthCalculationCache.clear();
		}

		this.shouldRestoreFocus = true;
		this.refresh();
	}

	/**
	 * Navigate to start of current week.
	 */
	private navigateToStartOfWeek(): void {
		const firstDaySetting = this.plugin.settings.calendarViewSettings.firstDay || 0;
		const currentDay = this.selectedDate.getUTCDay();
		const daysToSubtract = (currentDay - firstDaySetting + 7) % 7;

		const newDate = new Date(this.selectedDate.getTime());
		newDate.setUTCDate(newDate.getUTCDate() - daysToSubtract);

		this.selectedDate = newDate;

		// Update displayed month if needed
		if (newDate.getUTCMonth() !== this.displayedMonth ||
			newDate.getUTCFullYear() !== this.displayedYear) {
			this.displayedMonth = newDate.getUTCMonth();
			this.displayedYear = newDate.getUTCFullYear();
			this.monthCalculationCache.clear();
		}

		this.shouldRestoreFocus = true;
		this.refresh();
	}

	/**
	 * Navigate to end of current week.
	 */
	private navigateToEndOfWeek(): void {
		const firstDaySetting = this.plugin.settings.calendarViewSettings.firstDay || 0;
		const currentDay = this.selectedDate.getUTCDay();
		const lastDayOfWeek = (firstDaySetting + 6) % 7;
		const daysToAdd = (lastDayOfWeek - currentDay + 7) % 7;

		const newDate = new Date(this.selectedDate.getTime());
		newDate.setUTCDate(newDate.getUTCDate() + daysToAdd);

		this.selectedDate = newDate;

		// Update displayed month if needed
		if (newDate.getUTCMonth() !== this.displayedMonth ||
			newDate.getUTCFullYear() !== this.displayedYear) {
			this.displayedMonth = newDate.getUTCMonth();
			this.displayedYear = newDate.getUTCFullYear();
			this.monthCalculationCache.clear();
		}

		this.shouldRestoreFocus = true;
		this.refresh();
	}

	/**
	 * Navigate to first day of current month.
	 */
	private navigateToStartOfMonth(): void {
		const newDate = new Date(Date.UTC(
			this.selectedDate.getUTCFullYear(),
			this.selectedDate.getUTCMonth(),
			1
		));

		this.selectedDate = newDate;
		this.shouldRestoreFocus = true;
		this.refresh();
	}

	/**
	 * Navigate to last day of current month.
	 */
	private navigateToEndOfMonth(): void {
		const newDate = new Date(Date.UTC(
			this.selectedDate.getUTCFullYear(),
			this.selectedDate.getUTCMonth() + 1,
			0
		));

		this.selectedDate = newDate;
		this.shouldRestoreFocus = true;
		this.refresh();
	}

	/**
	 * Navigate by year offset.
	 */
	private navigateToYear(yearOffset: number): void {
		const newDate = new Date(this.selectedDate.getTime());
		newDate.setUTCFullYear(newDate.getUTCFullYear() + yearOffset);

		this.selectedDate = newDate;
		this.displayedMonth = newDate.getUTCMonth();
		this.displayedYear = newDate.getUTCFullYear();
		this.monthCalculationCache.clear();
		this.shouldRestoreFocus = true;
		this.refresh();
	}

	private getWeekNumber(date: Date): number {
		// ISO week number calculation
		const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
		const dayNum = d.getUTCDay() || 7;
		d.setUTCDate(d.getUTCDate() + 4 - dayNum);
		const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
		return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
	}

	private selectWeek(weekDays: Date[]): void {
		this.multiSelectMode = true;
		this.selectedDates.clear();

		weekDays.forEach(day => {
			this.selectedDates.add(formatDateForStorage(day));
		});

		this.shouldRestoreFocus = true;
		this.refresh();
		this.showCombinedNotes();
	}

	private showCombinedNotes(): void {
		// Collect all notes from selected dates
		const allNotes: NoteEntry[] = [];
		this.selectedDates.forEach(dateKey => {
			const notes = this.notesByDate.get(dateKey);
			if (notes) {
				allNotes.push(...notes);
			}
		});

		if (allNotes.length > 0) {
			// Show fuzzy selector with all combined notes
			const modal = new NoteSelectionModal(
				this.plugin.app,
				this.plugin,
				allNotes,
				(selectedNote) => {
					if (selectedNote) {
						// Open the selected note
						this.plugin.app.workspace.getLeaf(false).openFile(selectedNote.file);
					}
				}
			);
			modal.open();
		} else {
			new Notice("No notes found for selected dates");
		}
	}

	/**
	 * Create a simple text tooltip showing note titles.
	 */
	private createNotePreviewText(notes: NoteEntry[]): string {
		const lines: string[] = [];

		// Header
		lines.push(`${notes.length} note${notes.length > 1 ? 's' : ''}`);
		lines.push(''); // Empty line for spacing

		// List up to 5 notes
		notes.slice(0, 5).forEach(note => {
			let line = `• ${note.title}`;

			// Add note type if available from basesEntry
			const noteTypeValue = note.basesEntry?.getValue?.('type');
			if (noteTypeValue) {
				let noteType: string | null = null;
				if (typeof noteTypeValue === 'object' && noteTypeValue.toString) {
					const stringValue = noteTypeValue.toString();
					if (stringValue && stringValue !== 'null' && stringValue !== '') {
						noteType = stringValue;
					}
				} else if (typeof noteTypeValue === 'string') {
					noteType = noteTypeValue;
				}

				if (noteType) {
					line += ` (${noteType})`;
				}
			}

			lines.push(line);
		});

		// Add "more" indicator if needed
		if (notes.length > 5) {
			lines.push(`+ ${notes.length - 5} more...`);
		}

		return lines.join('\n');
	}

	private getHeatMapIntensity(noteCount: number): string {
		if (noteCount === 0) return 'none';
		if (noteCount === 1) return 'low';
		if (noteCount <= 3) return 'medium';
		if (noteCount <= 5) return 'high';
		return 'very-high';
	}

	protected setupContainer(): void {
		super.setupContainer();

		const calendar = document.createElement("div");
		calendar.className = "mini-calendar-bases-view";
		this.rootElement?.appendChild(calendar);
		this.calendarEl = calendar;
	}

	protected async handleTaskUpdate(task: TaskInfo): Promise<void> {
		// For mini calendar, refresh on any data change
		this.debouncedRefresh();
	}

	renderError(error: Error): void {
		if (!this.calendarEl) return;

		const errorEl = document.createElement("div");
		errorEl.className = "tn-bases-error";
		errorEl.style.cssText =
			"padding: 20px; color: #d73a49; background: #ffeaea; border-radius: 4px; margin: 10px 0;";
		errorEl.textContent = `Error loading mini calendar: ${error.message || "Unknown error"}`;
		this.calendarEl.appendChild(errorEl);
	}

	onunload(): void {
		// Component.register() calls will be automatically cleaned up
		// Obsidian's setTooltip handles its own cleanup automatically
		this.calendarEl = null;
		this.notesByDate.clear();
		this.monthCalculationCache.clear();
		this.keyboardHandler = null;
	}
}

// Fuzzy selector modal for notes
class NoteSelectionModal extends FuzzySuggestModal<NoteEntry> {
	private notes: NoteEntry[];
	private onChooseNote: (note: NoteEntry | null) => void;
	private plugin: TaskNotesPlugin;

	constructor(
		app: any,
		plugin: TaskNotesPlugin,
		notes: NoteEntry[],
		onChooseNote: (note: NoteEntry | null) => void
	) {
		super(app);
		this.plugin = plugin;
		this.notes = notes;
		this.onChooseNote = onChooseNote;

		this.setPlaceholder("Select a note to open");
		this.setInstructions([
			{ command: "↑↓", purpose: "Navigate" },
			{ command: "↵", purpose: "Open note" },
			{ command: "esc", purpose: "Dismiss" },
		]);
	}

	getItems(): NoteEntry[] {
		// Sort by title
		return this.notes.sort((a, b) => a.title.localeCompare(b.title));
	}

	getItemText(note: NoteEntry): string {
		return note.title;
	}

	renderSuggestion(item: FuzzyMatch<NoteEntry>, el: HTMLElement): void {
		const note = item.item;
		const container = el.createDiv({ cls: "note-selector-modal__suggestion" });

		// Title
		container.createDiv({
			cls: "note-selector-modal__title",
			text: note.title,
		});

		// Path (if not same as title)
		if (note.path !== note.title) {
			container.createDiv({
				cls: "note-selector-modal__path",
				text: note.path,
			});
		}
	}

	onChooseItem(item: NoteEntry, evt: MouseEvent | KeyboardEvent): void {
		this.onChooseNote(item);
	}
}

// Factory function
/**
 * Factory function for Bases registration.
 * Returns an actual MiniCalendarView instance (extends BasesView).
 */
export function buildMiniCalendarViewFactory(plugin: TaskNotesPlugin) {
	return function (controller: any, containerEl: HTMLElement): MiniCalendarView {
		if (!containerEl) {
			console.error("[TaskNotes][MiniCalendarView] No containerEl provided");
			throw new Error("MiniCalendarView requires a containerEl");
		}

		// Create and return the view instance directly
		// MiniCalendarView now properly extends BasesView, so Bases can call its methods directly
		return new MiniCalendarView(controller, containerEl, plugin);
	};
}
