import { TranslationTree } from '../types';

export const fr: TranslationTree = {
    common: {
        appName: 'TaskNotes',
        cancel: 'Annuler',
        confirm: 'Confirmer',
        close: 'Fermer',
        save: 'Enregistrer',
        language: 'Langue',
        systemDefault: 'Langue du système',
        languages: {
            en: 'Anglais',
            fr: 'Français'
        }
    },
    views: {
        agenda: {
            title: 'Agenda'
        },
        taskList: {
            title: 'Tâches'
        },
        notes: {
            title: 'Notes'
        },
        miniCalendar: {
            title: 'Mini calendrier'
        },
        advancedCalendar: {
            title: 'Calendrier avancé'
        },
        kanban: {
            title: 'Kanban'
        },
        pomodoro: {
            title: 'Pomodoro',
            status: {
                focus: 'Focus',
                ready: 'Prêt à démarrer',
                paused: 'En pause',
                working: 'En travail',
                shortBreak: 'Pause courte',
                longBreak: 'Pause longue',
                breakPrompt: 'Bravo ! C\'est l\'heure d\'une pause {length}',
                breakLength: {
                    short: 'courte',
                    long: 'longue'
                },
                breakComplete: 'Pause terminée ! Prêt pour le prochain pomodoro ?'
            },
            buttons: {
                start: 'Démarrer',
                pause: 'Pause',
                stop: 'Arrêter',
                resume: 'Reprendre',
                startShortBreak: 'Commencer la pause courte',
                startLongBreak: 'Commencer la pause longue',
                skipBreak: 'Passer la pause',
                chooseTask: 'Choisir une tâche...',
                changeTask: 'Changer de tâche...',
                clearTask: 'Effacer la tâche',
                selectDifferentTask: 'Sélectionner une autre tâche'
            },
            notices: {
                noTasks: 'Aucune tâche non archivée retrouvée. Créez d\'abord quelques tâches.',
                loadFailed: 'Impossible de charger les tâches'
            },
            statsLabel: 'terminées aujourd\'hui'
        },
        pomodoroStats: {
            title: 'Statistiques Pomodoro',
            heading: 'Statistiques Pomodoro',
            refresh: 'Actualiser',
            sections: {
                overview: 'Aperçu',
                today: "Aujourd'hui",
                week: 'Cette semaine',
                allTime: 'Historique',
                recent: 'Sessions récentes'
            },
            overviewCards: {
                todayPomos: {
                    label: 'Pomodoros du jour',
                    change: {
                        more: '{count} de plus qu\'hier',
                        less: '{count} de moins qu\'hier'
                    }
                },
                totalPomos: {
                    label: 'Total des pomodoros'
                },
                todayFocus: {
                    label: 'Temps de focus du jour',
                    change: {
                        more: '{duration} de plus qu\'hier',
                        less: '{duration} de moins qu\'hier'
                    }
                },
                totalFocus: {
                    label: 'Durée de focus cumulée'
                }
            },
            stats: {
                pomodoros: 'Pomodoros',
                streak: 'Série',
                minutes: 'Minutes',
                average: 'Durée moy.',
                completion: 'Taux d\'achèvement'
            },
            recents: {
                empty: 'Aucune session enregistrée pour le moment',
                duration: '{minutes} min',
                status: {
                    completed: 'Terminée',
                    interrupted: 'Interrompue'
                }
            }
        },
        stats: {
            title: 'Statistiques'
        }
    },
    settings: {
        tabs: {
            general: 'Général',
            taskProperties: 'Propriétés des tâches',
            defaults: 'Défauts et modèles',
            appearance: 'Apparence et interface',
            features: 'Fonctionnalités',
            integrations: 'Intégrations'
        },
        features: {
            inlineTasks: {
                header: 'Tâches dans les notes',
                description: 'Configurez les fonctionnalités de tâches intégrées pour gérer vos tâches directement dans vos notes.'
            },
            overlays: {
                taskLinkToggle: {
                    name: 'Survol des liens de tâches',
                    description: 'Afficher des superpositions interactives lorsque la souris passe sur les liens de tâches'
                }
            },
            instantConvert: {
                toggle: {
                    name: 'Conversion instantanée en tâche',
                    description: 'Activer la conversion instantanée de texte en tâche via les raccourcis clavier'
                },
                folder: {
                    name: 'Dossier pour la conversion',
                    description: 'Dossier utilisé pour les tâches converties. Utilisez {{currentNotePath}} pour un chemin relatif à la note actuelle'
                }
            },
            nlp: {
                header: 'Traitement du langage naturel',
                description: "Activez l'analyse intelligente des détails des tâches depuis le langage naturel.",
                enable: {
                    name: 'Activer la saisie en langage naturel',
                    description: 'Analyser les dates, priorités et contextes lors de la création de tâches'
                },
                defaultToScheduled: {
                    name: 'Planifié par défaut',
                    description: "Si une date est détectée sans contexte, la considérer comme planifiée plutôt qu'échéance"
                },
                language: {
                    name: 'Langue du NLP',
                    description: "Langue utilisée pour les modèles de traitement du langage naturel et l'analyse des dates"
                },
                statusTrigger: {
                    name: 'Déclencheur des statuts suggérés',
                    description: 'Texte qui déclenche les suggestions de statut (laisser vide pour désactiver)'
                }
            },
            pomodoro: {
                header: 'Minuteur Pomodoro',
                description: 'Minuteur Pomodoro intégré pour gérer le temps et suivre votre productivité.',
                workDuration: {
                    name: 'Durée de travail',
                    description: 'Durée des sessions de travail en minutes'
                },
                shortBreak: {
                    name: 'Durée de la pause courte',
                    description: 'Durée des pauses courtes en minutes'
                },
                longBreak: {
                    name: 'Durée de la pause longue',
                    description: 'Durée des pauses longues en minutes'
                },
                longBreakInterval: {
                    name: 'Intervalle des pauses longues',
                    description: 'Nombre de sessions de travail avant une pause longue'
                },
                autoStartBreaks: {
                    name: 'Lancer automatiquement les pauses',
                    description: 'Démarrer automatiquement les pauses après chaque session de travail'
                },
                autoStartWork: {
                    name: 'Reprise automatique du travail',
                    description: 'Démarrer automatiquement une session de travail après les pauses'
                },
                notifications: {
                    name: 'Notifications Pomodoro',
                    description: 'Afficher une notification lorsque les sessions Pomodoro se terminent'
                }
            },
            uiLanguage: {
                header: "Langue de l'interface",
                description: 'Modifiez la langue des menus, notifications et vues de TaskNotes.',
                dropdown: {
                    name: "Langue de l'interface",
                    description: "Sélectionnez la langue utilisée pour le texte de l'interface TaskNotes"
                }
            }
        }
    },
    notices: {
        languageChanged: 'Langue changée pour {language}.'
    },
    modals: {
        storageLocation: {
            title: {
                migrate: 'Migrer les données Pomodoro ?',
                switch: 'Basculer vers le stockage dans les notes quotidiennes ?'
            },
            message: {
                migrate: 'Cette action migre vos sessions Pomodoro existantes vers le frontmatter des notes quotidiennes. Les données seront regroupées par date et stockées dans chaque note.',
                switch: 'Les sessions Pomodoro seront désormais enregistrées dans le frontmatter de vos notes quotidiennes au lieu du fichier de données du plugin.'
            },
            whatThisMeans: 'Ce que cela implique :',
            bullets: {
                dailyNotesRequired: 'Le plugin noyau Daily Notes doit rester activé',
                storedInNotes: 'Les données seront stockées dans le frontmatter de vos notes quotidiennes',
                migrateData: 'Les données du plugin seront migrées puis vidées',
                futureSessions: 'Les futures sessions seront enregistrées dans les notes quotidiennes',
                dataLongevity: 'Cela garantit une meilleure pérennité des données avec vos notes'
            },
            finalNote: {
                migrate: '⚠️ Assurez-vous d’avoir des sauvegardes si nécessaire. Ce changement ne peut pas être annulé automatiquement.',
                switch: 'Vous pourrez revenir au stockage du plugin à tout moment par la suite.'
            },
            buttons: {
                migrate: 'Migrer les données',
                switch: 'Changer de stockage'
            }
        }
    }
};

export type FrTranslationSchema = typeof fr;
