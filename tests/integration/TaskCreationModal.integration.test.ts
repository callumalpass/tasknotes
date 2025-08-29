import { StatusSuggestionService } from '../../src/services/StatusSuggestionService';
import { StatusConfiguration } from '../../src/types';

describe('StatusSuggestionService Integration', () => {
    let statusSuggestionService: StatusSuggestionService;
    let mockStatusConfigs: StatusConfiguration[];

    beforeEach(() => {
        mockStatusConfigs = [
            { id: 'open', value: 'open', label: 'Open', color: '#808080', isCompleted: false, order: 1 },
            { id: 'active', value: 'active', label: 'Active = Now', color: '#0066cc', isCompleted: false, order: 2 },
            { id: 'in-progress', value: 'in-progress', label: 'In Progress', color: '#ff9900', isCompleted: false, order: 3 },
            { id: 'done', value: 'done', label: 'Done', color: '#00aa00', isCompleted: true, order: 4 }
        ];

        const mockPriorityConfigs = [
            { id: 'normal', value: 'normal', label: 'Normal', color: '#ffaa00', weight: 2 }
        ];

        statusSuggestionService = new StatusSuggestionService(
            mockStatusConfigs,
            mockPriorityConfigs,
            false
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Status Suggestion Integration', () => {
        it('should extract status from natural language input using injected service', () => {
            const input = 'Task Active = Now tomorrow at 3pm';
            const result = statusSuggestionService.extractTaskDataFromInput(input);

            expect(result.status).toBe('active');
            expect(result.title).toBe('Task');
            expect(result.dueDate).toBeDefined();
            expect(result.dueTime).toBeDefined();
        });

        it('should get status suggestions using injected service', () => {
            const suggestions = statusSuggestionService.getStatusSuggestions('act', mockStatusConfigs);

            expect(suggestions).toHaveLength(1);
            expect(suggestions[0].value).toBe('active');
            expect(suggestions[0].label).toBe('Active = Now');
            expect(suggestions[0].type).toBe('status');
        });

        it('should handle status trigger detection', () => {
            const hasStatus = statusSuggestionService.hasStatusTrigger('Task *act', '*', 9);
            expect(hasStatus).toBe(true);

            const query = statusSuggestionService.extractQueryAfterTrigger('Task *act', '*', 9);
            expect(query).toBe('act');
        });

        it('should apply status selection correctly', () => {
            const statusSuggestion = {
                value: 'active',
                label: 'Active = Now',
                display: 'Active = Now',
                type: 'status' as const,
                toString() { return this.value; }
            };

            const result = statusSuggestionService.applyStatusSelection(
                'Task *act',
                '*',
                9,
                statusSuggestion
            );

            expect(result.newText).toBe('Task Active = Now');
            expect(result.newCursorPos).toBe(17);
        });
    });



    describe('Business Logic Separation', () => {
        it('should handle complex status extraction scenarios', () => {
            const testCases = [
                {
                    input: 'Task Active = Now tomorrow at 3pm @work #important',
                    expectedStatus: 'active',
                    expectedTitle: 'Task'
                },
                {
                    input: 'Meeting In Progress next week',
                    expectedStatus: 'in-progress',
                    expectedTitle: 'Meeting'
                },
                {
                    input: 'Simple task without status tomorrow',
                    expectedStatus: undefined,
                    expectedTitle: 'Simple task without status'
                }
            ];

            testCases.forEach(({ input, expectedStatus, expectedTitle }) => {
                const result = statusSuggestionService.extractTaskDataFromInput(input);
                expect(result.status).toBe(expectedStatus);
                expect(result.title).toBe(expectedTitle);
            });
        });

        it('should maintain status extraction order to prevent date conflicts', () => {
            // Test the critical requirement: status before date parsing
            const result = statusSuggestionService.extractTaskDataFromInput('Task Active = Now tomorrow');
            
            expect(result.status).toBe('active');
            expect(result.title).toBe('Task');
            expect(result.dueDate).toBeDefined(); // "tomorrow" should be parsed as date
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle empty input gracefully', () => {
            const result = statusSuggestionService.extractTaskDataFromInput('');
            expect(result.title).toBe('Untitled Task'); // Default from NLP parser
        });

        it('should handle invalid status configurations', () => {
            const invalidConfigs = [
                null,
                { id: 'invalid' }, // Missing required fields
                { id: 'partial', value: 'test' } // Missing label
            ] as any;

            const suggestions = statusSuggestionService.getStatusSuggestions('test', invalidConfigs);
            expect(suggestions).toHaveLength(0); // Should filter out invalid configs
        });

        it('should validate status context appropriately', () => {
            expect(statusSuggestionService.isValidStatusContext('Normal text', 5)).toBe(true);
            expect(statusSuggestionService.isValidStatusContext('Text with "quotes', 15)).toBe(false);
            expect(statusSuggestionService.isValidStatusContext('Text with "closed quotes"', 25)).toBe(true);
        });
    });
});
