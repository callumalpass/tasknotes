import { msg } from "@lingui/core/macro";
import type TaskNotesPlugin from "../../main";
import { createI18nService } from "../../i18n";

export function migrationRecognitionNotice(
	plugin: Pick<TaskNotesPlugin, "i18n">,
	message: "review" | "waiting" | "support",
	variables: { path: string }
): string {
	const i18n = plugin.i18n ?? createI18nService();
	const messages = {
		review: msg({ message: "TaskNotes preserved {path}: legacy metadata is missing, edited, or includes other types. Finish syncing and restart; otherwise migrate a backed-up copy with mdbase and review the type before retrying.", context: "migrationRecognition.review" }),
		waiting: msg({ message: "TaskNotes found metadata in {path} without mdbase.yaml and did not create another collection. Finish syncing or restore the matching configuration from a backup; migration will retry when metadata arrives.", context: "migrationRecognition.waiting" }),
		support: msg({ message: "TaskNotes preserved customized support file {path}. Restore the generated version from a backup or review and migrate a copy with mdbase, then restart.", context: "migrationRecognition.support" }),
	};
	return i18n.translate(messages[message], variables);
}
