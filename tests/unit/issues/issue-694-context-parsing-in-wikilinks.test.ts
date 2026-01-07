/**
 * Test for issue #694: TaskNotes Plugin - Parsing Priority Issue with "@" Symbol in Links
 *
 * Bug Summary:
 * The NaturalLanguageParser incorrectly parses inline tasks when they contain
 * Obsidian wikilinks with "@" symbols in the note title. The plugin treats "@"
 * as context syntax even when it's inside Obsidian link brackets `[[]]`, breaking
 * the link and incorrectly parsing the text after "@" as task context.
 *
 * Examples of affected note titles:
 * - `Meeting @ Conference Room`
 * - `Email@domain.com`
 * - `@John Smith` (At People plugin format)
 * - `Company @ Location`
 * - `Project@2024`
 *
 * Root Cause:
 * The extractContexts() method in NaturalLanguageParser processes "@" symbols
 * before properly parsing Obsidian link syntax `[[]]`. The context regex pattern
 * `@[\p{L}\p{N}\p{M}_/-]+` matches "@" symbols inside wikilinks, breaking them.
 *
 * Expected Behavior:
 * - `[[Note @ Title]]` should be treated as a single link unit
 * - "@" symbols inside `[[...]]` should NOT be treated as context triggers
 * - Context parsing should only apply to "@" symbols outside of link structures
 *
 * Proposed Fix:
 * Update the parsing order to:
 * 1. First: Parse and preserve all Obsidian link formats `[[...]]` as complete units
 * 2. Second: Process "@" symbols only in text that is NOT part of existing link structures
 * 3. Third: Apply context parsing to remaining "@" symbols
 */

import { NaturalLanguageParser } from '../../../src/services/NaturalLanguageParser';
import { StatusConfig, PriorityConfig } from '../../../src/types';
import { ChronoTestUtils } from '../../__mocks__/chrono-node';
import { RRuleTestUtils } from '../../__mocks__/rrule';

// Mock date-fns to ensure consistent test results
jest.mock('date-fns', () => ({
    format: jest.fn((date: Date, formatStr: string) => {
        if (formatStr === 'yyyy-MM-dd') {
            return date.toISOString().split('T')[0];
        } else if (formatStr === 'HH:mm') {
            return date.toISOString().split('T')[1].substring(0, 5);
        }
        return date.toISOString();
    }),
    parse: jest.fn(),
    addDays: jest.fn(),
    addWeeks: jest.fn(),
    addMonths: jest.fn(),
    addYears: jest.fn(),
    startOfDay: jest.fn(),
    isValid: jest.fn(() => true)
}));

