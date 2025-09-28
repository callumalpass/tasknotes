import { TranslationTree } from '../types';

export const en: TranslationTree = {
    common: {
        appName: 'TaskNotes',
        cancel: 'Cancel',
        confirm: 'Confirm',
        close: 'Close',
        save: 'Save',
        language: 'Language',
        systemDefault: 'System default',
        languages: {
            en: 'English',
            fr: 'French',
            ru: 'Russian',
            zh: 'Chinese',
            de: 'German',
            es: 'Spanish',
            ja: 'Japanese'
        },
        weekdays: {
            sunday: 'Sunday',
            monday: 'Monday',
            tuesday: 'Tuesday',
            wednesday: 'Wednesday',
            thursday: 'Thursday',
            friday: 'Friday',
            saturday: 'Saturday'
        },
        months: {
            january: 'January',
            february: 'February',
            march: 'March',
            april: 'April',
            may: 'May',
            june: 'June',
            july: 'July',
            august: 'August',
            september: 'September',
            october: 'October',
            november: 'November',
            december: 'December'
        }
    },
    views: {
        agenda: {
            title: 'Agenda',
            today: 'Today',
            refreshCalendars: 'Refresh calendars',
            actions: {
                previousPeriod: 'Previous period',
                nextPeriod: 'Next period',
                goToToday: 'Go to today',
                refreshCalendars: 'Refresh calendar subscriptions'
            },
            loading: 'Loading agenda...',
            dayToggle: 'Toggle day',
            expandAllDays: 'Expand All Days',
            collapseAllDays: 'Collapse All Days',
            notices: {
                calendarNotReady: 'Calendar service not ready yet',
                calendarRefreshed: 'Calendar subscriptions refreshed',
                refreshFailed: 'Failed to refresh'
            },
            empty: {
                noItemsScheduled: 'No items scheduled',
                noItemsFound: 'No items found'
            }
        },
        taskList: {
            title: 'Tasks',
            expandAllGroups: 'Expand All Groups',
            collapseAllGroups: 'Collapse All Groups',
            noTasksFound: 'No tasks found for the selected filters.'
        },
        notes: {
            title: 'Notes',
            refreshButton: 'Refreshing...',
            notices: {
                indexingDisabled: 'Note indexing disabled'
            },
            empty: {
                noNotesFound: 'No notes found'
            }
        },
        miniCalendar: {
            title: 'Mini Calendar'
        },
        advancedCalendar: {
            title: 'Advanced Calendar'
        },
        kanban: {
            title: 'Kanban',
            newTask: 'New task',
            addCard: '+ Add a card',
            noTasks: 'No tasks',
            notices: {
                loadFailed: 'Failed to load Kanban board',
                movedTask: 'Task moved to "{0}"'
            },
            errors: {
                loadingBoard: 'Error loading board.'
            }
        },
        pomodoro: {
            title: 'Pomodoro',
            status: {
                focus: 'Focus',
                ready: 'Ready to start',
                paused: 'Paused',
                working: 'Working',
                shortBreak: 'Short break',
                longBreak: 'Long break',
                breakPrompt: 'Great work! Time for a {length} break',
                breakLength: {
                    short: 'short',
                    long: 'long'
                },
                breakComplete: 'Break complete! Ready for the next pomodoro?'
            },
            buttons: {
                start: 'Start',
                pause: 'Pause',
                stop: 'Stop',
                resume: 'Resume',
                startShortBreak: 'Start Short Break',
                startLongBreak: 'Start Long Break',
                skipBreak: 'Skip break',
                chooseTask: 'Choose task...',
                changeTask: 'Change task...',
                clearTask: 'Clear task',
                selectDifferentTask: 'Select a different task'
            },
            notices: {
                noTasks: 'No unarchived tasks found. Create some tasks first.',
                loadFailed: 'Failed to load tasks'
            },
            statsLabel: 'completed today'
        },
        pomodoroStats: {
            title: 'Pomodoro stats',
            heading: 'Pomodoro statistics',
            refresh: 'Refresh',
            sections: {
                overview: 'Overview',
                today: 'Today',
                week: 'This week',
                allTime: 'All time',
                recent: 'Recent sessions'
            },
            overviewCards: {
                todayPomos: {
                    label: "Today's Pomos",
                    change: {
                        more: '{count} more than yesterday',
                        less: '{count} fewer than yesterday'
                    }
                },
                totalPomos: {
                    label: 'Total Pomos'
                },
                todayFocus: {
                    label: "Today's Focus",
                    change: {
                        more: '{duration} more than yesterday',
                        less: '{duration} less than yesterday'
                    }
                },
                totalFocus: {
                    label: 'Total Focus Duration'
                }
            },
            stats: {
                pomodoros: 'Pomodoros',
                streak: 'Streak',
                minutes: 'Minutes',
                average: 'Avg length',
                completion: 'Completion'
            },
            recents: {
                empty: 'No sessions recorded yet',
                duration: '{minutes} min',
                status: {
                    completed: 'Completed',
                    interrupted: 'Interrupted'
                }
            }
        },
        stats: {
            title: 'Statistics',
            taskProjectStats: 'Task & Project Statistics',
            sections: {
                filters: 'Filters',
                overview: 'Overview',
                today: 'Today',
                thisWeek: 'This Week',
                thisMonth: 'This Month',
                projectBreakdown: 'Project Breakdown',
                dateRange: 'Date Range'
            },
            filters: {
                minTime: 'Min Time (minutes)'
            }
        }
    },
    settings: {
        tabs: {
            general: 'General',
            taskProperties: 'Task Properties',
            defaults: 'Defaults & Templates',
            appearance: 'Appearance & UI',
            features: 'Features',
            integrations: 'Integrations'
        },
        features: {
            inlineTasks: {
                header: 'Inline Tasks',
                description: 'Configure inline task features for seamless task management within any note.'
            },
            overlays: {
                taskLinkToggle: {
                    name: 'Task link overlay',
                    description: 'Show interactive overlays when hovering over task links'
                }
            },
            instantConvert: {
                toggle: {
                    name: 'Instant task convert',
                    description: 'Enable instant conversion of text to tasks using keyboard shortcuts'
                },
                folder: {
                    name: 'Inline task convert folder',
                    description: 'Folder for inline task conversion. Use {{currentNotePath}} for relative to current note'
                }
            },
            nlp: {
                header: 'Natural Language Processing',
                description: 'Enable smart parsing of task details from natural language input.',
                enable: {
                    name: 'Enable natural language task input',
                    description: 'Parse due dates, priorities, and contexts from natural language when creating tasks'
                },
                defaultToScheduled: {
                    name: 'Default to scheduled',
                    description: 'When NLP detects a date without context, treat it as scheduled rather than due'
                },
                language: {
                    name: 'NLP language',
                    description: 'Language for natural language processing patterns and date parsing'
                },
                statusTrigger: {
                    name: 'Status suggestion trigger',
                    description: 'Text to trigger status suggestions (leave empty to disable)'
                }
            },
            pomodoro: {
                header: 'Pomodoro Timer',
                description: 'Built-in Pomodoro timer for time management and productivity tracking.',
                workDuration: {
                    name: 'Work duration',
                    description: 'Duration of work intervals in minutes'
                },
                shortBreak: {
                    name: 'Short break duration',
                    description: 'Duration of short breaks in minutes'
                },
                longBreak: {
                    name: 'Long break duration',
                    description: 'Duration of long breaks in minutes'
                },
                longBreakInterval: {
                    name: 'Long break interval',
                    description: 'Number of work sessions before a long break'
                },
                autoStartBreaks: {
                    name: 'Auto-start breaks',
                    description: 'Automatically start break timers after work sessions'
                },
                autoStartWork: {
                    name: 'Auto-start work',
                    description: 'Automatically start work sessions after breaks'
                },
                notifications: {
                    name: 'Pomodoro notifications',
                    description: 'Show notifications when Pomodoro sessions end'
                }
            },
            uiLanguage: {
                header: 'Interface Language',
                description: 'Change the language of TaskNotes menus, notices, and views.',
                dropdown: {
                    name: 'UI language',
                    description: 'Select the language used for TaskNotes interface text'
                }
            },
            pomodoroSound: {
                enabledName: 'Sound enabled',
                enabledDesc: 'Play sound when Pomodoro sessions end',
                volumeName: 'Sound volume',
                volumeDesc: 'Volume for Pomodoro sounds (0-100)'
            },
            dataStorage: {
                name: 'Pomodoro data storage',
                dailyNotes: 'Daily notes'
            },
            notifications: {
                header: 'Notifications',
                enableName: 'Enable notifications',
                enableDesc: 'Enable task reminder notifications',
                typeName: 'Notification type',
                typeDesc: 'Type of notifications to show',
                systemLabel: 'System notifications',
                inAppLabel: 'In-app notifications'
            },
            overdue: {
                hideCompletedName: 'Hide completed tasks from overdue',
                hideCompletedDesc: 'Exclude completed tasks from overdue task calculations'
            },
            indexing: {
                disableName: 'Disable note indexing',
                disableDesc: 'Disable automatic indexing of note content for better performance'
            },
            suggestions: {
                debounceName: 'Suggestion debounce',
                debounceDesc: 'Delay in milliseconds before showing suggestions'
            },
            timeTracking: {
                autoStopName: 'Auto-stop time tracking',
                autoStopDesc: 'Automatically stop time tracking when a task is marked complete',
                stopNotificationName: 'Time tracking stop notification',
                stopNotificationDesc: 'Show notification when time tracking is automatically stopped'
            },
            recurring: {
                maintainOffsetName: 'Maintain due date offset in recurring tasks',
                maintainOffsetDesc: 'Keep the offset between due date and scheduled date when recurring tasks are completed'
            },
            timeblocking: {
                header: 'Timeblocking',
                enableName: 'Enable timeblocking',
                enableDesc: 'Enable timeblock functionality for lightweight scheduling in daily notes',
                showBlocksName: 'Show timeblocks',
                showBlocksDesc: 'Display timeblocks from daily notes by default'
            },
            performance: {
                header: 'Performance & Behavior'
            },
            timeTrackingSection: {
                header: 'Time Tracking'
            },
            recurringSection: {
                header: 'Recurring Tasks'
            }
        },
        defaults: {
            header: {
                basicDefaults: 'Basic Defaults',
                dateDefaults: 'Date Defaults',
                defaultReminders: 'Default reminders',
                bodyTemplate: 'Body Template',
                instantTaskConversion: 'Instant Task Conversion'
            },
            description: {
                basicDefaults: 'Set default values for new tasks to speed up task creation.',
                dateDefaults: 'Set default due and scheduled dates for new tasks.',
                defaultReminders: 'Configure default reminders that will be added to new tasks.',
                bodyTemplate: 'Configure a template file to use for new task content.',
                instantTaskConversion: 'Configure behavior when converting text to tasks instantly.'
            },
            basicDefaults: {
                defaultStatus: {
                    name: 'Default status',
                    description: 'Default status for new tasks'
                },
                defaultPriority: {
                    name: 'Default priority',
                    description: 'Default priority for new tasks'
                },
                defaultContexts: {
                    name: 'Default contexts',
                    description: 'Comma-separated list of default contexts (e.g., @home, @work)',
                    placeholder: '@home, @work'
                },
                defaultTags: {
                    name: 'Default tags',
                    description: 'Comma-separated list of default tags (without #)',
                    placeholder: 'important, urgent'
                },
                defaultProjects: {
                    name: 'Default projects',
                    description: 'Default project links for new tasks',
                    selectButton: 'Select Projects',
                    selectTooltip: 'Choose project notes to link by default',
                    removeTooltip: 'Remove {name} from default projects'
                },
                useParentNoteAsProject: {
                    name: 'Use parent note as project during instant conversion',
                    description: 'Automatically link the parent note as a project when using instant task conversion'
                },
                defaultTimeEstimate: {
                    name: 'Default time estimate',
                    description: 'Default time estimate in minutes (0 = no default)',
                    placeholder: '60'
                },
                defaultRecurrence: {
                    name: 'Default recurrence',
                    description: 'Default recurrence pattern for new tasks'
                }
            },
            dateDefaults: {
                defaultDueDate: {
                    name: 'Default due date',
                    description: 'Default due date for new tasks'
                },
                defaultScheduledDate: {
                    name: 'Default scheduled date',
                    description: 'Default scheduled date for new tasks'
                }
            },
            reminders: {
                addReminder: {
                    name: 'Add default reminder',
                    description: 'Create a new default reminder that will be added to all new tasks',
                    buttonText: 'Add reminder'
                },
                emptyState: 'No default reminders configured. Add a reminder to automatically notify you about new tasks.',
                emptyStateButton: 'Add Reminder',
                reminderDescription: 'Reminder description',
                unnamedReminder: 'Unnamed Reminder',
                deleteTooltip: 'Delete reminder',
                fields: {
                    description: 'Description:',
                    type: 'Type:',
                    offset: 'Offset:',
                    unit: 'Unit:',
                    direction: 'Direction:',
                    relatedTo: 'Related to:',
                    date: 'Date:',
                    time: 'Time:'
                },
                types: {
                    relative: 'Relative (before/after task dates)',
                    absolute: 'Absolute (specific date/time)'
                },
                units: {
                    minutes: 'minutes',
                    hours: 'hours',
                    days: 'days'
                },
                directions: {
                    before: 'before',
                    after: 'after'
                },
                relatedTo: {
                    due: 'due date',
                    scheduled: 'scheduled date'
                }
            },
            bodyTemplate: {
                useBodyTemplate: {
                    name: 'Use body template',
                    description: 'Use a template file for task body content'
                },
                bodyTemplateFile: {
                    name: 'Body template file',
                    description: 'Path to template file for task body content. Supports template variables like {{title}}, {{date}}, {{time}}, {{priority}}, {{status}}, etc.',
                    placeholder: 'Templates/Task Template.md',
                    ariaLabel: 'Path to body template file'
                },
                variablesHeader: 'Template variables:',
                variables: {
                    title: '{{title}} - Task title',
                    details: '{{details}} - User-provided details from modal',
                    date: '{{date}} - Current date (YYYY-MM-DD)',
                    time: '{{time}} - Current time (HH:MM)',
                    priority: '{{priority}} - Task priority',
                    status: '{{status}} - Task status',
                    contexts: '{{contexts}} - Task contexts',
                    tags: '{{tags}} - Task tags',
                    projects: '{{projects}} - Task projects'
                }
            },
            instantConversion: {
                useDefaultsOnInstantConvert: {
                    name: 'Use task defaults on instant convert',
                    description: 'Apply default task settings when converting text to tasks instantly'
                }
            },
            options: {
                noDefault: 'No default',
                none: 'None',
                today: 'Today',
                tomorrow: 'Tomorrow',
                nextWeek: 'Next week',
                daily: 'Daily',
                weekly: 'Weekly',
                monthly: 'Monthly',
                yearly: 'Yearly'
            }
        },
        general: {
            taskStorage: {
                header: 'Task Storage',
                description: 'Configure where tasks are stored and how they are identified.',
                defaultFolder: {
                    name: 'Default tasks folder',
                    description: 'Default location for new tasks'
                },
                moveArchived: {
                    name: 'Move archived tasks to folder',
                    description: 'Automatically move archived tasks to an archive folder'
                },
                archiveFolder: {
                    name: 'Archive folder',
                    description: 'Folder to move tasks to when archived'
                }
            },
            taskIdentification: {
                header: 'Task Identification',
                description: 'Choose how TaskNotes identifies notes as tasks.',
                identifyBy: {
                    name: 'Identify tasks by',
                    description: 'Choose whether to identify tasks by tag or by a frontmatter property',
                    options: {
                        tag: 'Tag',
                        property: 'Property'
                    }
                },
                taskTag: {
                    name: 'Task tag',
                    description: 'Tag that identifies notes as tasks (without #)'
                },
                taskProperty: {
                    name: 'Task property name',
                    description: 'The frontmatter property name (e.g., "category")'
                },
                taskPropertyValue: {
                    name: 'Task property value',
                    description: 'The value that identifies a note as a task (e.g., "task")'
                }
            },
            folderManagement: {
                header: 'Folder Management',
                excludedFolders: {
                    name: 'Excluded folders',
                    description: 'Comma-separated list of folders to exclude from Notes tab'
                }
            },
            taskInteraction: {
                header: 'Task Interaction',
                description: 'Configure how clicking on tasks behaves.',
                singleClick: {
                    name: 'Single-click action',
                    description: 'Action performed when single-clicking a task card'
                },
                doubleClick: {
                    name: 'Double-click action',
                    description: 'Action performed when double-clicking a task card'
                },
                actions: {
                    edit: 'Edit task',
                    openNote: 'Open note',
                    none: 'No action'
                }
            }
        },
        taskProperties: {
            taskStatuses: {
                header: 'Task Statuses',
                description: 'Customize the status options available for your tasks. These statuses control the task lifecycle and determine when tasks are considered complete.',
                howTheyWork: {
                    title: 'How statuses work:',
                    value: 'Value: The internal identifier stored in your task files (e.g., "in-progress")',
                    label: 'Label: The display name shown in the interface (e.g., "In Progress")',
                    color: 'Color: Visual indicator color for the status dot and badges',
                    completed: 'Completed: When checked, tasks with this status are considered finished and may be filtered differently',
                    autoArchive: 'Auto-archive: When enabled, tasks will be automatically archived after the specified delay (1-1440 minutes)',
                    orderNote: 'The order below determines the sequence when cycling through statuses by clicking on task status badges.'
                },
                addNew: {
                    name: 'Add new status',
                    description: 'Create a new status option for your tasks',
                    buttonText: 'Add status'
                },
                validationNote: 'Note: You must have at least 2 statuses, and at least one status must be marked as "Completed".',
                emptyState: 'No custom statuses configured. Add a status to get started.',
                emptyStateButton: 'Add Status',
                fields: {
                    value: 'Value:',
                    label: 'Label:',
                    color: 'Color:',
                    completed: 'Completed:',
                    autoArchive: 'Auto-archive:',
                    delayMinutes: 'Delay (minutes):'
                },
                placeholders: {
                    value: 'in-progress',
                    label: 'In Progress'
                },
                badges: {
                    completed: 'Completed'
                },
                deleteConfirm: 'Are you sure you want to delete the status "{label}"?'
            },
            taskPriorities: {
                header: 'Task Priorities',
                description: 'Customize the priority levels available for your tasks. Priority weights determine sorting order and visual hierarchy in your task views.',
                howTheyWork: {
                    title: 'How priorities work:',
                    value: 'Value: The internal identifier stored in your task files (e.g., "high")',
                    label: 'Display Label: The display name shown in the interface (e.g., "High Priority")',
                    color: 'Color: Visual indicator color for the priority dot and badges',
                    weight: 'Weight: Numeric value for sorting (higher weights appear first in lists)',
                    weightNote: 'Tasks are automatically sorted by priority weight in descending order (highest weight first). Weights can be any positive number.'
                },
                addNew: {
                    name: 'Add new priority',
                    description: 'Create a new priority level for your tasks',
                    buttonText: 'Add priority'
                },
                validationNote: 'Note: You must have at least 1 priority. Higher weights take precedence in sorting and visual hierarchy.',
                emptyState: 'No custom priorities configured. Add a priority to get started.',
                emptyStateButton: 'Add Priority',
                fields: {
                    value: 'Value:',
                    label: 'Label:',
                    color: 'Color:',
                    weight: 'Weight:'
                },
                placeholders: {
                    value: 'high',
                    label: 'High Priority'
                },
                weightLabel: 'Weight: {weight}',
                deleteConfirm: 'You must have at least one priority',
                deleteTooltip: 'Delete priority'
            },
            fieldMapping: {
                header: 'Field Mapping',
                warning: '⚠️ Warning: TaskNotes will read AND write using these property names. Changing these after creating tasks may cause inconsistencies.',
                description: 'Configure which frontmatter properties TaskNotes should use for each field.',
                resetButton: {
                    name: 'Reset field mappings',
                    description: 'Reset all field mappings to default values',
                    buttonText: 'Reset to Defaults'
                },
                notices: {
                    resetSuccess: 'Field mappings reset to defaults',
                    resetFailure: 'Failed to reset field mappings',
                    updateFailure: 'Failed to update field mapping for {label}. Please try again.'
                },
                table: {
                    fieldHeader: 'TaskNotes field',
                    propertyHeader: 'Your property name'
                },
                fields: {
                    title: 'Title',
                    status: 'Status',
                    priority: 'Priority',
                    due: 'Due date',
                    scheduled: 'Scheduled date',
                    contexts: 'Contexts',
                    projects: 'Projects',
                    timeEstimate: 'Time estimate',
                    recurrence: 'Recurrence',
                    dateCreated: 'Created date',
                    completedDate: 'Completed date',
                    dateModified: 'Modified date',
                    archiveTag: 'Archive tag',
                    timeEntries: 'Time entries',
                    completeInstances: 'Complete instances',
                    pomodoros: 'Pomodoros',
                    icsEventId: 'ICS Event ID',
                    icsEventTag: 'ICS Event Tag',
                    reminders: 'Reminders'
                }
            },
            customUserFields: {
                header: 'Custom User Fields',
                description: 'Define custom frontmatter properties to appear as type-aware filter options across views. Each row: Display Name, Property Name, Type.',
                addNew: {
                    name: 'Add new user field',
                    description: 'Create a new custom field that will appear in filters and views',
                    buttonText: 'Add user field'
                },
                emptyState: 'No custom user fields configured. Add a field to create custom properties for your tasks.',
                emptyStateButton: 'Add User Field',
                fields: {
                    displayName: 'Display Name:',
                    propertyKey: 'Property Key:',
                    type: 'Type:'
                },
                placeholders: {
                    displayName: 'Display Name',
                    propertyKey: 'property-name'
                },
                types: {
                    text: 'Text',
                    number: 'Number',
                    boolean: 'Boolean',
                    date: 'Date',
                    list: 'List'
                },
                defaultNames: {
                    unnamedField: 'Unnamed Field',
                    noKey: 'no-key'
                },
                deleteTooltip: 'Delete field'
            }
        },
        appearance: {
            taskCards: {
                header: 'Task Cards',
                description: 'Configure how task cards are displayed across all views.',
                defaultVisibleProperties: {
                    name: 'Default visible properties',
                    description: 'Choose which properties appear on task cards by default.'
                },
                propertyGroups: {
                    coreProperties: 'CORE PROPERTIES',
                    organization: 'ORGANIZATION',
                    customProperties: 'CUSTOM PROPERTIES'
                },
                properties: {
                    status: 'Status Dot',
                    priority: 'Priority Dot',
                    due: 'Due Date',
                    scheduled: 'Scheduled Date',
                    timeEstimate: 'Time Estimate',
                    totalTrackedTime: 'Total Tracked Time',
                    recurrence: 'Recurrence',
                    completedDate: 'Completed Date',
                    createdDate: 'Created Date',
                    modifiedDate: 'Modified Date',
                    projects: 'Projects',
                    contexts: 'Contexts',
                    tags: 'Tags'
                }
            },
            taskFilenames: {
                header: 'Task Filenames',
                description: 'Configure how task files are named when created.',
                storeTitleInFilename: {
                    name: 'Store title in filename',
                    description: 'Use the task title as the filename. Filename will update when the task title is changed (Recommended).'
                },
                filenameFormat: {
                    name: 'Filename format',
                    description: 'How task filenames should be generated',
                    options: {
                        title: 'Task title (Non-updating)',
                        zettel: 'Zettelkasten format (YYMMDD + base36 seconds since midnight)',
                        timestamp: 'Full timestamp (YYYY-MM-DD-HHMMSS)',
                        custom: 'Custom template'
                    }
                },
                customTemplate: {
                    name: 'Custom filename template',
                    description: 'Template for custom filenames. Available variables: {title}, {titleLower}, {titleUpper}, {titleSnake}, {titleKebab}, {titleCamel}, {titlePascal}, {date}, {shortDate}, {time}, {time12}, {time24}, {timestamp}, {dateTime}, {year}, {month}, {monthName}, {monthNameShort}, {day}, {dayName}, {dayNameShort}, {hour}, {hour12}, {minute}, {second}, {milliseconds}, {ms}, {ampm}, {week}, {quarter}, {unix}, {unixMs}, {timezone}, {timezoneShort}, {utcOffset}, {utcOffsetShort}, {utcZ}, {zettel}, {nano}, {priority}, {priorityShort}, {status}, {statusShort}, {dueDate}, {scheduledDate}',
                    placeholder: '{date}-{title}-{dueDate}',
                    helpText: 'Note: {dueDate} and {scheduledDate} are in YYYY-MM-DD format and will be empty if not set.'
                }
            },
            displayFormatting: {
                header: 'Display Formatting',
                description: 'Configure how dates, times, and other data are displayed across the plugin.',
                timeFormat: {
                    name: 'Time format',
                    description: 'Display time in 12-hour or 24-hour format throughout the plugin',
                    options: {
                        twelveHour: '12-hour (AM/PM)',
                        twentyFourHour: '24-hour'
                    }
                }
            },
            calendarView: {
                header: 'Calendar View',
                description: 'Customize the appearance and behavior of the calendar view.',
                defaultView: {
                    name: 'Default view',
                    description: 'The calendar view shown when opening the calendar tab',
                    options: {
                        monthGrid: 'Month Grid',
                        weekTimeline: 'Week Timeline',
                        dayTimeline: 'Day Timeline',
                        yearView: 'Year View',
                        customMultiDay: 'Custom Multi-Day'
                    }
                },
                customDayCount: {
                    name: 'Custom view day count',
                    description: 'Number of days to show in custom multi-day view',
                    placeholder: '3'
                },
                firstDayOfWeek: {
                    name: 'First day of week',
                    description: 'Which day should be the first column in week views'
                },
                showWeekends: {
                    name: 'Show weekends',
                    description: 'Display weekends in calendar views'
                },
                showWeekNumbers: {
                    name: 'Show week numbers',
                    description: 'Display week numbers in calendar views'
                },
                showTodayHighlight: {
                    name: 'Show today highlight',
                    description: 'Highlight the current day in calendar views'
                },
                showCurrentTimeIndicator: {
                    name: 'Show current time indicator',
                    description: 'Display a line showing the current time in timeline views'
                },
                selectionMirror: {
                    name: 'Selection mirror',
                    description: 'Show a visual preview while dragging to select time ranges'
                },
                calendarLocale: {
                    name: 'Calendar locale',
                    description: 'Calendar locale for date formatting and calendar system (e.g., "en", "fa" for Farsi/Persian, "de" for German). Leave empty to auto-detect from browser.',
                    placeholder: 'Auto-detect'
                }
            },
            defaultEventVisibility: {
                header: 'Default Event Visibility',
                description: 'Configure which event types are visible by default when opening the Advanced Calendar. Users can still toggle these on/off in the calendar view.',
                showScheduledTasks: {
                    name: 'Show scheduled tasks',
                    description: 'Display tasks with scheduled dates by default'
                },
                showDueDates: {
                    name: 'Show due dates',
                    description: 'Display task due dates by default'
                },
                showDueWhenScheduled: {
                    name: 'Show due dates when scheduled',
                    description: 'Display due dates even for tasks that already have scheduled dates'
                },
                showTimeEntries: {
                    name: 'Show time entries',
                    description: 'Display completed time tracking entries by default'
                },
                showRecurringTasks: {
                    name: 'Show recurring tasks',
                    description: 'Display recurring task instances by default'
                },
                showICSEvents: {
                    name: 'Show ICS events',
                    description: 'Display events from ICS subscriptions by default'
                }
            },
            timeSettings: {
                header: 'Time Settings',
                description: 'Configure time-related display settings for timeline views.',
                timeSlotDuration: {
                    name: 'Time slot duration',
                    description: 'Duration of each time slot in timeline views',
                    options: {
                        fifteenMinutes: '15 minutes',
                        thirtyMinutes: '30 minutes',
                        sixtyMinutes: '60 minutes'
                    }
                },
                startTime: {
                    name: 'Start time',
                    description: 'Earliest time shown in timeline views (HH:MM format)',
                    placeholder: '06:00'
                },
                endTime: {
                    name: 'End time',
                    description: 'Latest time shown in timeline views (HH:MM format)',
                    placeholder: '22:00'
                },
                initialScrollTime: {
                    name: 'Initial scroll time',
                    description: 'Time to scroll to when opening timeline views (HH:MM format)',
                    placeholder: '09:00'
                },
                eventMinHeight: {
                    name: 'Event minimum height',
                    description: 'Minimum height for events in timeline views (pixels)',
                    placeholder: '15'
                }
            },
            uiElements: {
                header: 'UI Elements',
                description: 'Configure the display of various UI elements.',
                showTrackedTasksInStatusBar: {
                    name: 'Show tracked tasks in status bar',
                    description: 'Display currently tracked tasks in Obsidian\'s status bar'
                },
                showProjectSubtasksWidget: {
                    name: 'Show project subtasks widget',
                    description: 'Display a widget showing subtasks for the current project note'
                },
                projectSubtasksPosition: {
                    name: 'Project subtasks position',
                    description: 'Where to position the project subtasks widget',
                    options: {
                        top: 'Top of note',
                        bottom: 'Bottom of note'
                    }
                },
                showExpandableSubtasks: {
                    name: 'Show expandable subtasks',
                    description: 'Allow expanding/collapsing subtask sections in task cards'
                },
                subtaskChevronPosition: {
                    name: 'Subtask chevron position',
                    description: 'Position of expand/collapse chevrons in task cards',
                    options: {
                        left: 'Left side',
                        right: 'Right side'
                    }
                },
                viewsButtonAlignment: {
                    name: 'Views button alignment',
                    description: 'Alignment of the views/filters button in the task interface',
                    options: {
                        left: 'Left side',
                        right: 'Right side'
                    }
                }
            },
            projectAutosuggest: {
                header: 'Project Autosuggest',
                description: 'Customize how project suggestions display during task creation.',
                requiredTags: {
                    name: 'Required tags',
                    description: 'Show only notes with any of these tags (comma-separated). Leave empty to show all notes.',
                    placeholder: 'project, active, important'
                },
                includeFolders: {
                    name: 'Include folders',
                    description: 'Show only notes in these folders (comma-separated paths). Leave empty to show all folders.',
                    placeholder: 'Projects/, Work/Active, Personal'
                },
                requiredPropertyKey: {
                    name: 'Required property key',
                    description: 'Show only notes where this frontmatter property matches the value below. Leave empty to ignore.',
                    placeholder: 'type'
                },
                requiredPropertyValue: {
                    name: 'Required property value',
                    description: 'Only notes where the property equals this value are suggested. Leave empty to require the property to exist.',
                    placeholder: 'project'
                },
                customizeDisplay: {
                    name: 'Customize suggestion display',
                    description: 'Show advanced options to configure how project suggestions appear and what information they display.'
                },
                enableFuzzyMatching: {
                    name: 'Enable fuzzy matching',
                    description: 'Allow typos and partial matches in project search. May be slower in large vaults.'
                },
                displayRowsHelp: 'Configure up to 3 lines of information to show for each project suggestion.',
                displayRows: {
                    row1: {
                        name: 'Row 1',
                        description: 'Format: {property|flags}. Properties: title, aliases, file.path, file.parent. Flags: n(Label) shows label, s makes searchable. Example: {title|n(Title)|s}',
                        placeholder: '{title|n(Title)}'
                    },
                    row2: {
                        name: 'Row 2 (optional)',
                        description: 'Common patterns: {aliases|n(Aliases)}, {file.parent|n(Folder)}, literal:Custom Text',
                        placeholder: '{aliases|n(Aliases)}'
                    },
                    row3: {
                        name: 'Row 3 (optional)',
                        description: 'Additional info like {file.path|n(Path)} or custom frontmatter fields',
                        placeholder: '{file.path|n(Path)}'
                    }
                },
                quickReference: {
                    header: 'Quick Reference',
                    properties: 'Available properties: title, aliases, file.path, file.parent, or any frontmatter field',
                    labels: 'Add labels: {title|n(Title)} → "Title: My Project"',
                    searchable: 'Make searchable: {description|s} includes description in + search',
                    staticText: 'Static text: literal:My Custom Label',
                    alwaysSearchable: 'Filename, title, and aliases are always searchable by default.'
                }
            },
            dataStorage: {
                name: 'Storage Location',
                description: 'Where to store Pomodoro session history',
                pluginData: 'Plugin data (recommended)',
                dailyNotes: 'Daily Notes',
                notices: {
                    locationChanged: 'Pomodoro storage location changed to {location}'
                }
            },
            notifications: {
                description: 'Configure task reminder notifications and alerts.'
            },
            performance: {
                description: 'Configure plugin performance and behavioral options.'
            },
            timeTrackingSection: {
                description: 'Configure automatic time tracking behaviors.'
            },
            recurringSection: {
                description: 'Configure behavior for recurring task management.'
            },
            timeblocking: {
                description: 'Configure timeblock functionality for lightweight scheduling in daily notes.',
                usage: 'Usage: In the advanced calendar view, hold Shift + drag to create timeblocks. Drag to move existing timeblocks. Resize edges to adjust duration.'
            }
        },
        integrations: {
            basesIntegration: {
                header: 'Bases integration',
                description: 'Configure integration with the Obsidian Bases plugin. This is an experimental feature, and currently relies on undocumented Obsidian APIs. Behaviour may change or break.',
                enable: {
                    name: 'Enable Bases integration',
                    description: 'Enable TaskNotes views to be used within Obsidian Bases plugin. Bases plugin must be enabled for this to work.'
                },
                notices: {
                    enabled: 'Bases integration enabled. Please restart Obsidian to complete the setup.',
                    disabled: 'Bases integration disabled. Please restart Obsidian to complete the removal.'
                }
            },
            calendarSubscriptions: {
                header: 'Calendar subscriptions',
                description: 'Subscribe to external calendars via ICS/iCal URLs to view events alongside your tasks.',
                defaultNoteTemplate: {
                    name: 'Default note template',
                    description: 'Path to template file for notes created from ICS events',
                    placeholder: 'Templates/Event Template.md'
                },
                defaultNoteFolder: {
                    name: 'Default note folder',
                    description: 'Folder for notes created from ICS events',
                    placeholder: 'Calendar/Events'
                },
                filenameFormat: {
                    name: 'ICS note filename format',
                    description: 'How filenames are generated for notes created from ICS events',
                    options: {
                        title: 'Event title',
                        zettel: 'Zettelkasten format',
                        timestamp: 'Timestamp',
                        custom: 'Custom template'
                    }
                },
                customTemplate: {
                    name: 'Custom ICS filename template',
                    description: 'Template for custom ICS event filenames',
                    placeholder: '{date}-{title}'
                }
            },
            subscriptionsList: {
                header: 'Calendar subscriptions list',
                addSubscription: {
                    name: 'Add Calendar Subscription',
                    description: 'Add a new calendar subscription from ICS/iCal URL or local file',
                    buttonText: 'Add Subscription'
                },
                refreshAll: {
                    name: 'Refresh all subscriptions',
                    description: 'Manually refresh all enabled calendar subscriptions',
                    buttonText: 'Refresh All'
                },
                newCalendarName: 'New Calendar',
                emptyState: 'No calendar subscriptions configured. Add a subscription to sync external calendars.',
                notices: {
                    addSuccess: 'New calendar subscription added - please configure the details',
                    addFailure: 'Failed to add subscription',
                    serviceUnavailable: 'ICS subscription service not available',
                    refreshSuccess: 'All calendar subscriptions refreshed successfully',
                    refreshFailure: 'Failed to refresh some calendar subscriptions',
                    updateFailure: 'Failed to update subscription',
                    deleteSuccess: 'Deleted subscription "{name}"',
                    deleteFailure: 'Failed to delete subscription',
                    enableFirst: 'Enable the subscription first',
                    refreshSubscriptionSuccess: 'Refreshed "{name}"',
                    refreshSubscriptionFailure: 'Failed to refresh subscription'
                },
                labels: {
                    enabled: 'Enabled:',
                    name: 'Name:',
                    type: 'Type:',
                    url: 'URL:',
                    filePath: 'File Path:',
                    color: 'Color:',
                    refreshMinutes: 'Refresh (min):'
                },
                typeOptions: {
                    remote: 'Remote URL',
                    local: 'Local File'
                },
                placeholders: {
                    calendarName: 'Calendar name',
                    url: 'ICS/iCal URL',
                    filePath: 'Local file path (e.g., Calendar.ics)',
                    localFile: 'Calendar.ics'
                },
                statusLabels: {
                    enabled: 'Enabled',
                    disabled: 'Disabled',
                    remote: 'Remote',
                    localFile: 'Local File',
                    remoteCalendar: 'Remote Calendar',
                    localFileCalendar: 'Local File',
                    synced: 'Synced {timeAgo}',
                    error: 'Error'
                },
                actions: {
                    refreshNow: 'Refresh Now',
                    deleteSubscription: 'Delete subscription'
                },
                confirmDelete: {
                    title: 'Delete Subscription',
                    message: 'Are you sure you want to delete the subscription "{name}"? This action cannot be undone.',
                    confirmText: 'Delete'
                }
            },
            autoExport: {
                header: 'Automatic ICS export',
                description: 'Automatically export all your tasks to an ICS file.',
                enable: {
                    name: 'Enable automatic export',
                    description: 'Automatically keep an ICS file updated with all your tasks'
                },
                filePath: {
                    name: 'Export file path',
                    description: 'Path where the ICS file will be saved (relative to vault root)',
                    placeholder: 'tasknotes-calendar.ics'
                },
                interval: {
                    name: 'Update interval (between 5 and 1440 minutes)',
                    description: 'How often to update the export file',
                    placeholder: '60'
                },
                exportNow: {
                    name: 'Export now',
                    description: 'Manually trigger an immediate export',
                    buttonText: 'Export Now'
                },
                status: {
                    title: 'Export Status:',
                    lastExport: 'Last export: {time}',
                    nextExport: 'Next export: {time}',
                    noExports: 'No exports yet',
                    notScheduled: 'Not scheduled',
                    notInitialized: 'Auto export service not initialized - please restart Obsidian'
                },
                notices: {
                    reloadRequired: 'Please reload Obsidian for the automatic export changes to take effect.',
                    exportSuccess: 'Tasks exported successfully',
                    exportFailure: 'Export failed - check console for details',
                    serviceUnavailable: 'Auto export service not available'
                }
            },
            httpApi: {
                header: 'HTTP API',
                description: 'Enable HTTP API for external integrations and automations.',
                enable: {
                    name: 'Enable HTTP API',
                    description: 'Start local HTTP server for API access'
                },
                port: {
                    name: 'API port',
                    description: 'Port number for the HTTP API server',
                    placeholder: '3000'
                },
                authToken: {
                    name: 'API authentication token',
                    description: 'Token required for API authentication (leave empty for no auth)',
                    placeholder: 'your-secret-token'
                },
                endpoints: {
                    header: 'Available API Endpoints',
                    expandIcon: '▶',
                    collapseIcon: '▼'
                }
            },
            webhooks: {
                header: 'Webhooks',
                description: {
                    overview: 'Webhooks send real-time notifications to external services when TaskNotes events occur.',
                    usage: 'Configure webhooks to integrate with automation tools, sync services, or custom applications.'
                },
                addWebhook: {
                    name: 'Add Webhook',
                    description: 'Register a new webhook endpoint',
                    buttonText: 'Add Webhook'
                },
                emptyState: {
                    message: 'No webhooks configured. Add a webhook to receive real-time notifications.',
                    buttonText: 'Add Webhook'
                },
                labels: {
                    active: 'Active:',
                    url: 'URL:',
                    events: 'Events:',
                    transform: 'Transform:'
                },
                placeholders: {
                    url: 'Webhook URL',
                    noEventsSelected: 'No events selected',
                    rawPayload: 'Raw payload (no transform)'
                },
                statusLabels: {
                    active: 'Active',
                    inactive: 'Inactive',
                    created: 'Created {timeAgo}'
                },
                actions: {
                    editEvents: 'Edit Events',
                    delete: 'Delete'
                },
                notices: {
                    urlUpdated: 'Webhook URL updated',
                    enabled: 'Webhook enabled',
                    disabled: 'Webhook disabled',
                    created: 'Webhook created successfully',
                    deleted: 'Webhook deleted',
                    updated: 'Webhook updated'
                },
                confirmDelete: {
                    title: 'Delete Webhook',
                    message: 'Are you sure you want to delete this webhook?\n\nURL: {url}\n\nThis action cannot be undone.',
                    confirmText: 'Delete'
                },
                cardHeader: 'Webhook',
                cardFields: {
                    active: 'Active:',
                    url: 'URL:',
                    events: 'Events:',
                    transform: 'Transform:'
                },
                eventsDisplay: {
                    noEvents: 'No events selected'
                },
                transformDisplay: {
                    noTransform: 'Raw payload (no transform)'
                },
                secretModal: {
                    title: 'Webhook Secret Generated',
                    description: 'Your webhook secret has been generated. Save this secret as you won\'t be able to view it again:',
                    usage: 'Use this secret to verify webhook payloads in your receiving application.',
                    gotIt: 'Got it'
                },
                editModal: {
                    title: 'Edit Webhook',
                    eventsHeader: 'Events to subscribe to'
                },
                events: {
                    taskCreated: {
                        label: 'Task Created',
                        description: 'When new tasks are created'
                    },
                    taskUpdated: {
                        label: 'Task Updated',
                        description: 'When tasks are modified'
                    },
                    taskCompleted: {
                        label: 'Task Completed',
                        description: 'When tasks are marked complete'
                    },
                    taskDeleted: {
                        label: 'Task Deleted',
                        description: 'When tasks are deleted'
                    },
                    taskArchived: {
                        label: 'Task Archived',
                        description: 'When tasks are archived'
                    },
                    taskUnarchived: {
                        label: 'Task Unarchived',
                        description: 'When tasks are unarchived'
                    },
                    timeStarted: {
                        label: 'Time Started',
                        description: 'When time tracking starts'
                    },
                    timeStopped: {
                        label: 'Time Stopped',
                        description: 'When time tracking stops'
                    },
                    pomodoroStarted: {
                        label: 'Pomodoro Started',
                        description: 'When pomodoro sessions begin'
                    },
                    pomodoroCompleted: {
                        label: 'Pomodoro Completed',
                        description: 'When pomodoro sessions finish'
                    },
                    pomodoroInterrupted: {
                        label: 'Pomodoro Interrupted',
                        description: 'When pomodoro sessions are stopped'
                    },
                    recurringCompleted: {
                        label: 'Recurring Instance Completed',
                        description: 'When recurring task instances complete'
                    },
                    reminderTriggered: {
                        label: 'Reminder Triggered',
                        description: 'When task reminders activate'
                    }
                },
                modals: {
                    secretGenerated: {
                        title: 'Webhook Secret Generated',
                        description: 'Your webhook secret has been generated. Save this secret as you won\'t be able to view it again:',
                        usage: 'Use this secret to verify webhook payloads in your receiving application.',
                        buttonText: 'Got it'
                    },
                    edit: {
                        title: 'Edit Webhook',
                        eventsSection: 'Events to subscribe to',
                        transformSection: 'Transform Configuration (Optional)',
                        headersSection: 'Headers Configuration',
                        transformFile: {
                            name: 'Transform File',
                            description: 'Path to a .js or .json file in your vault that transforms webhook payloads',
                            placeholder: 'discord-transform.js'
                        },
                        customHeaders: {
                            name: 'Include custom headers',
                            description: 'Include TaskNotes headers (event type, signature, delivery ID). Turn off for Discord, Slack, and other services with strict CORS policies.'
                        },
                        buttons: {
                            cancel: 'Cancel',
                            save: 'Save Changes'
                        },
                        notices: {
                            selectAtLeastOneEvent: 'Please select at least one event'
                        }
                    },
                    add: {
                        title: 'Add Webhook',
                        eventsSection: 'Events to subscribe to',
                        transformSection: 'Transform Configuration (Optional)',
                        headersSection: 'Headers Configuration',
                        url: {
                            name: 'Webhook URL',
                            description: 'The endpoint where webhook payloads will be sent',
                            placeholder: 'https://your-service.com/webhook'
                        },
                        transformFile: {
                            name: 'Transform File',
                            description: 'Path to a .js or .json file in your vault that transforms webhook payloads',
                            placeholder: 'discord-transform.js'
                        },
                        customHeaders: {
                            name: 'Include custom headers',
                            description: 'Include TaskNotes headers (event type, signature, delivery ID). Turn off for Discord, Slack, and other services with strict CORS policies.'
                        },
                        transformHelp: {
                            title: 'Transform files allow you to customize webhook payloads:',
                            jsFiles: '.js files:',
                            jsDescription: ' Custom JavaScript transforms',
                            jsonFiles: '.json files:',
                            jsonDescription: ' Templates with ',
                            jsonVariable: '${data.task.title}',
                            leaveEmpty: 'Leave empty:',
                            leaveEmptyDescription: ' Send raw data',
                            example: 'Example:',
                            exampleFile: 'discord-transform.js'
                        },
                        buttons: {
                            cancel: 'Cancel',
                            add: 'Add Webhook'
                        },
                        notices: {
                            urlRequired: 'Webhook URL is required',
                            selectAtLeastOneEvent: 'Please select at least one event'
                        }
                    }
                }
            },
            otherIntegrations: {
                header: 'Other plugin integrations',
                description: 'Configure integrations with other Obsidian plugins.'
            },
            timeFormats: {
                justNow: 'Just now',
                minutesAgo: '{minutes} minute{plural} ago',
                hoursAgo: '{hours} hour{plural} ago',
                daysAgo: '{days} day{plural} ago'
            }
        }
    },
    notices: {
        languageChanged: 'Language changed to {language}.',
        exportTasksFailed: 'Failed to export tasks as ICS file'
    },
    commands: {
        openCalendarView: 'Open mini calendar view',
        openAdvancedCalendarView: 'Open advanced calendar view',
        openTasksView: 'Open tasks view',
        openNotesView: 'Open notes view',
        openAgendaView: 'Open agenda view',
        openPomodoroView: 'Open pomodoro timer',
        openKanbanView: 'Open kanban board',
        openPomodoroStats: 'Open pomodoro statistics',
        openStatisticsView: 'Open task & project statistics',
        createNewTask: 'Create new task',
        convertToTaskNote: 'Convert task to TaskNote',
        convertAllTasksInNote: 'Convert all tasks in note',
        insertTaskNoteLink: 'Insert tasknote link',
        createInlineTask: 'Create new inline task',
        quickActionsCurrentTask: 'Quick actions for current task',
        goToTodayNote: "Go to today's note",
        startPomodoro: 'Start pomodoro timer',
        stopPomodoro: 'Stop pomodoro timer',
        pauseResumePomodoro: 'Pause/resume pomodoro timer',
        refreshCache: 'Refresh cache',
        exportAllTasksIcs: 'Export all tasks as ICS file'
    },
    modals: {
        task: {
            titlePlaceholder: 'What needs to be done?',
            titleLabel: 'Title',
            titleDetailedPlaceholder: 'Task title...',
            detailsLabel: 'Details',
            detailsPlaceholder: 'Add more details...',
            projectsLabel: 'Projects',
            projectsAdd: 'Add Project',
            projectsTooltip: 'Select a project note using fuzzy search',
            projectsRemoveTooltip: 'Remove project',
            contextsLabel: 'Contexts',
            contextsPlaceholder: 'context1, context2',
            tagsLabel: 'Tags',
            tagsPlaceholder: 'tag1, tag2',
            timeEstimateLabel: 'Time estimate (minutes)',
            timeEstimatePlaceholder: '30',
            customFieldsLabel: 'Custom Fields',
            actions: {
                due: 'Set due date',
                scheduled: 'Set scheduled date',
                status: 'Set status',
                priority: 'Set priority',
                recurrence: 'Set recurrence',
                reminders: 'Set reminders'
            },
            buttons: {
                openNote: 'Open note',
                save: 'Save'
            },
            tooltips: {
                dueValue: 'Due: {value}',
                scheduledValue: 'Scheduled: {value}',
                statusValue: 'Status: {value}',
                priorityValue: 'Priority: {value}',
                recurrenceValue: 'Recurrence: {value}',
                remindersSingle: '1 reminder set',
                remindersPlural: '{count} reminders set'
            },
            dateMenu: {
                dueTitle: 'Set Due Date',
                scheduledTitle: 'Set Scheduled Date'
            },
            userFields: {
                textPlaceholder: 'Enter {field}...',
                numberPlaceholder: '0',
                datePlaceholder: 'YYYY-MM-DD',
                listPlaceholder: 'item1, item2, item3',
                pickDate: 'Pick {field} date'
            },
            recurrence: {
                daily: 'Daily',
                weekly: 'Weekly',
                everyTwoWeeks: 'Every 2 weeks',
                weekdays: 'Weekdays',
                weeklyOn: 'Weekly on {days}',
                monthly: 'Monthly',
                everyThreeMonths: 'Every 3 months',
                monthlyOnOrdinal: 'Monthly on the {ordinal}',
                monthlyByWeekday: 'Monthly (by weekday)',
                yearly: 'Yearly',
                yearlyOn: 'Yearly on {month} {day}',
                custom: 'Custom',
                countSuffix: '{count} times',
                untilSuffix: 'until {date}',
                ordinal: '{number}{suffix}'
            }
        },
        taskCreation: {
            title: 'Create task',
            actions: {
                fillFromNaturalLanguage: 'Fill form from natural language',
                hideDetailedOptions: 'Hide detailed options',
                showDetailedOptions: 'Show detailed options'
            },
            nlPlaceholder: 'Buy groceries tomorrow at 3pm @home #errands\n\nAdd details here...',
            notices: {
                titleRequired: 'Please enter a task title',
                success: 'Task "{title}" created successfully',
                successShortened: 'Task "{title}" created successfully (filename shortened due to length)',
                failure: 'Failed to create task: {message}'
            }
        },
        taskEdit: {
            title: 'Edit task',
            sections: {
                completions: 'Completions',
                taskInfo: 'Task Information'
            },
            metadata: {
                totalTrackedTime: 'Total tracked time:',
                created: 'Created:',
                modified: 'Modified:',
                file: 'File:'
            },
            buttons: {
                archive: 'Archive',
                unarchive: 'Unarchive'
            },
            notices: {
                titleRequired: 'Please enter a task title',
                noChanges: 'No changes to save',
                updateSuccess: 'Task "{title}" updated successfully',
                updateFailure: 'Failed to update task: {message}',
                fileMissing: 'Could not find task file: {path}',
                openNoteFailure: 'Failed to open task note',
                archiveSuccess: 'Task {action} successfully',
                archiveFailure: 'Failed to archive task'
            },
            archiveAction: {
                archived: 'archived',
                unarchived: 'unarchived'
            }
        },
        storageLocation: {
            title: {
                migrate: 'Migrate pomodoro data?',
                switch: 'Switch to daily notes storage?'
            },
            message: {
                migrate: 'This will migrate your existing pomodoro session data to daily notes frontmatter. The data will be grouped by date and stored in each daily note.',
                switch: 'Pomodoro session data will be stored in daily notes frontmatter instead of the plugin data file.'
            },
            whatThisMeans: 'What this means:',
            bullets: {
                dailyNotesRequired: 'Daily Notes core plugin must remain enabled',
                storedInNotes: 'Data will be stored in your daily notes frontmatter',
                migrateData: 'Existing plugin data will be migrated and then cleared',
                futureSessions: 'Future sessions will be saved to daily notes',
                dataLongevity: 'This provides better data longevity with your notes'
            },
            finalNote: {
                migrate: '⚠️ Make sure you have backups if needed. This change cannot be automatically undone.',
                switch: 'You can switch back to plugin storage at any time in the future.'
            },
            buttons: {
                migrate: 'Migrate data',
                switch: 'Switch storage'
            }
        },
        dueDate: {
            title: 'Set Due Date',
            taskLabel: 'Task: {title}',
            sections: {
                dateTime: 'Due Date & Time',
                quickOptions: 'Quick Options'
            },
            descriptions: {
                dateTime: 'Set when this task should be completed'
            },
            inputs: {
                date: {
                    ariaLabel: 'Due date for task',
                    placeholder: 'YYYY-MM-DD'
                },
                time: {
                    ariaLabel: 'Due time for task (optional)',
                    placeholder: 'HH:MM'
                }
            },
            quickOptions: {
                today: 'Today',
                todayAriaLabel: 'Set due date to today',
                tomorrow: 'Tomorrow',
                tomorrowAriaLabel: 'Set due date to tomorrow',
                nextWeek: 'Next week',
                nextWeekAriaLabel: 'Set due date to next week',
                now: 'Now',
                nowAriaLabel: 'Set due date and time to now',
                clear: 'Clear',
                clearAriaLabel: 'Clear due date'
            },
            errors: {
                invalidDateTime: 'Please enter a valid date and time format',
                updateFailed: 'Failed to update due date. Please try again.'
            }
        },
        scheduledDate: {
            title: 'Set Scheduled Date',
            taskLabel: 'Task: {title}',
            sections: {
                dateTime: 'Scheduled Date & Time',
                quickOptions: 'Quick Options'
            },
            descriptions: {
                dateTime: 'Set when you plan to work on this task'
            },
            inputs: {
                date: {
                    ariaLabel: 'Scheduled date for task',
                    placeholder: 'YYYY-MM-DD'
                },
                time: {
                    ariaLabel: 'Scheduled time for task (optional)',
                    placeholder: 'HH:MM'
                }
            },
            quickOptions: {
                today: 'Today',
                todayAriaLabel: 'Set scheduled date to today',
                tomorrow: 'Tomorrow',
                tomorrowAriaLabel: 'Set scheduled date to tomorrow',
                nextWeek: 'Next week',
                nextWeekAriaLabel: 'Set scheduled date to next week',
                now: 'Now',
                nowAriaLabel: 'Set scheduled date and time to now',
                clear: 'Clear',
                clearAriaLabel: 'Clear scheduled date'
            },
            errors: {
                invalidDateTime: 'Please enter a valid date and time format',
                updateFailed: 'Failed to update scheduled date. Please try again.'
            }
        }
    },
    contextMenus: {
        task: {
            status: 'Status',
            statusSelected: '✓ {label}',
            priority: 'Priority',
            prioritySelected: '✓ {label}',
            dueDate: 'Due date',
            scheduledDate: 'Scheduled date',
            reminders: 'Reminders',
            remindBeforeDue: 'Remind before due…',
            remindBeforeScheduled: 'Remind before scheduled…',
            manageReminders: 'Manage all reminders…',
            clearReminders: 'Clear all reminders',
            startTimeTracking: 'Start time tracking',
            stopTimeTracking: 'Stop time tracking',
            archive: 'Archive',
            unarchive: 'Unarchive',
            openNote: 'Open note',
            copyTitle: 'Copy task title',
            noteActions: 'Note actions',
            rename: 'Rename',
            renameTitle: 'Rename File',
            renamePlaceholder: 'Enter new name',
            delete: 'Delete',
            deleteTitle: 'Delete File',
            deleteMessage: 'Are you sure you want to delete "{name}"?',
            deleteConfirm: 'Delete',
            copyPath: 'Copy path',
            copyUrl: 'Copy Obsidian URL',
            showInExplorer: 'Show in file explorer',
            addToCalendar: 'Add to calendar',
            calendar: {
                google: 'Google Calendar',
                outlook: 'Outlook Calendar',
                yahoo: 'Yahoo Calendar',
                downloadIcs: 'Download .ics file'
            },
            recurrence: 'Recurrence',
            clearRecurrence: 'Clear recurrence',
            customRecurrence: 'Custom recurrence...',
            createSubtask: 'Create subtask',
            subtasks: {
                loading: 'Loading subtasks...',
                noSubtasks: 'No subtasks found',
                loadFailed: 'Failed to load subtasks'
            },
            markComplete: 'Mark complete for this date',
            markIncomplete: 'Mark incomplete for this date',
            quickReminders: {
                atTime: 'At time of event',
                fiveMinutes: '5 minutes before',
                fifteenMinutes: '15 minutes before',
                oneHour: '1 hour before',
                oneDay: '1 day before'
            },
            notices: {
                toggleCompletionFailure: 'Failed to toggle recurring task completion: {message}',
                updateDueDateFailure: 'Failed to update task due date: {message}',
                updateScheduledFailure: 'Failed to update task scheduled date: {message}',
                updateRemindersFailure: 'Failed to update reminders',
                clearRemindersFailure: 'Failed to clear reminders',
                addReminderFailure: 'Failed to add reminder',
                archiveFailure: 'Failed to toggle task archive: {message}',
                copyTitleSuccess: 'Task title copied to clipboard',
                copyFailure: 'Failed to copy to clipboard',
                renameSuccess: 'Renamed to "{name}"',
                renameFailure: 'Failed to rename file',
                copyPathSuccess: 'File path copied to clipboard',
                copyUrlSuccess: 'Obsidian URL copied to clipboard',
                updateRecurrenceFailure: 'Failed to update task recurrence: {message}'
            }
        },
        ics: {
            showDetails: 'Show details',
            createTask: 'Create task from event',
            createNote: 'Create note from event',
            linkNote: 'Link existing note',
            copyTitle: 'Copy title',
            copyLocation: 'Copy location',
            copyUrl: 'Copy URL',
            copyMarkdown: 'Copy as markdown',
            subscriptionUnknown: 'Unknown calendar',
            notices: {
                copyTitleSuccess: 'Event title copied to clipboard',
                copyLocationSuccess: 'Location copied to clipboard',
                copyUrlSuccess: 'Event URL copied to clipboard',
                copyMarkdownSuccess: 'Event details copied as markdown',
                copyFailure: 'Failed to copy to clipboard',
                taskCreated: 'Task created: {title}',
                taskCreateFailure: 'Failed to create task from event',
                noteCreated: 'Note created successfully',
                creationFailure: 'Failed to open creation modal',
                linkSuccess: 'Linked note "{name}" to event',
                linkFailure: 'Failed to link note',
                linkSelectionFailure: 'Failed to open note selection'
            },
            markdown: {
                titleFallback: 'Untitled Event',
                calendar: '**Calendar:** {value}',
                date: '**Date & Time:** {value}',
                location: '**Location:** {value}',
                descriptionHeading: '### Description',
                url: '**URL:** {value}',
                at: ' at {time}'
            }
        },
        date: {
            increment: {
                plusOneDay: '+1 day',
                minusOneDay: '-1 day',
                plusOneWeek: '+1 week',
                minusOneWeek: '-1 week'
            },
            basic: {
                today: 'Today',
                tomorrow: 'Tomorrow',
                thisWeekend: 'This weekend',
                nextWeek: 'Next week',
                nextMonth: 'Next month'
            },
            weekdaysLabel: 'Weekdays',
            selected: '✓ {label}',
            pickDateTime: 'Pick date & time…',
            clearDate: 'Clear date',
            modal: {
                title: 'Set date & time',
                dateLabel: 'Date',
                timeLabel: 'Time (optional)',
                select: 'Select'
            }
        }
    },
    services: {
        pomodoro: {
            notices: {
                alreadyRunning: 'A pomodoro is already running',
                resumeCurrentSession: 'Resume the current session instead of starting a new one',
                timerAlreadyRunning: 'A timer is already running',
                resumeSessionInstead: 'Resume the current session instead of starting a new one',
                shortBreakStarted: 'Short break started',
                longBreakStarted: 'Long break started',
                paused: 'Pomodoro paused',
                resumed: 'Pomodoro resumed',
                stoppedAndReset: 'Pomodoro stopped and reset',
                migrationSuccess: 'Successfully migrated {count} pomodoro sessions to daily notes.',
                migrationFailure: 'Failed to migrate pomodoro data. Please try again or check the console for details.'
            }
        },
        icsSubscription: {
            notices: {
                calendarNotFound: 'Calendar "{name}" not found (404). Please check the ICS URL is correct and the calendar is publicly accessible.',
                calendarAccessDenied: 'Calendar "{name}" access denied (500). This may be due to Microsoft Outlook server restrictions. Try regenerating the ICS URL from your calendar settings.',
                fetchRemoteFailed: 'Failed to fetch remote calendar "{name}": {error}',
                readLocalFailed: 'Failed to read local calendar "{name}": {error}'
            }
        },
        calendarExport: {
            notices: {
                generateLinkFailed: 'Failed to generate calendar link',
                noTasksToExport: 'No tasks found to export',
                downloadSuccess: 'Downloaded {filename} with {count} task{plural}',
                downloadFailed: 'Failed to download calendar file',
                singleDownloadSuccess: 'Downloaded {filename}'
            }
        },
        filter: {
            groupLabels: {
                noProject: 'No project',
                noTags: 'No tags',
                invalidDate: 'Invalid date',
                due: {
                    overdue: 'Overdue',
                    today: 'Today',
                    tomorrow: 'Tomorrow',
                    nextSevenDays: 'Next seven days',
                    later: 'Later',
                    none: 'No due date'
                },
                scheduled: {
                    past: 'Past scheduled',
                    today: 'Today',
                    tomorrow: 'Tomorrow',
                    nextSevenDays: 'Next seven days',
                    later: 'Later',
                    none: 'No scheduled date'
                }
            },
            errors: {
                noDatesProvided: 'No dates provided'
            },
            folders: {
                root: '(Root)'
            }
        },
        instantTaskConvert: {
            notices: {
                noCheckboxTasks: 'No checkbox tasks found in the current note.',
                convertingTasks: 'Converting {count} task{plural}...',
                conversionSuccess: '✅ Successfully converted {count} task{plural} to TaskNotes!',
                partialConversion: 'Converted {successCount} task{successPlural}. {failureCount} failed.',
                batchConversionFailed: 'Failed to perform batch conversion. Please try again.',
                invalidParameters: 'Invalid input parameters.',
                emptyLine: 'Current line is empty or contains no valid content.',
                parseError: 'Error parsing task: {error}',
                invalidTaskData: 'Invalid task data.',
                replaceLineFailed: 'Failed to replace task line.',
                conversionComplete: 'Task converted: {title}',
                conversionCompleteShortened: 'Task converted: "{title}" (filename shortened due to length)',
                fileExists: 'A file with this name already exists. Please try again or rename the task.',
                conversionFailed: 'Failed to convert task. Please try again.'
            }
        },
        icsNote: {
            notices: {
                templateNotFound: 'Template not found: {path}',
                templateProcessError: 'Error processing template: {template}',
                linkedToEvent: 'Linked note to ICS event: {title}'
            }
        },
        task: {
            notices: {
                templateNotFound: 'Task body template not found: {path}',
                templateReadError: 'Error reading task body template: {template}',
                moveTaskFailed: 'Failed to move {operation} task: {error}'
            }
        },
        autoExport: {
            notices: {
                exportFailed: 'TaskNotes auto export failed: {error}'
            }
        },
        notification: {
            notices: {
                // NotificationService uses Notice for in-app notifications
                // but the message comes from the reminder content, so no hardcoded strings to translate
            }
        }
    },
    ui: {
        icsCard: {
            untitledEvent: 'Untitled event',
            allDay: 'All day',
            calendarEvent: 'Calendar event',
            calendarFallback: 'Calendar'
        },
        noteCard: {
            createdLabel: 'Created:',
            dailyBadge: 'Daily',
            dailyTooltip: 'Daily note'
        },
        filterHeading: {
            allViewName: 'All'
        },
        filterBar: {
            saveView: 'Save view',
            saveViewNamePlaceholder: 'Enter view name...',
            saveButton: 'Save',
            views: 'Views',
            savedFilterViews: 'Saved filter views',
            filters: 'Filters',
            properties: 'Properties',
            sort: 'Sort',
            newTask: 'New',
            expandAllGroups: 'Expand All Groups',
            collapseAllGroups: 'Collapse All Groups',
            searchTasksPlaceholder: 'Search tasks...',
            searchTasksTooltip: 'Search task titles',
            filterUnavailable: 'Filter bar temporarily unavailable',
            toggleFilter: 'Toggle filter',
            activeFiltersTooltip: 'Active filters – Click to modify, right-click to clear',
            configureVisibleProperties: 'Configure visible properties',
            sortAndGroupOptions: 'Sort and group options',
            sortMenuHeader: 'Sort',
            orderMenuHeader: 'Order',
            groupMenuHeader: 'Group',
            createNewTask: 'Create new task',
            filter: 'Filter',
            displayOrganization: 'Display & Organization',
            viewOptions: 'View Options',
            addFilter: 'Add filter',
            addFilterGroup: 'Add filter group',
            addFilterTooltip: 'Add a new filter condition',
            addFilterGroupTooltip: 'Add a nested filter group',
            clearAllFilters: 'Clear all filters and groups',
            saveCurrentFilter: 'Save current filter as view',
            closeFilterModal: 'Close filter modal',
            deleteFilterGroup: 'Delete filter group',
            deleteCondition: 'Delete condition',
            all: 'All',
            any: 'Any',
            followingAreTrue: 'of the following are true:',
            where: 'where',
            selectProperty: 'Select...',
            chooseProperty: 'Choose which task property to filter by',
            chooseOperator: 'Choose how to compare the property value',
            enterValue: 'Enter the value to filter by',
            selectValue: 'Select a {property} to filter by',
            sortBy: 'Sort by:',
            toggleSortDirection: 'Toggle sort direction',
            chooseSortMethod: 'Choose how to sort tasks',
            groupBy: 'Group by:',
            chooseGroupMethod: 'Group tasks by a common property',
            toggleViewOption: 'Toggle {option}',
            expandCollapseFilters: 'Click to expand/collapse filter conditions',
            expandCollapseSort: 'Click to expand/collapse sorting and grouping options',
            expandCollapseViewOptions: 'Click to expand/collapse view-specific options',
            naturalLanguageDates: 'Natural Language Dates',
            naturalLanguageExamples: 'Show natural language date examples',
            enterNumericValue: 'Enter a numeric value to filter by',
            enterDateValue: 'Enter a date using natural language or ISO format',
            pickDateTime: 'Pick date & time',
            noSavedViews: 'No saved views',
            savedViews: 'Saved views',
            yourSavedFilters: 'Your saved filter configurations',
            dragToReorder: 'Drag to reorder views',
            loadSavedView: 'Load saved view: {name}',
            deleteView: 'Delete view',
            deleteViewTitle: 'Delete View',
            deleteViewMessage: 'Are you sure you want to delete the view "{name}"?',
            manageAllReminders: 'Manage All Reminders...',
            clearAllReminders: 'Clear All Reminders',
            customRecurrence: 'Custom recurrence...',
            clearRecurrence: 'Clear recurrence',
            sortOptions: {
                dueDate: 'Due Date',
                scheduledDate: 'Scheduled Date',
                priority: 'Priority',
                title: 'Title',
                createdDate: 'Created Date',
                tags: 'Tags',
                ascending: 'Ascending',
                descending: 'Descending'
            },
            group: {
                none: 'None',
                status: 'Status',
                priority: 'Priority',
                context: 'Context',
                project: 'Project',
                dueDate: 'Due Date',
                scheduledDate: 'Scheduled Date',
                tags: 'Tags'
            },
            notices: {
                propertiesMenuFailed: 'Failed to show properties menu'
            }
        }
    },
    components: {
        propertyVisibilityDropdown: {
            coreProperties: 'CORE PROPERTIES',
            organization: 'ORGANIZATION',
            customProperties: 'CUSTOM PROPERTIES',
            failed: 'Failed to show properties menu',
            properties: {
                statusDot: 'Status Dot',
                priorityDot: 'Priority Dot',
                dueDate: 'Due Date',
                scheduledDate: 'Scheduled Date',
                timeEstimate: 'Time Estimate',
                totalTrackedTime: 'Total Tracked Time',
                recurrence: 'Recurrence',
                completedDate: 'Completed Date',
                createdDate: 'Created Date',
                modifiedDate: 'Modified Date',
                projects: 'Projects',
                contexts: 'Contexts',
                tags: 'Tags'
            }
        },
        reminderContextMenu: {
            remindBeforeDue: 'Remind before due...',
            remindBeforeScheduled: 'Remind before scheduled...',
            manageAllReminders: 'Manage All Reminders...',
            clearAllReminders: 'Clear All Reminders',
            quickReminders: {
                atTime: 'At time of event',
                fiveMinutesBefore: '5 minutes before',
                fifteenMinutesBefore: '15 minutes before',
                oneHourBefore: '1 hour before',
                oneDayBefore: '1 day before'
            }
        },
        recurrenceContextMenu: {
            daily: 'Daily',
            weeklyOn: 'Weekly on {day}',
            everyTwoWeeksOn: 'Every 2 weeks on {day}',
            monthlyOnThe: 'Monthly on the {ordinal}',
            everyThreeMonthsOnThe: 'Every 3 months on the {ordinal}',
            yearlyOn: 'Yearly on {month} {ordinal}',
            weekdaysOnly: 'Weekdays only',
            customRecurrence: 'Custom recurrence...',
            clearRecurrence: 'Clear recurrence',
            customRecurrenceModal: {
                title: 'Custom Recurrence',
                startDate: 'Start date',
                startDateDesc: 'The date when the recurrence pattern begins',
                startTime: 'Start time',
                startTimeDesc: 'The time when recurring instances should appear (optional)',
                frequency: 'Frequency',
                interval: 'Interval',
                intervalDesc: 'Every X days/weeks/months/years',
                daysOfWeek: 'Days of week',
                daysOfWeekDesc: 'Select specific days (for weekly recurrence)',
                monthlyRecurrence: 'Monthly recurrence',
                monthlyRecurrenceDesc: 'Choose how to repeat monthly',
                yearlyRecurrence: 'Yearly recurrence',
                yearlyRecurrenceDesc: 'Choose how to repeat yearly',
                endCondition: 'End condition',
                endConditionDesc: 'Choose when the recurrence should end',
                neverEnds: 'Never ends',
                endAfterOccurrences: 'End after {count} occurrences',
                endOnDate: 'End on {date}',
                onDayOfMonth: 'On day {day} of each month',
                onTheWeekOfMonth: 'On the {week} {day} of each month',
                onDateOfYear: 'On {month} {day} each year',
                onTheWeekOfYear: 'On the {week} {day} of {month} each year',
                frequencies: {
                    daily: 'Daily',
                    weekly: 'Weekly',
                    monthly: 'Monthly',
                    yearly: 'Yearly'
                },
                weekPositions: {
                    first: 'first',
                    second: 'second',
                    third: 'third',
                    fourth: 'fourth',
                    last: 'last'
                },
                weekdays: {
                    monday: 'Monday',
                    tuesday: 'Tuesday',
                    wednesday: 'Wednesday',
                    thursday: 'Thursday',
                    friday: 'Friday',
                    saturday: 'Saturday',
                    sunday: 'Sunday'
                },
                weekdaysShort: {
                    mon: 'Mon',
                    tue: 'Tue',
                    wed: 'Wed',
                    thu: 'Thu',
                    fri: 'Fri',
                    sat: 'Sat',
                    sun: 'Sun'
                },
                cancel: 'Cancel',
                save: 'Save'
            }
        }
    }
};

export type EnTranslationSchema = typeof en;
