import type TaskNotesPlugin from "../../main";
import { createI18nService } from "../../i18n";

export function migrationRecognitionNotice(
	plugin: Pick<TaskNotesPlugin, "i18n">,
	message: "review" | "waiting" | "support",
	variables: { path: string }
): string {
	const i18n = plugin.i18n ?? createI18nService();
	return i18n.translate(`migrationRecognition.${message}`, variables);
}