describe('Issue #694: @ symbol parsing priority in wikilinks', () => {
    let parser: NaturalLanguageParser;
    let mockStatusConfigs: StatusConfig[];
    let mockPriorityConfigs: PriorityConfig[];

    beforeEach(() => {
        jest.clearAllMocks();
        ChronoTestUtils.reset();
        RRuleTestUtils.reset();

        mockStatusConfigs = [
            { id: 'open', value: 'open', label: 'Open', color: '#blue', isCompleted: false, order: 1 },
            { id: 'done', value: 'done', label: 'Done', color: '#green', isCompleted: true, order: 2 }
        ];

        mockPriorityConfigs = [
            { id: 'normal', value: 'normal', label: 'Normal', color: '#blue', weight: 5 },
            { id: 'high', value: 'high', label: 'High', color: '#orange', weight: 8 }
        ];

        parser = new NaturalLanguageParser(mockStatusConfigs, mockPriorityConfigs, true);
    });

    describe('Wikilinks containing @ symbols should be preserved', () => {
        it.skip('should preserve [[Meeting @ Conference Room]] as a complete link - reproduces issue #694', () => {
            const result = parser.parseInput('Follow up on [[Meeting @ Conference Room]] discussion');

            // The "@" inside the wikilink should NOT be treated as a context
            expect(result.contexts).toEqual([]);
            // The title should contain the full, unbroken wikilink
            expect(result.title).toBe('Follow up on [[Meeting @ Conference Room]] discussion');
        });

        it.skip('should preserve [[Email@domain.com]] as a complete link - reproduces issue #694', () => {
            const result = parser.parseInput('Send [[Email@domain.com]] to client');

            expect(result.contexts).toEqual([]);
            expect(result.title).toBe('Send [[Email@domain.com]] to client');
        });

        it.skip('should preserve [[@John Smith]] as a complete link - reproduces issue #694', () => {
            // This format is used by the "At People" plugin
            const result = parser.parseInput('Call [[@John Smith]] about project');

            expect(result.contexts).toEqual([]);
            expect(result.title).toBe('Call [[@John Smith]] about project');
        });

        it.skip('should preserve [[Company @ Location]] as a complete link - reproduces issue #694', () => {
            const result = parser.parseInput('Visit [[Company @ Location]] for meeting');

            expect(result.contexts).toEqual([]);
            expect(result.title).toBe('Visit [[Company @ Location]] for meeting');
        });

        it.skip('should preserve [[Project@2024]] as a complete link - reproduces issue #694', () => {
            const result = parser.parseInput('Review [[Project@2024]] status');

            expect(result.contexts).toEqual([]);
            expect(result.title).toBe('Review [[Project@2024]] status');
        });
    });

    describe('Context parsing should work outside of wikilinks', () => {
        it.skip('should still extract contexts outside of wikilinks - reproduces issue #694', () => {
            const result = parser.parseInput('Follow up on [[Meeting @ Office]] @work @urgent');

            // Contexts outside the link should be extracted
            expect(result.contexts).toContain('work');
            expect(result.contexts).toContain('urgent');
            // But the @ inside the link should NOT be extracted
            expect(result.contexts).not.toContain('Office]]');
            expect(result.contexts).not.toContain('Office');
            // The link should remain intact in the title
            expect(result.title).toContain('[[Meeting @ Office]]');
        });

        it.skip('should handle multiple wikilinks with @ symbols - reproduces issue #694', () => {
            const result = parser.parseInput('Check [[Email@work.com]] and [[Email@home.com]] @urgent');

            expect(result.contexts).toEqual(['urgent']);
            expect(result.title).toContain('[[Email@work.com]]');
            expect(result.title).toContain('[[Email@home.com]]');
        });
    });

    describe('Edge cases', () => {
        it.skip('should handle wikilink with @ at the start - reproduces issue #694', () => {
            const result = parser.parseInput('Contact [[@TeamLead]] today');

            expect(result.contexts).toEqual([]);
            expect(result.title).toBe('Contact [[@TeamLead]] today');
        });

        it.skip('should handle wikilink with @ at the end - reproduces issue #694', () => {
            const result = parser.parseInput('Check out [[New Feature@]] improvements');

            expect(result.contexts).toEqual([]);
            expect(result.title).toBe('Check out [[New Feature@]] improvements');
        });

        it.skip('should handle wikilink with multiple @ symbols - reproduces issue #694', () => {
            const result = parser.parseInput('Forward [[user1@domain.com to user2@domain.com]] email');

            expect(result.contexts).toEqual([]);
            expect(result.title).toBe('Forward [[user1@domain.com to user2@domain.com]] email');
        });

        it.skip('should handle aliased wikilinks with @ in the target - reproduces issue #694', () => {
            // [[Target with @ symbol|Alias text]]
            const result = parser.parseInput('See [[Meeting @ Office|office meeting]] notes');

            expect(result.contexts).toEqual([]);
            expect(result.title).toContain('[[Meeting @ Office|office meeting]]');
        });

        it.skip('should handle aliased wikilinks with @ in the alias - reproduces issue #694', () => {
            // [[Target|Alias with @ symbol]]
            const result = parser.parseInput('Contact [[John Smith|@john]] today');

            expect(result.contexts).toEqual([]);
            expect(result.title).toContain('[[John Smith|@john]]');
        });
    });

    describe('Backward compatibility - contexts without wikilinks', () => {
        it('should continue to extract contexts normally when no wikilinks present', () => {
            const result = parser.parseInput('Meeting @work @urgent with team');

            expect(result.contexts).toEqual(['work', 'urgent']);
            expect(result.title).toBe('Meeting with team');
        });

        it('should handle nested contexts correctly', () => {
            const result = parser.parseInput('Buy groceries @shopping/groceries');

            expect(result.contexts).toEqual(['shopping/groceries']);
            expect(result.title).toBe('Buy groceries');
        });
    });
});
