import { NLPLanguageConfig } from './types';

/**
 * Italian language configuration for Natural Language Processing
 * Translated patterns for Italian-speaking users
 */
export const itConfig: NLPLanguageConfig = {
    code: 'it',
    name: 'Italiano',
    chronoLocale: 'it',
    
    dateTriggers: {
        due: ['scadenza', 'entro', 'entro il', 'deve essere fatto entro', 'per il', 'termine'],
        scheduled: ['programmato per', 'programmato il', 'iniziare il', 'lavorare su', 'il', 'per']
    },
    
    recurrence: {
        frequencies: {
            daily: ['giornaliero', 'giornaliera', 'quotidiano', 'quotidiana', 'ogni giorno', 'tutti i giorni', 'giornalmente'],
            weekly: ['settimanale', 'ogni settimana', 'tutte le settimane', 'settimanalmente', 'alla settimana'],
            monthly: ['mensile', 'ogni mese', 'tutti i mesi', 'mensilmente', 'al mese'],
            yearly: ['annuale', 'ogni anno', 'tutti gli anni', 'annualmente', 'all\'anno']
        },
        
        every: ['ogni', 'tutti i', 'tutte le'],
        other: ['altro', 'altra', 'altri', 'altre'],
        
        weekdays: {
            monday: ['lunedì'],
            tuesday: ['martedì'],
            wednesday: ['mercoledì'],
            thursday: ['giovedì'],
            friday: ['venerdì'],
            saturday: ['sabato'],
            sunday: ['domenica']
        },
        
        pluralWeekdays: {
            monday: ['lunedì'],
            tuesday: ['martedì'],
            wednesday: ['mercoledì'],
            thursday: ['giovedì'],
            friday: ['venerdì'],
            saturday: ['sabati'],
            sunday: ['domeniche']
        },
        
        ordinals: {
            first: ['primo', 'prima'],
            second: ['secondo', 'seconda'],
            third: ['terzo', 'terza'],
            fourth: ['quarto', 'quarta'],
            last: ['ultimo', 'ultima']
        },
        
        periods: {
            day: ['giorno', 'giorni'],
            week: ['settimana', 'settimane'],
            month: ['mese', 'mesi'],
            year: ['anno', 'anni']
        }
    },
    
    timeEstimate: {
        hours: ['h', 'hr', 'ore', 'ora', 'o'],
        minutes: ['m', 'min', 'minuto', 'minuti']
    },
    
    fallbackStatus: {
        open: ['da fare', 'aperto', 'pendente', 'todo', 'in sospeso'],
        inProgress: ['in corso', 'in progresso', 'facendo', 'lavorando'],
        done: ['fatto', 'completato', 'finito', 'terminato', 'chiuso'],
        cancelled: ['cancellato', 'annullato', 'rimosso'],
        waiting: ['in attesa', 'aspettando', 'bloccato', 'fermo']
    },
    
    fallbackPriority: {
        urgent: ['urgente', 'critico', 'critica', 'massimo', 'massima', 'prioritario', 'prioritaria'],
        high: ['alto', 'alta', 'importante', 'elevato', 'elevata'],
        normal: ['medio', 'media', 'normale', 'regolare', 'standard'],
        low: ['basso', 'bassa', 'minore', 'minimo', 'minima']
    }
};