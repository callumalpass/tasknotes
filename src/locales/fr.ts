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
            daily: ['quotidien', 'quotidienne', 'quotidiennement', 'chaque jour', 'tous les jours', 'journalier', 'journalière'],
            weekly: ['hebdomadaire', 'chaque semaine', 'toutes les semaines', 'par semaine'],
            monthly: ['mensuel', 'mensuelle', 'mensuellement', 'chaque mois', 'tous les mois', 'par mois'],
            yearly: ['annuel', 'annuelle', 'annuellement', 'chaque année', 'tous les ans', 'par an', 'par année']
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
        urgent: ['urgent', 'urgente', 'critique', 'maximum', 'prioritaire'],
        high: ['élevé', 'élevée', 'haut', 'haute', 'important', 'importante', 'supérieur', 'supérieure'],
        normal: ['moyen', 'moyenne', 'normal', 'normale', 'standard', 'régulier', 'régulière'],
        low: ['faible', 'bas', 'basse', 'mineur', 'mineure', 'minimum']
    }
};