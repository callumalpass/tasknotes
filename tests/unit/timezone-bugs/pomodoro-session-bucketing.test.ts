/**
 * Regression tests for Pomodoro session timezone bucketing bug.
 * 
 * Sessions stored with local timezone offset (e.g. -04:00) were being
 * incorrectly bucketed using UTC date components in getStatsForDate.
 * 
 * A session at 9pm Eastern (2026-04-02T21:09-04:00) converts to UTC
 * next day (2026-04-03T01:09Z), causing it to appear in tomorrow's
 * Pomodoro stats. Real-world impact: 2 evening sessions were incorrectly
 * counted as the next day, inflating today's count from 3 to 5.
 * 
 * Fix: use local date methods in getStatsForDate which correctly resolve
 * the stored timezone offset, making stats travel-safe since the offset
 * is preserved in the stored timestamp.
 * 
 * See: https://github.com/callumalpass/tasknotes/issues/1658
 */

import { formatDateForStorage } from '../../../src/utils/dateUtils';

const originalTZ = process.env.TZ;

describe('Pomodoro session timezone bucketing', () => {
    afterEach(() => {
        if (originalTZ) {
            process.env.TZ = originalTZ;
        } else {
            delete process.env.TZ;
        }
    });

    test('formatDateForStorage incorrectly shifts evening sessions to next UTC day', () => {
        // Session at 9pm Eastern - stored by getCurrentTimestamp() with local offset
        // This is the bug: formatDateForStorage uses getUTCDate() which shifts the date
        const sessionStartTime = '2026-04-02T21:09:25.755-04:00';
        const d = new Date(sessionStartTime);

        const utcDate = formatDateForStorage(d);
        expect(utcDate).toBe('2026-04-03'); // UTC next day - documents the bug
    });

    test('local date methods correctly resolve stored timezone offset', () => {
        // The fix: use local date methods which respect the stored -04:00 offset
        const sessionStartTime = '2026-04-02T21:09:25.755-04:00';
        const d = new Date(sessionStartTime);

        const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        expect(localDate).toBe('2026-04-02'); // Correct - stays as April 2nd
    });

    test('morning sessions are unaffected - both UTC and local methods agree', () => {
        // Sessions well within the day are not affected by the bug
        const sessionStartTime = '2026-04-03T06:54:19.390-04:00';
        const d = new Date(sessionStartTime);

        const utcDate = formatDateForStorage(d);
        const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        expect(utcDate).toBe('2026-04-03');
        expect(localDate).toBe('2026-04-03');
    });

    test('BUG: evening sessions counted in wrong day - real world data', () => {
        // Reproduces the exact bug from pomodoroHistory in data.json
        // 2 evening sessions on April 2nd incorrectly counted as April 3rd
        const sessions = [
            '2026-04-02T21:09:25.755-04:00', // 9pm Eastern April 2nd → UTC April 3rd
            '2026-04-02T21:39:39.525-04:00', // 9:39pm Eastern April 2nd → UTC April 3rd
            '2026-04-03T06:54:19.390-04:00', // 6:54am Eastern April 3rd → UTC April 3rd
            '2026-04-03T07:24:26.131-04:00', // 7:24am Eastern April 3rd → UTC April 3rd
            '2026-04-03T08:10:28.560-04:00', // 8:10am Eastern April 3rd → UTC April 3rd
        ];

        const getLocalDate = (startTime: string) => {
            const d = new Date(startTime);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };

        // Buggy UTC bucketing - all 5 appear on April 3rd
        const buggyApril3Count = sessions.filter(s =>
            formatDateForStorage(new Date(s)) === '2026-04-03'
        ).length;
        expect(buggyApril3Count).toBe(5); // Wrong - includes last night's sessions

        // Fixed local bucketing - only 3 genuine April 3rd sessions
        const fixedApril3Count = sessions.filter(s =>
            getLocalDate(s) === '2026-04-03'
        ).length;
        expect(fixedApril3Count).toBe(3); // Correct

        // Fixed local bucketing - 2 genuine April 2nd sessions
        const fixedApril2Count = sessions.filter(s =>
            getLocalDate(s) === '2026-04-02'
        ).length;
        expect(fixedApril2Count).toBe(2); // Correct
    });

    test('travel-safe - stored offset preserved regardless of reading timezone', () => {
        // A session created in Eastern time with -04:00 offset
        // should always read as April 2nd Eastern regardless of
        // where you are when you read it
        const sessionStartTime = '2026-04-02T21:09:25.755-04:00';

        process.env.TZ = 'Asia/Tokyo';
        const dTokyo = new Date(sessionStartTime);
        const localDateTokyo = `${dTokyo.getFullYear()}-${String(dTokyo.getMonth() + 1).padStart(2, '0')}-${String(dTokyo.getDate()).padStart(2, '0')}`;
        expect(localDateTokyo).toBe('2026-04-02');

        process.env.TZ = 'Europe/London';
        const dLondon = new Date(sessionStartTime);
        const localDateLondon = `${dLondon.getFullYear()}-${String(dLondon.getMonth() + 1).padStart(2, '0')}-${String(dLondon.getDate()).padStart(2, '0')}`;
        expect(localDateLondon).toBe('2026-04-02');

        process.env.TZ = 'America/Los_Angeles';
        const dLA = new Date(sessionStartTime);
        const localDateLA = `${dLA.getFullYear()}-${String(dLA.getMonth() + 1).padStart(2, '0')}-${String(dLA.getDate()).padStart(2, '0')}`;
        expect(localDateLA).toBe('2026-04-02');
    });

    test('UTC midnight boundary - sessions right at midnight behave correctly', () => {
        // Session exactly at midnight Eastern = 4am UTC
        // Should stay as the local date
        const midnightSession = '2026-04-02T00:00:00.000-04:00';
        const d = new Date(midnightSession);

        const localDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        expect(localDate).toBe('2026-04-02');

        // UTC would give same result here since midnight local = 4am UTC same day
        const utcDate = formatDateForStorage(d);
        expect(utcDate).toBe('2026-04-02');
    });
});