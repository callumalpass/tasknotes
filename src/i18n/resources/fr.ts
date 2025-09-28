import { TranslationTree } from "../types";

export const fr: TranslationTree = {
	common: {
		appName: "Notes de tâches",
		cancel: "Annuler",
		confirm: "Confirmer",
		close: "Fermer",
		save: "Enregistrer",
		language: "Langue",
		systemDefault: "Langue du système",
		languages: {
			en: "Anglais",
			fr: "Français",
			ru: "Russe",
			zh: "Chinois",
			de: "Allemand",
			es: "Espagnol",
			ja: "Japonais",
		},
		weekdays: {
			sunday: "Dimanche",
			monday: "Lundi",
			tuesday: "Mardi",
			wednesday: "Mercredi",
			thursday: "Jeudi",
			friday: "Vendredi",
			saturday: "Samedi",
		},
		months: {
			january: "Janvier",
			february: "Février",
			march: "Mars",
			april: "Avril",
			may: "Mai",
			june: "Juin",
			july: "Juillet",
			august: "Août",
			september: "Septembre",
			october: "Octobre",
			november: "Novembre",
			december: "Décembre",
		},
	},
	views: {
		agenda: {
			title: "Agenda quotidien",
			today: "Aujourd'hui",
			refreshCalendars: "Actualiser les calendriers",
			actions: {
				previousPeriod: "Période précédente",
				nextPeriod: "Période suivante",
				goToToday: "Aller à aujourd'hui",
				refreshCalendars: "Actualiser les abonnements calendrier",
			},
			loading: "Chargement de l'agenda...",
			dayToggle: "Basculer l'affichage du jour",
			expandAllDays: "Déplier tous les jours",
			collapseAllDays: "Replier tous les jours",
			notices: {
				calendarNotReady: "Service de calendrier pas encore prêt",
				calendarRefreshed: "Abonnements calendrier actualisés",
				refreshFailed: "Échec de l'actualisation",
			},
			empty: {
				noItemsScheduled: "Aucun élément planifié",
				noItemsFound: "Aucun élément trouvé",
			},
		},
		taskList: {
			title: "Tâches",
			expandAllGroups: "Déplier tous les groupes",
			collapseAllGroups: "Replier tous les groupes",
			noTasksFound: "Aucune tâche trouvée pour les filtres sélectionnés.",
		},
		notes: {
			title: "Bloc-notes",
			refreshButton: "Actualisation...",
			notices: {
				indexingDisabled: "Indexation des notes désactivée",
			},
			empty: {
				noNotesFound: "Aucune note trouvée",
			},
		},
		miniCalendar: {
			title: "Mini calendrier",
		},
		advancedCalendar: {
			title: "Calendrier avancé",
		},
		kanban: {
			title: "Tableau Kanban",
			newTask: "Nouvelle tâche",
			addCard: "+ Ajouter une carte",
			noTasks: "Aucune tâche",
			notices: {
				loadFailed: "Échec du chargement du tableau Kanban",
				movedTask: 'Tâche déplacée vers "{0}"',
			},
			errors: {
				loadingBoard: "Erreur lors du chargement du tableau.",
			},
		},
		pomodoro: {
			title: "Sessions Pomodoro",
			status: {
				focus: "Concentration",
				ready: "Prêt à démarrer",
				paused: "En pause",
				working: "En travail",
				shortBreak: "Pause courte",
				longBreak: "Pause longue",
				breakPrompt: "Bravo ! C'est l'heure d'une pause {length}",
				breakLength: {
					short: "courte",
					long: "longue",
				},
				breakComplete: "Pause terminée ! Prêt pour le prochain pomodoro ?",
			},
			buttons: {
				start: "Démarrer",
				pause: "Mettre en pause",
				stop: "Arrêter",
				resume: "Reprendre",
				startShortBreak: "Commencer la pause courte",
				startLongBreak: "Commencer la pause longue",
				skipBreak: "Passer la pause",
				chooseTask: "Choisir une tâche...",
				changeTask: "Changer de tâche...",
				clearTask: "Effacer la tâche",
				selectDifferentTask: "Sélectionner une autre tâche",
			},
			notices: {
				noTasks: "Aucune tâche non archivée retrouvée. Créez d'abord quelques tâches.",
				loadFailed: "Impossible de charger les tâches",
			},
			statsLabel: "terminées aujourd'hui",
		},
		pomodoroStats: {
			title: "Statistiques Pomodoro",
			heading: "Statistiques Pomodoro",
			refresh: "Actualiser",
			sections: {
				overview: "Aperçu",
				today: "Aujourd'hui",
				week: "Cette semaine",
				allTime: "Historique",
				recent: "Sessions récentes",
			},
			overviewCards: {
				todayPomos: {
					label: "Pomodoros du jour",
					change: {
						more: "{count} de plus qu'hier",
						less: "{count} de moins qu'hier",
					},
				},
				totalPomos: {
					label: "Total des pomodoros",
				},
				todayFocus: {
					label: "Temps de focus du jour",
					change: {
						more: "{duration} de plus qu'hier",
						less: "{duration} de moins qu'hier",
					},
				},
				totalFocus: {
					label: "Durée de focus cumulée",
				},
			},
			stats: {
				pomodoros: "Sessions",
				streak: "Série",
				minutes: "Minutes totales",
				average: "Durée moy.",
				completion: "Taux d'achèvement",
			},
			recents: {
				empty: "Aucune session enregistrée pour le moment",
				duration: "Durée : {minutes} min",
				status: {
					completed: "Terminée",
					interrupted: "Interrompue",
				},
			},
		},
		stats: {
			title: "Statistiques",
			taskProjectStats: "Statistiques des tâches et projets",
			sections: {
				filters: "Filtres",
				overview: "Aperçu",
				today: "Aujourd'hui",
				thisWeek: "Cette semaine",
				thisMonth: "Ce mois",
				projectBreakdown: "Répartition par projet",
				dateRange: "Plage de dates",
			},
			filters: {
				minTime: "Temps min (minutes)",
			},
		},
	},
	settings: {
		tabs: {
			general: "Général",
			taskProperties: "Propriétés des tâches",
			defaults: "Défauts et modèles",
			appearance: "Apparence et interface",
			features: "Fonctionnalités",
			integrations: "Intégrations",
		},
		features: {
			inlineTasks: {
				header: "Tâches dans les notes",
				description:
					"Configurez les fonctionnalités de tâches intégrées pour gérer vos tâches directement dans vos notes.",
			},
			overlays: {
				taskLinkToggle: {
					name: "Survol des liens de tâches",
					description:
						"Afficher des superpositions interactives lorsque la souris passe sur les liens de tâches",
				},
			},
			instantConvert: {
				toggle: {
					name: "Conversion instantanée en tâche",
					description:
						"Activer la conversion instantanée de texte en tâche via les raccourcis clavier",
				},
				folder: {
					name: "Dossier pour la conversion",
					description:
						"Dossier utilisé pour les tâches converties. Utilisez {{currentNotePath}} pour un chemin relatif à la note actuelle",
				},
			},
			nlp: {
				header: "Traitement du langage naturel",
				description:
					"Activez l'analyse intelligente des détails des tâches depuis le langage naturel.",
				enable: {
					name: "Activer la saisie en langage naturel",
					description:
						"Analyser les dates, priorités et contextes lors de la création de tâches",
				},
				defaultToScheduled: {
					name: "Planifié par défaut",
					description:
						"Si une date est détectée sans contexte, la considérer comme planifiée plutôt qu'échéance",
				},
				language: {
					name: "Langue du NLP",
					description:
						"Langue utilisée pour les modèles de traitement du langage naturel et l'analyse des dates",
				},
				statusTrigger: {
					name: "Déclencheur des statuts suggérés",
					description:
						"Texte qui déclenche les suggestions de statut (laisser vide pour désactiver)",
				},
			},
			pomodoro: {
				header: "Minuteur Pomodoro",
				description:
					"Minuteur Pomodoro intégré pour gérer le temps et suivre votre productivité.",
				workDuration: {
					name: "Durée de travail",
					description: "Durée des sessions de travail en minutes",
				},
				shortBreak: {
					name: "Durée de la pause courte",
					description: "Durée des pauses courtes en minutes",
				},
				longBreak: {
					name: "Durée de la pause longue",
					description: "Durée des pauses longues en minutes",
				},
				longBreakInterval: {
					name: "Intervalle des pauses longues",
					description: "Nombre de sessions de travail avant une pause longue",
				},
				autoStartBreaks: {
					name: "Lancer automatiquement les pauses",
					description:
						"Démarrer automatiquement les pauses après chaque session de travail",
				},
				autoStartWork: {
					name: "Reprise automatique du travail",
					description: "Démarrer automatiquement une session de travail après les pauses",
				},
				notifications: {
					name: "Notifications Pomodoro",
					description:
						"Afficher une notification lorsque les sessions Pomodoro se terminent",
				},
			},
			uiLanguage: {
				header: "Langue de l'interface",
				description: "Modifiez la langue des menus, notifications et vues de TaskNotes.",
				dropdown: {
					name: "Langue de l'interface",
					description:
						"Sélectionnez la langue utilisée pour le texte de l'interface TaskNotes",
				},
			},
			pomodoroSound: {
				enabledName: "Son activé",
				enabledDesc: "Jouer un son à la fin des sessions Pomodoro",
				volumeName: "Volume du son",
				volumeDesc: "Volume des sons Pomodoro (0-100)",
			},
			dataStorage: {
				name: "Stockage des données Pomodoro",
				dailyNotes: "Notes quotidiennes",
			},
			notifications: {
				header: "Notifications",
				enableName: "Activer les notifications",
				enableDesc: "Activer les notifications de rappel de tâches",
				typeName: "Type de notification",
				typeDesc: "Type de notifications à afficher",
				systemLabel: "Notifications système",
				inAppLabel: "Notifications dans l'application",
			},
			overdue: {
				hideCompletedName: "Masquer les tâches terminées des retards",
				hideCompletedDesc: "Exclure les tâches terminées du calcul des tâches en retard",
			},
			indexing: {
				disableName: "Désactiver l'indexation des notes",
				disableDesc:
					"Désactiver l'indexation automatique du contenu des notes pour de meilleures performances",
			},
			suggestions: {
				debounceName: "Délai des suggestions",
				debounceDesc: "Délai en millisecondes avant d'afficher les suggestions",
			},
			timeTracking: {
				autoStopName: "Arrêt automatique du suivi du temps",
				autoStopDesc:
					"Arrêter automatiquement le suivi du temps lorsqu'une tâche est marquée comme terminée",
				stopNotificationName: "Notification d'arrêt du suivi du temps",
				stopNotificationDesc:
					"Afficher une notification lorsque le suivi du temps est automatiquement arrêté",
			},
			recurring: {
				maintainOffsetName:
					"Maintenir le décalage de date d'échéance dans les tâches récurrentes",
				maintainOffsetDesc:
					"Conserver le décalage entre la date d'échéance et la date planifiée lors de l'achèvement des tâches récurrentes",
			},
			timeblocking: {
				header: "Planification par blocs",
				enableName: "Activer la planification par blocs",
				enableDesc:
					"Activer la fonctionnalité de planification par blocs pour une programmation légère dans les notes quotidiennes",
				showBlocksName: "Afficher les blocs de temps",
				showBlocksDesc: "Afficher les blocs de temps des notes quotidiennes par défaut",
			},
			performance: {
				header: "Performance et comportement",
			},
			timeTrackingSection: {
				header: "Suivi du temps",
			},
			recurringSection: {
				header: "Tâches récurrentes",
			},
		},
		defaults: {
			header: {
				basicDefaults: "Paramètres par défaut",
				dateDefaults: "Dates par défaut",
				defaultReminders: "Rappels par défaut",
				bodyTemplate: "Modèle de contenu",
				instantTaskConversion: "Conversion instantanée en tâche",
			},
			description: {
				basicDefaults:
					"Définir les valeurs par défaut pour les nouvelles tâches afin d'accélérer la création.",
				dateDefaults:
					"Définir les dates d'échéance et de planification par défaut pour les nouvelles tâches.",
				defaultReminders:
					"Configurer les rappels par défaut qui seront ajoutés aux nouvelles tâches.",
				bodyTemplate:
					"Configurer un fichier modèle à utiliser pour le contenu des nouvelles tâches.",
				instantTaskConversion:
					"Configurer le comportement lors de la conversion instantanée de texte en tâches.",
			},
			basicDefaults: {
				defaultStatus: {
					name: "Statut par défaut",
					description: "Statut par défaut pour les nouvelles tâches",
				},
				defaultPriority: {
					name: "Priorité par défaut",
					description: "Priorité par défaut pour les nouvelles tâches",
				},
				defaultContexts: {
					name: "Contextes par défaut",
					description:
						"Liste de contextes par défaut séparés par des virgules (ex. @maison, @travail)",
					placeholder: "@maison, @travail",
				},
				defaultTags: {
					name: "Tags par défaut",
					description: "Liste de tags par défaut séparés par des virgules (sans #)",
					placeholder: "important, urgent",
				},
				defaultProjects: {
					name: "Projets par défaut",
					description: "Liens de projets par défaut pour les nouvelles tâches",
					selectButton: "Sélectionner des projets",
					selectTooltip: "Choisir les notes de projet à lier par défaut",
					removeTooltip: "Retirer {name} des projets par défaut",
				},
				useParentNoteAsProject: {
					name: "Utiliser la note parent comme projet lors de la conversion instantanée",
					description:
						"Lier automatiquement la note parent comme projet lors de la conversion instantanée de tâche",
				},
				defaultTimeEstimate: {
					name: "Estimation de temps par défaut",
					description:
						"Estimation de temps par défaut en minutes (0 = aucune par défaut)",
					placeholder: "60",
				},
				defaultRecurrence: {
					name: "Récurrence par défaut",
					description: "Modèle de récurrence par défaut pour les nouvelles tâches",
				},
			},
			dateDefaults: {
				defaultDueDate: {
					name: "Date d'échéance par défaut",
					description: "Date d'échéance par défaut pour les nouvelles tâches",
				},
				defaultScheduledDate: {
					name: "Date planifiée par défaut",
					description: "Date planifiée par défaut pour les nouvelles tâches",
				},
			},
			reminders: {
				addReminder: {
					name: "Ajouter un rappel par défaut",
					description:
						"Créer un nouveau rappel par défaut qui sera ajouté à toutes les nouvelles tâches",
					buttonText: "Ajouter un rappel",
				},
				emptyState:
					"Aucun rappel par défaut configuré. Ajoutez un rappel pour être automatiquement notifié des nouvelles tâches.",
				emptyStateButton: "Ajouter un rappel",
				reminderDescription: "Description du rappel",
				unnamedReminder: "Rappel sans nom",
				deleteTooltip: "Supprimer le rappel",
				fields: {
					description: "Description :",
					type: "Type :",
					offset: "Décalage :",
					unit: "Unité :",
					direction: "Direction :",
					relatedTo: "Relatif à :",
					date: "Date :",
					time: "Heure :",
				},
				types: {
					relative: "Relatif (avant/après les dates de la tâche)",
					absolute: "Absolu (date/heure spécifique)",
				},
				units: {
					minutes: "minutes",
					hours: "heures",
					days: "jours",
				},
				directions: {
					before: "avant",
					after: "après",
				},
				relatedTo: {
					due: "date d'échéance",
					scheduled: "date planifiée",
				},
			},
			bodyTemplate: {
				useBodyTemplate: {
					name: "Utiliser un modèle de contenu",
					description: "Utiliser un fichier modèle pour le contenu du corps de la tâche",
				},
				bodyTemplateFile: {
					name: "Fichier modèle de contenu",
					description:
						"Chemin vers le fichier modèle pour le contenu du corps de la tâche. Prend en charge les variables comme {{title}}, {{date}}, {{time}}, {{priority}}, {{status}}, etc.",
					placeholder: "Templates/Modèle de tâche.md",
					ariaLabel: "Chemin vers le fichier modèle de contenu",
				},
				variablesHeader: "Variables du modèle :",
				variables: {
					title: "{{title}} - Titre de la tâche",
					details: "{{details}} - Détails fournis par l'utilisateur depuis la fenêtre",
					date: "{{date}} - Date actuelle (AAAA-MM-JJ)",
					time: "{{time}} - Heure actuelle (HH:MM)",
					priority: "{{priority}} - Priorité de la tâche",
					status: "{{status}} - Statut de la tâche",
					contexts: "{{contexts}} - Contextes de la tâche",
					tags: "{{tags}} - Tags de la tâche",
					projects: "{{projects}} - Projets de la tâche",
				},
			},
			instantConversion: {
				useDefaultsOnInstantConvert: {
					name: "Utiliser les paramètres par défaut lors de la conversion instantanée",
					description:
						"Appliquer les paramètres de tâche par défaut lors de la conversion instantanée de texte en tâches",
				},
			},
			options: {
				noDefault: "Aucune par défaut",
				none: "Aucune",
				today: "Aujourd'hui",
				tomorrow: "Demain",
				nextWeek: "La semaine prochaine",
				daily: "Quotidien",
				weekly: "Hebdomadaire",
				monthly: "Mensuel",
				yearly: "Annuel",
			},
		},
		general: {
			taskStorage: {
				header: "Stockage des tâches",
				description:
					"Configurez où les tâches sont stockées et comment elles sont identifiées.",
				defaultFolder: {
					name: "Dossier par défaut des tâches",
					description: "Emplacement par défaut pour les nouvelles tâches",
				},
				moveArchived: {
					name: "Déplacer les tâches archivées vers un dossier",
					description:
						"Déplacer automatiquement les tâches archivées vers un dossier d'archive",
				},
				archiveFolder: {
					name: "Dossier d'archive",
					description:
						"Dossier vers lequel déplacer les tâches lorsqu'elles sont archivées",
				},
			},
			taskIdentification: {
				header: "Identification des tâches",
				description: "Choisissez comment TaskNotes identifie les notes comme des tâches.",
				identifyBy: {
					name: "Identifier les tâches par",
					description:
						"Choisissez d'identifier les tâches par tag ou par une propriété frontmatter",
					options: {
						tag: "Étiquette",
						property: "Propriété",
					},
				},
				taskTag: {
					name: "Tag de tâche",
					description: "Tag qui identifie les notes comme des tâches (sans #)",
				},
				taskProperty: {
					name: "Nom de la propriété de tâche",
					description: 'Le nom de la propriété frontmatter (ex. "category")',
				},
				taskPropertyValue: {
					name: "Valeur de la propriété de tâche",
					description: 'La valeur qui identifie une note comme une tâche (ex. "task")',
				},
			},
			folderManagement: {
				header: "Gestion des dossiers",
				excludedFolders: {
					name: "Dossiers exclus",
					description:
						"Liste séparée par des virgules des dossiers à exclure de l'onglet Notes",
				},
			},
			taskInteraction: {
				header: "Interaction avec les tâches",
				description: "Configurez le comportement des clics sur les tâches.",
				singleClick: {
					name: "Action du clic simple",
					description: "Action effectuée lors d'un clic simple sur une carte de tâche",
				},
				doubleClick: {
					name: "Action du double-clic",
					description: "Action effectuée lors d'un double-clic sur une carte de tâche",
				},
				actions: {
					edit: "Modifier la tâche",
					openNote: "Ouvrir la note",
					none: "Aucune action",
				},
			},
		},
		taskProperties: {
			taskStatuses: {
				header: "Statuts des tâches",
				description:
					"Personnalisez les options de statut disponibles pour vos tâches. Ces statuts contrôlent le cycle de vie des tâches et déterminent quand les tâches sont considérées comme terminées.",
				howTheyWork: {
					title: "Comment fonctionnent les statuts :",
					value: 'Valeur : L\'identifiant interne stocké dans vos fichiers de tâches (ex. "in-progress")',
					label: 'Label : Le nom affiché dans l\'interface (ex. "En cours")',
					color: "Couleur : Couleur d'indicateur visuel pour les points et badges de statut",
					completed:
						"Terminé : Quand coché, les tâches avec ce statut sont considérées comme finies et peuvent être filtrées différemment",
					autoArchive:
						"Archivage auto : Quand activé, les tâches seront automatiquement archivées après le délai spécifié (1-1440 minutes)",
					orderNote:
						"L'ordre ci-dessous détermine la séquence lors du passage d'un statut à l'autre en cliquant sur les badges de statut des tâches.",
				},
				addNew: {
					name: "Ajouter un nouveau statut",
					description: "Créer une nouvelle option de statut pour vos tâches",
					buttonText: "Ajouter un statut",
				},
				validationNote:
					'Note : Vous devez avoir au moins 2 statuts, et au moins un statut doit être marqué comme "Terminé".',
				emptyState:
					"Aucun statut personnalisé configuré. Ajoutez un statut pour commencer.",
				emptyStateButton: "Ajouter un statut",
				fields: {
					value: "Valeur :",
					label: "Label :",
					color: "Couleur :",
					completed: "Terminé :",
					autoArchive: "Archivage auto :",
					delayMinutes: "Délai (minutes) :",
				},
				placeholders: {
					value: "en-cours",
					label: "En cours",
				},
				badges: {
					completed: "Terminé",
				},
				deleteConfirm: 'Voulez-vous vraiment supprimer le statut "{label}" ?',
			},
			taskPriorities: {
				header: "Priorités des tâches",
				description:
					"Personnalisez les niveaux de priorité disponibles pour vos tâches. Les poids de priorité déterminent l'ordre de tri et la hiérarchie visuelle dans vos vues de tâches.",
				howTheyWork: {
					title: "Comment fonctionnent les priorités :",
					value: 'Valeur : L\'identifiant interne stocké dans vos fichiers de tâches (ex. "high")',
					label: "Label d'affichage : Le nom affiché dans l'interface (ex. \"Priorité élevée\")",
					color: "Couleur : Couleur d'indicateur visuel pour les points et badges de priorité",
					weight: "Poids : Valeur numérique pour le tri (les poids plus élevés apparaissent en premier dans les listes)",
					weightNote:
						"Les tâches sont automatiquement triées par poids de priorité en ordre décroissant (le poids le plus élevé en premier). Les poids peuvent être n'importe quel nombre positif.",
				},
				addNew: {
					name: "Ajouter une nouvelle priorité",
					description: "Créer un nouveau niveau de priorité pour vos tâches",
					buttonText: "Ajouter une priorité",
				},
				validationNote:
					"Note : Vous devez avoir au moins 1 priorité. Les poids plus élevés prennent la précédence dans le tri et la hiérarchie visuelle.",
				emptyState:
					"Aucune priorité personnalisée configurée. Ajoutez une priorité pour commencer.",
				emptyStateButton: "Ajouter une priorité",
				fields: {
					value: "Valeur :",
					label: "Label :",
					color: "Couleur :",
					weight: "Poids :",
				},
				placeholders: {
					value: "elevee",
					label: "Priorité élevée",
				},
				weightLabel: "Poids : {weight}",
				deleteConfirm: "Vous devez avoir au moins une priorité",
				deleteTooltip: "Supprimer la priorité",
			},
			fieldMapping: {
				header: "Mappage des champs",
				warning:
					"⚠️ Attention : TaskNotes lira ET écrira en utilisant ces noms de propriétés. Les changer après avoir créé des tâches peut causer des incohérences.",
				description:
					"Configurez quelles propriétés frontmatter TaskNotes doit utiliser pour chaque champ.",
				resetButton: {
					name: "Réinitialiser les mappages de champs",
					description: "Réinitialiser tous les mappages de champs aux valeurs par défaut",
					buttonText: "Réinitialiser aux défauts",
				},
				notices: {
					resetSuccess: "Mappages de champs réinitialisés aux défauts",
					resetFailure: "Échec de la réinitialisation des mappages de champs",
					updateFailure:
						"Échec de la mise à jour du mappage de champ pour {label}. Veuillez réessayer.",
				},
				table: {
					fieldHeader: "Champ TaskNotes",
					propertyHeader: "Nom de votre propriété",
				},
				fields: {
					title: "Titre",
					status: "Statut",
					priority: "Priorité",
					due: "Date d'échéance",
					scheduled: "Date planifiée",
					contexts: "Contextes",
					projects: "Projets",
					timeEstimate: "Estimation de temps",
					recurrence: "Récurrence",
					dateCreated: "Date de création",
					completedDate: "Date d'achèvement",
					dateModified: "Date de modification",
					archiveTag: "Tag d'archive",
					timeEntries: "Entrées de temps",
					completeInstances: "Instances complètes",
					pomodoros: "Sessions Pomodoro",
					icsEventId: "ID d'événement ICS",
					icsEventTag: "Tag d'événement ICS",
					reminders: "Rappels",
				},
			},
			customUserFields: {
				header: "Champs utilisateur personnalisés",
				description:
					"Définissez des propriétés frontmatter personnalisées pour qu'elles apparaissent comme options de filtrage conscientes du type dans toutes les vues. Chaque ligne : Nom d'affichage, Nom de propriété, Type.",
				addNew: {
					name: "Ajouter un nouveau champ utilisateur",
					description:
						"Créer un nouveau champ personnalisé qui apparaîtra dans les filtres et vues",
					buttonText: "Ajouter un champ utilisateur",
				},
				emptyState:
					"Aucun champ utilisateur personnalisé configuré. Ajoutez un champ pour créer des propriétés personnalisées pour vos tâches.",
				emptyStateButton: "Ajouter un champ utilisateur",
				fields: {
					displayName: "Nom d'affichage :",
					propertyKey: "Clé de propriété :",
					type: "Type :",
				},
				placeholders: {
					displayName: "Nom d'affichage",
					propertyKey: "nom-propriete",
				},
				types: {
					text: "Texte",
					number: "Nombre",
					boolean: "Booléen",
					date: "Date (AAAA-MM-JJ)",
					list: "Liste",
				},
				defaultNames: {
					unnamedField: "Champ sans nom",
					noKey: "aucune-cle",
				},
				deleteTooltip: "Supprimer le champ",
			},
		},
		appearance: {
			taskCards: {
				header: "Cartes de tâches",
				description: "Configurez l'affichage des cartes de tâches dans toutes les vues.",
				defaultVisibleProperties: {
					name: "Propriétés visibles par défaut",
					description:
						"Choisissez quelles propriétés apparaissent sur les cartes de tâches par défaut.",
				},
				propertyGroups: {
					coreProperties: "PROPRIÉTÉS PRINCIPALES",
					organization: "ORGANISATION",
					customProperties: "PROPRIÉTÉS PERSONNALISÉES",
				},
				properties: {
					status: "Point de statut",
					priority: "Point de priorité",
					due: "Date d'échéance",
					scheduled: "Date planifiée",
					timeEstimate: "Estimation de temps",
					totalTrackedTime: "Temps suivi total",
					recurrence: "Récurrence",
					completedDate: "Date d'achèvement",
					createdDate: "Date de création",
					modifiedDate: "Date de modification",
					projects: "Projets",
					contexts: "Contextes",
					tags: "Étiquettes",
					blocked: "Bloqué",
					blocking: "Bloquant",
				},
			},
			taskFilenames: {
				header: "Noms de fichiers des tâches",
				description:
					"Configurez comment les fichiers de tâches sont nommés lors de leur création.",
				storeTitleInFilename: {
					name: "Stocker le titre dans le nom de fichier",
					description:
						"Utiliser le titre de la tâche comme nom de fichier. Le nom de fichier sera mis à jour quand le titre de la tâche changera (Recommandé).",
				},
				filenameFormat: {
					name: "Format du nom de fichier",
					description: "Comment les noms de fichiers de tâches doivent être générés",
					options: {
						title: "Titre de la tâche (Non-mis à jour)",
						zettel: "Format Zettelkasten (AAMMJJ + secondes base36 depuis minuit)",
						timestamp: "Horodatage complet (AAAA-MM-JJ-HHMMSS)",
						custom: "Modèle personnalisé",
					},
				},
				customTemplate: {
					name: "Modèle de nom de fichier personnalisé",
					description:
						"Modèle pour les noms de fichiers personnalisés. Variables disponibles : {title}, {titleLower}, {titleUpper}, {titleSnake}, {titleKebab}, {titleCamel}, {titlePascal}, {date}, {shortDate}, {time}, {time12}, {time24}, {timestamp}, {dateTime}, {year}, {month}, {monthName}, {monthNameShort}, {day}, {dayName}, {dayNameShort}, {hour}, {hour12}, {minute}, {second}, {milliseconds}, {ms}, {ampm}, {week}, {quarter}, {unix}, {unixMs}, {timezone}, {timezoneShort}, {utcOffset}, {utcOffsetShort}, {utcZ}, {zettel}, {nano}, {priority}, {priorityShort}, {status}, {statusShort}, {dueDate}, {scheduledDate}",
					placeholder: "{date}-{title}-{dueDate}",
					helpText:
						"Note : {dueDate} et {scheduledDate} sont au format AAAA-MM-JJ et seront vides s'ils ne sont pas définis.",
				},
			},
			displayFormatting: {
				header: "Formatage d'affichage",
				description:
					"Configurez comment les dates, heures et autres données sont affichées dans le plugin.",
				timeFormat: {
					name: "Format d'heure",
					description:
						"Afficher l'heure au format 12 heures ou 24 heures dans tout le plugin",
					options: {
						twelveHour: "12 heures (AM/PM)",
						twentyFourHour: "24 heures",
					},
				},
			},
			calendarView: {
				header: "Vue calendrier",
				description: "Personnalisez l'apparence et le comportement de la vue calendrier.",
				defaultView: {
					name: "Vue par défaut",
					description: "La vue calendrier affichée à l'ouverture de l'onglet calendrier",
					options: {
						monthGrid: "Grille mensuelle",
						weekTimeline: "Chronologie hebdomadaire",
						dayTimeline: "Chronologie quotidienne",
						yearView: "Vue annuelle",
						customMultiDay: "Multi-jours personnalisé",
					},
				},
				customDayCount: {
					name: "Nombre de jours de la vue personnalisée",
					description: "Nombre de jours à afficher dans la vue multi-jours personnalisée",
					placeholder: "3",
				},
				firstDayOfWeek: {
					name: "Premier jour de la semaine",
					description:
						"Quel jour doit être la première colonne dans les vues hebdomadaires",
				},
				showWeekends: {
					name: "Afficher les week-ends",
					description: "Afficher les week-ends dans les vues calendrier",
				},
				showWeekNumbers: {
					name: "Afficher les numéros de semaine",
					description: "Afficher les numéros de semaine dans les vues calendrier",
				},
				showTodayHighlight: {
					name: "Surligner aujourd'hui",
					description: "Surligner le jour actuel dans les vues calendrier",
				},
				showCurrentTimeIndicator: {
					name: "Afficher l'indicateur de l'heure actuelle",
					description:
						"Afficher une ligne montrant l'heure actuelle dans les vues chronologiques",
				},
				selectionMirror: {
					name: "Miroir de sélection",
					description:
						"Afficher un aperçu visuel lors du glissement pour sélectionner des plages horaires",
				},
				calendarLocale: {
					name: "Locale du calendrier",
					description:
						'Locale du calendrier pour le formatage des dates et le système calendaire (ex. "en", "fa" pour le Farsi/Persan, "de" pour l\'Allemand). Laisser vide pour détecter automatiquement depuis le navigateur.',
					placeholder: "Détection automatique",
				},
			},
			defaultEventVisibility: {
				header: "Visibilité des événements par défaut",
				description:
					"Configurez quels types d'événements sont visibles par défaut à l'ouverture du Calendrier avancé. Les utilisateurs peuvent toujours activer/désactiver ces options dans la vue calendrier.",
				showScheduledTasks: {
					name: "Afficher les tâches planifiées",
					description: "Afficher les tâches avec dates planifiées par défaut",
				},
				showDueDates: {
					name: "Afficher les dates d'échéance",
					description: "Afficher les dates d'échéance des tâches par défaut",
				},
				showDueWhenScheduled: {
					name: "Afficher les échéances quand planifiées",
					description:
						"Afficher les dates d'échéance même pour les tâches qui ont déjà des dates planifiées",
				},
				showTimeEntries: {
					name: "Afficher les entrées de temps",
					description: "Afficher les entrées de suivi du temps terminées par défaut",
				},
				showRecurringTasks: {
					name: "Afficher les tâches récurrentes",
					description: "Afficher les instances de tâches récurrentes par défaut",
				},
				showICSEvents: {
					name: "Afficher les événements ICS",
					description: "Afficher les événements des abonnements ICS par défaut",
				},
			},
			timeSettings: {
				header: "Paramètres de temps",
				description:
					"Configurez les paramètres d'affichage liés au temps pour les vues chronologiques.",
				timeSlotDuration: {
					name: "Durée des créneaux horaires",
					description: "Durée de chaque créneau horaire dans les vues chronologiques",
					options: {
						fifteenMinutes: "15 minutes",
						thirtyMinutes: "30 minutes",
						sixtyMinutes: "60 minutes",
					},
				},
				startTime: {
					name: "Heure de début",
					description:
						"Heure la plus tôt affichée dans les vues chronologiques (format HH:MM)",
					placeholder: "06:00",
				},
				endTime: {
					name: "Heure de fin",
					description:
						"Heure la plus tardive affichée dans les vues chronologiques (format HH:MM)",
					placeholder: "22:00",
				},
				initialScrollTime: {
					name: "Heure de défilement initial",
					description:
						"Heure vers laquelle défiler à l'ouverture des vues chronologiques (format HH:MM)",
					placeholder: "09:00",
				},
			},
			uiElements: {
				header: "Éléments d'interface",
				description: "Configurez l'affichage de divers éléments d'interface.",
				showTrackedTasksInStatusBar: {
					name: "Afficher les tâches suivies dans la barre de statut",
					description:
						"Afficher les tâches actuellement suivies dans la barre de statut d'Obsidian",
				},
				showProjectSubtasksWidget: {
					name: "Afficher le widget des sous-tâches de projet",
					description:
						"Afficher un widget montrant les sous-tâches pour la note de projet actuelle",
				},
				projectSubtasksPosition: {
					name: "Position des sous-tâches de projet",
					description: "Où positionner le widget des sous-tâches de projet",
					options: {
						top: "Haut de la note",
						bottom: "Bas de la note",
					},
				},
				showExpandableSubtasks: {
					name: "Afficher les sous-tâches extensibles",
					description:
						"Permettre d'étendre/réduire les sections de sous-tâches dans les cartes de tâches",
				},
				subtaskChevronPosition: {
					name: "Position du chevron des sous-tâches",
					description:
						"Position des chevrons d'extension/réduction dans les cartes de tâches",
					options: {
						left: "Côté gauche",
						right: "Côté droit",
					},
				},
				viewsButtonAlignment: {
					name: "Alignement du bouton des vues",
					description: "Alignement du bouton vues/filtres dans l'interface des tâches",
					options: {
						left: "Côté gauche",
						right: "Côté droit",
					},
				},
			},
			projectAutosuggest: {
				header: "Autosuggestion de projets",
				description:
					"Personnalisez l'affichage des suggestions de projets lors de la création de tâches.",
				requiredTags: {
					name: "Tags requis",
					description:
						"Afficher seulement les notes avec l'un de ces tags (séparés par des virgules). Laisser vide pour afficher toutes les notes.",
					placeholder: "projet, actif, important",
				},
				includeFolders: {
					name: "Inclure les dossiers",
					description:
						"Afficher seulement les notes dans ces dossiers (chemins séparés par des virgules). Laisser vide pour afficher tous les dossiers.",
					placeholder: "Projets/, Travail/Actif, Personnel",
				},
				requiredPropertyKey: {
					name: "Clé de propriété requise",
					description:
						"Afficher seulement les notes où cette propriété frontmatter correspond à la valeur ci-dessous. Laisser vide pour ignorer.",
					placeholder: "type-projet",
				},
				requiredPropertyValue: {
					name: "Valeur de propriété requise",
					description:
						"Seules les notes où la propriété égale cette valeur sont suggérées. Laisser vide pour exiger que la propriété existe.",
					placeholder: "projet",
				},
				customizeDisplay: {
					name: "Personnaliser l'affichage des suggestions",
					description:
						"Afficher les options avancées pour configurer comment les suggestions de projets apparaissent et quelles informations elles affichent.",
				},
				enableFuzzyMatching: {
					name: "Activer la correspondance floue",
					description:
						"Permettre les fautes de frappe et correspondances partielles dans la recherche de projet. Peut être plus lent dans les gros coffres.",
				},
				displayRowsHelp:
					"Configurez jusqu'à 3 lignes d'informations à afficher pour chaque suggestion de projet.",
				displayRows: {
					row1: {
						name: "Ligne 1",
						description:
							"Format : {propriété|drapeaux}. Propriétés : title, aliases, file.path, file.parent. Drapeaux : n(Label) affiche le label, s rend cherchable. Exemple : {title|n(Titre)|s}",
						placeholder: "{title|n(Titre)}",
					},
					row2: {
						name: "Ligne 2 (optionnel)",
						description:
							"Modèles courants : {aliases|n(Alias)}, {file.parent|n(Dossier)}, literal:Texte personnalisé",
						placeholder: "{aliases|n(Alias)}",
					},
					row3: {
						name: "Ligne 3 (optionnel)",
						description:
							"Infos supplémentaires comme {file.path|n(Chemin)} ou champs frontmatter personnalisés",
						placeholder: "{file.path|n(Chemin)}",
					},
				},
				quickReference: {
					header: "Référence rapide",
					properties:
						"Propriétés disponibles : title, aliases, file.path, file.parent, ou tout champ frontmatter",
					labels: 'Ajouter des labels : {title|n(Titre)} → "Titre : Mon Projet"',
					searchable:
						"Rendre cherchable : {description|s} inclut la description dans la recherche +",
					staticText: "Texte statique : literal:Mon Label Personnalisé",
					alwaysSearchable:
						"Le nom de fichier, titre et alias sont toujours cherchables par défaut.",
				},
			},
			dataStorage: {
				name: "Emplacement de stockage",
				description: "Où stocker l'historique des sessions Pomodoro",
				pluginData: "Données du plugin (recommandé)",
				dailyNotes: "Notes quotidiennes",
				notices: {
					locationChanged: "Emplacement de stockage Pomodoro changé vers {location}",
				},
			},
			notifications: {
				description: "Configurez les notifications de rappel de tâches et les alertes.",
			},
			performance: {
				description: "Configurez les options de performance et de comportement du plugin.",
			},
			timeTrackingSection: {
				description: "Configurez les comportements de suivi automatique du temps.",
			},
			recurringSection: {
				description: "Configurez le comportement pour la gestion des tâches récurrentes.",
			},
			timeblocking: {
				description:
					"Configurez la fonctionnalité de blocs de temps pour la planification légère dans les notes quotidiennes.",
				usage: "Utilisation : Dans la vue calendrier avancée, maintenez Shift + glissez pour créer des blocs de temps. Glissez pour déplacer les blocs de temps existants. Redimensionnez les bords pour ajuster la durée.",
			},
		},
		integrations: {
			basesIntegration: {
				header: "Intégration Bases",
				description:
					"Configurez l'intégration avec le plugin Obsidian Bases. Il s'agit d'une fonctionnalité expérimentale qui repose actuellement sur des API Obsidian non documentées. Le comportement peut changer ou se briser.",
				enable: {
					name: "Activer l'intégration Bases",
					description:
						"Permettre l'utilisation des vues TaskNotes dans le plugin Obsidian Bases. Le plugin Bases doit être activé pour que cela fonctionne.",
				},
				notices: {
					enabled:
						"Intégration Bases activée. Veuillez redémarrer Obsidian pour terminer la configuration.",
					disabled:
						"Intégration Bases désactivée. Veuillez redémarrer Obsidian pour terminer la suppression.",
				},
			},
			calendarSubscriptions: {
				header: "Abonnements calendrier",
				description:
					"Abonnez-vous à des calendriers externes via des URL ICS/iCal pour voir les événements à côté de vos tâches.",
				defaultNoteTemplate: {
					name: "Modèle de note par défaut",
					description:
						"Chemin vers le fichier modèle pour les notes créées à partir d'événements ICS",
					placeholder: "Templates/Modèle Événement.md",
				},
				defaultNoteFolder: {
					name: "Dossier de note par défaut",
					description: "Dossier pour les notes créées à partir d'événements ICS",
					placeholder: "Calendrier/Événements",
				},
				filenameFormat: {
					name: "Format du nom de fichier des notes ICS",
					description:
						"Comment les noms de fichiers sont générés pour les notes créées à partir d'événements ICS",
					options: {
						title: "Titre de l'événement",
						zettel: "Format Zettelkasten",
						timestamp: "Horodatage",
						custom: "Modèle personnalisé",
					},
				},
				customTemplate: {
					name: "Modèle de nom de fichier ICS personnalisé",
					description: "Modèle pour les noms de fichiers d'événements ICS personnalisés",
					placeholder: "{date}-{title}",
				},
			},
			subscriptionsList: {
				header: "Liste des abonnements calendrier",
				addSubscription: {
					name: "Ajouter un abonnement calendrier",
					description:
						"Ajouter un nouvel abonnement calendrier depuis une URL ICS/iCal ou un fichier local",
					buttonText: "Ajouter un abonnement",
				},
				refreshAll: {
					name: "Actualiser tous les abonnements",
					description: "Actualiser manuellement tous les abonnements calendrier activés",
					buttonText: "Tout actualiser",
				},
				newCalendarName: "Nouveau calendrier",
				emptyState:
					"Aucun abonnement calendrier configuré. Ajoutez un abonnement pour synchroniser des calendriers externes.",
				notices: {
					addSuccess:
						"Nouvel abonnement calendrier ajouté - veuillez configurer les détails",
					addFailure: "Échec de l'ajout de l'abonnement",
					serviceUnavailable: "Service d'abonnement ICS non disponible",
					refreshSuccess: "Tous les abonnements calendrier actualisés avec succès",
					refreshFailure: "Échec de l'actualisation de certains abonnements calendrier",
					updateFailure: "Échec de la mise à jour de l'abonnement",
					deleteSuccess: 'Abonnement "{name}" supprimé',
					deleteFailure: "Échec de la suppression de l'abonnement",
					enableFirst: "Activez d'abord l'abonnement",
					refreshSubscriptionSuccess: '"{name}" actualisé',
					refreshSubscriptionFailure: "Échec de l'actualisation de l'abonnement",
				},
				labels: {
					enabled: "Activé :",
					name: "Nom :",
					type: "Type :",
					url: "URL :",
					filePath: "Chemin du fichier :",
					color: "Couleur :",
					refreshMinutes: "Actualisation (min) :",
				},
				typeOptions: {
					remote: "URL distante",
					local: "Fichier local",
				},
				placeholders: {
					calendarName: "Nom du calendrier",
					url: "URL ICS/iCal",
					filePath: "Chemin du fichier local (ex. Calendrier.ics)",
					localFile: "Calendrier.ics",
				},
				statusLabels: {
					enabled: "Activé",
					disabled: "Désactivé",
					remote: "Distant",
					localFile: "Fichier local",
					remoteCalendar: "Calendrier distant",
					localFileCalendar: "Fichier local",
					synced: "Synchronisé {timeAgo}",
					error: "Erreur",
				},
				actions: {
					refreshNow: "Actualiser maintenant",
					deleteSubscription: "Supprimer l'abonnement",
				},
				confirmDelete: {
					title: "Supprimer l'abonnement",
					message:
						'Voulez-vous vraiment supprimer l\'abonnement "{name}" ? Cette action ne peut pas être annulée.',
					confirmText: "Supprimer",
				},
			},
			autoExport: {
				header: "Export ICS automatique",
				description: "Exportez automatiquement toutes vos tâches vers un fichier ICS.",
				enable: {
					name: "Activer l'export automatique",
					description:
						"Maintenir automatiquement un fichier ICS à jour avec toutes vos tâches",
				},
				filePath: {
					name: "Chemin du fichier d'export",
					description:
						"Chemin où le fichier ICS sera sauvegardé (relatif à la racine du coffre)",
					placeholder: "tasknotes-calendrier.ics",
				},
				interval: {
					name: "Intervalle de mise à jour (entre 5 et 1440 minutes)",
					description: "Fréquence de mise à jour du fichier d'export",
					placeholder: "60",
				},
				exportNow: {
					name: "Exporter maintenant",
					description: "Déclencher manuellement un export immédiat",
					buttonText: "Exporter maintenant",
				},
				status: {
					title: "Statut de l'export :",
					lastExport: "Dernier export : {time}",
					nextExport: "Prochain export : {time}",
					noExports: "Aucun export encore",
					notScheduled: "Non programmé",
					notInitialized:
						"Service d'export automatique non initialisé - veuillez redémarrer Obsidian",
				},
				notices: {
					reloadRequired:
						"Veuillez recharger Obsidian pour que les changements d'export automatique prennent effet.",
					exportSuccess: "Tâches exportées avec succès",
					exportFailure: "Échec de l'export - vérifiez la console pour les détails",
					serviceUnavailable: "Service d'export automatique non disponible",
				},
			},
			httpApi: {
				header: "API HTTP",
				description:
					"Activez l'API HTTP pour les intégrations externes et les automations.",
				enable: {
					name: "Activer l'API HTTP",
					description: "Démarrer le serveur HTTP local pour l'accès API",
				},
				port: {
					name: "Port API",
					description: "Numéro de port pour le serveur API HTTP",
					placeholder: "3000",
				},
				authToken: {
					name: "Jeton d'authentification API",
					description:
						"Jeton requis pour l'authentification API (laisser vide pour pas d'authentification)",
					placeholder: "votre-jeton-secret",
				},
				endpoints: {
					header: "Points de terminaison API disponibles",
					expandIcon: "▶",
					collapseIcon: "▼",
				},
			},
			webhooks: {
				header: "Webhooks",
				description: {
					overview:
						"Les webhooks envoient des notifications en temps réel aux services externes lorsque des événements TaskNotes se produisent.",
					usage: "Configurez des webhooks pour intégrer avec des outils d'automatisation, des services de synchronisation ou des applications personnalisées.",
				},
				addWebhook: {
					name: "Ajouter un webhook",
					description: "Enregistrer un nouveau point de terminaison webhook",
					buttonText: "Ajouter un webhook",
				},
				emptyState: {
					message:
						"Aucun webhook configuré. Ajoutez un webhook pour recevoir des notifications en temps réel.",
					buttonText: "Ajouter un webhook",
				},
				labels: {
					active: "Actif :",
					url: "URL :",
					events: "Événements :",
					transform: "Transformation :",
				},
				placeholders: {
					url: "URL du webhook",
					noEventsSelected: "Aucun événement sélectionné",
					rawPayload: "Données brutes (aucune transformation)",
				},
				statusLabels: {
					active: "Actif",
					inactive: "Inactif",
					created: "Créé {timeAgo}",
				},
				actions: {
					editEvents: "Modifier les événements",
					delete: "Supprimer",
				},
				notices: {
					urlUpdated: "URL du webhook mise à jour",
					enabled: "Webhook activé",
					disabled: "Webhook désactivé",
					created: "Webhook créé avec succès",
					deleted: "Webhook supprimé",
					updated: "Webhook mis à jour",
				},
				confirmDelete: {
					title: "Supprimer le webhook",
					message:
						"Voulez-vous vraiment supprimer ce webhook ?\n\nURL : {url}\n\nCette action ne peut pas être annulée.",
					confirmText: "Supprimer",
				},
				cardHeader: "Webhook",
				cardFields: {
					active: "Actif :",
					url: "URL :",
					events: "Événements :",
					transform: "Transformation :",
				},
				eventsDisplay: {
					noEvents: "Aucun événement sélectionné",
				},
				transformDisplay: {
					noTransform: "Données brutes (aucune transformation)",
				},
				secretModal: {
					title: "Secret webhook généré",
					description:
						"Votre secret webhook a été généré. Sauvegardez ce secret car vous ne pourrez plus le voir :",
					usage: "Utilisez ce secret pour vérifier les données webhook dans votre application réceptrice.",
					gotIt: "Compris",
				},
				editModal: {
					title: "Modifier le webhook",
					eventsHeader: "Événements auxquels s'abonner",
				},
				events: {
					taskCreated: {
						label: "Tâche créée",
						description: "Quand de nouvelles tâches sont créées",
					},
					taskUpdated: {
						label: "Tâche modifiée",
						description: "Quand les tâches sont modifiées",
					},
					taskCompleted: {
						label: "Tâche terminée",
						description: "Quand les tâches sont marquées comme terminées",
					},
					taskDeleted: {
						label: "Tâche supprimée",
						description: "Quand les tâches sont supprimées",
					},
					taskArchived: {
						label: "Tâche archivée",
						description: "Quand les tâches sont archivées",
					},
					taskUnarchived: {
						label: "Tâche désarchivée",
						description: "Quand les tâches sont désarchivées",
					},
					timeStarted: {
						label: "Temps démarré",
						description: "Quand le suivi du temps démarre",
					},
					timeStopped: {
						label: "Temps arrêté",
						description: "Quand le suivi du temps s'arrête",
					},
					pomodoroStarted: {
						label: "Pomodoro démarré",
						description: "Quand les sessions pomodoro commencent",
					},
					pomodoroCompleted: {
						label: "Pomodoro terminé",
						description: "Quand les sessions pomodoro se terminent",
					},
					pomodoroInterrupted: {
						label: "Pomodoro interrompu",
						description: "Quand les sessions pomodoro sont arrêtées",
					},
					recurringCompleted: {
						label: "Instance récurrente terminée",
						description: "Quand les instances de tâches récurrentes se terminent",
					},
					reminderTriggered: {
						label: "Rappel déclenché",
						description: "Quand les rappels de tâches s'activent",
					},
				},
				modals: {
					secretGenerated: {
						title: "Secret du webhook généré",
						description:
							"Le secret de votre webhook a été généré. Sauvegardez ce secret car vous ne pourrez plus le voir :",
						usage: "Utilisez ce secret pour vérifier les données du webhook dans votre application réceptrice.",
						buttonText: "Compris",
					},
					edit: {
						title: "Modifier le webhook",
						eventsSection: "Événements auxquels s'abonner",
						transformSection: "Configuration de transformation (optionnel)",
						headersSection: "Configuration des en-têtes",
						transformFile: {
							name: "Fichier de transformation",
							description:
								"Chemin vers un fichier .js ou .json dans votre coffre qui transforme les données du webhook",
							placeholder: "discord-transform.js",
						},
						customHeaders: {
							name: "Inclure les en-têtes personnalisés",
							description:
								"Inclure les en-têtes TaskNotes (type d'événement, signature, ID de livraison). Désactivez pour Discord, Slack et autres services avec des politiques CORS strictes.",
						},
						buttons: {
							cancel: "Annuler",
							save: "Sauvegarder les modifications",
						},
						notices: {
							selectAtLeastOneEvent: "Veuillez sélectionner au moins un événement",
						},
					},
					add: {
						title: "Ajouter un webhook",
						eventsSection: "Événements auxquels s'abonner",
						transformSection: "Configuration de transformation (optionnel)",
						headersSection: "Configuration des en-têtes",
						url: {
							name: "URL du webhook",
							description:
								"Le point de terminaison où les données du webhook seront envoyées",
							placeholder: "https://votre-service.com/webhook",
						},
						transformFile: {
							name: "Fichier de transformation",
							description:
								"Chemin vers un fichier .js ou .json dans votre coffre qui transforme les données du webhook",
							placeholder: "discord-transform.js",
						},
						customHeaders: {
							name: "Inclure les en-têtes personnalisés",
							description:
								"Inclure les en-têtes TaskNotes (type d'événement, signature, ID de livraison). Désactivez pour Discord, Slack et autres services avec des politiques CORS strictes.",
						},
						transformHelp: {
							title: "Les fichiers de transformation permettent de personnaliser les données du webhook :",
							jsFiles: "Fichiers .js :",
							jsDescription: " Transformations JavaScript personnalisées",
							jsonFiles: "Fichiers .json :",
							jsonDescription: " Modèles avec ",
							jsonVariable: "${data.task.title}",
							leaveEmpty: "Laisser vide :",
							leaveEmptyDescription: " Envoyer les données brutes",
							example: "Exemple :",
							exampleFile: "discord-transform.js",
						},
						buttons: {
							cancel: "Annuler",
							add: "Ajouter le webhook",
						},
						notices: {
							urlRequired: "L'URL du webhook est requise",
							selectAtLeastOneEvent: "Veuillez sélectionner au moins un événement",
						},
					},
				},
			},
			otherIntegrations: {
				header: "Autres intégrations de plugins",
				description: "Configurez les intégrations avec d'autres plugins Obsidian.",
			},
			timeFormats: {
				justNow: "À l'instant",
				minutesAgo: "il y a {minutes} minute{plural}",
				hoursAgo: "il y a {hours} heure{plural}",
				daysAgo: "il y a {days} jour{plural}",
			},
		},
	},
	notices: {
		languageChanged: "Langue changée pour {language}.",
		exportTasksFailed: "Échec de l'export des tâches au format ICS",
	},
	commands: {
		openCalendarView: "Ouvrir la vue mini calendrier",
		openAdvancedCalendarView: "Ouvrir la vue calendrier avancé",
		openTasksView: "Ouvrir la vue tâches",
		openNotesView: "Ouvrir la vue notes",
		openAgendaView: "Ouvrir la vue agenda",
		openPomodoroView: "Ouvrir le minuteur Pomodoro",
		openKanbanView: "Ouvrir le tableau Kanban",
		openPomodoroStats: "Ouvrir les statistiques Pomodoro",
		openStatisticsView: "Ouvrir les statistiques tâches & projets",
		createNewTask: "Créer une nouvelle tâche",
		convertToTaskNote: "Convertir la tâche en TaskNote",
		convertAllTasksInNote: "Convertir toutes les tâches de la note",
		insertTaskNoteLink: "Insérer un lien TaskNote",
		createInlineTask: "Créer une nouvelle tâche intégrée",
		quickActionsCurrentTask: "Actions rapides pour la tâche courante",
		goToTodayNote: "Aller à la note du jour",
		startPomodoro: "Démarrer le minuteur Pomodoro",
		stopPomodoro: "Arrêter le minuteur Pomodoro",
		pauseResumePomodoro: "Mettre en pause/reprendre le minuteur Pomodoro",
		refreshCache: "Actualiser le cache",
		exportAllTasksIcs: "Exporter toutes les tâches en fichier ICS",
	},
	modals: {
		task: {
			titlePlaceholder: "Quel est votre prochain objectif ?",
			titleLabel: "Titre",
			titleDetailedPlaceholder: "Titre de la tâche...",
			detailsLabel: "Détails",
			detailsPlaceholder: "Ajoutez davantage de détails...",
			projectsLabel: "Projets",
			projectsAdd: "Ajouter un projet",
			projectsTooltip: "Sélectionnez une note de projet via la recherche floue",
			projectsRemoveTooltip: "Retirer le projet",
			contextsLabel: "Contextes",
			contextsPlaceholder: "contexte1, contexte2",
			tagsLabel: "Étiquettes",
			tagsPlaceholder: "etiquette1, etiquette2",
			timeEstimateLabel: "Estimation (minutes)",
			timeEstimatePlaceholder: "30",
			dependencies: {
				blockedBy: "Bloqué par",
				blocking: "Bloquant",
				placeholder: "[[Note de tâche]]",
				addTaskButton: "Ajouter une tâche",
				selectTaskTooltip: "Sélectionnez une note de tâche via la recherche floue",
				removeTaskTooltip: "Retirer la tâche",
			},
			customFieldsLabel: "Champs personnalisés",
			actions: {
				due: "Définir l'échéance",
				scheduled: "Définir la date planifiée",
				status: "Définir le statut",
				priority: "Définir la priorité",
				recurrence: "Définir la récurrence",
				reminders: "Définir les rappels",
			},
			buttons: {
				openNote: "Ouvrir la note",
				save: "Enregistrer",
			},
			tooltips: {
				dueValue: "Échéance : {value}",
				scheduledValue: "Planifiée : {value}",
				statusValue: "Statut : {value}",
				priorityValue: "Priorité : {value}",
				recurrenceValue: "Récurrence : {value}",
				remindersSingle: "1 rappel défini",
				remindersPlural: "{count} rappels définis",
			},
			dateMenu: {
				dueTitle: "Définir l'échéance",
				scheduledTitle: "Définir la date planifiée",
			},
			userFields: {
				textPlaceholder: "Saisir {field}...",
				numberPlaceholder: "0",
				datePlaceholder: "AAAA-MM-JJ",
				listPlaceholder: "élément1, élément2, élément3",
				pickDate: "Choisir la date {field}",
			},
			recurrence: {
				daily: "Quotidien",
				weekly: "Hebdomadaire",
				everyTwoWeeks: "Toutes les 2 semaines",
				weekdays: "Jours ouvrés",
				weeklyOn: "Chaque semaine le {days}",
				monthly: "Mensuel",
				everyThreeMonths: "Tous les 3 mois",
				monthlyOnOrdinal: "Chaque mois le {ordinal}",
				monthlyByWeekday: "Mensuel (par jour de semaine)",
				yearly: "Annuel",
				yearlyOn: "Chaque année le {month} {day}",
				custom: "Personnalisé",
				countSuffix: "{count} occurrences",
				untilSuffix: "jusqu'au {date}",
				ordinal: "{number}e",
			},
		},
		taskCreation: {
			title: "Créer une tâche",
			actions: {
				fillFromNaturalLanguage: "Remplir le formulaire avec le langage naturel",
				hideDetailedOptions: "Masquer les options détaillées",
				showDetailedOptions: "Afficher les options détaillées",
			},
			nlPlaceholder:
				"Acheter des courses demain à 15h @maison #courses\n\nAjoutez des détails ici...",
			notices: {
				titleRequired: "Veuillez saisir un titre de tâche",
				success: 'Tâche "{title}" créée avec succès',
				successShortened: 'Tâche "{title}" créée avec succès (nom de fichier raccourci)',
				failure: "Échec de la création de la tâche : {message}",
				blockingUnresolved: "Impossible de résoudre : {entries}",
			},
		},
		taskEdit: {
			title: "Modifier la tâche",
			sections: {
				completions: "Achèvements",
				taskInfo: "Informations sur la tâche",
			},
			metadata: {
				totalTrackedTime: "Temps suivi total :",
				created: "Créée :",
				modified: "Modifiée :",
				file: "Fichier :",
			},
			buttons: {
				archive: "Archiver",
				unarchive: "Désarchiver",
			},
			notices: {
				titleRequired: "Veuillez saisir un titre de tâche",
				noChanges: "Aucune modification à enregistrer",
				updateSuccess: 'Tâche "{title}" mise à jour avec succès',
				updateFailure: "Échec de la mise à jour de la tâche : {message}",
				dependenciesUpdateSuccess: "Dépendances mises à jour",
				blockingUnresolved: "Impossible de résoudre : {entries}",
				fileMissing: "Impossible de trouver le fichier de la tâche : {path}",
				openNoteFailure: "Impossible d'ouvrir la note de la tâche",
				archiveSuccess: "Tâche {action} avec succès",
				archiveFailure: "Échec de l'archivage de la tâche",
			},
			archiveAction: {
				archived: "archivée",
				unarchived: "désarchivée",
			},
		},
		storageLocation: {
			title: {
				migrate: "Migrer les données Pomodoro ?",
				switch: "Basculer vers le stockage dans les notes quotidiennes ?",
			},
			message: {
				migrate:
					"Cette action migre vos sessions Pomodoro existantes vers le frontmatter des notes quotidiennes. Les données seront regroupées par date et stockées dans chaque note.",
				switch: "Les sessions Pomodoro seront désormais enregistrées dans le frontmatter de vos notes quotidiennes au lieu du fichier de données du plugin.",
			},
			whatThisMeans: "Ce que cela implique :",
			bullets: {
				dailyNotesRequired: "Le plugin noyau Daily Notes doit rester activé",
				storedInNotes:
					"Les données seront stockées dans le frontmatter de vos notes quotidiennes",
				migrateData: "Les données du plugin seront migrées puis vidées",
				futureSessions:
					"Les futures sessions seront enregistrées dans les notes quotidiennes",
				dataLongevity: "Cela garantit une meilleure pérennité des données avec vos notes",
			},
			finalNote: {
				migrate:
					"⚠️ Assurez-vous d’avoir des sauvegardes si nécessaire. Ce changement ne peut pas être annulé automatiquement.",
				switch: "Vous pourrez revenir au stockage du plugin à tout moment par la suite.",
			},
			buttons: {
				migrate: "Migrer les données",
				switch: "Changer de stockage",
			},
		},
		dueDate: {
			title: "Définir la date d'échéance",
			taskLabel: "Tâche : {title}",
			sections: {
				dateTime: "Date et heure d'échéance",
				quickOptions: "Options rapides",
			},
			descriptions: {
				dateTime: "Définir quand cette tâche doit être terminée",
			},
			inputs: {
				date: {
					ariaLabel: "Date d'échéance de la tâche",
					placeholder: "AAAA-MM-JJ",
				},
				time: {
					ariaLabel: "Heure d'échéance de la tâche (optionnel)",
					placeholder: "HH:MM",
				},
			},
			quickOptions: {
				today: "Aujourd'hui",
				todayAriaLabel: "Définir la date d'échéance à aujourd'hui",
				tomorrow: "Demain",
				tomorrowAriaLabel: "Définir la date d'échéance à demain",
				nextWeek: "La semaine prochaine",
				nextWeekAriaLabel: "Définir la date d'échéance à la semaine prochaine",
				now: "Maintenant",
				nowAriaLabel: "Définir la date et l'heure d'échéance à maintenant",
				clear: "Effacer",
				clearAriaLabel: "Effacer la date d'échéance",
			},
			errors: {
				invalidDateTime: "Veuillez saisir un format de date et d'heure valide",
				updateFailed: "Échec de la mise à jour de la date d'échéance. Veuillez réessayer.",
			},
		},
		scheduledDate: {
			title: "Définir la date planifiée",
			taskLabel: "Tâche : {title}",
			sections: {
				dateTime: "Date et heure planifiées",
				quickOptions: "Options rapides",
			},
			descriptions: {
				dateTime: "Définir quand vous prévoyez de travailler sur cette tâche",
			},
			inputs: {
				date: {
					ariaLabel: "Date planifiée de la tâche",
					placeholder: "AAAA-MM-JJ",
				},
				time: {
					ariaLabel: "Heure planifiée de la tâche (optionnel)",
					placeholder: "HH:MM",
				},
			},
			quickOptions: {
				today: "Aujourd'hui",
				todayAriaLabel: "Définir la date planifiée à aujourd'hui",
				tomorrow: "Demain",
				tomorrowAriaLabel: "Définir la date planifiée à demain",
				nextWeek: "La semaine prochaine",
				nextWeekAriaLabel: "Définir la date planifiée à la semaine prochaine",
				now: "Maintenant",
				nowAriaLabel: "Définir la date et l'heure planifiées à maintenant",
				clear: "Effacer",
				clearAriaLabel: "Effacer la date planifiée",
			},
			errors: {
				invalidDateTime: "Veuillez saisir un format de date et d'heure valide",
				updateFailed: "Échec de la mise à jour de la date planifiée. Veuillez réessayer.",
			},
		},
	},
	contextMenus: {
		task: {
			status: "Statut",
			statusSelected: "Statut sélectionné : {label}",
			priority: "Priorité",
			prioritySelected: "Priorité sélectionnée : {label}",
			dueDate: "Échéance",
			scheduledDate: "Date planifiée",
			reminders: "Rappels",
			remindBeforeDue: "Rappeler avant l'échéance…",
			remindBeforeScheduled: "Rappeler avant la date planifiée…",
			manageReminders: "Gérer tous les rappels…",
			clearReminders: "Supprimer tous les rappels",
			startTimeTracking: "Commencer le suivi du temps",
			stopTimeTracking: "Arrêter le suivi du temps",
			archive: "Archiver",
			unarchive: "Désarchiver",
			openNote: "Ouvrir la note",
			copyTitle: "Copier le titre de la tâche",
			noteActions: "Actions sur la note",
			rename: "Renommer",
			renameTitle: "Renommer le fichier",
			renamePlaceholder: "Saisir un nouveau nom",
			delete: "Supprimer",
			deleteTitle: "Supprimer le fichier",
			deleteMessage: 'Voulez-vous vraiment supprimer "{name}" ?',
			deleteConfirm: "Supprimer",
			copyPath: "Copier le chemin",
			copyUrl: "Copier l'URL Obsidian",
			showInExplorer: "Afficher dans l'explorateur de fichiers",
			addToCalendar: "Ajouter au calendrier",
			calendar: {
				google: "Google Agenda",
				outlook: "Outlook Agenda",
				yahoo: "Yahoo Agenda",
				downloadIcs: "Télécharger le fichier .ics",
			},
			recurrence: "Récurrence",
			clearRecurrence: "Effacer la récurrence",
			customRecurrence: "Récurrence personnalisée...",
			createSubtask: "Créer une sous-tâche",
			dependencies: {
				title: "Dépendances",
				addBlockedBy: "Ajouter « bloqué par »…",
				addBlockedByTitle: "Ajouter des tâches dont dépend celle-ci",
				addBlocking: "Ajouter « bloquant »…",
				addBlockingTitle: "Ajouter des tâches bloquées par celle-ci",
				removeBlockedBy: "Retirer « bloqué par »…",
				removeBlocking: "Retirer « bloquant »…",
				inputPlaceholder: "[[Note de tâche]]",
				notices: {
					noEntries: "Veuillez saisir au moins une tâche",
					blockedByAdded: "{count} dépendance ajoutée",
					blockedByRemoved: "Dépendance retirée",
					blockingAdded: "{count} tâche dépendante ajoutée",
					blockingRemoved: "Tâche dépendante retirée",
					unresolved: "Impossible de résoudre : {entries}",
					noEligibleTasks: "Aucune tâche correspondante disponible",
					updateFailed: "Impossible de mettre à jour les dépendances",
				},
			},
			subtasks: {
				loading: "Chargement des sous-tâches...",
				noSubtasks: "Aucune sous-tâche trouvée",
				loadFailed: "Échec du chargement des sous-tâches",
			},
			markComplete: "Marquer comme terminée pour cette date",
			markIncomplete: "Marquer comme incomplète pour cette date",
			quickReminders: {
				atTime: "À l'heure de l'événement",
				fiveMinutes: "5 minutes avant",
				fifteenMinutes: "15 minutes avant",
				oneHour: "1 heure avant",
				oneDay: "1 jour avant",
			},
			notices: {
				toggleCompletionFailure:
					"Impossible de modifier l'achèvement récurrent : {message}",
				updateDueDateFailure: "Impossible de mettre à jour l'échéance : {message}",
				updateScheduledFailure: "Impossible de mettre à jour la date planifiée : {message}",
				updateRemindersFailure: "Impossible de mettre à jour les rappels",
				clearRemindersFailure: "Impossible de supprimer les rappels",
				addReminderFailure: "Impossible d'ajouter un rappel",
				archiveFailure: "Impossible de modifier l'archivage de la tâche : {message}",
				copyTitleSuccess: "Titre de la tâche copié dans le presse-papiers",
				copyFailure: "Impossible de copier dans le presse-papiers",
				renameSuccess: 'Renommé en "{name}"',
				renameFailure: "Impossible de renommer le fichier",
				copyPathSuccess: "Chemin du fichier copié dans le presse-papiers",
				copyUrlSuccess: "URL Obsidian copiée dans le presse-papiers",
				updateRecurrenceFailure: "Impossible de mettre à jour la récurrence : {message}",
			},
		},
		ics: {
			showDetails: "Afficher les détails",
			createTask: "Créer une tâche depuis l'événement",
			createNote: "Créer une note depuis l'événement",
			linkNote: "Lier une note existante",
			copyTitle: "Copier le titre",
			copyLocation: "Copier le lieu",
			copyUrl: "Copier l'URL",
			copyMarkdown: "Copier en markdown",
			subscriptionUnknown: "Calendrier inconnu",
			notices: {
				copyTitleSuccess: "Titre de l'événement copié dans le presse-papiers",
				copyLocationSuccess: "Lieu copié dans le presse-papiers",
				copyUrlSuccess: "URL de l'événement copiée dans le presse-papiers",
				copyMarkdownSuccess: "Détails de l'événement copiés en markdown",
				copyFailure: "Impossible de copier dans le presse-papiers",
				taskCreated: "Tâche créée : {title}",
				taskCreateFailure: "Impossible de créer une tâche depuis l'événement",
				noteCreated: "Note créée avec succès",
				creationFailure: "Impossible d'ouvrir la fenêtre de création",
				linkSuccess: 'Note "{name}" liée à l\'événement',
				linkFailure: "Impossible de lier la note",
				linkSelectionFailure: "Impossible d'ouvrir la sélection de note",
			},
			markdown: {
				titleFallback: "Événement sans titre",
				calendar: "**Calendrier :** {value}",
				date: "**Date et heure :** {value}",
				location: "**Lieu :** {value}",
				descriptionHeading: "### Détails",
				url: "**URL :** {value}",
				at: " à {time}",
			},
		},
		date: {
			increment: {
				plusOneDay: "+1 jour",
				minusOneDay: "-1 jour",
				plusOneWeek: "+1 semaine",
				minusOneWeek: "-1 semaine",
			},
			basic: {
				today: "Aujourd'hui",
				tomorrow: "Demain",
				thisWeekend: "Ce week-end",
				nextWeek: "La semaine prochaine",
				nextMonth: "Le mois prochain",
			},
			weekdaysLabel: "Jours de la semaine",
			selected: "Date sélectionnée : {label}",
			pickDateTime: "Choisir date et heure…",
			clearDate: "Effacer la date",
			modal: {
				title: "Définir date et heure",
				dateLabel: "Date (AAAA-MM-JJ)",
				timeLabel: "Heure (optionnel)",
				select: "Sélectionner",
			},
		},
	},
	services: {
		pomodoro: {
			notices: {
				alreadyRunning: "Un pomodoro est déjà en cours",
				resumeCurrentSession:
					"Reprendre la session actuelle au lieu d'en démarrer une nouvelle",
				timerAlreadyRunning: "Un minuteur est déjà en cours",
				resumeSessionInstead:
					"Reprendre la session actuelle au lieu d'en démarrer une nouvelle",
				shortBreakStarted: "Pause courte démarrée",
				longBreakStarted: "Pause longue démarrée",
				paused: "Pomodoro mis en pause",
				resumed: "Pomodoro repris",
				stoppedAndReset: "Pomodoro arrêté et remis à zéro",
				migrationSuccess:
					"{count} sessions pomodoro migrées avec succès vers les notes quotidiennes.",
				migrationFailure:
					"Échec de la migration des données pomodoro. Veuillez réessayer ou vérifier la console pour plus de détails.",
			},
		},
		icsSubscription: {
			notices: {
				calendarNotFound:
					'Calendrier "{name}" introuvable (404). Veuillez vérifier que l\'URL ICS est correcte et que le calendrier est accessible publiquement.',
				calendarAccessDenied:
					'Accès refusé au calendrier "{name}" (500). Cela peut être dû aux restrictions du serveur Microsoft Outlook. Essayez de régénérer l\'URL ICS depuis les paramètres de votre calendrier.',
				fetchRemoteFailed:
					'Échec de la récupération du calendrier distant "{name}" : {error}',
				readLocalFailed: 'Échec de la lecture du calendrier local "{name}" : {error}',
			},
		},
		calendarExport: {
			notices: {
				generateLinkFailed: "Échec de la génération du lien calendrier",
				noTasksToExport: "Aucune tâche trouvée à exporter",
				downloadSuccess: "Téléchargé {filename} avec {count} tâche{plural}",
				downloadFailed: "Échec du téléchargement du fichier calendrier",
				singleDownloadSuccess: "Téléchargé {filename}",
			},
		},
		filter: {
			groupLabels: {
				noProject: "Aucun projet",
				noTags: "Aucune étiquette",
				invalidDate: "Date invalide",
				due: {
					overdue: "En retard",
					today: "Aujourd'hui",
					tomorrow: "Demain",
					nextSevenDays: "Prochains sept jours",
					later: "Plus tard",
					none: "Aucune date d'échéance",
				},
				scheduled: {
					past: "Planification passée",
					today: "Aujourd'hui",
					tomorrow: "Demain",
					nextSevenDays: "Prochains sept jours",
					later: "Plus tard",
					none: "Aucune date planifiée",
				},
			},
			errors: {
				noDatesProvided: "Aucune date fournie",
			},
			folders: {
				root: "(Racine)",
			},
		},
		instantTaskConvert: {
			notices: {
				noCheckboxTasks: "Aucune tâche à cocher trouvée dans la note actuelle.",
				convertingTasks: "Conversion de {count} tâche{plural}...",
				conversionSuccess: "✅ {count} tâche{plural} converties avec succès en TaskNotes !",
				partialConversion:
					"{successCount} tâche{successPlural} convertie{successPlural}. {failureCount} ont échoué.",
				batchConversionFailed: "Échec de la conversion par lot. Veuillez réessayer.",
				invalidParameters: "Paramètres d'entrée invalides.",
				emptyLine: "La ligne actuelle est vide ou ne contient aucun contenu valide.",
				parseError: "Erreur d'analyse de la tâche : {error}",
				invalidTaskData: "Données de tâche invalides.",
				replaceLineFailed: "Échec du remplacement de la ligne de tâche.",
				conversionComplete: "Tâche convertie : {title}",
				conversionCompleteShortened:
					'Tâche convertie : "{title}" (nom de fichier raccourci en raison de la longueur)',
				fileExists:
					"Un fichier avec ce nom existe déjà. Veuillez réessayer ou renommer la tâche.",
				conversionFailed: "Échec de la conversion de la tâche. Veuillez réessayer.",
			},
		},
		icsNote: {
			notices: {
				templateNotFound: "Modèle introuvable : {path}",
				templateProcessError: "Erreur de traitement du modèle : {template}",
				linkedToEvent: "Note liée à l'événement ICS : {title}",
			},
		},
		task: {
			notices: {
				templateNotFound: "Modèle de corps de tâche introuvable : {path}",
				templateReadError: "Erreur de lecture du modèle de corps de tâche : {template}",
				moveTaskFailed: "Échec du déplacement de la tâche {operation} : {error}",
			},
		},
		autoExport: {
			notices: {
				exportFailed: "Échec de l'export automatique TaskNotes : {error}",
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
			untitledEvent: "Événement sans titre",
			allDay: "Toute la journée",
			calendarEvent: "Événement de calendrier",
			calendarFallback: "Calendrier",
		},
		noteCard: {
			createdLabel: "Créée :",
			dailyBadge: "Quotidien",
			dailyTooltip: "Note quotidienne",
		},
		taskCard: {
			blockedBadge: "Bloqué",
			blockedBadgeTooltip: "Cette tâche attend une autre tâche",
			blockingBadge: "Bloquant",
			blockingBadgeTooltip: "Cette tâche bloque une autre tâche",
			blockingToggle: "Bloque {count} tâches",
			loadingDependencies: "Chargement des dépendances…",
			blockingEmpty: "Aucune tâche dépendante",
			blockingLoadError: "Échec du chargement des dépendances",
		},
		filterHeading: {
			allViewName: "Toutes",
		},
		filterBar: {
			saveView: "Enregistrer la vue",
			saveViewNamePlaceholder: "Entrez le nom de la vue...",
			saveButton: "Enregistrer",
			views: "Vues",
			savedFilterViews: "Vues de filtre enregistrées",
			filters: "Filtres",
			properties: "Propriétés",
			sort: "Tri",
			newTask: "Nouvelle",
			expandAllGroups: "Déplier tous les groupes",
			collapseAllGroups: "Replier tous les groupes",
			searchTasksPlaceholder: "Rechercher des tâches...",
			searchTasksTooltip: "Rechercher dans les titres de tâches",
			filterUnavailable: "Barre de filtre temporairement indisponible",
			toggleFilter: "Basculer le filtre",
			activeFiltersTooltip: "Filtres actifs – Cliquez pour modifier, clic droit pour effacer",
			configureVisibleProperties: "Configurer les propriétés visibles",
			sortAndGroupOptions: "Options de tri et regroupement",
			sortMenuHeader: "Tri",
			orderMenuHeader: "Ordre",
			groupMenuHeader: "Groupe",
			createNewTask: "Créer une nouvelle tâche",
			filter: "Filtre",
			displayOrganization: "Affichage et organisation",
			viewOptions: "Options de vue",
			addFilter: "Ajouter un filtre",
			addFilterGroup: "Ajouter un groupe de filtres",
			addFilterTooltip: "Ajouter une nouvelle condition de filtre",
			addFilterGroupTooltip: "Ajouter un groupe de filtres imbriqué",
			clearAllFilters: "Effacer tous les filtres et groupes",
			saveCurrentFilter: "Enregistrer le filtre actuel comme vue",
			closeFilterModal: "Fermer la fenêtre de filtre",
			deleteFilterGroup: "Supprimer le groupe de filtres",
			deleteCondition: "Supprimer la condition",
			all: "Toutes",
			any: "N'importe laquelle",
			followingAreTrue: "des conditions suivantes sont vraies :",
			where: "où",
			selectProperty: "Sélectionner...",
			chooseProperty: "Choisissez quelle propriété de tâche filtrer",
			chooseOperator: "Choisissez comment comparer la valeur de propriété",
			enterValue: "Entrez la valeur à filtrer",
			selectValue: "Sélectionnez un {property} à filtrer",
			sortBy: "Trier par :",
			toggleSortDirection: "Basculer la direction de tri",
			chooseSortMethod: "Choisissez comment trier les tâches",
			groupBy: "Grouper par :",
			chooseGroupMethod: "Grouper les tâches par une propriété commune",
			toggleViewOption: "Basculer {option}",
			expandCollapseFilters: "Cliquez pour déplier/replier les conditions de filtre",
			expandCollapseSort: "Cliquez pour déplier/replier les options de tri et regroupement",
			expandCollapseViewOptions:
				"Cliquez pour déplier/replier les options spécifiques à la vue",
			naturalLanguageDates: "Dates en langage naturel",
			naturalLanguageExamples: "Afficher les exemples de dates en langage naturel",
			enterNumericValue: "Entrez une valeur numérique à filtrer",
			enterDateValue: "Entrez une date en langage naturel ou format ISO",
			pickDateTime: "Choisir date et heure",
			noSavedViews: "Aucune vue enregistrée",
			savedViews: "Vues enregistrées",
			yourSavedFilters: "Vos configurations de filtres enregistrées",
			dragToReorder: "Glissez pour réorganiser les vues",
			loadSavedView: "Charger la vue enregistrée : {name}",
			deleteView: "Supprimer la vue",
			deleteViewTitle: "Supprimer la vue",
			deleteViewMessage: 'Êtes-vous sûr de vouloir supprimer la vue "{name}" ?',
			manageAllReminders: "Gérer tous les rappels...",
			clearAllReminders: "Effacer tous les rappels",
			customRecurrence: "Récurrence personnalisée...",
			clearRecurrence: "Effacer la récurrence",
			sortOptions: {
				dueDate: "Date d'échéance",
				scheduledDate: "Date planifiée",
				priority: "Priorité",
				status: "Statut",
				title: "Titre",
				createdDate: "Date de création",
				tags: "Étiquettes",
				ascending: "Croissant",
				descending: "Décroissant",
			},
			group: {
				none: "Aucun",
				status: "Statut",
				priority: "Priorité",
				context: "Contexte",
				project: "Projet",
				dueDate: "Date d'échéance",
				scheduledDate: "Date planifiée",
				tags: "Étiquettes",
			},
			notices: {
				propertiesMenuFailed: "Impossible d'afficher le menu des propriétés",
			},
		},
	},
	components: {
		propertyVisibilityDropdown: {
			coreProperties: "PROPRIÉTÉS PRINCIPALES",
			organization: "ORGANISATION",
			customProperties: "PROPRIÉTÉS PERSONNALISÉES",
			failed: "Impossible d'afficher le menu des propriétés",
			properties: {
				statusDot: "Point de statut",
				priorityDot: "Point de priorité",
				dueDate: "Date d'échéance",
				scheduledDate: "Date planifiée",
				timeEstimate: "Estimation de temps",
				totalTrackedTime: "Temps suivi total",
				recurrence: "Récurrence",
				completedDate: "Date d'achèvement",
				createdDate: "Date de création",
				modifiedDate: "Date de modification",
				projects: "Projets",
				contexts: "Contextes",
				tags: "Étiquettes",
				blocked: "Bloqué",
				blocking: "Bloquant",
			},
		},
		reminderContextMenu: {
			remindBeforeDue: "Rappeler avant l'échéance...",
			remindBeforeScheduled: "Rappeler avant la date planifiée...",
			manageAllReminders: "Gérer tous les rappels...",
			clearAllReminders: "Effacer tous les rappels",
			quickReminders: {
				atTime: "À l'heure de l'événement",
				fiveMinutesBefore: "5 minutes avant",
				fifteenMinutesBefore: "15 minutes avant",
				oneHourBefore: "1 heure avant",
				oneDayBefore: "1 jour avant",
			},
		},
		recurrenceContextMenu: {
			daily: "Quotidien",
			weeklyOn: "Hebdomadaire le {day}",
			everyTwoWeeksOn: "Toutes les 2 semaines le {day}",
			monthlyOnThe: "Mensuel le {ordinal}",
			everyThreeMonthsOnThe: "Tous les 3 mois le {ordinal}",
			yearlyOn: "Annuel le {month} {ordinal}",
			weekdaysOnly: "Jours ouvrés seulement",
			customRecurrence: "Récurrence personnalisée...",
			clearRecurrence: "Effacer la récurrence",
			customRecurrenceModal: {
				title: "Récurrence personnalisée",
				startDate: "Date de début",
				startDateDesc: "La date à laquelle le modèle de récurrence commence",
				startTime: "Heure de début",
				startTimeDesc:
					"L'heure à laquelle les instances récurrentes doivent apparaître (optionnel)",
				frequency: "Fréquence",
				interval: "Intervalle",
				intervalDesc: "Tous les X jours/semaines/mois/années",
				daysOfWeek: "Jours de la semaine",
				daysOfWeekDesc:
					"Sélectionnez des jours spécifiques (pour la récurrence hebdomadaire)",
				monthlyRecurrence: "Récurrence mensuelle",
				monthlyRecurrenceDesc: "Choisissez comment répéter mensuellement",
				yearlyRecurrence: "Récurrence annuelle",
				yearlyRecurrenceDesc: "Choisissez comment répéter annuellement",
				endCondition: "Condition de fin",
				endConditionDesc: "Choisissez quand la récurrence doit se terminer",
				neverEnds: "Ne se termine jamais",
				endAfterOccurrences: "Se termine après {count} occurrences",
				endOnDate: "Se termine le {date}",
				onDayOfMonth: "Le jour {day} de chaque mois",
				onTheWeekOfMonth: "Le {week} {day} de chaque mois",
				onDateOfYear: "Le {month} {day} de chaque année",
				onTheWeekOfYear: "Le {week} {day} de {month} chaque année",
				frequencies: {
					daily: "Quotidien",
					weekly: "Hebdomadaire",
					monthly: "Mensuel",
					yearly: "Annuel",
				},
				weekPositions: {
					first: "premier",
					second: "deuxième",
					third: "troisième",
					fourth: "quatrième",
					last: "dernier",
				},
				weekdays: {
					monday: "Lundi",
					tuesday: "Mardi",
					wednesday: "Mercredi",
					thursday: "Jeudi",
					friday: "Vendredi",
					saturday: "Samedi",
					sunday: "Dimanche",
				},
				weekdaysShort: {
					mon: "Lun",
					tue: "Mar",
					wed: "Mer",
					thu: "Jeu",
					fri: "Ven",
					sat: "Sam",
					sun: "Dim",
				},
				cancel: "Annuler",
				save: "Enregistrer",
			},
		},
	},
};

export type FrTranslationSchema = typeof fr;
