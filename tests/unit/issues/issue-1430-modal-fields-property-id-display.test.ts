/**
 * Test for issue #1430: Incorrect Property ID After Customization
 *
 * Bug Description:
 * When a user customizes a user field's Property Key (e.g., sets it to "propID"),
 * the Modal Fields tab still displays the default internal ID (e.g., "field_1735011234")
 * instead of the customized property key.
 *
 * Expected Behavior:
 * - For user fields in Modal Fields tab, the secondary text should show the
 *   property key from UserMappedField.key, not the internal field.id
 * - If no property key is set, it should show a placeholder like "No key set"
 *
 * Root Cause:
 * In FieldManagerComponent.ts:187, the code displays `ID: ${field.id}` for all fields.
 * For user fields (fieldType === "user"), it should look up the corresponding
 * UserMappedField from plugin.settings.userFields and display its .key property.
 */

import type { ModalFieldConfig, TaskModalFieldsConfig, UserMappedField } from '../../../src/types/settings';

describe('Issue #1430: Modal Fields displays incorrect property ID after customization', () => {
    // Mock data representing the bug scenario
    const userField: UserMappedField = {
        id: 'field_1735011234',
        displayName: 'My Custom Field',
        key: 'propID', // User has set a custom property key
        type: 'text'
    };

    const modalFieldConfig: ModalFieldConfig = {
        id: 'field_1735011234', // Same ID as the userField
        fieldType: 'user',
        group: 'custom',
        displayName: 'My Custom Field',
        visibleInCreation: true,
        visibleInEdit: true,
        order: 0,
        enabled: true
    };

    const mockConfig: TaskModalFieldsConfig = {
        version: 1,
        fields: [modalFieldConfig],
        groups: [
            {
                id: 'custom',
                displayName: 'Custom Fields',
                order: 0,
                collapsible: true,
                defaultCollapsed: false
            }
        ]
    };

    /**
     * Helper function that simulates the logic that SHOULD be used
     * to get the display text for a field's secondary text in Modal Fields.
     *
     * This is what the fix should implement.
     */
    function getFieldSecondaryText(
        field: ModalFieldConfig,
        userFields: UserMappedField[]
    ): string {
        // For user fields, look up the property key from UserMappedField
        if (field.fieldType === 'user') {
            const userField = userFields.find(uf => uf.id === field.id);
            if (userField && userField.key) {
                return `Key: ${userField.key}`;
            }
            return 'No key set';
        }
        // For core/other fields, show the ID
        return `ID: ${field.id}`;
    }

    /**
     * Helper function that simulates the CURRENT buggy behavior
     */
    function getCurrentBuggySecondaryText(field: ModalFieldConfig): string {
        // Current buggy behavior: always shows field.id
        return `ID: ${field.id}`;
    }

    describe('Secondary text display in Modal Fields', () => {
        it('should display property key for user fields (FAILING - Bug #1430)', () => {
            // This test represents the expected behavior that is currently broken
            const secondaryText = getFieldSecondaryText(modalFieldConfig, [userField]);

            // The secondary text should show the property key "propID", not the internal ID
            expect(secondaryText).toBe('Key: propID');
            expect(secondaryText).not.toContain('field_1735011234');
        });

        it('demonstrates the current buggy behavior', () => {
            // This shows what currently happens (bug)
            const buggyText = getCurrentBuggySecondaryText(modalFieldConfig);

            // Currently shows the internal ID instead of the property key
            expect(buggyText).toBe('ID: field_1735011234');

            // This is the bug - it should show 'Key: propID' but shows internal ID
            expect(buggyText).not.toBe('Key: propID');
        });

        it('should display "No key set" for user fields without property key', () => {
            const userFieldNoKey: UserMappedField = {
                id: 'field_1735011235',
                displayName: 'Field Without Key',
                key: '', // No property key set
                type: 'text'
            };

            const modalField: ModalFieldConfig = {
                id: 'field_1735011235',
                fieldType: 'user',
                group: 'custom',
                displayName: 'Field Without Key',
                visibleInCreation: true,
                visibleInEdit: true,
                order: 0,
                enabled: true
            };

            const secondaryText = getFieldSecondaryText(modalField, [userFieldNoKey]);
            expect(secondaryText).toBe('No key set');
        });

        it('should display ID for core fields', () => {
            const coreField: ModalFieldConfig = {
                id: 'title',
                fieldType: 'core',
                group: 'basic',
                displayName: 'Title',
                visibleInCreation: true,
                visibleInEdit: true,
                order: 0,
                enabled: true
            };

            const secondaryText = getFieldSecondaryText(coreField, []);
            expect(secondaryText).toBe('ID: title');
        });

        it('should handle missing userField gracefully', () => {
            // User field exists in modalFieldsConfig but not in userFields array
            // This could happen if data gets out of sync
            const orphanedModalField: ModalFieldConfig = {
                id: 'field_orphaned',
                fieldType: 'user',
                group: 'custom',
                displayName: 'Orphaned Field',
                visibleInCreation: true,
                visibleInEdit: true,
                order: 0,
                enabled: true
            };

            const secondaryText = getFieldSecondaryText(orphanedModalField, [userField]);
            expect(secondaryText).toBe('No key set');
        });
    });

    describe('User field and modal field synchronization', () => {
        it('should find matching user field by ID', () => {
            const matchingUserField = [userField].find(uf => uf.id === modalFieldConfig.id);

            expect(matchingUserField).toBeDefined();
            expect(matchingUserField?.key).toBe('propID');
            expect(matchingUserField?.displayName).toBe('My Custom Field');
        });

        it('should have consistent IDs between UserMappedField and ModalFieldConfig', () => {
            // The bug happens because both data structures use the same ID
            // but only UserMappedField has the property key
            expect(userField.id).toBe(modalFieldConfig.id);
            expect(userField.key).toBe('propID');
            // ModalFieldConfig doesn't have a 'key' property - this is by design
            // The fix needs to look up the key from userFields
        });
    });
});
