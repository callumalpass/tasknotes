import { NLPLanguageConfig } from './types';

/**
 * German language configuration for Natural Language Processing
 * Translated patterns for German-speaking users
 */
export const deConfig: NLPLanguageConfig = {
    code: 'de',
    name: 'Deutsch',
    chronoLocale: 'de', // chrono-node has partial German support
    
    dateTriggers: {
        due: ['fällig', 'termin', 'abgabe', 'deadline', 'bis zum', 'bis'],
        scheduled: ['geplant für', 'geplant am', 'beginnen am', 'anfangen am', 'arbeiten an', 'am']
    },
    
    recurrence: {
        frequencies: {
            daily: ['täglich', 'jeden Tag', 'alle Tage', 'tagaus tagein'],
            weekly: ['wöchentlich', 'jede Woche', 'alle Wochen'],
            monthly: ['monatlich', 'jeden Monat', 'alle Monate'],
            yearly: ['jährlich', 'jedes Jahr', 'alle Jahre']
        },
        
        every: ['jede', 'jeden', 'jedes', 'alle'],
        other: ['andere', 'anderen', 'anderes'],
        
        weekdays: {
            monday: ['montag', 'montags'],
            tuesday: ['dienstag', 'dienstags'],
            wednesday: ['mittwoch', 'mittwochs'],
            thursday: ['donnerstag', 'donnerstags'],
            friday: ['freitag', 'freitags'],
            saturday: ['samstag', 'samstags'],
            sunday: ['sonntag', 'sonntags']
        },
        
        ordinals: {
            first: ['erste', 'ersten', 'erster'],
            second: ['zweite', 'zweiten', 'zweiter'],
            third: ['dritte', 'dritten', 'dritter'],
            fourth: ['vierte', 'vierten', 'vierter'],
            last: ['letzte', 'letzten', 'letzter']
        },
        
        periods: {
            day: ['tag', 'tage'],
            week: ['woche', 'wochen'],
            month: ['monat', 'monate'],
            year: ['jahr', 'jahre']
        }
    },
    
    timeEstimate: {
        hours: ['h', 'std', 'stunde', 'stunden'],
        minutes: ['m', 'min', 'minute', 'minuten']
    },
    
    fallbackStatus: {
        open: ['offen', 'zu erledigen', 'ausstehend', 'todo'],
        inProgress: ['in bearbeitung', 'wird bearbeitet', 'läuft', 'in arbeit'],
        done: ['erledigt', 'fertig', 'abgeschlossen', 'gemacht'],
        cancelled: ['abgebrochen', 'storniert', 'abgesagt'],
        waiting: ['wartend', 'warten', 'blockiert', 'pausiert']
    },
    
    fallbackPriority: {
        urgent: ['dringend', 'eilig', 'kritisch', 'sofort', 'höchste'],
        high: ['hoch', 'hohe', 'wichtig', 'prioritär'],
        normal: ['normal', 'mittel', 'mittlere', 'standard'],
        low: ['niedrig', 'niedrige', 'gering', 'geringe']
    }
};