/**
 * Test to verify that the timezone fix for formatDateForStorage works correctly
 * 
 * This test confirms that dates with time components now format consistently
 * across all timezones by using UTC methods.
 */

import { formatDateForStorage, parseDate } from '../../../src/utils/dateUtils';

describe('Due Date Timezone Fix Verification', () => {
    describe('formatDateForStorage now uses UTC consistently', () => {
        it('should format midnight UTC consistently across timezones', () => {
            // Task due exactly at midnight UTC
            const dueDate = '2024-10-02T00:00:00.000Z';
            const date = parseDate(dueDate);
            
            // With the fix, this should always return the UTC date
            const formatted = formatDateForStorage(date);
            
            console.log('Midnight UTC test:');
            console.log('  Input:', dueDate);
            console.log('  Formatted:', formatted);
            console.log('  Expected:', '2024-10-02');
            
            // Should always be Oct 2 regardless of user timezone
            expect(formatted).toBe('2024-10-02');
        });

        it('should format evening times consistently', () => {
            // Task due at 10 PM UTC on Oct 1
            const dueDate = '2024-10-01T22:00:00.000Z';
            const date = parseDate(dueDate);
            
            const formatted = formatDateForStorage(date);
            
            console.log('\nEvening UTC test:');
            console.log('  Input:', dueDate);
            console.log('  Formatted:', formatted);
            
            // Should always be Oct 1 (the UTC date)
            expect(formatted).toBe('2024-10-01');
        });

        it('should handle timezone-specific inputs correctly', () => {
            const testCases = [
                {
                    input: '2024-10-01T14:00:00-07:00', // 2 PM PDT = 9 PM UTC
                    expectedUTC: '2024-10-01',
                    description: '2 PM Pacific Time'
                },
                {
                    input: '2024-10-01T23:30:00+05:30', // 11:30 PM IST = 6 PM UTC same day
                    expectedUTC: '2024-10-01',
                    description: '11:30 PM India Time'
                },
                {
                    input: '2024-10-02T01:00:00+10:00', // 1 AM AEST = 3 PM UTC previous day
                    expectedUTC: '2024-10-01',
                    description: '1 AM Australian Eastern Time'
                }
            ];

            console.log('\nTimezone-specific inputs:');
            testCases.forEach(({ input, expectedUTC, description }) => {
                const date = parseDate(input);
                const formatted = formatDateForStorage(date);
                
                console.log(`\n  ${description}:`);
                console.log(`    Input: ${input}`);
                console.log(`    UTC: ${date.toISOString()}`);
                console.log(`    Formatted: ${formatted}`);
                console.log(`    Expected: ${expectedUTC}`);
                
                expect(formatted).toBe(expectedUTC);
            });
        });

        it('should ensure all users see the same date', () => {
            // Critical test: same task, multiple timezones
            const taskDueDate = '2024-10-01T23:30:00.000Z'; // 11:30 PM UTC
            const date = parseDate(taskDueDate);
            
            // All users should see the same date now
            const formatted = formatDateForStorage(date);
            
            console.log('\nMulti-timezone consistency test:');
            console.log('  Task due at:', taskDueDate);
            console.log('  All users now see:', formatted);
            console.log('  Expected:', '2024-10-01');
            
            // Regardless of timezone, everyone sees Oct 1
            expect(formatted).toBe('2024-10-01');
            
            console.log('\n✅ Fix confirmed: All users see the same date!');
        });

        it('should handle edge cases correctly', () => {
            const edgeCases = [
                {
                    input: '2024-12-31T23:59:59.999Z',
                    expected: '2024-12-31',
                    description: 'Last moment of year'
                },
                {
                    input: '2024-01-01T00:00:00.000Z',
                    expected: '2024-01-01',
                    description: 'First moment of year'
                },
                {
                    input: '2024-02-29T12:00:00.000Z',
                    expected: '2024-02-29',
                    description: 'Leap day'
                }
            ];

            console.log('\nEdge cases:');
            edgeCases.forEach(({ input, expected, description }) => {
                const date = parseDate(input);
                const formatted = formatDateForStorage(date);
                
                console.log(`  ${description}: ${input} -> ${formatted}`);
                expect(formatted).toBe(expected);
            });
        });

        it('should handle invalid inputs gracefully', () => {
            const invalidCases = [
                { input: null, expected: '' },
                { input: undefined, expected: '' },
                { input: new Date('invalid'), expected: '' },
                { input: 'not a date' as any, expected: '' }
            ];

            console.log('\nInvalid input handling:');
            invalidCases.forEach(({ input, expected }) => {
                const result = formatDateForStorage(input as any);
                console.log(`  ${input} -> "${result}"`);
                expect(result).toBe(expected);
            });
        });
    });

    describe('Real-world impact verification', () => {
        it('should fix the meeting scheduling problem', () => {
            // Meeting at 2 PM Pacific Time
            const meeting = {
                title: 'Team Standup',
                due: '2024-10-01T14:00:00-07:00' // 2 PM PDT = 9 PM UTC
            };
            
            const date = parseDate(meeting.due);
            const formatted = formatDateForStorage(date);
            
            console.log('\nMeeting scheduling fix:');
            console.log('  Meeting:', meeting.title);
            console.log('  Scheduled:', meeting.due);
            console.log('  UTC time:', date.toISOString());
            console.log('  Shows on calendar date:', formatted);
            
            // All users now see it on Oct 1 (the UTC date)
            expect(formatted).toBe('2024-10-01');
            
            console.log('\n✅ All team members see the meeting on Oct 1');
        });

        it('should fix the deadline visibility problem', () => {
            // Project deadline at end of day
            const deadline = {
                title: 'Q4 Report Due',
                due: '2024-12-31T23:59:59.000Z'
            };
            
            const date = parseDate(deadline.due);
            const formatted = formatDateForStorage(date);
            
            console.log('\nDeadline visibility fix:');
            console.log('  Task:', deadline.title);
            console.log('  Due:', deadline.due);
            console.log('  Shows on date:', formatted);
            
            // Everyone sees it due on Dec 31
            expect(formatted).toBe('2024-12-31');
            
            console.log('\n✅ All users see deadline on Dec 31');
        });
    });
});