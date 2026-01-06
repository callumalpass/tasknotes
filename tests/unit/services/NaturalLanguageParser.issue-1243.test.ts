import { NaturalLanguageParser } from '../../../src/services/NaturalLanguageParser';
import { StatusConfig, PriorityConfig } from '../../../src/types';
import { NLPTriggersConfig, UserMappedField } from '../../../src/types/settings';

/**
 * Tests for Issue #1243: Modal parser not deleting property text if it has space in it
 *
 * Bug Description: When using an expression with a space in the property value (quoted value),
 * the property text is not completely removed from the original task title.
 *
 * Example:
 * - Input: "my task key "multi word value""
 * - Expected title: "my task"
 * - Actual title: "my task word value"" (the quoted portion is not fully removed)
 *
 * The issue is in extractUserFields() where quoted values with spaces are matched
 * but the full matched text (trigger + quotes + value) may not be completely removed.
 *
 * @see https://github.com/obsidian-tasks-group/tasknotes/issues/1243
 */
describe('NaturalLanguageParser - Issue #1243: User field quoted values with spaces', () => {
    let mockStatusConfigs: StatusConfig[];
    let mockPriorityConfigs: PriorityConfig[];

    beforeEach(() => {
        mockStatusConfigs = [
            { id: 'open', value: 'open', label: 'Open', color: '#blue', isCompleted: false, order: 1 },
            { id: 'done', value: 'done', label: 'Done', color: '#green', isCompleted: true, order: 2 }
        ];

        mockPriorityConfigs = [
            { id: 'normal', value: 'normal', label: 'Normal', color: '#blue', weight: 2 },
            { id: 'high', value: 'high', label: 'High', color: '#orange', weight: 3 }
        ];
    });

    /**
     * Helper to create a parser with a custom user field trigger
     */
    function createParserWithUserField(
        fieldId: string,
        fieldType: 'text' | 'list' | 'boolean' | 'number' | 'date',
        trigger: string
    ): NaturalLanguageParser {
        const nlpTriggers: NLPTriggersConfig = {
            triggers: [
                { propertyId: 'tags', trigger: '#', enabled: true },
                { propertyId: 'contexts', trigger: '@', enabled: true },
                { propertyId: 'projects', trigger: '+', enabled: true },
                { propertyId: 'status', trigger: '*', enabled: true },
                { propertyId: fieldId, trigger: trigger, enabled: true }
            ]
        };

        const userFields: UserMappedField[] = [
            {
                id: fieldId,
                displayName: fieldId.charAt(0).toUpperCase() + fieldId.slice(1),
                key: fieldId,
                type: fieldType
            }
        ];

        return new NaturalLanguageParser(
            mockStatusConfigs,
            mockPriorityConfigs,
            true,
            'en',
            nlpTriggers,
            userFields
        );
    }

    describe('Text field with quoted multi-word values', () => {
        /**
         * Core reproduction case from issue #1243
         * When autocomplete fills in a quoted value like key:"multi word value",
         * the entire expression should be removed from the title.
         */
        it.skip('should completely remove quoted text field value with spaces from title', () => {
            const parser = createParserWithUserField('assignee', 'text', 'assignee:');

            // User types: my task assignee:"John Doe"
            const result = parser.parseInput('my task assignee:"John Doe"');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['assignee']).toBe('John Doe');
            // The title should NOT contain any remnants of the assignee expression
            expect(result.title).toBe('my task');
        });

        it.skip('should completely remove quoted text field value at the end of input', () => {
            const parser = createParserWithUserField('client', 'text', 'client:');

            const result = parser.parseInput('review document client:"Acme Corp"');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['client']).toBe('Acme Corp');
            expect(result.title).toBe('review document');
        });

        it.skip('should completely remove quoted text field value in the middle of input', () => {
            const parser = createParserWithUserField('owner', 'text', 'owner:');

            const result = parser.parseInput('fix bug owner:"Jane Smith" today');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['owner']).toBe('Jane Smith');
            expect(result.title).toBe('fix bug today');
        });

        it.skip('should handle multiple spaces in quoted value', () => {
            const parser = createParserWithUserField('location', 'text', 'loc:');

            const result = parser.parseInput('meeting loc:"Conference Room A Building 2"');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['location']).toBe('Conference Room A Building 2');
            expect(result.title).toBe('meeting');
        });

        it.skip('should handle quoted value with numbers and special characters', () => {
            const parser = createParserWithUserField('department', 'text', 'dept:');

            const result = parser.parseInput('submit report dept:"R&D - Floor 3"');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['department']).toBe('R&D - Floor 3');
            expect(result.title).toBe('submit report');
        });
    });

    describe('List field with quoted multi-word values', () => {
        it.skip('should completely remove single quoted list value with spaces', () => {
            const parser = createParserWithUserField('categories', 'list', 'cat:');

            const result = parser.parseInput('organize files cat:"Work Projects"');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['categories']).toEqual(['Work Projects']);
            expect(result.title).toBe('organize files');
        });

        it.skip('should completely remove multiple quoted list values with spaces', () => {
            const parser = createParserWithUserField('labels', 'list', 'label:');

            const result = parser.parseInput('task label:"High Priority" label:"Needs Review"');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['labels']).toEqual(['High Priority', 'Needs Review']);
            expect(result.title).toBe('task');
        });

        it.skip('should handle mix of quoted and unquoted list values', () => {
            const parser = createParserWithUserField('tags', 'list', 'tag:');

            const result = parser.parseInput('review code tag:urgent tag:"Code Review"');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['tags']).toEqual(['urgent', 'Code Review']);
            expect(result.title).toBe('review code');
        });
    });

    describe('Edge cases with quoted values', () => {
        it.skip('should handle quoted value immediately followed by another word', () => {
            const parser = createParserWithUserField('assignee', 'text', 'to:');

            // No space between quoted value and next word
            const result = parser.parseInput('task to:"John Doe"tomorrow');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['assignee']).toBe('John Doe');
            expect(result.title).toBe('task tomorrow');
        });

        it.skip('should handle multiple consecutive spaces around quoted value', () => {
            const parser = createParserWithUserField('assignee', 'text', 'for:');

            const result = parser.parseInput('task  for:"Jane Doe"  done');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['assignee']).toBe('Jane Doe');
            // Multiple spaces should be normalized to single space
            expect(result.title).toBe('task done');
        });

        it.skip('should handle quoted value with leading/trailing spaces inside quotes', () => {
            const parser = createParserWithUserField('note', 'text', 'note:');

            // Spaces inside quotes should be preserved in value but not affect title
            const result = parser.parseInput('task note:" Some Note "');

            expect(result.userFields).toBeDefined();
            // The value should preserve the spaces inside quotes
            expect(result.userFields!['note']).toBe(' Some Note ');
            expect(result.title).toBe('task');
        });

        it.skip('should handle quoted value at the start of input', () => {
            const parser = createParserWithUserField('priority', 'text', 'pri:');

            const result = parser.parseInput('pri:"Very High" fix the bug');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['priority']).toBe('Very High');
            expect(result.title).toBe('fix the bug');
        });

        it.skip('should handle only quoted value as entire input', () => {
            const parser = createParserWithUserField('description', 'text', 'desc:');

            const result = parser.parseInput('desc:"Some Description"');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['description']).toBe('Some Description');
            // Title should be the default when nothing remains
            expect(result.title).toBe('Untitled Task');
        });
    });

    describe('Interaction with other NLP features', () => {
        it.skip('should handle quoted user field with tags', () => {
            const parser = createParserWithUserField('owner', 'text', 'owner:');

            const result = parser.parseInput('review #code owner:"Alice Bob" #urgent');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['owner']).toBe('Alice Bob');
            expect(result.tags).toEqual(['code', 'urgent']);
            expect(result.title).toBe('review');
        });

        it.skip('should handle quoted user field with contexts', () => {
            const parser = createParserWithUserField('contact', 'text', 'contact:');

            const result = parser.parseInput('call contact:"Customer Support Team" @work');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['contact']).toBe('Customer Support Team');
            expect(result.contexts).toEqual(['work']);
            expect(result.title).toBe('call');
        });

        it.skip('should handle quoted user field with projects', () => {
            const parser = createParserWithUserField('lead', 'text', 'lead:');

            const result = parser.parseInput('implement feature lead:"Project Manager" +myproject');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['lead']).toBe('Project Manager');
            expect(result.projects).toEqual(['myproject']);
            expect(result.title).toBe('implement feature');
        });

        it.skip('should handle multiple user fields, some quoted some not', () => {
            const nlpTriggers: NLPTriggersConfig = {
                triggers: [
                    { propertyId: 'tags', trigger: '#', enabled: true },
                    { propertyId: 'assignee', trigger: 'to:', enabled: true },
                    { propertyId: 'priority', trigger: 'pri:', enabled: true }
                ]
            };

            const userFields: UserMappedField[] = [
                { id: 'assignee', displayName: 'Assignee', key: 'assignee', type: 'text' },
                { id: 'priority', displayName: 'Priority', key: 'priority', type: 'text' }
            ];

            const parser = new NaturalLanguageParser(
                mockStatusConfigs,
                mockPriorityConfigs,
                true,
                'en',
                nlpTriggers,
                userFields
            );

            const result = parser.parseInput('task to:"John Doe" pri:high');

            expect(result.userFields).toBeDefined();
            expect(result.userFields!['assignee']).toBe('John Doe');
            expect(result.userFields!['priority']).toBe('high');
            expect(result.title).toBe('task');
        });
    });
});
