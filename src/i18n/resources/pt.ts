import { TranslationTree } from "../types";

export const pt: TranslationTree = {
	common: {
		appName: "TaskNotes",
		new: "Novo",
		cancel: "Cancelar",
		confirm: "Confirmar",
		close: "Fechar",
		save: "Salvar",
		language: "Idioma",
		systemDefault: "Padrão do sistema",
		loading: "Carregando...",
		languages: {
			en: "Inglês",
			fr: "Francês",
			ru: "Russo",
			zh: "Chinês",
			de: "Alemão",
			es: "Espanhol",
			ja: "Japonês",
            pt: "Português (Brasil)"
		},
		weekdays: {
			sunday: "Domingo",
			monday: "Segunda-feira",
			tuesday: "Terça-feira",
			wednesday: "Quarta-feira",
			thursday: "Quinta-feira",
			friday: "Sexta-feira",
			saturday: "Sábado"
		},
		months: {
			january: "Janeiro",
			february: "Fevereiro",
			march: "Março",
			april: "Abril",
			may: "Maio",
			june: "Junho",
			july: "Julho",
			august: "Agosto",
			september: "Setembro",
			october: "Outubro",
			november: "Novembro",
			december: "Dezembro"
		}
	},
	views: {
		agenda: {
			title: "Agenda",
			today: "Hoje",
			overdue: "Atrasadas",
			refreshCalendars: "Atualizar calendários",
			actions: {
				previousPeriod: "Período anterior",
				nextPeriod: "Próximo período",
				goToToday: "Ir para hoje",
				refreshCalendars: "Atualizar inscrições de calendário"
			},
			loading: "Carregando agenda...",
			dayToggle: "Alternar dia",
			overdueToggle: "Alternar seção de atrasadas",
			expandAllDays: "Expandir Todos os Dias",
			collapseAllDays: "Recolher Todos os Dias",
			notices: {
				calendarNotReady: "Serviço de calendário ainda não está pronto",
				calendarRefreshed: "Inscrições de calendário atualizadas",
				refreshFailed: "Falha ao atualizar"
			},
			empty: {
				noItemsScheduled: "Nenhum item agendado",
				noItemsFound: "Nenhum item encontrado",
				helpText: "Crie tarefas com datas de vencimento ou agendadas, ou adicione notas para vê-las aqui."
			},
			contextMenu: {
				showOverdueSection: "Mostrar seção de atrasadas",
				showNotes: "Mostrar notas",
				calendarSubscriptions: "Inscrições de calendário"
			},
			periods: {
				thisWeek: "Esta semana"
			},
			tipPrefix: "Dica: "
		},
		taskList: {
			title: "Tarefas",
			expandAllGroups: "Expandir Todos os Grupos",
			collapseAllGroups: "Recolher Todos os Grupos",
			noTasksFound: "Nenhuma tarefa encontrada para os filtros selecionados."
		},
		notes: {
			title: "Notas",
			refreshButton: "Atualizar",
			refreshingButton: "Atualizando...",
			notices: {
				indexingDisabled: "Indexação de notas desativada"
			},
			empty: {
				noNotesFound: "Nenhuma nota encontrada",
				helpText: "Nenhuma nota encontrada para a data selecionada. Tente selecionar uma data diferente no Mini Calendário ou crie algumas notas."
			},
			loading: "Carregando notas...",
			refreshButtonAriaLabel: "Atualizar lista de notas"
		},
		miniCalendar: {
			title: "Mini Calendário"
		},
		advancedCalendar: {
			title: "Calendário",
			filters: {
				showFilters: "Mostrar filtros",
				hideFilters: "Ocultar filtros"
			},
			viewOptions: {
				calendarSubscriptions: "Inscrições de calendário",
				timeEntries: "Registros de tempo",
				timeblocks: "Blocos de tempo",
				scheduledDates: "Datas agendadas",
				dueDates: "Datas de vencimento",
				allDaySlot: "Slot de dia inteiro",
				scheduledTasks: "Tarefas agendadas",
				recurringTasks: "Tarefas recorrentes"
			},
			buttons: {
				refresh: "Atualizar",
				refreshHint: "Atualizar Inscrições de Calendário"
			},
			notices: {
				icsServiceNotAvailable: "Serviço de inscrição ICS não disponível",
				calendarRefreshedAll: "Todas as inscrições de calendário atualizadas com sucesso",
				refreshFailed: "Falha ao atualizar algumas inscrições de calendário",
				timeblockSpecificTime: "Blocos de tempo devem ter horários específicos. Por favor, selecione um intervalo de tempo na visualização de semana ou dia.",
				timeblockMoved: 'Bloco de tempo "{title}" movido para {date}',
				timeblockUpdated: 'Tempo do bloco de tempo "{title}" atualizado',
				timeblockMoveFailed: "Falha ao mover bloco de tempo: {message}",
				timeblockResized: 'Duração do bloco de tempo "{title}" atualizada',
				timeblockResizeFailed: "Falha ao redimensionar bloco de tempo: {message}",
				taskScheduled: 'Tarefa "{title}" agendada para {date}',
				scheduleTaskFailed: "Falha ao agendar tarefa",
				endTimeAfterStart: "A hora de término deve ser posterior à hora de início",
				timeEntryNotFound: "Registro de tempo não encontrado",
				timeEntryDeleted: "Registro de tempo excluído",
				deleteTimeEntryFailed: "Falha ao excluir registro de tempo"
			},
			timeEntry: {
				estimatedSuffix: "estimado",
				trackedSuffix: "rastreado",
				recurringPrefix: "Recorrente: ",
				completedPrefix: "Concluído: ",
				createdPrefix: "Criado: ",
				modifiedPrefix: "Modificado: ",
				duePrefix: "Vencimento: ",
				scheduledPrefix: "Agendado: "
			},
			contextMenus: {
				openTask: "Abrir tarefa",
				deleteTimeEntry: "Excluir registro de tempo",
				deleteTimeEntryTitle: "Excluir Registro de Tempo",
				deleteTimeEntryConfirm: "Tem certeza de que deseja excluir este registro de tempo{duration}? Esta ação não pode ser desfeita.",
				deleteButton: "Excluir",
				cancelButton: "Cancelar"
			}
		},
		basesCalendar: {
			title: "Calendário de Bases",
			today: "Hoje",
			buttonText: {
				month: "M",
				week: "S",
				day: "D",
				year: "A",
				list: "L",
				customDays: "{count}D",
				listDays: "Lista {count}d",
				refresh: "Atualizar"
			},
			hints: {
				refresh: "Atualizar inscrições de calendário"
			},
			settings: {
		header: {
			documentation: "Documentation",
			documentationUrl: "https://tasknotes.dev",
		},
				groups: {
					dateNavigation: "Navegação de Data",
					events: "Eventos",
					layout: "Layout",
					propertyBasedEvents: "Eventos baseados em propriedade",
					calendarSubscriptions: "Inscrições de calendário",
					googleCalendars: "Google Calendars",
					microsoftCalendars: "Microsoft Calendars"
				},
				dateNavigation: {
					navigateToDate: "Navegar para data",
					navigateToDatePlaceholder: "AAAA-MM-DD (ex: 2025-01-15) - deixe em branco para usar propriedade",
					navigateToDateFromProperty: "Navegar para data da propriedade",
					navigateToDateFromPropertyPlaceholder: "Selecione uma propriedade de data (opcional)",
					propertyNavigationStrategy: "Estratégia de navegação da propriedade",
					strategies: {
						first: "Primeiro resultado",
						earliest: "Data mais antiga",
						latest: "Data mais recente"
					}
				},
				events: {
					showScheduledTasks: "Mostrar tarefas agendadas",
					showDueTasks: "Mostrar tarefas com vencimento",
					showRecurringTasks: "Mostrar tarefas recorrentes",
					showTimeEntries: "Mostrar registros de tempo",
					showTimeblocks: "Mostrar blocos de tempo",
					showPropertyBasedEvents: "Mostrar eventos baseados em propriedade"
				},
				layout: {
					calendarView: "Visualização do calendário",
					customDayCount: "Contagem de dias personalizados",
					listDayCount: "Contagem de dias da lista",
					dayStartTime: "Hora de início do dia",
					dayStartTimePlaceholder: "HH:mm:ss (ex: 08:00:00)",
					dayEndTime: "Hora de término do dia",
					dayEndTimePlaceholder: "HH:mm:ss (ex: 20:00:00)",
					timeSlotDuration: "Duração do slot de tempo",
					timeSlotDurationPlaceholder: "HH:mm:ss (ex: 00:30:00)",
					weekStartsOn: "A semana começa em",
					showWeekNumbers: "Mostrar números da semana",
					showNowIndicator: "Mostrar indicador 'agora'",
					showWeekends: "Mostrar fins de semana",
					showAllDaySlot: "Mostrar slot de dia inteiro",
					showTodayHighlight: "Mostrar destaque de hoje",
					showSelectionPreview: "Mostrar pré-visualização da seleção",
					timeFormat: "Formato da hora",
					timeFormat12: "12 horas (AM/PM)",
					timeFormat24: "24 horas",
					initialScrollTime: "Hora inicial de rolagem",
					initialScrollTimePlaceholder: "HH:mm:ss (ex: 08:00:00)",
					minimumEventHeight: "Altura mínima do evento (px)",
					slotEventOverlap: "Permitir sobreposição de eventos",
					enableSearch: "Habilitar caixa de pesquisa",
					eventMaxStack: "Máx. eventos empilhados (vista semana/dia, 0 = ilimitado)",
					dayMaxEvents: "Máx. eventos por dia (vista mês, 0 = automático)",
					dayMaxEventRows: "Máx. linhas de eventos por dia (vista mês, 0 = ilimitado)"
				},
				propertyBasedEvents: {
					startDateProperty: "Propriedade da data de início",
					startDatePropertyPlaceholder: "Selecione a propriedade para data/hora de início",
					endDateProperty: "Propriedade da data de término (opcional)",
					endDatePropertyPlaceholder: "Selecione a propriedade para data/hora de término",
					titleProperty: "Propriedade do título (opcional)",
					titlePropertyPlaceholder: "Selecione a propriedade para o título do evento"
				}
			},
			errors: {
				failedToInitialize: "Falha ao inicializar o calendário"
			}
		},
		kanban: {
			title: "Kanban",
			newTask: "Nova tarefa",
			addCard: "+ Adicionar um cartão",
			noTasks: "Sem tarefas",
			uncategorized: "Sem categoria",
			noProject: "Sem Projeto",
			notices: {
				loadFailed: "Falha ao carregar o quadro Kanban",
				movedTask: 'Tarefa movida para "{0}"'
			},
			errors: {
				loadingBoard: "Erro ao carregar o quadro.",
				noGroupBy: "A vista Kanban requer que uma propriedade 'Agrupar por' seja configurada. Clique no botão 'Ordenar' e selecione uma propriedade em 'Agrupar por'."
			},
			columnTitle: "Sem título"
		},
		pomodoro: {
			title: "Pomodoro",
			status: {
				focus: "Foco",
				ready: "Pronto para começar",
				paused: "Pausado",
				working: "Trabalhando",
				shortBreak: "Pausa curta",
				longBreak: "Pausa longa",
				breakPrompt: "Ótimo trabalho! Hora de uma pausa {length}",
				breakLength: {
					short: "curta",
					long: "longa"
				},
				breakComplete: "Pausa concluída! Pronto para o próximo pomodoro?"
			},
			buttons: {
				start: "Iniciar",
				pause: "Pausar",
				stop: "Parar",
				resume: "Retomar",
				startShortBreak: "Iniciar Pausa Curta",
				startLongBreak: "Iniciar Pausa Longa",
				skipBreak: "Pular pausa",
				chooseTask: "Escolher tarefa...",
				changeTask: "Alterar tarefa...",
				clearTask: "Limpar tarefa",
				selectDifferentTask: "Selecionar uma tarefa diferente"
			},
			notices: {
				noTasks: "Nenhuma tarefa não arquivada encontrada. Crie algumas tarefas primeiro.",
				loadFailed: "Falha ao carregar tarefas"
			},
			statsLabel: "concluídos hoje"
		},
		pomodoroStats: {
			title: "Estatísticas Pomodoro",
			heading: "Estatísticas Pomodoro",
			refresh: "Atualizar",
			sections: {
				overview: "Visão Geral",
				today: "Hoje",
				week: "Esta semana",
				allTime: "Todo o período",
				recent: "Sessões recentes"
			},
			overviewCards: {
				todayPomos: {
					label: "Pomos de Hoje",
					change: {
						more: "{count} a mais que ontem",
						less: "{count} a menos que ontem"
					}
				},
				totalPomos: {
					label: "Total de Pomos"
				},
				todayFocus: {
					label: "Foco de Hoje",
					change: {
						more: "{duration} a mais que ontem",
						less: "{duration} a menos que ontem"
					}
				},
				totalFocus: {
					label: "Duração Total de Foco"
				}
			},
			stats: {
				pomodoros: "Pomodoros",
				streak: "Sequência",
				minutes: "Minutos",
				average: "Duração média",
				completion: "Conclusão"
			},
			recents: {
				empty: "Nenhuma sessão registrada ainda",
				duration: "{minutes} min",
				status: {
					completed: "Concluído",
					interrupted: "Interrompido"
				}
			}
		},
		stats: {
			title: "Estatísticas",
			taskProjectStats: "Estatísticas de Tarefas e Projetos",
			sections: {
				filters: "Filtros",
				overview: "Visão Geral",
				today: "Hoje",
				thisWeek: "Esta Semana",
				thisMonth: "Este Mês",
				projectBreakdown: "Detalhamento por Projeto",
				dateRange: "Intervalo de Datas"
			},
			filters: {
				minTime: "Tempo mín. (minutos)",
				allTasks: "Todas as Tarefas",
				activeOnly: "Somente Ativas",
				completedOnly: "Somente Concluídas"
			},
			refreshButton: "Atualizar",
			timeRanges: {
				allTime: "Todo o período",
				last7Days: "Últimos 7 dias",
				last30Days: "Últimos 30 dias",
				last90Days: "Últimos 90 dias",
				customRange: "Intervalo Personalizado"
			},
			resetFiltersButton: "Redefinir Filtros",
			dateRangeFrom: "De",
			dateRangeTo: "Até",
			noProject: "Sem Projeto",
			cards: {
				timeTrackedEstimated: "Tempo Rastreado / Estimado",
				totalTasks: "Total de Tarefas",
				completionRate: "Taxa de Conclusão",
				activeProjects: "Projetos Ativos",
				avgTimePerTask: "Tempo Médio por Tarefa"
			},
			labels: {
				tasks: "Tarefas",
				completed: "Concluídas",
				projects: "Projetos"
			},
			noProjectData: "Nenhum dado de projeto disponível",
			notAvailable: "N/D",
			noTasks: "Nenhuma tarefa encontrada",
			loading: "Carregando..."
		},
		releaseNotes: {
			title: "O que há de novo no TaskNotes {version}",
			header: "O que há de novo no TaskNotes {version}",
			viewAllLink: "Ver todas as notas de lançamento no GitHub →",
			starMessage: "Se você acha o TaskNotes útil, por favor, considere dar uma estrela no GitHub"
		}
	},
	settings: {
		header: {
			documentation: "Documentation",
			documentationUrl: "https://tasknotes.dev",
		},
		tabs: {
			general: "Geral",
			taskProperties: "Propriedades da Tarefa",
			modalFields: "Campos do Modal",
			defaults: "Padrões e Modelos",
			appearance: "Aparência e UI",
			features: "Recursos",
			integrations: "Integrações"
		},
		features: {
			inlineTasks: {
				header: "Tarefas Embutidas",
				description: "Configurações para links de tarefas e conversão de caixas de seleção em tarefas nas notas."
			},
			overlays: {
				taskLinkToggle: {
					name: "Sobreposição de link de tarefa",
					description: "Mostrar sobreposições interativas ao passar o mouse sobre links de tarefas"
				}
			},
			instantConvert: {
				toggle: {
					name: "Mostrar botão de conversão ao lado de caixas de seleção",
					description: "Exibir um botão embutido ao lado de caixas de seleção Markdown que as converte para TaskNotes"
				},
				folder: {
					name: "Pasta para tarefas convertidas",
					description: "Pasta onde tarefas convertidas de caixas de seleção serão criadas. Deixe vazio para usar a pasta de tarefas padrão. Use {{currentNotePath}} para a pasta da nota atual, ou {{currentNoteTitle}} para uma subpasta com o título da nota."
				}
			},
			nlp: {
				header: "Processamento de Linguagem Natural",
				description: "Analisa datas, prioridades e outras propriedades do texto inserido.",
				enable: {
					name: "Habilitar entrada de tarefa em linguagem natural",
					description: "Analisar datas de vencimento, prioridades e contextos da linguagem natural ao criar tarefas"
				},
				defaultToScheduled: {
					name: "Padrão para agendado",
					description: "Quando a NLP detectar uma data sem contexto, tratá-la como agendada em vez de vencimento"
				},
				language: {
					name: "Idioma da NLP",
					description: "Idioma para padrões de processamento de linguagem natural e análise de datas"
				},
				statusTrigger: {
					name: "Gatilho de sugestão de status",
					description: "Texto para acionar sugestões de status (deixe em branco para desativar)"
				}
			},
			pomodoro: {
				header: "Temporizador Pomodoro",
				description: "Configure intervalos de trabalho/pausa para o temporizador Pomodoro.",
				workDuration: {
					name: "Duração do trabalho",
					description: "Duração dos intervalos de trabalho em minutos"
				},
				shortBreak: {
					name: "Duração da pausa curta",
					description: "Duração das pausas curtas em minutos"
				},
				longBreak: {
					name: "Duração da pausa longa",
					description: "Duração das pausas longas em minutos"
				},
				longBreakInterval: {
					name: "Intervalo da pausa longa",
					description: "Número de sessões de trabalho antes de uma pausa longa"
				},
				autoStartBreaks: {
					name: "Iniciar pausas automaticamente",
					description: "Iniciar automaticamente os temporizadores de pausa após as sessões de trabalho"
				},
				autoStartWork: {
					name: "Iniciar trabalho automaticamente",
					description: "Iniciar automaticamente as sessões de trabalho após as pausas"
				},
				notifications: {
					name: "Notificações Pomodoro",
					description: "Mostrar notificações quando as sessões Pomodoro terminarem"
				}
			},
			uiLanguage: {
				header: "Idioma da Interface",
				description: "Altere o idioma dos menus, avisos e visualizações do TaskNotes.",
				dropdown: {
					name: "Idioma da UI",
					description: "Selecione o idioma usado para o texto da interface do TaskNotes"
				}
			},
			pomodoroSound: {
				enabledName: "Som ativado",
				enabledDesc: "Tocar som quando as sessões Pomodoro terminarem",
				volumeName: "Volume do som",
				volumeDesc: "Volume para sons Pomodoro (0-100)"
			},
			dataStorage: {
				name: "Armazenamento de dados Pomodoro",
				description: "Configure onde os dados da sessão pomodoro são armazenados e como são gerenciados.",
				dailyNotes: "Notas diárias",
				pluginData: "Dados do plugin",
				notices: {
					locationChanged: "Local de armazenamento Pomodoro alterado para {location}"
				}
			},
			notifications: {
				header: "Notificações",
				description: "Configure notificações de lembrete de tarefas e alertas.",
				enableName: "Ativar notificações",
				enableDesc: "Ativar notificações de lembrete de tarefas",
				typeName: "Tipo de notificação",
				typeDesc: "Tipo de notificações a serem mostradas",
				systemLabel: "Notificações do sistema",
				inAppLabel: "Notificações no aplicativo"
			},
			overdue: {
				hideCompletedName: "Ocultar tarefas concluídas das atrasadas",
				hideCompletedDesc: "Excluir tarefas concluídas dos cálculos de tarefas atrasadas"
			},
			indexing: {
				disableName: "Desativar indexação de notas",
				disableDesc: "Desativar indexação automática do conteúdo das notas para melhor desempenho"
			},
			suggestions: {
				debounceName: "Debounce de sugestão",
				debounceDesc: "Atraso em milissegundos antes de mostrar sugestões"
			},
			timeTracking: {
				autoStopName: "Parar registro de tempo automaticamente",
				autoStopDesc: "Parar automaticamente o registro de tempo quando uma tarefa é marcada como concluída",
				stopNotificationName: "Notificação de parada de registro de tempo",
				stopNotificationDesc:
					"Mostrar notificação quando o registro de tempo é parado automaticamente",
			},
			stopNotificationName: "Notificação de parada de registro de tempo",
			stopNotificationDesc: "Mostrar notificação quando o registro de tempo é parado automaticamente",
			recurring: {
				maintainOffsetName: "Manter deslocamento da data de vencimento em tarefas recorrentes",
				maintainOffsetDesc: "Manter o deslocamento entre a data de vencimento e a data agendada quando tarefas recorrentes são concluídas"
			},
			timeblocking: {
				header: "Bloco de Tempo",
				description: "Configure a funcionalidade de bloco de tempo para agendamento leve em notas diárias. Arraste nas visualizações de calendário para criar eventos - selecione 'Bloco de Tempo' no menu de contexto.",
				enableName: "Ativar bloco de tempo",
				enableDesc: "Ativar recurso de bloco de tempo para agendamento leve em notas diárias. Quando ativado, a opção 'Bloco de Tempo' aparece no menu de contexto de arrastar do calendário.",
				showBlocksName: "Mostrar blocos de tempo",
				showBlocksDesc: "Exibir blocos de tempo de notas diárias por padrão",
				usage: "Uso: Arraste no calendário para criar eventos. Selecione 'Bloco de Tempo' no menu de contexto (visível apenas quando o bloco de tempo está ativado). Arraste para mover blocos de tempo existentes. Redimensione as bordas para ajustar a duração."
			},
			performance: {
				header: "Desempenho e Comportamento",
				description: "Configure opções de desempenho e comportamento do plugin."
			},
			timeTrackingSection: {
				header: "Registro de Tempo",
				description: "Configure comportamentos automáticos de registro de tempo."
			},
			recurringSection: {
				header: "Tarefas Recorrentes",
				description: "Configure o comportamento para gerenciamento de tarefas recorrentes."
			}
		},
		defaults: {
			header: {
				basicDefaults: "Padrões Básicos",
				dateDefaults: "Padrões de Data",
				defaultReminders: "Lembretes padrão",
				bodyTemplate: "Modelo de Corpo",
				instantTaskConversion: "Conversão Instantânea de Tarefa"
			},
			description: {
				basicDefaults: "Defina valores padrão para novas tarefas para acelerar a criação de tarefas.",
				dateDefaults: "Defina datas de vencimento e agendadas padrão para novas tarefas.",
				defaultReminders: "Configure lembretes padrão que serão adicionados a novas tarefas.",
				bodyTemplate: "Configure um arquivo de modelo para usar no conteúdo de novas tarefas.",
				instantTaskConversion: "Configure o comportamento ao converter texto para tarefas instantaneamente."
			},
			basicDefaults: {
				defaultStatus: {
					name: "Status padrão",
					description: "Status padrão para novas tarefas"
				},
				defaultPriority: {
					name: "Prioridade padrão",
					description: "Prioridade padrão para novas tarefas"
				},
				defaultContexts: {
					name: "Contextos padrão",
					description: "Lista de contextos padrão separados por vírgula (ex: @casa, @trabalho)",
					placeholder: "@casa, @trabalho"
				},
				defaultTags: {
					name: "Tags padrão",
					description: "Lista de tags padrão separadas por vírgula (sem #)",
					placeholder: "importante, urgente"
				},
				defaultProjects: {
					name: "Projetos padrão",
					description: "Links de projetos padrão para novas tarefas",
					selectButton: "Selecionar Projetos",
					selectTooltip: "Escolher notas de projeto para vincular por padrão",
					removeTooltip: "Remover {name} dos projetos padrão"
				},
				useParentNoteAsProject: {
					name: "Usar nota pai como projeto durante a conversão instantânea",
					description: "Vincular automaticamente a nota pai como um projeto ao usar a conversão instantânea de tarefa"
				},
				defaultTimeEstimate: {
					name: "Estimativa de tempo padrão",
					description: "Estimativa de tempo padrão em minutos (0 = sem padrão)",
					placeholder: "60"
				},
				defaultRecurrence: {
					name: "Recorrência padrão",
					description: "Padrão de recorrência padrão para novas tarefas"
				}
			},
			dateDefaults: {
				defaultDueDate: {
					name: "Data de vencimento padrão",
					description: "Data de vencimento padrão para novas tarefas"
				},
				defaultScheduledDate: {
					name: "Data agendada padrão",
					description: "Data agendada padrão para novas tarefas"
				}
			},
			reminders: {
				addReminder: {
					name: "Adicionar lembrete padrão",
					description: "Criar um novo lembrete padrão que será adicionado a todas as novas tarefas",
					buttonText: "Adicionar lembrete"
				},
				emptyState: "Nenhum lembrete padrão configurado. Adicione um lembrete para notificá-lo automaticamente sobre novas tarefas.",
				emptyStateButton: "Adicionar Lembrete",
				reminderDescription: "Descrição do lembrete",
				unnamedReminder: "Lembrete Sem Nome",
				deleteTooltip: "Excluir lembrete",
				fields: {
					description: "Descrição:",
					type: "Tipo:",
					offset: "Deslocamento:",
					unit: "Unidade:",
					direction: "Direção:",
					relatedTo: "Relacionado a:",
					date: "Data:",
					time: "Hora:"
				},
				types: {
					relative: "Relativo (antes/depois das datas da tarefa)",
					absolute: "Absoluto (data/hora específica)"
				},
				units: {
					minutes: "minutos",
					hours: "horas",
					days: "dias"
				},
				directions: {
					before: "antes",
					after: "depois"
				},
				relatedTo: {
					due: "data de vencimento",
					scheduled: "data agendada"
				}
			},
			bodyTemplate: {
				useBodyTemplate: {
					name: "Usar modelo de corpo",
					description: "Usar um arquivo de modelo para o conteúdo do corpo da tarefa"
				},
				bodyTemplateFile: {
					name: "Arquivo de modelo de corpo",
					description: "Caminho para o arquivo de modelo para o conteúdo do corpo da tarefa. Suporta variáveis de modelo como {{title}}, {{date}}, {{time}}, {{priority}}, {{status}}, etc.",
					placeholder: "Modelos/Modelo de Tarefa.md",
					ariaLabel: "Caminho para o arquivo de modelo de corpo"
				},
				variablesHeader: "Variáveis de modelo:",
				variables: {
					title: "{{title}} - Título da tarefa",
					details: "{{details}} - Detalhes fornecidos pelo usuário no modal",
					date: "{{date}} - Data atual (AAAA-MM-DD)",
					time: "{{time}} - Hora atual (HH:MM)",
					priority: "{{priority}} - Prioridade da tarefa",
					status: "{{status}} - Status da tarefa",
					contexts: "{{contexts}} - Contextos da tarefa",
					tags: "{{tags}} - Tags da tarefa",
					projects: "{{projects}} - Projetos da tarefa"
				}
			},
			instantConversion: {
				useDefaultsOnInstantConvert: {
					name: "Usar padrões de tarefa na conversão instantânea",
					description: "Aplicar configurações padrão de tarefa ao converter texto para tarefas instantaneamente"
				}
			},
			options: {
				noDefault: "Sem padrão",
				none: "Nenhum",
				today: "Hoje",
				tomorrow: "Amanhã",
				nextWeek: "Próxima semana",
				daily: "Diariamente",
				weekly: "Semanalmente",
				monthly: "Mensalmente",
				yearly: "Anualmente"
			}
		},
		general: {
			taskStorage: {
				header: "Armazenamento de Tarefas",
				description: "Configure onde as tarefas são armazenadas e como são identificadas.",
				defaultFolder: {
					name: "Pasta padrão de tarefas",
					description: "Local padrão para novas tarefas"
				},
				moveArchived: {
					name: "Mover tarefas arquivadas para pasta",
					description: "Mover automaticamente tarefas arquivadas para uma pasta de arquivo"
				},
				archiveFolder: {
					name: "Pasta de arquivo",
					description: "Pasta para onde mover tarefas quando arquivadas. Suporta variáveis de modelo como {{year}}, {{month}}, {{priority}}, etc."
				}
			},
			taskIdentification: {
				header: "Identificação de Tarefa",
				description: "Escolha como o TaskNotes identifica notas como tarefas.",
				identifyBy: {
					name: "Identificar tarefas por",
					description: "Escolha se deseja identificar tarefas por tag ou por uma propriedade do frontmatter",
					options: {
						tag: "Tag",
						property: "Propriedade"
					}
				},
				taskTag: {
					name: "Tag da tarefa",
					description: "Tag que identifica notas como tarefas (sem #)"
				},
				hideIdentifyingTags: {
					name: "Ocultar tags de identificação nos cartões de tarefa",
					description: "Quando ativado, tags correspondentes à tag de identificação da tarefa (incluindo correspondências hierárquicas como 'tarefa/projeto') serão ocultadas das exibições do cartão de tarefa"
				},
				taskProperty: {
					name: "Nome da propriedade da tarefa",
					description: 'O nome da propriedade do frontmatter (ex: "categoria")'
				},
				taskPropertyValue: {
					name: "Valor da propriedade da tarefa",
					description: 'O valor que identifica uma nota como uma tarefa (ex: "tarefa")'
				}
			},
			folderManagement: {
				header: "Gerenciamento de Pastas",
				excludedFolders: {
					name: "Pastas excluídas",
					description: "Lista de pastas separadas por vírgula para excluir da indexação de tarefas e sugestões de projetos"
				}
			},
			frontmatter: {
				header: "Frontmatter",
				description: "Configure como os links são formatados nas propriedades do frontmatter.",
				useMarkdownLinks: {
					name: "Usar links markdown no frontmatter",
					description: "Gerar links markdown ([texto](caminho)) em vez de wikilinks ([[link]]) nas propriedades do frontmatter.\n\n⚠️ Requer o plugin 'obsidian-frontmatter-markdown-links' para funcionar corretamente."
				}
			},
			taskInteraction: {
				header: "Interação com Tarefas",
				description: "Configure o comportamento ao clicar em tarefas.",
				singleClick: {
					name: "Ação de clique único",
					description: "Ação realizada ao clicar uma vez em um cartão de tarefa"
				},
				doubleClick: {
					name: "Ação de clique duplo",
					description: "Ação realizada ao clicar duas vezes em um cartão de tarefa"
				},
				actions: {
					edit: "Editar tarefa",
					openNote: "Abrir nota",
					none: "Nenhuma ação"
				}
			},
			releaseNotes: {
				header: "Notas de Lançamento",
				description: "Versão atual: {version}",
				showOnUpdate: {
					name: "Mostrar notas de lançamento após atualização",
					description: "Abrir automaticamente as notas de lançamento quando o TaskNotes for atualizado para uma nova versão"
				},
				viewButton: {
					name: "Ver notas de lançamento",
					description: "Veja o que há de novo na versão mais recente do TaskNotes",
					buttonText: "Ver notas de lançamento"
				}
			}
		},
		taskProperties: {
			// Section headers for property card layout
			sections: {
				coreProperties: "Propriedades Principais",
				corePropertiesDesc: "Status e prioridade são as propriedades principais que definem o estado e importância de uma tarefa.",
				dateProperties: "Propriedades de Data",
				datePropertiesDesc: "Configure quando as tarefas vencem e estão agendadas.",
				organizationProperties: "Propriedades de Organização",
				organizationPropertiesDesc: "Organize tarefas com contextos, projetos e tags.",
				taskDetails: "Detalhes da Tarefa",
				taskDetailsDesc: "Detalhes adicionais como estimativas de tempo, recorrência e lembretes.",
				metadataProperties: "Propriedades de Metadados",
				metadataPropertiesDesc: "Propriedades gerenciadas pelo sistema para rastrear o histórico de tarefas.",
				featureProperties: "Propriedades de Recursos",
				featurePropertiesDesc: "Propriedades usadas por recursos específicos do TaskNotes como temporizador Pomodoro e sincronização de calendário.",
			},
			// Property card common fields
			propertyCard: {
				propertyKey: "Chave da propriedade:",
				default: "Padrão:",
				nlpTrigger: "Gatilho NLP:",
				triggerChar: "Caractere gatilho:",
				triggerEmpty: "O gatilho não pode estar vazio",
				triggerTooLong: "O gatilho é muito longo (máx. 10 caracteres)",
			},
			// Individual property names and descriptions
			properties: {
				status: {
					name: "Status",
					description:
						"Rastreia o estado atual de uma tarefa (ex.: a fazer, em progresso, concluído). O status determina se uma tarefa aparece como concluída e pode acionar o arquivamento automático.",
				},
				priority: {
					name: "Prioridade",
					description:
						"Indica a importância da tarefa. Usado para ordenação e filtragem. Os valores são ordenados alfabeticamente nas visualizações Bases, então use prefixos como 1-, 2- para controlar a ordem.",
				},
				due: {
					name: "Data de Vencimento",
					description:
						"O prazo até o qual uma tarefa deve ser concluída. Tarefas após a data de vencimento aparecem como atrasadas. Armazenado como data no frontmatter.",
				},
				scheduled: {
					name: "Data Agendada",
					description:
						"Quando você planeja trabalhar em uma tarefa. Diferente da data de vencimento, isso representa seu horário de início pretendido. As tarefas aparecem no calendário na data/hora agendada.",
				},
				contexts: {
					name: "Contextos",
					description:
						"Locais ou condições onde uma tarefa pode ser feita (ex.: @casa, @escritório, @telefone). Útil para filtrar tarefas pela sua situação atual. Armazenado como lista.",
				},
				projects: {
					name: "Projetos",
					description:
						"Links para notas de projeto às quais esta tarefa pertence. Armazenado como wikilinks (ex.: [[Nome do Projeto]]). As tarefas podem pertencer a múltiplos projetos.",
				},
				tags: {
					name: "Tags",
					description:
						"Tags nativas do Obsidian para categorizar tarefas. São armazenadas na propriedade tags do frontmatter e funcionam com os recursos de tags do Obsidian.",
				},
				timeEstimate: {
					name: "Estimativa de Tempo",
					description:
						"Minutos estimados para concluir a tarefa. Usado para planejamento de tempo e carga de trabalho. Exibido em cartões de tarefas e eventos do calendário.",
				},
				recurrence: {
					name: "Recorrência",
					description:
						"Padrão para tarefas repetitivas (diário, semanal, mensal, anual ou RRULE personalizado). Quando uma tarefa recorrente é concluída, sua data agendada é automaticamente atualizada para a próxima ocorrência.",
				},
				recurrenceAnchor: {
					name: "Âncora de recorrência",
					description:
						"Controla como a próxima ocorrência é calculada: 'scheduled' usa a data agendada, 'completion' usa a data de conclusão real.",
				},
				reminders: {
					name: "Lembretes",
					description:
						"Notificações acionadas antes das datas de vencimento ou agendadas. Armazenado como lista de objetos de lembrete com horário e descrição opcional.",
				},
				title: {
					name: "Título",
					description:
						"O nome da tarefa. Pode ser armazenado no frontmatter ou no nome do arquivo (quando 'Armazenar título no nome do arquivo' está habilitado).",
				},
				dateCreated: {
					name: "Data de Criação",
					description:
						"Timestamp de quando a tarefa foi criada. Definido automaticamente e usado para ordenação por ordem de criação.",
				},
				dateModified: {
					name: "Data de Modificação",
					description:
						"Timestamp da última alteração na tarefa. Atualizado automaticamente quando qualquer propriedade da tarefa muda.",
				},
				completedDate: {
					name: "Data de Conclusão",
					description:
						"Timestamp de quando a tarefa foi marcada como concluída. Definido automaticamente quando o status muda para um estado concluído.",
				},
				archiveTag: {
					name: "Tag de Arquivo",
					description:
						"Tag adicionada às tarefas quando arquivadas. Usada para identificar tarefas arquivadas e pode acionar a movimentação de arquivos para a pasta de arquivo.",
				},
				timeEntries: {
					name: "Entradas de Tempo",
					description:
						"Registros de sessões de rastreamento de tempo para esta tarefa. Cada entrada armazena timestamps de início e fim. Usado para calcular o tempo total gasto.",
				},
				completeInstances: {
					name: "Instâncias Concluídas",
					description:
						"Histórico de conclusão para tarefas recorrentes. Armazena as datas em que cada instância foi concluída para evitar conclusões duplicadas.",
				},
				skippedInstances: {
					name: "Instâncias Puladas",
					description:
						"Ocorrências puladas para tarefas recorrentes. Armazena as datas de instâncias que foram puladas em vez de concluídas.",
				},
				blockedBy: {
					name: "Bloqueada Por",
					description:
						"Links para tarefas que devem ser concluídas antes desta. Armazenado como wikilinks. Tarefas bloqueadas exibem um indicador visual.",
				},
				pomodoros: {
					name: "Pomodoros",
					description:
						"Contagem de sessões Pomodoro concluídas. Quando o armazenamento de dados está configurado para 'Notas diárias', isso é escrito nas notas diárias em vez dos arquivos de tarefa.",
				},
				icsEventId: {
					name: "ID do Evento ICS",
					description:
						"Identificador único vinculando uma nota a um evento de calendário ICS. Adicionado automaticamente ao criar notas a partir de eventos de calendário.",
				},
				icsEventTag: {
					name: "Tag de Evento ICS",
					description:
						"Tag identificando notas criadas a partir de eventos de calendário ICS. Usada para distinguir notas geradas pelo calendário de tarefas regulares.",
				},
			},
			// Card-specific labels
			statusCard: {
				valuesHeader: "Valores de Status",
			},
			priorityCard: {
				valuesHeader: "Valores de Prioridade",
			},
			projectsCard: {
				defaultProjects: "Projetos padrão:",
				useParentNote: "Usar nota pai como projeto:",
				noDefaultProjects: "Nenhum projeto padrão selecionado",
				autosuggestFilters: "Filtros de Autosugestão",
				customizeDisplay: "Personalizar Exibição",
				filtersOn: "Filtros Ativos",
			},
			titleCard: {
				storeTitleInFilename: "Armazenar título no nome do arquivo:",
				storedInFilename: "Armazenado no nome do arquivo",
				filenameUpdatesWithTitle: "O nome do arquivo será atualizado automaticamente quando o título da tarefa mudar.",
				filenameFormat: "Formato do nome do arquivo:",
				customTemplate: "Modelo personalizado:",
			},
			tagsCard: {
				nativeObsidianTags: "Usa tags nativas do Obsidian",
			},
			remindersCard: {
				defaultReminders: "Lembretes Padrão",
			},
			taskStatuses: {
				header: "Status da Tarefa",
				description: "Personalize as opções de status disponíveis para suas tarefas. Esses status controlam o ciclo de vida da tarefa e determinam quando as tarefas são consideradas concluídas.",
				howTheyWork: {
					title: "Como os status funcionam:",
					value: 'Valor: O identificador interno armazenado em seus arquivos de tarefa (ex: "em-progresso")',
					label: 'Rótulo: O nome de exibição mostrado na interface (ex: "Em Progresso")',
					color: "Cor: Cor do indicador visual para o ponto de status e emblemas",
					icon: 'Ícone: Nome de ícone Lucide opcional para exibir em vez do ponto colorido (ex: "check", "circle", "clock"). Navegue pelos ícones em lucide.dev',
					completed: "Concluído: Quando marcado, tarefas com este status são consideradas finalizadas e podem ser filtradas de forma diferente",
					autoArchive: "Arquivar automaticamente: Quando ativado, as tarefas serão automaticamente arquivadas após o atraso especificado (1-1440 minutos)",
					orderNote: "A ordem abaixo determina a sequência ao alternar entre os status clicando nos emblemas de status da tarefa."
				},
				addNew: {
					name: "Adicionar novo status",
					description: "Criar uma nova opção de status para suas tarefas",
					buttonText: "Adicionar status"
				},
				validationNote: 'Nota: Você deve ter pelo menos 2 status, e pelo menos um status deve ser marcado como "Concluído".',
				emptyState: "Nenhum status personalizado configurado. Adicione um status para começar.",
				emptyStateButton: "Adicionar Status",
				fields: {
					value: "Valor:",
					label: "Rótulo:",
					color: "Cor:",
					icon: "Ícone:",
					completed: "Concluído:",
					autoArchive: "Arquivar auto.:",
					delayMinutes: "Atraso (minutos):"
				},
				placeholders: {
					value: "em-progresso",
					label: "Em Progresso",
					icon: "check, circle, clock"
				},
				badges: {
					completed: "Concluído"
				},
				deleteConfirm: 'Tem certeza de que deseja excluir o status "{label}"?'
			},
			taskPriorities: {
				header: "Prioridades da Tarefa",
				description:
					"Personalize os níveis de prioridade disponíveis para suas tarefas. Na v4.0+, as prioridades são ordenadas alfabeticamente pelo seu valor nas visualizações de Bases.",
				howTheyWork: {
					title: "Como as prioridades funcionam:",
					value:
						'Valor: O identificador interno armazenado em seus arquivos de tarefa. Use prefixos como "1-urgente", "2-alta" para controlar a ordem de classificação nas visualizações de Bases.',
					label: 'Rótulo de Exibição: O nome de exibição mostrado na interface (ex: "Prioridade Alta")',
					color: "Cor: Cor do indicador visual para o ponto de prioridade e emblemas",
					weight: "Peso: Valor numérico para classificação (pesos maiores aparecem primeiro nas listas)",
					weightNote: "As tarefas são automaticamente classificadas pelo peso da prioridade em ordem decrescente (maior peso primeiro). Os pesos podem ser qualquer número positivo."
				},
				addNew: {
					name: "Adicionar nova prioridade",
					description: "Criar um novo nível de prioridade para suas tarefas",
					buttonText: "Adicionar prioridade"
				},
				validationNote:
					"Nota: Você deve ter pelo menos 1 prioridade. As prioridades são ordenadas alfabeticamente por valor nas visualizações de Bases.",
				emptyState: "Nenhuma prioridade personalizada configurada. Adicione uma prioridade para começar.",
				emptyStateButton: "Adicionar Prioridade",
				fields: {
					value: "Valor:",
					label: "Rótulo:",
					color: "Cor:",
					weight: "Peso:"
				},
				placeholders: {
					value: "alta",
					label: "Prioridade Alta"
				},
				weightLabel: "Peso: {weight}",
				deleteConfirm: "Você deve ter pelo menos uma prioridade",
				deleteTooltip: "Excluir prioridade"
			},
			fieldMapping: {
				header: "Mapeamento de Campos",
				warning: "⚠️ Aviso: O TaskNotes lerá E escreverá usando esses nomes de propriedade. Alterá-los após criar tarefas pode causar inconsistências.",
				description: "Configure quais propriedades do frontmatter o TaskNotes deve usar para cada campo.",
				resetButton: {
					name: "Redefinir mapeamentos de campos",
					description: "Redefinir todos os mapeamentos de campos para os valores padrão",
					buttonText: "Redefinir para Padrões"
				},
				notices: {
					resetSuccess: "Mapeamentos de campos redefinidos para os padrões",
					resetFailure: "Falha ao redefinir mapeamentos de campos",
					updateFailure: "Falha ao atualizar o mapeamento de campo para {label}. Por favor, tente novamente."
				},
				table: {
					fieldHeader: "Campo do TaskNotes",
					propertyHeader: "Seu nome de propriedade"
				},
				fields: {
					title: "Título",
					status: "Status",
					priority: "Prioridade",
					due: "Data de vencimento",
					scheduled: "Data agendada",
					contexts: "Contextos",
					projects: "Projetos",
					timeEstimate: "Estimativa de tempo",
					recurrence: "Recorrência",
					dateCreated: "Data de criação",
					completedDate: "Data de conclusão",
					dateModified: "Data de modificação",
					archiveTag: "Tag de arquivamento",
					timeEntries: "Registros de tempo",
					completeInstances: "Instâncias concluídas",
					blockedBy: "Bloqueada por",
					pomodoros: "Pomodoros",
					icsEventId: "ID do Evento ICS",
					icsEventTag: "Tag do Evento ICS",
					reminders: "Lembretes"
				}
			},
			customUserFields: {
				header: "Campos de Usuário Personalizados",
				description: "Defina propriedades de frontmatter personalizadas para aparecerem como opções de filtro com reconhecimento de tipo nas visualizações. Cada linha: Nome de Exibição, Nome da Propriedade, Tipo.",
				addNew: {
					name: "Adicionar novo campo de usuário",
					description: "Criar um novo campo personalizado que aparecerá em filtros e visualizações",
					buttonText: "Adicionar campo de usuário"
				},
				emptyState: "Nenhum campo de usuário personalizado configurado. Adicione um campo para criar propriedades personalizadas para suas tarefas.",
				emptyStateButton: "Adicionar Campo de Usuário",
				fields: {
					displayName: "Nome de Exibição:",
					propertyKey: "Chave da Propriedade:",
					type: "Tipo:",
					defaultValue: "Valor Padrão:"
				},
				placeholders: {
					displayName: "Nome de Exibição",
					propertyKey: "nome-da-propriedade",
					defaultValue: "Valor padrão",
					defaultValueList: "Valores padrão (separados por vírgula)"
				},
				types: {
					text: "Texto",
					number: "Número",
					boolean: "Booleano",
					date: "Data",
					list: "Lista"
				},
				defaultNames: {
					unnamedField: "Campo Sem Nome",
					noKey: "sem-chave"
				},
				deleteTooltip: "Excluir campo",
				autosuggestFilters: {
					header: "Filtros de autossugestão (Avançado)",
					description: "Filtre quais arquivos aparecem nas sugestões de preenchimento automático para este campo"
				}
			}
		},
		appearance: {
			taskCards: {
				header: "Cartões de Tarefa",
				description: "Configure como os cartões de tarefa são exibidos em todas as visualizações.",
				defaultVisibleProperties: {
					name: "Propriedades visíveis padrão",
					description: "Escolha quais propriedades aparecem nos cartões de tarefa por padrão."
				},
				propertyGroups: {
					coreProperties: "PROPRIEDADES PRINCIPAIS",
					organization: "ORGANIZAÇÃO",
					customProperties: "PROPRIEDADES PERSONALIZADAS"
				},
				properties: {
					status: "Ponto de Status",
					priority: "Ponto de Prioridade",
					due: "Data de Vencimento",
					scheduled: "Data Agendada",
					timeEstimate: "Estimativa de Tempo",
					totalTrackedTime: "Tempo Total Registrado",
					recurrence: "Recorrência",
					completedDate: "Data de Conclusão",
					createdDate: "Data de Criação",
					modifiedDate: "Data de Modificação",
					projects: "Projetos",
					contexts: "Contextos",
					tags: "Tags",
					blocked: "Bloqueada",
					blocking: "Bloqueando"
				}
			},
			taskFilenames: {
				header: "Nomes de Arquivo de Tarefa",
				description: "Configure como os arquivos de tarefa são nomeados quando criados.",
				storeTitleInFilename: {
					name: "Armazenar título no nome do arquivo",
					description: "Usar o título da tarefa como nome do arquivo. O nome do arquivo será atualizado quando o título da tarefa for alterado (Recomendado)."
				},
				filenameFormat: {
					name: "Formato do nome do arquivo",
					description: "Como os nomes dos arquivos de tarefa devem ser gerados",
					options: {
						title: "Título da tarefa (Não atualiza)",
						zettel: "Formato Zettelkasten (AAMMDD + segundos base36 desde a meia-noite)",
						timestamp: "Timestamp completo (AAAA-MM-DD-HHMMSS)",
						custom: "Modelo personalizado"
					}
				},
				customTemplate: {
					name: "Modelo de nome de arquivo personalizado",
					description: "Modelo para nomes de arquivo personalizados. Variáveis disponíveis: {title}, {titleLower}, {titleUpper}, {titleSnake}, {titleKebab}, {titleCamel}, {titlePascal}, {date}, {shortDate}, {time}, {time12}, {time24}, {timestamp}, {dateTime}, {year}, {month}, {monthName}, {monthNameShort}, {day}, {dayName}, {dayNameShort}, {hour}, {hour12}, {minute}, {second}, {milliseconds}, {ms}, {ampm}, {week}, {quarter}, {unix}, {unixMs}, {timezone}, {timezoneShort}, {utcOffset}, {utcOffsetShort}, {utcZ}, {zettel}, {nano}, {priority}, {priorityShort}, {status}, {statusShort}, {dueDate}, {scheduledDate}",
					placeholder: "{date}-{title}-{dueDate}",
					helpText: "Nota: {dueDate} e {scheduledDate} estão no formato AAAA-MM-DD e estarão vazios se não forem definidos."
				}
			},
			displayFormatting: {
				header: "Formatação de Exibição",
				description: "Configure como datas, horas e outros dados são exibidos em todo o plugin.",
				timeFormat: {
					name: "Formato da hora",
					description: "Exibir hora no formato de 12 horas ou 24 horas em todo o plugin",
					options: {
						twelveHour: "12 horas (AM/PM)",
						twentyFourHour: "24 horas"
					}
				}
			},
			calendarView: {
				header: "Visualização de Calendário",
				description: "Personalize a aparência e o comportamento da visualização de calendário.",
				defaultView: {
					name: "Visualização padrão",
					description: "A visualização de calendário mostrada ao abrir a aba de calendário",
					options: {
						monthGrid: "Grade Mensal",
						weekTimeline: "Linha do Tempo Semanal",
						dayTimeline: "Linha do Tempo Diária",
						yearView: "Visualização Anual",
						customMultiDay: "Vários Dias Personalizado"
					}
				},
				customDayCount: {
					name: "Contagem de dias da visualização personalizada",
					description: "Número de dias para mostrar na visualização personalizada de vários dias",
					placeholder: "3"
				},
				firstDayOfWeek: {
					name: "Primeiro dia da semana",
					description: "Qual dia deve ser a primeira coluna nas visualizações de semana"
				},
				showWeekends: {
					name: "Mostrar fins de semana",
					description: "Exibir fins de semana nas visualizações de calendário"
				},
				showWeekNumbers: {
					name: "Mostrar números da semana",
					description: "Exibir números da semana nas visualizações de calendário"
				},
				showTodayHighlight: {
					name: "Mostrar destaque de hoje",
					description: "Destacar o dia atual nas visualizações de calendário"
				},
				showCurrentTimeIndicator: {
					name: "Mostrar indicador de hora atual",
					description: "Exibir uma linha mostrando a hora atual nas visualizações de linha do tempo"
				},
				selectionMirror: {
					name: "Espelho de seleção",
					description: "Mostrar uma pré-visualização visual ao arrastar para selecionar intervalos de tempo"
				},
				calendarLocale: {
					name: "Localidade do calendário",
					description: 'Localidade do calendário para formatação de data e sistema de calendário (ex: "pt-br", "en", "fa" para Farsi/Persa, "de" para Alemão). Deixe em branco para detectar automaticamente do navegador.',
					placeholder: "Autodetectar",
					invalidLocale: "Localidade inválida. Por favor, insira um código de idioma válido (ex: 'pt-BR', 'en', 'fr-FR')."
				}
			},
			defaultEventVisibility: {
				header: "Visibilidade Padrão de Eventos",
				description: "Configure quais tipos de eventos são visíveis por padrão ao abrir o Calendário. Os usuários ainda podem ativá-los/desativá-los na visualização de calendário.",
				showScheduledTasks: {
					name: "Mostrar tarefas agendadas",
					description: "Exibir tarefas com datas agendadas por padrão"
				},
				showDueDates: {
					name: "Mostrar datas de vencimento",
					description: "Exibir datas de vencimento de tarefas por padrão"
				},
				showDueWhenScheduled: {
					name: "Mostrar datas de vencimento quando agendadas",
					description: "Exibir datas de vencimento mesmo para tarefas que já têm datas agendadas"
				},
				showTimeEntries: {
					name: "Mostrar registros de tempo",
					description: "Exibir entradas de registro de tempo concluídas por padrão"
				},
				showRecurringTasks: {
					name: "Mostrar tarefas recorrentes",
					description: "Exibir instâncias de tarefas recorrentes por padrão"
				},
				showICSEvents: {
					name: "Mostrar eventos ICS",
					description: "Exibir eventos de inscrições ICS por padrão"
				}
			},
			timeSettings: {
				header: "Configurações de Hora",
				description: "Configure as configurações de exibição relacionadas ao tempo para visualizações de linha do tempo.",
				timeSlotDuration: {
					name: "Duração do slot de tempo",
					description: "Duração de cada slot de tempo nas visualizações de linha do tempo",
					options: {
						fifteenMinutes: "15 minutos",
						thirtyMinutes: "30 minutos",
						sixtyMinutes: "60 minutos"
					}
				},
				startTime: {
					name: "Hora de início",
					description: "Hora mais cedo mostrada nas visualizações de linha do tempo (formato HH:MM)",
					placeholder: "06:00"
				},
				endTime: {
					name: "Hora de término",
					description: "Hora mais tarde mostrada nas visualizações de linha do tempo (formato HH:MM)",
					placeholder: "22:00"
				},
				initialScrollTime: {
					name: "Hora inicial de rolagem",
					description: "Hora para rolar ao abrir visualizações de linha do tempo (formato HH:MM)",
					placeholder: "09:00"
				},
				eventMinHeight: {
					name: "Altura mínima do evento",
					description: "Altura mínima para eventos em visualizações de linha do tempo (pixels)",
					placeholder: "15"
				}
			},
			uiElements: {
				header: "Elementos da UI",
				description: "Configure a exibição de vários elementos da UI.",
				showTrackedTasksInStatusBar: {
					name: "Mostrar tarefas rastreadas na barra de status",
					description: "Exibir tarefas atualmente rastreadas na barra de status do Obsidian"
				},
				showProjectSubtasksWidget: {
					name: "Mostrar widget de subtarefas do projeto",
					description: "Exibir um widget mostrando subtarefas para a nota do projeto atual"
				},
				projectSubtasksPosition: {
					name: "Posição das subtarefas do projeto",
					description: "Onde posicionar o widget de subtarefas do projeto",
					options: {
						top: "Topo da nota",
						bottom: "Fundo da nota"
					}
				},
				showRelationshipsWidget: {
					name: "Mostrar widget de relacionamentos",
					description: "Exibir um widget mostrando todos os relacionamentos da nota atual (subtarefas, projetos, dependências)",
				},
				relationshipsPosition: {
					name: "Posição dos relacionamentos",
					description: "Onde posicionar o widget de relacionamentos",
					options: {
						top: "Topo da nota",
						bottom: "Final da nota",
					},
				},
				showTaskCardInNote: {
					name: "Mostrar cartão de tarefa na nota",
					description: "Exibir um widget de cartão de tarefa no topo das notas de tarefa mostrando os detalhes da tarefa e ações"
				},
				showExpandableSubtasks: {
					name: "Mostrar subtarefas expansíveis",
					description: "Permitir expandir/recolher seções de subtarefas nos cartões de tarefa"
				},
				subtaskChevronPosition: {
					name: "Posição do chevron de subtarefa",
					description: "Posição dos chevrons de expandir/recolher nos cartões de tarefa",
					options: {
						left: "Lado esquerdo",
						right: "Lado direito"
					}
				},
				viewsButtonAlignment: {
					name: "Alinhamento do botão de visualizações",
					description: "Alinhamento do botão de visualizações/filtros na interface de tarefas",
					options: {
						left: "Lado esquerdo",
						right: "Lado direito"
					}
				}
			},
			projectAutosuggest: {
				header: "Autossugestão de Projeto",
				description: "Personalize como as sugestões de projeto são exibidas durante a criação da tarefa.",
				requiredTags: {
					name: "Tags obrigatórias",
					description: "Mostrar apenas notas com qualquer uma destas tags (separadas por vírgula). Deixe em branco para mostrar todas as notas.",
					placeholder: "projeto, ativo, importante"
				},
				includeFolders: {
					name: "Incluir pastas",
					description: "Mostrar apenas notas nestas pastas (caminhos separados por vírgula). Deixe em branco para mostrar todas as pastas.",
					placeholder: "Projetos/, Trabalho/Ativo, Pessoal"
				},
				requiredPropertyKey: {
					name: "Chave de propriedade obrigatória",
					description: "Mostrar apenas notas onde esta propriedade do frontmatter corresponde ao valor abaixo. Deixe em branco para ignorar.",
					placeholder: "tipo"
				},
				requiredPropertyValue: {
					name: "Valor da propriedade obrigatória",
					description: "Apenas notas onde a propriedade é igual a este valor são sugeridas. Deixe em branco para exigir que a propriedade exista.",
					placeholder: "projeto"
				},
				customizeDisplay: {
					name: "Personalizar exibição de sugestão",
					description: "Mostrar opções avançadas para configurar como as sugestões de projeto aparecem e quais informações elas exibem."
				},
				enableFuzzyMatching: {
					name: "Ativar correspondência difusa (fuzzy matching)",
					description: "Permitir erros de digitação e correspondências parciais na busca de projetos. Pode ser mais lento em cofres grandes."
				},
				displayRowsHelp: "Configure até 3 linhas de informação para mostrar para cada sugestão de projeto.",
				displayRows: {
					row1: {
						name: "Linha 1",
						description: "Formato: {propriedade|flags}. Propriedades: title, aliases, file.path, file.parent. Flags: n(Rótulo) mostra rótulo, s torna pesquisável. Exemplo: {title|n(Título)|s}",
						placeholder: "{title|n(Título)}"
					},
					row2: {
						name: "Linha 2 (opcional)",
						description: "Padrões comuns: {aliases|n(Apelidos)}, {file.parent|n(Pasta)}, literal:Texto Personalizado",
						placeholder: "{aliases|n(Apelidos)}"
					},
					row3: {
						name: "Linha 3 (opcional)",
						description: "Informações adicionais como {file.path|n(Caminho)} ou campos de frontmatter personalizados",
						placeholder: "{file.path|n(Caminho)}"
					}
				},
				quickReference: {
					header: "Referência Rápida",
					properties: "Propriedades disponíveis: title, aliases, file.path, file.parent, ou qualquer campo do frontmatter",
					labels: "Adicionar rótulos: {title|n(Título)} → \"Título: Meu Projeto\"",
					searchable: "Tornar pesquisável: {description|s} inclui descrição na busca +",
					staticText: "Texto estático: literal:Meu Rótulo Personalizado",
					alwaysSearchable: "Nome do arquivo, título e apelidos são sempre pesquisáveis por padrão."
				}
			},
			dataStorage: {
				name: "Local de Armazenamento",
				description: "Onde armazenar o histórico de sessões Pomodoro",
				pluginData: "Dados do plugin (recomendado)",
				dailyNotes: "Notas Diárias",
				notices: {
					locationChanged: "Local de armazenamento Pomodoro alterado para {location}"
				}
			},
			notifications: {
				description: "Configure notificações de lembrete de tarefas e alertas."
			},
			performance: {
				description: "Configure opções de desempenho e comportamento do plugin."
			},
			timeTrackingSection: {
				description: "Configure comportamentos automáticos de registro de tempo."
			},
			recurringSection: {
				description: "Configure o comportamento para gerenciamento de tarefas recorrentes."
			}
		},
		integrations: {
			basesIntegration: {
				header: "Integração com Bases",
				description: "Configure a integração com o plugin Obsidian Bases. Este é um recurso experimental e atualmente depende de APIs não documentadas do Obsidian. O comportamento pode mudar ou quebrar.",
				enable: {
					name: "Ativar integração com Bases",
					description: "Permitir que as visualizações do TaskNotes sejam usadas dentro do plugin Obsidian Bases. O plugin Bases deve estar ativado para que isso funcione."
				},
				viewCommands: {
					header: "Visualizações e arquivos base",
					description: "O TaskNotes usa arquivos do Obsidian Bases (.base) para suas visualizações. Esses arquivos são gerados automaticamente na inicialização se não existirem, configurados com suas definições atuais (identificação de tarefas, mapeamento de campos, status, etc.).",
					descriptionRegen: "Os arquivos base não são atualizados automaticamente quando você altera as configurações. Para aplicar novas configurações, exclua os arquivos .base existentes e reinicie o Obsidian, use \"Criar arquivos\" abaixo ou edite-os manualmente.",
					docsLink: "Ver documentação para fórmulas disponíveis e opções de personalização",
					docsLinkUrl: "https://tasknotes.dev/views/default-base-templates",
					commands: {
						miniCalendar: "Abrir visualização de mini calendário",
						kanban: "Abrir visualização kanban",
						tasks: "Abrir visualização de tarefas",
						advancedCalendar: "Abrir visualização de calendário avançado",
						agenda: "Abrir visualização de agenda",
						relationships: "Widget de relacionamentos"
					},
					fileLabel: "Arquivo: {path}",
					resetButton: "Redefinir",
					resetTooltip: "Redefinir para caminho padrão"
				},
				createDefaultFiles: {
					name: "Criar arquivos padrão",
					description: "Crie os arquivos .base padrão no diretório TaskNotes/Views/. Os arquivos existentes não serão sobrescritos.",
					buttonText: "Criar arquivos"
				},
				exportV3Views: {
					name: "Exportar visualizações salvas V3 para Bases",
					description: "Converta todas as suas visualizações salvas do TaskNotes v3 em um único arquivo .base com múltiplas visualizações. Isso ajuda a migrar suas configurações de filtro v3 para o novo sistema de Bases.",
					buttonText: "Exportar visualizações V3",
					noViews: "Nenhuma visualização salva para exportar",
					fileExists: "O arquivo já existe",
					confirmOverwrite: 'Um arquivo chamado "{fileName}" já existe. Sobrescrever?',
					success: "Exportadas {count} visualizações salvas para {filePath}",
					error: "Falha ao exportar visualizações: {message}"
				},
				notices: {
					enabled: "Integração com Bases ativada. Por favor, reinicie o Obsidian para completar a configuração.",
					disabled: "Integração com Bases desativada. Por favor, reinicie o Obsidian para completar a remoção."
				}
			},
			calendarSubscriptions: {
				header: "Inscrições de calendário",
				description: "Inscreva-se em calendários externos via URLs ICS/iCal para ver eventos ao lado de suas tarefas.",
				defaultNoteTemplate: {
					name: "Modelo de nota padrão",
					description: "Caminho para o arquivo de modelo para notas criadas a partir de eventos ICS",
					placeholder: "Modelos/Modelo de Evento.md"
				},
				defaultNoteFolder: {
					name: "Pasta de notas padrão",
					description: "Pasta para notas criadas a partir de eventos ICS",
					placeholder: "Calendário/Eventos"
				},
				filenameFormat: {
					name: "Formato de nome de arquivo da nota ICS",
					description: "Como os nomes dos arquivos são gerados para notas criadas a partir de eventos ICS",
					options: {
						title: "Título do evento",
						zettel: "Formato Zettelkasten",
						timestamp: "Timestamp",
						custom: "Modelo personalizado"
					}
				},
				customTemplate: {
					name: "Modelo de nome de arquivo ICS personalizado",
					description: "Modelo para nomes de arquivo de eventos ICS personalizados",
					placeholder: "{date}-{title}"
				}
			},
			subscriptionsList: {
				header: "Lista de inscrições de calendário",
				addSubscription: {
					name: "Adicionar Inscrição de Calendário",
					description: "Adicionar uma nova inscrição de calendário de URL ICS/iCal ou arquivo local",
					buttonText: "Adicionar Inscrição"
				},
				refreshAll: {
					name: "Atualizar todas as inscrições",
					description: "Atualizar manualmente todas as inscrições de calendário ativadas",
					buttonText: "Atualizar Todas"
				},
				newCalendarName: "Novo Calendário",
				emptyState: "Nenhuma inscrição de calendário configurada. Adicione uma inscrição para sincronizar calendários externos.",
				notices: {
					addSuccess: "Nova inscrição de calendário adicionada - por favor, configure os detalhes",
					addFailure: "Falha ao adicionar inscrição",
					serviceUnavailable: "Serviço de inscrição ICS não disponível",
					refreshSuccess: "Todas as inscrições de calendário atualizadas com sucesso",
					refreshFailure: "Falha ao atualizar algumas inscrições de calendário",
					updateFailure: "Falha ao atualizar inscrição",
					deleteSuccess: 'Inscrição "{name}" excluída',
					deleteFailure: "Falha ao excluir inscrição",
					enableFirst: "Ative a inscrição primeiro",
					refreshSubscriptionSuccess: '"{name}" atualizado',
					refreshSubscriptionFailure: "Falha ao atualizar inscrição"
				},
				labels: {
					enabled: "Ativado:",
					name: "Nome:",
					type: "Tipo:",
					url: "URL:",
					filePath: "Caminho do Arquivo:",
					color: "Cor:",
					refreshMinutes: "Atualizar (min):"
				},
				typeOptions: {
					remote: "URL Remota",
					local: "Arquivo Local"
				},
				placeholders: {
					calendarName: "Nome do calendário",
					url: "URL ICS/iCal",
					filePath: "Caminho do arquivo local (ex: Calendario.ics)",
					localFile: "Calendario.ics"
				},
				statusLabels: {
					enabled: "Ativado",
					disabled: "Desativado",
					remote: "Remoto",
					localFile: "Arquivo Local",
					remoteCalendar: "Calendário Remoto",
					localFileCalendar: "Arquivo Local",
					synced: "Sincronizado {timeAgo}",
					error: "Erro"
				},
				actions: {
					refreshNow: "Atualizar Agora",
					deleteSubscription: "Excluir inscrição"
				},
				refreshNow: "Atualizar Agora",
				confirmDelete: {
					title: "Excluir Inscrição",
					message: 'Tem certeza de que deseja excluir a inscrição "{name}"? Esta ação não pode ser desfeita.',
					confirmText: "Excluir"
				}
			},
			autoExport: {
				header: "Exportação automática de ICS",
				description: "Exportar automaticamente todas as suas tarefas para um arquivo ICS.",
				enable: {
					name: "Ativar exportação automática",
					description: "Manter automaticamente um arquivo ICS atualizado com todas as suas tarefas"
				},
				filePath: {
					name: "Caminho do arquivo de exportação",
					description: "Caminho onde o arquivo ICS será salvo (relativo à raiz do cofre)",
					placeholder: "tasknotes-calendar.ics"
				},
				interval: {
					name: "Intervalo de atualização (entre 5 e 1440 minutos)",
					description: "Com que frequência atualizar o arquivo de exportação",
					placeholder: "60"
				},
				exportNow: {
					name: "Exportar agora",
					description: "Acionar manualmente uma exportação imediata",
					buttonText: "Exportar Agora"
				},
				status: {
					title: "Status da Exportação:",
					lastExport: "Última exportação: {time}",
					nextExport: "Próxima exportação: {time}",
					noExports: "Nenhuma exportação ainda",
					notScheduled: "Não agendado",
					notInitialized: "Serviço de exportação automática não inicializado - por favor, reinicie o Obsidian",
					serviceNotInitialized: "Serviço não inicializado - por favor, reinicie o Obsidian"
				},
				notices: {
					reloadRequired: "Por favor, recarregue o Obsidian para que as alterações da exportação automática tenham efeito.",
					exportSuccess: "Tarefas exportadas com sucesso",
					exportFailure: "Exportação falhou - verifique o console para detalhes",
					serviceUnavailable: "Serviço de exportação automática não disponível"
				}
			},
			httpApi: {
				header: "API HTTP",
				description: "Ative a API HTTP para integrações externas e automações.",
				enable: {
					name: "Ativar API HTTP",
					description: "Iniciar servidor HTTP local para acesso à API"
				},
				port: {
					name: "Porta da API",
					description: "Número da porta para o servidor da API HTTP",
					placeholder: "3000"
				},
				authToken: {
					name: "Token de autenticação da API",
					description: "Token necessário para autenticação da API (deixe em branco para sem autenticação)",
					placeholder: "seu-token-secreto"
				},
				endpoints: {
					header: "Endpoints da API Disponíveis",
					expandIcon: "▶",
					collapseIcon: "▼"
				}
			},
			webhooks: {
				header: "Webhooks",
				description: {
					overview: "Webhooks enviam notificações em tempo real para serviços externos quando eventos do TaskNotes ocorrem.",
					usage: "Configure webhooks para integrar com ferramentas de automação, serviços de sincronização ou aplicativos personalizados."
				},
				addWebhook: {
					name: "Adicionar Webhook",
					description: "Registrar um novo endpoint de webhook",
					buttonText: "Adicionar Webhook"
				},
				emptyState: {
					message: "Nenhum webhook configurado. Adicione um webhook para receber notificações em tempo real.",
					buttonText: "Adicionar Webhook"
				},
				labels: {
					active: "Ativo:",
					url: "URL:",
					events: "Eventos:",
					transform: "Transformar:"
				},
				placeholders: {
					url: "URL do Webhook",
					noEventsSelected: "Nenhum evento selecionado",
					rawPayload: "Payload sem transformação"
				},
				statusLabels: {
					active: "Ativo",
					inactive: "Inativo",
					created: "Criado {timeAgo}"
				},
				actions: {
					editEvents: "Editar Eventos",
					delete: "Excluir"
				},
				editEvents: "Editar Eventos",
				notices: {
					urlUpdated: "URL do Webhook atualizada",
					enabled: "Webhook ativado",
					disabled: "Webhook desativado",
					created: "Webhook criado com sucesso",
					deleted: "Webhook excluído",
					updated: "Webhook atualizado"
				},
				confirmDelete: {
					title: "Excluir Webhook",
					message: "Tem certeza de que deseja excluir este webhook?\n\nURL: {url}\n\nEsta ação não pode ser desfeita.",
					confirmText: "Excluir"
				},
				cardHeader: "Webhook",
				cardFields: {
					active: "Ativo:",
					url: "URL:",
					events: "Eventos:",
					transform: "Transformar:"
				},
				eventsDisplay: {
					noEvents: "Nenhum evento selecionado"
				},
				transformDisplay: {
					noTransform: "Payload sem transformação"
				},
				secretModal: {
					title: "Segredo do Webhook Gerado",
					description: "Seu segredo do webhook foi gerado. Salve este segredo, pois você não poderá visualizá-lo novamente:",
					usage: "Use este segredo para verificar os payloads do webhook em seu aplicativo receptor.",
					gotIt: "Entendi"
				},
				editModal: {
					title: "Editar Webhook",
					eventsHeader: "Eventos para se inscrever"
				},
				events: {
					taskCreated: {
						label: "Tarefa Criada",
						description: "Quando novas tarefas são criadas"
					},
					taskUpdated: {
						label: "Tarefa Atualizada",
						description: "Quando tarefas são modificadas"
					},
					taskCompleted: {
						label: "Tarefa Concluída",
						description: "Quando tarefas são marcadas como concluídas"
					},
					taskDeleted: {
						label: "Tarefa Excluída",
						description: "Quando tarefas são excluídas"
					},
					taskArchived: {
						label: "Tarefa Arquivada",
						description: "Quando tarefas são arquivadas"
					},
					taskUnarchived: {
						label: "Tarefa Desarquivada",
						description: "Quando tarefas são desarquivadas"
					},
					timeStarted: {
						label: "Tempo Iniciado",
						description: "Quando o registro de tempo inicia"
					},
					timeStopped: {
						label: "Tempo Parado",
						description: "Quando o registro de tempo para"
					},
					pomodoroStarted: {
						label: "Pomodoro Iniciado",
						description: "Quando sessões pomodoro começam"
					},
					pomodoroCompleted: {
						label: "Pomodoro Concluído",
						description: "Quando sessões pomodoro terminam"
					},
					pomodoroInterrupted: {
						label: "Pomodoro Interrompido",
						description: "Quando sessões pomodoro são paradas"
					},
					recurringCompleted: {
						label: "Instância Recorrente Concluída",
						description: "Quando instâncias de tarefas recorrentes são concluídas"
					},
					reminderTriggered: {
						label: "Lembrete Acionado",
						description: "Quando lembretes de tarefa são ativados"
					}
				},
				modals: {
					secretGenerated: {
						title: "Segredo do Webhook Gerado",
						description: "Seu segredo do webhook foi gerado. Salve este segredo, pois você não poderá visualizá-lo novamente:",
						usage: "Use este segredo para verificar os payloads do webhook em seu aplicativo receptor.",
						buttonText: "Entendi"
					},
					edit: {
						title: "Editar Webhook",
						eventsSection: "Eventos para se inscrever",
						transformSection: "Configuração de Transformação (Opcional)",
						headersSection: "Configuração de Cabeçalhos",
						transformFile: {
							name: "Arquivo de Transformação",
							description: "Caminho para um arquivo .js ou .json em seu cofre que transforma payloads de webhook",
							placeholder: "discord-transform.js"
						},
						customHeaders: {
							name: "Incluir cabeçalhos personalizados",
							description: "Incluir cabeçalhos do TaskNotes (tipo de evento, assinatura, ID de entrega). Desative para Discord, Slack e outros serviços com políticas CORS rígidas.",
						},
						buttons: {
							cancel: "Cancelar",
							save: "Salvar Alterações"
						},
						notices: {
							selectAtLeastOneEvent: "Por favor, selecione pelo menos um evento"
						}
					},
					add: {
						title: "Adicionar Webhook",
						eventsSection: "Eventos para se inscrever",
						transformSection: "Configuração de Transformação (Opcional)",
						headersSection: "Configuração de Cabeçalhos",
						url: {
							name: "URL do Webhook",
							description: "O endpoint para onde o payload do webhook será enviado",
							placeholder: "https://seu-servico.com/webhook"
						},
						transformFile: {
							name: "Arquivo de Transformação",
							description: "Caminho para um arquivo .js ou .json em seu cofre que transforma payloads de webhook",
							placeholder: "discord-transform.js"
						},
						customHeaders: {
							name: "Incluir cabeçalhos personalizados",
							description: "Incluir cabeçalhos do TaskNotes (tipo de evento, assinatura, ID de entrega). Desative para Discord, Slack e outros serviços com políticas CORS rígidas.",
						},
						transformHelp: {
							title: "Arquivos de transformação permitem personalizar payloads de webhook:",
							jsFiles: "Arquivos .js:",
							jsDescription: " Transformações JavaScript personalizadas",
							jsonFiles: "Arquivos .json:",
							jsonDescription: " Modelos com ",
							jsonVariable: "${data.task.title}",
							leaveEmpty: "Deixe em branco:",
							leaveEmptyDescription: " Enviar dados brutos",
							example: "Exemplo:",
							exampleFile: "discord-transform.js"
						},
						buttons: {
							cancel: "Cancelar",
							add: "Adicionar Webhook"
						},
						notices: {
							urlRequired: "A URL do Webhook é obrigatória",
							selectAtLeastOneEvent: "Por favor, selecione pelo menos um evento"
						}
					}
				}
			},
			otherIntegrations: {
				header: "Outras integrações de plugins",
				description: "Configure integrações com outros plugins do Obsidian."
			},
			timeFormats: {
				justNow: "Agora mesmo",
				minutesAgo: "{minutes} minuto{plural} atrás",
				hoursAgo: "{hours} hora{plural} atrás",
				daysAgo: "{days} dia{plural} atrás"
			}
		}
	},
	notices: {
		languageChanged: "Idioma alterado para {language}.",
		exportTasksFailed: "Falha ao exportar tarefas como arquivo ICS",
        // ICS Event Info Modal notices
		icsNoteCreatedSuccess: "Nota criada com sucesso",
		icsCreationModalOpenFailed: "Falha ao abrir modal de criação",
		icsNoteLinkSuccess: 'Nota "{fileName}" vinculada ao evento ICS',
		icsTaskCreatedSuccess: "Tarefa criada: {title}",
		icsRelatedItemsRefreshed: "Notas relacionadas atualizadas",
		icsFileNotFound: "Arquivo não encontrado ou inválido",
		icsFileOpenFailed: "Falha ao abrir arquivo",
        // Timeblock Info Modal notices
		timeblockAttachmentExists: '"{fileName}" já está anexado',
		timeblockAttachmentAdded: '"{fileName}" adicionado como anexo',
		timeblockAttachmentRemoved: '"{fileName}" removido dos anexos',
		timeblockFileTypeNotSupported: 'Não é possível abrir "{fileName}" - tipo de arquivo não suportado',
		timeblockTitleRequired: "Por favor, insira um título para o bloco de tempo",
		timeblockUpdatedSuccess: 'Bloco de tempo "{title}" atualizado com sucesso',
		timeblockUpdateFailed: "Falha ao atualizar bloco de tempo. Verifique o console para detalhes.",
		timeblockDeletedSuccess: 'Bloco de tempo "{title}" excluído com sucesso',
		timeblockDeleteFailed: "Falha ao excluir bloco de tempo. Verifique o console para detalhes.",
		// Timeblock Creation Modal notices
        timeblockRequiredFieldsMissing: "Por favor, preencha todos os campos obrigatórios",
		// Agenda View notices
        agendaLoadingFailed: "Erro ao carregar agenda. Por favor, tente atualizar.",
		// Stats View notices
        statsLoadingFailed: "Erro ao carregar detalhes do projeto."
	},
	commands: {
		openCalendarView: "Abrir visualização de mini calendário",
		openAdvancedCalendarView: "Abrir visualização de calendário",
		openTasksView: "Abrir visualização de tarefas",
		openNotesView: "Abrir visualização de notas",
		openAgendaView: "Abrir visualização de agenda",
		openPomodoroView: "Abrir temporizador pomodoro",
		openKanbanView: "Abrir quadro kanban",
		openPomodoroStats: "Abrir estatísticas pomodoro",
		openStatisticsView: "Abrir estatísticas de tarefas e projetos",
		createNewTask: "Criar nova tarefa",
		convertCurrentNoteToTask: {
			name: "Converter nota atual em tarefa",
			noActiveFile: "Nenhum arquivo ativo para converter",
			alreadyTask: "Esta nota já é uma tarefa",
			success: "'{title}' convertido em tarefa",
		},
		convertToTaskNote: "Converter tarefa de caixa de seleção para TaskNote",
		convertAllTasksInNote: "Converter todas as tarefas na nota",
		insertTaskNoteLink: "Inserir link de tasknote",
		createInlineTask: "Criar nova tarefa embutida",
		quickActionsCurrentTask: "Ações rápidas para a tarefa atual",
		goToTodayNote: "Ir para a nota de hoje",
		startPomodoro: "Iniciar temporizador pomodoro",
		stopPomodoro: "Parar temporizador pomodoro",
		pauseResumePomodoro: "Pausar/retomar temporizador pomodoro",
		refreshCache: "Atualizar cache",
		exportAllTasksIcs: "Exportar todas as tarefas como arquivo ICS",
		viewReleaseNotes: "Ver notas de lançamento",
		startTimeTrackingWithSelector: "Iniciar registro de tempo (selecionar tarefa)",
		editTimeEntries: "Editar registros de tempo (selecionar tarefa)",
		createOrOpenTask: "Criar ou abrir tarefa"
	},
	modals: {
		deviceCode: {
			title: "Autorização do Google Calendar",
			instructions: {
				intro: "Para conectar seu Google Calendar, por favor, siga estes passos:"
			},
			steps: {
				open: "Abra",
				inBrowser: "no seu navegador",
				enterCode: "Insira este código quando solicitado:",
				signIn: "Faça login com sua conta Google e conceda acesso",
				returnToObsidian: "Retorne ao Obsidian (esta janela fechará automaticamente)"
			},
			codeLabel: "Seu Código:",
			copyCodeAriaLabel: "Copiar código",
			waitingForAuthorization: "Aguardando autorização...",
			openBrowserButton: "Abrir Navegador",
			cancelButton: "Cancelar",
			expiresMinutesSeconds: "Código expira em {minutes}m {seconds}s",
			expiresSeconds: "Código expira em {seconds}s"
		},
		icsEventInfo: {
			calendarEventHeading: "Evento de Calendário",
			titleLabel: "Título",
			calendarLabel: "Calendário",
			dateTimeLabel: "Data e Hora",
			locationLabel: "Localização",
			descriptionLabel: "Descrição",
			urlLabel: "URL",
			relatedNotesHeading: "Notas e Tarefas Relacionadas",
			noRelatedItems: "Nenhuma nota ou tarefa relacionada encontrada para este evento.",
			typeTask: "Tarefa",
			typeNote: "Nota",
			actionsHeading: "Ações",
			createFromEventLabel: "Criar a partir do Evento",
			createFromEventDesc: "Criar uma nova nota ou tarefa a partir deste evento de calendário",
			linkExistingLabel: "Vincular Existente",
			linkExistingDesc: "Vincular uma nota existente a este evento de calendário"
		},
		timeblockInfo: {
			editHeading: "Editar Bloco de Tempo",
			dateTimeLabel: "Data e Hora: ",
			titleLabel: "Título",
			titleDesc: "Título para seu bloco de tempo",
			titlePlaceholder: "ex: Sessão de foco profundo",
			descriptionLabel: "Descrição",
			descriptionDesc: "Descrição opcional para o bloco de tempo",
			descriptionPlaceholder: "Focar em novos recursos, sem interrupções",
			colorLabel: "Cor",
			colorDesc: "Cor opcional para o bloco de tempo",
			colorPlaceholder: "#3b82f6",
			attachmentsLabel: "Anexos",
			attachmentsDesc: "Arquivos ou notas vinculados a este bloco de tempo",
			addAttachmentButton: "Adicionar Anexo",
			addAttachmentTooltip: "Selecionar um arquivo ou nota usando busca difusa",
			deleteButton: "Excluir Bloco de Tempo",
			saveButton: "Salvar Alterações",
			deleteConfirmationTitle: "Excluir Bloco de Tempo"
		},
		timeblockCreation: {
			heading: "Criar bloco de tempo",
			dateLabel: "Data: ",
			titleLabel: "Título",
			titleDesc: "Título para seu bloco de tempo",
			titlePlaceholder: "ex: Sessão de foco profundo",
			startTimeLabel: "Hora de início",
			startTimeDesc: "Quando o bloco de tempo começa",
			startTimePlaceholder: "09:00",
			endTimeLabel: "Hora de término",
			endTimeDesc: "Quando o bloco de tempo termina",
			endTimePlaceholder: "11:00",
			descriptionLabel: "Descrição",
			descriptionDesc: "Descrição opcional para o bloco de tempo",
			descriptionPlaceholder: "Focar em novos recursos, sem interrupções",
			colorLabel: "Cor",
			colorDesc: "Cor opcional para o bloco de tempo",
			colorPlaceholder: "#3b82f6",
			attachmentsLabel: "Anexos",
			attachmentsDesc: "Arquivos ou notas para vincular a este bloco de tempo",
			addAttachmentButton: "Adicionar Anexo",
			addAttachmentTooltip: "Selecionar um arquivo ou nota usando busca difusa",
			createButton: "Criar bloco de tempo"
		},
		icsNoteCreation: {
			heading: "Criar a partir de Evento ICS",
			titleLabel: "Título",
			titleDesc: "Título para o novo conteúdo",
			folderLabel: "Pasta",
			folderDesc: "Pasta de destino (deixe em branco para a raiz do cofre)",
			folderPlaceholder: "pasta/subpasta",
			createButton: "Criar",
			startLabel: "Início: ",
			endLabel: "Término: ",
			locationLabel: "Localização: ",
			calendarLabel: "Calendário: ",
			useTemplateLabel: "Usar Modelo",
			useTemplateDesc: "Aplicar um modelo ao criar o conteúdo",
			templatePathLabel: "Caminho do Modelo",
			templatePathDesc: "Caminho para o arquivo de modelo",
			templatePathPlaceholder: "modelos/modelo-nota-ics.md"
		},
		unscheduledTasksSelector: {
			title: "Tarefas Não Agendadas",
			placeholder: "Digite para buscar tarefas não agendadas...",
			instructions: {
				navigate: "para navegar",
				schedule: "para agendar",
				dismiss: "para dispensar"
			}
		},
		migration: {
			title: "Migrar para Novo Sistema de Recorrência",
			description: "O TaskNotes agora usa padrões RRULE padrão da indústria para recorrência, permitindo agendamentos mais complexos e melhor compatibilidade com outros aplicativos.",
			tasksFound: "{count} tarefa(s) com padrões de recorrência antigos detectada(s)",
			noMigrationNeeded: "Nenhuma tarefa requer migração",
			warnings: {
				title: "Antes de prosseguir:",
				backup: "Faça backup do seu cofre antes de migrar",
				conversion: "Padrões de recorrência antigos serão convertidos para o novo formato",
				normalUsage: "Você pode continuar usando o TaskNotes normalmente durante a migração",
				permanent: "Esta alteração é permanente e não pode ser desfeita automaticamente"
			},
			benefits: {
				title: "Benefícios do novo sistema:",
				powerfulPatterns: "Padrões de recorrência complexos (ex: 'toda 2ª terça-feira')",
				performance: "Melhor desempenho com tarefas recorrentes",
				compatibility: "Formato de recorrência padrão compatível com outros aplicativos",
				nlp: "Suporte aprimorado ao processamento de linguagem natural"
			},
			progress: {
				title: "Progresso da Migração",
				preparing: "Preparando migração...",
				completed: "Migração concluída com sucesso",
				failed: "Migração falhou"
			},
			buttons: {
				migrate: "Iniciar Migração",
				completed: "Fechar"
			},
			errors: {
				title: "Erros durante a migração:"
			},
			notices: {
				completedWithErrors: "Migração concluída com alguns erros. Verifique a lista de erros acima.",
				success: "Todas as tarefas migradas com sucesso!",
				failed: "Migração falhou. Por favor, verifique o console para detalhes."
			},
			prompt: {
				message: "O TaskNotes detectou tarefas usando o formato de recorrência antigo. Você gostaria de migrá-las para o novo sistema agora?",
				migrateNow: "Migrar Agora",
				remindLater: "Lembrar Mais Tarde"
			}
		},
		task: {
			titlePlaceholder: "O que precisa ser feito?",
			titleLabel: "Título",
			titleDetailedPlaceholder: "Título da tarefa...",
			detailsLabel: "Detalhes",
			detailsPlaceholder: "Adicionar mais detalhes...",
			projectsLabel: "Projetos",
			projectsAdd: "Adicionar Projeto",
			projectsTooltip: "Selecionar uma nota de projeto usando busca difusa",
			projectsRemoveTooltip: "Remover projeto",
			contextsLabel: "Contextos",
			contextsPlaceholder: "contexto1, contexto2",
			tagsLabel: "Tags",
			tagsPlaceholder: "tag1, tag2",
			timeEstimateLabel: "Estimativa de tempo (minutos)",
			timeEstimatePlaceholder: "30",
			unsavedChanges: {
				title: "Alterações não salvas",
				message: "Você tem alterações não salvas. Deseja salvá-las?",
				save: "Salvar alterações",
				discard: "Descartar alterações",
				cancel: "Continuar editando"
			},
			dependencies: {
				blockedBy: "Bloqueada por",
				blocking: "Bloqueando",
				placeholder: "[[Nota da Tarefa]]",
				addTaskButton: "Adicionar tarefa",
				selectTaskTooltip: "Selecionar uma nota de tarefa usando busca difusa",
				removeTaskTooltip: "Remover tarefa"
			},
			organization: {
				projects: "Projetos",
				subtasks: "Subtarefas",
				addToProject: "Adicionar ao projeto",
				addToProjectButton: "Adicionar ao projeto",
				addSubtasks: "Adicionar subtarefas",
				addSubtasksButton: "Adicionar subtarefa",
				addSubtasksTooltip: "Selecionar tarefas para torná-las subtarefas desta tarefa",
				removeSubtaskTooltip: "Remover subtarefa",
				notices: {
					noEligibleSubtasks: "Nenhuma tarefa elegível disponível para atribuir como subtarefa",
					subtaskSelectFailed: "Falha ao abrir seletor de subtarefas"
				}
			},
			customFieldsLabel: "Campos Personalizados",
			actions: {
				due: "Definir data de vencimento",
				scheduled: "Definir data agendada",
				status: "Definir status",
				priority: "Definir prioridade",
				recurrence: "Definir recorrência",
				reminders: "Definir lembretes"
			},
			buttons: {
				openNote: "Abrir nota",
				save: "Salvar"
			},
			tooltips: {
				dueValue: "Vencimento: {value}",
				scheduledValue: "Agendada: {value}",
				statusValue: "Status: {value}",
				priorityValue: "Prioridade: {value}",
				recurrenceValue: "Recorrência: {value}",
				remindersSingle: "1 lembrete definido",
				remindersPlural: "{count} lembretes definidos"
			},
			dateMenu: {
				dueTitle: "Definir Data de Vencimento",
				scheduledTitle: "Definir Data Agendada"
			},
			userFields: {
				textPlaceholder: "Digite {field}...",
				numberPlaceholder: "0",
				datePlaceholder: "AAAA-MM-DD",
				listPlaceholder: "item1, item2, item3",
				pickDate: "Escolher data {field}"
			},
			recurrence: {
				daily: "Diariamente",
				weekly: "Semanalmente",
				everyTwoWeeks: "A cada 2 semanas",
				weekdays: "Dias de semana",
				weeklyOn: "Semanalmente às {days}",
				monthly: "Mensalmente",
				everyThreeMonths: "A cada 3 meses",
				monthlyOnOrdinal: "Mensalmente no {ordinal}",
				monthlyByWeekday: "Mensalmente (por dia da semana)",
				yearly: "Anualmente",
				yearlyOn: "Anualmente em {day} de {month}",
				custom: "Personalizado",
				countSuffix: "{count} vezes",
				untilSuffix: "até {date}",
				ordinal: "{number}{suffix}"
			}
		},
		taskSelector: {
			title: "Selecionar tarefa",
			placeholder: "Digite para buscar tarefas...",
			instructions: {
				navigate: "para navegar",
				select: "para selecionar",
				dismiss: "para cancelar"
			},
			notices: {
				noteNotFound: 'Não foi possível encontrar a nota "{name}"'
			},
			dueDate: {
				overdue: "Vencimento: {date} (atrasada)",
				today: "Vencimento: Hoje"
			}
		},
		taskSelectorWithCreate: {
			title: "Criar ou abrir tarefa",
			placeholder: "Pesquisar tarefas ou digitar para criar nova...",
			instructions: {
				create: "para criar nova tarefa"
			},
			footer: {
				createLabel: " para criar: "
			},
			notices: {
				emptyQuery: "Por favor, insira uma descrição da tarefa",
				invalidTitle: "Não foi possível reconhecer um título de tarefa válido"
			}
		},
		taskCreation: {
			title: "Criar tarefa",
			actions: {
				fillFromNaturalLanguage: "Preencher formulário a partir de linguagem natural",
				hideDetailedOptions: "Ocultar opções detalhadas",
				showDetailedOptions: "Mostrar opções detalhadas"
			},
			nlPlaceholder: "Comprar mantimentos amanhã às 15h @casa #tarefas",
			notices: {
				titleRequired: "Por favor, insira um título para a tarefa",
				success: 'Tarefa "{title}" criada com sucesso',
				successShortened: 'Tarefa "{title}" criada com sucesso (nome do arquivo encurtado devido ao comprimento)',
				failure: "Falha ao criar tarefa: {message}",
				blockingUnresolved: "Não foi possível resolver: {entries}"
			}
		},
		taskEdit: {
			title: "Editar tarefa",
			sections: {
				completions: "Conclusões",
				taskInfo: "Informações da Tarefa"
			},
			metadata: {
				totalTrackedTime: "Tempo total registrado:",
				created: "Criada:",
				modified: "Modificada:",
				file: "Arquivo:"
			},
			buttons: {
				archive: "Arquivar",
				unarchive: "Desarquivar"
			},
			notices: {
				titleRequired: "Por favor, insira um título para a tarefa",
				noChanges: "Nenhuma alteração para salvar",
				updateSuccess: 'Tarefa "{title}" atualizada com sucesso',
				updateFailure: "Falha ao atualizar tarefa: {message}",
				dependenciesUpdateSuccess: "Dependências atualizadas",
				blockingUnresolved: "Não foi possível resolver: {entries}",
				fileMissing: "Não foi possível encontrar o arquivo da tarefa: {path}",
				openNoteFailure: "Falha ao abrir nota da tarefa",
				archiveSuccess: "Tarefa {action} com sucesso",
				archiveFailure: "Falha ao arquivar tarefa"
			},
			archiveAction: {
				archived: "arquivada",
				unarchived: "desarquivada"
			}
		},
		storageLocation: {
			title: {
				migrate: "Migrar dados pomodoro?",
				switch: "Mudar para armazenamento em notas diárias?"
			},
			message: {
				migrate: "Isso migrará seus dados de sessão pomodoro existentes para o frontmatter das notas diárias. Os dados serão agrupados por data e armazenados em cada nota diária.",
				switch: "Os dados da sessão pomodoro serão armazenados no frontmatter das notas diárias em vez do arquivo de dados do plugin."
			},
			whatThisMeans: "O que isso significa:",
			bullets: {
				dailyNotesRequired: "O plugin principal de Notas Diárias deve permanecer ativado",
				storedInNotes: "Os dados serão armazenados no frontmatter das suas notas diárias",
				migrateData: "Os dados existentes do plugin serão migrados e depois limpos",
				futureSessions: "Sessões futuras serão salvas nas notas diárias",
				dataLongevity: "Isso proporciona melhor longevidade dos dados com suas notas"
			},
			finalNote: {
				migrate: "⚠️ Certifique-se de ter backups, se necessário. Esta alteração não pode ser desfeita automaticamente.",
				switch: "Você pode voltar para o armazenamento do plugin a qualquer momento no futuro."
			},
			buttons: {
				migrate: "Migrar dados",
				switch: "Mudar armazenamento"
			}
		},
		dueDate: {
			title: "Definir Data de Vencimento",
			taskLabel: "Tarefa: {title}",
			sections: {
				dateTime: "Data e Hora de Vencimento",
				quickOptions: "Opções Rápidas"
			},
			descriptions: {
				dateTime: "Defina quando esta tarefa deve ser concluída"
			},
			inputs: {
				date: {
					ariaLabel: "Data de vencimento da tarefa",
					placeholder: "AAAA-MM-DD"
				},
				time: {
					ariaLabel: "Hora de vencimento da tarefa (opcional)",
					placeholder: "HH:MM"
				}
			},
			quickOptions: {
				today: "Hoje",
				todayAriaLabel: "Definir data de vencimento para hoje",
				tomorrow: "Amanhã",
				tomorrowAriaLabel: "Definir data de vencimento para amanhã",
				nextWeek: "Próxima semana",
				nextWeekAriaLabel: "Definir data de vencimento para próxima semana",
				now: "Agora",
				nowAriaLabel: "Definir data e hora de vencimento para agora",
				clear: "Limpar",
				clearAriaLabel: "Limpar data de vencimento"
			},
			errors: {
				invalidDateTime: "Por favor, insira um formato de data e hora válido",
				updateFailed: "Falha ao atualizar data de vencimento. Por favor, tente novamente."
			}
		},
		scheduledDate: {
			title: "Definir Data Agendada",
			taskLabel: "Tarefa: {title}",
			sections: {
				dateTime: "Data e Hora Agendada",
				quickOptions: "Opções Rápidas"
			},
			descriptions: {
				dateTime: "Defina quando você planeja trabalhar nesta tarefa"
			},
			inputs: {
				date: {
					ariaLabel: "Data agendada da tarefa",
					placeholder: "AAAA-MM-DD"
				},
				time: {
					ariaLabel: "Hora agendada da tarefa (opcional)",
					placeholder: "HH:MM"
				}
			},
			quickOptions: {
				today: "Hoje",
				todayAriaLabel: "Definir data agendada para hoje",
				tomorrow: "Amanhã",
				tomorrowAriaLabel: "Definir data agendada para amanhã",
				nextWeek: "Próxima semana",
				nextWeekAriaLabel: "Definir data agendada para próxima semana",
				now: "Agora",
				nowAriaLabel: "Definir data e hora agendada para agora",
				clear: "Limpar",
				clearAriaLabel: "Limpar data agendada"
			},
			errors: {
				invalidDateTime: "Por favor, insira um formato de data e hora válido",
				updateFailed: "Falha ao atualizar data agendada. Por favor, tente novamente."
			}
		},
		timeEntryEditor: {
			title: "Registros de Tempo - {taskTitle}",
			addEntry: "Adicionar registro de tempo",
			noEntries: "Nenhum registro de tempo ainda",
			deleteEntry: "Excluir registro",
			startTime: "Hora de início",
			endTime: "Hora de término (deixe em branco se ainda estiver em execução)",
			duration: "Duração (minutos)",
			durationDesc: "Substituir duração calculada",
			durationPlaceholder: "Digite a duração em minutos",
			description: "Descrição",
			descriptionPlaceholder: "No que você trabalhou?",
			calculatedDuration: "Calculado: {minutes} minutos",
			totalTime: "{hours}h {minutes}m total",
			totalMinutes: "{minutes}m total",
			saved: "Registros de tempo salvos",
			saveFailed: "Falha ao salvar registros de tempo",
			openFailed: "Falha ao abrir editor de registro de tempo",
			noTasksWithEntries: "Nenhuma tarefa possui registros de tempo para editar",
			validation: {
				missingStartTime: "Hora de início é obrigatória",
				endBeforeStart: "Hora de término deve ser após a hora de início"
			}
		},
		timeTracking: {
			noTasksAvailable: "Nenhuma tarefa disponível para registrar o tempo",
			started: "Iniciado registro de tempo para: {taskTitle}",
			startFailed: "Falha ao iniciar registro de tempo"
		},
		timeEntry: {
			mustHaveSpecificTime: "Registros de tempo devem ter horários específicos. Por favor, selecione um intervalo de tempo na visualização de semana ou dia.",
			noTasksAvailable: "Nenhuma tarefa disponível para criar registros de tempo",
			created: "Registro de tempo criado para {taskTitle} ({duration} minutos)",
			createFailed: "Falha ao criar registro de tempo"
		}
	},
	contextMenus: {
		task: {
			status: "Status",
			statusSelected: "✓ {label}",
			priority: "Prioridade",
			prioritySelected: "✓ {label}",
			dueDate: "Data de vencimento",
			scheduledDate: "Data agendada",
			reminders: "Lembretes",
			remindBeforeDue: "Lembrar antes do vencimento…",
			remindBeforeScheduled: "Lembrar antes da data agendada…",
			manageReminders: "Gerenciar todos os lembretes…",
			clearReminders: "Limpar todos os lembretes",
			startTimeTracking: "Iniciar registro de tempo",
			stopTimeTracking: "Parar registro de tempo",
			editTimeEntries: "Editar registros de tempo",
			archive: "Arquivar",
			unarchive: "Desarquivar",
			openNote: "Abrir nota",
			copyTitle: "Copiar título da tarefa",
			noteActions: "Ações da nota",
			rename: "Renomear",
			renameTitle: "Renomear Arquivo",
			renamePlaceholder: "Digite o novo nome",
			delete: "Excluir",
			deleteTitle: "Excluir Arquivo",
			deleteMessage: 'Tem certeza de que deseja excluir "{name}"?',
			deleteConfirm: "Excluir",
			copyPath: "Copiar caminho",
			copyUrl: "Copiar URL do Obsidian",
			showInExplorer: "Mostrar no explorador de arquivos",
			addToCalendar: "Adicionar ao calendário",
			calendar: {
				google: "Google Calendar",
				outlook: "Outlook Calendar",
				yahoo: "Yahoo Calendar",
				downloadIcs: "Baixar arquivo .ics"
			},
			recurrence: "Recorrência",
			clearRecurrence: "Limpar recorrência",
			customRecurrence: "Recorrência personalizada...",
			createSubtask: "Criar subtarefa",
			dependencies: {
				title: "Dependências",
				addBlockedBy: "Adicionar “bloqueada por”...",
				addBlockedByTitle: "Adicionar tarefas das quais esta depende",
				addBlocking: "Adicionar “bloqueando”...",
				addBlockingTitle: "Adicionar tarefas que esta bloqueia",
				removeBlockedBy: "Remover “bloqueada por”...",
				removeBlocking: "Remover “bloqueando”...",
				inputPlaceholder: "[[Nota da Tarefa]]",
				notices: {
					noEntries: "Por favor, insira pelo menos uma tarefa",
					blockedByAdded: "{count} dependência adicionada",
					blockedByRemoved: "Dependência removida",
					blockingAdded: "{count} tarefa dependente adicionada",
					blockingRemoved: "Tarefa dependente removida",
					unresolved: "Não foi possível resolver: {entries}",
					noEligibleTasks: "Nenhuma tarefa correspondente disponível",
					updateFailed: "Falha ao atualizar dependências"
				}
			},
			organization: {
				title: "Organização",
				projects: "Projetos",
				addToProject: "Adicionar ao projeto…",
				subtasks: "Subtarefas",
				addSubtasks: "Adicionar subtarefas…",
				notices: {
					alreadyInProject: "Tarefa já está neste projeto",
					alreadySubtask: "Tarefa já é uma subtarefa desta tarefa",
					addedToProject: "Adicionada ao projeto: {project}",
					addedAsSubtask: "{subtask} adicionada como subtarefa de {parent}",
					addToProjectFailed: "Falha ao adicionar tarefa ao projeto",
					addAsSubtaskFailed: "Falha ao adicionar tarefa como subtarefa",
					projectSelectFailed: "Falha ao abrir seletor de projeto",
					subtaskSelectFailed: "Falha ao abrir seletor de subtarefa",
					noEligibleSubtasks: "Nenhuma tarefa elegível disponível para atribuir como subtarefa",
					currentTaskNotFound: "Arquivo da tarefa atual não encontrado"
				}
			},
			subtasks: {
				loading: "Carregando subtarefas...",
				noSubtasks: "Nenhuma subtarefa encontrada",
				loadFailed: "Falha ao carregar subtarefas"
			},
			markComplete: "Marcar como concluída para esta data",
			markIncomplete: "Marcar como incompleta para esta data",
			skipInstance: "Pular instância",
			unskipInstance: "Desfazer pulo de instância",
			quickReminders: {
				atTime: "Na hora do evento",
				fiveMinutes: "5 minutos antes",
				fifteenMinutes: "15 minutos antes",
				oneHour: "1 hora antes",
				oneDay: "1 dia antes"
			},
			notices: {
				toggleCompletionFailure: "Falha ao alternar conclusão de tarefa recorrente: {message}",
				toggleSkipFailure: "Falha ao alternar pulo de tarefa recorrente: {message}",
				updateDueDateFailure: "Falha ao atualizar data de vencimento da tarefa: {message}",
				updateScheduledFailure: "Falha ao atualizar data agendada da tarefa: {message}",
				updateRemindersFailure: "Falha ao atualizar lembretes",
				clearRemindersFailure: "Falha ao limpar lembretes",
				addReminderFailure: "Falha ao adicionar lembrete",
				archiveFailure: "Falha ao alternar arquivamento da tarefa: {message}",
				copyTitleSuccess: "Título da tarefa copiado para a área de transferência",
				copyFailure: "Falha ao copiar para a área de transferência",
				renameSuccess: "Renomeado para \"{name}\"",
				renameFailure: "Falha ao renomear arquivo",
				copyPathSuccess: "Caminho do arquivo copiado para a área de transferência",
				copyUrlSuccess: "URL do Obsidian copiado para a área de transferência",
				updateRecurrenceFailure: "Falha ao atualizar recorrência da tarefa: {message}"
			}
		},
		ics: {
			showDetails: "Mostrar detalhes",
			createTask: "Criar tarefa a partir do evento",
			createNote: "Criar nota a partir do evento",
			linkNote: "Vincular nota existente",
			copyTitle: "Copiar título",
			copyLocation: "Copiar localização",
			copyUrl: "Copiar URL",
			copyMarkdown: "Copiar como markdown",
			subscriptionUnknown: "Calendário desconhecido",
			notices: {
				copyTitleSuccess: "Título do evento copiado para a área de transferência",
				copyLocationSuccess: "Localização copiada para a área de transferência",
				copyUrlSuccess: "URL do evento copiada para a área de transferência",
				copyMarkdownSuccess: "Detalhes do evento copiados como markdown",
				copyFailure: "Falha ao copiar para a área de transferência",
				taskCreated: "Tarefa criada: {title}",
				taskCreateFailure: "Falha ao criar tarefa a partir do evento",
				noteCreated: "Nota criada com sucesso",
				creationFailure: "Falha ao abrir modal de criação",
				linkSuccess: 'Nota "{name}" vinculada ao evento',
				linkFailure: "Falha ao vincular nota",
				linkSelectionFailure: "Falha ao abrir seleção de nota"
			},
			markdown: {
				titleFallback: "Evento Sem Título",
				calendar: "**Calendário:** {value}",
				date: "**Data e Hora:** {value}",
				location: "**Localização:** {value}",
				descriptionHeading: "### Descrição",
				url: "**URL:** {value}",
				at: " às {time}"
			}
		},
		date: {
			increment: {
				plusOneDay: "+1 dia",
				minusOneDay: "-1 dia",
				plusOneWeek: "+1 semana",
				minusOneWeek: "-1 semana"
			},
			basic: {
				today: "Hoje",
				tomorrow: "Amanhã",
				thisWeekend: "Este fim de semana",
				nextWeek: "Próxima semana",
				nextMonth: "Próximo mês"
			},
			weekdaysLabel: "Dias de semana",
			selected: "✓ {label}",
			pickDateTime: "Escolher data e hora…",
			clearDate: "Limpar data",
			modal: {
				title: "Definir data e hora",
				dateLabel: "Data",
				timeLabel: "Hora (opcional)",
				select: "Selecionar"
			}
		}
	},
	services: {
		pomodoro: {
			notices: {
				alreadyRunning: "Um pomodoro já está em execução",
				resumeCurrentSession: "Retome a sessão atual em vez de iniciar uma nova",
				timerAlreadyRunning: "Um temporizador já está em execução",
				resumeSessionInstead: "Retome a sessão atual em vez de iniciar uma nova",
				shortBreakStarted: "Pausa curta iniciada",
				longBreakStarted: "Pausa longa iniciada",
				paused: "Pomodoro pausado",
				resumed: "Pomodoro retomado",
				stoppedAndReset: "Pomodoro parado e redefinido",
				migrationSuccess: "Migradas com sucesso {count} sessões pomodoro para notas diárias.",
				migrationFailure: "Falha ao migrar dados pomodoro. Por favor, tente novamente ou verifique o console para detalhes."
			}
		},
		icsSubscription: {
			notices: {
				calendarNotFound: 'Calendário "{name}" não encontrado (404). Por favor, verifique se a URL ICS está correta e se o calendário é acessível publicamente.',
				calendarAccessDenied: 'Acesso ao calendário "{name}" negado (500). Isso pode ser devido a restrições do servidor Microsoft Outlook. Tente regenerar a URL ICS das configurações do seu calendário.',
				fetchRemoteFailed: 'Falha ao buscar calendário remoto "{name}": {error}',
				readLocalFailed: 'Falha ao ler calendário local "{name}": {error}'
			}
		},
		calendarExport: {
			notices: {
				generateLinkFailed: "Falha ao gerar link do calendário",
				noTasksToExport: "Nenhuma tarefa encontrada para exportar",
				downloadSuccess: "Baixado {filename} com {count} tarefa{plural}",
				downloadFailed: "Falha ao baixar arquivo de calendário",
				singleDownloadSuccess: "Baixado {filename}"
			}
		},
		filter: {
			groupLabels: {
				noProject: "Sem projeto",
				noTags: "Sem tags",
				invalidDate: "Data inválida",
				due: {
					overdue: "Atrasadas",
					today: "Hoje",
					tomorrow: "Amanhã",
					nextSevenDays: "Próximos sete dias",
					later: "Mais tarde",
					none: "Sem data de vencimento"
				},
				scheduled: {
					past: "Agendadas passadas",
					today: "Hoje",
					tomorrow: "Amanhã",
					nextSevenDays: "Próximos sete dias",
					later: "Mais tarde",
					none: "Sem data agendada"
				}
			},
			errors: {
				noDatesProvided: "Nenhuma data fornecida"
			},
			folders: {
				root: "(Raiz)"
			}
		},
		instantTaskConvert: {
			notices: {
				noCheckboxTasks: "Nenhuma tarefa de caixa de seleção encontrada na nota atual.",
				convertingTasks: "Convertendo {count} tarefa{plural}...",
				conversionSuccess: "✅ Convertidas com sucesso {count} tarefa{plural} para TaskNotes!",
				partialConversion: "Convertidas {successCount} tarefa{successPlural}. {failureCount} falharam.",
				batchConversionFailed: "Falha ao realizar conversão em lote. Por favor, tente novamente.",
				invalidParameters: "Parâmetros de entrada inválidos.",
				emptyLine: "Linha atual está vazia ou não contém conteúdo válido.",
				parseError: "Erro ao analisar tarefa: {error}",
				invalidTaskData: "Dados da tarefa inválidos.",
				replaceLineFailed: "Falha ao substituir linha da tarefa.",
				conversionComplete: "Tarefa convertida: {title}",
				conversionCompleteShortened: 'Tarefa convertida: "{title}" (nome do arquivo encurtado devido ao comprimento)',
				fileExists: "Um arquivo com este nome já existe. Por favor, tente novamente ou renomeie a tarefa.",
				conversionFailed: "Falha ao converter tarefa. Por favor, tente novamente."
			}
		},
		icsNote: {
			notices: {
				templateNotFound: "Modelo não encontrado: {path}",
				templateProcessError: "Erro ao processar modelo: {template}",
				linkedToEvent: "Nota vinculada ao evento ICS: {title}"
			}
		},
		task: {
			notices: {
				templateNotFound: "Modelo de corpo da tarefa não encontrado: {path}",
				templateReadError: "Erro ao ler modelo de corpo da tarefa: {template}",
				moveTaskFailed: "Falha ao mover tarefa {operation}: {error}"
			}
		},
		autoExport: {
			notices: {
				exportFailed: "Exportação automática do TaskNotes falhou: {error}"
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
			untitledEvent: "Evento sem título",
			allDay: "Dia inteiro",
			calendarEvent: "Evento de calendário",
			calendarFallback: "Calendário"
		},
		noteCard: {
			createdLabel: "Criada:",
			dailyBadge: "Diária",
			dailyTooltip: "Nota diária"
		},
		taskCard: {
			blockedBadge: "Bloqueada",
			blockedBadgeTooltip: "Esta tarefa está aguardando outra tarefa",
			blockingBadge: "Bloqueando",
			blockingBadgeTooltip: "Esta tarefa está bloqueando outra tarefa",
			blockingToggle: "Bloqueando {count} tarefas",
			loadingDependencies: "Carregando dependências...",
			blockingEmpty: "Nenhuma tarefa dependente",
			blockingLoadError: "Falha ao carregar dependências"
		},
		propertyEventCard: {
			unknownFile: "Arquivo desconhecido"
		},
		filterHeading: {
			allViewName: "Todos"
		},
		filterBar: {
			saveView: "Salvar visualização",
			saveViewNamePlaceholder: "Digite o nome da visualização...",
			saveButton: "Salvar",
			views: "Visualizações",
			savedFilterViews: "Visualizações de filtro salvas",
			filters: "Filtros",
			properties: "Propriedades",
			sort: "Ordenar",
			newTask: "Nova",
			expandAllGroups: "Expandir Todos os Grupos",
			collapseAllGroups: "Recolher Todos os Grupos",
			searchTasksPlaceholder: "Buscar tarefas...",
			searchTasksTooltip: "Buscar títulos de tarefas",
			filterUnavailable: "Barra de filtro temporariamente indisponível",
			toggleFilter: "Alternar filtro",
			activeFiltersTooltip: "Filtros ativos – Clique para modificar, clique com o botão direito para limpar",
			configureVisibleProperties: "Configurar propriedades visíveis",
			sortAndGroupOptions: "Opções de ordenação e agrupamento",
			sortMenuHeader: "Ordenar",
			orderMenuHeader: "Ordem",
			groupMenuHeader: "Agrupar",
			createNewTask: "Criar nova tarefa",
			filter: "Filtrar",
			displayOrganization: "Exibição e Organização",
			viewOptions: "Opções de Visualização",
			addFilter: "Adicionar filtro",
			addFilterGroup: "Adicionar grupo de filtros",
			addFilterTooltip: "Adicionar uma nova condição de filtro",
			addFilterGroupTooltip: "Adicionar um grupo de filtros aninhado",
			clearAllFilters: "Limpar todos os filtros e grupos",
			saveCurrentFilter: "Salvar filtro atual como visualização",
			closeFilterModal: "Fechar modal de filtro",
			deleteFilterGroup: "Excluir grupo de filtros",
			deleteCondition: "Excluir condição",
			all: "Todos",
			any: "Qualquer um",
			followingAreTrue: "dos seguintes são verdadeiros:",
			where: "onde",
			selectProperty: "Selecione...",
			chooseProperty: "Escolha qual propriedade da tarefa filtrar",
			chooseOperator: "Escolha como comparar o valor da propriedade",
			enterValue: "Digite o valor para filtrar",
			selectValue: "Selecione um(a) {property} para filtrar",
			sortBy: "Ordenar por:",
			toggleSortDirection: "Alternar direção da ordenação",
			chooseSortMethod: "Escolha como ordenar tarefas",
			groupBy: "Agrupar por:",
			chooseGroupMethod: "Agrupar tarefas por uma propriedade comum",
			toggleViewOption: "Alternar {option}",
			expandCollapseFilters: "Clique para expandir/recolher condições de filtro",
			expandCollapseSort: "Clique para expandir/recolher opções de ordenação e agrupamento",
			expandCollapseViewOptions: "Clique para expandir/recolher opções específicas da visualização",
			naturalLanguageDates: "Datas em Linguagem Natural",
			naturalLanguageExamples: "Mostrar exemplos de datas em linguagem natural",
			enterNumericValue: "Digite um valor numérico para filtrar",
			enterDateValue: "Digite uma data usando linguagem natural ou formato ISO",
			pickDateTime: "Escolher data e hora",
			noSavedViews: "Nenhuma visualização salva",
			savedViews: "Visualizações salvas",
			yourSavedFilters: "Suas configurações de filtro salvas",
			dragToReorder: "Arraste para reordenar visualizações",
			loadSavedView: "Carregar visualização salva: {name}",
			deleteView: "Excluir visualização",
			deleteViewTitle: "Excluir Visualização",
			deleteViewMessage: 'Tem certeza de que deseja excluir a visualização "{name}"?',
			manageAllReminders: "Gerenciar Todos os Lembretes...",
			clearAllReminders: "Limpar Todos os Lembretes",
			customRecurrence: "Recorrência personalizada...",
			clearRecurrence: "Limpar recorrência",
			sortOptions: {
				dueDate: "Data de Vencimento",
				scheduledDate: "Data Agendada",
				priority: "Prioridade",
				status: "Status",
				title: "Título",
				createdDate: "Data de Criação",
				tags: "Tags",
				ascending: "Ascendente",
				descending: "Descendente"
			},
			"group": {
				none: "Nenhum",
				status: "Status",
				priority: "Prioridade",
				context: "Contexto",
				project: "Projeto",
				dueDate: "Data de Vencimento",
				scheduledDate: "Data Agendada",
				tags: "Tags",
				completedDate: "Data de Conclusão"
			},
			subgroupLabel: "SUBGRUPO",
			notices: {
				propertiesMenuFailed: "Falha ao mostrar menu de propriedades"
			}
		}
	},
	components: {
		dateContextMenu: {
			weekdays: "Dias de semana",
			clearDate: "Limpar data",
			today: "Hoje",
			tomorrow: "Amanhã",
			thisWeekend: "Este fim de semana",
			nextWeek: "Próxima semana",
			nextMonth: "Próximo mês",
			setDateTime: "Definir data e hora",
			dateLabel: "Data",
			timeLabel: "Hora (opcional)"
		},
		subgroupMenuBuilder: {
			none: "Nenhum",
			status: "Status",
			priority: "Prioridade",
			context: "Contexto",
			project: "Projeto",
			dueDate: "Data de Vencimento",
			scheduledDate: "Data Agendada",
			tags: "Tags",
			completedDate: "Data de Conclusão",
			subgroup: "SUBGRUPO"
		},
		propertyVisibilityDropdown: {
			coreProperties: "PROPRIEDADES PRINCIPAIS",
			organization: "ORGANIZAÇÃO",
			customProperties: "PROPRIEDADES PERSONALIZADAS",
			failed: "Falha ao mostrar menu de propriedades",
			properties: {
				statusDot: "Ponto de Status",
				priorityDot: "Ponto de Prioridade",
				dueDate: "Data de Vencimento",
				scheduledDate: "Data Agendada",
				timeEstimate: "Estimativa de Tempo",
				totalTrackedTime: "Tempo Total Registrado",
				recurrence: "Recorrência",
				completedDate: "Data de Conclusão",
				createdDate: "Data de Criação",
				modifiedDate: "Data de Modificação",
				projects: "Projetos",
				contexts: "Contextos",
				tags: "Tags",
				blocked: "Bloqueada",
				blocking: "Bloqueando"
			}
		},
		reminderContextMenu: {
			remindBeforeDue: "Lembrar antes do vencimento...",
			remindBeforeScheduled: "Lembrar antes da data agendada...",
			manageAllReminders: "Gerenciar Todos os Lembretes...",
			clearAllReminders: "Limpar Todos os Lembretes",
			quickReminders: {
				atTime: "Na hora do evento",
				fiveMinutesBefore: "5 minutos antes",
				fifteenMinutesBefore: "15 minutos antes",
				oneHourBefore: "1 hora antes",
				oneDayBefore: "1 dia antes"
			}
		},
		recurrenceContextMenu: {
			daily: "Diariamente",
			weeklyOn: "Semanalmente na(o) {day}",
			everyTwoWeeksOn: "A cada 2 semanas na(o) {day}",
			monthlyOnThe: "Mensalmente no {ordinal}",
			everyThreeMonthsOnThe: "A cada 3 meses no {ordinal}",
			yearlyOn: "Anualmente em {ordinal} de {month}",
			weekdaysOnly: "Apenas dias de semana",
			dailyAfterCompletion: "Diariamente (após conclusão)",
			every3DaysAfterCompletion: "A cada 3 dias (após conclusão)",
			weeklyAfterCompletion: "Semanalmente (após conclusão)",
			monthlyAfterCompletion: "Mensalmente (após conclusão)",
			customRecurrence: "Recorrência personalizada...",
			clearRecurrence: "Limpar recorrência",
			customRecurrenceModal: {
				title: "Recorrência Personalizada",
				startDate: "Data de início",
				startDateDesc: "A data em que o padrão de recorrência começa",
				startTime: "Hora de início",
				startTimeDesc: "A hora em que as instâncias recorrentes devem aparecer (opcional)",
				recurFrom: "Recorrer a partir de",
				recurFromDesc: "Quando a próxima ocorrência deve ser calculada?",
				scheduledDate: "Data agendada",
				completionDate: "Data de conclusão",
				frequency: "Frequência",
				interval: "Intervalo",
				intervalDesc: "A cada X dias/semanas/meses/anos",
				daysOfWeek: "Dias da semana",
				daysOfWeekDesc: "Selecione dias específicos (para recorrência semanal)",
				monthlyRecurrence: "Recorrência mensal",
				monthlyRecurrenceDesc: "Escolha como repetir mensalmente",
				yearlyRecurrence: "Recorrência anual",
				yearlyRecurrenceDesc: "Escolha como repetir anualmente",
				endCondition: "Condição de término",
				endConditionDesc: "Escolha quando a recorrência deve terminar",
				neverEnds: "Nunca termina",
				endAfterOccurrences: "Terminar após {count} ocorrências",
				endOnDate: "Terminar em {date}",
				onDayOfMonth: "No dia {day} de cada mês",
				onTheWeekOfMonth: "Na {week} {day} de cada mês",
				onDateOfYear: "Em {day} de {month} de cada ano",
				onTheWeekOfYear: "Na {week} {day} de {month} de cada ano",
				frequencies: {
					daily: "Diariamente",
					weekly: "Semanalmente",
					monthly: "Mensalmente",
					yearly: "Anualmente"
				},
				weekPositions: {
					first: "primeira",
					second: "segunda",
					third: "terceira",
					fourth: "quarta",
					last: "última"
				},
				weekdays: {
					monday: "Segunda-feira",
					tuesday: "Terça-feira",
					wednesday: "Quarta-feira",
					thursday: "Quinta-feira",
					friday: "Sexta-feira",
					saturday: "Sábado",
					sunday: "Domingo"
				},
				weekdaysShort: {
					mon: "Seg",
					tue: "Ter",
					wed: "Qua",
					thu: "Qui",
					fri: "Sex",
					sat: "Sáb",
					sun: "Dom"
				},
				cancel: "Cancelar",
				save: "Salvar"
			}
		}
	}
};

export type PtTranslationSchema = typeof pt;
