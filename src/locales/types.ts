/**
 * Language configuration for Natural Language Processing
 * Defines patterns and keywords for different languages
 */

export interface NLPLanguageConfig {
    /** Language code (e.g., 'en', 'es', 'fr') */
    code: string;
    
    /** Display name of the language */
    name: string;
    
    /** Chrono-node locale key (e.g., 'en', 'es', 'fr') */
    chronoLocale: string;
    
    /** Date-related trigger words */
    dateTriggers: {
        /** Due date triggers (e.g., "due", "deadline", "by") */
        due: string[];
        
        /** Scheduled date triggers (e.g., "scheduled", "start", "on") */
        scheduled: string[];
    };
    
    /** Recurrence pattern keywords */
    recurrence: {
        /** General frequency words */
        frequencies: {
            daily: string[];
            weekly: string[];
            monthly: string[];
            yearly: string[];
        };
        
        /** "every" keyword variations */
        every: string[];
        
        /** "other" keyword for "every other" patterns */
        other: string[];
        
        /** Weekday names (full forms) */
        weekdays: {
            monday: string[];
            tuesday: string[];
            wednesday: string[];
            thursday: string[];
            friday: string[];
            saturday: string[];
            sunday: string[];
        };
        
        /** Ordinal indicators for "every [ordinal] [weekday]" */
        ordinals: {
            first: string[];
            second: string[];
            third: string[];
            fourth: string[];
            last: string[];
        };
        
        /** Time period words */
        periods: {
            day: string[];
            week: string[];
            month: string[];
            year: string[];
        };
    };
    
    /** Time estimate keywords */
    timeEstimate: {
        /** Hour indicators */
        hours: string[];
        
        /** Minute indicators */  
        minutes: string[];
    };
    
    /** Fallback status keywords (only used if user hasn't configured custom ones) */
    fallbackStatus: {
        open: string[];
        inProgress: string[];
        done: string[];
        cancelled: string[];
        waiting: string[];
    };
    
    /** Fallback priority keywords (only used if user hasn't configured custom ones) */
    fallbackPriority: {
        urgent: string[];
        high: string[];
        normal: string[];
        low: string[];
    };
}

/** Registry of available language configurations */
export interface LanguageRegistry {
    [languageCode: string]: NLPLanguageConfig;
}