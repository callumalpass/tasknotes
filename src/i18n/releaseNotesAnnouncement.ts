// English input: src/releaseNotesAnnouncement.md. Links are protected parameters.
import { msg } from "@lingui/core/macro";
import { uiText } from "./runtime";

export function getReleaseNotesAnnouncement(): string {
	return uiText(msg({ message: "**TaskNotes v5 beta.** Use your Markdown tasks in Obsidian and the new TaskNotes app. [Plugin beta]({token1}) · [Web app]({token2}) · [iOS]({token3}). Back up your vault before trying the beta.\n", context: "release announcement Markdown" }), {"token1":"https://github.com/callumalpass/tasknotes/releases/tag/5.0.0-beta.6","token2":"https://app.tasknotes.dev/","token3":"https://apps.apple.com/app/tasknotes/id6797168033"});
}
