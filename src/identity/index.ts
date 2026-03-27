/**
 * Identity Module
 *
 * Provides device identification, user registry, group management, and
 * person preferences for shared vault scenarios.
 *
 * Usage:
 *   import { DeviceIdentityManager, UserRegistry, GroupRegistry, PersonNoteService } from './identity';
 *
 *   const deviceManager = new DeviceIdentityManager();
 *   const userRegistry = new UserRegistry(plugin, deviceManager);
 *   const groupRegistry = new GroupRegistry(plugin);
 *   const personNoteService = new PersonNoteService(plugin);
 *
 *   // Check if device is registered
 *   if (userRegistry.isDeviceRegistered()) {
 *     const creator = userRegistry.getCreatorValueForNewTask();
 *   }
 *
 *   // Resolve group to persons
 *   const persons = groupRegistry.resolveAssignee("[[Frontend Team]]");
 *
 *   // Get person preferences
 *   const prefs = personNoteService.getPreferences("User-DB/Alice.md");
 */

export { DeviceIdentityManager } from "./DeviceIdentityManager";
export {
	UserRegistry,
	type DeviceUserSettings,
	DEFAULT_DEVICE_USER_SETTINGS,
} from "./UserRegistry";
export { GroupRegistry } from "./GroupRegistry";
export {
	PersonNoteService,
	DEFAULT_PERSON_PREFERENCES,
} from "./PersonNoteService";
export { NoteUuidService } from "./NoteUuidService";
export {
	BaseIdentityService,
	type ViewFieldMapping,
	type ViewDefaults,
	type ParsedViewConfig,
	type ParsedBaseFile,
} from "./BaseIdentityService";
export {
	DevicePreferencesManager,
	type DevicePreferences,
	type NotificationScopePrefs,
} from "./DevicePreferences";
export type {
	DeviceUserMapping,
	GroupNoteMapping,
	PersonPreferences,
	LeadTime,
} from "../types/settings";
