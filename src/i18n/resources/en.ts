import { TranslationTree } from "../types";

export const en: TranslationTree = {
	common: {
		appName: "TaskNotes",
		new: "New",
		cancel: "Cancel",
		confirm: "Confirm",
		close: "Close",
		save: "Save",
		language: "Language",
		systemDefault: "System default",
		loading: "Loading...",
		languages: {
			en: "English",
			fr: "French",
			ru: "Russian",
			zh: "Chinese",
			de: "German",
			es: "Spanish",
			ja: "Japanese",
			pt: "Portuguese (Brazil)",
			ko: "Korean",
		},
		weekdays: {
			sunday: "Sunday",
			monday: "Monday",
			tuesday: "Tuesday",
			wednesday: "Wednesday",
			thursday: "Thursday",
			friday: "Friday",
			saturday: "Saturday",
		},
		months: {
			january: "January",
			february: "February",
			march: "March",
			april: "April",
			may: "May",
			june: "June",
			july: "July",
			august: "August",
			september: "September",
			october: "October",
			november: "November",
			december: "December",
		},
	},
	views: {
		agenda: {
			title: "Agenda",
			today: "Today",
			overdue: "Overdue",
			refreshCalendars: "Refresh calendars",
			actions: {
				previousPeriod: "Previous period",
				nextPeriod: "Next period",
				goToToday: "Go to today",
				refreshCalendars: "Refresh calendar subscriptions",
			},
			loading: "Loading agenda...",
			dayToggle: "Toggle day",
			overdueToggle: "Toggle overdue section",
			expandAllDays: "Expand All Days",
			collapseAllDays: "Collapse All Days",
			notices: {
				calendarNotReady: "Calendar service not ready yet",
				calendarRefreshed: "Calendar subscriptions refreshed",
				refreshFailed: "Failed to refresh",
			},
			empty: {
				noItemsScheduled: "No items scheduled",
				noItemsFound: "No items found",
				helpText: "Create tasks with due or scheduled dates, or add notes to see them here.",
			},
			contextMenu: {
				showOverdueSection: "Show overdue section",
				showNotes: "Show notes",
				calendarSubscriptions: "Calendar subscriptions",
			},
			periods: {
				thisWeek: "This week",
			},
			tipPrefix: "Tip: ",
		},
		taskList: {
			title: "Tasks",
			expandAllGroups: "Expand All Groups",
			collapseAllGroups: "Collapse All Groups",
			noTasksFound: "No tasks found for the selected filters.",
		},
		notes: {
			title: "Notes",
			refreshButton: "Refresh",
			refreshingButton: "Refreshing...",
			notices: {
				indexingDisabled: "Note indexing disabled",
			},
			empty: {
				noNotesFound: "No notes found",
				helpText: "No notes found for the selected date. Try selecting a different date in the Mini Calendar view or create some notes.",
			},
			loading: "Loading notes...",
			refreshButtonAriaLabel: "Refresh notes list",
		},
		miniCalendar: {
			title: "Mini Calendar",
		},
		advancedCalendar: {
			title: "Calendar",
			filters: {
				showFilters: "Show filters",
				hideFilters: "Hide filters",
			},
			viewOptions: {
				calendarSubscriptions: "Calendar subscriptions",
				timeEntries: "Time entries",
				timeblocks: "Timeblocks",
				scheduledDates: "Scheduled dates",
				dueDates: "Due dates",
				allDaySlot: "All-day slot",
				scheduledTasks: "Scheduled tasks",
				recurringTasks: "Recurring tasks",
			},
			buttons: {
				refresh: "Refresh",
				refreshHint: "Refresh Calendar Subscriptions",
			},
			notices: {
				icsServiceNotAvailable: "ICS subscription service not available",
				calendarRefreshedAll: "All calendar subscriptions refreshed successfully",
				refreshFailed: "Failed to refresh some calendar subscriptions",
				timeblockSpecificTime:
					"Timeblocks must have specific times. Please select a time range in week or day view.",
				timeblockMoved: 'Moved timeblock "{title}" to {date}',
				timeblockUpdated: 'Updated timeblock "{title}" time',
				timeblockMoveFailed: "Failed to move timeblock: {message}",
				timeblockResized: 'Updated timeblock "{title}" duration',
				timeblockResizeFailed: "Failed to resize timeblock: {message}",
				taskScheduled: 'Task "{title}" scheduled for {date}',
				scheduleTaskFailed: "Failed to schedule task",
				endTimeAfterStart: "End time must be after start time",
				timeEntryNotFound: "Time entry not found",
				timeEntryDeleted: "Time entry deleted",
				deleteTimeEntryFailed: "Failed to delete time entry",
			},
			timeEntry: {
				estimatedSuffix: "estimated",
				trackedSuffix: "tracked",
				recurringPrefix: "Recurring: ",
				completedPrefix: "Completed: ",
				createdPrefix: "Created: ",
				modifiedPrefix: "Modified: ",
				duePrefix: "Due: ",
				scheduledPrefix: "Scheduled: ",
			},
			contextMenus: {
				openTask: "Open task",
				deleteTimeEntry: "Delete time entry",
				deleteTimeEntryTitle: "Delete Time Entry",
				deleteTimeEntryConfirm:
					"Are you sure you want to delete this time entry{duration}? This action cannot be undone.",
				deleteButton: "Delete",
				cancelButton: "Cancel",
			},
		},
		basesCalendar: {
			title: "Bases Calendar",
			today: "Today",
			buttonText: {
				month: "M",
				week: "W",
				day: "D",
				year: "Y",
				list: "L",
				customDays: "{count}D",
				listDays: "{count}d List",
				refresh: "Refresh",
			},
			hints: {
				refresh: "Refresh calendar subscriptions",
				today: "Go to today",
				prev: "Previous",
				next: "Next",
				month: "Month view",
				week: "Week view",
				day: "Day view",
				year: "Year view",
				list: "List view",
				customDays: "{count}-day view",
			},
			settings: {
				groups: {
					dateNavigation: "Date Navigation",
					events: "Events",
					layout: "Layout",
					propertyBasedEvents: "Property-based events",
					calendarSubscriptions: "Calendar subscriptions",
					googleCalendars: "Google Calendars",
					microsoftCalendars: "Microsoft Calendars",
				},
				dateNavigation: {
					navigateToDate: "Navigate to date",
					navigateToDatePlaceholder: "YYYY-MM-DD (e.g., 2025-01-15) - leave empty to use property",
					navigateToDateFromProperty: "Navigate to date from property",
					navigateToDateFromPropertyPlaceholder: "Select a date property (optional)",
					propertyNavigationStrategy: "Property navigation strategy",
					strategies: {
						first: "First result",
						earliest: "Earliest date",
						latest: "Latest date",
					},
				},
				events: {
					showScheduledTasks: "Show scheduled tasks",
					showDueTasks: "Show due tasks",
					showRecurringTasks: "Show recurring tasks",
					showTimeEntries: "Show time entries",
					showTimeblocks: "Show timeblocks",
					showPropertyBasedEvents: "Show property-based events",
				},
				layout: {
					calendarView: "Calendar view",
					customDayCount: "Custom day count",
					listDayCount: "List day count",
					dayStartTime: "Day start time",
					dayStartTimePlaceholder: "HH:mm:ss (e.g., 08:00:00)",
					dayEndTime: "Day end time",
					dayEndTimePlaceholder: "HH:mm:ss (e.g., 20:00:00)",
					timeSlotDuration: "Time slot duration",
					timeSlotDurationPlaceholder: "HH:mm:ss (e.g., 00:30:00)",
					weekStartsOn: "Week starts on",
					showWeekNumbers: "Show week numbers",
					showNowIndicator: "Show now indicator",
					showWeekends: "Show weekends",
					showAllDaySlot: "Show all-day slot",
					showTodayHighlight: "Show today highlight",
					showSelectionPreview: "Show selection preview",
					timeFormat: "Time format",
					timeFormat12: "12-hour (AM/PM)",
					timeFormat24: "24-hour",
					initialScrollTime: "Initial scroll time",
					initialScrollTimePlaceholder: "HH:mm:ss (e.g., 08:00:00)",
					minimumEventHeight: "Minimum event height (px)",
					slotEventOverlap: "Allow events to overlap",
					enableSearch: "Enable search box",
					eventMaxStack: "Max stacked events (week/day view, 0 = unlimited)",
					dayMaxEvents: "Max events per day (month view, 0 = auto)",
					dayMaxEventRows: "Max event rows per day (month view, 0 = unlimited)",
					spanScheduledToDue: "Span tasks between scheduled and due dates",
				},
				propertyBasedEvents: {
					startDateProperty: "Start date property",
					startDatePropertyPlaceholder: "Select property for start date/time",
					endDateProperty: "End date property (optional)",
					endDatePropertyPlaceholder: "Select property for end date/time",
					titleProperty: "Title property (optional)",
					titlePropertyPlaceholder: "Select property for event title",
				},
			},
			errors: {
				failedToInitialize: "Failed to initialize calendar",
			},
		},
		kanban: {
			title: "Kanban",
			newTask: "New task",
			addCard: "+ Add a card",
			noTasks: "No tasks",
			uncategorized: "Uncategorized",
			noProject: "No Project",
			notices: {
				loadFailed: "Failed to load Kanban board",
				movedTask: 'Task moved to "{0}"',
			},
			errors: {
				loadingBoard: "Error loading board.",
				noGroupBy: "Kanban view requires a 'Group by' property to be configured. Click the 'Sort' button and select a property under 'Group by'.",
				formulaGroupingReadOnly: "Cannot move tasks between formula-based columns. Formula values are computed and cannot be directly modified.",
				formulaSwimlaneReadOnly: "Cannot move tasks between formula-based swimlanes. Formula values are computed and cannot be directly modified.",
			},
			columnTitle: "Untitled",
		},
		pomodoro: {
			title: "Pomodoro",
			status: {
				focus: "Focus",
				ready: "Ready to start",
				paused: "Paused",
				working: "Working",
				shortBreak: "Short break",
				longBreak: "Long break",
				breakPrompt: "Great work! Time for a {length} break",
				breakLength: {
					short: "short",
					long: "long",
				},
				breakComplete: "Break complete! Ready for the next pomodoro?",
			},
			buttons: {
				start: "Start",
				pause: "Pause",
				stop: "Stop",
				resume: "Resume",
				startShortBreak: "Start Short Break",
				startLongBreak: "Start Long Break",
				skipBreak: "Skip break",
				chooseTask: "Choose task...",
				changeTask: "Change task...",
				clearTask: "Clear task",
				selectDifferentTask: "Select a different task",
			},
			notices: {
				noTasks: "No unarchived tasks found. Create some tasks first.",
				loadFailed: "Failed to load tasks",
			},
			statsLabel: "completed today",
		},
		pomodoroStats: {
			title: "Pomodoro stats",
			heading: "Pomodoro statistics",
			refresh: "Refresh",
			sections: {
				overview: "Overview",
				today: "Today",
				week: "This week",
				allTime: "All time",
				recent: "Recent sessions",
			},
			overviewCards: {
				todayPomos: {
					label: "Today's Pomos",
					change: {
						more: "{count} more than yesterday",
						less: "{count} fewer than yesterday",
					},
				},
				totalPomos: {
					label: "Total Pomos",
				},
				todayFocus: {
					label: "Today's Focus",
					change: {
						more: "{duration} more than yesterday",
						less: "{duration} less than yesterday",
					},
				},
				totalFocus: {
					label: "Total Focus Duration",
				},
			},
			stats: {
				pomodoros: "Pomodoros",
				streak: "Streak",
				minutes: "Minutes",
				average: "Avg length",
				completion: "Completion",
			},
			recents: {
				empty: "No sessions recorded yet",
				duration: "{minutes} min",
				status: {
					completed: "Completed",
					interrupted: "Interrupted",
				},
			},
		},
		stats: {
			title: "Statistics",
			taskProjectStats: "Task & Project Statistics",
			sections: {
				filters: "Filters",
				overview: "Overview",
				today: "Today",
				thisWeek: "This Week",
				thisMonth: "This Month",
				projectBreakdown: "Project Breakdown",
				dateRange: "Date Range",
			},
			filters: {
				minTime: "Min Time (minutes)",
				allTasks: "All Tasks",
				activeOnly: "Active Only",
				completedOnly: "Completed Only",
			},
			refreshButton: "Refresh",
			timeRanges: {
				allTime: "All Time",
				last7Days: "Last 7 Days",
				last30Days: "Last 30 Days",
				last90Days: "Last 90 Days",
				customRange: "Custom Range",
			},
			resetFiltersButton: "Reset Filters",
			dateRangeFrom: "From",
			dateRangeTo: "To",
			noProject: "No Project",
			cards: {
				timeTrackedEstimated: "Time Tracked / Estimated",
				totalTasks: "Total Tasks",
				completionRate: "Completion Rate",
				activeProjects: "Active Projects",
				avgTimePerTask: "Avg Time per Task",
			},
			labels: {
				tasks: "Tasks",
				completed: "Completed",
				projects: "Projects",
			},
			noProjectData: "No project data available",
			notAvailable: "N/A",
			noTasks: "No tasks found",
			loading: "Loading...",
		},
		releaseNotes: {
			title: "What's new in TaskNotes {version}",
			header: "What's new in TaskNotes {version}",
			viewAllLink: "View all release notes on GitHub →",
			starMessage: "If you find TaskNotes useful, please consider giving it a star on GitHub",
		},
	},
	settings: {
		header: {
			documentation: "Documentation",
			documentationUrl: "https://tasknotes.dev",
		},
		tabs: {
			general: "General",
			taskProperties: "Task Properties",
			modalFields: "Modal Fields",
			defaults: "Defaults & Templates",
			appearance: "Appearance & UI",
			features: "Features",
			integrations: "Integrations",
		},
		features: {
			inlineTasks: {
				header: "Inline Tasks",
				description:
					"Settings for task links and checkbox-to-task conversion in notes.",
			},
			overlays: {
				taskLinkToggle: {
					name: "Task link overlay",
					description: "Show interactive overlays when hovering over task links",
				},
				aliasExclusion: {
					name: "Disable overlay for aliased links",
					description:
						"Do not show the task widget if the link contains an alias (e.g. [[Task|Alias]]).",
				},
			},
			instantConvert: {
				toggle: {
					name: "Show convert button next to checkboxes",
					description:
						"Display an inline button next to Markdown checkboxes that converts them to TaskNotes",
				},
				folder: {
					name: "Folder for converted tasks",
					description:
						"Folder where tasks converted from checkboxes will be created. Leave empty to use the default tasks folder. Use {{currentNotePath}} for the current note's folder, or {{currentNoteTitle}} for a subfolder named after the current note.",
				},
			},
			nlp: {
				header: "Natural Language Processing",
				description: "Parse dates, priorities, and other properties from text input.",
				enable: {
					name: "Enable natural language task input",
					description:
						"Parse due dates, priorities, and contexts from natural language when creating tasks",
				},
				defaultToScheduled: {
					name: "Default to scheduled",
					description:
						"When NLP detects a date without context, treat it as scheduled rather than due",
				},
				language: {
					name: "NLP language",
					description:
						"Language for natural language processing patterns and date parsing",
				},
				statusTrigger: {
					name: "Status suggestion trigger",
					description: "Text to trigger status suggestions (leave empty to disable)",
				},
			},
			pomodoro: {
				header: "Pomodoro Timer",
				description:
					"Configure work/break intervals for the Pomodoro timer.",
				workDuration: {
					name: "Work duration",
					description: "Duration of work intervals in minutes",
				},
				shortBreak: {
					name: "Short break duration",
					description: "Duration of short breaks in minutes",
				},
				longBreak: {
					name: "Long break duration",
					description: "Duration of long breaks in minutes",
				},
				longBreakInterval: {
					name: "Long break interval",
					description: "Number of work sessions before a long break",
				},
				autoStartBreaks: {
					name: "Auto-start breaks",
					description: "Automatically start break timers after work sessions",
				},
				autoStartWork: {
					name: "Auto-start work",
					description: "Automatically start work sessions after breaks",
				},
				notifications: {
					name: "Pomodoro notifications",
					description: "Show notifications when Pomodoro sessions end",
				},
				mobileSidebar: {
					name: "Mobile sidebar",
					description: "Where to open the Pomodoro timer on mobile devices",
					tab: "Note panel",
					left: "Left sidebar",
					right: "Right sidebar",
				},
			},
			uiLanguage: {
				header: "Interface Language",
				description: "Change the language of TaskNotes menus, notices, and views.",
				dropdown: {
					name: "UI language",
					description: "Select the language used for TaskNotes interface text",
				},
			},
			pomodoroSound: {
				enabledName: "Sound enabled",
				enabledDesc: "Play sound when Pomodoro sessions end",
				volumeName: "Sound volume",
				volumeDesc: "Volume for Pomodoro sounds (0-100)",
			},
			dataStorage: {
				name: "Pomodoro data storage",
				description: "Configure where pomodoro session data is stored and how it's managed.",
				dailyNotes: "Daily notes",
				pluginData: "Plugin data",
				notices: {
					locationChanged: "Pomodoro storage location changed to {location}",
				},
			},
			notifications: {
				header: "Notifications",
				description: "Configure task reminder notifications and alerts.",
				enableName: "Enable notifications",
				enableDesc: "Enable task reminder notifications",
				typeName: "Notification type",
				typeDesc: "Type of notifications to show",
				systemLabel: "System notifications",
				inAppLabel: "In-app notifications",
			},
			overdue: {
				hideCompletedName: "Hide completed tasks from overdue",
				hideCompletedDesc: "Exclude completed tasks from overdue task calculations",
			},
			indexing: {
				disableName: "Disable note indexing",
				disableDesc: "Disable automatic indexing of note content for better performance",
			},
			suggestions: {
				debounceName: "Suggestion debounce",
				debounceDesc: "Delay in milliseconds before showing suggestions",
			},
			timeTracking: {
				autoStopName: "Auto-stop time tracking",
				autoStopDesc: "Automatically stop time tracking when a task is marked complete",
				stopNotificationName: "Time tracking stop notification",
				stopNotificationDesc:
					"Show notification when time tracking is automatically stopped",
			},
			recurring: {
				maintainOffsetName: "Maintain due date offset in recurring tasks",
				maintainOffsetDesc:
					"Keep the offset between due date and scheduled date when recurring tasks are completed",
			},
			timeblocking: {
				header: "Timeblocking",
				description:
					"Configure timeblock functionality for lightweight scheduling in daily notes. Drag on calendar views to create events - select 'Timeblock' from the context menu.",
				enableName: "Enable timeblocking",
				enableDesc:
					"Enable timeblocking feature for lightweight scheduling in daily notes. When enabled, 'Timeblock' option appears in the calendar drag context menu.",
				showBlocksName: "Show timeblocks",
				showBlocksDesc: "Display timeblocks from daily notes by default",
				defaultColorName: "Default timeblock color",
				defaultColorDesc: "The default color used when creating new timeblocks",
				usage: "Usage: Drag on the calendar to create events. Select 'Timeblock' from the context menu (only visible when timeblocking is enabled). Drag to move existing timeblocks. Resize edges to adjust duration.",
			},
			performance: {
				header: "Performance & Behavior",
				description: "Configure plugin performance and behavioral options.",
			},
			timeTrackingSection: {
				header: "Time Tracking",
				description: "Configure automatic time tracking behaviors.",
			},
			recurringSection: {
				header: "Recurring Tasks",
				description: "Configure behavior for recurring task management.",
			},
		},
		defaults: {
			header: {
				basicDefaults: "Basic Defaults",
				dateDefaults: "Date Defaults",
				defaultReminders: "Default reminders",
				bodyTemplate: "Body Template",
				instantTaskConversion: "Instant Task Conversion",
			},
			description: {
				basicDefaults: "Set default values for new tasks to speed up task creation.",
				dateDefaults: "Set default due and scheduled dates for new tasks.",
				defaultReminders: "Configure default reminders that will be added to new tasks.",
				bodyTemplate: "Configure a template file to use for new task content.",
				instantTaskConversion:
					"Configure behavior when converting text to tasks instantly.",
			},
			basicDefaults: {
				defaultStatus: {
					name: "Default status",
					description: "Default status for new tasks",
				},
				defaultPriority: {
					name: "Default priority",
					description: "Default priority for new tasks",
				},
				defaultContexts: {
					name: "Default contexts",
					description: "Comma-separated list of default contexts (e.g., @home, @work)",
					placeholder: "@home, @work",
				},
				defaultTags: {
					name: "Default tags",
					description: "Comma-separated list of default tags (without #)",
					placeholder: "important, urgent",
				},
				defaultProjects: {
					name: "Default projects",
					description: "Default project links for new tasks",
					selectButton: "Select Projects",
					selectTooltip: "Choose project notes to link by default",
					removeTooltip: "Remove {name} from default projects",
				},
				useParentNoteAsProject: {
					name: "Use parent note as project during instant conversion",
					description:
						"Automatically link the parent note as a project when using instant task conversion",
				},
				defaultTimeEstimate: {
					name: "Default time estimate",
					description: "Default time estimate in minutes (0 = no default)",
					placeholder: "60",
				},
				defaultRecurrence: {
					name: "Default recurrence",
					description: "Default recurrence pattern for new tasks",
				},
			},
			dateDefaults: {
				defaultDueDate: {
					name: "Default due date",
					description: "Default due date for new tasks",
				},
				defaultScheduledDate: {
					name: "Default scheduled date",
					description: "Default scheduled date for new tasks",
				},
			},
			reminders: {
				addReminder: {
					name: "Add default reminder",
					description:
						"Create a new default reminder that will be added to all new tasks",
					buttonText: "Add reminder",
				},
				emptyState:
					"No default reminders configured. Add a reminder to automatically notify you about new tasks.",
				emptyStateButton: "Add Reminder",
				reminderDescription: "Reminder description",
				unnamedReminder: "Unnamed Reminder",
				deleteTooltip: "Delete reminder",
				fields: {
					description: "Description:",
					type: "Type:",
					offset: "Offset:",
					unit: "Unit:",
					direction: "Direction:",
					relatedTo: "Related to:",
					date: "Date:",
					time: "Time:",
				},
				types: {
					relative: "Relative (before/after task dates)",
					absolute: "Absolute (specific date/time)",
				},
				units: {
					minutes: "minutes",
					hours: "hours",
					days: "days",
				},
				directions: {
					before: "before",
					after: "after",
				},
				relatedTo: {
					due: "due date",
					scheduled: "scheduled date",
				},
			},
			bodyTemplate: {
				useBodyTemplate: {
					name: "Use body template",
					description: "Use a template file for task body content",
				},
				bodyTemplateFile: {
					name: "Body template file",
					description:
						"Path to template file for task body content. Supports template variables like {{title}}, {{date}}, {{time}}, {{priority}}, {{status}}, etc.",
					placeholder: "Templates/Task Template.md",
					ariaLabel: "Path to body template file",
				},
				variablesHeader: "Template variables:",
				variables: {
					title: "{{title}} - Task title",
					details: "{{details}} - User-provided details from modal",
					date: "{{date}} - Current date (YYYY-MM-DD)",
					time: "{{time}} - Current time (HH:MM)",
					priority: "{{priority}} - Task priority",
					status: "{{status}} - Task status",
					contexts: "{{contexts}} - Task contexts",
					tags: "{{tags}} - Task tags",
					projects: "{{projects}} - Task projects",
				},
			},
			instantConversion: {
				useDefaultsOnInstantConvert: {
					name: "Use task defaults on instant convert",
					description:
						"Apply default task settings when converting text to tasks instantly",
				},
			},
			options: {
				noDefault: "No default",
				none: "None",
				today: "Today",
				tomorrow: "Tomorrow",
				nextWeek: "Next week",
				daily: "Daily",
				weekly: "Weekly",
				monthly: "Monthly",
				yearly: "Yearly",
			},
		},
		general: {
			taskStorage: {
				header: "Task Storage",
				description: "Configure where tasks are stored and how they are identified.",
				defaultFolder: {
					name: "Default tasks folder",
					description: "Default location for new tasks",
				},
				moveArchived: {
					name: "Move archived tasks to folder",
					description: "Automatically move archived tasks to an archive folder",
				},
				archiveFolder: {
					name: "Archive folder",
					description:
						"Folder to move tasks to when archived. Supports template variables like {{year}}, {{month}}, {{priority}}, etc.",
				},
			},
			taskIdentification: {
				header: "Task Identification",
				description: "Choose how TaskNotes identifies notes as tasks.",
				identifyBy: {
					name: "Identify tasks by",
					description:
						"Choose whether to identify tasks by tag or by a frontmatter property",
					options: {
						tag: "Tag",
						property: "Property",
					},
				},
				taskTag: {
					name: "Task tag",
					description: "Tag that identifies notes as tasks (without #)",
				},
				hideIdentifyingTags: {
					name: "Hide identification tags in task cards",
					description:
						"When enabled, tags matching the task identification tag (including hierarchical matches like 'task/project') will be hidden from task card displays",
				},
				taskProperty: {
					name: "Task property name",
					description: 'The frontmatter property name (e.g., "category")',
				},
				taskPropertyValue: {
					name: "Task property value",
					description: 'The value that identifies a note as a task (e.g., "task")',
				},
			},
			folderManagement: {
				header: "Folder Management",
				excludedFolders: {
					name: "Excluded folders",
					description: "Comma-separated list of folders to exclude from task indexing and project suggestions",
				},
			},
			frontmatter: {
				header: "Frontmatter",
				description: "Configure how links are formatted in frontmatter properties.",
				useMarkdownLinks: {
					name: "Use markdown links in frontmatter",
					description: "Generate markdown links ([text](path)) instead of wikilinks ([[link]]) in frontmatter properties.\n\n⚠️ Requires the 'obsidian-frontmatter-markdown-links' plugin to work correctly.",
				},
			},
			taskInteraction: {
				header: "Task Interaction",
				description: "Configure how clicking on tasks behaves.",
				singleClick: {
					name: "Single-click action",
					description: "Action performed when single-clicking a task card",
				},
				doubleClick: {
					name: "Double-click action",
					description: "Action performed when double-clicking a task card",
				},
				actions: {
					edit: "Edit task",
					openNote: "Open note",
					none: "No action",
				},
			},
			releaseNotes: {
				header: "Release Notes",
				description: "Current version: {version}",
				showOnUpdate: {
					name: "Show release notes after update",
					description: "Automatically open release notes when TaskNotes is updated to a new version",
				},
				viewButton: {
					name: "View release notes",
					description: "See what's new in the latest version of TaskNotes",
					buttonText: "View release notes",
				},
			},
		},
		taskProperties: {
			// Section headers for property card layout
			sections: {
				coreProperties: "Core Properties",
				corePropertiesDesc: "Status and priority are the core properties that define a task's state and importance.",
				dateProperties: "Date Properties",
				datePropertiesDesc: "Configure when tasks are due and scheduled.",
				organizationProperties: "Organization Properties",
				organizationPropertiesDesc: "Organize tasks with contexts, projects, and tags.",
				taskDetails: "Task Details",
				taskDetailsDesc: "Additional details like time estimates, recurrence, and reminders.",
				metadataProperties: "Metadata Properties",
				metadataPropertiesDesc: "System-managed properties for tracking task history.",
				featureProperties: "Feature Properties",
				featurePropertiesDesc: "Properties used by specific TaskNotes features like Pomodoro timer and calendar sync.",
			},
			// Property card common fields
			propertyCard: {
				propertyKey: "Property key:",
				default: "Default:",
				nlpTrigger: "NLP trigger:",
				triggerChar: "Trigger character:",
				triggerEmpty: "Trigger cannot be empty",
				triggerTooLong: "Trigger is too long (max 10 characters)",
			},
			// Individual property names and descriptions
			properties: {
				status: {
					name: "Status",
					description:
						"Tracks the current state of a task (e.g., todo, in-progress, done). Status determines whether a task appears as completed and can trigger auto-archiving.",
				},
				priority: {
					name: "Priority",
					description:
						"Indicates task importance. Used for sorting and filtering. Values are sorted alphabetically in Bases views, so use prefixes like 1-, 2- to control order.",
				},
				due: {
					name: "Due Date",
					description:
						"The deadline by which a task must be completed. Tasks past their due date appear as overdue. Stored as a date in frontmatter.",
				},
				scheduled: {
					name: "Scheduled Date",
					description:
						"When you plan to work on a task. Unlike due date, this represents your intended start time. Tasks appear on the calendar at their scheduled date/time.",
				},
				contexts: {
					name: "Contexts",
					description:
						"Locations or conditions where a task can be done (e.g., @home, @office, @phone). Useful for filtering tasks by your current situation. Stored as a list.",
				},
				projects: {
					name: "Projects",
					description:
						"Links to project notes this task belongs to. Stored as wikilinks (e.g., [[Project Name]]). Tasks can belong to multiple projects.",
				},
				tags: {
					name: "Tags",
					description:
						"Native Obsidian tags for categorizing tasks. These are stored in the tags frontmatter property and work with Obsidian's tag features.",
				},
				timeEstimate: {
					name: "Time Estimate",
					description:
						"Estimated minutes to complete the task. Used for time-blocking and workload planning. Displayed on task cards and calendar events.",
				},
				recurrence: {
					name: "Recurrence",
					description:
						"Pattern for repeating tasks (daily, weekly, monthly, yearly, or custom RRULE). When a recurring task is completed, its scheduled date is automatically updated to the next occurrence.",
				},
				recurrenceAnchor: {
					name: "Recurrence Anchor",
					description:
						"Controls how the next occurrence is calculated: 'scheduled' uses the scheduled date, 'completion' uses the actual completion date.",
				},
				reminders: {
					name: "Reminders",
					description:
						"Notifications triggered before due or scheduled dates. Stored as a list of reminder objects with timing and optional description.",
				},
				title: {
					name: "Title",
					description:
						"The task name. Can be stored in frontmatter or in the filename (when 'Store title in filename' is enabled).",
				},
				dateCreated: {
					name: "Date Created",
					description:
						"Timestamp when the task was first created. Automatically set and used for sorting by creation order.",
				},
				dateModified: {
					name: "Date Modified",
					description:
						"Timestamp of the last change to the task. Automatically updated when any task property changes.",
				},
				completedDate: {
					name: "Completed Date",
					description:
						"Timestamp when the task was marked complete. Set automatically when status changes to a completed state.",
				},
				archiveTag: {
					name: "Archive Tag",
					description:
						"Tag added to tasks when archived. Used to identify archived tasks and can trigger file movement to archive folder.",
				},
				timeEntries: {
					name: "Time Entries",
					description:
						"Records of time tracking sessions for this task. Each entry stores start and end timestamps. Used to calculate total time spent.",
				},
				completeInstances: {
					name: "Complete Instances",
					description:
						"Completion history for recurring tasks. Stores dates when each instance was completed to prevent duplicate completions.",
				},
				skippedInstances: {
					name: "Skipped Instances",
					description:
						"Skipped occurrences for recurring tasks. Stores dates of instances that were skipped rather than completed.",
				},
				blockedBy: {
					name: "Blocked By",
					description:
						"Links to tasks that must be completed before this one. Stored as wikilinks. Blocked tasks display a visual indicator.",
				},
				pomodoros: {
					name: "Pomodoros",
					description:
						"Count of completed Pomodoro sessions. When data storage is set to 'Daily notes', this is written to daily notes instead of task files.",
				},
				icsEventId: {
					name: "ICS Event ID",
					description:
						"Unique identifier linking a note to an ICS calendar event. Added automatically when creating notes from calendar events.",
				},
				icsEventTag: {
					name: "ICS Event Tag",
					description:
						"Tag identifying notes created from ICS calendar events. Used to distinguish calendar-generated notes from regular tasks.",
				},
			},
			// Card-specific labels
			statusCard: {
				valuesHeader: "Status Values",
			},
			priorityCard: {
				valuesHeader: "Priority Values",
			},
			projectsCard: {
				defaultProjects: "Default projects:",
				useParentNote: "Use parent note as project:",
				noDefaultProjects: "No default projects selected",
				autosuggestFilters: "Autosuggest Filters",
				customizeDisplay: "Customize Display",
				filtersOn: "Filters On",
			},
			titleCard: {
				storeTitleInFilename: "Store title in filename:",
				storedInFilename: "Stored in filename",
				filenameUpdatesWithTitle: "Filename will automatically update when the task title changes.",
				filenameFormat: "Filename format:",
				customTemplate: "Custom template:",
				legacySyntaxWarning: "Single-brace syntax like {title} is deprecated. Please use double-brace syntax {{title}} instead for consistency with body templates.",
			},
			tagsCard: {
				nativeObsidianTags: "Uses native Obsidian tags",
			},
			remindersCard: {
				defaultReminders: "Default Reminders",
			},
			taskStatuses: {
				header: "Task Statuses",
				description:
					"Customize the status options available for your tasks. These statuses control the task lifecycle and determine when tasks are considered complete.",
				howTheyWork: {
					title: "How statuses work:",
					value: 'Value: The internal identifier stored in your task files (e.g., "in-progress")',
					label: 'Label: The display name shown in the interface (e.g., "In Progress")',
					color: "Color: Visual indicator color for the status dot and badges",
					icon: 'Icon: Optional Lucide icon name to display instead of colored dot (e.g., "check", "circle", "clock"). Browse icons at lucide.dev',
					completed:
						"Completed: When checked, tasks with this status are considered finished and may be filtered differently",
					autoArchive:
						"Auto-archive: When enabled, tasks will be automatically archived after the specified delay (1-1440 minutes)",
					orderNote:
						"The order below determines the sequence when cycling through statuses by clicking on task status badges.",
				},
				addNew: {
					name: "Add new status",
					description: "Create a new status option for your tasks",
					buttonText: "Add status",
				},
				validationNote:
					'Note: You must have at least 2 statuses, and at least one status must be marked as "Completed".',
				emptyState: "No custom statuses configured. Add a status to get started.",
				emptyStateButton: "Add Status",
				fields: {
					value: "Value:",
					label: "Label:",
					color: "Color:",
					icon: "Icon:",
					completed: "Completed:",
					autoArchive: "Auto-archive:",
					delayMinutes: "Delay (minutes):",
				},
				placeholders: {
					value: "in-progress",
					label: "In Progress",
					icon: "check, circle, clock",
				},
				badges: {
					completed: "Completed",
				},
				deleteConfirm: 'Are you sure you want to delete the status "{label}"?',
			},
			taskPriorities: {
				header: "Task Priorities",
				description:
					"Customize the priority levels available for your tasks. In v4.0+, priorities are sorted alphabetically by their value in Bases views.",
				howTheyWork: {
					title: "How priorities work:",
					value:
						'Value: The internal identifier stored in your task files. Use prefixes like "1-urgent", "2-high" to control sort order in Bases views.',
					label: 'Display Label: The display name shown in the interface (e.g., "High Priority")',
					color: "Color: Visual indicator color for the priority dot and badges",
				},
				addNew: {
					name: "Add new priority",
					description: "Create a new priority level for your tasks",
					buttonText: "Add priority",
				},
				validationNote:
					"Note: You must have at least 1 priority. Priorities are sorted alphabetically by value in Bases views.",
				emptyState: "No custom priorities configured. Add a priority to get started.",
				emptyStateButton: "Add Priority",
				fields: {
					value: "Value:",
					label: "Label:",
					color: "Color:",
				},
				placeholders: {
					value: "high",
					label: "High Priority",
				},
				deleteConfirm: "You must have at least one priority",
				deleteTooltip: "Delete priority",
			},
			fieldMapping: {
				header: "Field Mapping",
				warning:
					"⚠️ Warning: TaskNotes will read AND write using these property names. Changing these after creating tasks may cause inconsistencies.",
				description:
					"Configure which frontmatter properties TaskNotes should use for each field.",
				resetButton: {
					name: "Reset field mappings",
					description: "Reset all field mappings to default values",
					buttonText: "Reset to Defaults",
				},
				notices: {
					resetSuccess: "Field mappings reset to defaults",
					resetFailure: "Failed to reset field mappings",
					updateFailure: "Failed to update field mapping for {label}. Please try again.",
				},
				table: {
					fieldHeader: "TaskNotes field",
					propertyHeader: "Your property name",
				},
				fields: {
					title: "Title",
					status: "Status",
					priority: "Priority",
					due: "Due date",
					scheduled: "Scheduled date",
					contexts: "Contexts",
					projects: "Projects",
					timeEstimate: "Time estimate",
					recurrence: "Recurrence",
					dateCreated: "Created date",
					completedDate: "Completed date",
					dateModified: "Modified date",
					archiveTag: "Archive tag",
					timeEntries: "Time entries",
					completeInstances: "Complete instances",
					blockedBy: "Blocked by",
					pomodoros: "Pomodoros",
					icsEventId: "ICS Event ID",
					icsEventTag: "ICS Event Tag",
					reminders: "Reminders",
				},
			},
			customUserFields: {
				header: "Custom User Fields",
				description:
					"Define custom frontmatter properties to appear as type-aware filter options across views. Each row: Display Name, Property Name, Type.",
				addNew: {
					name: "Add new user field",
					description: "Create a new custom field that will appear in filters and views",
					buttonText: "Add user field",
				},
				emptyState:
					"No custom user fields configured. Add a field to create custom properties for your tasks.",
				emptyStateButton: "Add User Field",
				fields: {
					displayName: "Display Name:",
					propertyKey: "Property Key:",
					type: "Type:",
					defaultValue: "Default Value:",
				},
				placeholders: {
					displayName: "Display Name",
					propertyKey: "property-name",
					defaultValue: "Default value",
					defaultValueList: "Default values (comma-separated)",
				},
				types: {
					text: "Text",
					number: "Number",
					boolean: "Boolean",
					date: "Date",
					list: "List",
				},
				defaultNames: {
					unnamedField: "Unnamed Field",
					noKey: "no-key",
				},
				deleteTooltip: "Delete field",
				autosuggestFilters: {
					header: "Autosuggestion filters (Advanced)",
					description:
						"Filter which files appear in autocomplete suggestions for this field",
				},
			},
		},
		appearance: {
			taskCards: {
				header: "Task Cards",
				description: "Configure how task cards are displayed across all views.",
				defaultVisibleProperties: {
					name: "Default visible properties",
					description: "Choose which properties appear on task cards by default.",
				},
				propertyGroups: {
					coreProperties: "CORE PROPERTIES",
					organization: "ORGANIZATION",
					customProperties: "CUSTOM PROPERTIES",
				},
				properties: {
					status: "Status Dot",
					priority: "Priority Dot",
					due: "Due Date",
					scheduled: "Scheduled Date",
					timeEstimate: "Time Estimate",
					totalTrackedTime: "Total Tracked Time",
					recurrence: "Recurrence",
					completedDate: "Completed Date",
					createdDate: "Created Date",
					modifiedDate: "Modified Date",
					projects: "Projects",
					contexts: "Contexts",
					tags: "Tags",
					blocked: "Blocked",
					blocking: "Blocking",
				},
			},
			taskFilenames: {
				header: "Task Filenames",
				description: "Configure how task files are named when created.",
				storeTitleInFilename: {
					name: "Store title in filename",
					description:
						"Use the task title as the filename. Filename will update when the task title is changed (Recommended).",
				},
				filenameFormat: {
					name: "Filename format",
					description: "How task filenames should be generated",
					options: {
						title: "Task title (Non-updating)",
						zettel: "Zettelkasten format (YYMMDD + base36 seconds since midnight)",
						timestamp: "Full timestamp (YYYY-MM-DD-HHMMSS)",
						custom: "Custom template",
					},
				},
				customTemplate: {
					name: "Custom filename template",
					description:
						"Template for custom filenames. Available variables: {title}, {titleLower}, {titleUpper}, {titleSnake}, {titleKebab}, {titleCamel}, {titlePascal}, {date}, {shortDate}, {time}, {time12}, {time24}, {timestamp}, {dateTime}, {year}, {month}, {monthName}, {monthNameShort}, {day}, {dayName}, {dayNameShort}, {hour}, {hour12}, {minute}, {second}, {milliseconds}, {ms}, {ampm}, {week}, {quarter}, {unix}, {unixMs}, {timezone}, {timezoneShort}, {utcOffset}, {utcOffsetShort}, {utcZ}, {zettel}, {nano}, {priority}, {priorityShort}, {status}, {statusShort}, {dueDate}, {scheduledDate}",
					placeholder: "{date}-{title}-{dueDate}",
					helpText:
						"Note: {dueDate} and {scheduledDate} are in YYYY-MM-DD format and will be empty if not set.",
				},
			},
			displayFormatting: {
				header: "Display Formatting",
				description:
					"Configure how dates, times, and other data are displayed across the plugin.",
				timeFormat: {
					name: "Time format",
					description: "Display time in 12-hour or 24-hour format throughout the plugin",
					options: {
						twelveHour: "12-hour (AM/PM)",
						twentyFourHour: "24-hour",
					},
				},
			},
			calendarView: {
				header: "Calendar View",
				description: "Customize the appearance and behavior of the calendar view.",
				defaultView: {
					name: "Default view",
					description: "The calendar view shown when opening the calendar tab",
					options: {
						monthGrid: "Month Grid",
						weekTimeline: "Week Timeline",
						dayTimeline: "Day Timeline",
						yearView: "Year View",
						customMultiDay: "Custom Multi-Day",
					},
				},
				customDayCount: {
					name: "Custom view day count",
					description: "Number of days to show in custom multi-day view",
					placeholder: "3",
				},
				firstDayOfWeek: {
					name: "First day of week",
					description: "Which day should be the first column in week views",
				},
				showWeekends: {
					name: "Show weekends",
					description: "Display weekends in calendar views",
				},
				showWeekNumbers: {
					name: "Show week numbers",
					description: "Display week numbers in calendar views",
				},
				showTodayHighlight: {
					name: "Show today highlight",
					description: "Highlight the current day in calendar views",
				},
				showCurrentTimeIndicator: {
					name: "Show current time indicator",
					description: "Display a line showing the current time in timeline views",
				},
				selectionMirror: {
					name: "Selection mirror",
					description: "Show a visual preview while dragging to select time ranges",
				},
				calendarLocale: {
					name: "Calendar locale",
					description:
						'Calendar locale for date formatting and calendar system (e.g., "en", "fa" for Farsi/Persian, "de" for German). Leave empty to auto-detect from browser.',
					placeholder: "Auto-detect",
					invalidLocale: "Invalid locale. Please enter a valid language tag (e.g., 'en', 'de', 'fr-FR').",
				},
			},
			defaultEventVisibility: {
				header: "Default Event Visibility",
				description:
					"Configure which event types are visible by default when opening the Calendar. Users can still toggle these on/off in the calendar view.",
				showScheduledTasks: {
					name: "Show scheduled tasks",
					description: "Display tasks with scheduled dates by default",
				},
				showDueDates: {
					name: "Show due dates",
					description: "Display task due dates by default",
				},
				showDueWhenScheduled: {
					name: "Show due dates when scheduled",
					description:
						"Display due dates even for tasks that already have scheduled dates",
				},
				showTimeEntries: {
					name: "Show time entries",
					description: "Display completed time tracking entries by default",
				},
				showRecurringTasks: {
					name: "Show recurring tasks",
					description: "Display recurring task instances by default",
				},
				showICSEvents: {
					name: "Show ICS events",
					description: "Display events from ICS subscriptions by default",
				},
			},
			timeSettings: {
				header: "Time Settings",
				description: "Configure time-related display settings for timeline views.",
				timeSlotDuration: {
					name: "Time slot duration",
					description: "Duration of each time slot in timeline views",
					options: {
						fifteenMinutes: "15 minutes",
						thirtyMinutes: "30 minutes",
						sixtyMinutes: "60 minutes",
					},
				},
				startTime: {
					name: "Start time",
					description: "Earliest time shown in timeline views (HH:MM format)",
					placeholder: "06:00",
				},
				endTime: {
					name: "End time",
					description: "Latest time shown in timeline views (HH:MM format)",
					placeholder: "22:00",
				},
				initialScrollTime: {
					name: "Initial scroll time",
					description: "Time to scroll to when opening timeline views (HH:MM format)",
					placeholder: "09:00",
				},
				eventMinHeight: {
					name: "Event minimum height",
					description: "Minimum height for events in timeline views (pixels)",
					placeholder: "15",
				},
			},
			uiElements: {
				header: "UI Elements",
				description: "Configure the display of various UI elements.",
				showTrackedTasksInStatusBar: {
					name: "Show tracked tasks in status bar",
					description: "Display currently tracked tasks in Obsidian's status bar",
				},
				showRelationshipsWidget: {
					name: "Show relationships widget",
					description: "Display a widget showing all relationships for the current note (subtasks, projects, dependencies)",
				},
				relationshipsPosition: {
					name: "Relationships position",
					description: "Where to position the relationships widget",
					options: {
						top: "Top of note",
						bottom: "Bottom of note",
					},
				},
				showTaskCardInNote: {
					name: "Show task card in note",
					description:
						"Display a task card widget at the top of task notes showing the task details and actions",
				},
				showExpandableSubtasks: {
					name: "Show expandable subtasks",
					description: "Allow expanding/collapsing subtask sections in task cards",
				},
				subtaskChevronPosition: {
					name: "Subtask chevron position",
					description: "Position of expand/collapse chevrons in task cards",
					options: {
						left: "Left side",
						right: "Right side",
					},
				},
				viewsButtonAlignment: {
					name: "Views button alignment",
					description: "Alignment of the views/filters button in the task interface",
					options: {
						left: "Left side",
						right: "Right side",
					},
				},
			},
			projectAutosuggest: {
				header: "Project Autosuggest",
				description: "Customize how project suggestions display during task creation.",
				requiredTags: {
					name: "Required tags",
					description:
						"Show only notes with any of these tags (comma-separated). Leave empty to show all notes.",
					placeholder: "project, active, important",
				},
				includeFolders: {
					name: "Include folders",
					description:
						"Show only notes in these folders (comma-separated paths). Leave empty to show all folders.",
					placeholder: "Projects/, Work/Active, Personal",
				},
				requiredPropertyKey: {
					name: "Required property key",
					description:
						"Show only notes where this frontmatter property matches the value below. Leave empty to ignore.",
					placeholder: "type",
				},
				requiredPropertyValue: {
					name: "Required property value",
					description:
						"Only notes where the property equals this value are suggested. Leave empty to require the property to exist.",
					placeholder: "project",
				},
				customizeDisplay: {
					name: "Customize suggestion display",
					description:
						"Show advanced options to configure how project suggestions appear and what information they display.",
				},
				enableFuzzyMatching: {
					name: "Enable fuzzy matching",
					description:
						"Allow typos and partial matches in project search. May be slower in large vaults.",
				},
				displayRowsHelp:
					"Configure up to 3 lines of information to show for each project suggestion.",
				displayRows: {
					row1: {
						name: "Row 1",
						description:
							"Format: {property|flags}. Properties: title, aliases, file.path, file.parent. Flags: n(Label) shows label, s makes searchable. Example: {title|n(Title)|s}",
						placeholder: "{title|n(Title)}",
					},
					row2: {
						name: "Row 2 (optional)",
						description:
							"Common patterns: {aliases|n(Aliases)}, {file.parent|n(Folder)}, literal:Custom Text",
						placeholder: "{aliases|n(Aliases)}",
					},
					row3: {
						name: "Row 3 (optional)",
						description:
							"Additional info like {file.path|n(Path)} or custom frontmatter fields",
						placeholder: "{file.path|n(Path)}",
					},
				},
				quickReference: {
					header: "Quick Reference",
					properties:
						"Available properties: title, aliases, file.path, file.parent, or any frontmatter field",
					labels: 'Add labels: {title|n(Title)} → "Title: My Project"',
					searchable: "Make searchable: {description|s} includes description in + search",
					staticText: "Static text: literal:My Custom Label",
					alwaysSearchable:
						"Filename, title, and aliases are always searchable by default.",
				},
			},
			dataStorage: {
				name: "Storage Location",
				description: "Where to store Pomodoro session history",
				pluginData: "Plugin data (recommended)",
				dailyNotes: "Daily Notes",
				notices: {
					locationChanged: "Pomodoro storage location changed to {location}",
				},
			},
			notifications: {
				description: "Configure task reminder notifications and alerts.",
			},
			performance: {
				description: "Configure plugin performance and behavioral options.",
			},
			timeTrackingSection: {
				description: "Configure automatic time tracking behaviors.",
			},
			recurringSection: {
				description: "Configure behavior for recurring task management.",
			},
		},
		integrations: {
			basesIntegration: {
				header: "Bases integration",
				description:
					"Configure integration with the Obsidian Bases plugin. This is an experimental feature, and currently relies on undocumented Obsidian APIs. Behaviour may change or break.",
				enable: {
					name: "Enable Bases integration",
					description:
						"Enable TaskNotes views to be used within Obsidian Bases plugin. Bases plugin must be enabled for this to work.",
				},
				viewCommands: {
					header: "Views & base files",
					description: "TaskNotes uses Obsidian Bases files (.base) to power its views. These files are generated automatically on startup if they don't exist, configured with your current settings (task identification, field mappings, statuses, etc.).",
					descriptionRegen: "Base files are not automatically updated when you change settings. To apply new settings, delete the existing .base files and restart Obsidian, or use \"Create files\" below, or edit them manually.",
					docsLink: "View documentation for available formulas and customization options",
					docsLinkUrl: "https://tasknotes.dev/views/default-base-templates",
					commands: {
						miniCalendar: "Open mini calendar view",
						kanban: "Open kanban view",
						tasks: "Open tasks view",
						advancedCalendar: "Open advanced calendar view",
						agenda: "Open agenda view",
						relationships: "Relationships widget",
					},
					fileLabel: "File: {path}",
					resetButton: "Reset",
					resetTooltip: "Reset to default path",
				},
				autoCreateDefaultFiles: {
					name: "Auto-create default files",
					description: "Automatically create missing default Base view files on startup. Disable to prevent deleted sample files from being recreated.",
				},
				createDefaultFiles: {
					name: "Create default files",
					description: "Create the default .base files in TaskNotes/Views/ directory. Existing files will not be overwritten.",
					buttonText: "Create files",
				},
				exportV3Views: {
					name: "Export V3 saved views to Bases",
					description: "Convert all your saved views from TaskNotes v3 into a single .base file with multiple views. This helps migrate your v3 filter configurations to the new Bases system.",
					buttonText: "Export V3 views",
					noViews: "No saved views to export",
					fileExists: "File already exists",
					confirmOverwrite: 'A file named "{fileName}" already exists. Overwrite it?',
					success: "Exported {count} saved views to {filePath}",
					error: "Failed to export views: {message}",
				},
				notices: {
					enabled:
						"Bases integration enabled. Please restart Obsidian to complete the setup.",
					disabled:
						"Bases integration disabled. Please restart Obsidian to complete the removal.",
				},
			},
			calendarSubscriptions: {
				header: "Calendar subscriptions",
				description:
					"Subscribe to external calendars via ICS/iCal URLs to view events alongside your tasks.",
				defaultNoteTemplate: {
					name: "Default note template",
					description: "Path to template file for notes created from ICS events",
					placeholder: "Templates/Event Template.md",
				},
				defaultNoteFolder: {
					name: "Default note folder",
					description: "Folder for notes created from ICS events",
					placeholder: "Calendar/Events",
				},
				filenameFormat: {
					name: "ICS note filename format",
					description: "How filenames are generated for notes created from ICS events",
					options: {
						title: "Event title",
						zettel: "Zettelkasten format",
						timestamp: "Timestamp",
						custom: "Custom template",
					},
				},
				customTemplate: {
					name: "Custom ICS filename template",
					description: "Template for custom ICS event filenames",
					placeholder: "{date}-{title}",
				},
				useICSEndAsDue: {
					name: "Use ICS event end time as task due date",
					description: "When enabled, tasks created from calendar events will have their due date set to the event's end time. For all-day events, the due date will be set to the event date. For timed events, the due date will include the end time.",
				},
			},
			subscriptionsList: {
				header: "Calendar subscriptions list",
				addSubscription: {
					name: "Add Calendar Subscription",
					description: "Add a new calendar subscription from ICS/iCal URL or local file",
					buttonText: "Add Subscription",
				},
				refreshAll: {
					name: "Refresh all subscriptions",
					description: "Manually refresh all enabled calendar subscriptions",
					buttonText: "Refresh All",
				},
				newCalendarName: "New Calendar",
				emptyState:
					"No calendar subscriptions configured. Add a subscription to sync external calendars.",
				notices: {
					addSuccess: "New calendar subscription added - please configure the details",
					addFailure: "Failed to add subscription",
					serviceUnavailable: "ICS subscription service not available",
					refreshSuccess: "All calendar subscriptions refreshed successfully",
					refreshFailure: "Failed to refresh some calendar subscriptions",
					updateFailure: "Failed to update subscription",
					deleteSuccess: 'Deleted subscription "{name}"',
					deleteFailure: "Failed to delete subscription",
					enableFirst: "Enable the subscription first",
					refreshSubscriptionSuccess: 'Refreshed "{name}"',
					refreshSubscriptionFailure: "Failed to refresh subscription",
				},
				labels: {
					enabled: "Enabled:",
					name: "Name:",
					type: "Type:",
					url: "URL:",
					filePath: "File Path:",
					color: "Color:",
					refreshMinutes: "Refresh (min):",
				},
				typeOptions: {
					remote: "Remote URL",
					local: "Local File",
				},
				placeholders: {
					calendarName: "Calendar name",
					url: "ICS/iCal URL",
					filePath: "Local file path (e.g., Calendar.ics)",
					localFile: "Calendar.ics",
				},
				statusLabels: {
					enabled: "Enabled",
					disabled: "Disabled",
					remote: "Remote",
					localFile: "Local File",
					remoteCalendar: "Remote Calendar",
					localFileCalendar: "Local File",
					synced: "Synced {timeAgo}",
					error: "Error",
				},
				actions: {
					refreshNow: "Refresh Now",
					deleteSubscription: "Delete subscription",
				},
				refreshNow: "Refresh Now",
				confirmDelete: {
					title: "Delete Subscription",
					message:
						'Are you sure you want to delete the subscription "{name}"? This action cannot be undone.',
					confirmText: "Delete",
				},
			},
			autoExport: {
				header: "Automatic ICS export",
				description: "Automatically export all your tasks to an ICS file.",
				enable: {
					name: "Enable automatic export",
					description: "Automatically keep an ICS file updated with all your tasks",
				},
				filePath: {
					name: "Export file path",
					description: "Path where the ICS file will be saved (relative to vault root)",
					placeholder: "tasknotes-calendar.ics",
				},
				interval: {
					name: "Update interval (between 5 and 1440 minutes)",
					description: "How often to update the export file",
					placeholder: "60",
				},
				useDuration: {
					name: "Use task duration for event length",
					description:
						"When enabled, uses the task's time estimate (duration) instead of due date for the calendar event end time. This is useful for GTD workflows where scheduled + duration represents work planning, while due date represents deadlines.",
				},
				exportNow: {
					name: "Export now",
					description: "Manually trigger an immediate export",
					buttonText: "Export Now",
				},
				status: {
					title: "Export Status:",
					lastExport: "Last export: {time}",
					nextExport: "Next export: {time}",
					noExports: "No exports yet",
					notScheduled: "Not scheduled",
					notInitialized: "Auto export service not initialized - please restart Obsidian",
					serviceNotInitialized: "Service not initialized - please restart Obsidian",
				},
				notices: {
					reloadRequired:
						"Please reload Obsidian for the automatic export changes to take effect.",
					exportSuccess: "Tasks exported successfully",
					exportFailure: "Export failed - check console for details",
					serviceUnavailable: "Auto export service not available",
				},
			},
			googleCalendarExport: {
				header: "Export Tasks to Google Calendar",
				description:
					"Automatically sync your tasks to Google Calendar as events. Requires Google Calendar to be connected above.",
				enable: {
					name: "Enable Task Export",
					description:
						"When enabled, tasks with dates will be automatically synced to Google Calendar as events.",
				},
				targetCalendar: {
					name: "Target Calendar",
					description: "Select which calendar to create task events in.",
					placeholder: "Select a calendar...",
					connectFirst: "Connect Google Calendar first",
					primarySuffix: " (Primary)",
				},
				syncTrigger: {
					name: "Sync Trigger",
					description: "Which task date should trigger calendar event creation.",
					options: {
						scheduled: "Scheduled Date",
						due: "Due Date",
						both: "Both (prefer scheduled)",
					},
				},
				allDayEvents: {
					name: "Create as All-Day Events",
					description:
						"When enabled, tasks are created as all-day events. When disabled, uses time estimate for duration.",
				},
				defaultDuration: {
					name: "Default Event Duration",
					description:
						"Duration in minutes for timed events (used when task has no time estimate).",
				},
				eventTitleTemplate: {
					name: "Event Title Template",
					description:
						"Template for event titles. Available variables: {{title}}, {{status}}, {{priority}}",
					placeholder: "{{title}}",
				},
				includeDescription: {
					name: "Include Task Details in Description",
					description:
						"Add task metadata (priority, status, tags, etc.) to the event description.",
				},
				includeObsidianLink: {
					name: "Include Obsidian Link",
					description:
						"Add a link back to the task in Obsidian in the event description.",
				},
				defaultReminder: {
					name: "Default Reminder",
					description:
						"Add a popup reminder to Google Calendar events. Set minutes before event (0 = no reminder). Common values: 15, 30, 60, 1440 (1 day).",
				},
				automaticSyncBehavior: {
					header: "Automatic Sync Behavior",
				},
				syncOnCreate: {
					name: "Sync on Task Create",
					description:
						"Automatically create calendar event when a new task is created.",
				},
				syncOnUpdate: {
					name: "Sync on Task Update",
					description:
						"Automatically update calendar event when a task is modified.",
				},
				syncOnComplete: {
					name: "Sync on Task Complete",
					description:
						"Update calendar event when a task is completed (adds checkmark to title).",
				},
				syncOnDelete: {
					name: "Delete Event on Task Delete",
					description:
						"Remove calendar event when the corresponding task is deleted.",
				},
				manualSyncActions: {
					header: "Manual Sync Actions",
				},
				syncAllTasks: {
					name: "Sync All Tasks",
					description:
						"Sync all existing tasks to Google Calendar. This will create events for tasks that haven't been synced yet.",
					buttonText: "Sync All",
				},
				unlinkAllTasks: {
					name: "Unlink All Tasks",
					description:
						"Remove all task-event links without deleting calendar events.",
					buttonText: "Unlink All",
					confirmTitle: "Unlink All Tasks",
					confirmMessage:
						"This will remove all links between tasks and calendar events. The calendar events will remain but will no longer be updated when tasks change. Are you sure?",
					confirmButtonText: "Unlink All",
				},
				notices: {
					notEnabled:
						"Google Calendar export is not enabled. Configure it in Settings > Integrations.",
					notEnabledOrConfigured:
						"Google Calendar export is not enabled or configured",
					serviceNotAvailable: "Task calendar sync service not available",
					syncResults: "Synced: {synced}, Failed: {failed}, Skipped: {skipped}",
					taskSynced: "Task synced to Google Calendar",
					noActiveFile: "No file is currently active",
					notATask: "Current file is not a task",
					noDateToSync: "Task has no scheduled or due date to sync",
					syncFailed: "Failed to sync task to Google Calendar: {message}",
					syncingTasks: "Syncing {total} tasks to Google Calendar...",
					syncComplete:
						"Sync complete: {synced} synced, {failed} failed, {skipped} skipped",
					eventsDeletedAndUnlinked: "All events deleted and unlinked",
					tasksUnlinked: "All task links removed",
				},
				eventDescription: {
					untitledTask: "Untitled Task",
					priority: "Priority: {value}",
					status: "Status: {value}",
					due: "Due: {value}",
					scheduled: "Scheduled: {value}",
					timeEstimate: "Time Estimate: {value}",
					tags: "Tags: {value}",
					contexts: "Contexts: {value}",
					projects: "Projects: {value}",
					openInObsidian: "Open in Obsidian",
				},
			},
			httpApi: {
				header: "HTTP API",
				description: "Enable HTTP API for external integrations and automations.",
				enable: {
					name: "Enable HTTP API",
					description: "Start local HTTP server for API access",
				},
				port: {
					name: "API port",
					description: "Port number for the HTTP API server",
					placeholder: "3000",
				},
				authToken: {
					name: "API authentication token",
					description: "Token required for API authentication (leave empty for no auth)",
					placeholder: "your-secret-token",
				},
				endpoints: {
					header: "Available API Endpoints",
					expandIcon: "▶",
					collapseIcon: "▼",
				},
			},
			webhooks: {
				header: "Webhooks",
				description: {
					overview:
						"Webhooks send real-time notifications to external services when TaskNotes events occur.",
					usage: "Configure webhooks to integrate with automation tools, sync services, or custom applications.",
				},
				addWebhook: {
					name: "Add Webhook",
					description: "Register a new webhook endpoint",
					buttonText: "Add Webhook",
				},
				emptyState: {
					message:
						"No webhooks configured. Add a webhook to receive real-time notifications.",
					buttonText: "Add Webhook",
				},
				labels: {
					active: "Active:",
					url: "URL:",
					events: "Events:",
					transform: "Transform:",
				},
				placeholders: {
					url: "Webhook URL",
					noEventsSelected: "No events selected",
					rawPayload: "Raw payload (no transform)",
				},
				statusLabels: {
					active: "Active",
					inactive: "Inactive",
					created: "Created {timeAgo}",
				},
				actions: {
					editEvents: "Edit Events",
					delete: "Delete",
				},
				editEvents: "Edit Events",
				notices: {
					urlUpdated: "Webhook URL updated",
					enabled: "Webhook enabled",
					disabled: "Webhook disabled",
					created: "Webhook created successfully",
					deleted: "Webhook deleted",
					updated: "Webhook updated",
				},
				confirmDelete: {
					title: "Delete Webhook",
					message:
						"Are you sure you want to delete this webhook?\n\nURL: {url}\n\nThis action cannot be undone.",
					confirmText: "Delete",
				},
				cardHeader: "Webhook",
				cardFields: {
					active: "Active:",
					url: "URL:",
					events: "Events:",
					transform: "Transform:",
				},
				eventsDisplay: {
					noEvents: "No events selected",
				},
				transformDisplay: {
					noTransform: "Raw payload (no transform)",
				},
				secretModal: {
					title: "Webhook Secret Generated",
					description:
						"Your webhook secret has been generated. Save this secret as you won't be able to view it again:",
					usage: "Use this secret to verify webhook payloads in your receiving application.",
					gotIt: "Got it",
				},
				editModal: {
					title: "Edit Webhook",
					eventsHeader: "Events to subscribe to",
				},
				events: {
					taskCreated: {
						label: "Task Created",
						description: "When new tasks are created",
					},
					taskUpdated: {
						label: "Task Updated",
						description: "When tasks are modified",
					},
					taskCompleted: {
						label: "Task Completed",
						description: "When tasks are marked complete",
					},
					taskDeleted: {
						label: "Task Deleted",
						description: "When tasks are deleted",
					},
					taskArchived: {
						label: "Task Archived",
						description: "When tasks are archived",
					},
					taskUnarchived: {
						label: "Task Unarchived",
						description: "When tasks are unarchived",
					},
					timeStarted: {
						label: "Time Started",
						description: "When time tracking starts",
					},
					timeStopped: {
						label: "Time Stopped",
						description: "When time tracking stops",
					},
					pomodoroStarted: {
						label: "Pomodoro Started",
						description: "When pomodoro sessions begin",
					},
					pomodoroCompleted: {
						label: "Pomodoro Completed",
						description: "When pomodoro sessions finish",
					},
					pomodoroInterrupted: {
						label: "Pomodoro Interrupted",
						description: "When pomodoro sessions are stopped",
					},
					recurringCompleted: {
						label: "Recurring Instance Completed",
						description: "When recurring task instances complete",
					},
					reminderTriggered: {
						label: "Reminder Triggered",
						description: "When task reminders activate",
					},
				},
				modals: {
					secretGenerated: {
						title: "Webhook Secret Generated",
						description:
							"Your webhook secret has been generated. Save this secret as you won't be able to view it again:",
						usage: "Use this secret to verify webhook payloads in your receiving application.",
						buttonText: "Got it",
					},
					edit: {
						title: "Edit Webhook",
						eventsSection: "Events to subscribe to",
						transformSection: "Transform Configuration (Optional)",
						headersSection: "Headers Configuration",
						transformFile: {
							name: "Transform File",
							description:
								"Path to a .js or .json file in your vault that transforms webhook payloads",
							placeholder: "discord-transform.js",
						},
						customHeaders: {
							name: "Include custom headers",
							description:
								"Include TaskNotes headers (event type, signature, delivery ID). Turn off for Discord, Slack, and other services with strict CORS policies.",
						},
						buttons: {
							cancel: "Cancel",
							save: "Save Changes",
						},
						notices: {
							selectAtLeastOneEvent: "Please select at least one event",
						},
					},
					add: {
						title: "Add Webhook",
						eventsSection: "Events to subscribe to",
						transformSection: "Transform Configuration (Optional)",
						headersSection: "Headers Configuration",
						url: {
							name: "Webhook URL",
							description: "The endpoint where webhook payloads will be sent",
							placeholder: "https://your-service.com/webhook",
						},
						transformFile: {
							name: "Transform File",
							description:
								"Path to a .js or .json file in your vault that transforms webhook payloads",
							placeholder: "discord-transform.js",
						},
						customHeaders: {
							name: "Include custom headers",
							description:
								"Include TaskNotes headers (event type, signature, delivery ID). Turn off for Discord, Slack, and other services with strict CORS policies.",
						},
						transformHelp: {
							title: "Transform files allow you to customize webhook payloads:",
							jsFiles: ".js files:",
							jsDescription: " Custom JavaScript transforms",
							jsonFiles: ".json files:",
							jsonDescription: " Templates with ",
							jsonVariable: "${data.task.title}",
							leaveEmpty: "Leave empty:",
							leaveEmptyDescription: " Send raw data",
							example: "Example:",
							exampleFile: "discord-transform.js",
						},
						buttons: {
							cancel: "Cancel",
							add: "Add Webhook",
						},
						notices: {
							urlRequired: "Webhook URL is required",
							selectAtLeastOneEvent: "Please select at least one event",
						},
					},
				},
			},
			otherIntegrations: {
				header: "Other plugin integrations",
				description: "Configure integrations with other Obsidian plugins.",
			},
			mdbaseSpec: {
				header: "mdbase type definitions",
				learnMore: "Learn more about mdbase-spec",
				enable: {
					name: "Generate mdbase type definitions",
					description: "Generate and maintain mdbase type files (mdbase.yaml and _types/task.md) at the vault root as your settings change.",
				},
			},
			timeFormats: {
				justNow: "Just now",
				minutesAgo: "{minutes} minute{plural} ago",
				hoursAgo: "{hours} hour{plural} ago",
				daysAgo: "{days} day{plural} ago",
			},
		},
	},
	notices: {
		languageChanged: "Language changed to {language}.",
		exportTasksFailed: "Failed to export tasks as ICS file",
		// ICS Event Info Modal notices
		icsNoteCreatedSuccess: "Note created successfully",
		icsCreationModalOpenFailed: "Failed to open creation modal",
		icsNoteLinkSuccess: 'Linked note "{fileName}" to ICS event',
		icsTaskCreatedSuccess: 'Task created: {title}',
		icsRelatedItemsRefreshed: "Related notes refreshed",
		icsFileNotFound: "File not found or invalid",
		icsFileOpenFailed: "Failed to open file",
		// Timeblock Info Modal notices
		timeblockAttachmentExists: '"{fileName}" is already attached',
		timeblockAttachmentAdded: 'Added "{fileName}" as attachment',
		timeblockAttachmentRemoved: 'Removed "{fileName}" from attachments',
		timeblockFileTypeNotSupported: 'Cannot open "{fileName}" - file type not supported',
		timeblockTitleRequired: "Please enter a title for the timeblock",
		timeblockUpdatedSuccess: 'Timeblock "{title}" updated successfully',
		timeblockUpdateFailed: "Failed to update timeblock. Check console for details.",
		timeblockDeletedSuccess: 'Timeblock "{title}" deleted successfully',
		timeblockDeleteFailed: "Failed to delete timeblock. Check console for details.",
		// Timeblock Creation Modal notices
		timeblockRequiredFieldsMissing: "Please fill in all required fields",
		// Agenda View notices
		agendaLoadingFailed: "Error loading agenda. Please try refreshing.",
		// Stats View notices
		statsLoadingFailed: "Error loading project details.",
	},
	commands: {
		openCalendarView: "Open mini calendar view",
		openAdvancedCalendarView: "Open calendar view",
		openTasksView: "Open tasks view",
		openNotesView: "Open notes view",
		openAgendaView: "Open agenda view",
		openPomodoroView: "Open pomodoro timer",
		openKanbanView: "Open kanban board",
		openPomodoroStats: "Open pomodoro statistics",
		openStatisticsView: "Open task & project statistics",
		createNewTask: "Create new task",
		convertCurrentNoteToTask: {
			name: "Convert current note to task",
			noActiveFile: "No active file to convert",
			alreadyTask: "This note is already a task",
			success: "Converted '{title}' to a task",
		},
		convertToTaskNote: "Convert checkbox task to TaskNote",
		convertAllTasksInNote: "Convert all tasks in note",
		insertTaskNoteLink: "Insert tasknote link",
		createInlineTask: "Create new inline task",
		quickActionsCurrentTask: "Quick actions for current task",
		goToTodayNote: "Go to today's note",
		startPomodoro: "Start pomodoro timer",
		stopPomodoro: "Stop pomodoro timer",
		pauseResumePomodoro: "Pause/resume pomodoro timer",
		refreshCache: "Refresh cache",
		exportAllTasksIcs: "Export all tasks as ICS file",
		syncAllTasksGoogleCalendar: "Sync all tasks to Google Calendar",
		syncCurrentTaskGoogleCalendar: "Sync current task to Google Calendar",
		viewReleaseNotes: "View release notes",
		startTimeTrackingWithSelector: "Start time tracking (select task)",
		editTimeEntries: "Edit time entries (select task)",
		createOrOpenTask: "Create or open task",
	},
	modals: {
		deviceCode: {
			title: "Google Calendar Authorization",
			instructions: {
				intro: "To connect your Google Calendar, please follow these steps:",
			},
			steps: {
				open: "Open",
				inBrowser: "in your browser",
				enterCode: "Enter this code when prompted:",
				signIn: "Sign in with your Google account and grant access",
				returnToObsidian: "Return to Obsidian (this window will close automatically)",
			},
			codeLabel: "Your Code:",
			copyCodeAriaLabel: "Copy code",
			waitingForAuthorization: "Waiting for authorization...",
			openBrowserButton: "Open Browser",
			cancelButton: "Cancel",
			expiresMinutesSeconds: "Code expires in {minutes}m {seconds}s",
			expiresSeconds: "Code expires in {seconds}s",
		},
		icsEventInfo: {
			calendarEventHeading: "Calendar Event",
			titleLabel: "Title",
			calendarLabel: "Calendar",
			dateTimeLabel: "Date & Time",
			locationLabel: "Location",
			descriptionLabel: "Description",
			urlLabel: "URL",
			relatedNotesHeading: "Related Notes & Tasks",
			noRelatedItems: "No related notes or tasks found for this event.",
			typeTask: "Task",
			typeNote: "Note",
			actionsHeading: "Actions",
			createFromEventLabel: "Create from Event",
			createFromEventDesc: "Create a new note or task from this calendar event",
			linkExistingLabel: "Link Existing",
			linkExistingDesc: "Link an existing note to this calendar event",
		},
		timeblockInfo: {
			editHeading: "Edit Timeblock",
			dateTimeLabel: "Date & Time: ",
			titleLabel: "Title",
			titleDesc: "Title for your timeblock",
			titlePlaceholder: "e.g., Deep work session",
			descriptionLabel: "Description",
			descriptionDesc: "Optional description for the timeblock",
			descriptionPlaceholder: "Focus on new features, no interruptions",
			colorLabel: "Color",
			colorDesc: "Optional color for the timeblock",
			colorPlaceholder: "#3b82f6",
			attachmentsLabel: "Attachments",
			attachmentsDesc: "Files or notes linked to this timeblock",
			addAttachmentButton: "Add Attachment",
			addAttachmentTooltip: "Select a file or note using fuzzy search",
			deleteButton: "Delete Timeblock",
			saveButton: "Save Changes",
			deleteConfirmationTitle: "Delete Timeblock",
		},
		timeblockCreation: {
			heading: "Create timeblock",
			dateLabel: "Date: ",
			titleLabel: "Title",
			titleDesc: "Title for your timeblock",
			titlePlaceholder: "e.g., Deep work session",
			startTimeLabel: "Start time",
			startTimeDesc: "When the timeblock starts",
			startTimePlaceholder: "09:00",
			endTimeLabel: "End time",
			endTimeDesc: "When the timeblock ends",
			endTimePlaceholder: "11:00",
			descriptionLabel: "Description",
			descriptionDesc: "Optional description for the timeblock",
			descriptionPlaceholder: "Focus on new features, no interruptions",
			colorLabel: "Color",
			colorDesc: "Optional color for the timeblock",
			colorPlaceholder: "#3b82f6",
			attachmentsLabel: "Attachments",
			attachmentsDesc: "Files or notes to link to this timeblock",
			addAttachmentButton: "Add Attachment",
			addAttachmentTooltip: "Select a file or note using fuzzy search",
			createButton: "Create timeblock",
		},
		icsNoteCreation: {
			heading: "Create from ICS Event",
			titleLabel: "Title",
			titleDesc: "Title for the new content",
			folderLabel: "Folder",
			folderDesc: "Destination folder (leave empty for vault root)",
			folderPlaceholder: "folder/subfolder",
			createButton: "Create",
			startLabel: "Start: ",
			endLabel: "End: ",
			locationLabel: "Location: ",
			calendarLabel: "Calendar: ",
			useTemplateLabel: "Use Template",
			useTemplateDesc: "Apply a template when creating the content",
			templatePathLabel: "Template Path",
			templatePathDesc: "Path to the template file",
			templatePathPlaceholder: "templates/ics-note-template.md",
		},
		unscheduledTasksSelector: {
			title: "Unscheduled Tasks",
			placeholder: "Type to search for unscheduled tasks...",
			instructions: {
				navigate: "to navigate",
				schedule: "to schedule",
				dismiss: "to dismiss",
			},
		},
		migration: {
			title: "Migrate to New Recurrence System",
			description: "TaskNotes now uses industry-standard RRULE patterns for recurrence, which enables more complex schedules and better compatibility with other apps.",
			tasksFound: "{count} task(s) with old recurrence patterns detected",
			noMigrationNeeded: "No tasks require migration",
			warnings: {
				title: "Before you proceed:",
				backup: "Back up your vault before migrating",
				conversion: "Old recurrence patterns will be converted to new format",
				normalUsage: "You can continue using TaskNotes normally during migration",
				permanent: "This change is permanent and cannot be automatically undone",
			},
			benefits: {
				title: "Benefits of the new system:",
				powerfulPatterns: "Complex recurrence patterns (e.g., 'every 2nd Tuesday')",
				performance: "Better performance with recurring tasks",
				compatibility: "Standard recurrence format compatible with other apps",
				nlp: "Enhanced natural language processing support",
			},
			progress: {
				title: "Migration Progress",
				preparing: "Preparing migration...",
				completed: "Migration completed successfully",
				failed: "Migration failed",
			},
			buttons: {
				migrate: "Start Migration",
				completed: "Close",
			},
			errors: {
				title: "Errors during migration:",
			},
			notices: {
				completedWithErrors: "Migration completed with some errors. Check the error list above.",
				success: "All tasks migrated successfully!",
				failed: "Migration failed. Please check the console for details.",
			},
			prompt: {
				message: "TaskNotes detected tasks using the old recurrence format. Would you like to migrate them to the new system now?",
				migrateNow: "Migrate Now",
				remindLater: "Remind Me Later",
			},
		},
		task: {
				titlePlaceholder: "What needs to be done?",
				titleLabel: "Title",
			titleDetailedPlaceholder: "Task title...",
			detailsLabel: "Details",
			detailsPlaceholder: "Add more details...",
			projectsLabel: "Projects",
			projectsAdd: "Add Project",
			projectsTooltip: "Select a project note using fuzzy search",
			projectsRemoveTooltip: "Remove project",
			contextsLabel: "Contexts",
			contextsPlaceholder: "context1, context2",
			tagsLabel: "Tags",
			tagsPlaceholder: "tag1, tag2",
			timeEstimateLabel: "Time estimate (minutes)",
			timeEstimatePlaceholder: "30",
			unsavedChanges: {
				title: "Unsaved Changes",
				message: "You have unsaved changes. Do you want to save them?",
				save: "Save Changes",
				discard: "Discard Changes",
				cancel: "Keep Editing",
			},
			dependencies: {
				blockedBy: "Blocked by",
				blocking: "Blocking",
				placeholder: "[[Task Note]]",
				addTaskButton: "Add task",
				selectTaskTooltip: "Select a task note using fuzzy search",
				removeTaskTooltip: "Remove task",
			},
			organization: {
				projects: "Projects",
				subtasks: "Subtasks",
				addToProject: "Add to project",
				addToProjectButton: "Add to project",
				addSubtasks: "Add subtasks",
				addSubtasksButton: "Add subtask",
				addSubtasksTooltip: "Select tasks to make them subtasks of this task",
				removeSubtaskTooltip: "Remove subtask",
				notices: {
					noEligibleSubtasks: "No eligible tasks available to assign as subtasks",
					subtaskSelectFailed: "Failed to open subtask selector",
				},
			},
			customFieldsLabel: "Custom Fields",
			actions: {
				due: "Set due date",
				scheduled: "Set scheduled date",
				status: "Set status",
				priority: "Set priority",
				recurrence: "Set recurrence",
				reminders: "Set reminders",
			},
			buttons: {
				openNote: "Open note",
				save: "Save",
			},
			tooltips: {
				dueValue: "Due: {value}",
				scheduledValue: "Scheduled: {value}",
				statusValue: "Status: {value}",
				priorityValue: "Priority: {value}",
				recurrenceValue: "Recurrence: {value}",
				remindersSingle: "1 reminder set",
				remindersPlural: "{count} reminders set",
			},
			dateMenu: {
				dueTitle: "Set Due Date",
				scheduledTitle: "Set Scheduled Date",
			},
			userFields: {
				textPlaceholder: "Enter {field}...",
				numberPlaceholder: "0",
				datePlaceholder: "YYYY-MM-DD",
				listPlaceholder: "item1, item2, item3",
				pickDate: "Pick {field} date",
			},
			recurrence: {
				daily: "Daily",
				weekly: "Weekly",
				everyTwoWeeks: "Every 2 weeks",
				weekdays: "Weekdays",
				weeklyOn: "Weekly on {days}",
				monthly: "Monthly",
				everyThreeMonths: "Every 3 months",
				monthlyOnOrdinal: "Monthly on the {ordinal}",
				monthlyByWeekday: "Monthly (by weekday)",
				yearly: "Yearly",
				yearlyOn: "Yearly on {month} {day}",
				custom: "Custom",
				countSuffix: "{count} times",
				untilSuffix: "until {date}",
				ordinal: "{number}{suffix}",
			},
		},
		taskSelector: {
			title: "Select task",
			placeholder: "Type to search for tasks...",
			instructions: {
				navigate: "to navigate",
				select: "to select",
				dismiss: "to cancel",
			},
			notices: {
				noteNotFound: 'Could not find note "{name}"',
			},
			dueDate: {
				overdue: "Due: {date} (overdue)",
				today: "Due: Today",
			},
		},
		taskSelectorWithCreate: {
			title: "Create or open task",
			placeholder: "Search tasks or type to create new...",
			instructions: {
				create: "to create new task",
			},
			footer: {
				createLabel: " to create: ",
			},
			notices: {
				emptyQuery: "Please enter a task description",
				invalidTitle: "Could not parse a valid task title",
			},
		},
		taskCreation: {
			title: "Create task",
			actions: {
				fillFromNaturalLanguage: "Fill form from natural language",
				hideDetailedOptions: "Hide detailed options",
				showDetailedOptions: "Show detailed options",
			},
			nlPlaceholder: "Buy groceries tomorrow at 3pm @home #errands",
			notices: {
				titleRequired: "Please enter a task title",
				success: 'Task "{title}" created successfully',
				successShortened:
					'Task "{title}" created successfully (filename shortened due to length)',
				failure: "Failed to create task: {message}",
				blockingUnresolved: "Could not resolve: {entries}",
			},
		},
		taskEdit: {
			title: "Edit task",
			sections: {
				completions: "Completions",
				taskInfo: "Task Information",
			},
			metadata: {
				totalTrackedTime: "Total tracked time:",
				created: "Created:",
				modified: "Modified:",
				file: "File:",
			},
			buttons: {
				archive: "Archive",
				unarchive: "Unarchive",
			},
			notices: {
				titleRequired: "Please enter a task title",
				noChanges: "No changes to save",
				updateSuccess: 'Task "{title}" updated successfully',
				updateFailure: "Failed to update task: {message}",
				dependenciesUpdateSuccess: "Dependencies updated",
				blockingUnresolved: "Could not resolve: {entries}",
				fileMissing: "Could not find task file: {path}",
				openNoteFailure: "Failed to open task note",
				archiveSuccess: "Task {action} successfully",
				archiveFailure: "Failed to archive task",
			},
			archiveAction: {
				archived: "archived",
				unarchived: "unarchived",
			},
		},
		storageLocation: {
			title: {
				migrate: "Migrate pomodoro data?",
				switch: "Switch to daily notes storage?",
			},
			message: {
				migrate:
					"This will migrate your existing pomodoro session data to daily notes frontmatter. The data will be grouped by date and stored in each daily note.",
				switch: "Pomodoro session data will be stored in daily notes frontmatter instead of the plugin data file.",
			},
			whatThisMeans: "What this means:",
			bullets: {
				dailyNotesRequired: "Daily Notes core plugin must remain enabled",
				storedInNotes: "Data will be stored in your daily notes frontmatter",
				migrateData: "Existing plugin data will be migrated and then cleared",
				futureSessions: "Future sessions will be saved to daily notes",
				dataLongevity: "This provides better data longevity with your notes",
			},
			finalNote: {
				migrate:
					"⚠️ Make sure you have backups if needed. This change cannot be automatically undone.",
				switch: "You can switch back to plugin storage at any time in the future.",
			},
			buttons: {
				migrate: "Migrate data",
				switch: "Switch storage",
			},
		},
		dueDate: {
			title: "Set Due Date",
			taskLabel: "Task: {title}",
			sections: {
				dateTime: "Due Date & Time",
				quickOptions: "Quick Options",
			},
			descriptions: {
				dateTime: "Set when this task should be completed",
			},
			inputs: {
				date: {
					ariaLabel: "Due date for task",
					placeholder: "YYYY-MM-DD",
				},
				time: {
					ariaLabel: "Due time for task (optional)",
					placeholder: "HH:MM",
				},
			},
			quickOptions: {
				today: "Today",
				todayAriaLabel: "Set due date to today",
				tomorrow: "Tomorrow",
				tomorrowAriaLabel: "Set due date to tomorrow",
				nextWeek: "Next week",
				nextWeekAriaLabel: "Set due date to next week",
				now: "Now",
				nowAriaLabel: "Set due date and time to now",
				clear: "Clear",
				clearAriaLabel: "Clear due date",
			},
			errors: {
				invalidDateTime: "Please enter a valid date and time format",
				updateFailed: "Failed to update due date. Please try again.",
			},
		},
		scheduledDate: {
			title: "Set Scheduled Date",
			taskLabel: "Task: {title}",
			sections: {
				dateTime: "Scheduled Date & Time",
				quickOptions: "Quick Options",
			},
			descriptions: {
				dateTime: "Set when you plan to work on this task",
			},
			inputs: {
				date: {
					ariaLabel: "Scheduled date for task",
					placeholder: "YYYY-MM-DD",
				},
				time: {
					ariaLabel: "Scheduled time for task (optional)",
					placeholder: "HH:MM",
				},
			},
			quickOptions: {
				today: "Today",
				todayAriaLabel: "Set scheduled date to today",
				tomorrow: "Tomorrow",
				tomorrowAriaLabel: "Set scheduled date to tomorrow",
				nextWeek: "Next week",
				nextWeekAriaLabel: "Set scheduled date to next week",
				now: "Now",
				nowAriaLabel: "Set scheduled date and time to now",
				clear: "Clear",
				clearAriaLabel: "Clear scheduled date",
			},
			errors: {
				invalidDateTime: "Please enter a valid date and time format",
				updateFailed: "Failed to update scheduled date. Please try again.",
			},
		},
		timeEntryEditor: {
			title: "Time Entries - {taskTitle}",
			addEntry: "Add time entry",
			noEntries: "No time entries yet",
			deleteEntry: "Delete entry",
			startTime: "Start time",
			endTime: "End time (leave empty if still running)",
			duration: "Duration (minutes)",
			durationDesc: "Override calculated duration",
			durationPlaceholder: "Enter duration in minutes",
			description: "Description",
			descriptionPlaceholder: "What did you work on?",
			calculatedDuration: "Calculated: {minutes} minutes",
			totalTime: "{hours}h {minutes}m total",
			totalMinutes: "{minutes}m total",
			saved: "Time entries saved",
			saveFailed: "Failed to save time entries",
			openFailed: "Failed to open time entry editor",
			noTasksWithEntries: "No tasks have time entries to edit",
			validation: {
				missingStartTime: "Start time is required",
				endBeforeStart: "End time must be after start time",
			},
		},
		timeTracking: {
			noTasksAvailable: "No tasks available to track time for",
			started: "Started tracking time for: {taskTitle}",
			startFailed: "Failed to start time tracking",
		},
		timeEntry: {
			mustHaveSpecificTime: "Time entries must have specific times. Please select a time range in week or day view.",
			noTasksAvailable: "No tasks available to create time entries for",
			created: "Time entry created for {taskTitle} ({duration} minutes)",
			createFailed: "Failed to create time entry",
		},
	},
	contextMenus: {
		task: {
			status: "Status",
			statusSelected: "✓ {label}",
			priority: "Priority",
			prioritySelected: "✓ {label}",
			dueDate: "Due date",
			scheduledDate: "Scheduled date",
			reminders: "Reminders",
			remindBeforeDue: "Remind before due…",
			remindBeforeScheduled: "Remind before scheduled…",
			manageReminders: "Manage all reminders…",
			clearReminders: "Clear all reminders",
			startTimeTracking: "Start time tracking",
			stopTimeTracking: "Stop time tracking",
			editTimeEntries: "Edit time entries",
			archive: "Archive",
			unarchive: "Unarchive",
			openNote: "Open note",
			copyTitle: "Copy task title",
			noteActions: "Note actions",
			rename: "Rename",
			renameTitle: "Rename File",
			renamePlaceholder: "Enter new name",
			delete: "Delete",
			deleteTitle: "Delete File",
			deleteMessage: 'Are you sure you want to delete "{name}"?',
			deleteConfirm: "Delete",
			copyPath: "Copy path",
			copyUrl: "Copy Obsidian URL",
			showInExplorer: "Show in file explorer",
			addToCalendar: "Add to calendar",
			calendar: {
				google: "Google Calendar",
				outlook: "Outlook Calendar",
				yahoo: "Yahoo Calendar",
				downloadIcs: "Download .ics file",
				syncToGoogle: "Sync to Google Calendar",
				syncToGoogleNotConfigured: "Google Calendar sync not configured",
				syncToGoogleSuccess: "Task synced to Google Calendar",
				syncToGoogleFailed: "Failed to sync task to Google Calendar",
			},
			recurrence: "Recurrence",
			clearRecurrence: "Clear recurrence",
			customRecurrence: "Custom recurrence...",
			createSubtask: "Create subtask",
			dependencies: {
				title: "Dependencies",
				addBlockedBy: "Add “blocked by”…",
				addBlockedByTitle: "Add tasks this depends on",
				addBlocking: "Add “blocking”…",
				addBlockingTitle: "Add tasks this blocks",
				removeBlockedBy: "Remove blocked-by…",
				removeBlocking: "Remove blocking…",
				unknownDependency: "Unknown",
				inputPlaceholder: "[[Task Note]]",
					notices: {
						noEntries: "Please enter at least one task",
						blockedByAdded: "{count} dependency added",
						blockedByRemoved: "Dependency removed",
						blockingAdded: "{count} dependent task added",
						blockingRemoved: "Dependent task removed",
						unresolved: "Could not resolve: {entries}",
						noEligibleTasks: "No matching tasks available",
						updateFailed: "Failed to update dependencies",
					},
				},
			organization: {
				title: "Organization",
				projects: "Projects",
				addToProject: "Add to project…",
				subtasks: "Subtasks",
				addSubtasks: "Add subtasks…",
				notices: {
					alreadyInProject: "Task is already in this project",
					alreadySubtask: "Task is already a subtask of this task",
					addedToProject: "Added to project: {project}",
					addedAsSubtask: "Added {subtask} as subtask of {parent}",
					addToProjectFailed: "Failed to add task to project",
					addAsSubtaskFailed: "Failed to add task as subtask",
					projectSelectFailed: "Failed to open project selector",
					subtaskSelectFailed: "Failed to open subtask selector",
					noEligibleSubtasks: "No eligible tasks available to assign as subtasks",
					currentTaskNotFound: "Current task file not found",
				},
			},
			subtasks: {
				loading: "Loading subtasks...",
				noSubtasks: "No subtasks found",
				loadFailed: "Failed to load subtasks",
			},
			markComplete: "Mark complete for this date",
			markIncomplete: "Mark incomplete for this date",
			skipInstance: "Skip instance",
			unskipInstance: "Unskip instance",
			quickReminders: {
				atTime: "At time of event",
				fiveMinutes: "5 minutes before",
				fifteenMinutes: "15 minutes before",
				oneHour: "1 hour before",
				oneDay: "1 day before",
			},
			notices: {
				toggleCompletionFailure: "Failed to toggle recurring task completion: {message}",
				toggleSkipFailure: "Failed to toggle recurring task skip: {message}",
				updateDueDateFailure: "Failed to update task due date: {message}",
				updateScheduledFailure: "Failed to update task scheduled date: {message}",
				updateRemindersFailure: "Failed to update reminders",
				clearRemindersFailure: "Failed to clear reminders",
				addReminderFailure: "Failed to add reminder",
				archiveFailure: "Failed to toggle task archive: {message}",
				copyTitleSuccess: "Task title copied to clipboard",
				copyFailure: "Failed to copy to clipboard",
				renameSuccess: 'Renamed to "{name}"',
				renameFailure: "Failed to rename file",
				copyPathSuccess: "File path copied to clipboard",
				copyUrlSuccess: "Obsidian URL copied to clipboard",
				updateRecurrenceFailure: "Failed to update task recurrence: {message}",
			},
		},
		priority: {
			clearPriority: "Clear priority",
		},
		ics: {
			showDetails: "Show details",
			createTask: "Create task from event",
			createNote: "Create note from event",
			linkNote: "Link existing note",
			copyTitle: "Copy title",
			copyLocation: "Copy location",
			copyUrl: "Copy URL",
			copyMarkdown: "Copy as markdown",
			subscriptionUnknown: "Unknown calendar",
			notices: {
				copyTitleSuccess: "Event title copied to clipboard",
				copyLocationSuccess: "Location copied to clipboard",
				copyUrlSuccess: "Event URL copied to clipboard",
				copyMarkdownSuccess: "Event details copied as markdown",
				copyFailure: "Failed to copy to clipboard",
				taskCreated: "Task created: {title}",
				taskCreateFailure: "Failed to create task from event",
				noteCreated: "Note created successfully",
				creationFailure: "Failed to open creation modal",
				linkSuccess: 'Linked note "{name}" to event',
				linkFailure: "Failed to link note",
				linkSelectionFailure: "Failed to open note selection",
			},
			markdown: {
				titleFallback: "Untitled Event",
				calendar: "**Calendar:** {value}",
				date: "**Date & Time:** {value}",
				location: "**Location:** {value}",
				descriptionHeading: "### Description",
				url: "**URL:** {value}",
				at: " at {time}",
			},
		},
		date: {
			increment: {
				plusOneDay: "+1 day",
				minusOneDay: "-1 day",
				plusOneWeek: "+1 week",
				minusOneWeek: "-1 week",
			},
			basic: {
				today: "Today",
				tomorrow: "Tomorrow",
				thisWeekend: "This weekend",
				nextWeek: "Next week",
				nextMonth: "Next month",
			},
			weekdaysLabel: "Weekdays",
			selected: "✓ {label}",
			pickDateTime: "Pick date & time…",
			clearDate: "Clear date",
			modal: {
				title: "Set date & time",
				dateLabel: "Date",
				timeLabel: "Time (optional)",
				select: "Select",
			},
		},
	},
	services: {
		pomodoro: {
			notices: {
				alreadyRunning: "A pomodoro is already running",
				resumeCurrentSession: "Resume the current session instead of starting a new one",
				timerAlreadyRunning: "A timer is already running",
				resumeSessionInstead: "Resume the current session instead of starting a new one",
				shortBreakStarted: "Short break started",
				longBreakStarted: "Long break started",
				paused: "Pomodoro paused",
				resumed: "Pomodoro resumed",
				stoppedAndReset: "Pomodoro stopped and reset",
				migrationSuccess: "Successfully migrated {count} pomodoro sessions to daily notes.",
				migrationFailure:
					"Failed to migrate pomodoro data. Please try again or check the console for details.",
			},
		},
		icsSubscription: {
			notices: {
				calendarNotFound:
					'Calendar "{name}" not found (404). Please check the ICS URL is correct and the calendar is publicly accessible.',
				calendarAccessDenied:
					'Calendar "{name}" access denied (500). This may be due to Microsoft Outlook server restrictions. Try regenerating the ICS URL from your calendar settings.',
				fetchRemoteFailed: 'Failed to fetch remote calendar "{name}": {error}',
				readLocalFailed: 'Failed to read local calendar "{name}": {error}',
			},
		},
		calendarExport: {
			notices: {
				generateLinkFailed: "Failed to generate calendar link",
				noTasksToExport: "No tasks found to export",
				downloadSuccess: "Downloaded {filename} with {count} task{plural}",
				downloadFailed: "Failed to download calendar file",
				singleDownloadSuccess: "Downloaded {filename}",
			},
		},
		filter: {
			groupLabels: {
				noProject: "No project",
				noTags: "No tags",
				invalidDate: "Invalid date",
				due: {
					overdue: "Overdue",
					today: "Today",
					tomorrow: "Tomorrow",
					nextSevenDays: "Next seven days",
					later: "Later",
					none: "No due date",
				},
				scheduled: {
					past: "Past scheduled",
					today: "Today",
					tomorrow: "Tomorrow",
					nextSevenDays: "Next seven days",
					later: "Later",
					none: "No scheduled date",
				},
			},
			errors: {
				noDatesProvided: "No dates provided",
			},
			folders: {
				root: "(Root)",
			},
		},
		instantTaskConvert: {
			notices: {
				noCheckboxTasks: "No checkbox tasks found in the current note.",
				convertingTasks: "Converting {count} task{plural}...",
				conversionSuccess: "✅ Successfully converted {count} task{plural} to TaskNotes!",
				partialConversion:
					"Converted {successCount} task{successPlural}. {failureCount} failed.",
				batchConversionFailed: "Failed to perform batch conversion. Please try again.",
				invalidParameters: "Invalid input parameters.",
				emptyLine: "Current line is empty or contains no valid content.",
				parseError: "Error parsing task: {error}",
				invalidTaskData: "Invalid task data.",
				replaceLineFailed: "Failed to replace task line.",
				conversionComplete: "Task converted: {title}",
				conversionCompleteShortened:
					'Task converted: "{title}" (filename shortened due to length)',
				fileExists:
					"A file with this name already exists. Please try again or rename the task.",
				conversionFailed: "Failed to convert task. Please try again.",
			},
		},
		icsNote: {
			notices: {
				templateNotFound: "Template not found: {path}",
				templateProcessError: "Error processing template: {template}",
				linkedToEvent: "Linked note to ICS event: {title}",
			},
		},
		task: {
			notices: {
				templateNotFound: "Task body template not found: {path}",
				templateReadError: "Error reading task body template: {template}",
				moveTaskFailed: "Failed to move {operation} task: {error}",
			},
		},
		autoExport: {
			notices: {
				exportFailed: "TaskNotes auto export failed: {error}",
			},
		},
		notification: {
			notices: {
				// NotificationService uses Notice for in-app notifications
				// but the message comes from the reminder content, so no hardcoded strings to translate
			},
		},
	},
	ui: {
		icsCard: {
			untitledEvent: "Untitled event",
			allDay: "All day",
			calendarEvent: "Calendar event",
			calendarFallback: "Calendar",
		},
		noteCard: {
			createdLabel: "Created:",
			dailyBadge: "Daily",
			dailyTooltip: "Daily note",
		},
		taskCard: {
			blockedBadge: "Blocked",
			blockedBadgeTooltip: "This task is waiting on another task",
			blockingBadge: "Blocking",
			blockingBadgeTooltip: "This task is blocking another task",
			blockingToggle: "Blocking {count} tasks",
			loadingDependencies: "Loading dependencies...",
			blockingEmpty: "No dependent tasks",
			blockingLoadError: "Failed to load dependencies",
			googleCalendarSyncTooltip: "Synced to Google Calendar",
		},
		propertyEventCard: {
			unknownFile: "Unknown file",
		},
		filterHeading: {
			allViewName: "All",
		},
		filterBar: {
			saveView: "Save view",
			saveViewNamePlaceholder: "Enter view name...",
			saveButton: "Save",
			views: "Views",
			savedFilterViews: "Saved filter views",
			filters: "Filters",
			properties: "Properties",
			sort: "Sort",
			newTask: "New",
			expandAllGroups: "Expand All Groups",
			collapseAllGroups: "Collapse All Groups",
			searchTasksPlaceholder: "Search tasks...",
			searchTasksTooltip: "Search task titles",
			filterUnavailable: "Filter bar temporarily unavailable",
			toggleFilter: "Toggle filter",
			activeFiltersTooltip: "Active filters – Click to modify, right-click to clear",
			configureVisibleProperties: "Configure visible properties",
			sortAndGroupOptions: "Sort and group options",
			sortMenuHeader: "Sort",
			orderMenuHeader: "Order",
			groupMenuHeader: "Group",
			createNewTask: "Create new task",
			filter: "Filter",
			displayOrganization: "Display & Organization",
			viewOptions: "View Options",
			addFilter: "Add filter",
			addFilterGroup: "Add filter group",
			addFilterTooltip: "Add a new filter condition",
			addFilterGroupTooltip: "Add a nested filter group",
			clearAllFilters: "Clear all filters and groups",
			saveCurrentFilter: "Save current filter as view",
			closeFilterModal: "Close filter modal",
			deleteFilterGroup: "Delete filter group",
			deleteCondition: "Delete condition",
			all: "All",
			any: "Any",
			followingAreTrue: "of the following are true:",
			where: "where",
			selectProperty: "Select...",
			chooseProperty: "Choose which task property to filter by",
			chooseOperator: "Choose how to compare the property value",
			enterValue: "Enter the value to filter by",
			selectValue: "Select a {property} to filter by",
			sortBy: "Sort by:",
			toggleSortDirection: "Toggle sort direction",
			chooseSortMethod: "Choose how to sort tasks",
			groupBy: "Group by:",
			chooseGroupMethod: "Group tasks by a common property",
			toggleViewOption: "Toggle {option}",
			expandCollapseFilters: "Click to expand/collapse filter conditions",
			expandCollapseSort: "Click to expand/collapse sorting and grouping options",
			expandCollapseViewOptions: "Click to expand/collapse view-specific options",
			naturalLanguageDates: "Natural Language Dates",
			naturalLanguageExamples: "Show natural language date examples",
			enterNumericValue: "Enter a numeric value to filter by",
			enterDateValue: "Enter a date using natural language or ISO format",
			pickDateTime: "Pick date & time",
			noSavedViews: "No saved views",
			savedViews: "Saved views",
			yourSavedFilters: "Your saved filter configurations",
			dragToReorder: "Drag to reorder views",
			loadSavedView: "Load saved view: {name}",
			deleteView: "Delete view",
			deleteViewTitle: "Delete View",
			deleteViewMessage: 'Are you sure you want to delete the view "{name}"?',
			manageAllReminders: "Manage All Reminders...",
			clearAllReminders: "Clear All Reminders",
			customRecurrence: "Custom recurrence...",
			clearRecurrence: "Clear recurrence",
			sortOptions: {
				dueDate: "Due Date",
				scheduledDate: "Scheduled Date",
				priority: "Priority",
				status: "Status",
				title: "Title",
				createdDate: "Created Date",
				tags: "Tags",
				ascending: "Ascending",
				descending: "Descending",
			},
			group: {
				none: "None",
				status: "Status",
				priority: "Priority",
				context: "Context",
				project: "Project",
				dueDate: "Due Date",
				scheduledDate: "Scheduled Date",
				tags: "Tags",
				completedDate: "Completed Date",
			},
			subgroupLabel: "SUBGROUP",
			notices: {
				propertiesMenuFailed: "Failed to show properties menu",
			},
		},
	},
	components: {
		dateContextMenu: {
			weekdays: "Weekdays",
			clearDate: "Clear date",
			today: "Today",
			tomorrow: "Tomorrow",
			thisWeekend: "This weekend",
			nextWeek: "Next week",
			nextMonth: "Next month",
			setDateTime: "Set date & time",
			dateLabel: "Date",
			timeLabel: "Time (optional)",
		},
		subgroupMenuBuilder: {
			none: "None",
			status: "Status",
			priority: "Priority",
			context: "Context",
			project: "Project",
			dueDate: "Due Date",
			scheduledDate: "Scheduled Date",
			tags: "Tags",
			completedDate: "Completed Date",
			subgroup: "SUBGROUP",
		},
		propertyVisibilityDropdown: {
			coreProperties: "CORE PROPERTIES",
			organization: "ORGANIZATION",
			customProperties: "CUSTOM PROPERTIES",
			failed: "Failed to show properties menu",
			properties: {
				statusDot: "Status Dot",
				priorityDot: "Priority Dot",
				dueDate: "Due Date",
				scheduledDate: "Scheduled Date",
				timeEstimate: "Time Estimate",
				totalTrackedTime: "Total Tracked Time",
				recurrence: "Recurrence",
				completedDate: "Completed Date",
				createdDate: "Created Date",
				modifiedDate: "Modified Date",
				projects: "Projects",
				contexts: "Contexts",
				tags: "Tags",
				blocked: "Blocked",
				blocking: "Blocking",
			},
		},
		reminderContextMenu: {
			remindBeforeDue: "Remind before due...",
			remindBeforeScheduled: "Remind before scheduled...",
			manageAllReminders: "Manage All Reminders...",
			clearAllReminders: "Clear All Reminders",
			quickReminders: {
				atTime: "At time of event",
				fiveMinutesBefore: "5 minutes before",
				fifteenMinutesBefore: "15 minutes before",
				oneHourBefore: "1 hour before",
				oneDayBefore: "1 day before",
			},
		},
		recurrenceContextMenu: {
			daily: "Daily",
			weeklyOn: "Weekly on {day}",
			everyTwoWeeksOn: "Every 2 weeks on {day}",
			monthlyOnThe: "Monthly on the {ordinal}",
			everyThreeMonthsOnThe: "Every 3 months on the {ordinal}",
			yearlyOn: "Yearly on {month} {ordinal}",
			weekdaysOnly: "Weekdays only",
			dailyAfterCompletion: "Daily (after completion)",
			every3DaysAfterCompletion: "Every 3 days (after completion)",
			weeklyAfterCompletion: "Weekly (after completion)",
			monthlyAfterCompletion: "Monthly (after completion)",
			customRecurrence: "Custom recurrence...",
			clearRecurrence: "Clear recurrence",
			customRecurrenceModal: {
				title: "Custom Recurrence",
				startDate: "Start date",
				startDateDesc: "The date when the recurrence pattern begins",
				startTime: "Start time",
				startTimeDesc: "The time when recurring instances should appear (optional)",
				recurFrom: "Recur from",
				recurFromDesc: "When should the next occurrence be calculated?",
				scheduledDate: "Scheduled date",
				completionDate: "Completion date",
				frequency: "Frequency",
				interval: "Interval",
				intervalDesc: "Every X days/weeks/months/years",
				daysOfWeek: "Days of week",
				daysOfWeekDesc: "Select specific days (for weekly recurrence)",
				monthlyRecurrence: "Monthly recurrence",
				monthlyRecurrenceDesc: "Choose how to repeat monthly",
				yearlyRecurrence: "Yearly recurrence",
				yearlyRecurrenceDesc: "Choose how to repeat yearly",
				endCondition: "End condition",
				endConditionDesc: "Choose when the recurrence should end",
				neverEnds: "Never ends",
				endAfterOccurrences: "End after {count} occurrences",
				endOnDate: "End on {date}",
				onDayOfMonth: "On day {day} of each month",
				onTheWeekOfMonth: "On the {week} {day} of each month",
				onDateOfYear: "On {month} {day} each year",
				onTheWeekOfYear: "On the {week} {day} of {month} each year",
				frequencies: {
					daily: "Daily",
					weekly: "Weekly",
					monthly: "Monthly",
					yearly: "Yearly",
				},
				weekPositions: {
					first: "first",
					second: "second",
					third: "third",
					fourth: "fourth",
					last: "last",
				},
				weekdays: {
					monday: "Monday",
					tuesday: "Tuesday",
					wednesday: "Wednesday",
					thursday: "Thursday",
					friday: "Friday",
					saturday: "Saturday",
					sunday: "Sunday",
				},
				weekdaysShort: {
					mon: "Mon",
					tue: "Tue",
					wed: "Wed",
					thu: "Thu",
					fri: "Fri",
					sat: "Sat",
					sun: "Sun",
				},
				cancel: "Cancel",
				save: "Save",
			},
		},
	},
};

export type EnTranslationSchema = typeof en;
