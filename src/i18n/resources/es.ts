import { TranslationTree } from "../types";

export const es: TranslationTree = {
	common: {
		appName: "TaskNotes",
		cancel: "Cancelar",
		confirm: "Confirmar",
		close: "Cerrar",
		save: "Guardar",
		language: "Idioma",
		systemDefault: "Predeterminado del sistema",
		languages: {
			en: "Inglés",
			fr: "Francés",
			ru: "Ruso",
			zh: "Chino",
			de: "Alemán",
			es: "Español",
			ja: "Japonés",
		},
		weekdays: {
			sunday: "Domingo",
			monday: "Lunes",
			tuesday: "Martes",
			wednesday: "Miércoles",
			thursday: "Jueves",
			friday: "Viernes",
			saturday: "Sábado",
		},
		months: {
			january: "Enero",
			february: "Febrero",
			march: "Marzo",
			april: "Abril",
			may: "Mayo",
			june: "Junio",
			july: "Julio",
			august: "Agosto",
			september: "Septiembre",
			october: "Octubre",
			november: "Noviembre",
			december: "Diciembre",
		},
	},
	views: {
		agenda: {
			title: "Agenda",
			today: "Hoy",
			refreshCalendars: "Actualizar calendarios",
			actions: {
				previousPeriod: "Período anterior",
				nextPeriod: "Próximo período",
				goToToday: "Ir a hoy",
				refreshCalendars: "Actualizar suscripciones de calendario",
			},
			loading: "Cargando agenda...",
			dayToggle: "Cambiar día",
			expandAllDays: "Expandir todos los días",
			collapseAllDays: "Contraer todos los días",
			notices: {
				calendarNotReady: "Servicio de calendario aún no listo",
				calendarRefreshed: "Suscripciones de calendario actualizadas",
				refreshFailed: "Error al actualizar",
			},
			empty: {
				noItemsScheduled: "No hay elementos programados",
				noItemsFound: "No se encontraron elementos",
			},
		},
		taskList: {
			title: "Tareas",
			expandAllGroups: "Expandir todos los grupos",
			collapseAllGroups: "Contraer todos los grupos",
			noTasksFound: "No se encontraron tareas para los filtros seleccionados.",
		},
		notes: {
			title: "Notas",
			refreshButton: "Actualizando...",
			notices: {
				indexingDisabled: "Indexación de notas deshabilitada",
			},
			empty: {
				noNotesFound: "No se encontraron notas",
			},
		},
		miniCalendar: {
			title: "Mini Calendario",
		},
		advancedCalendar: {
			title: "Calendario Avanzado",
		},
		kanban: {
			title: "Kanban",
			newTask: "Nueva tarea",
			addCard: "+ Agregar tarjeta",
			noTasks: "Sin tareas",
			notices: {
				loadFailed: "Error al cargar el tablero Kanban",
				movedTask: 'Tarea movida a "{0}"',
			},
			errors: {
				loadingBoard: "Error al cargar el tablero.",
			},
		},
		pomodoro: {
			title: "Pomodoro",
			status: {
				focus: "Enfoque",
				ready: "Listo para comenzar",
				paused: "Pausado",
				working: "Trabajando",
				shortBreak: "Descanso corto",
				longBreak: "Descanso largo",
				breakPrompt: "¡Excelente trabajo! Tiempo para un descanso {length}",
				breakLength: {
					short: "corto",
					long: "largo",
				},
				breakComplete: "¡Descanso completo! ¿Listo para el próximo pomodoro?",
			},
			buttons: {
				start: "Iniciar",
				pause: "Pausar",
				stop: "Detener",
				resume: "Reanudar",
				startShortBreak: "Iniciar descanso corto",
				startLongBreak: "Iniciar descanso largo",
				skipBreak: "Saltar descanso",
				chooseTask: "Elegir tarea...",
				changeTask: "Cambiar tarea...",
				clearTask: "Quitar tarea",
				selectDifferentTask: "Seleccionar una tarea diferente",
			},
			notices: {
				noTasks: "No se encontraron tareas no archivadas. Crea algunas tareas primero.",
				loadFailed: "Error al cargar las tareas",
			},
			statsLabel: "completadas hoy",
		},
		pomodoroStats: {
			title: "Estadísticas de Pomodoro",
			heading: "Estadísticas de Pomodoro",
			refresh: "Actualizar",
			sections: {
				overview: "Resumen",
				today: "Hoy",
				week: "Esta semana",
				allTime: "Todo el tiempo",
				recent: "Sesiones recientes",
			},
			overviewCards: {
				todayPomos: {
					label: "Pomos de hoy",
					change: {
						more: "{count} más que ayer",
						less: "{count} menos que ayer",
					},
				},
				totalPomos: {
					label: "Pomos totales",
				},
				todayFocus: {
					label: "Enfoque de hoy",
					change: {
						more: "{duration} más que ayer",
						less: "{duration} menos que ayer",
					},
				},
				totalFocus: {
					label: "Duración total de enfoque",
				},
			},
			stats: {
				pomodoros: "Pomodoros",
				streak: "Racha",
				minutes: "Minutos",
				average: "Duración promedio",
				completion: "Finalización",
			},
			recents: {
				empty: "Aún no se han registrado sesiones",
				duration: "{minutes} min",
				status: {
					completed: "Completado",
					interrupted: "Interrumpido",
				},
			},
		},
		stats: {
			title: "Estadísticas",
			taskProjectStats: "Estadísticas de tareas y proyectos",
			sections: {
				filters: "Filtros",
				overview: "Resumen",
				today: "Hoy",
				thisWeek: "Esta semana",
				thisMonth: "Este mes",
				projectBreakdown: "Desglose de proyectos",
				dateRange: "Rango de fechas",
			},
			filters: {
				minTime: "Tiempo mínimo (minutos)",
			},
		},
	},
	settings: {
		tabs: {
			general: "General",
			taskProperties: "Propiedades de tareas",
			defaults: "Predeterminados y plantillas",
			appearance: "Apariencia e interfaz",
			features: "Características",
			integrations: "Integraciones",
		},
		features: {
			inlineTasks: {
				header: "Tareas en línea",
				description:
					"Configura las características de tareas en línea para gestión de tareas sin interrupciones dentro de cualquier nota.",
			},
			overlays: {
				taskLinkToggle: {
					name: "Superposición de enlace de tarea",
					description:
						"Mostrar superposiciones interactivas al pasar el cursor sobre enlaces de tareas",
				},
			},
			instantConvert: {
				toggle: {
					name: "Conversión instantánea de tareas",
					description:
						"Habilitar conversión instantánea de texto a tareas usando atajos de teclado",
				},
				folder: {
					name: "Carpeta de conversión de tareas en línea",
					description:
						"Carpeta para conversión de tareas en línea. Usa {{currentNotePath}} para relativo a la nota actual",
				},
			},
			nlp: {
				header: "Procesamiento de lenguaje natural",
				description:
					"Habilitar análisis inteligente de detalles de tareas desde entrada en lenguaje natural.",
				enable: {
					name: "Habilitar entrada de tareas en lenguaje natural",
					description:
						"Analizar fechas de vencimiento, prioridades y contextos desde lenguaje natural al crear tareas",
				},
				defaultToScheduled: {
					name: "Predeterminado a programado",
					description:
						"Cuando NLP detecta una fecha sin contexto, tratarla como programada en lugar de vencimiento",
				},
				language: {
					name: "Idioma NLP",
					description:
						"Idioma para patrones de procesamiento de lenguaje natural y análisis de fechas",
				},
				statusTrigger: {
					name: "Activador de sugerencia de estado",
					description:
						"Texto para activar sugerencias de estado (dejar vacío para deshabilitar)",
				},
			},
			pomodoro: {
				header: "Temporizador Pomodoro",
				description:
					"Temporizador Pomodoro integrado para gestión de tiempo y seguimiento de productividad.",
				workDuration: {
					name: "Duración del trabajo",
					description: "Duración de intervalos de trabajo en minutos",
				},
				shortBreak: {
					name: "Duración del descanso corto",
					description: "Duración de descansos cortos en minutos",
				},
				longBreak: {
					name: "Duración del descanso largo",
					description: "Duración de descansos largos en minutos",
				},
				longBreakInterval: {
					name: "Intervalo de descanso largo",
					description: "Número de sesiones de trabajo antes de un descanso largo",
				},
				autoStartBreaks: {
					name: "Auto-iniciar descansos",
					description:
						"Iniciar automáticamente temporizadores de descanso después de sesiones de trabajo",
				},
				autoStartWork: {
					name: "Auto-iniciar trabajo",
					description: "Iniciar automáticamente sesiones de trabajo después de descansos",
				},
				notifications: {
					name: "Notificaciones de Pomodoro",
					description: "Mostrar notificaciones cuando terminen las sesiones de Pomodoro",
				},
			},
			uiLanguage: {
				header: "Idioma de la interfaz",
				description: "Cambiar el idioma de los menús, avisos y vistas de TaskNotes.",
				dropdown: {
					name: "Idioma de interfaz",
					description:
						"Seleccionar el idioma usado para el texto de la interfaz de TaskNotes",
				},
			},
			pomodoroSound: {
				enabledName: "Sonido habilitado",
				enabledDesc: "Reproducir sonido cuando terminen las sesiones de Pomodoro",
				volumeName: "Volumen del sonido",
				volumeDesc: "Volumen para sonidos de Pomodoro (0-100)",
			},
			dataStorage: {
				name: "Almacenamiento de datos de Pomodoro",
				dailyNotes: "Notas diarias",
			},
			notifications: {
				header: "Notificaciones",
				enableName: "Habilitar notificaciones",
				enableDesc: "Habilitar notificaciones de recordatorio de tareas",
				typeName: "Tipo de notificación",
				typeDesc: "Tipo de notificaciones a mostrar",
				systemLabel: "Notificaciones del sistema",
				inAppLabel: "Notificaciones en la aplicación",
			},
			overdue: {
				hideCompletedName: "Ocultar tareas completadas de vencidas",
				hideCompletedDesc: "Excluir tareas completadas de cálculos de tareas vencidas",
			},
			indexing: {
				disableName: "Deshabilitar indexación de notas",
				disableDesc:
					"Deshabilitar indexación automática de contenido de notas para mejor rendimiento",
			},
			suggestions: {
				debounceName: "Rebote de sugerencias",
				debounceDesc: "Retraso en milisegundos antes de mostrar sugerencias",
			},
			timeTracking: {
				autoStopName: "Auto-detener seguimiento de tiempo",
				autoStopDesc:
					"Detener automáticamente el seguimiento de tiempo cuando una tarea se marca como completa",
				stopNotificationName: "Notificación de detención de seguimiento de tiempo",
				stopNotificationDesc:
					"Mostrar notificación cuando el seguimiento de tiempo se detiene automáticamente",
			},
			recurring: {
				maintainOffsetName:
					"Mantener desplazamiento de fecha de vencimiento en tareas recurrentes",
				maintainOffsetDesc:
					"Mantener el desplazamiento entre fecha de vencimiento y fecha programada cuando se completan tareas recurrentes",
			},
			timeblocking: {
				header: "Bloqueo de tiempo",
				enableName: "Habilitar bloqueo de tiempo",
				enableDesc:
					"Habilitar funcionalidad de bloque de tiempo para programación ligera en notas diarias",
				showBlocksName: "Mostrar bloques de tiempo",
				showBlocksDesc: "Mostrar bloques de tiempo de notas diarias por defecto",
			},
			performance: {
				header: "Rendimiento y comportamiento",
			},
			timeTrackingSection: {
				header: "Seguimiento de tiempo",
			},
			recurringSection: {
				header: "Tareas recurrentes",
			},
		},
		defaults: {
			header: {
				basicDefaults: "Predeterminados básicos",
				dateDefaults: "Predeterminados de fecha",
				defaultReminders: "Recordatorios predeterminados",
				bodyTemplate: "Plantilla del cuerpo",
				instantTaskConversion: "Conversión instantánea de tareas",
			},
			description: {
				basicDefaults:
					"Establecer valores predeterminados para nuevas tareas para acelerar la creación de tareas.",
				dateDefaults:
					"Establecer fechas de vencimiento y programación predeterminadas para nuevas tareas.",
				defaultReminders:
					"Configurar recordatorios predeterminados que se añadirán a nuevas tareas.",
				bodyTemplate:
					"Configurar un archivo de plantilla para usar en el contenido de nuevas tareas.",
				instantTaskConversion:
					"Configurar comportamiento al convertir texto a tareas instantáneamente.",
			},
			basicDefaults: {
				defaultStatus: {
					name: "Estado predeterminado",
					description: "Estado predeterminado para nuevas tareas",
				},
				defaultPriority: {
					name: "Prioridad predeterminada",
					description: "Prioridad predeterminada para nuevas tareas",
				},
				defaultContexts: {
					name: "Contextos predeterminados",
					description:
						"Lista separada por comas de contextos predeterminados (ej. @casa, @trabajo)",
					placeholder: "@casa, @trabajo",
				},
				defaultTags: {
					name: "Etiquetas predeterminadas",
					description: "Lista separada por comas de etiquetas predeterminadas (sin #)",
					placeholder: "importante, urgente",
				},
				defaultProjects: {
					name: "Proyectos predeterminados",
					description: "Enlaces de proyecto predeterminados para nuevas tareas",
					selectButton: "Seleccionar proyectos",
					selectTooltip: "Elegir notas de proyecto para vincular por defecto",
					removeTooltip: "Eliminar {name} de proyectos predeterminados",
				},
				useParentNoteAsProject: {
					name: "Usar nota padre como proyecto durante conversión instantánea",
					description:
						"Vincular automáticamente la nota padre como proyecto al usar conversión instantánea de tareas",
				},
				defaultTimeEstimate: {
					name: "Estimación de tiempo predeterminada",
					description:
						"Estimación de tiempo predeterminada en minutos (0 = sin predeterminado)",
					placeholder: "60",
				},
				defaultRecurrence: {
					name: "Recurrencia predeterminada",
					description: "Patrón de recurrencia predeterminado para nuevas tareas",
				},
			},
			dateDefaults: {
				defaultDueDate: {
					name: "Fecha de vencimiento predeterminada",
					description: "Fecha de vencimiento predeterminada para nuevas tareas",
				},
				defaultScheduledDate: {
					name: "Fecha programada predeterminada",
					description: "Fecha programada predeterminada para nuevas tareas",
				},
			},
			reminders: {
				addReminder: {
					name: "Agregar recordatorio predeterminado",
					description:
						"Crear un nuevo recordatorio predeterminado que se añadirá a todas las nuevas tareas",
					buttonText: "Agregar recordatorio",
				},
				emptyState:
					"No hay recordatorios predeterminados configurados. Agrega un recordatorio para ser notificado automáticamente sobre nuevas tareas.",
				emptyStateButton: "Agregar recordatorio",
				reminderDescription: "Descripción del recordatorio",
				unnamedReminder: "Recordatorio sin nombre",
				deleteTooltip: "Eliminar recordatorio",
				fields: {
					description: "Descripción:",
					type: "Tipo:",
					offset: "Desplazamiento:",
					unit: "Unidad:",
					direction: "Dirección:",
					relatedTo: "Relacionado con:",
					date: "Fecha:",
					time: "Hora:",
				},
				types: {
					relative: "Relativo (antes/después de fechas de tarea)",
					absolute: "Absoluto (fecha/hora específica)",
				},
				units: {
					minutes: "minutos",
					hours: "horas",
					days: "días",
				},
				directions: {
					before: "antes",
					after: "después",
				},
				relatedTo: {
					due: "fecha de vencimiento",
					scheduled: "fecha programada",
				},
			},
			bodyTemplate: {
				useBodyTemplate: {
					name: "Usar plantilla del cuerpo",
					description:
						"Usar un archivo de plantilla para el contenido del cuerpo de la tarea",
				},
				bodyTemplateFile: {
					name: "Archivo de plantilla del cuerpo",
					description:
						"Ruta al archivo de plantilla para contenido del cuerpo de la tarea. Soporta variables de plantilla como {{title}}, {{date}}, {{time}}, {{priority}}, {{status}}, etc.",
					placeholder: "Plantillas/Plantilla de tarea.md",
					ariaLabel: "Ruta al archivo de plantilla del cuerpo",
				},
				variablesHeader: "Variables de plantilla:",
				variables: {
					title: "{{title}} - Título de la tarea",
					details: "{{details}} - Detalles proporcionados por el usuario desde el modal",
					date: "{{date}} - Fecha actual (YYYY-MM-DD)",
					time: "{{time}} - Hora actual (HH:MM)",
					priority: "{{priority}} - Prioridad de la tarea",
					status: "{{status}} - Estado de la tarea",
					contexts: "{{contexts}} - Contextos de la tarea",
					tags: "{{tags}} - Etiquetas de la tarea",
					projects: "{{projects}} - Proyectos de la tarea",
				},
			},
			instantConversion: {
				useDefaultsOnInstantConvert: {
					name: "Usar predeterminados de tarea en conversión instantánea",
					description:
						"Aplicar configuraciones predeterminadas de tarea al convertir texto a tareas instantáneamente",
				},
			},
			options: {
				noDefault: "Sin predeterminado",
				none: "Ninguno",
				today: "Hoy",
				tomorrow: "Mañana",
				nextWeek: "Próxima semana",
				daily: "Diario",
				weekly: "Semanal",
				monthly: "Mensual",
				yearly: "Anual",
			},
		},
		general: {
			taskStorage: {
				header: "Almacenamiento de tareas",
				description: "Configurar dónde se almacenan las tareas y cómo se identifican.",
				defaultFolder: {
					name: "Carpeta predeterminada de tareas",
					description: "Ubicación predeterminada para nuevas tareas",
				},
				moveArchived: {
					name: "Mover tareas archivadas a carpeta",
					description: "Mover automáticamente tareas archivadas a una carpeta de archivo",
				},
				archiveFolder: {
					name: "Carpeta de archivo",
					description: "Carpeta para mover tareas cuando se archiven",
				},
			},
			taskIdentification: {
				header: "Identificación de tareas",
				description: "Elegir cómo TaskNotes identifica notas como tareas.",
				identifyBy: {
					name: "Identificar tareas por",
					description:
						"Elegir si identificar tareas por etiqueta o por una propiedad de frontmatter",
					options: {
						tag: "Etiqueta",
						property: "Propiedad",
					},
				},
				taskTag: {
					name: "Etiqueta de tarea",
					description: "Etiqueta que identifica notas como tareas (sin #)",
				},
				taskProperty: {
					name: "Nombre de propiedad de tarea",
					description: 'El nombre de propiedad de frontmatter (ej. "categoría")',
				},
				taskPropertyValue: {
					name: "Valor de propiedad de tarea",
					description: 'El valor que identifica una nota como tarea (ej. "tarea")',
				},
			},
			folderManagement: {
				header: "Gestión de carpetas",
				excludedFolders: {
					name: "Carpetas excluidas",
					description:
						"Lista separada por comas de carpetas a excluir de la pestaña Notas",
				},
			},
			taskInteraction: {
				header: "Interacción de tareas",
				description: "Configurar cómo se comporta hacer clic en las tareas.",
				singleClick: {
					name: "Acción de clic simple",
					description: "Acción realizada al hacer clic simple en una tarjeta de tarea",
				},
				doubleClick: {
					name: "Acción de doble clic",
					description: "Acción realizada al hacer doble clic en una tarjeta de tarea",
				},
				actions: {
					edit: "Editar tarea",
					openNote: "Abrir nota",
					none: "Sin acción",
				},
			},
		},
		taskProperties: {
			taskStatuses: {
				header: "Estados de tareas",
				description:
					"Personalizar las opciones de estado disponibles para tus tareas. Estos estados controlan el ciclo de vida de la tarea y determinan cuándo las tareas se consideran completas.",
				howTheyWork: {
					title: "Cómo funcionan los estados:",
					value: 'Valor: El identificador interno almacenado en tus archivos de tarea (ej. "en-progreso")',
					label: 'Etiqueta: El nombre mostrado en la interfaz (ej. "En progreso")',
					color: "Color: Color indicador visual para el punto de estado y distintivos",
					completed:
						"Completado: Cuando se marca, las tareas con este estado se consideran terminadas y pueden filtrarse de manera diferente",
					autoArchive:
						"Auto-archivar: Cuando está habilitado, las tareas se archivarán automáticamente después del retraso especificado (1-1440 minutos)",
					orderNote:
						"El orden de abajo determina la secuencia al alternar entre estados haciendo clic en distintivos de estado de tarea.",
				},
				addNew: {
					name: "Agregar nuevo estado",
					description: "Crear una nueva opción de estado para tus tareas",
					buttonText: "Agregar estado",
				},
				validationNote:
					'Nota: Debes tener al menos 2 estados, y al menos un estado debe estar marcado como "Completado".',
				emptyState:
					"No hay estados personalizados configurados. Agrega un estado para comenzar.",
				emptyStateButton: "Agregar estado",
				fields: {
					value: "Valor:",
					label: "Etiqueta:",
					color: "Color:",
					completed: "Completado:",
					autoArchive: "Auto-archivar:",
					delayMinutes: "Retraso (minutos):",
				},
				placeholders: {
					value: "en-progreso",
					label: "En progreso",
				},
				badges: {
					completed: "Completado",
				},
				deleteConfirm: '¿Estás seguro de que quieres eliminar el estado "{label}"?',
			},
			taskPriorities: {
				header: "Prioridades de tareas",
				description:
					"Personalizar los niveles de prioridad disponibles para tus tareas. Los pesos de prioridad determinan el orden de clasificación y la jerarquía visual en tus vistas de tareas.",
				howTheyWork: {
					title: "Cómo funcionan las prioridades:",
					value: 'Valor: El identificador interno almacenado en tus archivos de tarea (ej. "alta")',
					label: 'Etiqueta de visualización: El nombre mostrado en la interfaz (ej. "Alta prioridad")',
					color: "Color: Color indicador visual para el punto de prioridad y distintivos",
					weight: "Peso: Valor numérico para clasificación (pesos más altos aparecen primero en listas)",
					weightNote:
						"Las tareas se clasifican automáticamente por peso de prioridad en orden descendente (peso más alto primero). Los pesos pueden ser cualquier número positivo.",
				},
				addNew: {
					name: "Agregar nueva prioridad",
					description: "Crear un nuevo nivel de prioridad para tus tareas",
					buttonText: "Agregar prioridad",
				},
				validationNote:
					"Nota: Debes tener al menos 1 prioridad. Los pesos más altos tienen precedencia en clasificación y jerarquía visual.",
				emptyState:
					"No hay prioridades personalizadas configuradas. Agrega una prioridad para comenzar.",
				emptyStateButton: "Agregar prioridad",
				fields: {
					value: "Valor:",
					label: "Etiqueta:",
					color: "Color:",
					weight: "Peso:",
				},
				placeholders: {
					value: "alta",
					label: "Alta prioridad",
				},
				weightLabel: "Peso: {weight}",
				deleteConfirm: "Debes tener al menos una prioridad",
				deleteTooltip: "Eliminar prioridad",
			},
			fieldMapping: {
				header: "Mapeo de campos",
				warning:
					"⚠️ Advertencia: TaskNotes LEERÁ Y ESCRIBIRÁ usando estos nombres de propiedad. Cambiar estos después de crear tareas puede causar inconsistencias.",
				description:
					"Configurar qué propiedades de frontmatter debe usar TaskNotes para cada campo.",
				resetButton: {
					name: "Restablecer mapeos de campos",
					description: "Restablecer todos los mapeos de campos a valores predeterminados",
					buttonText: "Restablecer a predeterminados",
				},
				notices: {
					resetSuccess: "Mapeos de campos restablecidos a predeterminados",
					resetFailure: "Error al restablecer mapeos de campos",
					updateFailure:
						"Error al actualizar mapeo de campo para {label}. Por favor intenta de nuevo.",
				},
				table: {
					fieldHeader: "Campo de TaskNotes",
					propertyHeader: "Tu nombre de propiedad",
				},
				fields: {
					title: "Título",
					status: "Estado",
					priority: "Prioridad",
					due: "Fecha de vencimiento",
					scheduled: "Fecha programada",
					contexts: "Contextos",
					projects: "Proyectos",
					timeEstimate: "Estimación de tiempo",
					recurrence: "Recurrencia",
					dateCreated: "Fecha de creación",
					completedDate: "Fecha de finalización",
					dateModified: "Fecha de modificación",
					archiveTag: "Etiqueta de archivo",
					timeEntries: "Entradas de tiempo",
					completeInstances: "Instancias completas",
					pomodoros: "Pomodoros",
					icsEventId: "ID de evento ICS",
					icsEventTag: "Etiqueta de evento ICS",
					reminders: "Recordatorios",
				},
			},
			customUserFields: {
				header: "Campos personalizados de usuario",
				description:
					"Definir propiedades de frontmatter personalizadas para aparecer como opciones de filtro con reconocimiento de tipo en todas las vistas. Cada fila: Nombre de visualización, Nombre de propiedad, Tipo.",
				addNew: {
					name: "Agregar nuevo campo de usuario",
					description:
						"Crear un nuevo campo personalizado que aparecerá en filtros y vistas",
					buttonText: "Agregar campo de usuario",
				},
				emptyState:
					"No hay campos personalizados de usuario configurados. Agrega un campo para crear propiedades personalizadas para tus tareas.",
				emptyStateButton: "Agregar campo de usuario",
				fields: {
					displayName: "Nombre de visualización:",
					propertyKey: "Clave de propiedad:",
					type: "Tipo:",
				},
				placeholders: {
					displayName: "Nombre de visualización",
					propertyKey: "nombre-propiedad",
				},
				types: {
					text: "Texto",
					number: "Número",
					boolean: "Booleano",
					date: "Fecha",
					list: "Lista",
				},
				defaultNames: {
					unnamedField: "Campo sin nombre",
					noKey: "sin-clave",
				},
				deleteTooltip: "Eliminar campo",
			},
		},
		appearance: {
			taskCards: {
				header: "Tarjetas de tareas",
				description:
					"Configurar cómo se muestran las tarjetas de tareas en todas las vistas.",
				defaultVisibleProperties: {
					name: "Propiedades visibles predeterminadas",
					description:
						"Elegir qué propiedades aparecen en las tarjetas de tareas por defecto.",
				},
				propertyGroups: {
					coreProperties: "PROPIEDADES PRINCIPALES",
					organization: "ORGANIZACIÓN",
					customProperties: "PROPIEDADES PERSONALIZADAS",
				},
				properties: {
					status: "Punto de estado",
					priority: "Punto de prioridad",
					due: "Fecha de vencimiento",
					scheduled: "Fecha programada",
					timeEstimate: "Estimación de tiempo",
					totalTrackedTime: "Tiempo total rastreado",
					recurrence: "Recurrencia",
					completedDate: "Fecha de finalización",
					createdDate: "Fecha de creación",
					modifiedDate: "Fecha de modificación",
					projects: "Proyectos",
					contexts: "Contextos",
					tags: "Etiquetas",
				},
			},
			taskFilenames: {
				header: "Nombres de archivos de tareas",
				description: "Configurar cómo se nombran los archivos de tareas cuando se crean.",
				storeTitleInFilename: {
					name: "Almacenar título en nombre de archivo",
					description:
						"Usar el título de la tarea como nombre de archivo. El nombre de archivo se actualizará cuando se cambie el título de la tarea (Recomendado).",
				},
				filenameFormat: {
					name: "Formato de nombre de archivo",
					description: "Cómo deben generarse los nombres de archivos de tareas",
					options: {
						title: "Título de tarea (Sin actualización)",
						zettel: "Formato Zettelkasten (AAMMDD + segundos base36 desde medianoche)",
						timestamp: "Marca de tiempo completa (YYYY-MM-DD-HHMMSS)",
						custom: "Plantilla personalizada",
					},
				},
				customTemplate: {
					name: "Plantilla de nombre de archivo personalizada",
					description:
						"Plantilla para nombres de archivo personalizados. Variables disponibles: {title}, {titleLower}, {titleUpper}, {titleSnake}, {titleKebab}, {titleCamel}, {titlePascal}, {date}, {shortDate}, {time}, {time12}, {time24}, {timestamp}, {dateTime}, {year}, {month}, {monthName}, {monthNameShort}, {day}, {dayName}, {dayNameShort}, {hour}, {hour12}, {minute}, {second}, {milliseconds}, {ms}, {ampm}, {week}, {quarter}, {unix}, {unixMs}, {timezone}, {timezoneShort}, {utcOffset}, {utcOffsetShort}, {utcZ}, {zettel}, {nano}, {priority}, {priorityShort}, {status}, {statusShort}, {dueDate}, {scheduledDate}",
					placeholder: "{date}-{title}-{dueDate}",
					helpText:
						"Nota: {dueDate} y {scheduledDate} están en formato YYYY-MM-DD y estarán vacíos si no están configurados.",
				},
			},
			displayFormatting: {
				header: "Formato de visualización",
				description:
					"Configurar cómo se muestran fechas, horas y otros datos en todo el plugin.",
				timeFormat: {
					name: "Formato de hora",
					description: "Mostrar hora en formato de 12 horas o 24 horas en todo el plugin",
					options: {
						twelveHour: "12 horas (AM/PM)",
						twentyFourHour: "24 horas",
					},
				},
			},
			calendarView: {
				header: "Vista de calendario",
				description:
					"Personalizar la apariencia y comportamiento de la vista de calendario.",
				defaultView: {
					name: "Vista predeterminada",
					description:
						"La vista de calendario mostrada al abrir la pestaña de calendario",
					options: {
						monthGrid: "Cuadrícula mensual",
						weekTimeline: "Línea de tiempo semanal",
						dayTimeline: "Línea de tiempo diaria",
						yearView: "Vista anual",
						customMultiDay: "Multi-día personalizado",
					},
				},
				customDayCount: {
					name: "Conteo de días de vista personalizada",
					description: "Número de días a mostrar en vista multi-día personalizada",
					placeholder: "3",
				},
				firstDayOfWeek: {
					name: "Primer día de la semana",
					description: "Qué día debe ser la primera columna en vistas semanales",
				},
				showWeekends: {
					name: "Mostrar fines de semana",
					description: "Mostrar fines de semana en vistas de calendario",
				},
				showWeekNumbers: {
					name: "Mostrar números de semana",
					description: "Mostrar números de semana en vistas de calendario",
				},
				showTodayHighlight: {
					name: "Mostrar resaltado de hoy",
					description: "Resaltar el día actual en vistas de calendario",
				},
				showCurrentTimeIndicator: {
					name: "Mostrar indicador de hora actual",
					description:
						"Mostrar una línea que muestra la hora actual en vistas de línea de tiempo",
				},
				selectionMirror: {
					name: "Espejo de selección",
					description:
						"Mostrar una vista previa visual mientras se arrastra para seleccionar rangos de tiempo",
				},
				calendarLocale: {
					name: "Configuración regional del calendario",
					description:
						'Configuración regional del calendario para formato de fecha y sistema de calendario (ej. "en", "fa" para Farsi/Persa, "de" para Alemán). Dejar vacío para auto-detectar desde el navegador.',
					placeholder: "Auto-detectar",
				},
			},
			defaultEventVisibility: {
				header: "Visibilidad predeterminada de eventos",
				description:
					"Configurar qué tipos de eventos son visibles por defecto al abrir el calendario avanzado. Los usuarios aún pueden activar/desactivar estos en la vista de calendario.",
				showScheduledTasks: {
					name: "Mostrar tareas programadas",
					description: "Mostrar tareas con fechas programadas por defecto",
				},
				showDueDates: {
					name: "Mostrar fechas de vencimiento",
					description: "Mostrar fechas de vencimiento de tareas por defecto",
				},
				showDueWhenScheduled: {
					name: "Mostrar fechas de vencimiento cuando están programadas",
					description:
						"Mostrar fechas de vencimiento incluso para tareas que ya tienen fechas programadas",
				},
				showTimeEntries: {
					name: "Mostrar entradas de tiempo",
					description:
						"Mostrar entradas de seguimiento de tiempo completadas por defecto",
				},
				showRecurringTasks: {
					name: "Mostrar tareas recurrentes",
					description: "Mostrar instancias de tareas recurrentes por defecto",
				},
				showICSEvents: {
					name: "Mostrar eventos ICS",
					description: "Mostrar eventos de suscripciones ICS por defecto",
				},
			},
			timeSettings: {
				header: "Configuraciones de tiempo",
				description:
					"Configurar ajustes de visualización relacionados con el tiempo para vistas de línea de tiempo.",
				timeSlotDuration: {
					name: "Duración de intervalo de tiempo",
					description:
						"Duración de cada intervalo de tiempo en vistas de línea de tiempo",
					options: {
						fifteenMinutes: "15 minutos",
						thirtyMinutes: "30 minutos",
						sixtyMinutes: "60 minutos",
					},
				},
				startTime: {
					name: "Hora de inicio",
					description:
						"Hora más temprana mostrada en vistas de línea de tiempo (formato HH:MM)",
					placeholder: "06:00",
				},
				endTime: {
					name: "Hora de fin",
					description:
						"Hora más tardía mostrada en vistas de línea de tiempo (formato HH:MM)",
					placeholder: "22:00",
				},
				initialScrollTime: {
					name: "Hora de desplazamiento inicial",
					description:
						"Hora a la que desplazarse al abrir vistas de línea de tiempo (formato HH:MM)",
					placeholder: "09:00",
				},
			},
			uiElements: {
				header: "Elementos de interfaz",
				description: "Configurar la visualización de varios elementos de interfaz.",
				showTrackedTasksInStatusBar: {
					name: "Mostrar tareas rastreadas en barra de estado",
					description:
						"Mostrar tareas actualmente rastreadas en la barra de estado de Obsidian",
				},
				showProjectSubtasksWidget: {
					name: "Mostrar widget de subtareas de proyecto",
					description:
						"Mostrar un widget que muestra subtareas para la nota de proyecto actual",
				},
				projectSubtasksPosition: {
					name: "Posición de subtareas de proyecto",
					description: "Dónde posicionar el widget de subtareas de proyecto",
					options: {
						top: "Parte superior de la nota",
						bottom: "Parte inferior de la nota",
					},
				},
				showExpandableSubtasks: {
					name: "Mostrar subtareas expandibles",
					description:
						"Permitir expandir/contraer secciones de subtareas en tarjetas de tareas",
				},
				subtaskChevronPosition: {
					name: "Posición de chevron de subtarea",
					description: "Posición de chevrons de expandir/contraer en tarjetas de tareas",
					options: {
						left: "Lado izquierdo",
						right: "Lado derecho",
					},
				},
				viewsButtonAlignment: {
					name: "Alineación del botón de vistas",
					description: "Alineación del botón de vistas/filtros en la interfaz de tareas",
					options: {
						left: "Lado izquierdo",
						right: "Lado derecho",
					},
				},
			},
			projectAutosuggest: {
				header: "Autosugerencia de proyectos",
				description:
					"Personalizar cómo se muestran las sugerencias de proyectos durante la creación de tareas.",
				requiredTags: {
					name: "Etiquetas requeridas",
					description:
						"Mostrar solo notas con cualquiera de estas etiquetas (separadas por comas). Dejar vacío para mostrar todas las notas.",
					placeholder: "proyecto, activo, importante",
				},
				includeFolders: {
					name: "Incluir carpetas",
					description:
						"Mostrar solo notas en estas carpetas (rutas separadas por comas). Dejar vacío para mostrar todas las carpetas.",
					placeholder: "Proyectos/, Trabajo/Activo, Personal",
				},
				requiredPropertyKey: {
					name: "Clave de propiedad requerida",
					description:
						"Mostrar solo notas donde esta propiedad de frontmatter coincida con el valor de abajo. Dejar vacío para ignorar.",
					placeholder: "tipo",
				},
				requiredPropertyValue: {
					name: "Valor de propiedad requerido",
					description:
						"Solo las notas donde la propiedad igual a este valor son sugeridas. Dejar vacío para requerir que la propiedad exista.",
					placeholder: "proyecto",
				},
				customizeDisplay: {
					name: "Personalizar visualización de sugerencias",
					description:
						"Mostrar opciones avanzadas para configurar cómo aparecen las sugerencias de proyectos y qué información muestran.",
				},
				enableFuzzyMatching: {
					name: "Habilitar coincidencia difusa",
					description:
						"Permitir errores tipográficos y coincidencias parciales en búsqueda de proyectos. Puede ser más lento en bóvedas grandes.",
				},
				displayRowsHelp:
					"Configurar hasta 3 líneas de información para mostrar para cada sugerencia de proyecto.",
				displayRows: {
					row1: {
						name: "Fila 1",
						description:
							"Formato: {propiedad|banderas}. Propiedades: title, aliases, file.path, file.parent. Banderas: n(Etiqueta) muestra etiqueta, s hace búsqueda. Ejemplo: {title|n(Título)|s}",
						placeholder: "{title|n(Título)}",
					},
					row2: {
						name: "Fila 2 (opcional)",
						description:
							"Patrones comunes: {aliases|n(Alias)}, {file.parent|n(Carpeta)}, literal:Texto personalizado",
						placeholder: "{aliases|n(Alias)}",
					},
					row3: {
						name: "Fila 3 (opcional)",
						description:
							"Información adicional como {file.path|n(Ruta)} o campos de frontmatter personalizados",
						placeholder: "{file.path|n(Ruta)}",
					},
				},
				quickReference: {
					header: "Referencia rápida",
					properties:
						"Propiedades disponibles: title, aliases, file.path, file.parent, o cualquier campo de frontmatter",
					labels: 'Agregar etiquetas: {title|n(Título)} → "Título: Mi proyecto"',
					searchable: "Hacer búsqueda: {description|s} incluye descripción en búsqueda +",
					staticText: "Texto estático: literal:Mi etiqueta personalizada",
					alwaysSearchable:
						"Nombre de archivo, título y alias siempre son búsqueda por defecto.",
				},
			},
			dataStorage: {
				name: "Ubicación de almacenamiento",
				description: "Dónde almacenar el historial de sesiones de Pomodoro",
				pluginData: "Datos del plugin (recomendado)",
				dailyNotes: "Notas diarias",
				notices: {
					locationChanged:
						"Ubicación de almacenamiento de Pomodoro cambiada a {location}",
				},
			},
			notifications: {
				description: "Configurar notificaciones de recordatorio de tareas y alertas.",
			},
			performance: {
				description: "Configurar opciones de rendimiento y comportamiento del plugin.",
			},
			timeTrackingSection: {
				description: "Configurar comportamientos de seguimiento de tiempo automático.",
			},
			recurringSection: {
				description: "Configurar comportamiento para gestión de tareas recurrentes.",
			},
			timeblocking: {
				description:
					"Configurar funcionalidad de bloque de tiempo para programación ligera en notas diarias.",
				usage: "Uso: En la vista de calendario avanzado, mantén Shift + arrastra para crear bloques de tiempo. Arrastra para mover bloques de tiempo existentes. Redimensiona bordes para ajustar duración.",
			},
		},
		integrations: {
			basesIntegration: {
				header: "Integración con Bases",
				description:
					"Configurar integración con el plugin Obsidian Bases. Esta es una característica experimental, y actualmente depende de APIs no documentadas de Obsidian. El comportamiento puede cambiar o fallar.",
				enable: {
					name: "Habilitar integración con Bases",
					description:
						"Habilitar vistas de TaskNotes para usar dentro del plugin Obsidian Bases. El plugin Bases debe estar habilitado para que esto funcione.",
				},
				notices: {
					enabled:
						"Integración con Bases habilitada. Por favor reinicia Obsidian para completar la configuración.",
					disabled:
						"Integración con Bases deshabilitada. Por favor reinicia Obsidian para completar la eliminación.",
				},
			},
			calendarSubscriptions: {
				header: "Suscripciones de calendario",
				description:
					"Suscribirse a calendarios externos vía URLs ICS/iCal para ver eventos junto a tus tareas.",
				defaultNoteTemplate: {
					name: "Plantilla de nota predeterminada",
					description:
						"Ruta al archivo de plantilla para notas creadas desde eventos ICS",
					placeholder: "Plantillas/Plantilla de evento.md",
				},
				defaultNoteFolder: {
					name: "Carpeta de nota predeterminada",
					description: "Carpeta para notas creadas desde eventos ICS",
					placeholder: "Calendario/Eventos",
				},
				filenameFormat: {
					name: "Formato de nombre de archivo de nota ICS",
					description:
						"Cómo se generan los nombres de archivo para notas creadas desde eventos ICS",
					options: {
						title: "Título del evento",
						zettel: "Formato Zettelkasten",
						timestamp: "Marca de tiempo",
						custom: "Plantilla personalizada",
					},
				},
				customTemplate: {
					name: "Plantilla de nombre de archivo ICS personalizada",
					description: "Plantilla para nombres de archivo de eventos ICS personalizados",
					placeholder: "{date}-{title}",
				},
			},
			subscriptionsList: {
				header: "Lista de suscripciones de calendario",
				addSubscription: {
					name: "Agregar suscripción de calendario",
					description:
						"Agregar una nueva suscripción de calendario desde URL ICS/iCal o archivo local",
					buttonText: "Agregar suscripción",
				},
				refreshAll: {
					name: "Actualizar todas las suscripciones",
					description:
						"Actualizar manualmente todas las suscripciones de calendario habilitadas",
					buttonText: "Actualizar todas",
				},
				newCalendarName: "Nuevo calendario",
				emptyState:
					"No hay suscripciones de calendario configuradas. Agrega una suscripción para sincronizar calendarios externos.",
				notices: {
					addSuccess:
						"Nueva suscripción de calendario agregada - por favor configura los detalles",
					addFailure: "Error al agregar suscripción",
					serviceUnavailable: "Servicio de suscripción ICS no disponible",
					refreshSuccess:
						"Todas las suscripciones de calendario actualizadas exitosamente",
					refreshFailure: "Error al actualizar algunas suscripciones de calendario",
					updateFailure: "Error al actualizar suscripción",
					deleteSuccess: 'Suscripción "{name}" eliminada',
					deleteFailure: "Error al eliminar suscripción",
					enableFirst: "Habilita la suscripción primero",
					refreshSubscriptionSuccess: '"{name}" actualizado',
					refreshSubscriptionFailure: "Error al actualizar suscripción",
				},
				labels: {
					enabled: "Habilitado:",
					name: "Nombre:",
					type: "Tipo:",
					url: "URL:",
					filePath: "Ruta de archivo:",
					color: "Color:",
					refreshMinutes: "Actualizar (min):",
				},
				typeOptions: {
					remote: "URL remota",
					local: "Archivo local",
				},
				placeholders: {
					calendarName: "Nombre del calendario",
					url: "URL ICS/iCal",
					filePath: "Ruta de archivo local (ej. Calendario.ics)",
					localFile: "Calendario.ics",
				},
				statusLabels: {
					enabled: "Habilitado",
					disabled: "Deshabilitado",
					remote: "Remoto",
					localFile: "Archivo local",
					remoteCalendar: "Calendario remoto",
					localFileCalendar: "Archivo local",
					synced: "Sincronizado {timeAgo}",
					error: "Error",
				},
				actions: {
					refreshNow: "Actualizar ahora",
					deleteSubscription: "Eliminar suscripción",
				},
				confirmDelete: {
					title: "Eliminar suscripción",
					message:
						'¿Estás seguro de que quieres eliminar la suscripción "{name}"? Esta acción no se puede deshacer.',
					confirmText: "Eliminar",
				},
			},
			autoExport: {
				header: "Exportación automática ICS",
				description: "Exportar automáticamente todas tus tareas a un archivo ICS.",
				enable: {
					name: "Habilitar exportación automática",
					description:
						"Mantener automáticamente un archivo ICS actualizado con todas tus tareas",
				},
				filePath: {
					name: "Ruta del archivo de exportación",
					description:
						"Ruta donde se guardará el archivo ICS (relativo a la raíz de la bóveda)",
					placeholder: "tasknotes-calendario.ics",
				},
				interval: {
					name: "Intervalo de actualización (entre 5 y 1440 minutos)",
					description: "Con qué frecuencia actualizar el archivo de exportación",
					placeholder: "60",
				},
				exportNow: {
					name: "Exportar ahora",
					description: "Activar manualmente una exportación inmediata",
					buttonText: "Exportar ahora",
				},
				status: {
					title: "Estado de exportación:",
					lastExport: "Última exportación: {time}",
					nextExport: "Próxima exportación: {time}",
					noExports: "Aún no hay exportaciones",
					notScheduled: "No programado",
					notInitialized:
						"Servicio de auto exportación no inicializado - por favor reinicia Obsidian",
				},
				notices: {
					reloadRequired:
						"Por favor recarga Obsidian para que los cambios de exportación automática tengan efecto.",
					exportSuccess: "Tareas exportadas exitosamente",
					exportFailure: "Exportación fallida - revisa la consola para detalles",
					serviceUnavailable: "Servicio de auto exportación no disponible",
				},
			},
			httpApi: {
				header: "API HTTP",
				description: "Habilitar API HTTP para integraciones externas y automatizaciones.",
				enable: {
					name: "Habilitar API HTTP",
					description: "Iniciar servidor HTTP local para acceso API",
				},
				port: {
					name: "Puerto API",
					description: "Número de puerto para el servidor API HTTP",
					placeholder: "3000",
				},
				authToken: {
					name: "Token de autenticación API",
					description:
						"Token requerido para autenticación API (dejar vacío para sin autenticación)",
					placeholder: "tu-token-secreto",
				},
				endpoints: {
					header: "Endpoints API disponibles",
					expandIcon: "▶",
					collapseIcon: "▼",
				},
			},
			webhooks: {
				header: "Webhooks",
				description: {
					overview:
						"Los webhooks envían notificaciones en tiempo real a servicios externos cuando ocurren eventos de TaskNotes.",
					usage: "Configurar webhooks para integrar con herramientas de automatización, servicios de sincronización o aplicaciones personalizadas.",
				},
				addWebhook: {
					name: "Agregar webhook",
					description: "Registrar un nuevo endpoint de webhook",
					buttonText: "Agregar webhook",
				},
				emptyState: {
					message:
						"No hay webhooks configurados. Agrega un webhook para recibir notificaciones en tiempo real.",
					buttonText: "Agregar webhook",
				},
				labels: {
					active: "Activo:",
					url: "URL:",
					events: "Eventos:",
					transform: "Transformar:",
				},
				placeholders: {
					url: "URL del webhook",
					noEventsSelected: "No hay eventos seleccionados",
					rawPayload: "Carga cruda (sin transformación)",
				},
				statusLabels: {
					active: "Activo",
					inactive: "Inactivo",
					created: "Creado {timeAgo}",
				},
				actions: {
					editEvents: "Editar eventos",
					delete: "Eliminar",
				},
				notices: {
					urlUpdated: "URL del webhook actualizada",
					enabled: "Webhook habilitado",
					disabled: "Webhook deshabilitado",
					created: "Webhook creado exitosamente",
					deleted: "Webhook eliminado",
					updated: "Webhook actualizado",
				},
				confirmDelete: {
					title: "Eliminar webhook",
					message:
						"¿Estás seguro de que quieres eliminar este webhook?\n\nURL: {url}\n\nEsta acción no se puede deshacer.",
					confirmText: "Eliminar",
				},
				cardHeader: "Webhook",
				cardFields: {
					active: "Activo:",
					url: "URL:",
					events: "Eventos:",
					transform: "Transformar:",
				},
				eventsDisplay: {
					noEvents: "No hay eventos seleccionados",
				},
				transformDisplay: {
					noTransform: "Carga cruda (sin transformación)",
				},
				secretModal: {
					title: "Secreto de webhook generado",
					description:
						"Tu secreto de webhook ha sido generado. Guarda este secreto ya que no podrás verlo de nuevo:",
					usage: "Usa este secreto para verificar cargas de webhook en tu aplicación receptora.",
					gotIt: "Entendido",
				},
				editModal: {
					title: "Editar webhook",
					eventsHeader: "Eventos a suscribir",
				},
				events: {
					taskCreated: {
						label: "Tarea creada",
						description: "Cuando se crean nuevas tareas",
					},
					taskUpdated: {
						label: "Tarea actualizada",
						description: "Cuando se modifican las tareas",
					},
					taskCompleted: {
						label: "Tarea completada",
						description: "Cuando las tareas se marcan como completas",
					},
					taskDeleted: {
						label: "Tarea eliminada",
						description: "Cuando se eliminan las tareas",
					},
					taskArchived: {
						label: "Tarea archivada",
						description: "Cuando se archivan las tareas",
					},
					taskUnarchived: {
						label: "Tarea desarchivada",
						description: "Cuando se desarchivar las tareas",
					},
					timeStarted: {
						label: "Tiempo iniciado",
						description: "Cuando inicia el seguimiento de tiempo",
					},
					timeStopped: {
						label: "Tiempo detenido",
						description: "Cuando se detiene el seguimiento de tiempo",
					},
					pomodoroStarted: {
						label: "Pomodoro iniciado",
						description: "Cuando comienzan las sesiones de pomodoro",
					},
					pomodoroCompleted: {
						label: "Pomodoro completado",
						description: "Cuando terminan las sesiones de pomodoro",
					},
					pomodoroInterrupted: {
						label: "Pomodoro interrumpido",
						description: "Cuando se detienen las sesiones de pomodoro",
					},
					recurringCompleted: {
						label: "Instancia recurrente completada",
						description: "Cuando se completan instancias de tareas recurrentes",
					},
					reminderTriggered: {
						label: "Recordatorio activado",
						description: "Cuando se activan recordatorios de tareas",
					},
				},
				modals: {
					secretGenerated: {
						title: "Secreto de webhook generado",
						description:
							"Tu secreto de webhook ha sido generado. Guarda este secreto ya que no podrás verlo de nuevo:",
						usage: "Usa este secreto para verificar cargas de webhook en tu aplicación receptora.",
						buttonText: "Entendido",
					},
					edit: {
						title: "Editar webhook",
						eventsSection: "Eventos a suscribir",
						transformSection: "Configuración de transformación (Opcional)",
						headersSection: "Configuración de encabezados",
						transformFile: {
							name: "Archivo de transformación",
							description:
								"Ruta a un archivo .js o .json en tu bóveda que transforma cargas de webhook",
							placeholder: "discord-transform.js",
						},
						customHeaders: {
							name: "Incluir encabezados personalizados",
							description:
								"Incluir encabezados de TaskNotes (tipo de evento, firma, ID de entrega). Desactivar para Discord, Slack y otros servicios con políticas CORS estrictas.",
						},
						buttons: {
							cancel: "Cancelar",
							save: "Guardar cambios",
						},
						notices: {
							selectAtLeastOneEvent: "Por favor selecciona al menos un evento",
						},
					},
					add: {
						title: "Agregar webhook",
						eventsSection: "Eventos a suscribir",
						transformSection: "Configuración de transformación (Opcional)",
						headersSection: "Configuración de encabezados",
						url: {
							name: "URL del webhook",
							description: "El endpoint donde se enviarán las cargas del webhook",
							placeholder: "https://tu-servicio.com/webhook",
						},
						transformFile: {
							name: "Archivo de transformación",
							description:
								"Ruta a un archivo .js o .json en tu bóveda que transforma cargas de webhook",
							placeholder: "discord-transform.js",
						},
						customHeaders: {
							name: "Incluir encabezados personalizados",
							description:
								"Incluir encabezados de TaskNotes (tipo de evento, firma, ID de entrega). Desactivar para Discord, Slack y otros servicios con políticas CORS estrictas.",
						},
						transformHelp: {
							title: "Los archivos de transformación te permiten personalizar cargas de webhook:",
							jsFiles: "Archivos .js:",
							jsDescription: " Transformaciones JavaScript personalizadas",
							jsonFiles: "Archivos .json:",
							jsonDescription: " Plantillas con ",
							jsonVariable: "${data.task.title}",
							leaveEmpty: "Dejar vacío:",
							leaveEmptyDescription: " Enviar datos crudos",
							example: "Ejemplo:",
							exampleFile: "discord-transform.js",
						},
						buttons: {
							cancel: "Cancelar",
							add: "Agregar webhook",
						},
						notices: {
							urlRequired: "URL del webhook es requerida",
							selectAtLeastOneEvent: "Por favor selecciona al menos un evento",
						},
					},
				},
			},
			otherIntegrations: {
				header: "Otras integraciones de plugins",
				description: "Configurar integraciones con otros plugins de Obsidian.",
			},
			timeFormats: {
				justNow: "Justo ahora",
				minutesAgo: "hace {minutes} minuto{plural}",
				hoursAgo: "hace {hours} hora{plural}",
				daysAgo: "hace {days} día{plural}",
			},
		},
	},
	notices: {
		languageChanged: "Idioma cambiado a {language}.",
		exportTasksFailed: "Error al exportar tareas como archivo ICS",
	},
	commands: {
		openCalendarView: "Abrir vista de mini calendario",
		openAdvancedCalendarView: "Abrir vista de calendario avanzado",
		openTasksView: "Abrir vista de tareas",
		openNotesView: "Abrir vista de notas",
		openAgendaView: "Abrir vista de agenda",
		openPomodoroView: "Abrir temporizador pomodoro",
		openKanbanView: "Abrir tablero kanban",
		openPomodoroStats: "Abrir estadísticas de pomodoro",
		openStatisticsView: "Abrir estadísticas de tareas y proyectos",
		createNewTask: "Crear nueva tarea",
		convertToTaskNote: "Convertir tarea a TaskNote",
		convertAllTasksInNote: "Convertir todas las tareas en nota",
		insertTaskNoteLink: "Insertar enlace de tasknote",
		createInlineTask: "Crear nueva tarea en línea",
		quickActionsCurrentTask: "Acciones rápidas para tarea actual",
		goToTodayNote: "Ir a la nota de hoy",
		startPomodoro: "Iniciar temporizador pomodoro",
		stopPomodoro: "Detener temporizador pomodoro",
		pauseResumePomodoro: "Pausar/reanudar temporizador pomodoro",
		refreshCache: "Actualizar caché",
		exportAllTasksIcs: "Exportar todas las tareas como archivo ICS",
	},
	modals: {
		task: {
			titlePlaceholder: "¿Qué necesita hacerse?",
			titleLabel: "Título",
			titleDetailedPlaceholder: "Título de la tarea...",
			detailsLabel: "Detalles",
			detailsPlaceholder: "Agregar más detalles...",
			projectsLabel: "Proyectos",
			projectsAdd: "Agregar proyecto",
			projectsTooltip: "Seleccionar una nota de proyecto usando búsqueda difusa",
			projectsRemoveTooltip: "Eliminar proyecto",
			contextsLabel: "Contextos",
			contextsPlaceholder: "contexto1, contexto2",
			tagsLabel: "Etiquetas",
			tagsPlaceholder: "etiqueta1, etiqueta2",
			timeEstimateLabel: "Estimación de tiempo (minutos)",
			timeEstimatePlaceholder: "30",
			customFieldsLabel: "Campos personalizados",
			actions: {
				due: "Establecer fecha de vencimiento",
				scheduled: "Establecer fecha programada",
				status: "Establecer estado",
				priority: "Establecer prioridad",
				recurrence: "Establecer recurrencia",
				reminders: "Establecer recordatorios",
			},
			buttons: {
				openNote: "Abrir nota",
				save: "Guardar",
			},
			tooltips: {
				dueValue: "Vence: {value}",
				scheduledValue: "Programado: {value}",
				statusValue: "Estado: {value}",
				priorityValue: "Prioridad: {value}",
				recurrenceValue: "Recurrencia: {value}",
				remindersSingle: "1 recordatorio establecido",
				remindersPlural: "{count} recordatorios establecidos",
			},
			dateMenu: {
				dueTitle: "Establecer fecha de vencimiento",
				scheduledTitle: "Establecer fecha programada",
			},
			userFields: {
				textPlaceholder: "Ingresar {field}...",
				numberPlaceholder: "0",
				datePlaceholder: "YYYY-MM-DD",
				listPlaceholder: "elemento1, elemento2, elemento3",
				pickDate: "Elegir fecha de {field}",
			},
			recurrence: {
				daily: "Diario",
				weekly: "Semanal",
				everyTwoWeeks: "Cada 2 semanas",
				weekdays: "Días de semana",
				weeklyOn: "Semanal en {days}",
				monthly: "Mensual",
				everyThreeMonths: "Cada 3 meses",
				monthlyOnOrdinal: "Mensual en el {ordinal}",
				monthlyByWeekday: "Mensual (por día de semana)",
				yearly: "Anual",
				yearlyOn: "Anual en {month} {day}",
				custom: "Personalizado",
				countSuffix: "{count} veces",
				untilSuffix: "hasta {date}",
				ordinal: "{number}{suffix}",
			},
		},
		taskCreation: {
			title: "Crear tarea",
			actions: {
				fillFromNaturalLanguage: "Llenar formulario desde lenguaje natural",
				hideDetailedOptions: "Ocultar opciones detalladas",
				showDetailedOptions: "Mostrar opciones detalladas",
			},
			nlPlaceholder:
				"Comprar comestibles mañana a las 3pm @casa #recados\n\nAgregar detalles aquí...",
			notices: {
				titleRequired: "Por favor ingresa un título de tarea",
				success: 'Tarea "{title}" creada exitosamente',
				successShortened:
					'Tarea "{title}" creada exitosamente (nombre de archivo acortado por longitud)',
				failure: "Error al crear tarea: {message}",
			},
		},
		taskEdit: {
			title: "Editar tarea",
			sections: {
				completions: "Finalizaciones",
				taskInfo: "Información de la tarea",
			},
			metadata: {
				totalTrackedTime: "Tiempo total rastreado:",
				created: "Creado:",
				modified: "Modificado:",
				file: "Archivo:",
			},
			buttons: {
				archive: "Archivar",
				unarchive: "Desarchivar",
			},
			notices: {
				titleRequired: "Por favor ingresa un título de tarea",
				noChanges: "No hay cambios para guardar",
				updateSuccess: 'Tarea "{title}" actualizada exitosamente',
				updateFailure: "Error al actualizar tarea: {message}",
				fileMissing: "No se pudo encontrar el archivo de tarea: {path}",
				openNoteFailure: "Error al abrir nota de tarea",
				archiveSuccess: "Tarea {action} exitosamente",
				archiveFailure: "Error al archivar tarea",
			},
			archiveAction: {
				archived: "archivada",
				unarchived: "desarchivada",
			},
		},
		storageLocation: {
			title: {
				migrate: "¿Migrar datos de pomodoro?",
				switch: "¿Cambiar a almacenamiento de notas diarias?",
			},
			message: {
				migrate:
					"Esto migrará tus datos de sesión de pomodoro existentes al frontmatter de notas diarias. Los datos se agruparán por fecha y se almacenarán en cada nota diaria.",
				switch: "Los datos de sesión de pomodoro se almacenarán en el frontmatter de notas diarias en lugar del archivo de datos del plugin.",
			},
			whatThisMeans: "Lo que esto significa:",
			bullets: {
				dailyNotesRequired: "El plugin principal Daily Notes debe permanecer habilitado",
				storedInNotes: "Los datos se almacenarán en el frontmatter de tus notas diarias",
				migrateData: "Los datos del plugin existentes se migrarán y luego se borrarán",
				futureSessions: "Las sesiones futuras se guardarán en notas diarias",
				dataLongevity: "Esto proporciona mejor longevidad de datos con tus notas",
			},
			finalNote: {
				migrate:
					"⚠️ Asegúrate de tener respaldos si es necesario. Este cambio no se puede deshacer automáticamente.",
				switch: "Puedes cambiar de vuelta al almacenamiento del plugin en cualquier momento en el futuro.",
			},
			buttons: {
				migrate: "Migrar datos",
				switch: "Cambiar almacenamiento",
			},
		},
		dueDate: {
			title: "Establecer fecha de vencimiento",
			taskLabel: "Tarea: {title}",
			sections: {
				dateTime: "Fecha y hora de vencimiento",
				quickOptions: "Opciones rápidas",
			},
			descriptions: {
				dateTime: "Establecer cuándo debe completarse esta tarea",
			},
			inputs: {
				date: {
					ariaLabel: "Fecha de vencimiento para la tarea",
					placeholder: "YYYY-MM-DD",
				},
				time: {
					ariaLabel: "Hora de vencimiento para la tarea (opcional)",
					placeholder: "HH:MM",
				},
			},
			quickOptions: {
				today: "Hoy",
				todayAriaLabel: "Establecer fecha de vencimiento a hoy",
				tomorrow: "Mañana",
				tomorrowAriaLabel: "Establecer fecha de vencimiento a mañana",
				nextWeek: "Próxima semana",
				nextWeekAriaLabel: "Establecer fecha de vencimiento a la próxima semana",
				now: "Ahora",
				nowAriaLabel: "Establecer fecha y hora de vencimiento a ahora",
				clear: "Limpiar",
				clearAriaLabel: "Limpiar fecha de vencimiento",
			},
			errors: {
				invalidDateTime: "Por favor ingresa un formato de fecha y hora válido",
				updateFailed:
					"Error al actualizar fecha de vencimiento. Por favor intenta de nuevo.",
			},
		},
		scheduledDate: {
			title: "Establecer fecha programada",
			taskLabel: "Tarea: {title}",
			sections: {
				dateTime: "Fecha y hora programada",
				quickOptions: "Opciones rápidas",
			},
			descriptions: {
				dateTime: "Establecer cuándo planeas trabajar en esta tarea",
			},
			inputs: {
				date: {
					ariaLabel: "Fecha programada para la tarea",
					placeholder: "YYYY-MM-DD",
				},
				time: {
					ariaLabel: "Hora programada para la tarea (opcional)",
					placeholder: "HH:MM",
				},
			},
			quickOptions: {
				today: "Hoy",
				todayAriaLabel: "Establecer fecha programada a hoy",
				tomorrow: "Mañana",
				tomorrowAriaLabel: "Establecer fecha programada a mañana",
				nextWeek: "Próxima semana",
				nextWeekAriaLabel: "Establecer fecha programada a la próxima semana",
				now: "Ahora",
				nowAriaLabel: "Establecer fecha y hora programada a ahora",
				clear: "Limpiar",
				clearAriaLabel: "Limpiar fecha programada",
			},
			errors: {
				invalidDateTime: "Por favor ingresa un formato de fecha y hora válido",
				updateFailed: "Error al actualizar fecha programada. Por favor intenta de nuevo.",
			},
		},
	},
	contextMenus: {
		task: {
			status: "Estado",
			statusSelected: "✓ {label}",
			priority: "Prioridad",
			prioritySelected: "✓ {label}",
			dueDate: "Fecha de vencimiento",
			scheduledDate: "Fecha programada",
			reminders: "Recordatorios",
			remindBeforeDue: "Recordar antes del vencimiento…",
			remindBeforeScheduled: "Recordar antes de programado…",
			manageReminders: "Gestionar todos los recordatorios…",
			clearReminders: "Limpiar todos los recordatorios",
			startTimeTracking: "Iniciar seguimiento de tiempo",
			stopTimeTracking: "Detener seguimiento de tiempo",
			archive: "Archivar",
			unarchive: "Desarchivar",
			openNote: "Abrir nota",
			copyTitle: "Copiar título de tarea",
			noteActions: "Acciones de nota",
			rename: "Renombrar",
			renameTitle: "Renombrar archivo",
			renamePlaceholder: "Ingresar nuevo nombre",
			delete: "Eliminar",
			deleteTitle: "Eliminar archivo",
			deleteMessage: '¿Estás seguro de que quieres eliminar "{name}"?',
			deleteConfirm: "Eliminar",
			copyPath: "Copiar ruta",
			copyUrl: "Copiar URL de Obsidian",
			showInExplorer: "Mostrar en explorador de archivos",
			addToCalendar: "Agregar al calendario",
			calendar: {
				google: "Google Calendar",
				outlook: "Outlook Calendar",
				yahoo: "Yahoo Calendar",
				downloadIcs: "Descargar archivo .ics",
			},
			recurrence: "Recurrencia",
			clearRecurrence: "Limpiar recurrencia",
			customRecurrence: "Recurrencia personalizada...",
			createSubtask: "Crear subtarea",
			subtasks: {
				loading: "Cargando subtareas...",
				noSubtasks: "No se encontraron subtareas",
				loadFailed: "Error al cargar subtareas",
			},
			markComplete: "Marcar como completo para esta fecha",
			markIncomplete: "Marcar como incompleto para esta fecha",
			quickReminders: {
				atTime: "A la hora del evento",
				fiveMinutes: "5 minutos antes",
				fifteenMinutes: "15 minutos antes",
				oneHour: "1 hora antes",
				oneDay: "1 día antes",
			},
			notices: {
				toggleCompletionFailure:
					"Error al alternar finalización de tarea recurrente: {message}",
				updateDueDateFailure:
					"Error al actualizar fecha de vencimiento de tarea: {message}",
				updateScheduledFailure: "Error al actualizar fecha programada de tarea: {message}",
				updateRemindersFailure: "Error al actualizar recordatorios",
				clearRemindersFailure: "Error al limpiar recordatorios",
				addReminderFailure: "Error al agregar recordatorio",
				archiveFailure: "Error al alternar archivo de tarea: {message}",
				copyTitleSuccess: "Título de tarea copiado al portapapeles",
				copyFailure: "Error al copiar al portapapeles",
				renameSuccess: 'Renombrado a "{name}"',
				renameFailure: "Error al renombrar archivo",
				copyPathSuccess: "Ruta de archivo copiada al portapapeles",
				copyUrlSuccess: "URL de Obsidian copiada al portapapeles",
				updateRecurrenceFailure: "Error al actualizar recurrencia de tarea: {message}",
			},
		},
		ics: {
			showDetails: "Mostrar detalles",
			createTask: "Crear tarea desde evento",
			createNote: "Crear nota desde evento",
			linkNote: "Vincular nota existente",
			copyTitle: "Copiar título",
			copyLocation: "Copiar ubicación",
			copyUrl: "Copiar URL",
			copyMarkdown: "Copiar como markdown",
			subscriptionUnknown: "Calendario desconocido",
			notices: {
				copyTitleSuccess: "Título del evento copiado al portapapeles",
				copyLocationSuccess: "Ubicación copiada al portapapeles",
				copyUrlSuccess: "URL del evento copiada al portapapeles",
				copyMarkdownSuccess: "Detalles del evento copiados como markdown",
				copyFailure: "Error al copiar al portapapeles",
				taskCreated: "Tarea creada: {title}",
				taskCreateFailure: "Error al crear tarea desde evento",
				noteCreated: "Nota creada exitosamente",
				creationFailure: "Error al abrir modal de creación",
				linkSuccess: 'Nota "{name}" vinculada al evento',
				linkFailure: "Error al vincular nota",
				linkSelectionFailure: "Error al abrir selección de nota",
			},
			markdown: {
				titleFallback: "Evento sin título",
				calendar: "**Calendario:** {value}",
				date: "**Fecha y hora:** {value}",
				location: "**Ubicación:** {value}",
				descriptionHeading: "### Descripción",
				url: "**URL:** {value}",
				at: " a las {time}",
			},
		},
		date: {
			increment: {
				plusOneDay: "+1 día",
				minusOneDay: "-1 día",
				plusOneWeek: "+1 semana",
				minusOneWeek: "-1 semana",
			},
			basic: {
				today: "Hoy",
				tomorrow: "Mañana",
				thisWeekend: "Este fin de semana",
				nextWeek: "Próxima semana",
				nextMonth: "Próximo mes",
			},
			weekdaysLabel: "Días de semana",
			selected: "✓ {label}",
			pickDateTime: "Elegir fecha y hora…",
			clearDate: "Limpiar fecha",
			modal: {
				title: "Establecer fecha y hora",
				dateLabel: "Fecha",
				timeLabel: "Hora (opcional)",
				select: "Seleccionar",
			},
		},
	},
	services: {
		pomodoro: {
			notices: {
				alreadyRunning: "Un pomodoro ya está ejecutándose",
				resumeCurrentSession: "Reanudar la sesión actual en lugar de iniciar una nueva",
				timerAlreadyRunning: "Un temporizador ya está ejecutándose",
				resumeSessionInstead: "Reanudar la sesión actual en lugar de iniciar una nueva",
				shortBreakStarted: "Descanso corto iniciado",
				longBreakStarted: "Descanso largo iniciado",
				paused: "Pomodoro pausado",
				resumed: "Pomodoro reanudado",
				stoppedAndReset: "Pomodoro detenido y reiniciado",
				migrationSuccess:
					"{count} sesiones de pomodoro migradas exitosamente a notas diarias.",
				migrationFailure:
					"Error al migrar datos de pomodoro. Por favor intenta de nuevo o revisa la consola para detalles.",
			},
		},
		icsSubscription: {
			notices: {
				calendarNotFound:
					'Calendario "{name}" no encontrado (404). Por favor verifica que la URL ICS sea correcta y el calendario sea públicamente accesible.',
				calendarAccessDenied:
					'Acceso al calendario "{name}" denegado (500). Esto puede deberse a restricciones del servidor de Microsoft Outlook. Intenta regenerar la URL ICS desde la configuración de tu calendario.',
				fetchRemoteFailed: 'Error al obtener calendario remoto "{name}": {error}',
				readLocalFailed: 'Error al leer calendario local "{name}": {error}',
			},
		},
		calendarExport: {
			notices: {
				generateLinkFailed: "Error al generar enlace de calendario",
				noTasksToExport: "No se encontraron tareas para exportar",
				downloadSuccess: "Descargado {filename} con {count} tarea{plural}",
				downloadFailed: "Error al descargar archivo de calendario",
				singleDownloadSuccess: "Descargado {filename}",
			},
		},
		filter: {
			groupLabels: {
				noProject: "Sin proyecto",
				noTags: "Sin etiquetas",
				invalidDate: "Fecha inválida",
				due: {
					overdue: "Vencido",
					today: "Hoy",
					tomorrow: "Mañana",
					nextSevenDays: "Próximos siete días",
					later: "Más tarde",
					none: "Sin fecha de vencimiento",
				},
				scheduled: {
					past: "Programación pasada",
					today: "Hoy",
					tomorrow: "Mañana",
					nextSevenDays: "Próximos siete días",
					later: "Más tarde",
					none: "Sin fecha programada",
				},
			},
			errors: {
				noDatesProvided: "No se proporcionaron fechas",
			},
			folders: {
				root: "(Raíz)",
			},
		},
		instantTaskConvert: {
			notices: {
				noCheckboxTasks:
					"No se encontraron tareas de casilla de verificación en la nota actual.",
				convertingTasks: "Convirtiendo {count} tarea{plural}...",
				conversionSuccess: "✅ ¡{count} tarea{plural} convertida exitosamente a TaskNotes!",
				partialConversion:
					"{successCount} tarea{successPlural} convertida. {failureCount} fallaron.",
				batchConversionFailed:
					"Error al realizar conversión por lotes. Por favor intenta de nuevo.",
				invalidParameters: "Parámetros de entrada inválidos.",
				emptyLine: "La línea actual está vacía o no contiene contenido válido.",
				parseError: "Error al analizar tarea: {error}",
				invalidTaskData: "Datos de tarea inválidos.",
				replaceLineFailed: "Error al reemplazar línea de tarea.",
				conversionComplete: "Tarea convertida: {title}",
				conversionCompleteShortened:
					'Tarea convertida: "{title}" (nombre de archivo acortado por longitud)',
				fileExists:
					"Ya existe un archivo con este nombre. Por favor intenta de nuevo o renombra la tarea.",
				conversionFailed: "Error al convertir tarea. Por favor intenta de nuevo.",
			},
		},
		icsNote: {
			notices: {
				templateNotFound: "Plantilla no encontrada: {path}",
				templateProcessError: "Error al procesar plantilla: {template}",
				linkedToEvent: "Nota vinculada al evento ICS: {title}",
			},
		},
		task: {
			notices: {
				templateNotFound: "Plantilla del cuerpo de tarea no encontrada: {path}",
				templateReadError: "Error al leer plantilla del cuerpo de tarea: {template}",
				moveTaskFailed: "Error al mover tarea {operation}: {error}",
			},
		},
		autoExport: {
			notices: {
				exportFailed: "Auto exportación de TaskNotes falló: {error}",
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
			untitledEvent: "Evento sin título",
			allDay: "Todo el día",
			calendarEvent: "Evento de calendario",
			calendarFallback: "Calendario",
		},
		noteCard: {
			createdLabel: "Creado:",
			dailyBadge: "Diario",
			dailyTooltip: "Nota diaria",
		},
		filterHeading: {
			allViewName: "Todos",
		},
		filterBar: {
			saveView: "Guardar vista",
			saveViewNamePlaceholder: "Ingresar nombre de vista...",
			saveButton: "Guardar",
			views: "Vistas",
			savedFilterViews: "Vistas de filtro guardadas",
			filters: "Filtros",
			properties: "Propiedades",
			sort: "Ordenar",
			newTask: "Nuevo",
			expandAllGroups: "Expandir todos los grupos",
			collapseAllGroups: "Contraer todos los grupos",
			searchTasksPlaceholder: "Buscar tareas...",
			searchTasksTooltip: "Buscar títulos de tareas",
			filterUnavailable: "Barra de filtros temporalmente no disponible",
			toggleFilter: "Alternar filtro",
			activeFiltersTooltip:
				"Filtros activos – Clic para modificar, clic derecho para limpiar",
			configureVisibleProperties: "Configurar propiedades visibles",
			sortAndGroupOptions: "Opciones de ordenamiento y agrupación",
			sortMenuHeader: "Ordenar",
			orderMenuHeader: "Orden",
			groupMenuHeader: "Agrupar",
			createNewTask: "Crear nueva tarea",
			filter: "Filtro",
			displayOrganization: "Visualización y organización",
			viewOptions: "Opciones de vista",
			addFilter: "Agregar filtro",
			addFilterGroup: "Agregar grupo de filtros",
			addFilterTooltip: "Agregar una nueva condición de filtro",
			addFilterGroupTooltip: "Agregar un grupo de filtros anidado",
			clearAllFilters: "Limpiar todos los filtros y grupos",
			saveCurrentFilter: "Guardar filtro actual como vista",
			closeFilterModal: "Cerrar modal de filtro",
			deleteFilterGroup: "Eliminar grupo de filtros",
			deleteCondition: "Eliminar condición",
			all: "Todos",
			any: "Cualquiera",
			followingAreTrue: "de los siguientes son verdaderos:",
			where: "donde",
			selectProperty: "Seleccionar...",
			chooseProperty: "Elegir por qué propiedad de tarea filtrar",
			chooseOperator: "Elegir cómo comparar el valor de la propiedad",
			enterValue: "Ingresar el valor por el cual filtrar",
			selectValue: "Seleccionar un {property} por el cual filtrar",
			sortBy: "Ordenar por:",
			toggleSortDirection: "Alternar dirección de ordenamiento",
			chooseSortMethod: "Elegir cómo ordenar tareas",
			groupBy: "Agrupar por:",
			chooseGroupMethod: "Agrupar tareas por una propiedad común",
			toggleViewOption: "Alternar {option}",
			expandCollapseFilters: "Clic para expandir/contraer condiciones de filtro",
			expandCollapseSort: "Clic para expandir/contraer opciones de ordenamiento y agrupación",
			expandCollapseViewOptions: "Clic para expandir/contraer opciones específicas de vista",
			naturalLanguageDates: "Fechas en lenguaje natural",
			naturalLanguageExamples: "Mostrar ejemplos de fechas en lenguaje natural",
			enterNumericValue: "Ingresar un valor numérico por el cual filtrar",
			enterDateValue: "Ingresar una fecha usando lenguaje natural o formato ISO",
			pickDateTime: "Elegir fecha y hora",
			noSavedViews: "No hay vistas guardadas",
			savedViews: "Vistas guardadas",
			yourSavedFilters: "Tus configuraciones de filtro guardadas",
			dragToReorder: "Arrastrar para reordenar vistas",
			loadSavedView: "Cargar vista guardada: {name}",
			deleteView: "Eliminar vista",
			deleteViewTitle: "Eliminar vista",
			deleteViewMessage: '¿Estás seguro de que quieres eliminar la vista "{name}"?',
			manageAllReminders: "Gestionar todos los recordatorios...",
			clearAllReminders: "Limpiar todos los recordatorios",
			customRecurrence: "Recurrencia personalizada...",
			clearRecurrence: "Limpiar recurrencia",
			sortOptions: {
				dueDate: "Fecha de vencimiento",
				scheduledDate: "Fecha programada",
				priority: "Prioridad",
				title: "Título",
				createdDate: "Fecha de creación",
				tags: "Etiquetas",
				ascending: "Ascendente",
				descending: "Descendente",
			},
			group: {
				none: "Ninguno",
				status: "Estado",
				priority: "Prioridad",
				context: "Contexto",
				project: "Proyecto",
				dueDate: "Fecha de vencimiento",
				scheduledDate: "Fecha programada",
				tags: "Etiquetas",
			},
			notices: {
				propertiesMenuFailed: "Error al mostrar menú de propiedades",
			},
		},
	},
	components: {
		propertyVisibilityDropdown: {
			coreProperties: "PROPIEDADES PRINCIPALES",
			organization: "ORGANIZACIÓN",
			customProperties: "PROPIEDADES PERSONALIZADAS",
			failed: "Error al mostrar menú de propiedades",
			properties: {
				statusDot: "Punto de estado",
				priorityDot: "Punto de prioridad",
				dueDate: "Fecha de vencimiento",
				scheduledDate: "Fecha programada",
				timeEstimate: "Estimación de tiempo",
				totalTrackedTime: "Tiempo total rastreado",
				recurrence: "Recurrencia",
				completedDate: "Fecha de finalización",
				createdDate: "Fecha de creación",
				modifiedDate: "Fecha de modificación",
				projects: "Proyectos",
				contexts: "Contextos",
				tags: "Etiquetas",
			},
		},
		reminderContextMenu: {
			remindBeforeDue: "Recordar antes del vencimiento...",
			remindBeforeScheduled: "Recordar antes de programado...",
			manageAllReminders: "Gestionar todos los recordatorios...",
			clearAllReminders: "Limpiar todos los recordatorios",
			quickReminders: {
				atTime: "A la hora del evento",
				fiveMinutesBefore: "5 minutos antes",
				fifteenMinutesBefore: "15 minutos antes",
				oneHourBefore: "1 hora antes",
				oneDayBefore: "1 día antes",
			},
		},
		recurrenceContextMenu: {
			daily: "Diario",
			weeklyOn: "Semanal en {day}",
			everyTwoWeeksOn: "Cada 2 semanas en {day}",
			monthlyOnThe: "Mensual en el {ordinal}",
			everyThreeMonthsOnThe: "Cada 3 meses en el {ordinal}",
			yearlyOn: "Anual en {month} {ordinal}",
			weekdaysOnly: "Solo días de semana",
			customRecurrence: "Recurrencia personalizada...",
			clearRecurrence: "Limpiar recurrencia",
			customRecurrenceModal: {
				title: "Recurrencia personalizada",
				startDate: "Fecha de inicio",
				startDateDesc: "La fecha cuando comienza el patrón de recurrencia",
				startTime: "Hora de inicio",
				startTimeDesc:
					"La hora cuando deben aparecer las instancias recurrentes (opcional)",
				frequency: "Frecuencia",
				interval: "Intervalo",
				intervalDesc: "Cada X días/semanas/meses/años",
				daysOfWeek: "Días de la semana",
				daysOfWeekDesc: "Seleccionar días específicos (para recurrencia semanal)",
				monthlyRecurrence: "Recurrencia mensual",
				monthlyRecurrenceDesc: "Elegir cómo repetir mensualmente",
				yearlyRecurrence: "Recurrencia anual",
				yearlyRecurrenceDesc: "Elegir cómo repetir anualmente",
				endCondition: "Condición de fin",
				endConditionDesc: "Elegir cuándo debe terminar la recurrencia",
				neverEnds: "Nunca termina",
				endAfterOccurrences: "Terminar después de {count} ocurrencias",
				endOnDate: "Terminar en {date}",
				onDayOfMonth: "En el día {day} de cada mes",
				onTheWeekOfMonth: "En el {week} {day} de cada mes",
				onDateOfYear: "En {month} {day} cada año",
				onTheWeekOfYear: "En el {week} {day} de {month} cada año",
				frequencies: {
					daily: "Diario",
					weekly: "Semanal",
					monthly: "Mensual",
					yearly: "Anual",
				},
				weekPositions: {
					first: "primer",
					second: "segundo",
					third: "tercer",
					fourth: "cuarto",
					last: "último",
				},
				weekdays: {
					monday: "Lunes",
					tuesday: "Martes",
					wednesday: "Miércoles",
					thursday: "Jueves",
					friday: "Viernes",
					saturday: "Sábado",
					sunday: "Domingo",
				},
				weekdaysShort: {
					mon: "Lun",
					tue: "Mar",
					wed: "Mié",
					thu: "Jue",
					fri: "Vie",
					sat: "Sáb",
					sun: "Dom",
				},
				cancel: "Cancelar",
				save: "Guardar",
			},
		},
	},
};

export type EsTranslationSchema = typeof es;
