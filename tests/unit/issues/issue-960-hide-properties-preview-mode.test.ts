/**
 * Issue #960: Hide Properties in Preview/Reading Mode
 *
 * Feature Request: Add toggles to hide TaskNotes property keys in preview/reading mode.
 *
 * Problem:
 * - TaskNotes adds various property keys to frontmatter (reminders, pomodoros,
 *   icsEventId, ics_event, timeEntries, etc.)
 * - Some properties are useful for display (status, priority, due date)
 * - Others are internal/technical and look "ugly" in preview mode
 * - Users want per-property control over visibility in preview/reading mode
 *
 * Requested Solution:
 * - Add toggles in Settings for each TaskNotes property key
 * - Toggle controls whether property is hidden in preview/reading mode
 * - Works via CSS injection (data-property-key attribute hiding)
 *
 * Implementation approach:
 * - New setting: `hiddenPropertiesInPreview: string[]` - array of property keys to hide
 * - Settings UI: Checkboxes/toggles for each TaskNotes property
 * - CSS injection: Dynamically generate CSS rules for hidden properties
 *
 * Related:
 * - Issue #937 and PR #956 for hiding identifying tags (different feature)
 * - Uses `data-property-key` CSS selector approach suggested by user
 *
 * @see https://github.com/callumalpass/tasknotes/issues/960
 */

import type { TaskNotesSettings } from '../../../src/types/settings';
import type { FieldMapping } from '../../../src/types';

