/**
 * Test to verify the parseDateToUTC contract violation bug.
 * 
 * The issue: parseDateToUTC promises to return UTC-anchored dates but 
 * falls back to parseDateToLocal for datetime strings, breaking the contract.
 */

import { parseDateToUTC, parseDateToLocal } from '../../../src/utils/dateUtils';

// Mock the timezone by setting TZ environment variable
const originalTZ = process.env.TZ;

describe('parseDateToUTC Contract Violation Bug', () => {
    afterEach(() => {
        // Restore original timezone
        if (originalTZ) {
            process.env.TZ = originalTZ;
        } else {
            delete process.env.TZ;
        }
    });

    test('parseDateToUTC works correctly for date-only strings', () => {
        const testTimezones = ['America/Los_Angeles', 'America/New_York', 'UTC', 'Asia/Tokyo'];
        
        for (const timezone of testTimezones) {
            process.env.TZ = timezone;
            
            const dateOnly = '2025-08-02';
            const result = parseDateToUTC(dateOnly);
            
            // Should always return the same UTC anchor regardless of timezone
            expect(result.toISOString()).toBe('2025-08-02T00:00:00.000Z');
        }
    });

    test('BUG: parseDateToUTC returns different results for datetime strings across timezones', () => {
        // Test with an ISO datetime string
        const isoDateTime = '2025-08-02T14:30:00Z'; // 2:30 PM UTC
        
        const testTimezones = ['America/Los_Angeles', 'America/New_York', 'UTC', 'Asia/Tokyo'];
        const results: string[] = [];
        
        for (const timezone of testTimezones) {
            process.env.TZ = timezone;
            
            const result = parseDateToUTC(isoDateTime);
            results.push(result.toISOString());
            
            console.log(`parseDateToUTC in ${timezone}:`, result.toISOString());
        }
        
        // BUG: parseDateToUTC should return the same result regardless of timezone
        // but because it falls back to parseDateToLocal, it might not
        const firstResult = results[0];
        const allSame = results.every(result => result === firstResult);
        
        if (!allSame) {
            console.log('BUG CONFIRMED: parseDateToUTC returns different results across timezones');
            console.log('Results:', results);
        }
        
        // For UTC timestamps, this should actually work correctly
        // But the function name promises UTC behavior that isn't guaranteed
    });

    test('BUG: parseDateToUTC vs parseDateToLocal behavior inconsistency', () => {
        process.env.TZ = 'America/Los_Angeles';
        
        const datetimeString = '2025-08-02T14:30:00-08:00'; // 2:30 PM Pacific
        
        const utcResult = parseDateToUTC(datetimeString);
        const localResult = parseDateToLocal(datetimeString);
        
        console.log('parseDateToUTC result:', utcResult.toISOString());
        console.log('parseDateToLocal result:', localResult.toISOString());
        
        // BUG: These should be different if parseDateToUTC truly returns UTC anchors
        // But since parseDateToUTC delegates to parseDateToLocal for datetime strings,
        // they return the same result!
        expect(utcResult.toISOString()).toBe(localResult.toISOString());
        
        // This demonstrates the contract violation
        console.log('parseDateToUTC delegates to parseDateToLocal for datetime strings');
    });

    test('Demonstrate the contract violation impact', () => {
        process.env.TZ = 'America/Los_Angeles';
        
        const dateOnly = '2025-08-02';
        const datetimeString = '2025-08-02T10:00:00-08:00';
        
        const dateOnlyResult = parseDateToUTC(dateOnly);
        const datetimeResult = parseDateToUTC(datetimeString);
        
        console.log('Date-only UTC anchor:', dateOnlyResult.toISOString());
        console.log('Datetime "UTC" result:', datetimeResult.toISOString());
        
        // The problem: These have inconsistent behavior
        // - Date-only creates a true UTC anchor (midnight UTC)
        // - Datetime delegates to local parsing (might be in local time)
        
        // For date-only: 2025-08-02T00:00:00.000Z
        // For datetime: 2025-08-02T18:00:00.000Z (10 AM Pacific = 6 PM UTC)
        
        // This inconsistency can cause problems in comparison functions
        expect(dateOnlyResult.getUTCHours()).toBe(0); // UTC midnight
        expect(datetimeResult.getUTCHours()).toBe(18); // 6 PM UTC (10 AM Pacific)
    });

    test('Show the correct fix for parseDateToUTC contract', () => {
        process.env.TZ = 'America/Los_Angeles';
        
        const datetimeString = '2025-08-02T10:00:00-08:00';
        
        // Current implementation (broken contract)
        const currentResult = parseDateToUTC(datetimeString);
        
        // What the correct implementation should do:
        // Parse the datetime in local context first
        const localParsed = parseDateToLocal(datetimeString);
        
        // Then create a UTC representation of the same moment
        const correctedResult = new Date(Date.UTC(
            localParsed.getFullYear(),
            localParsed.getMonth(),
            localParsed.getDate(),
            localParsed.getHours(),
            localParsed.getMinutes(),
            localParsed.getSeconds(),
            localParsed.getMilliseconds()
        ));
        
        console.log('Current result:', currentResult.toISOString());
        console.log('What it should be:', correctedResult.toISOString());
        
        // NOTE: For ISO strings, these might actually be the same
        // The real issue is that parseDateToUTC doesn't guarantee UTC behavior
        // for all input formats, making it unreliable
    });
});