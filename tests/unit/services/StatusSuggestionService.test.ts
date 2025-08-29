import { StatusSuggestionService, StatusSuggestion } from '../../../src/services/StatusSuggestionService';
import { StatusConfiguration } from '../../../src/types';

describe('StatusSuggestionService', () => {
    let service: StatusSuggestionService;
    let mockStatusConfigs: StatusConfiguration[];
    let mockPriorityConfigs: any[];

    beforeEach(() => {
        mockStatusConfigs = [
            { id: 'open', value: 'open', label: 'Open', color: '#808080', isCompleted: false, order: 1 },
            { id: 'active', value: 'active', label: 'Active = Now', color: '#0066cc', isCompleted: false, order: 2 },
            { id: 'in-progress', value: 'in-progress', label: 'In Progress', color: '#ff9900', isCompleted: false, order: 3 },
            { id: 'done', value: 'done', label: 'Done', color: '#00aa00', isCompleted: true, order: 4 }
        ];

        mockPriorityConfigs = [
            { id: 'normal', value: 'normal', label: 'Normal', color: '#ffaa00', weight: 2 }
        ];

        service = new StatusSuggestionService(mockStatusConfigs, mockPriorityConfigs, false);
    });

    describe('extractTaskDataFromInput', () => {
        it('should extract status from natural language input', () => {
            const result = service.extractTaskDataFromInput('Task Active = Now tomorrow');
            
            expect(result.status).toBe('active');
            expect(result.title).toBe('Task');
            expect(result.dueDate).toBeDefined();
        });

        it('should handle input without status', () => {
            const result = service.extractTaskDataFromInput('Simple task tomorrow');
            
            expect(result.status).toBeUndefined();
            expect(result.title).toBe('Simple task');
            expect(result.dueDate).toBeDefined();
        });

        it('should extract status before date parsing to prevent conflicts', () => {
            const result = service.extractTaskDataFromInput('Task Active = Now tomorrow at 3pm');
            
            expect(result.status).toBe('active');
            expect(result.title).toBe('Task');
            expect(result.dueDate).toBeDefined();
            expect(result.dueTime).toBeDefined();
        });
    });

    describe('getStatusSuggestions', () => {
        it('should return matching status suggestions by value', () => {
            const suggestions = service.getStatusSuggestions('act', mockStatusConfigs);
            
            expect(suggestions).toHaveLength(1);
            expect(suggestions[0].value).toBe('active');
            expect(suggestions[0].label).toBe('Active = Now');
            expect(suggestions[0].type).toBe('status');
        });

        it('should return matching status suggestions by label', () => {
            const suggestions = service.getStatusSuggestions('progress', mockStatusConfigs);
            
            expect(suggestions).toHaveLength(1);
            expect(suggestions[0].value).toBe('in-progress');
            expect(suggestions[0].label).toBe('In Progress');
        });

        it('should return multiple matches when applicable', () => {
            const suggestions = service.getStatusSuggestions('o', mockStatusConfigs);
            
            expect(suggestions.length).toBeGreaterThan(1);
            expect(suggestions.some(s => s.value === 'open')).toBe(true);
            expect(suggestions.some(s => s.value === 'done')).toBe(true);
        });

        it('should respect the limit parameter', () => {
            const suggestions = service.getStatusSuggestions('', mockStatusConfigs, 2);
            
            expect(suggestions).toHaveLength(2);
        });

        it('should handle empty query', () => {
            const suggestions = service.getStatusSuggestions('', mockStatusConfigs);
            
            expect(suggestions).toHaveLength(4); // All statuses match empty query
        });

        it('should handle case insensitive matching', () => {
            const suggestions = service.getStatusSuggestions('ACTIVE', mockStatusConfigs);
            
            expect(suggestions).toHaveLength(1);
            expect(suggestions[0].value).toBe('active');
        });
    });

    describe('hasStatusTrigger', () => {
        it('should detect status trigger in text', () => {
            const hasStatus = service.hasStatusTrigger('Task with *act', '*', 12);
            
            expect(hasStatus).toBe(true);
        });

        it('should return false when no trigger present', () => {
            const hasStatus = service.hasStatusTrigger('Task without trigger', '*', 10);
            
            expect(hasStatus).toBe(false);
        });

        it('should handle empty trigger', () => {
            const hasStatus = service.hasStatusTrigger('Task with text', '', 10);
            
            expect(hasStatus).toBe(false);
        });

        it('should consider cursor position', () => {
            const text = 'Task *act more text';
            
            expect(service.hasStatusTrigger(text, '*', 9)).toBe(true); // After trigger
            expect(service.hasStatusTrigger(text, '*', 4)).toBe(false); // Before trigger
        });
    });

    describe('extractQueryAfterTrigger', () => {
        it('should extract query after trigger', () => {
            const query = service.extractQueryAfterTrigger('Task *active', '*', 12);

            expect(query).toBe('active');
        });

        it('should stop at whitespace', () => {
            const query = service.extractQueryAfterTrigger('Task *act more', '*', 9);
            
            expect(query).toBe('act');
        });

        it('should handle partial queries', () => {
            const query = service.extractQueryAfterTrigger('Task *a', '*', 7);
            
            expect(query).toBe('a');
        });

        it('should return empty string when no trigger', () => {
            const query = service.extractQueryAfterTrigger('Task without trigger', '*', 10);
            
            expect(query).toBe('');
        });
    });

    describe('applyStatusSelection', () => {
        it('should replace trigger and query with selected status', () => {
            const statusSuggestion: StatusSuggestion = {
                value: 'active',
                label: 'Active = Now',
                display: 'Active = Now',
                type: 'status',
                toString() { return this.value; }
            };

            const result = service.applyStatusSelection('Task *act', '*', 9, statusSuggestion);
            
            expect(result.newText).toBe('Task Active = Now');
            expect(result.newCursorPos).toBe(17); // After "Active = Now"
        });

        it('should preserve text after cursor', () => {
            const statusSuggestion: StatusSuggestion = {
                value: 'done',
                label: 'Done',
                display: 'Done',
                type: 'status',
                toString() { return this.value; }
            };

            const result = service.applyStatusSelection('Task *d more text', '*', 7, statusSuggestion);
            
            expect(result.newText).toBe('Task Done more text');
        });

        it('should handle empty trigger gracefully', () => {
            const statusSuggestion: StatusSuggestion = {
                value: 'active',
                label: 'Active',
                display: 'Active',
                type: 'status',
                toString() { return this.value; }
            };

            const result = service.applyStatusSelection('Task text', '', 5, statusSuggestion);
            
            expect(result.newText).toBe('Task text');
            expect(result.newCursorPos).toBe(5);
        });
    });

    describe('isValidStatusContext', () => {
        it('should return true for normal text context', () => {
            const isValid = service.isValidStatusContext('Task with normal text', 10);
            
            expect(isValid).toBe(true);
        });

        it('should return false when inside quotes', () => {
            const isValid = service.isValidStatusContext('Task with "quoted text', 18);
            
            expect(isValid).toBe(false);
        });

        it('should return true when quotes are closed', () => {
            const isValid = service.isValidStatusContext('Task with "quoted" text', 20);
            
            expect(isValid).toBe(true);
        });
    });
});
