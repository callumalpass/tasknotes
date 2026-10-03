import type TaskNotesPlugin from "../../main";
import { createI18nService } from "../../i18n";
import { publishUserNotice } from "../../core/userNotices";
import { migrationRecognitionNotice } from "./recognitionNotices";

export function metadataSafetyNotice(plugin: TaskNotesPlugin, details: string): string {
	const support = /Preserved customized mdbase support resource: ([^;\n]+)/.exec(details);
	if (support) return migrationRecognitionNotice(plugin, "support", { path: support[1] });
	return (plugin.i18n ?? createI18nService()).translate("mdbaseSafety.blocked", { details });
}

const lastFailures = new WeakMap<TaskNotesPlugin, string>();

/** One actionable notice per pending swap; successful synchronization resets deduplication. */
export function reportSettingsMetadataResult(plugin: TaskNotesPlugin, error: unknown): void {
	if (!error) { lastFailures.delete(plugin); return; }
	const details = error instanceof Error ? `${error.name}: ${error.message}` : typeof error === "string" ? error : JSON.stringify(error) ?? "Unknown metadata synchronization error";
	const identity = /\.tasknotes\/migrations\/(?:metadata-swaps\/[^;\s]+|mdbase-v0\.3-pending)\.json/.exec(details)?.[0] ?? details;
	if (lastFailures.get(plugin) === identity) return;
	lastFailures.set(plugin, identity);
	const saved = (plugin.i18n ?? createI18nService()).translate("mdbaseSafety.settingsSaved");
	publishUserNotice(plugin.emitter, `${saved} ${metadataSafetyNotice(plugin, details)}`);
}
