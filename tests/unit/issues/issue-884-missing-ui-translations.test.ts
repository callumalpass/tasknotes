/**
 * Test for issue #884: Missing translations - not all UI strings are localized
 *
 * Bug Description:
 * User reports that the Russian translation file is fully translated, but many
 * parts of the plugin UI still display in English. This indicates that some
 * UI components have hardcoded strings that are not connected to the i18n system.
 *
 * Known hardcoded strings identified:
 * - DateTimePickerModal: "Date", "Time (optional)", "Cancel", "Select"
 * - ReminderModal: "Time", "Direction", "Relative to", "Date", "Description (optional)",
 *   "Add Reminder", dropdown options ("before", "after", "minutes", "hours", "days"),
 *   and button text like "Task Reminders", "Current Reminders", "Add New Reminder"
 * - TaskActionPaletteModal: "Type to search for an action..."
 *
 * Expected Behavior:
 * - All user-visible strings should be retrieved from the translation system
 * - Switching to Russian (or any other locale) should display translated strings
 * - Modal components should have access to the translate() method
 */

import { describe, it } from '@jest/globals';
import { en } from '../../../src/i18n/resources/en';
import { ru } from '../../../src/i18n/resources/ru';

describe('Issue #884: Missing UI translations', () => {
	describe('DateTimePickerModal hardcoded strings', () => {
		it.skip('reproduces issue #884 - should have translation keys for DateTimePickerModal strings', () => {
			// These strings are currently hardcoded in DateTimePickerModal.ts
			// and need translation keys in the i18n system
			const requiredKeys = [
				'modals.dateTimePicker.date',
				'modals.dateTimePicker.timeOptional',
				'modals.dateTimePicker.cancel',
				'modals.dateTimePicker.select',
			];

			// When fixed, the English translations should include these keys
			// For now, this test documents the missing translations
			requiredKeys.forEach((key) => {
				const parts = key.split('.');
				let value: any = en;
				for (const part of parts) {
					value = value?.[part];
				}
				// This assertion will fail until the keys are added
				// expect(value).toBeDefined();
			});
		});
	});

	describe('ReminderModal hardcoded strings', () => {
		it.skip('reproduces issue #884 - should have translation keys for ReminderModal form labels', () => {
			// These strings are currently hardcoded in ReminderModal.ts
			// See lines 381, 400, 410, 437, 446, 456, 473
			const requiredKeys = [
				'modals.reminder.formLabels.time',
				'modals.reminder.formLabels.direction',
				'modals.reminder.formLabels.relativeTo',
				'modals.reminder.formLabels.date',
				'modals.reminder.formLabels.descriptionOptional',
				'modals.reminder.buttons.addReminder',
			];

			requiredKeys.forEach((key) => {
				const parts = key.split('.');
				let value: any = en;
				for (const part of parts) {
					value = value?.[part];
				}
				// This assertion will fail until the keys are added
				// expect(value).toBeDefined();
			});
		});

		it.skip('reproduces issue #884 - should have translation keys for ReminderModal dropdown options', () => {
			// Dropdown options are hardcoded in ReminderModal.ts
			const requiredKeys = [
				'modals.reminder.dropdownOptions.before',
				'modals.reminder.dropdownOptions.after',
				'modals.reminder.dropdownOptions.minutes',
				'modals.reminder.dropdownOptions.hours',
				'modals.reminder.dropdownOptions.days',
			];

			requiredKeys.forEach((key) => {
				const parts = key.split('.');
				let value: any = en;
				for (const part of parts) {
					value = value?.[part];
				}
				// This assertion will fail until the keys are added
				// expect(value).toBeDefined();
			});
		});

		it.skip('reproduces issue #884 - should have translation keys for ReminderModal section headers', () => {
			// Section headers are hardcoded in ReminderModal.ts
			const requiredKeys = [
				'modals.reminder.title', // "Task Reminders"
				'modals.reminder.currentReminders', // "Current Reminders"
				'modals.reminder.addNewReminder', // "Add New Reminder"
				'modals.reminder.emptyState', // "No reminders set"
				'modals.reminder.loadingReminders', // "Loading reminders..."
			];

			requiredKeys.forEach((key) => {
				const parts = key.split('.');
				let value: any = en;
				for (const part of parts) {
					value = value?.[part];
				}
				// This assertion will fail until the keys are added
				// expect(value).toBeDefined();
			});
		});
	});

	describe('TaskActionPaletteModal hardcoded strings', () => {
		it.skip('reproduces issue #884 - should have translation keys for TaskActionPaletteModal', () => {
			// TaskActionPaletteModal.ts line 29 has hardcoded placeholder
			const requiredKeys = [
				'modals.taskActionPalette.searchPlaceholder', // "Type to search for an action..."
			];

			requiredKeys.forEach((key) => {
				const parts = key.split('.');
				let value: any = en;
				for (const part of parts) {
					value = value?.[part];
				}
				// This assertion will fail until the keys are added
				// expect(value).toBeDefined();
			});
		});
	});

	describe('Translation parity between locales', () => {
		it.skip('reproduces issue #884 - Russian translation should cover all strings that exist in English', () => {
			// Helper function to get all leaf keys from a translation tree
			function getAllKeys(obj: any, prefix = ''): string[] {
				const keys: string[] = [];
				for (const key in obj) {
					const fullKey = prefix ? `${prefix}.${key}` : key;
					if (typeof obj[key] === 'object' && obj[key] !== null) {
						keys.push(...getAllKeys(obj[key], fullKey));
					} else {
						keys.push(fullKey);
					}
				}
				return keys;
			}

			const enKeys = getAllKeys(en);
			const ruKeys = getAllKeys(ru);

			// Find keys that exist in English but not in Russian
			const missingInRu = enKeys.filter((key) => !ruKeys.includes(key));

			// This test documents which keys are missing in Russian
			// When all translations are complete, missingInRu should be empty
			// expect(missingInRu).toEqual([]);

			// For now, log the missing keys for documentation purposes
			if (missingInRu.length > 0) {
				console.log('Keys missing in Russian translation:', missingInRu);
			}
		});
	});

	describe('Modal components accessing translation system', () => {
		it.skip('reproduces issue #884 - DateTimePickerModal should have access to translate method', () => {
			// DateTimePickerModal currently extends Modal directly and has no
			// translate method binding. It should either:
			// 1. Accept an i18n service in its constructor, or
			// 2. Accept a plugin instance that provides access to i18n

			// When fixed, the modal should be instantiated with translation support:
			// new DateTimePickerModal(app, options, plugin.i18n)
			// or
			// new DateTimePickerModal(app, plugin, options)

			// This test verifies the architectural fix is in place
		});

		it.skip('reproduces issue #884 - ReminderModal should use translate() for all UI strings', () => {
			// ReminderModal has access to plugin.i18n but many strings are hardcoded.
			// All string literals in the modal should be replaced with translate() calls.

			// When fixed:
			// - All .setName() calls should use translate()
			// - All dropdown options should use translate()
			// - All button text should use translate()
			// - All section headers should use translate()
		});
	});
});
