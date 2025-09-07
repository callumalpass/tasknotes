import { NLPLanguageConfig } from './types';

/**
 * Spanish language configuration for Natural Language Processing
 * Translated patterns for Spanish-speaking users
 */
export const esConfig: NLPLanguageConfig = {
    code: 'es',
    name: 'Español',
    chronoLocale: 'es', // Note: chrono-node has partial Spanish support
    
    dateTriggers: {
        due: ['vence', 'fecha límite', 'debe terminarse', 'para el', 'antes del'],
        scheduled: ['programado para', 'programado el', 'comenzar el', 'empezar el', 'trabajar en', 'el']
    },
    
    recurrence: {
        frequencies: {
            daily: ['diario', 'diariamente', 'cada día', 'todos los días'],
            weekly: ['semanal', 'semanalmente', 'cada semana'],
            monthly: ['mensual', 'mensualmente', 'cada mes'],
            yearly: ['anual', 'anualmente', 'cada año']
        },
        
        every: ['cada', 'todos los', 'todas las'],
        other: ['otro', 'otra'],
        
        weekdays: {
            monday: ['lunes'],
            tuesday: ['martes'],
            wednesday: ['miércoles'],
            thursday: ['jueves'],
            friday: ['viernes'],
            saturday: ['sábado'],
            sunday: ['domingo']
        },
        
        ordinals: {
            first: ['primer', 'primera', 'primero'],
            second: ['segundo', 'segunda'],
            third: ['tercer', 'tercera', 'tercero'],
            fourth: ['cuarto', 'cuarta'],
            last: ['último', 'última']
        },
        
        periods: {
            day: ['día', 'días'],
            week: ['semana', 'semanas'],
            month: ['mes', 'meses'],
            year: ['año', 'años']
        }
    },
    
    timeEstimate: {
        hours: ['h', 'hr', 'hrs', 'hora', 'horas'],
        minutes: ['m', 'min', 'mins', 'minuto', 'minutos']
    },
    
    fallbackStatus: {
        open: ['pendiente', 'por hacer', 'abierto', 'todo'],
        inProgress: ['en progreso', 'en curso', 'haciendo', 'trabajando'],
        done: ['hecho', 'terminado', 'completado', 'finalizado'],
        cancelled: ['cancelado', 'anulado'],
        waiting: ['esperando', 'bloqueado', 'en espera']
    },
    
    fallbackPriority: {
        urgent: ['urgente', 'crítico', 'máximo'],
        high: ['alto', 'alta', 'importante'],
        normal: ['medio', 'media', 'normal'],
        low: ['bajo', 'baja', 'menor']
    }
};