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
            fr: 'French'
        }
    },
    views: {
        agenda: {
            title: 'Agenda'
        },
        taskList: {
            title: 'Tasks'
        },
        notes: {
            title: 'Notes'
        },
        miniCalendar: {
            title: 'Mini Calendar'
        },
        advancedCalendar: {
            title: 'Advanced Calendar'
        },
        kanban: {
            title: 'Kanban'
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
            title: 'Statistics'
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
            }
        }
    },
    notices: {
        languageChanged: 'Language changed to {language}.'
    },
    modals: {
        task: {
            actions: {
                due: 'Set due date',
                scheduled: 'Set scheduled date',
                status: 'Set status',
                priority: 'Set priority',
                recurrence: 'Set recurrence',
                reminders: 'Set reminders'
            }
        },
        taskCreation: {
            title: 'Create task',
            actions: {
                fillFromNaturalLanguage: 'Fill form from natural language',
                hideDetailedOptions: 'Hide detailed options',
                showDetailedOptions: 'Show detailed options'
            },
            notices: {
                titleRequired: 'Please enter a task title',
                success: 'Task "{title}" created successfully',
                successShortened: 'Task "{title}" created successfully (filename shortened due to length)',
                failure: 'Failed to create task: {message}'
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
        }
    }
};

export type EnTranslationSchema = typeof en;
