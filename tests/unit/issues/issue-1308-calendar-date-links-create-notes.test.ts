/**
 * Issue #1308: [FR] Improving inconvenient links in calendar view
 *
 * Feature Request:
 * In the calendar view, date headers are clickable links. Clicking them creates
 * daily notes even when no note exists for that date. Users want an option to
 * disable this behavior - either preventing note creation entirely or making
 * date links only work when a note already exists.
 *
 * Current behavior:
 * - CalendarView.ts line 734-735: navLinks: true, navLinkDayClick: handleDateTitleClick
 * - handleDateTitleClick (calendar-core.ts:1314-1352) unconditionally creates daily notes
 * - MiniCalendarView has different behavior - only Ctrl/Cmd+click creates notes
 *
 * Expected behavior (with new option):
 * - Add a viewOption to control date link behavior (e.g., 'navLinksCreateNote')
 * - When disabled: clicking date without existing note should NOT create a note
 * - Could show a notice or just do nothing when no note exists
 */

import type { TFile } from "obsidian";

describe("Issue #1308 - Calendar date links creating unwanted notes", () => {
	/**
	 * Mock of daily notes plugin interface
	 */
	interface MockDailyNotesApi {
		getAllDailyNotes: () => Record<string, TFile>;
		getDailyNote: (moment: unknown, allNotes: Record<string, TFile>) => TFile | null;
		createDailyNote: (moment: unknown) => Promise<TFile>;
		appHasDailyNotesPluginLoaded: () => boolean;
	}

	/**
	 * Simulates the current handleDateTitleClick behavior
	 * This creates notes unconditionally when they don't exist
	 */
	async function handleDateTitleClickCurrent(
		date: Date,
		dailyNotesApi: MockDailyNotesApi,
		openFile: (file: TFile) => Promise<void>
	): Promise<{ noteCreated: boolean; noteOpened: boolean }> {
		if (!dailyNotesApi.appHasDailyNotesPluginLoaded()) {
			return { noteCreated: false, noteOpened: false };
		}

		const moment = { toDate: () => date };
		const allDailyNotes = dailyNotesApi.getAllDailyNotes();
		let dailyNote = dailyNotesApi.getDailyNote(moment, allDailyNotes);

		let noteCreated = false;
		if (!dailyNote) {
			// Current behavior: unconditionally creates the note
			dailyNote = await dailyNotesApi.createDailyNote(moment);
			noteCreated = true;
		}

		if (dailyNote) {
			await openFile(dailyNote);
			return { noteCreated, noteOpened: true };
		}

		return { noteCreated: false, noteOpened: false };
	}

	/**
	 * Simulates the desired handleDateTitleClick behavior with new option
	 * When navLinksCreateNote is false, it should not create notes
	 */
	async function handleDateTitleClickFixed(
		date: Date,
		dailyNotesApi: MockDailyNotesApi,
		openFile: (file: TFile) => Promise<void>,
		options: { navLinksCreateNote: boolean }
	): Promise<{ noteCreated: boolean; noteOpened: boolean; noNoteNotice: boolean }> {
		if (!dailyNotesApi.appHasDailyNotesPluginLoaded()) {
			return { noteCreated: false, noteOpened: false, noNoteNotice: false };
		}

		const moment = { toDate: () => date };
		const allDailyNotes = dailyNotesApi.getAllDailyNotes();
		let dailyNote = dailyNotesApi.getDailyNote(moment, allDailyNotes);

		let noteCreated = false;
		let noNoteNotice = false;

		if (!dailyNote) {
			if (options.navLinksCreateNote) {
				// Create note only if option is enabled
				dailyNote = await dailyNotesApi.createDailyNote(moment);
				noteCreated = true;
			} else {
				// Don't create note, optionally show notice
				noNoteNotice = true;
				return { noteCreated: false, noteOpened: false, noNoteNotice: true };
			}
		}

		if (dailyNote) {
			await openFile(dailyNote);
			return { noteCreated, noteOpened: true, noNoteNotice };
		}

		return { noteCreated: false, noteOpened: false, noNoteNotice };
	}

	/**
	 * Creates a mock daily notes API
	 */
	function createMockDailyNotesApi(existingNotes: Record<string, TFile>): MockDailyNotesApi {
		let notesStore = { ...existingNotes };

		return {
			getAllDailyNotes: () => notesStore,
			getDailyNote: (_moment: unknown, allNotes: Record<string, TFile>) => {
				const keys = Object.keys(allNotes);
				return keys.length > 0 ? allNotes[keys[0]] : null;
			},
			createDailyNote: async (_moment: unknown): Promise<TFile> => {
				const newNote = {
					path: "daily/2024-01-15.md",
					basename: "2024-01-15",
					name: "2024-01-15.md",
					extension: "md",
				} as TFile;
				notesStore["2024-01-15"] = newNote;
				return newNote;
			},
			appHasDailyNotesPluginLoaded: () => true,
		};
	}

	describe("Bug reproduction - current behavior creates unwanted notes", () => {
		test("clicking date with no existing note creates a new note (current unwanted behavior)", async () => {
			const dailyNotesApi = createMockDailyNotesApi({});
			const openedFiles: TFile[] = [];
			const openFile = async (file: TFile) => {
				openedFiles.push(file);
			};

			const date = new Date(2024, 0, 15); // Jan 15, 2024 - no note exists

			const result = await handleDateTitleClickCurrent(date, dailyNotesApi, openFile);

			// Current behavior: note is created even though user might not want it
			expect(result.noteCreated).toBe(true);
			expect(result.noteOpened).toBe(true);

			// This is the unwanted behavior - a note was created just from clicking the date
			expect(Object.keys(dailyNotesApi.getAllDailyNotes())).toHaveLength(1);
		});

		test("no option exists to prevent note creation on date click", () => {
			// This test documents that there's currently no option to control this behavior
			const viewOptions = {
				showScheduled: true,
				showDue: true,
				showScheduledToDueSpan: false,
				showRecurring: true,
				showTimeEntries: false,
				showTimeblocks: false,
				showPropertyBasedEvents: false,
				initialDate: "",
				initialDateProperty: null,
				initialDateStrategy: "first" as const,
				calendarView: "dayGridMonth",
				customDayCount: 3,
				listDayCount: 30,
				slotMinTime: "00:00:00",
				slotMaxTime: "24:00:00",
				slotDuration: "00:30:00",
				firstDay: 0,
				weekNumbers: false,
				nowIndicator: true,
				showWeekends: true,
				showAllDaySlot: true,
				showTodayHighlight: true,
				selectMirror: true,
				timeFormat: "24",
				scrollTime: "08:00:00",
				eventMinHeight: 0,
				slotEventOverlap: true,
				eventMaxStack: null,
				dayMaxEvents: false,
				dayMaxEventRows: false,
				locale: "en",
				startDateProperty: null,
				endDateProperty: null,
				titleProperty: null,
			};

			// Currently there is no navLinksCreateNote option
			// @ts-expect-error - Property doesn't exist yet
			expect(viewOptions.navLinksCreateNote).toBeUndefined();

			// This test should fail when the option is added
			expect("navLinksCreateNote" in viewOptions).toBe(false);
		});
	});

	describe("Expected behavior - with navLinksCreateNote option", () => {
		test("clicking date with navLinksCreateNote=true should create note (backwards compatible)", async () => {
			const dailyNotesApi = createMockDailyNotesApi({});
			const openedFiles: TFile[] = [];
			const openFile = async (file: TFile) => {
				openedFiles.push(file);
			};

			const date = new Date(2024, 0, 15);

			const result = await handleDateTitleClickFixed(date, dailyNotesApi, openFile, {
				navLinksCreateNote: true,
			});

			// With option enabled, should still create notes (backwards compatible)
			expect(result.noteCreated).toBe(true);
			expect(result.noteOpened).toBe(true);
			expect(result.noNoteNotice).toBe(false);
		});

		test("clicking date with navLinksCreateNote=false should NOT create note", async () => {
			const dailyNotesApi = createMockDailyNotesApi({});
			const openedFiles: TFile[] = [];
			const openFile = async (file: TFile) => {
				openedFiles.push(file);
			};

			const date = new Date(2024, 0, 15);

			const result = await handleDateTitleClickFixed(date, dailyNotesApi, openFile, {
				navLinksCreateNote: false,
			});

			// With option disabled, should NOT create notes
			expect(result.noteCreated).toBe(false);
			expect(result.noteOpened).toBe(false);
			expect(result.noNoteNotice).toBe(true);

			// No note should have been created
			expect(Object.keys(dailyNotesApi.getAllDailyNotes())).toHaveLength(0);
		});

		test("clicking date with existing note should open it regardless of option", async () => {
			const existingNote = {
				path: "daily/2024-01-15.md",
				basename: "2024-01-15",
				name: "2024-01-15.md",
				extension: "md",
			} as TFile;

			const dailyNotesApi = createMockDailyNotesApi({ "2024-01-15": existingNote });
			const openedFiles: TFile[] = [];
			const openFile = async (file: TFile) => {
				openedFiles.push(file);
			};

			const date = new Date(2024, 0, 15);

			// Even with navLinksCreateNote=false, should open existing notes
			const result = await handleDateTitleClickFixed(date, dailyNotesApi, openFile, {
				navLinksCreateNote: false,
			});

			expect(result.noteCreated).toBe(false);
			expect(result.noteOpened).toBe(true);
			expect(result.noNoteNotice).toBe(false);
			expect(openedFiles).toHaveLength(1);
			expect(openedFiles[0].path).toBe("daily/2024-01-15.md");
		});
	});

	describe("Alternative approaches", () => {
		/**
		 * Alternative: Disable navLinks entirely when option is off
		 * This would make dates non-clickable instead of clickable-but-no-action
		 */
		test("alternative: disable navLinks when navLinksDisableWithoutNote=true", () => {
			// This tests an alternative approach: conditionally disable navLinks
			// based on whether notes exist for visible dates

			interface CalendarConfig {
				navLinks: boolean;
				navLinksDisableWithoutNote: boolean;
			}

			function computeNavLinks(
				config: CalendarConfig,
				hasAnyDailyNotes: boolean
			): boolean {
				if (config.navLinksDisableWithoutNote && !hasAnyDailyNotes) {
					return false;
				}
				return config.navLinks;
			}

			// Default behavior: navLinks enabled
			expect(
				computeNavLinks({ navLinks: true, navLinksDisableWithoutNote: false }, false)
			).toBe(true);

			// With option: navLinks disabled when no daily notes exist
			expect(
				computeNavLinks({ navLinks: true, navLinksDisableWithoutNote: true }, false)
			).toBe(false);

			// With option but notes exist: navLinks still enabled
			expect(
				computeNavLinks({ navLinks: true, navLinksDisableWithoutNote: true }, true)
			).toBe(true);
		});

		/**
		 * Alternative: Only show visual link styling on dates with notes
		 * This requires per-date evaluation which is more complex
		 */
		test("alternative: per-date navLink styling based on note existence", () => {
			const existingNoteDates = new Set(["2024-01-10", "2024-01-15", "2024-01-20"]);

			function shouldShowDateAsLink(dateStr: string): boolean {
				return existingNoteDates.has(dateStr);
			}

			// Dates with notes should be styled as links
			expect(shouldShowDateAsLink("2024-01-15")).toBe(true);

			// Dates without notes should not be styled as links
			expect(shouldShowDateAsLink("2024-01-16")).toBe(false);

			// This would require modifying FullCalendar's rendering, which may be complex
		});
	});

	describe("Integration with MiniCalendarView", () => {
		/**
		 * MiniCalendarView already has different behavior:
		 * - Regular click: shows note selector if notes exist, does nothing otherwise
		 * - Ctrl/Cmd+click: opens/creates daily note
		 *
		 * This could be a model for CalendarView behavior
		 */
		test("MiniCalendarView only creates notes on Ctrl/Cmd+click, not regular click", () => {
			// This documents the existing MiniCalendarView behavior as a reference

			interface ClickEvent {
				ctrlKey: boolean;
				metaKey: boolean;
			}

			function miniCalendarShouldCreateNote(event: ClickEvent): boolean {
				// MiniCalendarView only creates notes with modifier keys
				return event.ctrlKey || event.metaKey;
			}

			// Regular click: should NOT create note
			expect(miniCalendarShouldCreateNote({ ctrlKey: false, metaKey: false })).toBe(false);

			// Ctrl+click: should create note
			expect(miniCalendarShouldCreateNote({ ctrlKey: true, metaKey: false })).toBe(true);

			// Cmd+click (macOS): should create note
			expect(miniCalendarShouldCreateNote({ ctrlKey: false, metaKey: true })).toBe(true);
		});

		test("CalendarView should consider adopting MiniCalendarView's click behavior", () => {
			// Feature request: CalendarView could adopt similar behavior
			// where regular clicks don't create notes but modifier clicks do

			interface CalendarViewOptions {
				navLinksCreateNote: "always" | "never" | "modifierOnly";
			}

			function shouldCreateNoteOnClick(
				options: CalendarViewOptions,
				event: { ctrlKey: boolean; metaKey: boolean }
			): boolean {
				switch (options.navLinksCreateNote) {
					case "always":
						return true;
					case "never":
						return false;
					case "modifierOnly":
						return event.ctrlKey || event.metaKey;
				}
			}

			const regularClick = { ctrlKey: false, metaKey: false };
			const ctrlClick = { ctrlKey: true, metaKey: false };

			// always: create on any click
			expect(shouldCreateNoteOnClick({ navLinksCreateNote: "always" }, regularClick)).toBe(
				true
			);
			expect(shouldCreateNoteOnClick({ navLinksCreateNote: "always" }, ctrlClick)).toBe(true);

			// never: never create
			expect(shouldCreateNoteOnClick({ navLinksCreateNote: "never" }, regularClick)).toBe(
				false
			);
			expect(shouldCreateNoteOnClick({ navLinksCreateNote: "never" }, ctrlClick)).toBe(false);

			// modifierOnly: only create with Ctrl/Cmd
			expect(
				shouldCreateNoteOnClick({ navLinksCreateNote: "modifierOnly" }, regularClick)
			).toBe(false);
			expect(
				shouldCreateNoteOnClick({ navLinksCreateNote: "modifierOnly" }, ctrlClick)
			).toBe(true);
		});
	});
});
