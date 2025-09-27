import { NaturalLanguageParser, ParsedTaskData } from './NaturalLanguageParser';
import { StatusConfig } from '../types';

/**
 * Service responsible for status suggestion logic and natural language processing.
 * Follows Single Responsibility Principle by separating business logic from UI concerns.
 */
export class StatusSuggestionService {
    private nlpParser: NaturalLanguageParser;

    constructor(
        statusConfigs: StatusConfig[],
        priorityConfigs: any[],
        defaultToScheduled: boolean,
        languageCode = 'en'
    ) {
        this.nlpParser = new NaturalLanguageParser(
            statusConfigs,
            priorityConfigs,
            defaultToScheduled,
            languageCode
        );
    }

    /**
     * Extract status and other task data from natural language input
     */
    extractTaskDataFromInput(input: string): ParsedTaskData {
        return this.nlpParser.parseInput(input);
    }

    /**
     * Get status suggestions based on query
     */
    getStatusSuggestions(
        query: string,
        statusConfigs: StatusConfig[],
        limit = 10
    ): StatusSuggestion[] {
        const q = query.toLowerCase();
        return statusConfigs
            .filter(s => s && typeof s.value === 'string' && typeof s.label === 'string')
            .filter(s => s.value.trim() !== '' && s.label.trim() !== '') // Filter out empty values
            .filter(s => s.value.toLowerCase().includes(q) || s.label.toLowerCase().includes(q))
            .slice(0, limit)
            .map(s => ({
                value: s.value,
                label: s.label,
                display: s.label,
                type: 'status' as const,
                toString() { return this.value; }
            }));
    }

    /**
     * Check if text contains a status trigger
     */
    hasStatusTrigger(text: string, trigger: string, cursorPos: number): boolean {
        if (!trigger.trim()) return false;
        
        const textBeforeCursor = text.slice(0, cursorPos);
        const lastTriggerIndex = textBeforeCursor.lastIndexOf(trigger);
        
        return lastTriggerIndex !== -1;
    }

    /**
     * Extract query after status trigger
     */
    extractQueryAfterTrigger(text: string, trigger: string, cursorPos: number): string {
        if (!trigger.trim()) return '';
        
        const textBeforeCursor = text.slice(0, cursorPos);
        const lastTriggerIndex = textBeforeCursor.lastIndexOf(trigger);
        
        if (lastTriggerIndex === -1) return '';
        
        const queryStart = lastTriggerIndex + trigger.length;
        const queryAfterTrigger = textBeforeCursor.slice(queryStart);
        
        // Stop at whitespace or other triggers
        const match = queryAfterTrigger.match(/^[^\s@#+]*/);
        return match ? match[0] : '';
    }

    /**
     * Apply status selection to input text
     */
    applyStatusSelection(
        text: string, 
        trigger: string, 
        cursorPos: number, 
        selectedStatus: StatusSuggestion
    ): { newText: string; newCursorPos: number } {
        if (!trigger.trim()) {
            return { newText: text, newCursorPos: cursorPos };
        }

        const textBeforeCursor = text.slice(0, cursorPos);
        const textAfterCursor = text.slice(cursorPos);
        const lastTriggerIndex = textBeforeCursor.lastIndexOf(trigger);

        if (lastTriggerIndex === -1) {
            return { newText: text, newCursorPos: cursorPos };
        }

        // Replace from trigger to cursor with the selected status label
        const beforeTrigger = text.slice(0, lastTriggerIndex);
        const replacement = selectedStatus.label;
        const newText = beforeTrigger + replacement + textAfterCursor;
        const newCursorPos = lastTriggerIndex + replacement.length;

        return { newText, newCursorPos };
    }

    /**
     * Validate if status suggestion is applicable
     */
    isValidStatusContext(text: string, cursorPos: number): boolean {
        // Basic validation - can be extended with more sophisticated logic
        const textBeforeCursor = text.slice(0, cursorPos);
        
        // Don't suggest inside quotes or other special contexts
        const quoteCount = (textBeforeCursor.match(/"/g) || []).length;
        const isInsideQuotes = quoteCount % 2 === 1;
        
        return !isInsideQuotes;
    }
}

/**
 * Status suggestion interface for UI components
 */
export interface StatusSuggestion {
    value: string; // status value (e.g., 'in-progress')
    label: string; // human label (e.g., 'In Progress')
    display: string; // shown in list (use label)
    type: 'status';
    toString(): string;
}
