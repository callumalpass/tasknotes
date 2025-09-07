import { NLPLanguageConfig } from './types';

/**
 * French language configuration for Natural Language Processing
 * Translated patterns for French-speaking users
 */
export const frConfig: NLPLanguageConfig = {
    code: 'fr',
    name: 'Français',
    chronoLocale: 'fr', // chrono-node has full French support
    
    dateTriggers: {
        due: ['échéance', 'date limite', 'doit être terminé', 'pour le', 'avant le'],
        scheduled: ['programmé pour', 'programmé le', 'commencer le', 'débuter le', 'travailler sur', 'le']
    },
    
    recurrence: {
        frequencies: {
            daily: ['quotidien', 'quotidiennement', 'chaque jour', 'tous les jours'],
            weekly: ['hebdomadaire', 'chaque semaine', 'toutes les semaines'],
            monthly: ['mensuel', 'mensuellement', 'chaque mois', 'tous les mois'],
            yearly: ['annuel', 'annuellement', 'chaque année', 'tous les ans']
        },
        
        every: ['chaque', 'tous les', 'toutes les'],
        other: ['autre'],
        
        weekdays: {
            monday: ['lundi'],
            tuesday: ['mardi'],
            wednesday: ['mercredi'],
            thursday: ['jeudi'],
            friday: ['vendredi'],
            saturday: ['samedi'],
            sunday: ['dimanche']
        },
        
        ordinals: {
            first: ['premier', 'première'],
            second: ['deuxième', 'second', 'seconde'],
            third: ['troisième'],
            fourth: ['quatrième'],
            last: ['dernier', 'dernière']
        },
        
        periods: {
            day: ['jour', 'jours'],
            week: ['semaine', 'semaines'],
            month: ['mois'],
            year: ['an', 'ans', 'année', 'années']
        }
    },
    
    timeEstimate: {
        hours: ['h', 'hr', 'hrs', 'heure', 'heures'],
        minutes: ['m', 'min', 'mins', 'minute', 'minutes']
    },
    
    fallbackStatus: {
        open: ['à faire', 'ouvert', 'en attente', 'todo'],
        inProgress: ['en cours', 'en progression', 'en train de faire'],
        done: ['terminé', 'fini', 'accompli', 'fait'],
        cancelled: ['annulé', 'abandonné'],
        waiting: ['en attente', 'bloqué', 'suspendu']
    },
    
    fallbackPriority: {
        urgent: ['urgent', 'critique', 'maximum'],
        high: ['élevé', 'élevée', 'haut', 'haute', 'important', 'importante'],
        normal: ['moyen', 'moyenne', 'normal', 'normale'],
        low: ['faible', 'bas', 'basse', 'mineur', 'mineure']
    }
};