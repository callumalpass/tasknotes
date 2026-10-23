import { TranslationTree } from "../types";

export const de: TranslationTree = {
	common: {
		saving: "Wird gespeichert…",
		cannotUndo: "Diese Aktion kann nicht rückgängig gemacht werden.",
		untitled: "Ohne Titel",
		configure: "Konfigurieren",

		appName: "TaskNotes",
		new: "Neu",
		cancel: "Abbrechen",
		confirm: "Bestätigen",
		close: "Schließen",
		save: "Speichern",
		reorder: {
			confirmLargeTitle: "Große Neuordnung bestätigen",
			confirmButton: "Notizen neu anordnen",
			confirmLargeMessage:
				'Durch das Neuordnen werden in {count} Notizen die Werte von "{field}" aktualisiert, um eine dauerhafte manuelle Reihenfolge für {scope} zu erstellen. Versteckte oder herausgefilterte Notizen im selben Bereich können ebenfalls aktualisiert werden. Fortfahren?',
		},
		language: "Sprache",
		systemDefault: "Systemstandard",
		loading: "Lädt...",
		languages: {
			en: "Englisch",
			fr: "Französisch",
			ru: "Russisch",
			zh: "Chinesisch",
			de: "Deutsch",
			es: "Spanisch",
			ja: "Japanisch",
			pt: "Portugiesisch (Brasilien)",
			ko: "Koreanisch",
		},
		weekdays: {
			sunday: "Sonntag",
			monday: "Montag",
			tuesday: "Dienstag",
			wednesday: "Mittwoch",
			thursday: "Donnerstag",
			friday: "Freitag",
			saturday: "Samstag",
		},
		months: {
			january: "Januar",
			february: "Februar",
			march: "März",
			april: "April",
			may: "Mai",
			june: "Juni",
			july: "Juli",
			august: "August",
			september: "September",
			october: "Oktober",
			november: "November",
			december: "Dezember",
		},
	},
	views: {
		agenda: {
			title: "Agenda",
			today: "Heute",
			overdue: "Überfällig",
			refreshCalendars: "Kalender aktualisieren",
			actions: {
				previousPeriod: "Vorherige Periode",
				nextPeriod: "Nächste Periode",
				goToToday: "Zu heute gehen",
				refreshCalendars: "Kalenderabonnements aktualisieren",
			},
			loading: "Agenda wird geladen...",
			dayToggle: "Tag umschalten",
			overdueToggle: "Überfälligkeitsbereich umschalten",
			expandAllDays: "Alle Tage ausklappen",
			collapseAllDays: "Alle Tage einklappen",
			notices: {
				calendarNotReady: "Kalenderdienst noch nicht bereit",
				calendarRefreshed: "Kalenderabonnements aktualisiert",
				refreshFailed: "Aktualisierung fehlgeschlagen",
			},
			empty: {
				noItemsScheduled: "Keine Elemente geplant",
				noItemsFound: "Keine Elemente gefunden",
				helpText:
					"Erstellen Sie Aufgaben mit Fälligkeits- oder Planungsdaten oder fügen Sie Notizen hinzu, um sie hier zu sehen.",
			},
			contextMenu: {
				showOverdueSection: "Überfälligkeitsbereich anzeigen",
				showNotes: "Notizen anzeigen",
				calendarSubscriptions: "Kalenderabonnements",
			},
			periods: {
				thisWeek: "Diese Woche",
			},
			tipPrefix: "Tipp: ",
		},
		taskList: {
			title: "Aufgaben",
			expandAllGroups: "Alle Gruppen ausklappen",
			collapseAllGroups: "Alle Gruppen einklappen",
			noTasksFound: "Keine Aufgaben für die gewählten Filter gefunden.",
			movement: {
				parentAdd: "Als Unteraufgabe hinzufügen",
				parentChoose: "Als Unteraufgabe von … hinzufügen",
				parentPreview:
					"Als Unteraufgabe von {parent} hinzufügen. Andere Projekte bleiben unverändert.",
				parentSelf: "Eine Aufgabe kann nicht ihre eigene übergeordnete Aufgabe sein.",
				parentCycle: "Eine Aufgabe kann keinem ihrer Nachkommen untergeordnet werden.",
				parentAlready: "Bereits eine Unteraufgabe von {parent}.",
				parentUnavailable:
					"Beide Aufgaben müssen noch existieren und TaskNotes-Aufgaben sein.",
				parentAssigned: "Als Unteraufgabe von {parent} hinzugefügt.",
				handle: "Aufgabe verschieben",
				moveTo: "In eine Gruppe verschieben",
				keepSubgroup: "Aktuelle Untergruppe beibehalten",
				moveUp: "Nach oben verschieben",
				moveDown: "Nach unten verschieben",
				moved: "Aufgabe verschoben.",
				undo: "Rückgängig",
				undoConflict:
					"Rückgängig nicht möglich: Die Aufgabe wurde nach dem Verschieben geändert.",
				undoFailed: "Das Verschieben konnte nicht rückgängig gemacht werden.",
				noValue: "Kein Wert",
				otherDestinations: "Weitere Ziele",
				readOnly:
					"Änderung nicht möglich ({properties}): Diese Gruppen sind schreibgeschützt.",
				unresolved:
					"Werte für {properties} können für dieses Ziel nicht ermittelt werden.",
				noChange: "Bereits in dieser Gruppe.",
				failed: "Die Aufgabe konnte nicht verschoben werden. Prüfen Sie die Aufgabe und versuchen Sie es erneut.",
			},
			reorder: {
				scope: {
					ungrouped: "diese ungegliederte Liste",
					group: 'die Gruppe "{group}"',
				},
			},
			errors: {
				formulaGroupingReadOnly:
					"Aufgaben in formelbasierten Gruppen können nicht neu angeordnet werden. Formelwerte werden berechnet und können nicht direkt geändert werden.",
			},
		},
		notes: {
			title: "Notizen",
			refreshButton: "Aktualisieren",
			refreshingButton: "Wird aktualisiert...",
			notices: {
				indexingDisabled: "Notizindexierung deaktiviert",
			},
			empty: {
				noNotesFound: "Keine Notizen gefunden",
				helpText:
					"Keine Notizen für das gewählte Datum gefunden. Versuchen Sie, ein anderes Datum in der Mini-Kalenderansicht auszuwählen oder erstellen Sie einige Notizen.",
			},
			loading: "Notizen werden geladen...",
			refreshButtonAriaLabel: "Notizenliste aktualisieren",
		},
		miniCalendar: {
			title: "Mini-Kalender",
			contextMenu: {
				openDailyNote: "Tägliche Notiz öffnen",
				openWeeklyNote: "Wöchentliche Notiz öffnen",
			},
		},
		advancedCalendar: {
			title: "Kalender",
			filters: {
				showFilters: "Filter anzeigen",
				hideFilters: "Filter ausblenden",
			},
			viewOptions: {
				calendarSubscriptions: "Kalenderabonnements",
				timeEntries: "Zeiteinträge",
				timeblocks: "Zeitblöcke",
				scheduledDates: "Geplante Termine",
				dueDates: "Fälligkeitstermine",
				allDaySlot: "Ganztägiger Slot",
				scheduledTasks: "Geplante Aufgaben",
				recurringTasks: "Wiederkehrende Aufgaben",
			},
			buttons: {
				refresh: "Aktualisieren",
				refreshHint: "Kalenderabonnements aktualisieren",
			},
			notices: {
				icsServiceNotAvailable: "ICS-Abonnementdienst nicht verfügbar",
				calendarRefreshedAll: "Alle Kalenderabonnements wurden erfolgreich aktualisiert",
				refreshFailed: "Einige Kalenderabonnements konnten nicht aktualisiert werden",
				timeblockSpecificTime:
					"Zeitblöcke müssen spezifische Zeiten haben. Bitte wählen Sie einen Zeitbereich in der Wochen- oder Tagesansicht.",
				timeblockMoved: 'Zeitblock "{title}" wurde nach {date} verschoben',
				timeblockUpdated: 'Zeit des Zeitblocks "{title}" aktualisiert',
				timeblockMoveFailed: "Fehler beim Verschieben des Zeitblocks: {message}",
				timeblockResized: 'Dauer des Zeitblocks "{title}" aktualisiert',
				timeblockResizeFailed: "Fehler beim Ändern der Zeitblockgröße: {message}",
				taskScheduled: 'Aufgabe "{title}" für {date} geplant',
				scheduleTaskFailed: "Fehler beim Planen der Aufgabe",
				endTimeAfterStart: "Endzeit muss nach der Startzeit liegen",
				timeEntryNotFound: "Zeiteintrag nicht gefunden",
				timeEntryDeleted: "Zeiteintrag gelöscht",
				deleteTimeEntryFailed: "Fehler beim Löschen des Zeiteintrags",
			},
			timeEntry: {
				estimatedSuffix: "geschätzt",
				trackedSuffix: "erfasst",
				recurringPrefix: "Wiederkehrend: ",
				completedPrefix: "Abgeschlossen: ",
				createdPrefix: "Erstellt: ",
				modifiedPrefix: "Geändert: ",
				duePrefix: "Fällig: ",
				scheduledPrefix: "Geplant: ",
			},
			contextMenus: {
				openTask: "Aufgabe öffnen",
				deleteTimeEntry: "Zeiteintrag löschen",
				deleteTimeEntryTitle: "Zeiteintrag löschen",
				deleteTimeEntryConfirm:
					"Möchten Sie diesen Zeiteintrag{duration} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
				deleteButton: "Löschen",
				cancelButton: "Abbrechen",
			},
		},
		basesCalendar: {
			title: "Bases-Kalender",
			today: "Heute",
			buttonText: {
				month: "M",
				week: "W",
				day: "T",
				year: "J",
				list: "L",
				customDays: "{count}T",
				listDays: "{count}d Liste",
				refresh: "Aktualisieren",
			},
			hints: {
				refresh: "Kalenderabonnements aktualisieren",
				today: "Zu heute gehen",
				prev: "Zurück",
				next: "Weiter",
				month: "Monatsansicht",
				week: "Wochenansicht",
				day: "Tagesansicht",
				year: "Jahresansicht",
				list: "Listenansicht",
				customDays: "{count}-Tage-Ansicht",
			},
			settings: {
				groups: {
					dateNavigation: "Datumsnavigation",
					events: "Ereignisse",
					layout: "Layout",
					view: "Ansicht",
					display: "Anzeige",
					timeGrid: "Zeitgitter",
					eventLayout: "Ereignislayout",
					propertyBasedEvents: "Eigenschaftsbasierte Ereignisse",
					calendarSubscriptions: "Kalenderabonnements",
					googleCalendars: "Google-Kalender",
					microsoftCalendars: "Microsoft-Kalender",
				},
				dateNavigation: {
					navigateToDate: "Zum Datum navigieren",
					navigateToDatePlaceholder:
						"JJJJ-MM-TT (z.B. 2025-01-15) - leer lassen, um Eigenschaft zu verwenden",
					navigateToDateFromProperty: "Zum Datum aus Eigenschaft navigieren",
					navigateToDateFromPropertyPlaceholder: "Datumseigenschaft auswählen (optional)",
					propertyNavigationStrategy: "Eigenschaftsnavigationsstrategie",
					createDailyNotesFromDateLinks: "Tägliche Notizen über Datumslinks erstellen",
					strategies: {
						first: "Erstes Ergebnis",
						earliest: "Frühestes Datum",
						latest: "Spätestes Datum",
					},
				},
				events: {
					showScheduledTasks: "Geplante Aufgaben anzeigen",
					showDueTasks: "Fällige Aufgaben anzeigen",
					showOverdueOnToday: "Überfällige Aufgaben heute anzeigen",
					showRecurringTasks: "Wiederkehrende Aufgaben anzeigen",
					showTimeEntries: "Zeiteinträge anzeigen",
					showTimeblocks: "Zeitblöcke anzeigen",
					showPropertyBasedEvents: "Eigenschaftsbasierte Ereignisse anzeigen",
					showCompletedRecurringInstances:
						"Abgeschlossene wiederkehrende Instanzen anzeigen",
					showSkippedRecurringInstances:
						"Übersprungene wiederkehrende Instanzen anzeigen",
				},
				layout: {
					calendarView: "Kalenderansicht",
					customDayCount: "Benutzerdefinierte Tagesanzahl",
					listDayCount: "Anzahl der Listentage",
					dayStartTime: "Tagesbeginn",
					dayStartTimePlaceholder: "HH:mm:ss (z.B. 08:00:00)",
					dayEndTime: "Tagesende",
					dayEndTimePlaceholder: "HH:mm:ss (z.B. 20:00:00)",
					timeSlotDuration: "Zeitschlitzdauer",
					timeSlotDurationPlaceholder: "HH:mm:ss (z.B. 00:30:00)",
					dragDropResolution: "Auflösung für Ziehen/Ablegen",
					dragDropResolutionPlaceholder: "HH:mm:ss (z.B. 00:05:00)",
					weekStartsOn: "Woche beginnt am",
					showWeekNumbers: "Wochennummern anzeigen",
					showNowIndicator: "Jetzt-Indikator anzeigen",
					showWeekends: "Wochenenden anzeigen",
					showAllDaySlot: "Ganztägigen Slot anzeigen",
					showTimeGrid: "Stundenraster anzeigen",
					showTodayHighlight: "Heute hervorheben",
					todayColumnWidthMultiplier: "Multiplikator der heutigen Spaltenbreite",
					showSelectionPreview: "Auswahlvorschau anzeigen",
					timeFormat: "Zeitformat",
					timeFormat12: "12-Stunden (AM/PM)",
					timeFormat24: "24-Stunden",
					initialScrollTime: "Anfangsscrollzeit",
					initialScrollTimePlaceholder: "HH:mm:ss (z.B. 08:00:00)",
					minimumEventHeight: "Minimale Ereignishöhe (px)",
					slotEventOverlap: "Ereignisüberlappung zulassen",
					enableSearch: "Suchfeld aktivieren",
					eventMaxStack:
						"Max. gestapelte Ereignisse (Wochen-/Tagesansicht, 0 = unbegrenzt)",
					dayMaxEvents: "Max. Ereignisse pro Tag (0 = automatisch)",
					dayMaxEventRows: "Max. Ereigniszeilen pro Tag (0 = unbegrenzt)",
					spanScheduledToDue: "Aufgaben vom Planungs- bis zum Fälligkeitsdatum anzeigen",
					heightMode: "Höhenmodus",
					heightModeFill: "Container füllen",
					heightModeAuto: "Automatische Höhe",
				},
				propertyBasedEvents: {
					startDateProperty: "Startdatumseigenschaft",
					startDatePropertyPlaceholder: "Eigenschaft für Startdatum/-zeit auswählen",
					endDateProperty: "Enddatumseigenschaft (optional)",
					endDatePropertyPlaceholder: "Eigenschaft für Enddatum/-zeit auswählen",
					titleProperty: "Titeleigenschaft (optional)",
					titlePropertyPlaceholder: "Eigenschaft für Ereignistitel auswählen",
				},
			},
			notices: {
				noDailyNoteForDate: "Für dieses Datum ist keine tägliche Notiz vorhanden.",
			},
			errors: {
				failedToInitialize: "Fehler beim Initialisieren des Kalenders",
			},
		},
		kanban: {
			title: "Kanban",
			newTask: "Neue Aufgabe",
			addCard: "+ Karte hinzufügen",
			noTasks: "Keine Aufgaben",
			uncategorized: "Nicht kategorisiert",
			noProject: "Kein Projekt",
			reorder: {
				scope: {
					column: 'die Spalte "{group}"',
					columnInSwimlane: 'die Spalte "{group}" in der Swimlane "{swimlane}"',
				},
			},
			notices: {
				loadFailed: "Kanban-Board konnte nicht geladen werden",
				movedTask: "Aufgabe nach „{0}“ verschoben",
			},
			errors: {
				loadingBoard: "Fehler beim Laden des Boards.",
				noGroupBy:
					"Die Kanban-Ansicht erfordert eine konfigurierte 'Gruppieren nach'-Eigenschaft. Klicken Sie auf die Schaltfläche 'Sortieren' und wählen Sie eine Eigenschaft unter 'Gruppieren nach' aus.",
				formulaGroupingReadOnly:
					"Aufgaben können nicht zwischen formelbasierten Spalten verschoben werden. Formelwerte werden berechnet und können nicht direkt geändert werden.",
				formulaSwimlaneReadOnly:
					"Aufgaben können nicht zwischen formelbasierten Swimlanes verschoben werden. Formelwerte werden berechnet und können nicht direkt geändert werden.",
			},
			columnTitle: "Ohne Titel",
		},
		pomodoro: {
			title: "Pomodoro",
			status: {
				focus: "Fokus",
				ready: "Bereit zum Starten",
				paused: "Pausiert",
				working: "Arbeitsphase",
				shortBreak: "Kurze Pause",
				longBreak: "Lange Pause",
				breakPrompt: "Gut gemacht! Zeit für eine {length} Pause",
				breakLength: {
					short: "kurze",
					long: "lange",
				},
				breakComplete: "Pause beendet! Bereit für den nächsten Pomodoro?",
			},
			buttons: {
				start: "Starten",
				pause: "Pausieren",
				stop: "Stoppen",
				resume: "Fortsetzen",
				startShortBreak: "Kurze Pause starten",
				startLongBreak: "Lange Pause starten",
				skipBreak: "Pause überspringen",
				chooseTask: "Aufgabe wählen...",
				changeTask: "Aufgabe wechseln...",
				clearTask: "Aufgabe entfernen",
				selectDifferentTask: "Andere Aufgabe wählen",
				startFocus: "Fokus starten",
				addMinute: "Eine Minute hinzufügen",
				subtractMinute: "Eine Minute abziehen",
			},
			notices: {
				noTasks: "Keine nicht archivierten Aufgaben gefunden. Erstellen Sie zuerst eine Aufgabe.",
				loadFailed: "Aufgaben konnten nicht geladen werden",
				invalidDuration: "Geben Sie eine Dauer wie 10, 10:30 oder 1:30:00 ein.",
			},
			statsLabel: "heute abgeschlossen",
			meta: {
				ready: "{time} geplant · {count} heute abgeschlossen",
				running: "{time} verbleibend · Endet um {endTime}",
				paused: "{type} pausiert · {time} verbleibend",
				breakReady: "{type} bereit · {time} geplant",
			},
			timer: {
				editLabel: "Timerdauer bearbeiten",
				inputLabel: "Timerdauer",
			},
		},
		pomodoroStats: {
			title: "Pomodoro-Statistiken",
			heading: "Pomodoro-Statistiken",
			refresh: "Aktualisieren",
			sections: {
				overview: "Überblick",
				today: "Heute",
				week: "Diese Woche",
				allTime: "Gesamt",
				recent: "Aktuelle Sitzungen",
			},
			overviewCards: {
				todayPomos: {
					label: "Heutige Pomos",
					change: {
						more: "{count} mehr als gestern",
						less: "{count} weniger als gestern",
					},
				},
				totalPomos: {
					label: "Pomos insgesamt",
				},
				todayFocus: {
					label: "Heutiger Fokus",
					change: {
						more: "{duration} mehr als gestern",
						less: "{duration} weniger als gestern",
					},
				},
				totalFocus: {
					label: "Fokuszeit insgesamt",
				},
			},
			stats: {
				pomodoros: "Pomodoros",
				streak: "Serie",
				minutes: "Minuten",
				average: "Durchschn. Länge",
				completion: "Abschluss",
			},
			recents: {
				empty: "Noch keine Sitzungen aufgezeichnet",
				duration: "{minutes} Min",
				status: {
					completed: "Abgeschlossen",
					interrupted: "Unterbrochen",
				},
				delete: "Sitzung löschen",
				deleteAria: "Pomodoro-Sitzung löschen",
				deleteConfirmTitle: "Pomodoro-Sitzung löschen?",
				deleteConfirmMessage:
					"Dadurch wird die Sitzung aus dem Pomodoro-Verlauf entfernt. Vorhandene Zeiteinträge von Aufgaben werden nicht geändert.",
				deleteConfirmButton: "Löschen",
				deleteSuccess: "Pomodoro-Sitzung gelöscht",
				deleteNotFound: "Pomodoro-Sitzung wurde nicht gefunden",
			},
			basesMigration: {
				title: "Möchten Sie eine Base-Ansicht verwenden?",
				description:
					"Pomodoro-Base-Ansichten verwenden das Frontmatter täglicher Notizen. Um den Verlauf in der generierten Pomodoro-Statistik-Base anzuzeigen, migrieren Sie die Pomodoro-Daten in den Einstellungen und stellen Sie anschließend die Speicherung auf tägliche Notizen um.",
			},
		},
		stats: {
			project: {
				totalTime: "Gesamtzeit",
				totalTasks: "Aufgaben gesamt",
				average: "Durchschnitt pro Aufgabe",
				activity: "Aktivität im Zeitverlauf (letzte 30 Tage)",
				allTasks: "Alle Projektaufgaben",
				noTracking: "Keine Zeiterfassungsdaten",
			},

			title: "Statistiken",
			taskProjectStats: "Aufgaben- & Projektstatistiken",
			sections: {
				filters: "Filter",
				overview: "Überblick",
				today: "Heute",
				thisWeek: "Diese Woche",
				thisMonth: "Dieser Monat",
				projectBreakdown: "Projektaufschlüsselung",
				dateRange: "Datumsbereich",
			},
			filters: {
				minTime: "Min. Zeit (Minuten)",
				allTasks: "Alle Aufgaben",
				activeOnly: "Nur aktive",
				completedOnly: "Nur abgeschlossene",
			},
			refreshButton: "Aktualisieren",
			timeRanges: {
				allTime: "Gesamt",
				last7Days: "Letzte 7 Tage",
				last30Days: "Letzte 30 Tage",
				last90Days: "Letzte 90 Tage",
				customRange: "Benutzerdefinierter Bereich",
			},
			resetFiltersButton: "Filter zurücksetzen",
			dateRangeFrom: "Von",
			dateRangeTo: "Bis",
			noProject: "Kein Projekt",
			cards: {
				timeTrackedEstimated: "Zeit erfasst / geschätzt",
				totalTasks: "Aufgaben gesamt",
				completionRate: "Abschlussrate",
				activeProjects: "Aktive Projekte",
				avgTimePerTask: "Ø Zeit pro Aufgabe",
			},
			labels: {
				tasks: "Aufgaben",
				completed: "Abgeschlossen",
				projects: "Projekte",
			},
			noProjectData: "Keine Projektdaten verfügbar",
			notAvailable: "k. A.",
			noTasks: "Keine Aufgaben gefunden",
			loading: "Lädt...",
		},
		releaseNotes: {
			current: "Aktuell",

			title: "Was ist neu in TaskNotes {version}",
			header: "Was ist neu in TaskNotes {version}",
			viewAllLink: "Alle Versionshinweise auf GitHub anzeigen →",
			starMessage:
				"Wir freuen uns sehr über jedes Feedback. Wenn sich etwas nicht richtig anfühlt, lassen Sie es uns bitte auf GitHub wissen. Wenn Sie TaskNotes nützlich finden, geben Sie ihm bitte einen Stern.",
			baseFilesNotice:
				"> [!info] Hinweis zu den standardmäßigen `.base`-Dateien\n> Änderungen an standardmäßig generierten `.base`-Vorlagen überschreiben Ihre vorhandenen `.base`-Dateien nicht, damit Ihre Anpassungen erhalten bleiben.\n> Wenn Sie die neuesten Vorlagenverbesserungen möchten, erstellen Sie die Base-Dateien neu unter **Einstellungen → TaskNotes → Allgemein → Ansichten & Base-Dateien → Dateien aktualisieren**.",
		},
	},
	settings: {
		header: {
			documentation: "Dokumentation",
			documentationUrl: "https://tasknotes.dev",
		},
		tabs: {
			general: "Allgemein",
			taskProperties: "Aufgabeneigenschaften",
			modalFields: "Modalfelder",
			defaults: "Voreinstellungen & Vorlagen",
			appearance: "Erscheinungsbild & UI",
			features: "Funktionen",
			integrations: "Integrationen",
		},
		modalFields: {
			header: "Feldkonfiguration des Aufgaben-Modals",
			description:
				"Konfigurieren Sie, welche Felder in den Modalen zur Aufgabenerstellung und -bearbeitung angezeigt werden. Ziehen Sie Felder, um sie innerhalb jeder Gruppe neu anzuordnen.",
			splitLayout: {
				name: "Geteiltes Layout auf breiten Bildschirmen",
				description:
					"Wenn aktiviert, erscheint der Detail-Editor auf Bildschirmen mit 900 px oder mehr in einer rechten Spalte. Wenn deaktiviert, verwendet das Modal ein gestapeltes Layout.",
			},
			tabMovesFocus: {
				name: "Tabulator bewegt den Fokus im Detail-Editor",
				description:
					"Wenn aktiviert, bewegt Tab den Fokus vom Detail-Editor zum nächsten Modalfeld und Umschalt+Tab zum vorherigen Feld. Wenn deaktiviert, verwenden Tab und Umschalt+Tab das Einrückungsverhalten des Markdown-Editors.",
			},
			sync: {
				name: "Benutzerfelder synchronisieren",
				description:
					"Klicken Sie, um benutzerdefinierte Felder aus den Aufgabeneigenschaften-Einstellungen in diese Konfiguration zu synchronisieren.",
				button: "Benutzerfelder synchronisieren",
				notice: "Benutzerfelder wurden mit der Modalkonfiguration synchronisiert",
			},
			reset: {
				name: "Auf Standardwerte zurücksetzen",
				description:
					"Setzt alle Feldkonfigurationen auf ihre Standardwerte zurück. Dadurch werden alle benutzerdefinierten Konfigurationen entfernt.",
				button: "Auf Standardwerte zurücksetzen",
				confirmTitle: "Felderkonfiguration zurücksetzen",
				confirmMessage:
					"Möchten Sie die Feldkonfiguration wirklich auf die Standardwerte zurücksetzen? Dadurch werden alle benutzerdefinierten Feldkonfigurationen entfernt.",
				confirmText: "Zurücksetzen",
				cancelText: "Abbrechen",
				notice: "Feldkonfiguration auf Standardwerte zurückgesetzt",
			},
			initError: "Fehler: Feldkonfiguration konnte nicht initialisiert werden",
			manager: {
				invalidConfig:
					"Fehler: Ungültige Feldkonfiguration. Bitte auf Standardwerte zurücksetzen.",
				emptyGroup: "Keine Felder in dieser Gruppe",
				enabled: "Aktiviert:",
				showInCreation: "Bei der Erstellung anzeigen:",
				showInEdit: "Bei der Bearbeitung anzeigen:",
				group: "Gruppe:",
				fieldId: "ID: {id}",
				fieldKey: "Schlüssel: {key}",
				noKey: "Kein Schlüssel festgelegt",
				fieldTypes: {
					core: "Kern",
					user: "Benutzerdefiniert",
					dependency: "Abhängigkeit",
					organization: "Organisation",
				},
			},
		},
		features: {
			inlineTasks: {
				cardProperties: "Eigenschaften der Inline-Aufgabenkarten",
				cardPropertiesDesc: "Wählen Sie die Eigenschaften für Inline-Aufgabenkarten aus.",
				cardPropertiesUpdated: "Inline-Aufgabenkarteneigenschaften aktualisiert",

				header: "Inline-Aufgaben",
				description:
					"Einstellungen für Aufgabenlinks und Checkbox-zu-Aufgabe-Konvertierung in Notizen.",
			},
			taskCreation: {
				header: "Aufgabenerstellung",
				description: "Konfigurieren Sie, was nach dem Erstellen von Aufgaben passiert.",
				openAfterCreate: {
					name: "Aufgabe nach Erstellung öffnen",
					description:
						"Wählen Sie, ob der normale Dialog 'Neue Aufgabe erstellen' die neue Aufgabennotiz nach dem Speichern öffnet.",
					options: {
						none: "Nicht öffnen",
						sameTab: "Im selben Tab öffnen",
						newTab: "In einem neuen Tab öffnen",
					},
				},
			},
			overlays: {
				taskLinkToggle: {
					name: "Aufgabenlink-Overlay",
					description: "Zeigen Sie interaktive Overlays beim Hovern über Aufgabenlinks",
				},
				aliasExclusion: {
					name: "Overlay für Alias-Links deaktivieren",
					description:
						"Das Aufgaben-Widget nicht anzeigen, wenn der Link einen Alias enthält (z.B. [[Aufgabe|Alias]]).",
				},
			},
			instantConvert: {
				toggle: {
					name: "Konvertierungs-Button neben Checkboxen anzeigen",
					description:
						"Zeigen Sie einen Inline-Button neben Markdown-Checkboxen an, der diese in TaskNotes konvertiert",
				},
				preserveCheckbox: {
					name: "Checkbox beim Konvertieren beibehalten",
					description:
						"Den ursprünglichen Markdown-Checkbox-Marker beibehalten, wenn eine Checkbox in einen TaskNote-Link konvertiert wird",
				},
				folder: {
					name: "Ordner für inline erstellte Aufgaben",
					description:
						"Ordner, in dem Aufgaben aus Inline-Befehlen oder Checkbox-Konvertierungen erstellt werden. Leer lassen, um den Standard-Aufgabenordner zu verwenden. Verwenden Sie {{currentNotePath}} für den Ordner der aktuellen Notiz oder {{currentNoteTitle}} für einen Unterordner mit dem Namen der aktuellen Notiz.",
				},
			},
			nlp: {
				header: "Natürliche Sprachverarbeitung",
				description:
					"Analysiere Daten, Prioritäten und andere Eigenschaften aus Texteingaben.",
				enable: {
					name: "Natürliche Spracheingabe für Aufgaben aktivieren",
					description:
						"Fälligkeitsdaten, Prioritäten und Kontexte beim Erstellen von Aufgaben aus natürlicher Sprache erkennen",
				},
				defaultToScheduled: {
					name: "Standardmäßig geplant",
					description:
						"Ein von NLP ohne weiteren Kontext erkanntes Datum als Planungs- statt als Fälligkeitsdatum behandeln",
				},
				enterToSubmit: {
					name: "Enter speichert Aufgabe",
					description:
						"Im Eingabefeld für natürliche Sprache speichert Enter die Aufgabe. Umschalt+Enter fügt einen Zeilenumbruch ein, und Strg/Cmd+Enter speichert weiterhin.",
				},
				language: {
					name: "NLP-Sprache",
					description:
						"Sprache für natürliche Sprachverarbeitungsmuster und Datumsanalyse",
				},
				statusTrigger: {
					name: "Auslöser für Statusvorschläge",
					description:
						"Text zum Auslösen von Status-Vorschlägen (leer lassen zum Deaktivieren)",
				},
			},
			pomodoro: {
				header: "Pomodoro-Timer",
				description: "Konfigurieren Sie Arbeits-/Pausenintervalle für den Pomodoro-Timer.",
				workDuration: {
					name: "Arbeitsdauer",
					description: "Dauer der Arbeitsintervalle in Minuten",
				},
				shortBreak: {
					name: "Kurze Pause",
					description: "Dauer der kurzen Pausen in Minuten",
				},
				longBreak: {
					name: "Lange Pause",
					description: "Dauer der langen Pausen in Minuten",
				},
				longBreakInterval: {
					name: "Intervall für lange Pausen",
					description: "Anzahl der Arbeitssitzungen vor einer langen Pause",
				},
				autoStartBreaks: {
					name: "Pausen automatisch starten",
					description: "Pausentimer nach Arbeitssitzungen automatisch starten",
				},
				autoStartWork: {
					name: "Arbeit automatisch starten",
					description: "Arbeitssitzungen nach Pausen automatisch starten",
				},
				notifications: {
					name: "Pomodoro-Benachrichtigungen",
					description: "Benachrichtigungen anzeigen, wenn Pomodoro-Sitzungen enden",
				},
				mobileSidebar: {
					name: "Mobile Seitenleiste",
					description: "Wo der Pomodoro-Timer auf mobilen Geräten geöffnet werden soll",
					tab: "Notiz-Panel",
					left: "Linke Seitenleiste",
					right: "Rechte Seitenleiste",
				},
				statusBar: {
					name: "Pomodoro in der Statusleiste anzeigen",
					description: "Aktiven Pomodoro-Countdown in der Obsidian-Statusleiste anzeigen",
				},
			},
			uiLanguage: {
				downloadDescription:
					"Weitere Oberflächensprachen werden heruntergeladen und lokal für die Offline-Nutzung zwischengespeichert. Es werden keine Tresorinhalte gesendet.",
				retryDownload: "Sprachdownload erneut versuchen",
				header: "Oberflächensprache",
				description: "Ändern Sie die Sprache der TaskNotes-Menüs, Hinweise und Ansichten.",
				dropdown: {
					name: "UI-Sprache",
					description: "Wählen Sie die Sprache für TaskNotes-Oberflächentexte",
				},
			},
			pomodoroSound: {
				enabledName: "Ton aktiviert",
				enabledDesc: "Ton abspielen, wenn Pomodoro-Sitzungen enden",
				volumeName: "Tonlautstärke",
				volumeDesc: "Lautstärke für Pomodoro-Töne (0-100)",
			},
			dataStorage: {
				name: "Pomodoro-Datenspeicherung",
				description:
					"Konfigurieren Sie, wo Pomodoro-Sitzungsdaten gespeichert und verwaltet werden.",
				dailyNotes: "Tägliche Notizen",
				pluginData: "Plugin-Daten",
				notices: {
					locationChanged: "Pomodoro-Speicherort geändert zu {location}",
				},
			},
			notifications: {
				header: "Benachrichtigungen",
				description: "Konfigurieren Sie Aufgabenerinnerungsbenachrichtigungen und Warnungen.",
				enableName: "Benachrichtigungen aktivieren",
				enableDesc: "Aufgabenerinnerungs-Benachrichtigungen aktivieren",
				typeName: "Benachrichtigungstyp",
				typeDesc: "Art der anzuzeigenden Benachrichtigungen",
				systemLabel: "System-Benachrichtigungen",
				inAppLabel: "In-App-Benachrichtigungen",
				soundEnabledName: "Benachrichtigungston",
				soundEnabledDesc: "Ton abspielen, wenn Aufgabenerinnerungen ausgelöst werden",
				soundVolumeName: "Tonlautstärke",
				soundVolumeDesc: "Lautstärke für Aufgabenerinnerungstöne (0-100)",
				soundPreviewName: "Benachrichtigungston vorhören",
				soundPreviewDesc: "Konfigurierten Aufgabenerinnerungston abspielen",
				soundPreviewButton: "Vorschau",
				testReminderName: "Testerinnerung senden",
				testReminderDesc:
					"Eine Testerinnerung mit dem aktuellen Benachrichtigungstyp und den Toneinstellungen senden.",
				testReminderButton: "Test senden",
			},
			overdue: {
				hideCompletedName: "Abgeschlossene Aufgaben im Bereich „Überfällig“ ausblenden",
				hideCompletedDesc:
					"Abgeschlossene Aufgaben bei der Berechnung überfälliger Aufgaben ausschließen",
			},
			indexing: {
				disableName: "Notizindexierung deaktivieren",
				disableDesc:
					"Automatische Indexierung von Notizinhalten für bessere Leistung deaktivieren",
			},
			suggestions: {
				debounceName: "Vorschlag-Verzögerung",
				debounceDesc: "Verzögerung in Millisekunden vor dem Anzeigen von Vorschlägen",
			},
			timeTracking: {
				autoStopName: "Zeiterfassung automatisch stoppen",
				autoStopDesc:
					"Zeiterfassung automatisch stoppen, wenn eine Aufgabe als abgeschlossen markiert wird",
				stopNotificationName: "Zeiterfassung-Stopp-Benachrichtigung",
				stopNotificationDesc:
					"Benachrichtigung anzeigen, wenn Zeiterfassung automatisch gestoppt wird",
			},
			recurring: {
				maintainOffsetName:
					"Abstand zum Fälligkeitsdatum bei wiederkehrenden Aufgaben beibehalten",
				maintainOffsetDesc:
					"Den Abstand zwischen Fälligkeits- und Planungsdatum beim Abschließen wiederkehrender Aufgaben beibehalten",
				resetCheckboxesName: "Kontrollkästchen bei Wiederholung zurücksetzen",
				resetCheckboxesDesc:
					"Alle Markdown-Kontrollkästchen im Aufgabentext zurücksetzen, wenn eine wiederkehrende Aufgabe abgeschlossen und neu geplant wird",
			},
			timeblocking: {
				attachmentOrder: "Suchreihenfolge der Anhänge",
				nameAsc: "Name (A bis Z)",
				nameDesc: "Name (Z bis A)",
				pathAsc: "Pfad (A bis Z)",
				pathDesc: "Pfad (Z bis A)",
				createdNewest: "Erstellt (neueste zuerst)",
				createdOldest: "Erstellt (älteste zuerst)",
				modifiedNewest: "Geändert (neueste zuerst)",
				modifiedOldest: "Geändert (älteste zuerst)",

				header: "Zeitplanung mit Zeitblöcken",
				description:
					"Konfigurieren Sie Zeitblöcke zur einfachen Planung in täglichen Notizen. Ziehen Sie im Kalender einen Zeitbereich auf und wählen Sie im Kontextmenü „Zeitblock“.",
				enableName: "Zeitblockierung aktivieren",
				enableDesc:
					"Zeitblockfunktionalität für leichte Planung in täglichen Notizen aktivieren. Wenn aktiviert, erscheint die Option 'Zeitblock' im Kalender-Ziehen-Kontextmenü.",
				showBlocksName: "Zeitblöcke anzeigen",
				showBlocksDesc: "Zeitblöcke aus täglichen Notizen standardmäßig anzeigen",
				defaultColorName: "Standard-Zeitblockfarbe",
				defaultColorDesc: "Die Standardfarbe für neue Zeitblöcke",
				usage: "Verwendung: Ziehen Sie im Kalender einen Zeitbereich auf und wählen Sie im Kontextmenü „Zeitblock“ (nur bei aktivierter Zeitplanung mit Zeitblöcken sichtbar). Ziehen Sie bestehende Zeitblöcke zum Verschieben und ändern Sie ihre Dauer an den Rändern.",
			},
			performance: {
				header: "Leistung & Verhalten",
				description: "Konfigurieren Sie Plugin-Leistung und Verhaltensoptionen.",
			},
			timeTrackingSection: {
				header: "Zeiterfassung",
				description: "Konfigurieren Sie automatische Zeiterfassungsverhalten.",
			},
			recurringSection: {
				header: "Wiederkehrende Aufgaben",
				description: "Konfigurieren Sie Verhalten für wiederkehrende Aufgabenverwaltung.",
			},
			debugLogging: {
				header: "Debug-Protokollierung",
				description: "Konfigurieren Sie Debug-Protokollausgaben für die Fehlerbehebung.",
				enableName: "Debug-Protokollierung aktivieren",
				enableDesc:
					"Protokollieren Sie detaillierte Drag-and-Drop- und Ansichtsdiagnosen in der Entwicklerkonsole. Nützlich zur Fehlerbehebung.",
			},
		},
		defaults: {
			header: {
				basicDefaults: "Grundeinstellungen",
				dateDefaults: "Datumsvoreinstellungen",
				defaultReminders: "Standard-Erinnerungen",
				bodyTemplate: "Inhaltsvorlage",
				instantTaskConversion: "Sofortige Aufgabenkonvertierung",
			},
			description: {
				basicDefaults:
					"Setzen Sie Standardwerte für neue Aufgaben, um die Aufgabenerstellung zu beschleunigen.",
				dateDefaults: "Setzen Sie Standard-Fälligkeits- und Planungsdaten für neue Aufgaben.",
				defaultReminders:
					"Konfigurieren Sie Standard-Erinnerungen, die neuen Aufgaben hinzugefügt werden.",
				bodyTemplate: "Konfigurieren Sie eine Vorlagendatei für neue Aufgabeninhalte.",
				instantTaskConversion:
					"Konfigurieren Sie Verhalten bei sofortiger Textkonvertierung zu Aufgaben.",
			},
			basicDefaults: {
				defaultStatus: {
					name: "Standardstatus",
					description: "Standardstatus für neue Aufgaben",
				},
				defaultPriority: {
					name: "Standardpriorität",
					description: "Standardpriorität für neue Aufgaben",
				},
				defaultContexts: {
					name: "Standardkontexte",
					description:
						"Kommagetrennte Liste von Standardkontexten (z.B. @zuhause, @arbeit)",
					placeholder: "@zuhause, @arbeit",
				},
				defaultTags: {
					name: "Standard-Tags",
					description: "Kommagetrennte Liste von Standard-Tags (ohne #)",
					placeholder: "wichtig, dringend",
				},
				defaultProjects: {
					name: "Standardprojekte",
					description: "Standard-Projektlinks für neue Aufgaben",
					selectButton: "Projekte auswählen",
					selectTooltip: "Wählen Sie Projektnotizen zum standardmäßigen Verlinken",
					removeTooltip: "{name} aus Standardprojekten entfernen",
				},
				useParentNoteForTaskCreation: {
					name: "Aktive Notiz als Projekt für neue Aufgaben verwenden",
					description:
						"Verlinkt die aktive Notiz automatisch als Projekt, wenn die Aufgabenerstellung über Befehlspalette oder Ribbon geöffnet wird",
				},
				useParentNoteAsProject: {
					name: "Übergeordnete Notiz als Projekt für Inline- und Sofortkonvertierung verwenden",
					description:
						"Verlinkt die Quellnotiz automatisch als Projekt, wenn Inline-Aufgabenerstellung oder sofortige Aufgabenkonvertierung verwendet wird",
				},
				useParentHeaderAsProject: {
					name: "Übergeordnete Überschrift als Projekt bei sofortiger Konvertierung verwenden",
					description:
						"Die nächstgelegene Überschrift über der konvertierten Zeile bei sofortiger Aufgabenkonvertierung automatisch als Projekt verlinken",
				},
				defaultTimeEstimate: {
					name: "Standard-Zeitschätzung",
					description: "Standard-Zeitschätzung in Minuten (0 = kein Standard)",
					placeholder: "60",
				},
				defaultRecurrence: {
					name: "Standard-Wiederholung",
					description: "Standard-Wiederholungsmuster für neue Aufgaben",
				},
			},
			dateDefaults: {
				defaultDueDate: {
					name: "Standard-Fälligkeitsdatum",
					description: "Standard-Fälligkeitsdatum für neue Aufgaben",
				},
				defaultScheduledDate: {
					name: "Standard-Planungsdatum",
					description: "Standard-Planungsdatum für neue Aufgaben",
				},
			},
			reminders: {
				defaultDescription: "Erinnerung",

				addReminder: {
					name: "Standard-Erinnerung hinzufügen",
					description:
						"Erstellen Sie eine neue Standard-Erinnerung, die allen neuen Aufgaben hinzugefügt wird",
					buttonText: "Erinnerung hinzufügen",
				},
				emptyState:
					"Keine Standard-Erinnerungen konfiguriert. Fügen Sie eine Erinnerung hinzu, um automatisch über neue Aufgaben benachrichtigt zu werden.",
				emptyStateButton: "Erinnerung hinzufügen",
				reminderDescription: "Erinnerungsbeschreibung",
				unnamedReminder: "Unbenannte Erinnerung",
				deleteTooltip: "Erinnerung löschen",
				fields: {
					description: "Beschreibung:",
					type: "Typ:",
					offset: "Offset:",
					unit: "Einheit:",
					direction: "Richtung:",
					relatedTo: "Bezogen auf:",
					date: "Datum:",
					time: "Zeit:",
				},
				types: {
					relative: "Relativ (vor/nach Aufgabendaten)",
					absolute: "Absolut (spezifisches Datum/Zeit)",
				},
				units: {
					minutes: "Minuten",
					hours: "Stunden",
					days: "Tage",
				},
				directions: {
					before: "vor",
					after: "nach",
				},
				relatedTo: {
					due: "Fälligkeitsdatum",
					scheduled: "Planungsdatum",
				},
			},
			bodyTemplate: {
				useBodyTemplate: {
					name: "Inhaltsvorlage verwenden",
					description: "Verwenden Sie eine Vorlagendatei für Aufgabenkörperinhalte",
				},
				bodyTemplateFile: {
					name: "Datei für Inhaltsvorlage",
					description:
						"Pfad zur Vorlagendatei für Aufgabenkörperinhalte. Unterstützt Vorlagenvariablen wie {{title}}, {{date}}, {{time}}, {{priority}}, {{status}}, etc.",
					placeholder: "Templates/Task Template.md",
					ariaLabel: "Pfad zur Datei für die Inhaltsvorlage",
				},
				useOccurrenceBodyTemplate: {
					name: "Vorlage für Vorkommensnotizen verwenden",
					description:
						"Eine separate Fallback-Vorlage für materialisierte Vorkommensnotizen verwenden, wenn die wiederkehrende Aufgabe kein occurrence_template festlegt",
				},
				occurrenceBodyTemplateFile: {
					name: "Vorlagendatei für Vorkommensnotizen",
					description:
						"Pfad zur Vorlagendatei für materialisierte Vorkommensnotizen. Das occurrence_template einer wiederkehrenden Aufgabe hat Vorrang vor diesem Fallback.",
					placeholder: "Templates/Occurrence Template.md",
					ariaLabel: "Pfad zur Vorlagendatei für Vorkommensnotizen",
				},
				variablesHeader: "Vorlagenvariablen:",
				variables: {
					title: "{{title}} - Aufgabentitel",
					details: "{{details}} - Im Dialog eingegebene Details",
					date: "{{date}} - Aktuelles Datum (YYYY-MM-DD)",
					time: "{{time}} - Aktuelle Zeit (HH:MM)",
					priority: "{{priority}} - Aufgabenpriorität",
					status: "{{status}} - Aufgabenstatus",
					contexts: "{{contexts}} - Aufgabenkontexte",
					tags: "{{tags}} - Aufgaben-Tags",
					projects: "{{projects}} - Aufgabenprojekte",
				},
			},
			instantConversion: {
				useDefaultsOnInstantConvert: {
					name: "Aufgabenstandards bei sofortiger Konvertierung verwenden",
					description:
						"Standard-Aufgabeneinstellungen anwenden bei sofortiger Textkonvertierung zu Aufgaben",
				},
			},
			options: {
				noDefault: "Kein Standard",
				none: "Keine",
				today: "Heute",
				tomorrow: "Morgen",
				nextWeek: "Nächste Woche",
				daily: "Täglich",
				weekly: "Wöchentlich",
				monthly: "Monatlich",
				yearly: "Jährlich",
			},
		},
		general: {
			taskStorage: {
				header: "Aufgabenspeicherung",
				description:
					"Konfigurieren Sie, wo Aufgaben gespeichert und wie sie identifiziert werden.",
				defaultFolder: {
					name: "Standard-Aufgabenordner",
					description:
						"Standardort für neue Aufgaben. Unterstützt Ordnervorlagen-Variablen wie {{currentNotePath}}, {{currentNoteTitle}} und {{projectFilePath}} sowie Datums-Tokens im Daily-Notes-Stil wie YYYY/MM/DD.",
				},
				moveArchived: {
					name: "Archivierte Aufgaben in Ordner verschieben",
					description:
						"Archivierte Aufgaben automatisch in einen Archivordner verschieben",
				},
				archiveFolder: {
					name: "Archivordner",
					description:
						"Ordner zum Verschieben von Aufgaben beim Archivieren. Unterstützt Template-Variablen wie {{year}}, {{month}}, {{priority}}, etc.",
				},
			},
			taskIdentification: {
				header: "Aufgabenidentifikation",
				description: "Wählen Sie, wie TaskNotes Notizen als Aufgaben identifiziert.",
				identifyBy: {
					name: "Aufgaben identifizieren durch",
					description:
						"Wählen Sie, ob Aufgaben durch Tag oder durch eine Frontmatter-Eigenschaft identifiziert werden",
					options: {
						tag: "Tag",
						property: "Eigenschaft",
					},
				},
				taskTag: {
					name: "Aufgaben-Tag",
					description:
						"Tag zur Erkennung von Aufgabennotizen (ohne #). Bestehende .base-Ansichtsfilter behalten nach dieser Änderung den alten Tag; aktualisieren Sie die Standard-Base-Dateien oder bearbeiten Sie diese Filter.",
				},
				hideIdentifyingTags: {
					name: "Identifikations-Tags in Aufgabenkarten ausblenden",
					description:
						"Wenn aktiviert, werden Tags, die mit dem Aufgabenidentifikations-Tag übereinstimmen (einschließlich hierarchischer Übereinstimmungen wie 'task/project'), in Aufgabenkartenanzeigen ausgeblendet",
				},
				hideIdentifyingTagsMode: {
					name: "Umfang der ausgeblendeten Tags",
					description:
						"Wählen Sie, ob beim Ausblenden von Identifikations-Tags auch verschachtelte Tags ausgeblendet werden.",
					options: {
						all: "Aufgaben-Tag und verschachtelte Tags",
						exactOnly: "Nur exakter Aufgaben-Tag",
					},
				},
				propertyNamePlaceholder: "Eigenschaftsnamen eingeben",
				propertyValuePlaceholder: "Eigenschaftswert eingeben",
				incompletePropertyWarning:
					"Geben Sie einen Eigenschaftsnamen und einen Wert ein. Beispieltext ist keine gespeicherte Konfiguration. TaskNotes kann Aufgaben erst erkennen, wenn beide festgelegt sind. Bestehende .base-Filter müssen diesen Einstellungen entsprechen.",
				taskProperty: {
					name: "Aufgabeneigenschaftsname",
					description: 'Der Frontmatter-Eigenschaftsname (z.B. "category")',
				},
				taskPropertyValue: {
					name: "Aufgabeneigenschaftswert",
					description: 'Der Wert, der eine Notiz als Aufgabe identifiziert (z.B. "task")',
				},
			},
			folderManagement: {
				header: "Ordnerverwaltung",
				excludedFolders: {
					name: "Ausgeschlossene Ordner",
					description:
						"Kommagetrennte Liste von Ordnern, die von der Aufgabenindizierung und Projektvorschlägen ausgeschlossen werden",
				},
			},
			frontmatter: {
				header: "Frontmatter",
				description:
					"Konfigurieren Sie, wie Links in Frontmatter-Eigenschaften formatiert werden.",
				useMarkdownLinks: {
					name: "Markdown-Links in Frontmatter verwenden",
					description:
						"Markdown-Links ([text](path)) anstelle von Wikilinks ([[link]]) in Frontmatter-Eigenschaften erzeugen.\n\n⚠️ Damit dies funktioniert, ist das Plugin „obsidian-frontmatter-markdown-links“ erforderlich.",
				},
			},
			taskInteraction: {
				header: "Aufgabeninteraktion",
				description: "Konfigurieren Sie, wie das Klicken auf Aufgaben funktioniert.",
				singleClick: {
					name: "Einfachklick-Aktion",
					description: "Aktion beim Einfachklick auf eine Aufgabenkarte",
				},
				doubleClick: {
					name: "Doppelklick-Aktion",
					description: "Aktion beim Doppelklick auf eine Aufgabenkarte",
				},
				actions: {
					edit: "Aufgabe bearbeiten",
					openNote: "Notiz öffnen",
					none: "Keine Aktion",
				},
			},
			releaseNotes: {
				header: "Versionshinweise",
				description: "Aktuelle Version: {version}",
				showOnUpdate: {
					name: "Versionshinweise nach Update anzeigen",
					description:
						"Versionshinweise automatisch öffnen, wenn TaskNotes auf eine neue Version aktualisiert wird",
				},
				checkForUpdates: {
					name: "Beim Start nach neuen Versionen suchen",
					description:
						"Prüft GitHub einmal beim Start von TaskNotes und zeigt einen Hinweis, wenn eine neuere kompatible Version verfügbar ist",
				},
				viewButton: {
					name: "Versionshinweise anzeigen",
					description: "Sehen Sie, was in der neuesten Version von TaskNotes neu ist",
					buttonText: "Versionshinweise anzeigen",
				},
			},
		},
		taskProperties: {
			sections: {
				coreProperties: "Kerneigenschaften",
				corePropertiesDesc:
					"Status und Priorität sind die Kerneigenschaften, die den Zustand und die Wichtigkeit einer Aufgabe definieren.",
				dateProperties: "Datumseigenschaften",
				datePropertiesDesc: "Konfigurieren Sie, wann Aufgaben fällig und geplant sind.",
				organizationProperties: "Organisationseigenschaften",
				organizationPropertiesDesc:
					"Organisiere Aufgaben mit Kontexten, Projekten und Tags.",
				taskDetails: "Aufgabendetails",
				taskDetailsDesc:
					"Zusätzliche Details wie Zeitschätzungen, Wiederholungen und Erinnerungen.",
				metadataProperties: "Metadaten-Eigenschaften",
				metadataPropertiesDesc:
					"Vom System verwaltete Eigenschaften zur Verfolgung der Aufgabenhistorie.",
				featureProperties: "Feature-Eigenschaften",
				featurePropertiesDesc:
					"Eigenschaften, die von bestimmten TaskNotes-Funktionen wie Pomodoro-Timer und Kalender-Synchronisation verwendet werden.",
			},
			propertyCard: {
				propertyKey: "Eigenschaftsschlüssel:",
				default: "Standard:",
				nlpTrigger: "NLP-Auslöser:",
				triggerChar: "Auslöserzeichen:",
				triggerEmpty: "Auslöser darf nicht leer sein",
				triggerTooLong: "Auslöser ist zu lang (max. 10 Zeichen)",
			},
			properties: {
				status: {
					name: "Status",
					description:
						"Verfolgt den aktuellen Zustand einer Aufgabe (z.B. todo, in-bearbeitung, erledigt). Der Status bestimmt, ob eine Aufgabe als abgeschlossen erscheint und kann die automatische Archivierung auslösen.",
				},
				priority: {
					name: "Priorität",
					description:
						"Zeigt die Wichtigkeit der Aufgabe an und dient zum Sortieren und Filtern. In Bases-Ansichten werden Werte alphabetisch sortiert. Verwenden Sie Präfixe wie 1- und 2-, um die Reihenfolge festzulegen.",
				},
				due: {
					name: "Fälligkeitsdatum",
					description:
						"Der Termin, bis zu dem eine Aufgabe abgeschlossen sein muss. Aufgaben nach ihrem Fälligkeitsdatum erscheinen als überfällig. Wird als Datum im Frontmatter gespeichert.",
				},
				scheduled: {
					name: "Planungsdatum",
					description:
						"Der Zeitpunkt, zu dem Sie an der Aufgabe arbeiten möchten. Im Gegensatz zum Fälligkeitsdatum ist dies der geplante Arbeitsbeginn. Aufgaben erscheinen zum geplanten Datum und zur geplanten Uhrzeit im Kalender.",
				},
				contexts: {
					name: "Kontexte",
					description:
						"Orte oder Bedingungen, unter denen eine Aufgabe erledigt werden kann (z. B. @home, @office, @phone). Nützlich, um Aufgaben nach Ihrer aktuellen Situation zu filtern. Wird als Liste gespeichert.",
				},
				projects: {
					name: "Projekte",
					description:
						"Links zu Projektnotizen, denen diese Aufgabe zugeordnet ist. Werden als Wikilinks gespeichert (z. B. [[Project Name]]). Aufgaben können mehreren Projekten zugeordnet sein.",
				},
				tags: {
					name: "Tags",
					description:
						"Native Obsidian-Tags zur Kategorisierung von Aufgaben. Diese werden in der Tags-Frontmatter-Eigenschaft gespeichert und funktionieren mit Obsidians Tag-Funktionen.",
				},
				timeEstimate: {
					name: "Zeitschätzung",
					description:
						"Geschätzte Minuten zur Fertigstellung der Aufgabe. Wird für Zeitplanung und Arbeitsbelastungsplanung verwendet. Wird auf Aufgabenkarten und Kalenderereignissen angezeigt.",
				},
				recurrence: {
					name: "Wiederholung",
					description:
						"Muster für wiederkehrende Aufgaben (täglich, wöchentlich, monatlich, jährlich oder benutzerdefinierte RRULE). Beim Abschließen einer wiederkehrenden Aufgabe wird ihr Planungsdatum auf das nächste Vorkommen gesetzt.",
				},
				recurrenceAnchor: {
					name: "Wiederholungsanker",
					description:
						"Bestimmt, wie das nächste Vorkommen berechnet wird: 'scheduled' verwendet das geplante Datum, 'completion' verwendet das tatsächliche Abschlussdatum.",
				},
				reminders: {
					name: "Erinnerungen",
					description:
						"Benachrichtigungen, die vor Fälligkeits- oder geplanten Terminen ausgelöst werden. Wird als Liste von Erinnerungsobjekten mit Timing und optionaler Beschreibung gespeichert.",
				},
				title: {
					name: "Titel",
					description:
						"Der Aufgabenname. Kann im Frontmatter oder im Dateinamen gespeichert werden (wenn 'Titel im Dateinamen speichern' aktiviert ist).",
				},
				dateCreated: {
					name: "Erstellungsdatum",
					description:
						"Zeitstempel, wann die Aufgabe erstellt wurde. Wird automatisch gesetzt und zum Sortieren nach Erstellungsreihenfolge verwendet.",
				},
				dateModified: {
					name: "Änderungsdatum",
					description:
						"Zeitstempel der letzten Änderung an der Aufgabe. Wird automatisch aktualisiert, wenn sich eine Aufgabeneigenschaft ändert.",
				},
				completedDate: {
					name: "Abschlussdatum",
					description:
						"Zeitstempel, wann die Aufgabe als erledigt markiert wurde. Wird automatisch gesetzt, wenn der Status auf einen abgeschlossenen Zustand wechselt.",
				},
				archiveTag: {
					name: "Archiv-Tag",
					description:
						"Tag, das zu Aufgaben hinzugefügt wird, wenn sie archiviert werden. Wird verwendet, um archivierte Aufgaben zu identifizieren und kann das Verschieben von Dateien in den Archivordner auslösen.",
				},
				timeEntries: {
					name: "Zeiteinträge",
					description:
						"Aufzeichnungen von Zeiterfassungssitzungen für diese Aufgabe. Jeder Eintrag speichert Start- und Endzeitstempel. Wird zur Berechnung der Gesamtzeit verwendet.",
				},
				completeInstances: {
					name: "Abgeschlossene Vorkommen",
					description:
						"Abschlusshistorie für wiederkehrende Aufgaben. Speichert Daten, an denen jede Instanz abgeschlossen wurde, um doppelte Abschlüsse zu verhindern.",
				},
				skippedInstances: {
					name: "Übersprungene Vorkommen",
					description:
						"Übersprungene Vorkommen für wiederkehrende Aufgaben. Speichert Daten von Instanzen, die übersprungen statt abgeschlossen wurden.",
				},
				blockedBy: {
					name: "Blockiert durch",
					description:
						"Links zu Aufgaben, die vor dieser abgeschlossen werden müssen. Wird als Wikilinks gespeichert. Blockierte Aufgaben zeigen einen visuellen Indikator an.",
				},
				sortOrder: {
					name: "Manuelle Reihenfolge",
					description:
						"Die Frontmatter-Eigenschaft für die manuelle Sortierung per Drag-and-Drop. Die Ansicht muss nach dieser Eigenschaft sortiert sein, damit Drag-and-Drop-Reihenfolge funktioniert.",
				},
				pomodoros: {
					name: "Pomodoros",
					description:
						"Anzahl abgeschlossener Pomodoro-Sitzungen. Wenn als Speicherort „Tägliche Notizen“ festgelegt ist, wird dieser Wert dort statt in Aufgabendateien gespeichert.",
				},
				icsEventId: {
					name: "ICS-Ereignis-ID",
					description:
						"Eindeutige Kennung, die eine Notiz mit einem ICS-Kalenderereignis verknüpft. Wird automatisch hinzugefügt, wenn Notizen aus Kalenderereignissen erstellt werden.",
				},
				icsEventTag: {
					name: "ICS-Ereignis-Tag",
					description:
						"Tag zur Identifizierung von Notizen, die aus ICS-Kalenderereignissen erstellt wurden. Wird verwendet, um kalendergenerierte Notizen von regulären Aufgaben zu unterscheiden.",
				},
			},
			statusCard: {
				valuesHeader: "Statuswerte",
			},
			priorityCard: {
				valuesHeader: "Prioritätswerte",
			},
			projectsCard: {
				defaultProjects: "Standardprojekte:",
				useParentNoteForTaskCreation: "Aktive Notiz für neue Aufgaben verwenden:",
				useParentNoteForInlineTasks:
					"Übergeordnete Notiz für Inline-/Sofortkonvertierung verwenden:",
				useParentHeader: "Übergeordnete Überschrift als Projekt verwenden:",
				inheritParentTaskProperties:
					"Eigenschaften der übergeordneten Aufgabe für Unteraufgaben übernehmen:",
				noDefaultProjects: "Keine Standardprojekte ausgewählt",
				autosuggestFilters: "Autovorschlag-Filter",
				customizeDisplay: "Anzeige anpassen",
				filtersOn: "Filter aktiv",
			},
			titleCard: {
				storeTitleInFilename: "Titel im Dateinamen speichern:",
				storedInFilename: "Im Dateinamen gespeichert",
				filenameUpdatesWithTitle:
					"Der Dateiname wird automatisch aktualisiert, wenn sich der Aufgabentitel ändert.",
				filenameFormat: "Dateinamenformat:",
				customTemplate: "Benutzerdefinierte Vorlage:",
				legacySyntaxWarning:
					"Die Syntax mit einfachen geschweiften Klammern wie {title} ist veraltet. Verwenden Sie stattdessen {{title}}, wie bei Inhaltsvorlagen.",
				occurrenceFilenameTemplate: "Dateinamenvorlage für Vorkommen",
				occurrenceFilenameTemplateHelp:
					"Dateinamenvorlage für materialisierte Vorkommen wiederkehrender Aufgaben. Leer lassen, um den bisherigen Namen beizubehalten (Titel der übergeordneten Aufgabe plus Zahlensuffix). Wählen Sie die Granularität ausdrücklich mit {{occurrenceDate}}, {{occurrenceWeek}}, {{occurrenceMonth}}, {{occurrenceYear}} oder {{occurrenceMonthName}}. Alle regulären Dateinamensvariablen funktionieren ebenfalls. Eine übergeordnete Aufgabe kann diese Vorlage über die unten konfigurierte Frontmatter-Eigenschaft überschreiben.",
				occurrenceFilenameProperty: "Override-Eigenschaft für Vorkommensvorlagen",
				occurrenceFilenamePropertyHelp:
					"Name der Frontmatter-Eigenschaft einer wiederkehrenden übergeordneten Aufgabe, die die Dateinamenvorlage ihrer Vorkommen überschreibt.",
			},
			tagsCard: {
				nativeObsidianTags: "Verwendet native Obsidian-Tags",
			},
			remindersCard: {
				defaultReminders: "Standarderinnerungen",
			},
			taskStatuses: {
				header: "Aufgabenstatus",
				description:
					"Passen Sie die verfügbaren Statusoptionen für Ihre Aufgaben an. Diese Status steuern den Aufgabenlebenszyklus und bestimmen, wann Aufgaben als abgeschlossen gelten.",
				howTheyWork: {
					title: "Wie Status funktionieren:",
					value: "Wert: Der interne Bezeichner, der in Ihren Aufgabendateien gespeichert wird (z.B. \"in-progress\")",
					label: 'Label: Der Anzeigename in der Benutzeroberfläche (z.B. "In Bearbeitung")',
					color: "Farbe: Visuelle Indikatorfarbe für Statuspunkt und Abzeichen",
					icon: 'Symbol: Optionaler Lucide-Symbolname zur Anzeige anstelle des farbigen Punktes (z.B. "check", "circle", "clock"). Symbole unter lucide.dev durchsuchen',
					completed:
						"Abgeschlossen: Wenn angehakt, werden Aufgaben mit diesem Status als fertig betrachtet und können anders gefiltert werden",
					autoArchive:
						"Auto-Archivierung: Wenn aktiviert, werden Aufgaben nach der angegebenen Verzögerung automatisch archiviert (1-1440 Minuten)",
					orderNote:
						"Die Reihenfolge unten bestimmt die Sequenz beim Durchschalten der Status durch Klicken auf Aufgabenstatus-Abzeichen.",
				},
				addNew: {
					name: "Neuen Status hinzufügen",
					description: "Erstellen Sie eine neue Statusoption für Ihre Aufgaben",
					buttonText: "Status hinzufügen",
				},
				validationNote:
					"Hinweis: Es müssen mindestens zwei Status vorhanden sein, von denen mindestens einer als „Abgeschlossen“ markiert ist.",
				emptyState:
					"Keine benutzerdefinierten Status konfiguriert. Fügen Sie einen Status hinzu, um zu beginnen.",
				emptyStateButton: "Status hinzufügen",
				fields: {
					value: "Wert:",
					label: "Label:",
					color: "Farbe:",
					icon: "Symbol:",
					completed: "Abgeschlossen:",
					excludeFromCycle: "Beim Durchlaufen überspringen:",
					nextStatus: "Nächster Status:",
					autoArchive: "Auto-Archivierung:",
					delayMinutes: "Verzögerung (Minuten):",
				},
				placeholders: {
					value: "in-bearbeitung",
					label: "In Bearbeitung",
					icon: "check, circle, clock",
					nextStatusDefault: "Statusreihenfolge verwenden",
				},
				badges: {
					completed: "Abgeschlossen",
				},
				deleteConfirm: "Möchten Sie den Status „{label}“ wirklich löschen?",
			},
			taskPriorities: {
				header: "Aufgabenprioritäten",
				description:
					"Passen Sie die verfügbaren Prioritätsstufen für Ihre Aufgaben an. Ab v4.0+ werden Prioritäten in Bases-Ansichten alphabetisch nach ihrem Wert sortiert.",
				howTheyWork: {
					title: "Wie Prioritäten funktionieren:",
					value: "Wert: Der interne Bezeichner, der in Ihren Aufgabendateien gespeichert wird. Verwenden Sie Präfixe wie \"1-dringend\", \"2-hoch\", um die Sortierreihenfolge in Bases-Ansichten zu steuern.",
					label: 'Anzeigelabel: Der Anzeigename in der Benutzeroberfläche (z.B. "Hohe Priorität")',
					color: "Farbe: Visuelle Indikatorfarbe für Prioritätspunkt und Abzeichen",
					icon: "Symbol: Optionales Lucide-Symbol, das auf Aufgabenkarten statt des Prioritätspunkts angezeigt wird",
				},
				addNew: {
					name: "Neue Priorität hinzufügen",
					description: "Erstellen Sie eine neue Prioritätsstufe für Ihre Aufgaben",
					buttonText: "Priorität hinzufügen",
				},
				validationNote:
					"Hinweis: Es muss mindestens eine Priorität vorhanden sein. In Bases-Ansichten werden Prioritäten alphabetisch nach ihrem Wert sortiert.",
				emptyState:
					"Keine benutzerdefinierten Prioritäten konfiguriert. Fügen Sie eine Priorität hinzu, um zu beginnen.",
				emptyStateButton: "Priorität hinzufügen",
				fields: {
					value: "Wert:",
					label: "Label:",
					color: "Farbe:",
					icon: "Symbol:",
				},
				placeholders: {
					value: "hoch",
					label: "Hohe Priorität",
					icon: "alert-circle",
				},
				deleteConfirm: "Es muss mindestens eine Priorität vorhanden sein.",
				deleteTooltip: "Priorität löschen",
			},
			fieldMapping: {
				header: "Feldzuordnung",
				warning:
					"⚠️ Warnung: TaskNotes wird diese Eigenschaftsnamen LESEN UND SCHREIBEN. Das Ändern nach dem Erstellen von Aufgaben kann Inkonsistenzen verursachen.",
				description:
					"Konfigurieren Sie, welche Frontmatter-Eigenschaften TaskNotes für jedes Feld verwenden soll.",
				resetButton: {
					name: "Feldzuordnungen zurücksetzen",
					description: "Alle Feldzuordnungen auf Standardwerte zurücksetzen",
					buttonText: "Auf Standard zurücksetzen",
				},
				notices: {
					resetSuccess: "Feldzuordnungen auf Standard zurückgesetzt",
					resetFailure: "Feldzuordnungen konnten nicht zurückgesetzt werden",
					updateFailure:
						"Feldzuordnung für {label} konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.",
				},
				table: {
					fieldHeader: "TaskNotes-Feld",
					propertyHeader: "Ihr Eigenschaftsname",
				},
				fields: {
					skippedInstances: "Übersprungene Vorkommen",

					title: "Titel",
					status: "Status",
					priority: "Priorität",
					due: "Fälligkeitsdatum",
					scheduled: "Planungsdatum",
					contexts: "Kontexte",
					projects: "Projekte",
					timeEstimate: "Zeitschätzung",
					recurrence: "Wiederholung",
					dateCreated: "Erstellungsdatum",
					completedDate: "Abschlussdatum",
					dateModified: "Änderungsdatum",
					archiveTag: "Archiv-Tag",
					timeEntries: "Zeiteinträge",
					completeInstances: "Abgeschlossene Vorkommen",
					blockedBy: "Blockiert durch",
					sortOrder: "Manuelle Reihenfolge",
					pomodoros: "Pomodoros",
					icsEventId: "ICS-Ereignis-ID",
					icsEventTag: "ICS-Ereignis-Tag",
					reminders: "Erinnerungen",
				},
			},
			customUserFields: {
				validation: {
					emptyKey: "Geben Sie einen Eigenschaftsschlüssel ein.",
					duplicateKey: "Eine andere Eigenschaft verwendet diesen Schlüssel bereits.",
				},
				header: "Benutzerdefinierte Felder",
				description:
					"Definieren Sie benutzerdefinierte Frontmatter-Eigenschaften, die als typisierte Filteroptionen in allen Ansichten erscheinen. Jede Zeile: Anzeigename, Eigenschaftsname, Typ.",
				addNew: {
					name: "Neues Benutzerfeld hinzufügen",
					description:
						"Erstellen Sie ein neues benutzerdefiniertes Feld, das in Filtern und Ansichten erscheint",
					buttonText: "Benutzerfeld hinzufügen",
				},
				emptyState:
					"Keine benutzerdefinierten Felder konfiguriert. Fügen Sie ein Feld hinzu, um benutzerdefinierte Eigenschaften für Ihre Aufgaben zu erstellen.",
				emptyStateButton: "Benutzerfeld hinzufügen",
				fields: {
					displayName: "Anzeigename:",
					propertyKey: "Eigenschaftsschlüssel:",
					type: "Typ:",
					defaultValue: "Standardwert:",
				},
				placeholders: {
					displayName: "Anzeigename",
					propertyKey: "eigenschafts-name",
					defaultValue: "Standardwert",
					defaultValueList: "Standardwerte (kommagetrennt)",
				},
				types: {
					text: "Text",
					number: "Zahl",
					boolean: "Boolean",
					date: "Datum",
					list: "Liste",
				},
				defaultNames: {
					unnamedField: "Unbenanntes Feld",
					noKey: "kein-schlüssel",
				},
				deleteTooltip: "Feld löschen",
				autosuggestFilters: {
					header: "Autovervollständigungsfilter (Erweitert)",
					description:
						"Filtern Sie, welche Dateien in Autovervollständigungsvorschlägen für dieses Feld angezeigt werden",
				},
			},
		},
		appearance: {
			taskCards: {
				updated: "Standard-Aufgabenkarteneigenschaften aktualisiert",
				showing: "Derzeit angezeigt: {properties}",

				header: "Aufgabenkarten",
				description:
					"Konfigurieren Sie, wie Aufgabenkarten in allen Ansichten angezeigt werden.",
				defaultVisibleProperties: {
					name: "Standard sichtbare Eigenschaften",
					description:
						"Wählen Sie, welche Eigenschaften standardmäßig auf Aufgabenkarten erscheinen.",
				},
				completionSubmenu: {
					name: "Abschluss- und Überspringen-Aktionen in einem Untermenü gruppieren",
					description:
						"Zeigen Sie die Aktionen zum Abschließen und Überspringen in einem Untermenü des Aufgaben-Kontextmenüs. Deaktivieren Sie diese Option, um sie direkt im Menü anzuzeigen.",
				},
				propertyGroups: {
					coreProperties: "KERNEIGENSCHAFTEN",
					organization: "ORGANISATION",
					customProperties: "BENUTZERDEFINIERTE EIGENSCHAFTEN",
				},
				properties: {
					status: "Statuspunkt",
					priority: "Prioritätspunkt",
					due: "Fälligkeitsdatum",
					scheduled: "Planungsdatum",
					timeEstimate: "Zeitschätzung",
					totalTrackedTime: "Gesamte erfasste Zeit",
					checklistProgress: "Checklistenfortschritt",
					recurrence: "Wiederholung",
					completedDate: "Abschlussdatum",
					createdDate: "Erstellungsdatum",
					modifiedDate: "Änderungsdatum",
					projects: "Projekte",
					contexts: "Kontexte",
					tags: "Tags",
					blocked: "Blockiert",
					blocking: "Blockierend",
				},
			},
			taskFilenames: {
				header: "Aufgabendateinamen",
				description: "Konfigurieren Sie, wie Aufgabendateien beim Erstellen benannt werden.",
				storeTitleInFilename: {
					name: "Titel im Dateinamen speichern",
					description:
						"Verwenden Sie den Aufgabentitel als Dateinamen. Dateiname wird aktualisiert, wenn der Aufgabentitel geändert wird (Empfohlen).",
				},
				filenameFormat: {
					name: "Dateinamenformat",
					description: "Wie Aufgabendateinamen generiert werden sollen",
					options: {
						title: "Aufgabentitel (Nicht-aktualisierend)",
						zettel: "Zettelkasten-Format (JJMMTT + base36 Sekunden seit Mitternacht)",
						timestamp: "Vollständiger Zeitstempel (YYYY-MM-DD-HHMMSS)",
						custom: "Benutzerdefinierte Vorlage",
						uuid: "UUID v4",
					},
				},
				customTemplate: {
					name: "Benutzerdefinierte Dateinamenvorlage",
					description:
						"Vorlage für benutzerdefinierte Dateinamen. Verfügbare Variablen: {{title}}, {{titleLower}}, {{titleUpper}}, {{titleSnake}}, {{titleKebab}}, {{titleCamel}}, {{titlePascal}}, {{date}}, {{shortDate}}, {{time}}, {{time12}}, {{time24}}, {{timestamp}}, {{dateTime}}, {{year}}, {{month}}, {{monthName}}, {{monthNameShort}}, {{day}}, {{dayName}}, {{dayNameShort}}, {{hour}}, {{hour12}}, {{minute}}, {{second}}, {{milliseconds}}, {{ms}}, {{ampm}}, {{week}}, {{quarter}}, {{unix}}, {{unixMs}}, {{timezone}}, {{timezoneShort}}, {{utcOffset}}, {{utcOffsetShort}}, {{utcZ}}, {{zettel}}, {{uuid}}, {{nano}}, {{priority}}, {{priorityShort}}, {{status}}, {{statusShort}}, {{dueDate}}, {{scheduledDate}}",
					placeholder: "{{date}}-{{title}}-{{dueDate}}",
					helpText:
						"Hinweis: {{dueDate}} und {{scheduledDate}} sind im Format YYYY-MM-DD und werden leer sein, wenn nicht gesetzt.",
				},
			},
			displayFormatting: {
				header: "Anzeigeformatierung",
				description:
					"Konfigurieren Sie, wie Datums- und Uhrzeitangaben sowie andere Daten im Plugin angezeigt werden.",
				timeFormat: {
					name: "Zeitformat",
					description:
						"Zeit im 12-Stunden- oder 24-Stunden-Format im gesamten Plugin anzeigen",
					options: {
						twelveHour: "12-Stunden (AM/PM)",
						twentyFourHour: "24-Stunden",
					},
				},
			},
			calendarView: {
				header: "Kalenderansicht",
				description: "Passen Sie das Erscheinungsbild und Verhalten der Kalenderansicht an.",
				defaultView: {
					name: "Standardansicht",
					description:
						"Die Kalenderansicht, die beim Öffnen des Kalendertabs angezeigt wird",
					options: {
						monthGrid: "Monatsraster",
						weekTimeline: "Wochen-Timeline",
						dayTimeline: "Tages-Timeline",
						yearView: "Jahresansicht",
						customMultiDay: "Benutzerdefinierte Mehrtagesansicht",
					},
				},
				customDayCount: {
					name: "Anzahl der Tage in der Mehrtagesansicht",
					description: "Anzahl der Tage in der benutzerdefinierten mehrtägigen Ansicht",
					placeholder: "3",
				},
				firstDayOfWeek: {
					name: "Erster Tag der Woche",
					description: "Welcher Tag soll die erste Spalte in Wochenansichten sein",
				},
				showWeekends: {
					name: "Wochenenden anzeigen",
					description: "Wochenenden in Kalenderansichten anzeigen",
				},
				showWeekNumbers: {
					name: "Wochennummern anzeigen",
					description: "Wochennummern in Kalenderansichten anzeigen",
				},
				showTodayHighlight: {
					name: "Heute-Hervorhebung anzeigen",
					description: "Den aktuellen Tag in Kalenderansichten hervorheben",
				},
				showCurrentTimeIndicator: {
					name: "Aktuelle Uhrzeit anzeigen",
					description:
						"Eine Linie anzeigen, die die aktuelle Zeit in Timeline-Ansichten zeigt",
				},
				selectionMirror: {
					name: "Auswahlspiegel",
					description:
						"Visuelle Vorschau beim Ziehen zur Auswahl von Zeitbereichen anzeigen",
				},
				calendarLocale: {
					name: "Kalendersprache",
					description:
						'Kalendersprache für Datumsformatierung und Kalendersystem (z.B. "en", "fa" für Farsi/Persisch, "de" für Deutsch). Leer lassen für automatische Erkennung vom Browser.',
					placeholder: "Automatische Erkennung",
					invalidLocale:
						"Ungültige Gebietsschema-Einstellung. Bitte geben Sie ein gültiges Sprachkürzel ein (z.B. 'de', 'en', 'fr-FR').",
				},
			},
			defaultEventVisibility: {
				header: "Standard-Ereignis-Sichtbarkeit",
				description:
					"Konfigurieren Sie, welche Ereignis-Typen standardmäßig beim Öffnen des Kalenders sichtbar sind. Benutzer können diese trotzdem in der Kalenderansicht ein-/ausschalten.",
				showScheduledTasks: {
					name: "Geplante Aufgaben anzeigen",
					description: "Aufgaben mit geplanten Daten standardmäßig anzeigen",
				},
				showDueDates: {
					name: "Fälligkeitsdaten anzeigen",
					description: "Aufgaben-Fälligkeitsdaten standardmäßig anzeigen",
				},
				showDueWhenScheduled: {
					name: "Fälligkeitsdaten bei geplanten anzeigen",
					description:
						"Fälligkeitsdaten auch für Aufgaben anzeigen, die bereits geplante Daten haben",
				},
				showTimeEntries: {
					name: "Zeiteinträge anzeigen",
					description: "Abgeschlossene Zeiterfassungseinträge standardmäßig anzeigen",
				},
				showRecurringTasks: {
					name: "Wiederkehrende Aufgaben anzeigen",
					description: "Wiederkehrende Aufgabeninstanzen standardmäßig anzeigen",
				},
				showICSEvents: {
					name: "ICS-Ereignisse anzeigen",
					description: "Ereignisse aus ICS-Abonnements standardmäßig anzeigen",
				},
			},
			timeSettings: {
				invalidFormat: "Ungültiges Zeitformat. Verwenden Sie hh:mm (z. B. {example})",
				invalidTime:
					"Ungültige Uhrzeit. Stunden müssen zwischen 00 und 23 und Minuten zwischen 00 und 59 liegen",
				invalidEndTime:
					"Ungültige Uhrzeit. Verwenden Sie 00:00–48:00; nach Mitternacht 24:00–48:00, z. B. 26:00 für 2 Uhr am Folgetag",

				header: "Zeiteinstellungen",
				description:
					"Konfigurieren Sie zeitbezogene Anzeigeeinstellungen für Timeline-Ansichten.",
				timeSlotDuration: {
					name: "Zeitslot-Dauer",
					description: "Dauer jedes Zeitslots in Timeline-Ansichten",
					options: {
						fifteenMinutes: "15 Minuten",
						thirtyMinutes: "30 Minuten",
						sixtyMinutes: "60 Minuten",
					},
				},
				startTime: {
					name: "Startzeit",
					description: "Früheste Zeit in Timeline-Ansichten (HH:MM Format)",
					placeholder: "06:00",
				},
				endTime: {
					name: "Endzeit",
					description:
						"Späteste Zeit, die in Timeline-Ansichten angezeigt wird (HH:MM-Format). Verwenden Sie Werte über 24:00, um frühe Stunden des nächsten Tages anzuzeigen, z. B. 26:00 für 2 Uhr morgens.",
					placeholder: "26:00",
				},
				initialScrollTime: {
					name: "Anfangs-Scrollzeit",
					description:
						"Zeit, zu der beim Öffnen von Timeline-Ansichten gescrollt wird (HH:MM Format)",
					placeholder: "09:00",
				},
				eventMinHeight: {
					name: "Ereignis-Mindesthöhe",
					description: "Mindesthöhe für Ereignisse in Timeline-Ansichten (Pixel)",
					placeholder: "15",
				},
			},
			uiElements: {
				header: "UI-Elemente",
				description: "Konfigurieren Sie die Anzeige verschiedener UI-Elemente.",
				showTrackedTasksInStatusBar: {
					name: "Aufgaben mit aktiver Zeiterfassung in Statusleiste anzeigen",
					description: "Aufgaben mit aktiver Zeiterfassung in der Statusleiste von Obsidian anzeigen",
				},
				showRelationshipsWidget: {
					name: "Beziehungen-Widget anzeigen",
					description:
						"Ein Widget anzeigen, das alle Beziehungen für die aktuelle Notiz zeigt (Unteraufgaben, Projekte, Abhängigkeiten)",
				},
				relationshipsPosition: {
					name: "Beziehungen-Position",
					description: "Wo das Beziehungen-Widget positioniert werden soll",
					options: {
						top: "Oben in der Notiz",
						bottom: "Unten in der Notiz",
					},
				},
				showTaskCardInNote: {
					name: "Aufgabenkarte in Notiz anzeigen",
					description:
						"Oben in Aufgabennotizen ein Aufgabenkarten-Widget mit Details und Aktionen anzeigen",
				},
				showCompletedTaskStrikethrough: {
					name: "Titel erledigter Aufgaben durchstreichen",
					description:
						"Zeichnet eine Linie durch Titel erledigter Aufgabenkarten. Deaktivieren, damit erledigte Aufgaben leichter lesbar bleiben",
				},
				showExpandableSubtasks: {
					name: "Ausklappbare Unteraufgaben anzeigen",
					description:
						"Aus-/Einklappen von Unteraufgaben-Abschnitten in Aufgabenkarten erlauben",
				},
				expandSubtasksByDefault: {
					name: "Unteraufgaben standardmäßig ausklappen",
					description:
						"Projekt-Unteraufgaben beim Anzeigen von Aufgabenkarten automatisch ausgeklappt anzeigen",
				},
				subtaskChevronPosition: {
					name: "Unteraufgaben-Chevron-Position",
					description: "Position der Aus-/Einklappen-Chevrons in Aufgabenkarten",
					options: {
						left: "Linke Seite",
						right: "Rechte Seite",
					},
				},
				viewsButtonAlignment: {
					name: "Ansichten-Button-Ausrichtung",
					description:
						"Ausrichtung des Ansichten/Filter-Buttons in der Aufgabenoberfläche",
					options: {
						left: "Linke Seite",
						right: "Rechte Seite",
					},
				},
			},
			projectAutosuggest: {
				header: "Projekt-Autovorschlag",
				description:
					"Passen Sie an, wie Projektvorschläge während der Aufgabenerstellung angezeigt werden.",
				requiredTags: {
					name: "Erforderliche Tags",
					description:
						"Nur Notizen mit beliebigen dieser Tags anzeigen (kommagetrennt). Leer lassen für alle Notizen.",
					placeholder: "projekt, aktiv, wichtig",
				},
				includeFolders: {
					name: "Ordner einschließen",
					description:
						"Nur Notizen in diesen Ordnern anzeigen (kommagetrennte Pfade). Leer lassen für alle Ordner.",
					placeholder: "Projekte/, Arbeit/Aktiv, Persönlich",
				},
				requiredPropertyKey: {
					name: "Erforderlicher Eigenschaftsschlüssel",
					description:
						"Nur Notizen anzeigen, wo diese Frontmatter-Eigenschaft dem unten stehenden Wert entspricht. Leer lassen zum Ignorieren.",
					placeholder: "typ",
				},
				requiredPropertyValue: {
					name: "Erforderlicher Eigenschaftswert",
					description:
						"Nur Notizen, wo die Eigenschaft diesem Wert entspricht, werden vorgeschlagen. Leer lassen, um zu verlangen, dass die Eigenschaft existiert.",
					placeholder: "projekt",
				},
				customizeDisplay: {
					name: "Vorschlagsanzeige anpassen",
					description:
						"Erweiterte Optionen anzeigen, um zu konfigurieren, wie Projektvorschläge erscheinen und welche Informationen sie anzeigen.",
				},
				enableFuzzyMatching: {
					name: "Unscharfe Suche aktivieren",
					description:
						"Tippfehler und Teilübereinstimmungen in Projektsuche erlauben. Kann in großen Vaults langsamer sein.",
				},
				displayRowsHelp:
					"Konfigurieren Sie bis zu 3 Informationszeilen für jeden Projektvorschlag.",
				displayRows: {
					row1: {
						name: "Zeile 1",
						description:
							"Format: {property|flags}. Eigenschaften: title, aliases, file.path, file.parent. Flags: n(Label) zeigt die Beschriftung an, s macht den Wert durchsuchbar. Beispiel: {title|n(Title)|s}",
						placeholder: "{title|n(Title)}",
					},
					row2: {
						name: "Zeile 2 (optional)",
						description:
							"Häufige Muster: {aliases|n(Aliases)}, {file.parent|n(Folder)}, literal:Custom Text",
						placeholder: "{aliases|n(Aliases)}",
					},
					row3: {
						name: "Zeile 3 (optional)",
						description:
							"Zusätzliche Angaben wie {file.path|n(Path)} oder benutzerdefinierte Frontmatter-Felder",
						placeholder: "{file.path|n(Path)}",
					},
				},
				quickReference: {
					header: "Schnellreferenz",
					properties:
						"Verfügbare Eigenschaften: title, aliases, file.path, file.parent, oder beliebige Frontmatter-Felder",
					labels: "Beschriftungen hinzufügen: {title|n(Title)} → „Title: My Project“",
					searchable:
						"Suchbar machen: {description|s} schließt Beschreibung in + Suche ein",
					staticText: "Statischer Text: literal:Mein benutzerdefiniertes Label",
					alwaysSearchable:
						"Dateiname, Titel und Aliase sind standardmäßig immer suchbar.",
				},
			},
			dataStorage: {
				name: "Speicherort",
				description: "Wo Pomodoro-Sitzungshistorie gespeichert werden soll",
				pluginData: "Plugin-Daten (empfohlen)",
				dailyNotes: "Tägliche Notizen",
				notices: {
					locationChanged: "Pomodoro-Speicherort geändert zu {location}",
				},
			},
			notifications: {
				description: "Konfigurieren Sie Aufgabenerinnerungs-Benachrichtigungen und Alarme.",
			},
			performance: {
				description: "Konfigurieren Sie Plugin-Leistung und Verhaltensoptionen.",
			},
			timeTrackingSection: {
				description: "Konfigurieren Sie automatische Zeiterfassungsverhalten.",
			},
			recurringSection: {
				description: "Konfigurieren Sie Verhalten für wiederkehrende Aufgabenverwaltung.",
			},
		},
		integrations: {
			oauth: {
				infoLabel: "Info:",

				header: "OAuth-Kalenderintegration",
				description:
					"Verbinden Sie Google Kalender oder Microsoft Outlook, um Termine mit TaskNotes zu synchronisieren.",
				setup: "Erstellen Sie zuerst OAuth-Zugangsdaten bei Google oder Microsoft. Die Ersteinrichtung dauert etwa 15 Minuten.",
				guide: "Anleitung zur Kalendereinrichtung öffnen",
				stored: "Sicher gespeichert: Neuen Wert zum Ersetzen eingeben",
				unavailable: "OAuth-Dienst nicht verfügbar",
				connection: "OAuth-2.0-Verbindung",
				connected: "Verbunden",
				disconnected: "Nicht verbunden",
				connectedAt: "Verbunden {time}",
				refreshedAt: "Zuletzt aktualisiert {time}",
				neverRefreshed: "Noch nie aktualisiert",
				refresh: "Jetzt aktualisieren",
				disconnect: "Trennen",
				refreshSuccess: "{provider} erfolgreich aktualisiert",
				refreshFailed: "{provider} konnte nicht aktualisiert werden",
				disconnectSuccess: "Verbindung zu {provider} getrennt",
				disconnectFailed: "Verbindung zu {provider} konnte nicht getrennt werden",
				connect: "{provider} verbinden",
				connectSuccess: "{provider} erfolgreich verbunden!",
				connectFailed: "Verbindung fehlgeschlagen: {message}",
				forget: "Gespeicherte Zugangsdaten entfernen",
				forgetTitle: "OAuth-Zugangsdaten für {provider} entfernen?",
				forgetMessage:
					"Dadurch werden die gespeicherte Client-ID und das Client-Geheimnis aus Obsidians Geheimnisspeicher entfernt.",
				forgetConfirm: "Zugangsdaten entfernen",
				forgotten: "OAuth-Zugangsdaten für {provider} entfernt",
				help: "Verbinden Sie Ihr {provider}-Konto, um Termine mit TaskNotes zu synchronisieren.",
				googleRefreshInterval: "Termine werden automatisch alle 15 Minuten aktualisiert.",
				credentialNote:
					"Geben Sie die OAuth-App-Zugangsdaten aus {portal} ein. Obsidians Geheimnisspeicher verschlüsselt gespeicherte Zugangsdaten, sofern das Betriebssystem dies unterstützt.",
				tokenRefreshed: "OAuth-Token aktualisiert {time}",
				tokenNotRefreshed: "Token noch nicht aktualisiert",
				syncUnavailable: "Kalendersynchronisierung nicht verfügbar",
				syncFailed: "Kalendersynchronisierung fehlgeschlagen {time}: {message}",
				syncSuccess: "Kalendersynchronisierung erfolgreich {time} (Termine: {count})",
				syncChecked: "Kalendersynchronisierung geprüft {time}",
				eventsNotRefreshed: "Kalendertermine noch nicht aktualisiert",
				calendarErrors:
					"Kalender mit Fehlern: {count}. Erster Fehler: {calendar}: {message}",
				refreshErrors: "Fehler beim Aktualisieren von {provider}: {message}",
				tokenLabel: "Token:",
				syncLabel: "Synchronisierung:",
				issueLabel: "Problem:",
				clientIdLabel: "Client-ID:",
				clientSecretLabel: "Client-Geheimnis:",
			},

			mobileCalendar: {
				disable: {
					name: "Kalenderintegrationen auf Mobilgeräten deaktivieren",
					description:
						"Google-, Microsoft- und ICS-Kalender auf Obsidian Mobile nicht laden. Desktop-Kalenderintegrationen bleiben unverändert.",
				},
				status: {
					name: "Kalenderintegrationen sind auf diesem Mobilgerät deaktiviert",
					description:
						"Deaktivieren Sie diese Einstellung und laden Sie Obsidian Mobile neu, um Kalender wieder zu laden.",
				},
			},
			basesIntegration: {
				header: "Bases-Integration",
				description:
					"Konfigurieren Sie die Integration mit Obsidian Bases. Diese experimentelle Funktion verwendet derzeit undokumentierte Obsidian-APIs; ihr Verhalten kann sich ändern oder die Integration kann ausfallen.",
				enable: {
					name: "Bases-Integration aktivieren",
					description:
						"TaskNotes-Ansichten zur Verwendung im Obsidian Bases Plugin aktivieren. Bases Plugin muss aktiviert sein, damit dies funktioniert.",
				},
				viewCommands: {
					header: "Ansichten & Base-Dateien",
					description:
						"TaskNotes verwendet Obsidian Bases-Dateien (.base) zur Darstellung seiner Ansichten. Diese Dateien werden beim Start automatisch erstellt, falls sie nicht existieren, und mit Ihren aktuellen Einstellungen konfiguriert (Aufgabenidentifikation, Feldzuordnungen, Status usw.).",
					descriptionRegen:
						"Base-Dateien werden bei Einstellungsänderungen nicht automatisch aktualisiert. Um Änderungen anzuwenden, verwenden Sie unten „Dateien aktualisieren“, löschen Sie die vorhandenen .base-Dateien und starten Sie Obsidian neu oder bearbeiten Sie die Dateien manuell.",
					docsLink:
						"Dokumentation für verfügbare Formeln und Anpassungsoptionen anzeigen",
					docsLinkUrl: "https://tasknotes.dev/views/default-base-templates",
					commands: {
						miniCalendar: "Mini-Kalenderansicht öffnen",
						kanban: "Kanban-Ansicht öffnen",
						tasks: "Aufgabenansicht öffnen",
						advancedCalendar: "Erweiterte Kalenderansicht öffnen",
						agenda: "Agenda-Ansicht öffnen",
						relationships: "Beziehungs-Widget",
						pomodoroStats: "Pomodoro-Statistik-Base",
					},
					fileLabel: "Datei: {path}",
					resetButton: "Zurücksetzen",
					resetTooltip: "Auf Standardpfad zurücksetzen",
					pomodoroDailyNotesHint:
						"Die generierte Pomodoro-Statistik-Base liest den Pomodoro-Verlauf aus täglichen Notizen. Wenn Ihr Verlauf noch in Plugin-Daten gespeichert ist, migrieren Sie ihn in den Einstellungen, bevor Sie diese Base-Datei verwenden.",
				},
				autoCreateDefaultFiles: {
					name: "Standarddateien automatisch erstellen",
					description:
						"Fehlende Standard-Base-Ansichtsdateien beim Start automatisch erstellen. Deaktivieren, um zu verhindern, dass gelöschte Beispieldateien neu erstellt werden.",
				},
				createDefaultFiles: {
					name: "Standarddateien erstellen",
					description:
						"Erstellen Sie die Standard-.base-Dateien im TaskNotes/Views/-Verzeichnis. Vorhandene Dateien werden nicht überschrieben.",
					buttonText: "Dateien erstellen",
				},
				exportV3Views: {
					name: "V3-gespeicherte Ansichten nach Bases exportieren",
					description:
						"Konvertieren Sie alle Ihre gespeicherten Ansichten aus TaskNotes v3 in eine einzige .base-Datei mit mehreren Ansichten. Dies hilft bei der Migration Ihrer v3-Filterkonfigurationen zum neuen Bases-System.",
					buttonText: "V3-Ansichten exportieren",
					noViews: "Keine gespeicherten Ansichten zum Exportieren",
					fileExists: "Datei existiert bereits",
					confirmOverwrite:
						'Eine Datei namens "{fileName}" existiert bereits. Überschreiben?',
					success: "{count} gespeicherte Ansichten nach {filePath} exportiert",
					error: "Fehler beim Exportieren von Ansichten: {message}",
				},
				notices: {
					enabled:
						"Bases-Integration aktiviert. Bitte starten Sie Obsidian neu, um die Einrichtung abzuschließen.",
					disabled:
						"Bases-Integration deaktiviert. Bitte starten Sie Obsidian neu, um die Entfernung abzuschließen.",
				},
				updateDefaultFiles: {
					name: "Standarddateien aktualisieren",
					description:
						"Die konfigurierten Standard-.base-Dateien mit Vorlagen überschreiben, die aus Ihren aktuellen TaskNotes-Einstellungen erzeugt werden.",
					buttonText: "Dateien aktualisieren",
					confirmTitle: "Standard-Base-Dateien aktualisieren",
					confirmMessage:
						"Dadurch werden die konfigurierten Standard-.base-Dateien mit neu generierten Vorlagen überschrieben. Manuelle Änderungen in diesen Dateien werden ersetzt.",
					confirmText: "Dateien aktualisieren",
				},
			},
			calendarSubscriptions: {
				header: "Kalenderabonnements",
				description:
					"Abonnieren Sie externe Kalender über ICS-/iCal-URLs, um Ereignisse neben Ihren Aufgaben anzuzeigen.",
				defaultNoteTemplate: {
					name: "Standard-Notizvorlage",
					description:
						"Pfad zur Vorlagendatei für Notizen, die aus ICS-Ereignisse erstellt werden",
					placeholder: "Templates/Ereignis Vorlage.md",
				},
				defaultNoteFolder: {
					name: "Standard-Notizordner",
					description: "Ordner für Notizen, die aus ICS-Ereignisse erstellt werden",
					placeholder: "Kalender/Ereignisse",
				},
				filenameFormat: {
					name: "ICS-Notiz-Dateinamenformat",
					description:
						"Wie Dateinamen für Notizen generiert werden, die aus ICS-Ereignisse erstellt werden",
					options: {
						title: "Ereignis-Titel",
						zettel: "Zettelkasten-Format",
						timestamp: "Zeitstempel",
						custom: "Benutzerdefinierte Vorlage",
					},
				},
				customTemplate: {
					name: "Benutzerdefinierte ICS-Dateinamenvorlage",
					description: "Vorlage für benutzerdefinierte ICS-Ereignis-Dateinamen",
					placeholder: "{date}-{title}",
				},
				useICSEndAsDue: {
					name: "ICS-Ereignis-Endzeit als Fälligkeitsdatum verwenden",
					description:
						"Wenn aktiviert, wird das Fälligkeitsdatum von Aufgaben aus Kalenderereignissen auf die Endzeit des Ereignisses gesetzt. Bei ganztägigen Ereignissen wird das Fälligkeitsdatum auf das Ereignisdatum gesetzt. Bei zeitgesteuerten Ereignissen enthält das Fälligkeitsdatum die Endzeit.",
				},
				recurringEventRelatedNotesMode: {
					name: "Verknüpfte Notizen für wiederkehrende Ereignisse",
					description:
						"Wählen Sie, ob Notizen, die mit einer Wiederholung eines externen Kalenderereignisses verknüpft sind, in der geladenen Serie oder nur in der ausgewählten Instanz erscheinen.",
					options: {
						series: "Gesamte Serie",
						instance: "Nur ausgewählte Instanz",
					},
				},
			},
			subscriptionsList: {
				header: "Kalenderabonnements-Liste",
				addSubscription: {
					name: "Kalenderabonnement hinzufügen",
					description:
						"Neues Kalenderabonnement von ICS/iCal URL oder lokaler Datei hinzufügen",
					buttonText: "Abonnement hinzufügen",
				},
				refreshAll: {
					name: "Alle Abonnements aktualisieren",
					description: "Alle aktivierten Kalenderabonnements manuell aktualisieren",
					buttonText: "Alle aktualisieren",
				},
				newCalendarName: "Neuer Kalender",
				emptyState:
					"Keine Kalenderabonnements konfiguriert. Fügen Sie ein Abonnement hinzu, um externe Kalender zu synchronisieren.",
				notices: {
					addSuccess:
						"Neues Kalenderabonnement hinzugefügt - bitte konfiguriere die Details",
					addFailure: "Abonnement konnte nicht hinzugefügt werden",
					serviceUnavailable: "ICS-Abonnementdienst nicht verfügbar",
					refreshSuccess: "Alle Kalenderabonnements erfolgreich aktualisiert",
					refreshFailure: "Einige Kalenderabonnements konnten nicht aktualisiert werden",
					updateFailure: "Abonnement konnte nicht aktualisiert werden",
					deleteSuccess: 'Abonnement "{name}" gelöscht',
					deleteFailure: "Abonnement konnte nicht gelöscht werden",
					enableFirst: "Aktivieren Sie zuerst das Abonnement",
					refreshSubscriptionSuccess: '"{name}" aktualisiert',
					refreshSubscriptionFailure: "Abonnement konnte nicht aktualisiert werden",
				},
				labels: {
					enabled: "Aktiviert:",
					name: "Name:",
					type: "Typ:",
					url: "URL:",
					filePath: "Dateipfad:",
					color: "Farbe:",
					refreshMinutes: "Aktualisierung (Min):",
				},
				typeOptions: {
					remote: "Remote-URL",
					local: "Lokale Datei",
				},
				placeholders: {
					calendarName: "Kalendername",
					url: "ICS/iCal-URL",
					filePath: "Lokaler Dateipfad (z.B. Kalender.ics)",
					localFile: "Kalender.ics",
				},
				statusLabels: {
					enabled: "Aktiviert",
					disabled: "Deaktiviert",
					remote: "Remote",
					localFile: "Lokale Datei",
					remoteCalendar: "Remote-Kalender",
					localFileCalendar: "Lokale Datei",
					synced: "Synchronisiert {timeAgo}",
					error: "Fehler",
				},
				actions: {
					refreshNow: "Jetzt aktualisieren",
					deleteSubscription: "Abonnement löschen",
				},
				refreshNow: "Jetzt aktualisieren",
				confirmDelete: {
					title: "Abonnement löschen",
					message:
						"Möchten Sie das Abonnement „{name}“ wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.",
					confirmText: "Löschen",
				},
			},
			autoExport: {
				header: "Automatischer ICS-Export",
				description: "Automatisch alle Ihre Aufgaben in eine ICS-Datei exportieren.",
				enable: {
					name: "Automatischen Export aktivieren",
					description:
						"Eine ICS-Datei automatisch mit allen Ihren Aufgaben aktuell halten",
				},
				filePath: {
					name: "Export-Dateipfad",
					description:
						"Pfad, wo die ICS-Datei gespeichert wird (relativ zur Vault-Wurzel)",
					placeholder: "tasknotes-kalender.ics",
				},
				interval: {
					name: "Aktualisierungsintervall (zwischen 5 und 1440 Minuten)",
					description: "Wie oft die Export-Datei aktualisiert werden soll",
					placeholder: "60",
				},
				useDuration: {
					name: "Aufgabendauer für Ereignislänge verwenden",
					description:
						"Wenn aktiviert, wird die geschätzte Dauer der Aufgabe anstelle des Fälligkeitsdatums für die Endzeit des Kalenderevents verwendet. Dies ist nützlich für GTD-Workflows, bei denen geplant + Dauer die Arbeitsplanung darstellt, während das Fälligkeitsdatum Fristen repräsentiert.",
				},
				exportNow: {
					name: "Jetzt exportieren",
					description: "Sofortigen Export manuell auslösen",
					buttonText: "Jetzt exportieren",
				},
				status: {
					title: "Export-Status:",
					lastExport: "Letzter Export: {time}",
					nextExport: "Nächster Export: {time}",
					noExports: "Noch keine Exporte",
					notScheduled: "Nicht geplant",
					notInitialized:
						"Dienst für automatischen Export nicht initialisiert – starten Sie Obsidian neu",
					serviceNotInitialized:
						"Dienst nicht initialisiert - bitte starten Sie Obsidian neu",
				},
				notices: {
					reloadRequired:
						"Bitte laden Sie Obsidian neu, damit die automatischen Export-Änderungen wirksam werden.",
					exportSuccess: "Aufgaben erfolgreich exportiert",
					exportFailure: "Export fehlgeschlagen – prüfen Sie die Konsole auf Details",
					serviceUnavailable: "Auto-Export-Dienst nicht verfügbar",
				},
				excludeCompleted: {
					name: "Abgeschlossene Aufgaben ausschließen",
					description:
						"Wenn aktiviert, werden abgeschlossene Aufgaben aus ICS-Exporten ausgelassen. Abgeschlossene Status werden aus Ihren Aufgabenstatus-Einstellungen übernommen.",
				},
				excludeArchived: {
					name: "Archivierte Aufgaben ausschließen",
					description:
						"Wenn aktiviert, werden archivierte Aufgaben aus ICS-Exporten ausgelassen.",
				},
				requireDueDate: {
					name: "Fälligkeitsdatum erforderlich",
					description:
						"Wenn aktiviert, werden nur Aufgaben mit Fälligkeitsdatum in ICS-Exporte aufgenommen.",
				},
				requireScheduledDate: {
					name: "Planungsdatum erforderlich",
					description:
						"Wenn aktiviert, werden nur Aufgaben mit geplantem Datum in ICS-Exporte aufgenommen.",
				},
			},
			googleCalendarExport: {
				header: "Aufgaben zu Google Kalender exportieren",
				description:
					"Synchronisieren Sie Ihre Aufgaben automatisch als Ereignisse mit Google Kalender. Dazu muss Google Kalender zuvor verbunden werden.",
				enable: {
					name: "Aufgabenexport aktivieren",
					description:
						"Wenn aktiviert, werden Aufgaben mit Terminen automatisch als Ereignisse mit Google Kalender synchronisiert.",
				},
				targetCalendar: {
					name: "Zielkalender",
					description:
						"Wählen Sie den Kalender aus, in dem Aufgabenereignisse erstellt werden sollen.",
					placeholder: "Kalender auswählen...",
					connectFirst: "Verbinden Sie zuerst Google Kalender",
					primarySuffix: " (Primär)",
				},
				syncTrigger: {
					name: "Synchronisierungsauslöser",
					description:
						"Welches Aufgabendatum soll die Kalenderereigniserstellung auslösen.",
					options: {
						scheduled: "Planungsdatum",
						due: "Fälligkeitsdatum",
						both: "Beide (geplant bevorzugt)",
					},
				},
				allDayEvents: {
					name: "Als Ganztagesereignisse erstellen",
					description:
						"Wenn aktiviert, werden Aufgaben als Ganztagesereignisse erstellt. Wenn deaktiviert, wird die Zeitschätzung für die Dauer verwendet.",
				},
				showAllDayAsFree: {
					name: "Ganztägige Aufgabenereignisse als frei anzeigen",
					description:
						"Ganztägige Aufgabenexporte blockieren die Verfügbarkeit nicht, auch bei in ganztägige Ereignisse umgewandelten Aufgaben. Ereignisse mit Uhrzeit bleiben beschäftigt. Nutzen Sie die Synchronisierung aller Aufgaben, um bestehende Ereignisse zu aktualisieren.",
				},
				defaultDuration: {
					name: "Standard-Ereignisdauer",
					description:
						"Dauer in Minuten für zeitgesteuerte Ereignisse (wird verwendet, wenn die Aufgabe keine Zeitschätzung hat).",
				},
				eventTitleTemplate: {
					name: "Ereignistitelvorlage",
					description:
						"Vorlage für Ereignistitel. Verfügbare Variablen: {{title}}, {{status}}, {{priority}}",
					placeholder: "{{title}}",
				},
				includeDescription: {
					name: "Aufgabendetails in Beschreibung einschließen",
					description:
						"Aufgabenmetadaten (Priorität, Status, Tags, etc.) zur Ereignisbeschreibung hinzufügen.",
				},
				includeObsidianLink: {
					name: "Obsidian-Link einschließen",
					description:
						"Einen Link zur Aufgabe in Obsidian in der Ereignisbeschreibung hinzufügen.",
				},
				defaultReminder: {
					name: "Standard-Erinnerung",
					description:
						"Popup-Erinnerungen zu zeitgebundenen Google-Kalender-Ereignissen hinzufügen. Geben Sie Minuten vor dem Ereignis durch Kommas getrennt ein. Leer lassen, um Kalenderstandards zu verwenden. Übliche Werte: 15, 30, 60, 1440.",
				},
				automaticSyncBehavior: {
					header: "Automatisches Synchronisierungsverhalten",
				},
				syncOnCreate: {
					name: "Bei Aufgabenerstellung synchronisieren",
					description:
						"Automatisch ein Kalenderereignis erstellen, wenn eine neue Aufgabe erstellt wird.",
				},
				syncOnUpdate: {
					name: "Bei Aufgabenaktualisierung synchronisieren",
					description:
						"Automatisch das Kalenderereignis aktualisieren, wenn eine Aufgabe geändert wird.",
				},
				syncOnComplete: {
					name: "Bei Aufgabenabschluss synchronisieren",
					description:
						"Kalenderereignis aktualisieren, wenn eine Aufgabe abgeschlossen wird (fügt ein Häkchen zum Titel hinzu).",
				},
				syncOnDelete: {
					name: "Ereignis bei Aufgabenlöschung löschen",
					description:
						"Kalenderereignis entfernen, wenn die entsprechende Aufgabe gelöscht wird.",
				},
				manualSyncActions: {
					header: "Manuelle Synchronisierungsaktionen",
				},
				syncAllTasks: {
					name: "Alle Aufgaben synchronisieren",
					description:
						"Alle vorhandenen Aufgaben mit Google Kalender synchronisieren. Dies erstellt Ereignisse für Aufgaben, die noch nicht synchronisiert wurden.",
					buttonText: "Alle synchronisieren",
				},
				unlinkAllTasks: {
					name: "Alle Aufgaben trennen",
					description:
						"Alle Verknüpfungen zwischen Aufgaben und Ereignissen entfernen, ohne Kalenderereignisse zu löschen.",
					buttonText: "Alle trennen",
					confirmTitle: "Alle Aufgaben trennen",
					confirmMessage:
						"Dadurch werden alle Verknüpfungen zwischen Aufgaben und Kalenderereignissen entfernt. Die Ereignisse bleiben erhalten, werden bei Änderungen an Aufgaben aber nicht mehr aktualisiert. Möchten Sie fortfahren?",
					confirmButtonText: "Alle trennen",
				},
				notices: {
					notEnabled:
						"Der Google-Kalender-Export ist nicht aktiviert. Konfigurieren Sie ihn unter Einstellungen > Integrationen.",
					notEnabledOrConfigured:
						"Google Kalender-Export ist nicht aktiviert oder konfiguriert",
					serviceNotAvailable:
						"Aufgaben-Kalender-Synchronisierungsdienst nicht verfügbar",
					syncResults:
						"Synchronisiert: {synced}, Fehlgeschlagen: {failed}, Übersprungen: {skipped}",
					taskSynced: "Aufgabe mit Google Kalender synchronisiert",
					noActiveFile: "Keine Datei ist derzeit aktiv",
					notATask: "Die aktuelle Datei ist keine Aufgabe",
					noDateToSync:
						"Die Aufgabe hat weder ein Planungs- noch ein Fälligkeitsdatum für die Synchronisierung",
					syncFailed:
						"Synchronisierung der Aufgabe mit Google Kalender fehlgeschlagen: {message}",
					connectionExpired:
						"Die Google Kalender-Verbindung ist abgelaufen. Bitte verbinden Sie sie unter Einstellungen > Integrationen erneut.",
					syncingTasks: "{total} Aufgaben werden mit Google Kalender synchronisiert…",
					syncComplete:
						"Synchronisierung abgeschlossen: {synced} synchronisiert, {failed} fehlgeschlagen, {skipped} übersprungen",
					eventsDeletedAndUnlinked: "Alle Ereignisse gelöscht und getrennt",
					tasksUnlinked: "Alle Aufgabenverknüpfungen entfernt",
				},
				eventDescription: {
					untitledTask: "Unbenannte Aufgabe",
					priority: "Priorität: {value}",
					status: "Status: {value}",
					due: "Fällig: {value}",
					scheduled: "Geplant: {value}",
					timeEstimate: "Zeitschätzung: {value}",
					tags: "Tags: {value}",
					contexts: "Kontexte: {value}",
					projects: "Projekte: {value}",
					openInObsidian: "In Obsidian öffnen",
				},
			},
			httpApi: {
				header: "HTTP API",
				description: "HTTP API für externe Integrationen und Automatisierungen aktivieren.",
				enable: {
					name: "HTTP API aktivieren",
					description: "Lokalen HTTP-Server für API-Zugriff starten",
				},
				port: {
					name: "API-Port",
					description: "Port-Nummer für den HTTP API-Server",
					placeholder: "3000",
				},
				authToken: {
					name: "API-Authentifizierungstoken",
					description:
						"TaskNotes-Token, nicht der API-Schlüssel Ihres KI-Anbieters. Zum Erstellen HTTP-API aktivieren, dieses Feld leer lassen und Obsidian neu starten. Anschließend das erzeugte Token in die Bearer-Authentifizierungseinstellungen des Clients kopieren. Bei jeder Token-Änderung die Clients aktualisieren.",
					placeholder: "geheimes-tasknotes-token",
				},
				mcp: {
					enable: {
						name: "MCP-Server aktivieren",
						description:
							"TaskNotes-Werkzeuge über Model Context Protocol am Endpunkt /mcp bereitstellen. Erfordert, dass die HTTP API aktiviert ist.",
					},
				},
				endpoints: {
					header: "Verfügbare API-Endpunkte",
					expandIcon: "▶",
					collapseIcon: "▼",
				},
			},
			webhooks: {
				header: "Webhooks",
				description: {
					overview:
						"Webhooks senden Echtzeit-Benachrichtigungen an externe Dienste, wenn TaskNotes-Ereignisse auftreten.",
					usage: "Konfigurieren Sie Webhooks zur Integration mit Automatisierungstools, Sync-Diensten oder benutzerdefinierten Anwendungen.",
				},
				addWebhook: {
					name: "Webhook hinzufügen",
					description: "Neuen Webhook-Endpunkt registrieren",
					buttonText: "Webhook hinzufügen",
				},
				emptyState: {
					message:
						"Keine Webhooks konfiguriert. Fügen Sie einen Webhook hinzu, um Echtzeit-Benachrichtigungen zu erhalten.",
					buttonText: "Webhook hinzufügen",
				},
				labels: {
					active: "Aktiv:",
					url: "URL:",
					events: "Ereignisse:",
					transform: "Transformation:",
				},
				placeholders: {
					url: "Webhook-URL",
					noEventsSelected: "Keine Ereignisse ausgewählt",
					rawPayload: "Raw-Payload (keine Transformation)",
				},
				statusLabels: {
					active: "Aktiv",
					inactive: "Inaktiv",
					created: "Erstellt {timeAgo}",
				},
				actions: {
					editEvents: "Ereignisse bearbeiten",
					delete: "Löschen",
				},
				editEvents: "Ereignisse bearbeiten",
				notices: {
					urlUpdated: "Webhook URL aktualisiert",
					enabled: "Webhook aktiviert",
					disabled: "Webhook deaktiviert",
					created: "Webhook erfolgreich erstellt",
					deleted: "Webhook gelöscht",
					updated: "Webhook aktualisiert",
				},
				confirmDelete: {
					title: "Webhook löschen",
					message:
						"Möchten Sie diesen Webhook wirklich löschen?\n\nURL: {url}\n\nDiese Aktion kann nicht rückgängig gemacht werden.",
					confirmText: "Löschen",
				},
				cardHeader: "Webhook",
				cardFields: {
					active: "Aktiv:",
					url: "URL:",
					events: "Ereignisse:",
					transform: "Transformation:",
				},
				eventsDisplay: {
					noEvents: "Keine Ereignisse ausgewählt",
				},
				transformDisplay: {
					noTransform: "Raw-Payload (keine Transformation)",
				},
				secretModal: {
					title: "Webhook-Secret generiert",
					description:
						"Ihr Webhook-Geheimnis wurde generiert. Speichern Sie es jetzt, da es später nicht erneut angezeigt werden kann:",
					usage: "Verwenden Sie dieses Geheimnis, um Webhook-Nutzdaten in Ihrer empfangenden Anwendung zu überprüfen.",
					gotIt: "Verstanden",
				},
				editModal: {
					title: "Webhook bearbeiten",
					eventsHeader: "Ereignisse zum Abonnieren",
				},
				events: {
					taskCreated: {
						label: "Aufgabe erstellt",
						description: "Wenn neue Aufgaben erstellt werden",
					},
					taskUpdated: {
						label: "Aufgabe aktualisiert",
						description: "Wenn Aufgaben geändert werden",
					},
					taskCompleted: {
						label: "Aufgabe abgeschlossen",
						description: "Wenn Aufgaben als abgeschlossen markiert werden",
					},
					taskDeleted: {
						label: "Aufgabe gelöscht",
						description: "Wenn Aufgaben gelöscht werden",
					},
					taskArchived: {
						label: "Aufgabe archiviert",
						description: "Wenn Aufgaben archiviert werden",
					},
					taskUnarchived: {
						label: "Aufgabe entarchiviert",
						description: "Wenn Aufgaben entarchiviert werden",
					},
					timeStarted: {
						label: "Zeit gestartet",
						description: "Wenn Zeiterfassung beginnt",
					},
					timeStopped: {
						label: "Zeit gestoppt",
						description: "Wenn Zeiterfassung stoppt",
					},
					pomodoroStarted: {
						label: "Pomodoro gestartet",
						description: "Wenn Pomodoro-Sitzungen beginnen",
					},
					pomodoroCompleted: {
						label: "Pomodoro abgeschlossen",
						description: "Wenn Pomodoro-Sitzungen beendet werden",
					},
					pomodoroInterrupted: {
						label: "Pomodoro unterbrochen",
						description: "Wenn Pomodoro-Sitzungen gestoppt werden",
					},
					recurringCompleted: {
						label: "Wiederkehrende Instanz abgeschlossen",
						description: "Wenn wiederkehrende Aufgabeninstanzen abgeschlossen werden",
					},
					reminderTriggered: {
						label: "Erinnerung ausgelöst",
						description: "Wenn Aufgabenerinnerungen aktiviert werden",
					},
				},
				modals: {
					secretGenerated: {
						title: "Webhook-Secret generiert",
						description:
							"Ihr Webhook-Geheimnis wurde generiert. Speichern Sie es jetzt, da es später nicht erneut angezeigt werden kann:",
						usage: "Verwenden Sie dieses Geheimnis, um Webhook-Nutzdaten in Ihrer empfangenden Anwendung zu überprüfen.",
						buttonText: "Verstanden",
					},
					edit: {
						title: "Webhook bearbeiten",
						eventsSection: "Ereignisse zum Abonnieren",
						transformSection: "Transformationskonfiguration (Optional)",
						headersSection: "Header-Konfiguration",
						transformFile: {
							name: "Transformationsdatei",
							description:
								"Pfad zu einer .json Vorlagendatei in Ihrem Vault, die Webhook-Payloads transformiert",
							placeholder: "simple-template.json",
						},
						customHeaders: {
							name: "Benutzerdefinierte Header einschließen",
							description:
								"TaskNotes-Header einschließen (Ereignis-Typ, Signatur, Lieferungs-ID). Für Discord, Slack und andere Dienste mit strengen CORS-Richtlinien ausschalten.",
						},
						buttons: {
							cancel: "Abbrechen",
							save: "Änderungen speichern",
						},
						notices: {
							selectAtLeastOneEvent: "Bitte wählen Sie mindestens ein Ereignis aus",
						},
					},
					add: {
						title: "Webhook hinzufügen",
						eventsSection: "Ereignisse zum Abonnieren",
						transformSection: "Transformationskonfiguration (Optional)",
						headersSection: "Header-Konfiguration",
						url: {
							name: "Webhook-URL",
							description: "Der Endpunkt, an den Webhook-Payloads gesendet werden",
							placeholder: "https://beispiel.de/webhook",
						},
						transformFile: {
							name: "Transformationsdatei",
							description:
								"Pfad zu einer .json Vorlagendatei in Ihrem Vault, die Webhook-Payloads transformiert",
							placeholder: "simple-template.json",
						},
						customHeaders: {
							name: "Benutzerdefinierte Header einschließen",
							description:
								"TaskNotes-Header einschließen (Ereignis-Typ, Signatur, Lieferungs-ID). Für Discord, Slack und andere Dienste mit strengen CORS-Richtlinien ausschalten.",
						},
						transformHelp: {
							title: "Mit JSON-Transformationsvorlagen können Sie Webhook-Nutzdaten anpassen:",
							jsFiles: "",
							jsDescription: "",
							jsonFiles: ".json Dateien:",
							jsonDescription: " Vorlagen mit ",
							jsonVariable: "${data.task.title}",
							leaveEmpty: "Leer lassen:",
							leaveEmptyDescription: " Raw-Daten senden",
							example: "Beispiel:",
							exampleFile: "simple-template.json",
						},
						buttons: {
							cancel: "Abbrechen",
							add: "Webhook hinzufügen",
						},
						notices: {
							urlRequired: "Webhook URL ist erforderlich",
							selectAtLeastOneEvent: "Bitte wählen Sie mindestens ein Ereignis aus",
						},
					},
				},
			},
			otherIntegrations: {
				header: "Andere Plugin-Integrationen",
				description: "Konfigurieren Sie Integrationen mit anderen Obsidian-Plugins.",
			},
			mdbaseSpec: {
				header: "mdbase-Typdefinitionen",
				learnMore: "Mehr über mdbase-spec erfahren",
				enable: {
					name: "mdbase-Typdefinitionen generieren",
					description:
						"mdbase-Typdateien (mdbase.yaml und _types/task.md) im Stammverzeichnis des Vaults generieren und pflegen, wenn sich Ihre Einstellungen ändern.",
				},
			},
			timeFormats: {
				justNow: "Gerade eben",
				minutesAgo: "vor {minutes} Minute{plural}",
				hoursAgo: "vor {hours} Stunde{plural}",
				daysAgo: "vor {days} Tag{plural}",
			},
		},
	},
	notices: {
		audit: {
			progress: "{action} — Aufgaben: {count}…",
			result: "{action} — erfolgreich: {count}; fehlgeschlagen: {failed}.",
			failed: "Aktion fehlgeschlagen: {action}",
			update: "Aufgaben aktualisieren",
			copiedTasks: "Kopierte Aufgaben: {count}",
			copiedRows: "Kopierte Zeilen: {count}",
			exportedRows: "Exportierte Zeilen: {count}",
			noTasksCopy: "Keine Aufgaben zum Kopieren",
			deleteTitle: "Aufgaben löschen",
			deleteConfirm:
				"Aufgaben löschen ({count})? Diese Aktion kann nicht rückgängig gemacht werden.",
			noNotes: "Keine Notizen für die ausgewählten Daten gefunden",
			weeklyDisabled:
				"Das Plugin für Wochennotizen ist deaktiviert. Aktivieren Sie es in den Einstellungen.",
			weeklyFailed: "Wochennotiz konnte nicht erstellt werden: {message}",
			rescheduled:
				"Nächstes Vorkommen verschoben; das Wiederholungsmuster bleibt unverändert.",
			allDay: "Wiederkehrende Aufgabe auf ganztägig gesetzt; dies gilt für alle zukünftigen Vorkommen.",
			recurringTime:
				"Uhrzeit der wiederkehrenden Aufgabe auf {time} gesetzt; dies gilt für alle zukünftigen Vorkommen.",
			timeblockCopied: "Zeitblock dupliziert",
			timeblockMoved: "Zeitblock verschoben",
			timeblockResized: "Zeitblockdauer aktualisiert",
			occurrenceOpened: "Notiz zum Vorkommen am {date} geöffnet",
			occurrenceCreated: "Notiz zum Vorkommen am {date} erstellt",
			occurrencePolicy: "Notizen zu Vorkommen: {mode}",
		},

		interface: {
			apiStarted: "TaskNotes-API auf Port {port} gestartet",
			apiFailed:
				"TaskNotes-API-Server konnte nicht gestartet werden. Details finden Sie in der Konsole.",
			serviceUnavailable: "Dienst nicht verfügbar. Laden Sie das Plugin erneut.",
			subtasksFailed: "Unteraufgaben konnten nicht ein- oder ausgeblendet werden",
			statusFailed: "Aufgabenstatus konnte nicht aktualisiert werden: {message}",
			priorityFailed: "Priorität konnte nicht aktualisiert werden",
			recurrenceFailed: "Wiederholung konnte nicht aktualisiert werden",
			occurrenceOpenFailed: "Notiz zum Vorkommen konnte nicht geöffnet werden: {message}",
			parentMissing: "Übergeordnete wiederkehrende Aufgabe nicht gefunden",
			parentOpenFailed:
				"Übergeordnete wiederkehrende Aufgabe konnte nicht geöffnet werden: {message}",
			deleted: "Aufgabe gelöscht",
			contextMenuFailed: "Kontextmenü konnte nicht erstellt werden: {message}",
			noteMissing: "Notiz „{title}“ nicht gefunden",
			noteOpenFailed: "Notiz „{title}“ konnte nicht geöffnet werden",
			trackingActive: "Zeiterfassung ist für diese Aufgabe bereits aktiv",
			trackingInactive: "Keine aktive Zeiterfassung für diese Aufgabe",
			trackingStopFailed: "Zeiterfassung konnte nicht gestoppt werden",
			noOverdue: "Keine überfälligen geplanten Aufgaben zum Verschieben",
			postponeTitle: "Überfällige geplante Aufgaben verschieben",
			postponeConfirm:
				"Aktive überfällige geplante Aufgaben auf heute ({today}) verschieben? Anzahl: {count}.",
			postpone: "Verschieben",
			postponing: "Aufgaben werden verschoben: {count}…",
			postponed: "Verschobene Aufgaben: {count}. Fehlgeschlagen: {failed}.",
			postponeFailed: "Überfällige geplante Aufgaben konnten nicht verschoben werden",
			commandFileMissing: "Keine Datei für diesen Befehl konfiguriert: {command}",
			commandFileInvalid:
				"Datei nicht gefunden: {path}. Konfigurieren Sie eine gültige Datei unter Ansichtsbefehle oder erstellen Sie die Standarddateien.",
			commandFileUnindexed:
				"Datei im Vault nicht gefunden: {path}. Die Datei existiert, wird von Obsidian aber nicht gefunden. Laden Sie den Vault erneut.",
			notAFile: "Pfad ist keine Datei: {path}",
		},

		commands: {
			basesCreated: "Standard-Bases-Dateien erstellt ({count}):\n{files}",
			basesUpdated: "Standard-Bases-Dateien aktualisiert ({count}):\n{files}",
			basesExist: "Standard-Bases-Dateien sind bereits vorhanden:\n{files}",
			tagQueryFailed:
				"Suchbereich geöffnet, aber die Tag-Abfrage konnte nicht gesetzt werden",
			tagSearchFailed: "Suchbereich für Tag konnte nicht geöffnet werden: {tag}",
			dailyNotesDisabled:
				"Das integrierte Plugin Tägliche Notizen ist deaktiviert. Aktivieren Sie es unter Einstellungen > Obsidian-Erweiterungen.",
			dailyNoteCreateFailed: "Tägliche Notiz konnte nicht erstellt werden: {message}",
			dailyNoteOpenFailed: "Tägliche Notiz konnte nicht geöffnet werden: {message}",
			statusChanged: "Aufgabe als „{status}“ markiert",
			taskUpdated: "Aufgabe aktualisiert",
			taskUpdateFailed: "Aufgabe konnte nicht aktualisiert werden",
			recurringUpdateFailed: "Wiederkehrende Aufgabe konnte nicht aktualisiert werden",
			archived: "Aufgabe archiviert",
			unarchived: "Aufgabe aus dem Archiv wiederhergestellt",
			archiveFailed: "Archivstatus der Aufgabe konnte nicht geändert werden",
			statusFailed: "Aufgabenstatus konnte nicht aktualisiert werden",
			cacheRefreshing: "TaskNotes-Cache wird aktualisiert…",
			cacheRefreshed: "TaskNotes-Cache erfolgreich aktualisiert",
			cacheFailed: "Cache konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.",
			conversionUnavailable:
				"Aufgabenkonvertierung ist nicht verfügbar. Bitte versuchen Sie es erneut.",
			batchConversionFailed:
				"Stapelkonvertierung der Aufgaben fehlgeschlagen. Bitte versuchen Sie es erneut.",
			linkFileMissing: "Link konnte nicht erstellt werden: Datei nicht gefunden",
			linkInsertFailed: "Aufgabenlink konnte nicht eingefügt werden",
			noOpenFile: "Derzeit ist keine Datei geöffnet",
			quickActionsFailed: "Schnellaktionen konnten nicht geöffnet werden",
			noTaskLink: "Kein Aufgabenlink gefunden",
			taskLoadFailed: "Aktuelle Aufgabe konnte nicht geladen werden",
			statusCycleFailed: "Aufgabenstatus konnte nicht weitergeschaltet werden",
			priorityCycleFailed: "Aufgabenpriorität konnte nicht weitergeschaltet werden",
			inlineCreateFailed: "Inline-Aufgabe konnte nicht erstellt werden",
			inlineCreated: "Inline-Aufgabe „{title}“ erstellt und verknüpft",
		},

		languagePackDownloadFailed:
			"{language} konnte nicht geladen werden. Die aktuelle Sprache bleibt unverändert. Versuchen Sie es in den Einstellungen für die Oberflächensprache erneut.",
		languageChanged: "Sprache auf {language} geändert.",
		recurringCompletion: {
			completed: "Vorkommen abgeschlossen: {date}",
			incomplete: "Als unerledigt markiert: {date}",
			next: "Nächstes: {date}",
			noNext: "Kein weiteres Vorkommen",
			undo: "Rückgängig",
			undone: "Änderung der wiederkehrenden Aufgabe rückgängig gemacht.",
			conflict: "Rückgängig nicht möglich: Dieses Vorkommen oder sein Termin wurde geändert.",
			failed: "Die Änderung der wiederkehrenden Aufgabe konnte nicht rückgängig gemacht werden.",
		},
		releaseAvailable: {
			message: "TaskNotes {version} ist verfügbar.",
			action: "In Community-Plugins öffnen",
		},
		exportTasksFailed: "Export der Aufgaben als ICS-Datei fehlgeschlagen",
		icsNoteCreatedSuccess: "Notiz erfolgreich erstellt",
		icsCreationModalOpenFailed: "Erstellungsmodal konnte nicht geöffnet werden",
		icsNoteLinkSuccess: "Notiz „{fileName}“ mit ICS-Ereignis verknüpft",
		icsTaskCreatedSuccess: "Aufgabe erstellt: {title}",
		icsRelatedItemsRefreshed: "Verknüpfte Notizen aktualisiert",
		icsFileNotFound: "Datei nicht gefunden oder ungültig",
		icsFileOpenFailed: "Datei konnte nicht geöffnet werden",
		timeblockAttachmentExists: '"{fileName}" ist bereits angehängt',
		timeblockAttachmentAdded: '"{fileName}" als Anhang hinzugefügt',
		timeblockAttachmentRemoved: '"{fileName}" aus Anhängen entfernt',
		timeblockFileTypeNotSupported:
			'"{fileName}" kann nicht geöffnet werden - Dateityp nicht unterstützt',
		timeblockTitleRequired: "Bitte geben Sie einen Titel für den Zeitblock ein",
		timeblockUpdatedSuccess: "Zeitblock „{title}“ aktualisiert",
		timeblockUpdateFailed:
			"Zeitblock konnte nicht aktualisiert werden. Prüfen Sie die Konsole für Details.",
		timeblockDeletedSuccess: "Zeitblock „{title}“ gelöscht",
		timeblockDeleteFailed:
			"Zeitblock konnte nicht gelöscht werden. Prüfen Sie die Konsole für Details.",
		timeblockRequiredFieldsMissing: "Bitte füllen Sie alle erforderlichen Felder aus",
		agendaLoadingFailed: "Fehler beim Laden der Agenda. Versuchen Sie eine Aktualisierung.",
		statsLoadingFailed: "Fehler beim Laden der Projektdetails.",
	},
	commands: {
		openCalendarView: "Mini-Kalenderansicht öffnen",
		openAdvancedCalendarView: "Kalenderansicht öffnen",
		openTasksView: "Aufgabenansicht öffnen",
		openNotesView: "Notizenansicht öffnen",
		openAgendaView: "Agenda-Ansicht öffnen",
		openPomodoroView: "Pomodoro-Timer öffnen",
		openKanbanView: "Kanban-Board öffnen",
		updateDefaultBaseFiles: "Standard-Base-Dateien aktualisieren",
		openPomodoroStats: "Pomodoro-Statistiken öffnen",
		openStatisticsView: "Aufgaben- & Projektstatistiken öffnen",
		createNewTask: "Neue Aufgabe erstellen",
		convertCurrentNoteToTask: {
			name: "Aktuelle Notiz in Aufgabe umwandeln",
			noActiveFile: "Keine aktive Datei zum Umwandeln",
			alreadyTask: "Diese Notiz ist bereits eine Aufgabe",
			success: "'{title}' in eine Aufgabe umgewandelt",
		},
		convertToTaskNote: "Kontrollkästchen-Aufgabe in TaskNote umwandeln",
		convertAllTasksInNote: "Alle Aufgaben in Notiz konvertieren",
		insertTaskNoteLink: "TaskNote-Link einfügen",
		createInlineTask: "Neue Inline-Aufgabe erstellen",
		quickActionsCurrentTask: "Schnellaktionen für aktuelle Aufgabe",
		goToTodayNote: "Zu heutiger Notiz gehen",
		startPomodoro: "Pomodoro-Timer starten",
		stopPomodoro: "Pomodoro-Timer stoppen",
		pauseResumePomodoro: "Pomodoro-Timer pausieren/fortsetzen",
		refreshCache: "Cache aktualisieren",
		exportAllTasksIcs: "Alle Aufgaben als ICS-Datei exportieren",
		viewReleaseNotes: "Versionshinweise anzeigen",
		startTimeTrackingCurrentTask: "Zeiterfassung für die aktuelle Aufgabe starten",
		stopTimeTrackingCurrentTask: "Zeiterfassung für die aktuelle Aufgabe stoppen",
		stopActiveTimeTracking: "Aktive Zeiterfassung stoppen",
		startTimeTrackingWithSelector: "Zeiterfassung starten (Aufgabe auswählen)",
		editTimeEntries: "Zeiteinträge bearbeiten (Aufgabe auswählen)",
		createOrOpenTask: "Aufgabe erstellen oder öffnen",
		createOrOpenTaskWithTracking: "Aufgabe erstellen oder öffnen und Zeiterfassung starten",
		rolloverOverdueScheduledTasks: "Überfällige geplante Aufgaben auf heute verschieben",
		syncAllTasksGoogleCalendar: "Alle Aufgaben mit Google Kalender synchronisieren",
		syncCurrentTaskGoogleCalendar: "Aktuelle Aufgabe mit Google Kalender synchronisieren",
		quickActionsTaskUnderCursor: "Schnellaktionen für Aufgabe unter dem Cursor",
		editCurrentTask: "Aktuelle Aufgabe bearbeiten",
		cycleCurrentTaskStatus: "Status der aktuellen Aufgabe wechseln",
		cycleCurrentTaskPriority: "Priorität der aktuellen Aufgabe wechseln",
		addProjectToCurrentTask: "Projekt zur aktuellen Aufgabe hinzufügen",
		addSubtaskToCurrentNote: "Unteraufgabe zur aktuellen Notiz hinzufügen",
	},
	modals: {
		propertySelector: {
			title: "Eigenschaften der Aufgabenkarten auswählen",
			description:
				"Wählen Sie die Eigenschaften der Aufgabenkarten aus. Sie erscheinen in der folgenden Reihenfolge.",
			inlineTitle: "Eigenschaften der Inline-Aufgabenkarten auswählen",
		},

		reminder: {
			loading: "Erinnerungen werden geladen…",
			loadFailed: "Aufgabendaten konnten nicht geladen werden. Bitte versuchen Sie es erneut.",
			title: "Aufgabenerinnerungen",
			noChanges: "Keine Änderungen",
			current: "Aktuelle Erinnerungen",
			empty: "Keine Erinnerungen festgelegt",
			addNew: "Neue Erinnerung hinzufügen",
			relative: "Relativ",
			absolute: "Absolut",
			relativeTo: "Bezogen auf",
			noDates: "Keine Datumsangaben verfügbar",
			dueContext: "Fällig: {date}",
			scheduledContext: "Geplant: {date}",
			description: "Beschreibung (optional)",
			descriptionPlaceholder: "Eigene Erinnerungsnachricht",
			addFailed: "Erinnerung konnte nicht hinzugefügt werden. Bitte prüfen Sie Ihre Eingaben.",
			missingDue:
				"Erinnerung kann nicht erstellt werden: Die Aufgabe hat kein Fälligkeitsdatum",
			missingScheduled:
				"Erinnerung kann nicht erstellt werden: Die Aufgabe hat kein geplantes Datum",
			missingDateTime: "Bitte geben Sie Datum und Uhrzeit für die absolute Erinnerung an",
			saveFailed: "Erinnerungen konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.",
			added: "Erinnerung hinzugefügt: {description}",
			at: "Am {date}",
			beforeDue: "Vor Fälligkeit: {duration}",
			afterDue: "Nach Fälligkeit: {duration}",
			beforeScheduled: "Vor geplantem Datum: {duration}",
			afterScheduled: "Nach geplantem Datum: {duration}",
			atDue: "Bei Fälligkeit",
			atScheduled: "Am geplanten Datum",
			quickTooltip: "Erinnerung hinzufügen: {timing}",
		},
		actionPalette: {
			presets: {
				today: "heute",
				tomorrow: "morgen",
				weekend: "dieses Wochenende",
				nextWeek: "nächste Woche",
				nextMonth: "nächsten Monat",
			},

			placeholder: "Aktion suchen…",
			title: "Schnellaktionen: {title}",
			execute: "zum Ausführen",
			statusAction: "Status auf „{label}“ ändern",
			statusDesc: "Aufgabenstatus auf {label} setzen",
			statusChanged: "Status auf {label} geändert",
			priorityAction: "Priorität auf „{label}“ setzen",
			priorityDesc: "Aufgabenpriorität auf {label} ändern",
			priorityChanged: "Priorität auf {label} geändert",
			clearDueDesc: "Fälligkeitsdatum dieser Aufgabe entfernen",
			clearScheduledDesc: "Planungsdatum dieser Aufgabe entfernen",
			dueCleared: "Fälligkeitsdatum entfernt",
			scheduledCleared: "Planungsdatum entfernt",
			startTrackingDesc: "Zeiterfassung für diese Aufgabe starten",
			stopTrackingDesc: "Zeiterfassung für diese Aufgabe stoppen",
			trackingStarted: "Zeiterfassung gestartet",
			trackingStopped: "Zeiterfassung gestoppt",
			editTimeDesc: "Zeiteinträge dieser Aufgabe anzeigen, bearbeiten oder hinzufügen",
			addProjectDesc: "Eine Projektnotiz auswählen und dieser Aufgabe hinzufügen",
			archiveDesc: "Diese Aufgabe archivieren",
			unarchiveDesc: "Aufgabe zurück zu den aktiven Aufgaben verschieben",
			completeOccurrence: "Dieses Vorkommen abschließen",
			completeOccurrenceDesc:
				"Dieses Vorkommen der wiederkehrenden Aufgabe als erledigt markieren",
			occurrenceCompleted: "Vorkommen der wiederkehrenden Aufgabe abgeschlossen",
			openOccurrence: "Notiz zum Vorkommen öffnen oder erstellen",
			openOccurrenceDesc: "Notiz zu diesem Vorkommen öffnen und bei Bedarf erstellen",
			openParent: "Übergeordnete wiederkehrende Aufgabe öffnen",
			openParentDesc: "Wiederkehrende Aufgabe öffnen, die dieses Vorkommen erzeugt hat",
			editTask: "Aufgabendetails bearbeiten",
			editTaskDesc: "Vollständigen Aufgabeneditor öffnen",
			openFile: "Aufgabendatei öffnen",
			openFileDesc: "Aufgabendatei im Editor öffnen",
			copyTitleDesc: "Aufgabentitel in die Zwischenablage kopieren",
			copyLink: "Aufgabenlink kopieren",
			copyLinkDesc: "Wikilink zu dieser Aufgabe kopieren",
			linkCopied: "Aufgabenlink in die Zwischenablage kopiert",
			deleteDesc: "Diese Aufgabe dauerhaft löschen",
			scheduleFor: "Für {date} planen",
			dueFor: "Fälligkeit auf {date} setzen",
			scheduleDesc: "Planungsdatum auf {date} setzen",
			dueDesc: "Fälligkeitsdatum auf {date} setzen",
			scheduledSet: "Planungsdatum festgelegt",
			dueSet: "Fälligkeitsdatum festgelegt",
			taskNotFound: "Aufgabe nicht gefunden",
			actionFailed: "Aktion konnte nicht ausgeführt werden: {message}",
			categories: {
				dates: "Datumsangaben",
				tracking: "Zeiterfassung",
				organization: "Organisation",
				other: "Sonstiges",
			},
		},
		dateTimePicker: {
			placeholder: "Datum oder Datum mit Uhrzeit eingeben",
			naturalLanguage: "Datum in natürlicher Sprache",
			apply: "Datum in natürlicher Sprache übernehmen",
			nativePicker: "System-Datumsauswahl öffnen",
			notFound: "In diesem Text wurde kein Datum gefunden.",
		},
		fileSelector: {
			placeholder: "Dateien suchen oder Namen zum Erstellen eingeben…",
			nameRequired: "Bitte geben Sie einen Dateinamen ein",
			exists: "Datei „{path}“ ist bereits vorhanden",
			createFailed: "Datei konnte nicht erstellt werden",
		},
		projectSelector: {
			placeholder: "Projektnotizen suchen…",
		},

		deviceCode: {
			title: "Google Kalender-Autorisierung",
			instructions: {
				intro: "Um Ihren Google Kalender zu verbinden, folgen Sie bitte diesen Schritten:",
			},
			steps: {
				open: "Öffnen Sie",
				inBrowser: "in Ihrem Browser",
				enterCode: "Geben Sie diesen Code ein, wenn Sie dazu aufgefordert werden:",
				signIn: "Melden Sie sich mit Ihrem Google-Konto an und gewähren Sie Zugriff",
				returnToObsidian:
					"Kehren Sie zu Obsidian zurück (dieses Fenster schließt sich automatisch)",
			},
			codeLabel: "Ihr Code:",
			copyCodeAriaLabel: "Code kopieren",
			waitingForAuthorization: "Warte auf Autorisierung...",
			openBrowserButton: "Browser öffnen",
			cancelButton: "Abbrechen",
			expiresMinutesSeconds: "Code läuft ab in {minutes}m {seconds}s",
			expiresSeconds: "Code läuft ab in {seconds}s",
		},
		icsEventInfo: {
			typeValue: "Typ: {type}",
			searchNotes: "Notizen zum Verknüpfen suchen…",

			calendarEventHeading: "Kalenderereignis",
			titleLabel: "Titel",
			calendarLabel: "Kalender",
			dateTimeLabel: "Datum & Uhrzeit",
			locationLabel: "Ort",
			descriptionLabel: "Beschreibung",
			urlLabel: "URL",
			relatedNotesHeading: "Verknüpfte Notizen & Aufgaben",
			noRelatedItems: "Keine verknüpften Notizen oder Aufgaben für dieses Ereignis gefunden.",
			typeTask: "Aufgabe",
			typeNote: "Notiz",
			actionsHeading: "Aktionen",
			createFromEventLabel: "Aus Ereignis erstellen",
			createFromEventDesc:
				"Eine neue Notiz oder Aufgabe aus diesem Kalenderereignis erstellen",
			linkExistingLabel: "Vorhandene verknüpfen",
			linkExistingDesc: "Eine vorhandene Notiz mit diesem Kalenderereignis verknüpfen",
		},
		timeblockInfo: {
			noTasks: "Keine Aufgaben zur Auswahl verfügbar",
			selectorFailed: "Aufgabenauswahl konnte nicht geöffnet werden",
			confirmDelete: "Zeitblock „{title}“ wirklich löschen?",

			editHeading: "Zeitblock bearbeiten",
			dateTimeLabel: "Datum & Uhrzeit: ",
			titleLabel: "Titel",
			titleDesc: "Titel für Ihren Zeitblock",
			titlePlaceholder: "z.B. Deep Work Session",
			descriptionLabel: "Beschreibung",
			descriptionDesc: "Optionale Beschreibung für den Zeitblock",
			descriptionPlaceholder: "Fokus auf neue Features, keine Unterbrechungen",
			colorLabel: "Farbe",
			colorDesc: "Optionale Farbe für den Zeitblock",
			colorPlaceholder: "#3b82f6",
			attachmentsLabel: "Anhänge",
			attachmentsDesc: "Dateien oder Notizen, die mit diesem Zeitblock verknüpft sind",
			addAttachmentButton: "Anhang hinzufügen",
			addAttachmentTooltip: "Datei oder Notiz mit unscharfer Suche auswählen",
			deleteButton: "Zeitblock löschen",
			saveButton: "Änderungen speichern",
			deleteConfirmationTitle: "Zeitblock löschen",
		},
		timeblockCreation: {
			created: "Zeitblock „{title}“ erfolgreich erstellt",

			heading: "Zeitblock erstellen",
			dateLabel: "Datum: ",
			titleLabel: "Titel",
			titleDesc: "Titel für Ihren Zeitblock",
			titlePlaceholder: "z.B. Deep Work Session",
			startTimeLabel: "Startzeit",
			startTimeDesc: "Wann der Zeitblock beginnt",
			startTimePlaceholder: "09:00",
			endTimeLabel: "Endzeit",
			endTimeDesc: "Wann der Zeitblock endet",
			endTimePlaceholder: "11:00",
			descriptionLabel: "Beschreibung",
			descriptionDesc: "Optionale Beschreibung für den Zeitblock",
			descriptionPlaceholder: "Fokus auf neue Features, keine Unterbrechungen",
			colorLabel: "Farbe",
			colorDesc: "Optionale Farbe für den Zeitblock",
			colorPlaceholder: "#3b82f6",
			attachmentsLabel: "Anhänge",
			attachmentsDesc:
				"Dateien oder Notizen, die mit diesem Zeitblock verknüpft werden sollen",
			addAttachmentButton: "Anhang hinzufügen",
			addAttachmentTooltip: "Datei oder Notiz mit unscharfer Suche auswählen",
			createButton: "Zeitblock erstellen",
		},
		calendarEventCreation: {
			heading: "Kalenderereignis erstellen",
			dateTimeLabel: "Datum & Uhrzeit: ",
			titleLabel: "Titel",
			titleDesc: "Titel für das Kalenderereignis",
			titlePlaceholder: "z.B. Teambesprechung",
			calendarLabel: "Kalender",
			calendarDesc: "In welchem Kalender das Ereignis erstellt werden soll",
			descriptionLabel: "Beschreibung",
			descriptionDesc: "Optionale Beschreibung für das Ereignis",
			descriptionPlaceholder: "Details zu diesem Ereignis hinzufügen...",
			locationLabel: "Ort",
			locationDesc: "Optionaler Ort für das Ereignis",
			locationPlaceholder: "z.B. Konferenzraum A",
			createButton: "Ereignis erstellen",
			titleRequired: "Ereignistitel ist erforderlich",
			noCalendarSelected: "Kein Kalender ausgewählt",
			success: 'Kalenderereignis "{title}" erstellt',
			error: "Kalenderereignis konnte nicht erstellt werden: {message}",
		},
		icsNoteCreation: {
			summary: "Zusammenfassung",
			variables: "Verfügbare Vorlagenvariablen",
			vaultRoot: "Vault-Stammverzeichnis",
			defaultFormat: "Standardformat",
			noteCreated: "Notiz erstellt: {title}",
			titleRequired: "Titel ist erforderlich",
			createFailed: "Notiz aus ICS-Termin konnte nicht erstellt werden",

			heading: "Aus ICS Ereignis erstellen",
			titleLabel: "Titel",
			titleDesc: "Titel für den neuen Inhalt",
			folderLabel: "Ordner",
			folderDesc: "Zielordner (leer lassen für Vault-Wurzel)",
			folderPlaceholder: "ordner/unterordner",
			createButton: "Erstellen",
			startLabel: "Start: ",
			endLabel: "Ende: ",
			locationLabel: "Ort: ",
			calendarLabel: "Kalender: ",
			useTemplateLabel: "Vorlage verwenden",
			useTemplateDesc: "Eine Vorlage beim Erstellen des Inhalts anwenden",
			templatePathLabel: "Vorlagenpfad",
			templatePathDesc: "Pfad zur Vorlagendatei",
			templatePathPlaceholder: "vorlagen/ics-notiz-vorlage.md",
		},
		unscheduledTasksSelector: {
			overdue: "Überfällig: {date}",
			dueToday: "Heute fällig: {date}",
			empty: "Keine ungeplanten Aufgaben gefunden. Alle Aufgaben sind geplant, erledigt oder archiviert.",

			title: "Ungeplante Aufgaben",
			placeholder: "Tippen, um nach ungeplanten Aufgaben zu suchen...",
			instructions: {
				navigate: "zum Navigieren",
				schedule: "zum Planen",
				dismiss: "zum Verwerfen",
			},
		},
		migration: {
			title: "Zum neuen Wiederholungssystem migrieren",
			description:
				"TaskNotes verwendet jetzt branchenübliche RRULE-Muster für Wiederholungen, die komplexere Zeitpläne und bessere Kompatibilität mit anderen Apps ermöglichen.",
			tasksFound: "Aufgaben mit alten Wiederholungsmustern erkannt: {count}",
			noMigrationNeeded: "Keine Aufgaben erfordern Migration",
			warnings: {
				title: "Bevor Sie fortfahren:",
				backup: "Sichern Sie Ihren Vault vor der Migration",
				conversion: "Alte Wiederholungsmuster werden in das neue Format konvertiert",
				normalUsage: "Sie können TaskNotes während der Migration normal weiterverwenden",
				permanent:
					"Diese Änderung ist dauerhaft und kann nicht automatisch rückgängig gemacht werden",
			},
			benefits: {
				title: "Vorteile des neuen Systems:",
				powerfulPatterns: "Komplexe Wiederholungsmuster (z.B. 'jeden 2. Dienstag')",
				performance: "Bessere Leistung bei wiederkehrenden Aufgaben",
				compatibility: "Standard-Wiederholungsformat kompatibel mit anderen Apps",
				nlp: "Verbesserte Unterstützung für natürliche Sprachverarbeitung",
			},
			progress: {
				title: "Migrationsfortschritt",
				preparing: "Migration wird vorbereitet...",
				completed: "Migration erfolgreich abgeschlossen",
				failed: "Migration fehlgeschlagen",
			},
			buttons: {
				migrate: "Migration starten",
				completed: "Schließen",
			},
			errors: {
				title: "Fehler während der Migration:",
			},
			notices: {
				completedWithErrors:
					"Migration mit einigen Fehlern abgeschlossen. Überprüfen Sie die Fehlerliste oben.",
				success: "Alle Aufgaben erfolgreich migriert!",
				failed: "Migration fehlgeschlagen. Bitte überprüfen Sie die Konsole für Details.",
			},
			prompt: {
				message:
					"TaskNotes hat Aufgaben mit dem alten Wiederholungsformat erkannt. Möchten Sie diese jetzt zum neuen System migrieren?",
				migrateNow: "Jetzt migrieren",
				remindLater: "Später erinnern",
			},
		},
		task: {
			titlePlaceholder: "Was muss getan werden?",
			titleLabel: "Titel",
			titleDetailedPlaceholder: "Aufgabentitel...",
			detailsLabel: "Details",
			detailsPlaceholder: "Weitere Details hinzufügen...",
			projectsLabel: "Projekte",
			projectsAdd: "Projekt hinzufügen",
			projectsTooltip: "Projektnotiz mit unscharfer Suche auswählen",
			projectsRemoveTooltip: "Projekt entfernen",
			contextsLabel: "Kontexte",
			contextsPlaceholder: "kontext1, kontext2",
			tagsLabel: "Tags",
			tagsPlaceholder: "schlagwort1, schlagwort2",
			timeEstimateLabel: "Zeitschätzung (Minuten)",
			timeEstimatePlaceholder: "30",
			unsavedChanges: {
				title: "Ungespeicherte Änderungen",
				message: "Sie haben ungespeicherte Änderungen. Möchten Sie diese speichern?",
				save: "Änderungen speichern",
				discard: "Änderungen verwerfen",
				cancel: "Weiter bearbeiten",
			},
			dependencies: {
				blockedBy: "Blockiert von",
				blocking: "Blockierend",
				placeholder: "[[Aufgabennotiz]]",
				addTaskButton: "Aufgabe hinzufügen",
				selectTaskTooltip: "Aufgabennotiz mit unscharfer Suche auswählen",
				removeTaskTooltip: "Aufgabe entfernen",
			},
			organization: {
				projects: "Projekte",
				subtasks: "Unteraufgaben",
				addToProject: "Zu Projekt hinzufügen",
				addToProjectButton: "Zu Projekt hinzufügen",
				addSubtasks: "Unteraufgaben hinzufügen",
				addSubtasksButton: "Unteraufgabe hinzufügen",
				addSubtasksTooltip:
					"Aufgaben auswählen, um sie zu Unteraufgaben dieser Aufgabe zu machen",
				removeSubtaskTooltip: "Unteraufgabe entfernen",
				notices: {
					noEligibleSubtasks:
						"Keine geeigneten Aufgaben verfügbar, um als Unteraufgaben zugewiesen zu werden",
					subtaskSelectFailed: "Unteraufgaben-Auswahl konnte nicht geöffnet werden",
				},
			},
			customFieldsLabel: "Benutzerdefinierte Felder",
			actions: {
				due: "Fälligkeitsdatum setzen",
				scheduled: "Planungsdatum setzen",
				status: "Status setzen",
				priority: "Priorität setzen",
				recurrence: "Wiederholung setzen",
				reminders: "Erinnerungen setzen",
			},
			buttons: {
				openNote: "Notiz öffnen",
				save: "Speichern",
			},
			tooltips: {
				dueValue: "Fällig: {value}",
				scheduledValue: "Geplant: {value}",
				statusValue: "Status: {value}",
				priorityValue: "Priorität: {value}",
				recurrenceValue: "Wiederholung: {value}",
				remindersSingle: "1 Erinnerung gesetzt",
				remindersPlural: "{count} Erinnerungen gesetzt",
			},
			dateMenu: {
				dueTitle: "Fälligkeitsdatum setzen",
				scheduledTitle: "Planungsdatum setzen",
			},
			userFields: {
				textPlaceholder: "{field} eingeben...",
				numberPlaceholder: "0",
				datePlaceholder: "YYYY-MM-DD",
				listPlaceholder: "element1, element2, element3",
				pickDate: "{field}-Datum wählen",
			},
			recurrence: {
				daily: "Täglich",
				weekly: "Wöchentlich",
				everyTwoWeeks: "Alle 2 Wochen",
				weekdays: "Wochentage",
				weeklyOn: "Wöchentlich am {days}",
				monthly: "Monatlich",
				everyThreeMonths: "Alle 3 Monate",
				monthlyOnOrdinal: "Monatlich am {ordinal}",
				monthlyByWeekday: "Monatlich (nach Wochentag)",
				yearly: "Jährlich",
				yearlyOn: "Jährlich am {month} {day}",
				custom: "Benutzerdefiniert",
				countSuffix: "{count} mal",
				untilSuffix: "bis {date}",
				ordinal: "{number}{suffix}",
			},
		},
		taskSelector: {
			title: "Aufgabe auswählen",
			placeholder: "Tippen Sie, um nach Aufgaben zu suchen...",
			instructions: {
				navigate: "zum Navigieren",
				select: "zum Auswählen",
				dismiss: "zum Abbrechen",
			},
			notices: {
				noteNotFound: 'Notiz "{name}" konnte nicht gefunden werden',
			},
			dueDate: {
				overdue: "Fällig: {date} (überfällig)",
				today: "Fällig: Heute",
			},
		},
		taskSelectorWithCreate: {
			title: "Aufgabe erstellen oder öffnen",
			placeholder: "Aufgaben suchen oder eingeben zum Erstellen...",
			instructions: {
				create: "um neue Aufgabe zu erstellen",
			},
			footer: {
				createLabel: " zum Erstellen: ",
			},
			notices: {
				emptyQuery: "Bitte geben Sie eine Aufgabenbeschreibung ein",
				invalidTitle: "Kein gültiger Aufgabentitel erkannt",
			},
		},
		taskCreation: {
			title: "Aufgabe erstellen",
			actions: {
				fillFromNaturalLanguage: "Formular aus natürlicher Sprache ausfüllen",
				hideDetailedOptions: "Detailoptionen ausblenden",
				showDetailedOptions: "Detailoptionen anzeigen",
			},
			nlPlaceholder: "Lebensmittel morgen um 15 Uhr kaufen @zuhause #besorgungen",
			notices: {
				titleRequired: "Bitte geben Sie einen Aufgabentitel ein",
				success: 'Aufgabe "{title}" erfolgreich erstellt',
				successShortened:
					'Aufgabe "{title}" erfolgreich erstellt (Dateiname wegen Länge gekürzt)',
				failure: "Aufgabe konnte nicht erstellt werden: {message}",
				blockingUnresolved: "Konnte nicht auflösen: {entries}",
				openCreatedTaskFailure:
					"Aufgabe erstellt, aber die Aufgabennotiz konnte nicht geöffnet werden.",
			},
		},
		taskEdit: {
			previousMonth: "Vorheriger Monat",
			occurrenceDate: "Vorkommen {date}",

			title: "Aufgabe bearbeiten",
			sections: {
				completions: "Abschlüsse",
				taskInfo: "Aufgabeninformationen",
			},
			metadata: {
				totalTrackedTime: "Gesamte erfasste Zeit:",
				due: "Fällig:",
				scheduled: "Geplant:",
				created: "Erstellt:",
				modified: "Geändert:",
				file: "Datei:",
			},
			buttons: {
				archive: "Archivieren",
				unarchive: "Entarchivieren",
			},
			notices: {
				titleRequired: "Bitte geben Sie einen Aufgabentitel ein",
				noChanges: "Keine Änderungen zu speichern",
				updateSuccess: 'Aufgabe "{title}" erfolgreich aktualisiert',
				updateFailure: "Aufgabe konnte nicht aktualisiert werden: {message}",
				dependenciesUpdateSuccess: "Abhängigkeiten aktualisiert",
				blockingUnresolved: "Konnte nicht auflösen: {entries}",
				fileMissing: "Aufgabendatei konnte nicht gefunden werden: {path}",
				openNoteFailure: "Aufgabennotiz konnte nicht geöffnet werden",
				archiveSuccess: "Aufgabe {action}",
				archiveFailure: "Aufgabe konnte nicht archiviert werden",
				deleteSuccess: "Aufgabe „{title}“ erfolgreich gelöscht",
				deleteFailure: "Aufgabe konnte nicht gelöscht werden: {message}",
			},
			archiveAction: {
				archived: "archiviert",
				unarchived: "entarchiviert",
			},
			deleteConfirmation: {
				title: "Aufgabe löschen",
				message:
					"Möchten Sie „{title}“ wirklich löschen? Dadurch wird die Aufgabennotiz in den Obsidian-Papierkorb verschoben.",
				confirm: "Aufgabe löschen",
			},
		},
		storageLocation: {
			title: {
				migrate: "Pomodoro-Daten migrieren?",
				switch: "Zu täglichen Notizen wechseln?",
			},
			message: {
				migrate:
					"Ihre vorhandenen Pomodoro-Sitzungsdaten werden in das Frontmatter täglicher Notizen migriert. Die Daten werden nach Datum gruppiert und in der jeweiligen täglichen Notiz gespeichert.",
				switch: "Pomodoro-Sitzungsdaten werden im Frontmatter der täglichen Notizen statt in der Plugin-Datendatei gespeichert.",
			},
			whatThisMeans: "Was das bedeutet:",
			bullets: {
				dailyNotesRequired:
					"Tägliche Notizen müssen im Core-Plugin für tägliche Notizen oder in Periodic Notes aktiviert sein",
				storedInNotes: "Daten werden im Frontmatter Ihrer täglichen Notizen gespeichert",
				migrateData: "Bestehende Plugin-Daten werden migriert und dann gelöscht",
				futureSessions: "Zukünftige Sitzungen werden in täglichen Notizen gespeichert",
				dataLongevity: "Dies bietet bessere Datenbeständigkeit mit Ihren Notizen",
			},
			finalNote: {
				migrate:
					"⚠️ Erstellen Sie bei Bedarf eine Sicherung. Diese Änderung kann nicht automatisch rückgängig gemacht werden.",
				switch: "Sie können jederzeit in Zukunft zurück zur Plugin-Speicherung wechseln.",
			},
			buttons: {
				migrate: "Daten migrieren",
				switch: "Speicherung wechseln",
			},
		},
		dueDate: {
			title: "Fälligkeitsdatum setzen",
			taskLabel: "Aufgabe: {title}",
			sections: {
				dateTime: "Fälligkeitsdatum & Zeit",
				quickOptions: "Schnelloptionen",
			},
			descriptions: {
				dateTime: "Legen Sie fest, bis wann diese Aufgabe abgeschlossen sein soll",
			},
			inputs: {
				date: {
					ariaLabel: "Fälligkeitsdatum für Aufgabe",
					placeholder: "YYYY-MM-DD",
				},
				time: {
					ariaLabel: "Fälligkeitszeit für Aufgabe (optional)",
					placeholder: "HH:MM",
				},
			},
			quickOptions: {
				today: "Heute",
				todayAriaLabel: "Fälligkeitsdatum auf heute setzen",
				tomorrow: "Morgen",
				tomorrowAriaLabel: "Fälligkeitsdatum auf morgen setzen",
				nextWeek: "Nächste Woche",
				nextWeekAriaLabel: "Fälligkeitsdatum auf nächste Woche setzen",
				now: "Jetzt",
				nowAriaLabel: "Fälligkeitsdatum und -zeit auf jetzt setzen",
				clear: "Löschen",
				clearAriaLabel: "Fälligkeitsdatum löschen",
			},
			errors: {
				invalidDateTime: "Bitte geben Sie ein gültiges Datums- und Zeitformat ein",
				updateFailed:
					"Fälligkeitsdatum konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.",
			},
		},
		scheduledDate: {
			title: "Planungsdatum setzen",
			taskLabel: "Aufgabe: {title}",
			sections: {
				dateTime: "Planungsdatum & Zeit",
				quickOptions: "Schnelloptionen",
			},
			descriptions: {
				dateTime: "Legen Sie fest, wann Sie an dieser Aufgabe arbeiten möchten",
			},
			inputs: {
				date: {
					ariaLabel: "Planungsdatum für Aufgabe",
					placeholder: "YYYY-MM-DD",
				},
				time: {
					ariaLabel: "Planungszeit für Aufgabe (optional)",
					placeholder: "HH:MM",
				},
			},
			quickOptions: {
				today: "Heute",
				todayAriaLabel: "Planungsdatum auf heute setzen",
				tomorrow: "Morgen",
				tomorrowAriaLabel: "Planungsdatum auf morgen setzen",
				nextWeek: "Nächste Woche",
				nextWeekAriaLabel: "Planungsdatum auf nächste Woche setzen",
				now: "Jetzt",
				nowAriaLabel: "Planungsdatum und -zeit auf jetzt setzen",
				clear: "Löschen",
				clearAriaLabel: "Planungsdatum löschen",
			},
			errors: {
				invalidDateTime: "Bitte geben Sie ein gültiges Datums- und Zeitformat ein",
				updateFailed:
					"Planungsdatum konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.",
			},
		},
		timeEntryEditor: {
			title: "Zeiteinträge - {taskTitle}",
			addEntry: "Zeiteintrag hinzufügen",
			noEntries: "Noch keine Zeiteinträge",
			deleteEntry: "Eintrag löschen",
			startTime: "Startzeit",
			endTime: "Endzeit (leer lassen, falls noch laufend)",
			duration: "Dauer (Minuten)",
			durationDesc: "Berechnete Dauer überschreiben",
			durationPlaceholder: "Dauer in Minuten eingeben",
			description: "Beschreibung",
			descriptionPlaceholder: "Woran haben Sie gearbeitet?",
			calculatedDuration: "Berechnet: {minutes} Minuten",
			totalTime: "{hours}h {minutes}m gesamt",
			totalMinutes: "{minutes}m gesamt",
			saved: "Zeiteinträge gespeichert",
			saveFailed: "Speichern der Zeiteinträge fehlgeschlagen",
			openFailed: "Öffnen des Zeiteintrag-Editors fehlgeschlagen",
			noTasksWithEntries: "Keine Aufgaben mit Zeiteinträgen zum Bearbeiten",
			validation: {
				missingStartTime: "Startzeit ist erforderlich",
				endBeforeStart: "Endzeit muss nach der Startzeit liegen",
			},
		},
		timeTracking: {
			noActiveTasks: "Keine aktive Zeiterfassung gefunden",
			stopFailed: "Aktive Zeiterfassungen konnten nicht geladen werden",
			noTasksAvailable: "Keine Aufgaben zur Zeiterfassung verfügbar",
			started: "Zeiterfassung gestartet für: {taskTitle}",
			startFailed: "Starten der Zeiterfassung fehlgeschlagen",
		},
		timeEntry: {
			mustHaveSpecificTime:
				"Zeiteinträge müssen spezifische Zeiten haben. Bitte wählen Sie einen Zeitbereich in der Wochen- oder Tagesansicht.",
			noTasksAvailable: "Keine Aufgaben zum Erstellen von Zeiteinträgen verfügbar",
			created: "Zeiteintrag erstellt für {taskTitle} ({duration} Minuten)",
			createFailed: "Erstellen des Zeiteintrags fehlgeschlagen",
		},
	},
	contextMenus: {
		task: {
			status: "Status",
			statusSelected: "✓ {label}",
			priority: "Priorität",
			prioritySelected: "✓ {label}",
			dueDate: "Fälligkeitsdatum",
			scheduledDate: "Planungsdatum",
			customDates: "Benutzerdefinierte Datumsfelder",
			reminders: "Erinnerungen",
			remindBeforeDue: "Vor Fälligkeit erinnern…",
			remindBeforeScheduled: "Vor dem geplanten Termin erinnern…",
			manageReminders: "Alle Erinnerungen verwalten…",
			clearReminders: "Alle Erinnerungen löschen",
			startTimeTracking: "Zeiterfassung starten",
			stopTimeTracking: "Zeiterfassung stoppen",
			editTimeEntries: "Zeiteinträge bearbeiten",
			archive: "Archivieren",
			unarchive: "Entarchivieren",
			openNote: "Notiz öffnen",
			openNoteInNewTab: "Notiz in neuem Tab öffnen",
			copyTitle: "Aufgabentitel kopieren",
			quickActions: "Schnellaktionen",
			noteActions: "Notizaktionen",
			rename: "Umbenennen",
			renameTitle: "Datei umbenennen",
			renamePlaceholder: "Neuen Namen eingeben",
			delete: "Löschen",
			deleteTitle: "Datei löschen",
			deleteMessage: "Möchten Sie „{name}“ wirklich löschen?",
			deleteConfirm: "Löschen",
			copyPath: "Pfad kopieren",
			copyUrl: "Obsidian URL kopieren",
			showInExplorer: "Im Datei-Explorer anzeigen",
			addToCalendar: "Zum Kalender hinzufügen",
			calendar: {
				google: "Google Kalender",
				outlook: "Outlook Kalender",
				yahoo: "Yahoo Kalender",
				downloadIcs: ".ics Datei herunterladen",
				syncToGoogle: "Mit Google Kalender synchronisieren",
				syncToGoogleNotConfigured: "Google Kalender-Synchronisierung nicht konfiguriert",
				syncToGoogleSuccess: "Aufgabe mit Google Kalender synchronisiert",
				syncToGoogleFailed: "Synchronisierung mit Google Kalender fehlgeschlagen",
			},
			recurrence: "Wiederholung",
			clearRecurrence: "Wiederholung löschen",
			customRecurrence: "Benutzerdefinierte Wiederholung...",
			createSubtask: "Unteraufgabe erstellen",
			dependencies: {
				title: "Abhängigkeiten",
				addBlockedBy: "„Blockiert durch“ hinzufügen…",
				addBlockedByTitle: "Aufgaben hinzufügen, von denen dies abhängt",
				addBlocking: "„Blockiert“ hinzufügen…",
				addBlockingTitle: "Aufgaben hinzufügen, die dies blockiert",
				removeBlockedBy: "„Blockiert durch“ entfernen…",
				removeBlocking: "„Blockiert“ entfernen…",
				unknownDependency: "Unbekannt",
				inputPlaceholder: "[[Aufgabennotiz]]",
				notices: {
					noEntries: "Bitte geben Sie mindestens eine Aufgabe ein",
					blockedByAdded: "Hinzugefügte Abhängigkeiten: {count}",
					blockedByRemoved: "Abhängigkeit entfernt",
					blockingAdded: "Hinzugefügte abhängige Aufgaben: {count}",
					blockingRemoved: "Abhängige Aufgabe entfernt",
					unresolved: "Konnte nicht auflösen: {entries}",
					noEligibleTasks: "Keine passenden Aufgaben verfügbar",
					updateFailed: "Abhängigkeiten konnten nicht aktualisiert werden",
				},
			},
			organization: {
				title: "Organisation",
				projects: "Projekte",
				addToProject: "Zu Projekt hinzufügen…",
				subtasks: "Unteraufgaben",
				addSubtasks: "Unteraufgaben hinzufügen…",
				notices: {
					alreadyInProject: "Aufgabe ist bereits in diesem Projekt",
					alreadySubtask: "Aufgabe ist bereits eine Unteraufgabe dieser Aufgabe",
					addedToProject: "Zu Projekt hinzugefügt: {project}",
					addedAsSubtask: "{subtask} als Unteraufgabe von {parent} hinzugefügt",
					addToProjectFailed: "Hinzufügen der Aufgabe zum Projekt fehlgeschlagen",
					addAsSubtaskFailed: "Hinzufügen der Aufgabe als Unteraufgabe fehlgeschlagen",
					projectSelectFailed: "Projektauswahl konnte nicht geöffnet werden",
					subtaskSelectFailed: "Unteraufgaben-Auswahl konnte nicht geöffnet werden",
					noEligibleSubtasks:
						"Keine geeigneten Aufgaben verfügbar, um als Unteraufgaben zugewiesen zu werden",
					currentTaskNotFound: "Aktuelle Aufgabendatei nicht gefunden",
					updateContextsFailed: "Kontexte konnten nicht aktualisiert werden",
				},
				contexts: "Kontexte",
				addContext: "Kontext hinzufügen…",
				contextPlaceholder: "Kontext",
				contextSelected: "✓ {context}",
				clearContexts: "Kontexte löschen",
			},
			subtasks: {
				loading: "Unteraufgaben werden geladen...",
				noSubtasks: "Keine Unteraufgaben gefunden",
				loadFailed: "Unteraufgaben konnten nicht geladen werden",
			},
			markComplete: "Als abgeschlossen für dieses Datum markieren",
			markIncomplete: "Als unvollständig für dieses Datum markieren",
			skipInstance: "Instanz überspringen",
			unskipInstance: "Instanz nicht überspringen",
			completion: {
				submenu: "Als abgeschlossen markieren oder überspringen",
				submenuCompleteOnly: "Als abgeschlossen markieren",
				completeToday: "Heute abgeschlossen",
				completeAsScheduled: "Am geplanten Datum abgeschlossen",
				completeOnDue: "Am Fälligkeitsdatum abgeschlossen",
				completeOnPicked: "An ausgewähltem Datum abschließen",
				markIncomplete: "Als unvollständig markieren",
				noScheduledDate: "Für diese Aufgabe ist kein geplantes Datum festgelegt",
				noDueDate: "Für diese Aufgabe ist kein Fälligkeitsdatum festgelegt",
				noPickedDate: "Kein Datum ausgewählt",
				noCompletedStatus: "Kein Status für abgeschlossene Aufgaben konfiguriert",
				pickDateTitle: "Abschlussdatum wählen",
				completeFailure: "Aufgabenabschluss konnte nicht aktualisiert werden: {message}",
				clearInstancesConfirmTitle: "Aufgezeichnete Instanzen löschen?",
				clearInstancesConfirmMessage:
					"Durch die Neuplanung werden diese aufgezeichneten abgeschlossenen oder übersprungenen Instanzen am oder nach dem neuen Datum gelöscht: {dates}. Sie werden nicht mehr als abgeschlossen oder übersprungen markiert sein. Fortfahren?",
				clearInstancesConfirmButton: "Neu planen und löschen",
			},
			quickReminders: {
				atTime: "Zum Zeitpunkt des Ereignisses",
				fiveMinutes: "5 Minuten vorher",
				fifteenMinutes: "15 Minuten vorher",
				oneHour: "1 Stunde vorher",
				oneDay: "1 Tag vorher",
			},
			notices: {
				toggleCompletionFailure:
					"Abschluss der wiederkehrenden Aufgabe konnte nicht umgeschaltet werden: {message}",
				toggleSkipFailure:
					"Überspringen der wiederkehrenden Aufgabe konnte nicht umgeschaltet werden: {message}",
				updateDueDateFailure:
					"Aufgaben-Fälligkeitsdatum konnte nicht aktualisiert werden: {message}",
				updateScheduledFailure:
					"Aufgaben-Planungsdatum konnte nicht aktualisiert werden: {message}",
				updateCustomDateFailure: "Fehler beim Aktualisieren von {field}: {message}",
				updateRemindersFailure: "Erinnerungen konnten nicht aktualisiert werden",
				clearRemindersFailure: "Erinnerungen konnten nicht gelöscht werden",
				addReminderFailure: "Erinnerung konnte nicht hinzugefügt werden",
				archiveFailure: "Aufgabenarchiv konnte nicht umgeschaltet werden: {message}",
				copyTitleSuccess: "Aufgabentitel in Zwischenablage kopiert",
				copyFailure: "Kopieren in Zwischenablage fehlgeschlagen",
				renameSuccess: 'Umbenannt zu "{name}"',
				renameFailure: "Datei konnte nicht umbenannt werden",
				copyPathSuccess: "Dateipfad in Zwischenablage kopiert",
				copyUrlSuccess: "Obsidian URL in Zwischenablage kopiert",
				updateRecurrenceFailure:
					"Aufgabenwiederholung konnte nicht aktualisiert werden: {message}",
				updateTagsFailed: "Tags konnten nicht aktualisiert werden",
			},
			tags: "Tags",
			addTag: "Tag hinzufügen…",
			removeTag: "{tag} entfernen",
			removeTagInput: "Tag entfernen…",
			tagPlaceholder: "Tag oder #tag",
			clearTags: "Tags löschen",
		},
		priority: {
			clearPriority: "Priorität löschen",
		},
		ics: {
			showDetails: "Details anzeigen",
			createTask: "Aufgabe aus Ereignis erstellen",
			createNote: "Notiz aus Ereignis erstellen",
			linkNote: "Bestehende Notiz verlinken",
			copyTitle: "Titel kopieren",
			copyLocation: "Ort kopieren",
			copyUrl: "URL kopieren",
			copyMarkdown: "Als Markdown kopieren",
			subscriptionUnknown: "Unbekannter Kalender",
			notices: {
				copyTitleSuccess: "Ereignis-Titel in Zwischenablage kopiert",
				copyLocationSuccess: "Ort in Zwischenablage kopiert",
				copyUrlSuccess: "Ereignis-URL in Zwischenablage kopiert",
				copyMarkdownSuccess: "Ereignis-Details als Markdown kopiert",
				copyFailure: "Kopieren in Zwischenablage fehlgeschlagen",
				taskCreated: "Aufgabe erstellt: {title}",
				taskCreateFailure: "Aufgabe aus Ereignis konnte nicht erstellt werden",
				noteCreated: "Notiz erfolgreich erstellt",
				creationFailure: "Erstellungsmodal konnte nicht geöffnet werden",
				linkSuccess: "Notiz \"{name}\" mit Ereignis verlinkt",
				linkFailure: "Notiz konnte nicht verlinkt werden",
				linkSelectionFailure: "Notizauswahl konnte nicht geöffnet werden",
			},
			markdown: {
				titleFallback: "Unbenanntes Ereignis",
				calendar: "**Kalender:** {value}",
				date: "**Datum & Zeit:** {value}",
				location: "**Ort:** {value}",
				descriptionHeading: "### Beschreibung",
				url: "**URL:** {value}",
				at: " um {time}",
			},
		},
		date: {
			increment: {
				plusOneDay: "+1 Tag",
				minusOneDay: "-1 Tag",
				plusOneWeek: "+1 Woche",
				minusOneWeek: "-1 Woche",
			},
			basic: {
				today: "Heute",
				tomorrow: "Morgen",
				thisWeekend: "Dieses Wochenende",
				nextWeek: "Nächste Woche",
				nextMonth: "Nächster Monat",
			},
			weekdaysLabel: "Wochentage",
			selected: "✓ {label}",
			pickDateTime: "Datum & Zeit wählen…",
			clearDate: "Datum löschen",
			modal: {
				title: "Datum & Zeit setzen",
				dateLabel: "Datum",
				timeLabel: "Zeit (optional)",
				select: "Auswählen",
			},
		},
	},
	services: {
		pomodoro: {
			notices: {
				alreadyRunning: "Ein Pomodoro läuft bereits",
				resumeCurrentSession:
					"Setzen Sie die aktuelle Sitzung fort, anstatt eine neue zu starten",
				timerAlreadyRunning: "Ein Timer läuft bereits",
				resumeSessionInstead:
					"Setzen Sie die aktuelle Sitzung fort, anstatt eine neue zu starten",
				shortBreakStarted: "Kurze Pause gestartet",
				longBreakStarted: "Lange Pause gestartet",
				paused: "Pomodoro pausiert",
				resumed: "Pomodoro fortgesetzt",
				stoppedAndReset: "Pomodoro gestoppt und zurückgesetzt",
				migrationSuccess:
					"{count} Pomodoro-Sitzungen erfolgreich zu täglichen Notizen migriert.",
				migrationFailure:
					"Migration der Pomodoro-Daten fehlgeschlagen. Bitte versuchen Sie es erneut oder prüfen Sie die Konsole für Details.",
			},
		},
		icsSubscription: {
			notices: {
				calendarNotFound:
					"Kalender \"{name}\" nicht gefunden (404). Bitte prüfen Sie, ob die ICS-URL korrekt ist und der Kalender öffentlich zugänglich ist.",
				calendarAccessDenied:
					"Zugriff auf Kalender „{name}“ verweigert (500). Dies könnte an Einschränkungen des Microsoft-Outlook-Servers liegen. Generieren Sie die ICS-URL in Ihren Kalendereinstellungen erneut.",
				fetchRemoteFailed:
					'Remote-Kalender "{name}" konnte nicht abgerufen werden: {error}',
				readLocalFailed: 'Lokaler Kalender "{name}" konnte nicht gelesen werden: {error}',
			},
		},
		calendarExport: {
			notices: {
				generateLinkFailed: "Kalenderlink konnte nicht generiert werden",
				noTasksToExport: "Keine Aufgaben zum Exportieren gefunden",
				downloadSuccess: "{filename} mit {count} Aufgabe{plural} heruntergeladen",
				downloadFailed: "Kalenderdatei konnte nicht heruntergeladen werden",
				singleDownloadSuccess: "{filename} heruntergeladen",
			},
		},
		filter: {
			groupLabels: {
				noProject: "Kein Projekt",
				noTags: "Keine Tags",
				invalidDate: "Ungültiges Datum",
				due: {
					overdue: "Überfällig",
					today: "Heute",
					tomorrow: "Morgen",
					nextSevenDays: "Nächste sieben Tage",
					later: "Später",
					none: "Kein Fälligkeitsdatum",
				},
				scheduled: {
					past: "Planungsdatum liegt zurück",
					today: "Heute",
					tomorrow: "Morgen",
					nextSevenDays: "Nächste sieben Tage",
					later: "Später",
					none: "Kein Planungsdatum",
				},
			},
			errors: {
				noDatesProvided: "Keine Datumsangaben angegeben",
			},
			folders: {
				root: "(Stammverzeichnis)",
			},
		},
		instantTaskConvert: {
			notices: {
				noCheckboxTasks: "Keine Checkbox-Aufgaben in der aktuellen Notiz gefunden.",
				convertingTasks: "{count} Aufgabe{plural} wird konvertiert...",
				conversionSuccess:
					"✅ {count} Aufgabe{plural} erfolgreich zu TaskNotes konvertiert!",
				partialConversion:
					"{successCount} Aufgabe{successPlural} konvertiert. {failureCount} fehlgeschlagen.",
				batchConversionFailed:
					"Batch-Konvertierung fehlgeschlagen. Bitte versuchen Sie es erneut.",
				invalidParameters: "Ungültige Eingabeparameter.",
				emptyLine: "Aktuelle Zeile ist leer oder enthält keinen gültigen Inhalt.",
				parseError: "Fehler beim Parsen der Aufgabe: {error}",
				invalidTaskData: "Ungültige Aufgabendaten.",
				replaceLineFailed: "Aufgabenzeile konnte nicht ersetzt werden.",
				conversionComplete: "Aufgabe konvertiert: {title}",
				conversionCompleteShortened:
					'Aufgabe konvertiert: "{title}" (Dateiname wegen Länge gekürzt)',
				fileExists:
					"Eine Datei mit diesem Namen existiert bereits. Bitte versuchen Sie es erneut oder benennen Sie die Aufgabe um.",
				conversionFailed:
					"Aufgabe konnte nicht konvertiert werden. Bitte versuchen Sie es erneut.",
			},
		},
		icsNote: {
			notices: {
				templateNotFound: "Vorlage nicht gefunden: {path}",
				templateProcessError: "Fehler beim Verarbeiten der Vorlage: {template}",
				linkedToEvent: "Notiz mit ICS-Ereignis verlinkt: {title}",
			},
		},
		task: {
			notices: {
				templateNotFound: "Aufgabenkörper-Vorlage nicht gefunden: {path}",
				templateReadError: "Fehler beim Lesen der Aufgabenkörper-Vorlage: {template}",
				occurrenceTemplateNotFound: "Vorkommensnotiz-Vorlage nicht gefunden: {path}",
				occurrenceTemplateReadError:
					"Fehler beim Lesen der Vorkommensnotiz-Vorlage: {template}",
				moveTaskFailed: "Aufgabe konnte bei {operation} nicht verschoben werden: {error}",
			},
		},
		autoExport: {
			notices: {
				exportFailed: "TaskNotes Auto-Export fehlgeschlagen: {error}",
			},
		},
		notification: {
			missed: {
				prefixToday: "Verpasste Erinnerung ({time})",
				prefixOnDay: "Verpasste Erinnerung ({day}, {time})",
				message: "{prefix}: {text}",
				dueWas: "{title} war {when} fällig",
				dueIs: "{title} ist {when} fällig",
				scheduledWas: "{title} war {when} geplant",
				scheduledIs: "{title} ist {when} geplant",
				whenTodayAt: "um {time}",
				whenOnDayAt: "am {day} um {time}",
				whenOnDay: "am {day}",
				whenToday: "heute",
				summaryTitle: "Verpasste TaskNotes-Erinnerungen: {count}",
				summaryMore: "{titles} und {count} weitere",
			},
		},
	},
	ui: {
		audit: {
			open: "Öffnen",
			openNewTab: "In neuem Tab öffnen",

			copySelected: "Ausgewählte Aufgaben kopieren",
			clearSelection: "Auswahl aufheben",
			createEntry: "Zeiteintrag erstellen",
			createExternal: "Externen Kalendertermin erstellen",
			expandAll: "Alle Gruppen und Untergruppen aufklappen",
			collapseAll: "Alle Gruppen und Untergruppen zuklappen",
			selectNote: "Element zum Öffnen auswählen",
			occurrenceNotes: "Notizen zu Vorkommen",
			manual: "Manuell erstellen",
			afterCompletion: "Nächstes Vorkommen nach Abschluss erstellen",
			rolling: "Rollierendes Zeitfenster (noch nicht automatisiert)",
			completionOnly: "Nur Abschluss",
			completionOrSkip: "Abschluss oder Überspringen",
		},

		icsCard: {
			untitledEvent: "Unbenanntes Ereignis",
			allDay: "Ganztägig",
			calendarEvent: "Kalenderereignis",
			calendarFallback: "Kalender",
		},
		noteCard: {
			createdLabel: "Erstellt:",
			dailyBadge: "Täglich",
			dailyTooltip: "Tägliche Notiz",
		},
		taskCard: {
			labels: {
				due: "Fällig",
				scheduled: "Geplant",
				recurrence: "Wiederkehrend",
				completed: "Abgeschlossen",
				created: "Erstellt",
				modified: "Geändert",
				blocked: "Blockiert",
				blocking: "Blockierend",
			},
			blockedBadge: "Blockiert",
			blockedBadgeTooltip: "Diese Aufgabe wartet auf eine andere Aufgabe",
			blockingBadge: "Blockierend",
			blockingBadgeTooltip: "Diese Aufgabe blockiert eine andere Aufgabe",
			blockingToggle: "Durch diese Aufgabe blockierte Aufgaben: {count}",
			priorityAriaLabel: "Priorität: {label}",
			taskOptions: "Aufgabenoptionen",
			recurrenceTooltip: "{label}: {value}",
			reminderTooltipOne: "1 Erinnerung gesetzt (zum Verwalten klicken)",
			reminderTooltipMany: "{count} Erinnerungen gesetzt (zum Verwalten klicken)",
			projectTooltip:
				"Diese Aufgabe wird als Projekt verwendet (zum Ein-/Ausblenden von Unteraufgaben klicken)",
			projectIndicatorTooltip: "Diese Aufgabe wird als Projekt verwendet",
			expandSubtasks: "Unteraufgaben ausklappen",
			collapseSubtasks: "Unteraufgaben einklappen",
			dueToday: "{label}: Heute",
			dueTodayAt: "{label}: Heute um {time}",
			dueOverdue: "{label}: {display} (überfällig)",
			dueLabel: "{label}: {display}",
			scheduledToday: "{label}: Heute",
			scheduledTodayAt: "{label}: Heute um {time}",
			scheduledPast: "{label}: {display} (vergangen)",
			scheduledLabel: "{label}: {display}",
			loadingDependencies: "Abhängigkeiten werden geladen…",
			blockingEmpty: "Keine abhängigen Aufgaben",
			blockingLoadError: "Abhängigkeiten konnten nicht geladen werden",
			googleCalendarSyncTooltip: "Mit Google Kalender synchronisiert",
			detailsTooltip: "Aufgabe hat Details",
		},
		propertyEventCard: {
			unknownFile: "Unbekannte Datei",
		},
		filterHeading: {
			allViewName: "Alle",
		},
		filterBar: {
			saveView: "Ansicht speichern",
			saveViewNamePlaceholder: "Ansichtsname eingeben...",
			saveButton: "Speichern",
			views: "Ansichten",
			savedFilterViews: "Gespeicherte Filteransichten",
			filters: "Filter",
			properties: "Eigenschaften",
			sort: "Sortieren",
			newTask: "Neu",
			expandAllGroups: "Alle Gruppen ausklappen",
			collapseAllGroups: "Alle Gruppen einklappen",
			searchTasksPlaceholder: "Aufgaben suchen...",
			searchTasksTooltip: "Aufgabentitel suchen",
			filterUnavailable: "Filterleiste vorübergehend nicht verfügbar",
			toggleFilter: "Filter umschalten",
			activeFiltersTooltip: "Aktive Filter – Klicken zum Ändern, Rechtsklick zum Löschen",
			configureVisibleProperties: "Sichtbare Eigenschaften konfigurieren",
			sortAndGroupOptions: "Sortier- und Gruppenoptionen",
			sortMenuHeader: "Sortieren",
			orderMenuHeader: "Reihenfolge",
			groupMenuHeader: "Gruppieren",
			createNewTask: "Neue Aufgabe erstellen",
			filter: "Filter",
			displayOrganization: "Anzeige & Organisation",
			viewOptions: "Ansichtsoptionen",
			addFilter: "Filter hinzufügen",
			addFilterGroup: "Filtergruppe hinzufügen",
			addFilterTooltip: "Neue Filterbedingung hinzufügen",
			addFilterGroupTooltip: "Verschachtelte Filtergruppe hinzufügen",
			clearAllFilters: "Alle Filter und Gruppen löschen",
			saveCurrentFilter: "Aktuellen Filter als Ansicht speichern",
			closeFilterModal: "Filtermodal schließen",
			deleteFilterGroup: "Filtergruppe löschen",
			deleteCondition: "Bedingung löschen",
			all: "Alle",
			any: "Beliebige",
			followingAreTrue: "der folgenden Bedingungen treffen zu:",
			where: "mit",
			selectProperty: "Auswählen...",
			chooseProperty: "Wählen Sie, nach welcher Aufgabeneigenschaft gefiltert werden soll",
			chooseOperator: "Wählen Sie, wie der Eigenschaftswert verglichen werden soll",
			enterValue: "Geben Sie den Wert zum Filtern ein",
			selectValue: "Wert für {property} zum Filtern auswählen",
			sortBy: "Sortieren nach:",
			toggleSortDirection: "Sortierrichtung umschalten",
			chooseSortMethod: "Wählen Sie, wie Aufgaben sortiert werden sollen",
			groupBy: "Gruppieren nach:",
			chooseGroupMethod: "Aufgaben nach gemeinsamer Eigenschaft gruppieren",
			toggleViewOption: "{option} umschalten",
			expandCollapseFilters: "Klicken zum Aus-/Einklappen der Filterbedingungen",
			expandCollapseSort: "Klicken zum Aus-/Einklappen der Sortier- und Gruppenoptionen",
			expandCollapseViewOptions:
				"Klicken zum Aus-/Einklappen der ansichtsspezifischen Optionen",
			naturalLanguageDates: "Datumsangaben in natürlicher Sprache",
			naturalLanguageExamples: "Beispiele für Datumsangaben in natürlicher Sprache anzeigen",
			enterNumericValue: "Geben Sie einen numerischen Wert zum Filtern ein",
			enterDateValue: "Geben Sie ein Datum in natürlicher Sprache oder ISO-Format ein",
			pickDateTime: "Datum & Zeit wählen",
			noSavedViews: "Keine gespeicherten Ansichten",
			savedViews: "Gespeicherte Ansichten",
			yourSavedFilters: "Ihre gespeicherten Filterkonfigurationen",
			dragToReorder: "Ziehen zum Neuordnen der Ansichten",
			loadSavedView: "Gespeicherte Ansicht laden: {name}",
			deleteView: "Ansicht löschen",
			deleteViewTitle: "Ansicht löschen",
			deleteViewMessage: "Möchten Sie die Ansicht „{name}“ wirklich löschen?",
			manageAllReminders: "Alle Erinnerungen verwalten...",
			clearAllReminders: "Alle Erinnerungen löschen",
			customRecurrence: "Benutzerdefinierte Wiederholung...",
			clearRecurrence: "Wiederholung löschen",
			sortOptions: {
				dueDate: "Fälligkeitsdatum",
				scheduledDate: "Planungsdatum",
				priority: "Priorität",
				status: "Status",
				title: "Titel",
				createdDate: "Erstellungsdatum",
				tags: "Tags",
				ascending: "Aufsteigend",
				descending: "Absteigend",
			},
			group: {
				none: "Keine",
				status: "Status",
				priority: "Priorität",
				context: "Kontext",
				project: "Projekt",
				dueDate: "Fälligkeitsdatum",
				scheduledDate: "Planungsdatum",
				tags: "Tags",
				completedDate: "Abschlussdatum",
			},
			subgroupLabel: "UNTERGRUPPE",
			notices: {
				propertiesMenuFailed: "Eigenschaftenmenü konnte nicht angezeigt werden",
			},
		},
	},
	components: {
		dateContextMenu: {
			weekdays: "Wochentage",
			clearDate: "Datum löschen",
			today: "Heute",
			tomorrow: "Morgen",
			thisWeekend: "Dieses Wochenende",
			nextWeek: "Nächste Woche",
			nextMonth: "Nächster Monat",
			setDateTime: "Datum & Zeit setzen",
			dateLabel: "Datum",
			timeLabel: "Zeit (optional)",
		},
		subgroupMenuBuilder: {
			none: "Keine",
			status: "Status",
			priority: "Priorität",
			context: "Kontext",
			project: "Projekt",
			dueDate: "Fälligkeitsdatum",
			scheduledDate: "Planungsdatum",
			tags: "Tags",
			completedDate: "Abschlussdatum",
			subgroup: "UNTERGRUPPE",
		},
		propertyVisibilityDropdown: {
			coreProperties: "KERNEIGENSCHAFTEN",
			organization: "ORGANISATION",
			customProperties: "BENUTZERDEFINIERTE EIGENSCHAFTEN",
			failed: "Eigenschaftenmenü konnte nicht angezeigt werden",
			properties: {
				statusDot: "Statuspunkt",
				priorityDot: "Prioritätspunkt",
				dueDate: "Fälligkeitsdatum",
				scheduledDate: "Planungsdatum",
				timeEstimate: "Zeitschätzung",
				totalTrackedTime: "Gesamte erfasste Zeit",
				checklistProgress: "Checklistenfortschritt",
				recurrence: "Wiederholung",
				completedDate: "Abschlussdatum",
				createdDate: "Erstellungsdatum",
				modifiedDate: "Änderungsdatum",
				projects: "Projekte",
				contexts: "Kontexte",
				tags: "Tags",
				blocked: "Blockiert",
				blocking: "Blockierend",
			},
		},
		reminderContextMenu: {
			remindBeforeDue: "Vor Fälligkeit erinnern...",
			remindBeforeScheduled: "Vor dem geplanten Termin erinnern…",
			manageAllReminders: "Alle Erinnerungen verwalten...",
			clearAllReminders: "Alle Erinnerungen löschen",
			quickReminders: {
				atTime: "Zum Zeitpunkt des Ereignisses",
				fiveMinutesBefore: "5 Minuten vorher",
				fifteenMinutesBefore: "15 Minuten vorher",
				oneHourBefore: "1 Stunde vorher",
				oneDayBefore: "1 Tag vorher",
			},
		},
		recurrenceContextMenu: {
			daily: "Täglich",
			weeklyOn: "Wöchentlich am {day}",
			everyTwoWeeksOn: "Alle 2 Wochen am {day}",
			monthlyOnThe: "Monatlich am {ordinal}",
			everyThreeMonthsOnThe: "Alle 3 Monate am {ordinal}",
			yearlyOn: "Jährlich am {month} {ordinal}",
			weekdaysOnly: "Nur Wochentage",
			dailyAfterCompletion: "Täglich (nach Abschluss)",
			every3DaysAfterCompletion: "Alle 3 Tage (nach Abschluss)",
			weeklyAfterCompletion: "Wöchentlich (nach Abschluss)",
			monthlyAfterCompletion: "Monatlich (nach Abschluss)",
			customRecurrence: "Benutzerdefinierte Wiederholung...",
			clearRecurrence: "Wiederholung löschen",
			customRecurrenceModal: {
				lastDay: "Letzter Tag",

				title: "Benutzerdefinierte Wiederholung",
				startDate: "Startdatum",
				startDateDesc: "Das Datum, an dem das Wiederholungsmuster beginnt",
				startTime: "Startzeit",
				startTimeDesc:
					"Die Zeit, zu der wiederkehrende Instanzen erscheinen sollen (optional)",
				recurFrom: "Wiederholen ab",
				recurFromDesc: "Wann soll das nächste Vorkommen berechnet werden?",
				scheduledDate: "Planungsdatum",
				completionDate: "Abschlussdatum",
				frequency: "Häufigkeit",
				interval: "Intervall",
				intervalDesc: "Alle X Tage/Wochen/Monate/Jahre",
				daysOfWeek: "Wochentage",
				daysOfWeekDesc: "Bestimmte Tage auswählen (für wöchentliche Wiederholung)",
				monthlyRecurrence: "Monatliche Wiederholung",
				monthlyRecurrenceDesc: "Wählen Sie, wie monatlich wiederholt werden soll",
				yearlyRecurrence: "Jährliche Wiederholung",
				yearlyRecurrenceDesc: "Wählen Sie, wie jährlich wiederholt werden soll",
				endCondition: "Endbedingung",
				endConditionDesc: "Wählen Sie, wann die Wiederholung enden soll",
				neverEnds: "Endet nie",
				endAfterOccurrences: "Nach {count} Vorkommen beenden",
				endOnDate: "Am {date} beenden",
				onDayOfMonth: "Am Tag {day} jeden Monat",
				onTheWeekOfMonth: "Am {week} {day} jeden Monat",
				onDateOfYear: "Am {month} {day} jedes Jahr",
				onTheWeekOfYear: "Am {week} {day} von {month} jedes Jahr",
				frequencies: {
					daily: "Täglich",
					weekly: "Wöchentlich",
					monthly: "Monatlich",
					yearly: "Jährlich",
				},
				weekPositions: {
					first: "ersten",
					second: "zweiten",
					third: "dritten",
					fourth: "vierten",
					last: "letzten",
				},
				weekdays: {
					monday: "Montag",
					tuesday: "Dienstag",
					wednesday: "Mittwoch",
					thursday: "Donnerstag",
					friday: "Freitag",
					saturday: "Samstag",
					sunday: "Sonntag",
				},
				weekdaysShort: {
					mon: "Mo",
					tue: "Di",
					wed: "Mi",
					thu: "Do",
					fri: "Fr",
					sat: "Sa",
					sun: "So",
				},
				cancel: "Abbrechen",
				save: "Speichern",
			},
		},
	},
};
