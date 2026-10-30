import { msg } from "@lingui/core/macro";
import type { SettingsContext } from "./SettingsContext";

/** Translate whole count-aware sync ages, not English unit suffixes. */
export function relativeSyncTime(date: Date, ctx: SettingsContext): string {
	const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	if (days > 0) return ctx.t(msg({ message: "{days, plural, one {{days, number} day ago} other {{days, number} days ago}}", context: "settings.integrations.timeFormats.daysAgo" }), { days });
	if (hours > 0) return ctx.t(msg({ message: "{hours, plural, one {{hours, number} hour ago} other {{hours, number} hours ago}}", context: "settings.integrations.timeFormats.hoursAgo" }), { hours });
	if (minutes > 0) return ctx.t(msg({ message: "{minutes, plural, one {{minutes, number} minute ago} other {{minutes, number} minutes ago}}", context: "settings.integrations.timeFormats.minutesAgo" }), { minutes });
	return ctx.t(msg({ message: "Just now", context: "settings.integrations.timeFormats.justNow" }));
}
