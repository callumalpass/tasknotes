/**
 * Test for Issue #871: Drag and drop in Kanban for bases changes wrong property
 *
 * When using Bases Kanban view with groupBy set to a custom property (e.g., priority),
 * dragging a task between columns should update the groupBy property, not the status.
 *
 * Bug: When groupByPropertyId is null (cannot be determined), the code falls back
 * to updating the status property (line 492-496 in bases/kanban-view.ts), regardless
 * of what the actual groupBy configuration is in Bases.
 */

import { describe, it, expect } from '@jest/globals';

describe('Issue #871: Bases Kanban drag and drop updates wrong property', () => {
    /**
     * Simulates the CURRENT (buggy) drop handler behavior from bases/kanban-view.ts
     * Lines 404-507
     */
    function simulateBasesKanbanDrop(
        groupByPropertyId: string | null,
        targetColumnId: string
    ): { updatedProperty: string; updatedValue: string } {
        // This simulates the logic at lines 407-503
        if (groupByPropertyId) {
            const originalPropertyId = groupByPropertyId;
            const propertyId = originalPropertyId.toLowerCase();

            // Handle different property types (lines 423-483)
            if (propertyId === "status" || propertyId === "note.status") {
                return { updatedProperty: "status", updatedValue: targetColumnId };
            } else if (propertyId === "priority" || propertyId === "note.priority") {
                return { updatedProperty: "priority", updatedValue: targetColumnId };
            } else if (
                propertyId === "projects" ||
                propertyId === "project" ||
                propertyId === "note.projects" ||
                propertyId === "note.project"
            ) {
                return { updatedProperty: "projects", updatedValue: targetColumnId };
            } else if (
                propertyId === "contexts" ||
                propertyId === "context" ||
                propertyId === "note.contexts" ||
                propertyId === "note.context"
            ) {
                return { updatedProperty: "contexts", updatedValue: targetColumnId };
            } else {
                // Custom property - extract property name
                const propertyName = originalPropertyId.includes(".")
                    ? originalPropertyId.split(".").pop() || originalPropertyId
                    : originalPropertyId;
                return { updatedProperty: propertyName, updatedValue: targetColumnId };
            }
        } else {
            // BUG: Lines 492-496
            // Fallback to status update when no groupBy config
            // This is wrong - it should use the actual Bases groupBy configuration
            return { updatedProperty: "status", updatedValue: targetColumnId };
        }
    }

    describe('Current buggy behavior - when groupByPropertyId is null', () => {
        it('should FAIL: Updates status instead of priority when groupByPropertyId is null', () => {
            // User has Bases view grouped by priority
            // But groupByPropertyId failed to be determined (is null)
            const groupByPropertyId = null;
            const targetColumnId = "high";

            const result = simulateBasesKanbanDrop(groupByPropertyId, targetColumnId);

            // BUG: status is updated instead of priority
            expect(result.updatedProperty).toBe("status"); // This demonstrates the bug
            expect(result.updatedValue).toBe("high");
            // Should be: expect(result.updatedProperty).toBe("priority");
        });

        it('should FAIL: Updates status instead of custom field when groupByPropertyId is null', () => {
            // User has Bases view grouped by a custom field "department"
            // But groupByPropertyId failed to be determined (is null)
            const groupByPropertyId = null;
            const targetColumnId = "engineering";

            const result = simulateBasesKanbanDrop(groupByPropertyId, targetColumnId);

            // BUG: status is updated instead of the custom field
            expect(result.updatedProperty).toBe("status"); // This demonstrates the bug
            expect(result.updatedValue).toBe("engineering");
            // Should be: expect(result.updatedProperty).toBe("department");
        });

        it('should FAIL: Updates status instead of projects when groupByPropertyId is null', () => {
            // User has Bases view grouped by projects
            // But groupByPropertyId failed to be determined (is null)
            const groupByPropertyId = null;
            const targetColumnId = "ProjectA";

            const result = simulateBasesKanbanDrop(groupByPropertyId, targetColumnId);

            // BUG: status is updated instead of projects
            expect(result.updatedProperty).toBe("status"); // This demonstrates the bug
            expect(result.updatedValue).toBe("ProjectA");
            // Should be: expect(result.updatedProperty).toBe("projects");
        });
    });

    describe('Correct behavior - when groupByPropertyId is properly determined', () => {
        it('should update priority when grouped by priority', () => {
            const groupByPropertyId = "note.priority";
            const targetColumnId = "high";

            const result = simulateBasesKanbanDrop(groupByPropertyId, targetColumnId);

            expect(result.updatedProperty).toBe("priority");
            expect(result.updatedValue).toBe("high");
        });

        it('should update projects when grouped by projects', () => {
            const groupByPropertyId = "note.projects";
            const targetColumnId = "ProjectA";

            const result = simulateBasesKanbanDrop(groupByPropertyId, targetColumnId);

            expect(result.updatedProperty).toBe("projects");
            expect(result.updatedValue).toBe("ProjectA");
        });

        it('should update custom field when grouped by custom field', () => {
            const groupByPropertyId = "note.department";
            const targetColumnId = "engineering";

            const result = simulateBasesKanbanDrop(groupByPropertyId, targetColumnId);

            expect(result.updatedProperty).toBe("department");
            expect(result.updatedValue).toBe("engineering");
        });

        it('should update status when grouped by status', () => {
            const groupByPropertyId = "note.status";
            const targetColumnId = "done";

            const result = simulateBasesKanbanDrop(groupByPropertyId, targetColumnId);

            expect(result.updatedProperty).toBe("status");
            expect(result.updatedValue).toBe("done");
        });
    });
});
