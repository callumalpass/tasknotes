import { NLPLanguageConfig } from './types';

/**
 * Dutch language configuration for Natural Language Processing
 * Translated patterns for Dutch-speaking users
 */
export const nlConfig: NLPLanguageConfig = {
    code: 'nl',
    name: 'Nederlands',
    chronoLocale: 'nl',
    
    dateTriggers: {
        due: ['vervalt op', 'deadline', 'moet klaar zijn op', 'tegen', 'uiterlijk', 'voor'],
        scheduled: ['gepland voor', 'gepland op', 'beginnen op', 'werken aan', 'op', 'voor']
    },
    
    recurrence: {
        frequencies: {
            daily: ['dagelijks', 'elke dag', 'alle dagen', 'per dag'],
            weekly: ['wekelijks', 'elke week', 'alle weken', 'per week'],
            monthly: ['maandelijks', 'elke maand', 'alle maanden', 'per maand'],
            yearly: ['jaarlijks', 'elk jaar', 'alle jaren', 'per jaar']
        },
        
        every: ['elke', 'alle', 'iedere'],
        other: ['andere', 'ander'],
        
        weekdays: {
            monday: ['maandag'],
            tuesday: ['dinsdag'],
            wednesday: ['woensdag'],
            thursday: ['donderdag'],
            friday: ['vrijdag'],
            saturday: ['zaterdag'],
            sunday: ['zondag']
        },
        
        pluralWeekdays: {
            monday: ['maandagen'],
            tuesday: ['dinsdagen'],
            wednesday: ['woensdagen'],
            thursday: ['donderdagen'],
            friday: ['vrijdagen'],
            saturday: ['zaterdagen'],
            sunday: ['zondagen']
        },
        
        ordinals: {
            first: ['eerste'],
            second: ['tweede'],
            third: ['derde'],
            fourth: ['vierde'],
            last: ['laatste']
        },
        
        periods: {
            day: ['dag', 'dagen'],
            week: ['week', 'weken'],
            month: ['maand', 'maanden'],
            year: ['jaar', 'jaren']
        }
    },
    
    timeEstimate: {
        hours: ['u', 'uur', 'uren', 'h'],
        minutes: ['m', 'min', 'minuut', 'minuten']
    },
    
    fallbackStatus: {
        open: ['te doen', 'open', 'nog te doen', 'todo', 'openstaand'],
        inProgress: ['bezig', 'in behandeling', 'aan het werk', 'lopend', 'in uitvoering'],
        done: ['klaar', 'voltooid', 'gedaan', 'afgerond', 'gesloten'],
        cancelled: ['geannuleerd', 'afgezegd', 'ingetrokken'],
        waiting: ['wachtend', 'in de wacht', 'geblokkeerd', 'uitgesteld']
    },
    
    fallbackPriority: {
        urgent: ['urgent', 'kritiek', 'hoogste', 'spoed', 'direct'],
        high: ['hoog', 'hoge', 'belangrijk', 'belangrijke'],
        normal: ['normaal', 'normale', 'gemiddeld', 'standaard'],
        low: ['laag', 'lage', 'klein', 'kleine', 'onbelangrijk']
    }
};