describe.skip('Issue #960: Hide Properties in Preview/Reading Mode', () => {
  // Properties that TaskNotes adds to frontmatter
  const TASKNOTES_PROPERTIES: (keyof FieldMapping)[] = [
    'reminders',
    'pomodoros',
    'icsEventId',
    'icsEventTag',
    'timeEntries',
    'completeInstances',
    'skippedInstances',
    'recurrence',
    'recurrenceAnchor',
    'googleCalendarEventId',
    'blockedBy',
  ];

  // Properties that are typically useful for display
  const DISPLAY_PROPERTIES: (keyof FieldMapping)[] = [
    'status',
    'priority',
    'due',
    'scheduled',
    'contexts',
    'projects',
    'timeEstimate',
    'completedDate',
    'dateCreated',
    'dateModified',
  ];

  describe('Settings Configuration', () => {
    it.skip('should have a hiddenPropertiesInPreview setting', () => {
      // Test that the setting exists in TaskNotesSettings interface
      const mockSettings: Partial<TaskNotesSettings> = {
        // Expected new setting
        // hiddenPropertiesInPreview: [],
      };

      // When implemented, this should pass:
      // expect(mockSettings.hiddenPropertiesInPreview).toBeDefined();
      // expect(Array.isArray(mockSettings.hiddenPropertiesInPreview)).toBe(true);
      expect(true).toBe(false); // Placeholder to mark as needs implementation
    });

    it.skip('should default to hiding internal properties', () => {
      // Internal properties that should be hidden by default
      const expectedDefaultHidden = [
        'reminders',
        'pomodoros',
        'icsEventId',
        'ics_event', // mapped name for icsEventTag
        'timeEntries',
        'complete_instances', // mapped name
        'skipped_instances', // mapped name
      ];

      // When implemented:
      // const defaultSettings = getDefaultSettings();
      // expect(defaultSettings.hiddenPropertiesInPreview).toEqual(
      //   expect.arrayContaining(expectedDefaultHidden)
      // );
      expect(true).toBe(false); // Placeholder
    });

    it.skip('should allow customizing which properties are hidden', () => {
      // User can add/remove properties from the hidden list
      const mockSettings = {
        hiddenPropertiesInPreview: ['reminders', 'pomodoros', 'status'],
      };

      // When implemented:
      // expect(mockSettings.hiddenPropertiesInPreview).toContain('status');
      // expect(mockSettings.hiddenPropertiesInPreview).not.toContain('priority');
      expect(true).toBe(false); // Placeholder
    });
  });

  describe('CSS Generation', () => {
    it.skip('should generate CSS to hide specified properties', () => {
      const propertiesToHide = ['reminders', 'pomodoros', 'icsEventId'];

      // Expected CSS output
      const expectedCSS = `
[data-property-key="reminders"],
[data-property-key="pomodoros"],
[data-property-key="icsEventId"]
{
  display: none !important;
}`.trim();

      // When implemented:
      // const generatedCSS = generatePropertyHidingCSS(propertiesToHide);
      // expect(generatedCSS).toContain('[data-property-key="reminders"]');
      // expect(generatedCSS).toContain('display: none !important');
      expect(true).toBe(false); // Placeholder
    });

    it.skip('should handle empty property list', () => {
      const propertiesToHide: string[] = [];

      // Should generate no CSS or empty string
      // const generatedCSS = generatePropertyHidingCSS(propertiesToHide);
      // expect(generatedCSS).toBe('');
      expect(true).toBe(false); // Placeholder
    });

    it.skip('should use user-configured field names (FieldMapping)', () => {
      // If user has customized field names, CSS should use those
      const fieldMapping: Partial<FieldMapping> = {
        reminders: 'my_reminders', // Custom field name
        pomodoros: 'pomo_count',
      };

      const propertiesToHide = ['reminders', 'pomodoros'];

      // When implemented:
      // const generatedCSS = generatePropertyHidingCSS(propertiesToHide, fieldMapping);
      // expect(generatedCSS).toContain('[data-property-key="my_reminders"]');
      // expect(generatedCSS).toContain('[data-property-key="pomo_count"]');
      expect(true).toBe(false); // Placeholder
    });
  });

  describe('Settings UI', () => {
    it.skip('should display toggles for each TaskNotes property', () => {
      // Settings tab should show a toggle for each property
      // When implemented, verify UI renders correctly

      // Expected structure in settings:
      // - Section: "Property Visibility in Preview Mode"
      // - Toggle for each property with name and description
      // - Grouped by: Display properties vs Internal properties
      expect(true).toBe(false); // Placeholder
    });

    it.skip('should group properties by category', () => {
      // Properties should be organized:
      // 1. Display properties (status, priority, due, etc.)
      // 2. Internal/technical properties (reminders, pomodoros, etc.)

      const displayProps = DISPLAY_PROPERTIES;
      const internalProps = TASKNOTES_PROPERTIES;

      // Verify grouping in UI
      expect(displayProps.length).toBeGreaterThan(0);
      expect(internalProps.length).toBeGreaterThan(0);
    });

    it.skip('should update settings when toggle is changed', () => {
      // Toggling a property should update hiddenPropertiesInPreview array
      // and regenerate the CSS

      // Mock scenario:
      // 1. User toggles "reminders" to hidden
      // 2. Settings updated to include "reminders" in hiddenPropertiesInPreview
      // 3. CSS regenerated to hide reminders property
      expect(true).toBe(false); // Placeholder
    });
  });

  describe('CSS Injection', () => {
    it.skip('should inject CSS style element on plugin load', () => {
      // Plugin should inject a <style> element with property hiding rules
      // const styleElement = document.getElementById('tasknotes-property-hiding-styles');
      // expect(styleElement).toBeTruthy();
      // expect(styleElement?.tagName).toBe('STYLE');
      expect(true).toBe(false); // Placeholder
    });

    it.skip('should update CSS when settings change', () => {
      // When user changes settings, CSS should be regenerated
      // and style element updated
      expect(true).toBe(false); // Placeholder
    });

    it.skip('should remove CSS on plugin unload', () => {
      // Style element should be removed when plugin is disabled
      expect(true).toBe(false); // Placeholder
    });
  });

  describe('Integration with FieldMapper', () => {
    it.skip('should respect user-configured property names', () => {
      // If user has customized field mapping, hidden properties
      // should use the user's configured names

      // Example:
      // - Internal name: "reminders"
      // - User-configured name: "task_reminders"
      // - CSS should target: [data-property-key="task_reminders"]
      expect(true).toBe(false); // Placeholder
    });

    it.skip('should handle properties not in FieldMapping', () => {
      // Some properties like "tags" are special and not in FieldMapping
      // These should still be hideable
      expect(true).toBe(false); // Placeholder
    });
  });

  describe('Edge Cases', () => {
    it.skip('should handle invalid property names gracefully', () => {
      // If somehow an invalid property name gets in the list,
      // it should be skipped without errors
      expect(true).toBe(false); // Placeholder
    });

    it.skip('should not conflict with other CSS rules', () => {
      // Generated CSS should be scoped/specific enough
      // to not affect other plugins or Obsidian itself
      expect(true).toBe(false); // Placeholder
    });

    it.skip('should work in both preview and reading modes', () => {
      // CSS selector should work in both:
      // - Live Preview mode
      // - Reading mode
      expect(true).toBe(false); // Placeholder
    });
  });
});
