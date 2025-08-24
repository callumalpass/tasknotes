import { Reminder, TaskInfo } from '../types';
import { DefaultReminder, UserFieldMapping, TaskNotesSettings } from '../types/settings';
import type { UserMappedField } from '../types/settings';

/**
 * Converts DefaultReminder objects to Reminder objects that can be used in tasks.
 * This function handles the conversion of user-configured default reminders into
 * the format expected by the task reminder system.
 */
export function convertDefaultRemindersToReminders(
	defaultReminders: DefaultReminder[],
	task?: TaskInfo
): Reminder[] {
	return defaultReminders.map(defaultReminder => {
		const reminder: Reminder = {
			id: `rem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			type: defaultReminder.type,
			description: defaultReminder.description
		};

		if (defaultReminder.type === 'relative') {
			// For relative reminders, validate that the anchor date will be available
			if (defaultReminder.relatedTo && defaultReminder.offset && defaultReminder.unit && defaultReminder.direction) {
				// Convert offset to ISO 8601 duration format
				let duration = 'PT';
				if (defaultReminder.unit === 'days') {
					duration = `P${defaultReminder.offset}D`;
				} else if (defaultReminder.unit === 'hours') {
					duration = `PT${defaultReminder.offset}H`;
				} else {
					duration = `PT${defaultReminder.offset}M`;
				}

				// Add negative sign for "before"
				if (defaultReminder.direction === 'before') {
					duration = '-' + duration;
				}

				reminder.relatedTo = defaultReminder.relatedTo;
				reminder.offset = duration;
			}
		} else if (defaultReminder.type === 'absolute') {
			// For absolute reminders, convert date and time to ISO string
			if (defaultReminder.absoluteDate && defaultReminder.absoluteTime) {
				reminder.absoluteTime = `${defaultReminder.absoluteDate}T${defaultReminder.absoluteTime}:00`;
			}
		}

		return reminder;
	}).filter(reminder => {
		// Filter out invalid reminders
		if (reminder.type === 'relative') {
			return reminder.relatedTo && reminder.offset;
		} else {
			return !!reminder.absoluteTime;
		}
	});
}

/**
 * Returns true if at least one user-mapped field is complete (displayName, key, type)
 */
export function hasAnyUserFieldsEnabled(settings: TaskNotesSettings): boolean {
	const fields = (settings as any).userFields as UserMappedField[] | undefined;
	if (!fields || fields.length === 0) return false;
	return fields.some(f => Boolean(f && f.displayName && f.key && f.type));
}

/**
 * Returns true if the user field mapping object is fully configured (enabled, displayName, key present)
 */
export function isUserFieldConfigComplete(mapping?: UserFieldMapping): boolean {
	if (!mapping) return false;
	if (!mapping.enabled) return false;
	return Boolean(mapping.displayName && mapping.key && mapping.type);
}

/**
 * Returns true if settings contain an enabled and complete user field configuration
 */
export function isUserFieldEnabled(settings: TaskNotesSettings): boolean {
	// Backward compatibility: legacy single-field helper now true if any mapped field exists
	if ((settings as any).userFields && (settings as any).userFields.length > 0) {
		return hasAnyUserFieldsEnabled(settings);
	}
	return isUserFieldConfigComplete((settings as any).userField);
}
