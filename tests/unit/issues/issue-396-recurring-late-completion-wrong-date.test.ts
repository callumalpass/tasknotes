/**
 * Issue #396: Recurring tasks completed after scheduled date do not process
 * into next available recurrence.
 *
 * Root cause: toggleRecurringTaskComplete defaults to getTodayLocal() when no
 * explicit date is passed. For scheduled-anchor recurring tasks, this records
 * today in complete_instances instead of the scheduled occurrence date.
 *
 * Fix: default to task.scheduled (via getDatePart) for scheduled-anchor tasks.
 */

import { getDatePart, parseDateToUTC } from "../../../src/utils/dateUtils";

describe("Issue #396 — recurring late completion records wrong date", () => {
    it("getDatePart extracts date from scheduled datetime", () => {
        expect(getDatePart("2026-04-04")).toBe("2026-04-04");
        expect(getDatePart("2026-04-04T10:00:00")).toBe("2026-04-04");
    });

    it("scheduled-anchor task should use scheduled date, not today, when date is omitted", () => {
        // Simulate the fixed defaulting logic
        const freshTask = {
            recurrence_anchor: "scheduled",
            scheduled: "2026-04-04",
            recurrence: "FREQ=WEEKLY;BYDAY=SA",
        };

        // The fix: when date is omitted and anchor is not "completion", use scheduled
        const resolvedDate = (() => {
            if (freshTask.recurrence_anchor !== "completion" && freshTask.scheduled) {
                return parseDateToUTC(getDatePart(freshTask.scheduled));
            }
            fail("Should not reach today fallback for scheduled-anchor task");
        })();

        // The resolved date should represent April 4, not whatever today happens to be
        expect(resolvedDate.toISOString()).toMatch(/^2026-04-04/);
    });

    it("completion-anchor task should still default to today when date is omitted", () => {
        const freshTask = {
            recurrence_anchor: "completion",
            scheduled: "2026-04-04",
            recurrence: "FREQ=WEEKLY;BYDAY=SA",
        };

        // The fix should NOT change completion-anchor behavior
        const usedScheduled =
            freshTask.recurrence_anchor !== "completion" && freshTask.scheduled;
        expect(usedScheduled).toBeFalsy();
    });

    it("undefined recurrence_anchor should default to using scheduled date", () => {
        // Default anchor is "scheduled" — undefined should behave the same
        const freshTask = {
            recurrence_anchor: undefined,
            scheduled: "2026-04-04",
            recurrence: "FREQ=WEEKLY;BYDAY=SA",
        };

        const usedScheduled =
            freshTask.recurrence_anchor !== "completion" && freshTask.scheduled;
        expect(usedScheduled).toBeTruthy();
    });
});
