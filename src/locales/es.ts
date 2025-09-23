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
            daily: ['diario', 'diaria', 'diariamente', 'cada día', 'todos los días', 'a diario'],
            weekly: ['semanal', 'semanalmente', 'cada semana', 'todas las semanas', 'por semana'],
            monthly: ['mensual', 'mensualmente', 'cada mes', 'todos los meses', 'por mes'],
            yearly: ['anual', 'anualmente', 'cada año', 'todos los años', 'por año']
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
        
        pluralWeekdays: {
            monday: ['lunes'],
            tuesday: ['martes'],
            wednesday: ['miércoles'],
            thursday: ['jueves'],
            friday: ['viernes'],
            saturday: ['sábados'],
            sunday: ['domingos']
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
        urgent: ['urgente', 'crítico', 'crítica', 'máximo', 'máxima', 'prioritario', 'prioritaria'],
        high: ['alto', 'alta', 'importante', 'elevado', 'elevada'],
        normal: ['medio', 'media', 'normal', 'regular', 'estándar'],
        low: ['bajo', 'baja', 'menor', 'mínimo', 'mínima']
    }
};