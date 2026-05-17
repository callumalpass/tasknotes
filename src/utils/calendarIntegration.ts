import { Platform } from "obsidian";
import type { TaskNotesSettings } from "../types/settings";

type MobileCalendarSettings = Pick<TaskNotesSettings, "disableCalendarOnMobile">;

export function isCalendarIntegrationDisabledOnMobile(
	settings: MobileCalendarSettings,
	isMobile: boolean = Platform.isMobile
): boolean {
	return isMobile && settings.disableCalendarOnMobile;
}
