import { TranslationTree } from "../types";

export const de: TranslationTree = {
	common: {
		appName: "TaskNotes",
		cancel: "Abbrechen",
		confirm: "Bestätigen",
		close: "Schließen",
		save: "Speichern",
		language: "Sprache",
		systemDefault: "Systemstandard",
		languages: {
			en: "Englisch",
			fr: "Französisch",
			ru: "Russisch",
			zh: "Chinesisch",
			de: "Deutsch",
			es: "Spanisch",
			ja: "Japanisch",
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
			},
		},
		taskList: {
			title: "Aufgaben",
			expandAllGroups: "Alle Gruppen ausklappen",
			collapseAllGroups: "Alle Gruppen einklappen",
			noTasksFound: "Keine Aufgaben für die gewählten Filter gefunden.",
		},
		notes: {
			title: "Notizen",
			refreshButton: "Wird aktualisiert...",
			notices: {
				indexingDisabled: "Notizindexierung deaktiviert",
			},
			empty: {
				noNotesFound: "Keine Notizen gefunden",
			},
		},
		miniCalendar: {
			title: "Mini-Kalender",
		},
		advancedCalendar: {
			title: "Erweiterter Kalender",
		},
		kanban: {
			title: "Kanban",
			newTask: "Neue Aufgabe",
			addCard: "+ Karte hinzufügen",
			noTasks: "Keine Aufgaben",
			notices: {
				loadFailed: "Kanban-Board konnte nicht geladen werden",
				movedTask: 'Aufgabe verschoben zu "{0}"',
			},
			errors: {
				loadingBoard: "Fehler beim Laden des Boards.",
			},
		},
		pomodoro: {
			title: "Pomodoro",
			status: {
				focus: "Fokus",
				ready: "Bereit zum Starten",
				paused: "Pausiert",
				working: "Arbeitet",
				shortBreak: "Kurze Pause",
				longBreak: "Lange Pause",
				breakPrompt: "Großartige Arbeit! Zeit für eine {length} Pause",
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
			},
			notices: {
				noTasks: "Keine unarchivierte Aufgaben gefunden. Erstelle zuerst einige Aufgaben.",
				loadFailed: "Aufgaben konnten nicht geladen werden",
			},
			statsLabel: "heute abgeschlossen",
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
			},
		},
		stats: {
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
			},
		},
		releaseNotes: {
			title: "Was ist neu in TaskNotes {version}",
			header: "Was ist neu in TaskNotes {version}",
			viewAllLink: "Alle Versionshinweise auf GitHub anzeigen →",
			starMessage: "Wenn Sie TaskNotes nützlich finden, geben Sie ihm bitte einen Stern auf GitHub",
		},
	},
	settings: {
		tabs: {
			general: "Allgemein",
			taskProperties: "Aufgabeneigenschaften",
			defaults: "Voreinstellungen & Vorlagen",
			appearance: "Erscheinungsbild & UI",
			features: "Funktionen",
			integrations: "Integrationen",
		},
		features: {
			inlineTasks: {
				header: "Inline-Aufgaben",
				description:
					"Konfiguriere Inline-Aufgabenfunktionen für nahtloses Aufgabenmanagement innerhalb jeder Notiz.",
			},
			overlays: {
				taskLinkToggle: {
					name: "Aufgabenlink-Overlay",
					description: "Zeige interaktive Overlays beim Hovern über Aufgabenlinks",
				},
			},
			instantConvert: {
				toggle: {
					name: "Sofortige Aufgabenkonvertierung",
					description:
						"Aktiviere sofortige Konvertierung von Text zu Aufgaben über Tastenkürzel",
				},
				folder: {
					name: "Inline-Aufgabenkonvertierungsordner",
					description:
						"Ordner für Inline-Aufgabenkonvertierung. Verwende {{currentNotePath}} für relativ zur aktuellen Notiz, {{currentNoteTitle}} für aktuellen Notiztitel",
				},
			},
			nlp: {
				header: "Natürliche Sprachverarbeitung",
				description:
					"Aktiviere intelligente Analyse von Aufgabendetails aus natürlicher Spracheingabe.",
				enable: {
					name: "Natürliche Spracheingabe für Aufgaben aktivieren",
					description:
						"Parse Fälligkeitsdaten, Prioritäten und Kontexte aus natürlicher Sprache beim Erstellen von Aufgaben",
				},
				defaultToScheduled: {
					name: "Standardmäßig geplant",
					description:
						"Wenn NLP ein Datum ohne Kontext erkennt, behandle es als geplant statt fällig",
				},
				language: {
					name: "NLP-Sprache",
					description:
						"Sprache für natürliche Sprachverarbeitungsmuster und Datumsanalyse",
				},
				statusTrigger: {
					name: "Status-Vorschlag Trigger",
					description:
						"Text zum Auslösen von Status-Vorschlägen (leer lassen zum Deaktivieren)",
				},
			},
			pomodoro: {
				header: "Pomodoro-Timer",
				description:
					"Integrierter Pomodoro-Timer für Zeitmanagement und Produktivitätsverfolgung.",
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
					name: "Lange Pause Intervall",
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
			},
			uiLanguage: {
				header: "Oberflächensprache",
				description: "Ändere die Sprache der TaskNotes-Menüs, Hinweise und Ansichten.",
				dropdown: {
					name: "UI-Sprache",
					description: "Wähle die Sprache für TaskNotes-Oberflächentexte",
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
				description: "Konfiguriere, wo Pomodoro-Sitzungsdaten gespeichert und verwaltet werden.",
				dailyNotes: "Tägliche Notizen",
			},
			notifications: {
				header: "Benachrichtigungen",
				description: "Konfiguriere Aufgabenerinnerungsbenachrichtigungen und Warnungen.",
				enableName: "Benachrichtigungen aktivieren",
				enableDesc: "Aufgabenerinnerungs-Benachrichtigungen aktivieren",
				typeName: "Benachrichtigungstyp",
				typeDesc: "Art der anzuzeigenden Benachrichtigungen",
				systemLabel: "System-Benachrichtigungen",
				inAppLabel: "In-App-Benachrichtigungen",
			},
			overdue: {
				hideCompletedName: "Abgeschlossene Aufgaben aus überfälligen ausblenden",
				hideCompletedDesc:
					"Abgeschlossene Aufgaben aus überfälligen Aufgabenberechnungen ausschließen",
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
					"Fälligkeitsdatum-Offset in wiederkehrenden Aufgaben beibehalten",
				maintainOffsetDesc:
					"Den Offset zwischen Fälligkeitsdatum und geplantem Datum beibehalten, wenn wiederkehrende Aufgaben abgeschlossen werden",
			},
			timeblocking: {
				header: "Zeitblockierung",
				description:
					"Konfiguriere Zeitblockfunktionalität für leichte Planung in täglichen Notizen. In der erweiterten Kalenderansicht, halte Shift + Klick und ziehe, um Zeitblöcke zu erstellen.",
				enableName: "Zeitblockierung aktivieren",
				enableDesc:
					"Zeitblockfunktionalität für leichte Planung in täglichen Notizen aktivieren",
				showBlocksName: "Zeitblöcke anzeigen",
				showBlocksDesc: "Zeitblöcke aus täglichen Notizen standardmäßig anzeigen",
				usage: "Verwendung: In der erweiterten Kalenderansicht, halte Shift + ziehen, um Zeitblöcke zu erstellen. Ziehen, um bestehende Zeitblöcke zu verschieben. Ränder anpassen, um Dauer zu ändern.",
			},
			performance: {
				header: "Leistung & Verhalten",
				description: "Konfiguriere Plugin-Leistung und Verhaltensoptionen.",
			},
			timeTrackingSection: {
				header: "Zeiterfassung",
				description: "Konfiguriere automatische Zeiterfassungsverhalten.",
			},
			recurringSection: {
				header: "Wiederkehrende Aufgaben",
				description: "Konfiguriere Verhalten für wiederkehrende Aufgabenverwaltung.",
			},
		},
		defaults: {
			header: {
				basicDefaults: "Grundeinstellungen",
				dateDefaults: "Datumsvoreinstellungen",
				defaultReminders: "Standard-Erinnerungen",
				bodyTemplate: "Körpervorlage",
				instantTaskConversion: "Sofortige Aufgabenkonvertierung",
			},
			description: {
				basicDefaults:
					"Setze Standardwerte für neue Aufgaben, um die Aufgabenerstellung zu beschleunigen.",
				dateDefaults: "Setze Standard-Fälligkeits- und Planungsdaten für neue Aufgaben.",
				defaultReminders:
					"Konfiguriere Standard-Erinnerungen, die neuen Aufgaben hinzugefügt werden.",
				bodyTemplate: "Konfiguriere eine Vorlagendatei für neue Aufgabeninhalte.",
				instantTaskConversion:
					"Konfiguriere Verhalten bei sofortiger Textkonvertierung zu Aufgaben.",
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
					selectTooltip: "Wähle Projektnotizen zum standardmäßigen Verlinken",
					removeTooltip: "{name} aus Standardprojekten entfernen",
				},
				useParentNoteAsProject: {
					name: "Übergeordnete Notiz als Projekt bei sofortiger Konvertierung verwenden",
					description:
						"Übergeordnete Notiz automatisch als Projekt verlinken bei sofortiger Aufgabenkonvertierung",
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
				addReminder: {
					name: "Standard-Erinnerung hinzufügen",
					description:
						"Erstelle eine neue Standard-Erinnerung, die allen neuen Aufgaben hinzugefügt wird",
					buttonText: "Erinnerung hinzufügen",
				},
				emptyState:
					"Keine Standard-Erinnerungen konfiguriert. Füge eine Erinnerung hinzu, um automatisch über neue Aufgaben benachrichtigt zu werden.",
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
					name: "Körpervorlage verwenden",
					description: "Verwende eine Vorlagendatei für Aufgabenkörperinhalte",
				},
				bodyTemplateFile: {
					name: "Körpervorlagendatei",
					description:
						"Pfad zur Vorlagendatei für Aufgabenkörperinhalte. Unterstützt Vorlagenvariablen wie {{title}}, {{date}}, {{time}}, {{priority}}, {{status}}, etc.",
					placeholder: "Templates/Aufgaben Vorlage.md",
					ariaLabel: "Pfad zur Körpervorlagendatei",
				},
				variablesHeader: "Vorlagenvariablen:",
				variables: {
					title: "{{title}} - Aufgabentitel",
					details: "{{details}} - Benutzergegebene Details aus Modal",
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
					"Konfiguriere, wo Aufgaben gespeichert und wie sie identifiziert werden.",
				defaultFolder: {
					name: "Standard-Aufgabenordner",
					description: "Standardort für neue Aufgaben",
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
				description: "Wähle, wie TaskNotes Notizen als Aufgaben identifiziert.",
				identifyBy: {
					name: "Aufgaben identifizieren durch",
					description:
						"Wähle, ob Aufgaben durch Tag oder durch eine Frontmatter-Eigenschaft identifiziert werden",
					options: {
						tag: "Tag",
						property: "Eigenschaft",
					},
				},
				taskTag: {
					name: "Aufgaben-Tag",
					description: "Tag, das Notizen als Aufgaben identifiziert (ohne #)",
				},
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
						"Kommagetrennte Liste von Ordnern, die vom Notizen-Tab ausgeschlossen werden",
				},
			},
			taskInteraction: {
				header: "Aufgabeninteraktion",
				description: "Konfiguriere, wie das Klicken auf Aufgaben funktioniert.",
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
		},
		taskProperties: {
			taskStatuses: {
				header: "Aufgabenstatus",
				description:
					"Passe die verfügbaren Statusoptionen für deine Aufgaben an. Diese Status steuern den Aufgabenlebenszyklus und bestimmen, wann Aufgaben als abgeschlossen gelten.",
				howTheyWork: {
					title: "Wie Status funktionieren:",
					value: 'Wert: Der interne Bezeichner, der in deinen Aufgabendateien gespeichert wird (z.B. "in-progress")',
					label: 'Label: Der Anzeigename in der Benutzeroberfläche (z.B. "In Bearbeitung")',
					color: "Farbe: Visuelle Indikatorfarbe für Statuspunkt und Abzeichen",
					completed:
						"Abgeschlossen: Wenn angehakt, werden Aufgaben mit diesem Status als fertig betrachtet und können anders gefiltert werden",
					autoArchive:
						"Auto-Archivierung: Wenn aktiviert, werden Aufgaben nach der angegebenen Verzögerung automatisch archiviert (1-1440 Minuten)",
					orderNote:
						"Die Reihenfolge unten bestimmt die Sequenz beim Durchschalten der Status durch Klicken auf Aufgabenstatus-Abzeichen.",
				},
				addNew: {
					name: "Neuen Status hinzufügen",
					description: "Erstelle eine neue Statusoption für deine Aufgaben",
					buttonText: "Status hinzufügen",
				},
				validationNote:
					'Hinweis: Du musst mindestens 2 Status haben, und mindestens ein Status muss als "Abgeschlossen" markiert sein.',
				emptyState:
					"Keine benutzerdefinierten Status konfiguriert. Füge einen Status hinzu, um zu beginnen.",
				emptyStateButton: "Status hinzufügen",
				fields: {
					value: "Wert:",
					label: "Label:",
					color: "Farbe:",
					completed: "Abgeschlossen:",
					autoArchive: "Auto-Archivierung:",
					delayMinutes: "Verzögerung (Minuten):",
				},
				placeholders: {
					value: "in-bearbeitung",
					label: "In Bearbeitung",
				},
				badges: {
					completed: "Abgeschlossen",
				},
				deleteConfirm: 'Bist du sicher, dass du den Status "{label}" löschen möchtest?',
			},
			taskPriorities: {
				header: "Aufgabenprioritäten",
				description:
					"Passe die verfügbaren Prioritätsstufen für deine Aufgaben an. Prioritätsgewichte bestimmen Sortierreihenfolge und visuelle Hierarchie in deinen Aufgabenansichten.",
				howTheyWork: {
					title: "Wie Prioritäten funktionieren:",
					value: 'Wert: Der interne Bezeichner, der in deinen Aufgabendateien gespeichert wird (z.B. "hoch")',
					label: 'Anzeigelabel: Der Anzeigename in der Benutzeroberfläche (z.B. "Hohe Priorität")',
					color: "Farbe: Visuelle Indikatorfarbe für Prioritätspunkt und Abzeichen",
					weight: "Gewicht: Numerischer Wert für Sortierung (höhere Gewichte erscheinen zuerst in Listen)",
					weightNote:
						"Aufgaben werden automatisch nach Prioritätsgewicht in absteigender Reihenfolge sortiert (höchstes Gewicht zuerst). Gewichte können beliebige positive Zahlen sein.",
				},
				addNew: {
					name: "Neue Priorität hinzufügen",
					description: "Erstelle eine neue Prioritätsstufe für deine Aufgaben",
					buttonText: "Priorität hinzufügen",
				},
				validationNote:
					"Hinweis: Du musst mindestens 1 Priorität haben. Höhere Gewichte haben Vorrang bei Sortierung und visueller Hierarchie.",
				emptyState:
					"Keine benutzerdefinierten Prioritäten konfiguriert. Füge eine Priorität hinzu, um zu beginnen.",
				emptyStateButton: "Priorität hinzufügen",
				fields: {
					value: "Wert:",
					label: "Label:",
					color: "Farbe:",
					weight: "Gewicht:",
				},
				placeholders: {
					value: "hoch",
					label: "Hohe Priorität",
				},
				weightLabel: "Gewicht: {weight}",
				deleteConfirm: "Du musst mindestens eine Priorität haben",
				deleteTooltip: "Priorität löschen",
			},
			fieldMapping: {
				header: "Feldzuordnung",
				warning:
					"⚠️ Warnung: TaskNotes wird diese Eigenschaftsnamen LESEN UND SCHREIBEN. Das Ändern nach dem Erstellen von Aufgaben kann Inkonsistenzen verursachen.",
				description:
					"Konfiguriere, welche Frontmatter-Eigenschaften TaskNotes für jedes Feld verwenden soll.",
				resetButton: {
					name: "Feldzuordnungen zurücksetzen",
					description: "Alle Feldzuordnungen auf Standardwerte zurücksetzen",
					buttonText: "Auf Standard zurücksetzen",
				},
				notices: {
					resetSuccess: "Feldzuordnungen auf Standard zurückgesetzt",
					resetFailure: "Feldzuordnungen konnten nicht zurückgesetzt werden",
					updateFailure:
						"Feldzuordnung für {label} konnte nicht aktualisiert werden. Bitte versuche es erneut.",
				},
				table: {
					fieldHeader: "TaskNotes-Feld",
					propertyHeader: "Dein Eigenschaftsname",
				},
				fields: {
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
					completeInstances: "Abgeschlossene Instanzen",
					blockedBy: "Blockiert von",
					pomodoros: "Pomodoros",
					icsEventId: "ICS-Event-ID",
					icsEventTag: "ICS-Event-Tag",
					reminders: "Erinnerungen",
				},
			},
			customUserFields: {
				header: "Benutzerdefinierte Felder",
				description:
					"Definiere benutzerdefinierte Frontmatter-Eigenschaften, die als typisierte Filteroptionen in allen Ansichten erscheinen. Jede Zeile: Anzeigename, Eigenschaftsname, Typ.",
				addNew: {
					name: "Neues Benutzerfeld hinzufügen",
					description:
						"Erstelle ein neues benutzerdefiniertes Feld, das in Filtern und Ansichten erscheint",
					buttonText: "Benutzerfeld hinzufügen",
				},
				emptyState:
					"Keine benutzerdefinierten Felder konfiguriert. Füge ein Feld hinzu, um benutzerdefinierte Eigenschaften für deine Aufgaben zu erstellen.",
				emptyStateButton: "Benutzerfeld hinzufügen",
				fields: {
					displayName: "Anzeigename:",
					propertyKey: "Eigenschaftsschlüssel:",
					type: "Typ:",
				},
				placeholders: {
					displayName: "Anzeigename",
					propertyKey: "eigenschafts-name",
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
			},
		},
		appearance: {
			taskCards: {
				header: "Aufgabenkarten",
				description:
					"Konfiguriere, wie Aufgabenkarten in allen Ansichten angezeigt werden.",
				defaultVisibleProperties: {
					name: "Standard sichtbare Eigenschaften",
					description:
						"Wähle, welche Eigenschaften standardmäßig auf Aufgabenkarten erscheinen.",
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
				description: "Konfiguriere, wie Aufgabendateien beim Erstellen benannt werden.",
				storeTitleInFilename: {
					name: "Titel im Dateinamen speichern",
					description:
						"Verwende den Aufgabentitel als Dateinamen. Dateiname wird aktualisiert, wenn der Aufgabentitel geändert wird (Empfohlen).",
				},
				filenameFormat: {
					name: "Dateinamenformat",
					description: "Wie Aufgabendateinamen generiert werden sollen",
					options: {
						title: "Aufgabentitel (Nicht-aktualisierend)",
						zettel: "Zettelkasten-Format (JJMMTT + base36 Sekunden seit Mitternacht)",
						timestamp: "Vollständiger Zeitstempel (YYYY-MM-DD-HHMMSS)",
						custom: "Benutzerdefinierte Vorlage",
					},
				},
				customTemplate: {
					name: "Benutzerdefinierte Dateinamenvorlage",
					description:
						"Vorlage für benutzerdefinierte Dateinamen. Verfügbare Variablen: {title}, {titleLower}, {titleUpper}, {titleSnake}, {titleKebab}, {titleCamel}, {titlePascal}, {date}, {shortDate}, {time}, {time12}, {time24}, {timestamp}, {dateTime}, {year}, {month}, {monthName}, {monthNameShort}, {day}, {dayName}, {dayNameShort}, {hour}, {hour12}, {minute}, {second}, {milliseconds}, {ms}, {ampm}, {week}, {quarter}, {unix}, {unixMs}, {timezone}, {timezoneShort}, {utcOffset}, {utcOffsetShort}, {utcZ}, {zettel}, {nano}, {priority}, {priorityShort}, {status}, {statusShort}, {dueDate}, {scheduledDate}",
					placeholder: "{date}-{title}-{dueDate}",
					helpText:
						"Hinweis: {dueDate} und {scheduledDate} sind im Format YYYY-MM-DD und werden leer sein, wenn nicht gesetzt.",
				},
			},
			displayFormatting: {
				header: "Anzeigeformatierung",
				description:
					"Konfiguriere, wie Daten, Zeiten und andere Daten im Plugin angezeigt werden.",
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
				description: "Passe das Erscheinungsbild und Verhalten der Kalenderansicht an.",
				defaultView: {
					name: "Standardansicht",
					description:
						"Die Kalenderansicht, die beim Öffnen des Kalendertabs angezeigt wird",
					options: {
						monthGrid: "Monatsraster",
						weekTimeline: "Wochen-Timeline",
						dayTimeline: "Tages-Timeline",
						yearView: "Jahresansicht",
						customMultiDay: "Benutzerdefinierte mehrtägige",
					},
				},
				customDayCount: {
					name: "Benutzerdefinierte Ansicht Tageanzahl",
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
					name: "Aktuelle Zeit-Indikator anzeigen",
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
				},
			},
			defaultEventVisibility: {
				header: "Standard-Event-Sichtbarkeit",
				description:
					"Konfiguriere, welche Event-Typen standardmäßig beim Öffnen des erweiterten Kalenders sichtbar sind. Benutzer können diese trotzdem in der Kalenderansicht ein-/ausschalten.",
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
					name: "ICS-Events anzeigen",
					description: "Events aus ICS-Abonnements standardmäßig anzeigen",
				},
			},
			timeSettings: {
				header: "Zeiteinstellungen",
				description:
					"Konfiguriere zeitbezogene Anzeigeeinstellungen für Timeline-Ansichten.",
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
					description: "Späteste Zeit in Timeline-Ansichten (HH:MM Format)",
					placeholder: "22:00",
				},
				initialScrollTime: {
					name: "Anfangs-Scrollzeit",
					description:
						"Zeit, zu der beim Öffnen von Timeline-Ansichten gescrollt wird (HH:MM Format)",
					placeholder: "09:00",
				},
				eventMinHeight: {
					name: "Event-Mindesthöhe",
					description: "Mindesthöhe für Events in Timeline-Ansichten (Pixel)",
					placeholder: "15",
				},
			},
			uiElements: {
				header: "UI-Elemente",
				description: "Konfiguriere die Anzeige verschiedener UI-Elemente.",
				showTrackedTasksInStatusBar: {
					name: "Verfolgte Aufgaben in Statusleiste anzeigen",
					description: "Aktuell verfolgte Aufgaben in Obsidians Statusleiste anzeigen",
				},
				showProjectSubtasksWidget: {
					name: "Projekt-Unteraufgaben-Widget anzeigen",
					description:
						"Ein Widget anzeigen, das Unteraufgaben für die aktuelle Projektnotiz zeigt",
				},
				projectSubtasksPosition: {
					name: "Projekt-Unteraufgaben-Position",
					description: "Wo das Projekt-Unteraufgaben-Widget positioniert werden soll",
					options: {
						top: "Oben in der Notiz",
						bottom: "Unten in der Notiz",
					},
				},
				showTaskCardInNote: {
					name: "Aufgabenkarte in Notiz anzeigen",
					description:
						"Eine Aufgabenkarten-Widget oben in Aufgabennotizen anzeigen, das die Aufgabendetails und Aktionen zeigt",
				},
				showExpandableSubtasks: {
					name: "Ausklappbare Unteraufgaben anzeigen",
					description:
						"Aus-/Einklappen von Unteraufgaben-Abschnitten in Aufgabenkarten erlauben",
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
					"Passe an, wie Projektvorschläge während der Aufgabenerstellung angezeigt werden.",
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
					"Konfiguriere bis zu 3 Informationszeilen für jeden Projektvorschlag.",
				displayRows: {
					row1: {
						name: "Zeile 1",
						description:
							"Format: {eigenschaft|flags}. Eigenschaften: title, aliases, file.path, file.parent. Flags: n(Label) zeigt Label, s macht suchbar. Beispiel: {title|n(Titel)|s}",
						placeholder: "{title|n(Titel)}",
					},
					row2: {
						name: "Zeile 2 (optional)",
						description:
							"Häufige Muster: {aliases|n(Aliase)}, {file.parent|n(Ordner)}, literal:Benutzerdefinierter Text",
						placeholder: "{aliases|n(Aliase)}",
					},
					row3: {
						name: "Zeile 3 (optional)",
						description:
							"Zusätzliche Infos wie {file.path|n(Pfad)} oder benutzerdefinierte Frontmatter-Felder",
						placeholder: "{file.path|n(Pfad)}",
					},
				},
				quickReference: {
					header: "Schnellreferenz",
					properties:
						"Verfügbare Eigenschaften: title, aliases, file.path, file.parent, oder beliebige Frontmatter-Felder",
					labels: 'Labels hinzufügen: {title|n(Titel)} → "Titel: Mein Projekt"',
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
				description: "Konfiguriere Aufgabenerinnerungs-Benachrichtigungen und Alarme.",
			},
			performance: {
				description: "Konfiguriere Plugin-Leistung und Verhaltensoptionen.",
			},
			timeTrackingSection: {
				description: "Konfiguriere automatische Zeiterfassungsverhalten.",
			},
			recurringSection: {
				description: "Konfiguriere Verhalten für wiederkehrende Aufgabenverwaltung.",
			},
			timeblocking: {
				description:
					"Konfiguriere Zeitblockfunktionalität für leichte Planung in täglichen Notizen.",
				usage: "Verwendung: In der erweiterten Kalenderansicht, halte Shift + ziehen, um Zeitblöcke zu erstellen. Ziehen, um bestehende Zeitblöcke zu verschieben. Ränder vergrößern/verkleinern, um Dauer anzupassen.",
			},
		},
		integrations: {
			basesIntegration: {
				header: "Bases-Integration",
				description:
					"Konfiguriere Integration mit dem Obsidian Bases Plugin. Dies ist eine experimentelle Funktion und basiert derzeit auf undokumentierten Obsidian APIs. Das Verhalten kann sich ändern oder brechen.",
				enable: {
					name: "Bases-Integration aktivieren",
					description:
						"TaskNotes-Ansichten zur Verwendung im Obsidian Bases Plugin aktivieren. Bases Plugin muss aktiviert sein, damit dies funktioniert.",
				},
				notices: {
					enabled:
						"Bases-Integration aktiviert. Bitte starte Obsidian neu, um die Einrichtung abzuschließen.",
					disabled:
						"Bases-Integration deaktiviert. Bitte starte Obsidian neu, um die Entfernung abzuschließen.",
				},
			},
			calendarSubscriptions: {
				header: "Kalenderabonnements",
				description:
					"Abonniere externe Kalender über ICS/iCal URLs, um Events neben deinen Aufgaben anzuzeigen.",
				defaultNoteTemplate: {
					name: "Standard-Notizvorlage",
					description:
						"Pfad zur Vorlagendatei für Notizen, die aus ICS-Events erstellt werden",
					placeholder: "Templates/Event Vorlage.md",
				},
				defaultNoteFolder: {
					name: "Standard-Notizordner",
					description: "Ordner für Notizen, die aus ICS-Events erstellt werden",
					placeholder: "Kalender/Events",
				},
				filenameFormat: {
					name: "ICS-Notiz-Dateinamenformat",
					description:
						"Wie Dateinamen für Notizen generiert werden, die aus ICS-Events erstellt werden",
					options: {
						title: "Event-Titel",
						zettel: "Zettelkasten-Format",
						timestamp: "Zeitstempel",
						custom: "Benutzerdefinierte Vorlage",
					},
				},
				customTemplate: {
					name: "Benutzerdefinierte ICS-Dateinamenvorlage",
					description: "Vorlage für benutzerdefinierte ICS-Event-Dateinamen",
					placeholder: "{date}-{title}",
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
					"Keine Kalenderabonnements konfiguriert. Füge ein Abonnement hinzu, um externe Kalender zu synchronisieren.",
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
					enableFirst: "Aktiviere zuerst das Abonnement",
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
					remote: "Remote URL",
					local: "Lokale Datei",
				},
				placeholders: {
					calendarName: "Kalendername",
					url: "ICS/iCal URL",
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
				confirmDelete: {
					title: "Abonnement löschen",
					message:
						'Bist du sicher, dass du das Abonnement "{name}" löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.',
					confirmText: "Löschen",
				},
			},
			autoExport: {
				header: "Automatischer ICS-Export",
				description: "Automatisch alle deine Aufgaben in eine ICS-Datei exportieren.",
				enable: {
					name: "Automatischen Export aktivieren",
					description:
						"Eine ICS-Datei automatisch mit allen deinen Aufgaben aktuell halten",
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
						"Auto-Export-Dienst nicht initialisiert - bitte starte Obsidian neu",
				},
				notices: {
					reloadRequired:
						"Bitte lade Obsidian neu, damit die automatischen Export-Änderungen wirksam werden.",
					exportSuccess: "Aufgaben erfolgreich exportiert",
					exportFailure: "Export fehlgeschlagen - prüfe Konsole für Details",
					serviceUnavailable: "Auto-Export-Dienst nicht verfügbar",
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
						"Token für API-Authentifizierung erforderlich (leer lassen für keine Authentifizierung)",
					placeholder: "dein-geheimes-token",
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
						"Webhooks senden Echtzeit-Benachrichtigungen an externe Dienste, wenn TaskNotes-Events auftreten.",
					usage: "Konfiguriere Webhooks zur Integration mit Automatisierungstools, Sync-Diensten oder benutzerdefinierten Anwendungen.",
				},
				addWebhook: {
					name: "Webhook hinzufügen",
					description: "Neuen Webhook-Endpunkt registrieren",
					buttonText: "Webhook hinzufügen",
				},
				emptyState: {
					message:
						"Keine Webhooks konfiguriert. Füge einen Webhook hinzu, um Echtzeit-Benachrichtigungen zu erhalten.",
					buttonText: "Webhook hinzufügen",
				},
				labels: {
					active: "Aktiv:",
					url: "URL:",
					events: "Events:",
					transform: "Transformation:",
				},
				placeholders: {
					url: "Webhook URL",
					noEventsSelected: "Keine Events ausgewählt",
					rawPayload: "Raw-Payload (keine Transformation)",
				},
				statusLabels: {
					active: "Aktiv",
					inactive: "Inaktiv",
					created: "Erstellt {timeAgo}",
				},
				actions: {
					editEvents: "Events bearbeiten",
					delete: "Löschen",
				},
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
						"Bist du sicher, dass du diesen Webhook löschen möchtest?\n\nURL: {url}\n\nDiese Aktion kann nicht rückgängig gemacht werden.",
					confirmText: "Löschen",
				},
				cardHeader: "Webhook",
				cardFields: {
					active: "Aktiv:",
					url: "URL:",
					events: "Events:",
					transform: "Transformation:",
				},
				eventsDisplay: {
					noEvents: "Keine Events ausgewählt",
				},
				transformDisplay: {
					noTransform: "Raw-Payload (keine Transformation)",
				},
				secretModal: {
					title: "Webhook-Secret generiert",
					description:
						"Dein Webhook-Secret wurde generiert. Speichere dieses Secret, da du es nicht erneut einsehen kannst:",
					usage: "Verwende dieses Secret, um Webhook-Payloads in deiner empfangenden Anwendung zu verifizieren.",
					gotIt: "Verstanden",
				},
				editModal: {
					title: "Webhook bearbeiten",
					eventsHeader: "Events zum Abonnieren",
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
							"Dein Webhook-Secret wurde generiert. Speichere dieses Secret, da du es nicht erneut einsehen kannst:",
						usage: "Verwende dieses Secret, um Webhook-Payloads in deiner empfangenden Anwendung zu verifizieren.",
						buttonText: "Verstanden",
					},
					edit: {
						title: "Webhook bearbeiten",
						eventsSection: "Events zum Abonnieren",
						transformSection: "Transformationskonfiguration (Optional)",
						headersSection: "Header-Konfiguration",
						transformFile: {
							name: "Transformationsdatei",
							description:
								"Pfad zu einer .js oder .json Datei in deinem Vault, die Webhook-Payloads transformiert",
							placeholder: "discord-transform.js",
						},
						customHeaders: {
							name: "Benutzerdefinierte Header einschließen",
							description:
								"TaskNotes-Header einschließen (Event-Typ, Signatur, Lieferungs-ID). Für Discord, Slack und andere Dienste mit strengen CORS-Richtlinien ausschalten.",
						},
						buttons: {
							cancel: "Abbrechen",
							save: "Änderungen speichern",
						},
						notices: {
							selectAtLeastOneEvent: "Bitte wähle mindestens ein Event aus",
						},
					},
					add: {
						title: "Webhook hinzufügen",
						eventsSection: "Events zum Abonnieren",
						transformSection: "Transformationskonfiguration (Optional)",
						headersSection: "Header-Konfiguration",
						url: {
							name: "Webhook URL",
							description: "Der Endpunkt, an den Webhook-Payloads gesendet werden",
							placeholder: "https://dein-service.com/webhook",
						},
						transformFile: {
							name: "Transformationsdatei",
							description:
								"Pfad zu einer .js oder .json Datei in deinem Vault, die Webhook-Payloads transformiert",
							placeholder: "discord-transform.js",
						},
						customHeaders: {
							name: "Benutzerdefinierte Header einschließen",
							description:
								"TaskNotes-Header einschließen (Event-Typ, Signatur, Lieferungs-ID). Für Discord, Slack und andere Dienste mit strengen CORS-Richtlinien ausschalten.",
						},
						transformHelp: {
							title: "Transformationsdateien ermöglichen es dir, Webhook-Payloads anzupassen:",
							jsFiles: ".js Dateien:",
							jsDescription: " Benutzerdefinierte JavaScript-Transformationen",
							jsonFiles: ".json Dateien:",
							jsonDescription: " Vorlagen mit ",
							jsonVariable: "${data.task.title}",
							leaveEmpty: "Leer lassen:",
							leaveEmptyDescription: " Raw-Daten senden",
							example: "Beispiel:",
							exampleFile: "discord-transform.js",
						},
						buttons: {
							cancel: "Abbrechen",
							add: "Webhook hinzufügen",
						},
						notices: {
							urlRequired: "Webhook URL ist erforderlich",
							selectAtLeastOneEvent: "Bitte wähle mindestens ein Event aus",
						},
					},
				},
			},
			otherIntegrations: {
				header: "Andere Plugin-Integrationen",
				description: "Konfiguriere Integrationen mit anderen Obsidian-Plugins.",
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
		languageChanged: "Sprache geändert zu {language}.",
		exportTasksFailed: "Export der Aufgaben als ICS-Datei fehlgeschlagen",
	},
	commands: {
		openCalendarView: "Mini-Kalenderansicht öffnen",
		openAdvancedCalendarView: "Erweiterte Kalenderansicht öffnen",
		openTasksView: "Aufgabenansicht öffnen",
		openNotesView: "Notizenansicht öffnen",
		openAgendaView: "Agenda-Ansicht öffnen",
		openPomodoroView: "Pomodoro-Timer öffnen",
		openKanbanView: "Kanban-Board öffnen",
		openPomodoroStats: "Pomodoro-Statistiken öffnen",
		openStatisticsView: "Aufgaben- & Projektstatistiken öffnen",
		createNewTask: "Neue Aufgabe erstellen",
		convertToTaskNote: "Aufgabe zu TaskNote konvertieren",
		convertAllTasksInNote: "Alle Aufgaben in Notiz konvertieren",
		insertTaskNoteLink: "Tasknote-Link einfügen",
		createInlineTask: "Neue Inline-Aufgabe erstellen",
		quickActionsCurrentTask: "Schnellaktionen für aktuelle Aufgabe",
		goToTodayNote: "Zu heutiger Notiz gehen",
		startPomodoro: "Pomodoro-Timer starten",
		stopPomodoro: "Pomodoro-Timer stoppen",
		pauseResumePomodoro: "Pomodoro-Timer pausieren/fortsetzen",
		refreshCache: "Cache aktualisieren",
		exportAllTasksIcs: "Alle Aufgaben als ICS-Datei exportieren",
		viewReleaseNotes: "Versionshinweise anzeigen",
	},
	modals: {
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
			tagsPlaceholder: "tag1, tag2",
			timeEstimateLabel: "Zeitschätzung (Minuten)",
			timeEstimatePlaceholder: "30",
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
				addSubtasksTooltip: "Aufgaben auswählen, um sie zu Unteraufgaben dieser Aufgabe zu machen",
				removeSubtaskTooltip: "Unteraufgabe entfernen",
				notices: {
					noEligibleSubtasks: "Keine geeigneten Aufgaben verfügbar, um als Unteraufgaben zugewiesen zu werden",
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
		taskCreation: {
			title: "Aufgabe erstellen",
			actions: {
				fillFromNaturalLanguage: "Formular aus natürlicher Sprache ausfüllen",
				hideDetailedOptions: "Detailoptionen ausblenden",
				showDetailedOptions: "Detailoptionen anzeigen",
			},
			nlPlaceholder:
				"Einkaufen morgen um 15 Uhr @zuhause #besorgung\n\nDetails hier hinzufügen...",
			notices: {
				titleRequired: "Bitte gib einen Aufgabentitel ein",
				success: 'Aufgabe "{title}" erfolgreich erstellt',
				successShortened:
					'Aufgabe "{title}" erfolgreich erstellt (Dateiname wegen Länge gekürzt)',
				failure: "Aufgabe konnte nicht erstellt werden: {message}",
			},
		},
		taskEdit: {
			title: "Aufgabe bearbeiten",
			sections: {
				completions: "Abschlüsse",
				taskInfo: "Aufgabeninformationen",
			},
			metadata: {
				totalTrackedTime: "Gesamte erfasste Zeit:",
				created: "Erstellt:",
				modified: "Geändert:",
				file: "Datei:",
			},
			buttons: {
				archive: "Archivieren",
				unarchive: "Entarchivieren",
			},
			notices: {
				titleRequired: "Bitte gib einen Aufgabentitel ein",
				noChanges: "Keine Änderungen zu speichern",
				updateSuccess: 'Aufgabe "{title}" erfolgreich aktualisiert',
				updateFailure: "Aufgabe konnte nicht aktualisiert werden: {message}",
				fileMissing: "Aufgabendatei konnte nicht gefunden werden: {path}",
				openNoteFailure: "Aufgabennotiz konnte nicht geöffnet werden",
				archiveSuccess: "Aufgabe erfolgreich {action}",
				archiveFailure: "Aufgabe konnte nicht archiviert werden",
			},
			archiveAction: {
				archived: "archiviert",
				unarchived: "entarchiviert",
			},
		},
		storageLocation: {
			title: {
				migrate: "Pomodoro-Daten migrieren?",
				switch: "Zu täglichen Notizen wechseln?",
			},
			message: {
				migrate:
					"Dies wird deine bestehenden Pomodoro-Sitzungsdaten zu Frontmatter in täglichen Notizen migrieren. Die Daten werden nach Datum gruppiert und in jeder täglichen Notiz gespeichert.",
				switch: "Pomodoro-Sitzungsdaten werden im Frontmatter der täglichen Notizen statt in der Plugin-Datendatei gespeichert.",
			},
			whatThisMeans: "Was das bedeutet:",
			bullets: {
				dailyNotesRequired: "Daily Notes Core Plugin muss aktiviert bleiben",
				storedInNotes: "Daten werden im Frontmatter deiner täglichen Notizen gespeichert",
				migrateData: "Bestehende Plugin-Daten werden migriert und dann gelöscht",
				futureSessions: "Zukünftige Sitzungen werden in täglichen Notizen gespeichert",
				dataLongevity: "Dies bietet bessere Datenbeständigkeit mit deinen Notizen",
			},
			finalNote: {
				migrate:
					"⚠️ Stelle sicher, dass du Backups hast, falls nötig. Diese Änderung kann nicht automatisch rückgängig gemacht werden.",
				switch: "Du kannst jederzeit in Zukunft zurück zur Plugin-Speicherung wechseln.",
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
				dateTime: "Setze, wann diese Aufgabe abgeschlossen werden soll",
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
				invalidDateTime: "Bitte gib ein gültiges Datums- und Zeitformat ein",
				updateFailed:
					"Fälligkeitsdatum konnte nicht aktualisiert werden. Bitte versuche es erneut.",
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
				dateTime: "Setze, wann du an dieser Aufgabe arbeiten möchtest",
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
				invalidDateTime: "Bitte gib ein gültiges Datums- und Zeitformat ein",
				updateFailed:
					"Planungsdatum konnte nicht aktualisiert werden. Bitte versuche es erneut.",
			},
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
			reminders: "Erinnerungen",
			remindBeforeDue: "Vor Fälligkeit erinnern…",
			remindBeforeScheduled: "Vor Planung erinnern…",
			manageReminders: "Alle Erinnerungen verwalten…",
			clearReminders: "Alle Erinnerungen löschen",
			startTimeTracking: "Zeiterfassung starten",
			stopTimeTracking: "Zeiterfassung stoppen",
			archive: "Archivieren",
			unarchive: "Entarchivieren",
			openNote: "Notiz öffnen",
			copyTitle: "Aufgabentitel kopieren",
			noteActions: "Notizaktionen",
			rename: "Umbenennen",
			renameTitle: "Datei umbenennen",
			renamePlaceholder: "Neuen Namen eingeben",
			delete: "Löschen",
			deleteTitle: "Datei löschen",
			deleteMessage: 'Bist du sicher, dass du "{name}" löschen möchtest?',
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
			},
			recurrence: "Wiederholung",
			clearRecurrence: "Wiederholung löschen",
			customRecurrence: "Benutzerdefinierte Wiederholung...",
			createSubtask: "Unteraufgabe erstellen",
			dependencies: {
				title: "Abhängigkeiten",
				addBlockedBy: "Blockiert von hinzufügen…",
				addBlockedByTitle: "Aufgaben hinzufügen, von denen dies abhängt",
				addBlocking: "Blockierend hinzufügen…",
				addBlockingTitle: "Aufgaben hinzufügen, die dies blockiert",
				removeBlockedBy: "Blockiert-von entfernen…",
				removeBlocking: "Blockierend entfernen…",
				inputPlaceholder: "[[Aufgabennotiz]]",
				notices: {
					noEntries: "Bitte geben Sie mindestens eine Aufgabe ein",
					blockedByAdded: "{count} Abhängigkeit hinzugefügt",
					blockedByRemoved: "Abhängigkeit entfernt",
					blockingAdded: "{count} abhängige Aufgabe hinzugefügt",
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
					noEligibleSubtasks: "Keine geeigneten Aufgaben verfügbar, um als Unteraufgaben zugewiesen zu werden",
					currentTaskNotFound: "Aktuelle Aufgabendatei nicht gefunden",
				},
			},
			subtasks: {
				loading: "Unteraufgaben werden geladen...",
				noSubtasks: "Keine Unteraufgaben gefunden",
				loadFailed: "Unteraufgaben konnten nicht geladen werden",
			},
			markComplete: "Als abgeschlossen für dieses Datum markieren",
			markIncomplete: "Als unvollständig für dieses Datum markieren",
			quickReminders: {
				atTime: "Zur Zeit des Events",
				fiveMinutes: "5 Minuten vorher",
				fifteenMinutes: "15 Minuten vorher",
				oneHour: "1 Stunde vorher",
				oneDay: "1 Tag vorher",
			},
			notices: {
				toggleCompletionFailure:
					"Abschluss der wiederkehrenden Aufgabe konnte nicht umgeschaltet werden: {message}",
				updateDueDateFailure:
					"Aufgaben-Fälligkeitsdatum konnte nicht aktualisiert werden: {message}",
				updateScheduledFailure:
					"Aufgaben-Planungsdatum konnte nicht aktualisiert werden: {message}",
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
			},
		},
		ics: {
			showDetails: "Details anzeigen",
			createTask: "Aufgabe aus Event erstellen",
			createNote: "Notiz aus Event erstellen",
			linkNote: "Bestehende Notiz verlinken",
			copyTitle: "Titel kopieren",
			copyLocation: "Ort kopieren",
			copyUrl: "URL kopieren",
			copyMarkdown: "Als Markdown kopieren",
			subscriptionUnknown: "Unbekannter Kalender",
			notices: {
				copyTitleSuccess: "Event-Titel in Zwischenablage kopiert",
				copyLocationSuccess: "Ort in Zwischenablage kopiert",
				copyUrlSuccess: "Event-URL in Zwischenablage kopiert",
				copyMarkdownSuccess: "Event-Details als Markdown kopiert",
				copyFailure: "Kopieren in Zwischenablage fehlgeschlagen",
				taskCreated: "Aufgabe erstellt: {title}",
				taskCreateFailure: "Aufgabe aus Event konnte nicht erstellt werden",
				noteCreated: "Notiz erfolgreich erstellt",
				creationFailure: "Erstellungsmodal konnte nicht geöffnet werden",
				linkSuccess: 'Notiz "{name}" mit Event verlinkt',
				linkFailure: "Notiz konnte nicht verlinkt werden",
				linkSelectionFailure: "Notizauswahl konnte nicht geöffnet werden",
			},
			markdown: {
				titleFallback: "Unbenanntes Event",
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
					"Setze die aktuelle Sitzung fort, anstatt eine neue zu starten",
				timerAlreadyRunning: "Ein Timer läuft bereits",
				resumeSessionInstead:
					"Setze die aktuelle Sitzung fort, anstatt eine neue zu starten",
				shortBreakStarted: "Kurze Pause gestartet",
				longBreakStarted: "Lange Pause gestartet",
				paused: "Pomodoro pausiert",
				resumed: "Pomodoro fortgesetzt",
				stoppedAndReset: "Pomodoro gestoppt und zurückgesetzt",
				migrationSuccess:
					"{count} Pomodoro-Sitzungen erfolgreich zu täglichen Notizen migriert.",
				migrationFailure:
					"Migration der Pomodoro-Daten fehlgeschlagen. Bitte versuche es erneut oder prüfe die Konsole für Details.",
			},
		},
		icsSubscription: {
			notices: {
				calendarNotFound:
					'Kalender "{name}" nicht gefunden (404). Bitte prüfe, ob die ICS-URL korrekt ist und der Kalender öffentlich zugänglich ist.',
				calendarAccessDenied:
					'Kalender "{name}" Zugriff verweigert (500). Dies könnte auf Microsoft Outlook Server-Beschränkungen zurückzuführen sein. Versuche, die ICS-URL aus deinen Kalendereinstellungen neu zu generieren.',
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
					past: "Vergangene Planung",
					today: "Heute",
					tomorrow: "Morgen",
					nextSevenDays: "Nächste sieben Tage",
					later: "Später",
					none: "Kein Planungsdatum",
				},
			},
			errors: {
				noDatesProvided: "Keine Daten bereitgestellt",
			},
			folders: {
				root: "(Root)",
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
					"Batch-Konvertierung fehlgeschlagen. Bitte versuche es erneut.",
				invalidParameters: "Ungültige Eingabeparameter.",
				emptyLine: "Aktuelle Zeile ist leer oder enthält keinen gültigen Inhalt.",
				parseError: "Fehler beim Parsen der Aufgabe: {error}",
				invalidTaskData: "Ungültige Aufgabendaten.",
				replaceLineFailed: "Aufgabenzeile konnte nicht ersetzt werden.",
				conversionComplete: "Aufgabe konvertiert: {title}",
				conversionCompleteShortened:
					'Aufgabe konvertiert: "{title}" (Dateiname wegen Länge gekürzt)',
				fileExists:
					"Eine Datei mit diesem Namen existiert bereits. Bitte versuche es erneut oder benenne die Aufgabe um.",
				conversionFailed:
					"Aufgabe konnte nicht konvertiert werden. Bitte versuche es erneut.",
			},
		},
		icsNote: {
			notices: {
				templateNotFound: "Vorlage nicht gefunden: {path}",
				templateProcessError: "Fehler beim Verarbeiten der Vorlage: {template}",
				linkedToEvent: "Notiz mit ICS-Event verlinkt: {title}",
			},
		},
		task: {
			notices: {
				templateNotFound: "Aufgabenkörper-Vorlage nicht gefunden: {path}",
				templateReadError: "Fehler beim Lesen der Aufgabenkörper-Vorlage: {template}",
				moveTaskFailed: "{operation} Aufgabe konnte nicht verschoben werden: {error}",
			},
		},
		autoExport: {
			notices: {
				exportFailed: "TaskNotes Auto-Export fehlgeschlagen: {error}",
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
			untitledEvent: "Unbenanntes Event",
			allDay: "Ganztägig",
			calendarEvent: "Kalenderevent",
			calendarFallback: "Kalender",
		},
		noteCard: {
			createdLabel: "Erstellt:",
			dailyBadge: "Täglich",
			dailyTooltip: "Tägliche Notiz",
		},
		taskCard: {
			blockedBadge: "Blockiert",
			blockedBadgeTooltip: "Diese Aufgabe wartet auf eine andere Aufgabe",
			blockingBadge: "Blockierend",
			blockingBadgeTooltip: "Diese Aufgabe blockiert eine andere Aufgabe",
			blockingToggle: "Blockiert {count} Aufgaben",
			loadingDependencies: "Abhängigkeiten werden geladen…",
			blockingEmpty: "Keine abhängigen Aufgaben",
			blockingLoadError: "Abhängigkeiten konnten nicht geladen werden",
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
			followingAreTrue: "der folgenden sind wahr:",
			where: "wo",
			selectProperty: "Auswählen...",
			chooseProperty: "Wähle, nach welcher Aufgabeneigenschaft gefiltert werden soll",
			chooseOperator: "Wähle, wie der Eigenschaftswert verglichen werden soll",
			enterValue: "Gib den Wert zum Filtern ein",
			selectValue: "Wähle eine {property} zum Filtern",
			sortBy: "Sortieren nach:",
			toggleSortDirection: "Sortierrichtung umschalten",
			chooseSortMethod: "Wähle, wie Aufgaben sortiert werden sollen",
			groupBy: "Gruppieren nach:",
			chooseGroupMethod: "Aufgaben nach gemeinsamer Eigenschaft gruppieren",
			toggleViewOption: "{option} umschalten",
			expandCollapseFilters: "Klicken zum Aus-/Einklappen der Filterbedingungen",
			expandCollapseSort: "Klicken zum Aus-/Einklappen der Sortier- und Gruppenoptionen",
			expandCollapseViewOptions:
				"Klicken zum Aus-/Einklappen der ansichtsspezifischen Optionen",
			naturalLanguageDates: "Natürliche Sprache Daten",
			naturalLanguageExamples: "Beispiele für natürliche Sprache Daten anzeigen",
			enterNumericValue: "Gib einen numerischen Wert zum Filtern ein",
			enterDateValue: "Gib ein Datum in natürlicher Sprache oder ISO-Format ein",
			pickDateTime: "Datum & Zeit wählen",
			noSavedViews: "Keine gespeicherten Ansichten",
			savedViews: "Gespeicherte Ansichten",
			yourSavedFilters: "Deine gespeicherten Filterkonfigurationen",
			dragToReorder: "Ziehen zum Neuordnen der Ansichten",
			loadSavedView: "Gespeicherte Ansicht laden: {name}",
			deleteView: "Ansicht löschen",
			deleteViewTitle: "Ansicht löschen",
			deleteViewMessage: 'Bist du sicher, dass du die Ansicht "{name}" löschen möchtest?',
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
			},
			notices: {
				propertiesMenuFailed: "Eigenschaftenmenü konnte nicht angezeigt werden",
			},
		},
	},
	components: {
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
			remindBeforeScheduled: "Vor Planung erinnern...",
			manageAllReminders: "Alle Erinnerungen verwalten...",
			clearAllReminders: "Alle Erinnerungen löschen",
			quickReminders: {
				atTime: "Zur Zeit des Events",
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
			customRecurrence: "Benutzerdefinierte Wiederholung...",
			clearRecurrence: "Wiederholung löschen",
			customRecurrenceModal: {
				title: "Benutzerdefinierte Wiederholung",
				startDate: "Startdatum",
				startDateDesc: "Das Datum, an dem das Wiederholungsmuster beginnt",
				startTime: "Startzeit",
				startTimeDesc:
					"Die Zeit, zu der wiederkehrende Instanzen erscheinen sollen (optional)",
				frequency: "Häufigkeit",
				interval: "Intervall",
				intervalDesc: "Alle X Tage/Wochen/Monate/Jahre",
				daysOfWeek: "Wochentage",
				daysOfWeekDesc: "Bestimmte Tage auswählen (für wöchentliche Wiederholung)",
				monthlyRecurrence: "Monatliche Wiederholung",
				monthlyRecurrenceDesc: "Wähle, wie monatlich wiederholt werden soll",
				yearlyRecurrence: "Jährliche Wiederholung",
				yearlyRecurrenceDesc: "Wähle, wie jährlich wiederholt werden soll",
				endCondition: "Endbedingung",
				endConditionDesc: "Wähle, wann die Wiederholung enden soll",
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

export type DeTranslationSchema = typeof de;
