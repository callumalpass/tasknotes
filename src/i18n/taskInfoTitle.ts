import { msg } from "@lingui/core/macro";
import { uiText } from "./runtime";

/** Synthetic read-only TaskInfo display fallback; updates persist patches only. */
export function taskInfoTitle(title: string | undefined): string {
	return title || uiText(msg({ message: "Untitled task", context: "utils/taskInfoAssembly: buildTaskInfoFromMappedTask title" }));
}
