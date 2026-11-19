// English input: src/releaseNotesAnnouncement.md. Links are protected parameters.
import { msg } from "@lingui/core/macro";
import { uiText } from "./runtime";

export function getReleaseNotesAnnouncement(): string {
	return uiText(msg({ message: "**TaskNotes App: your tasks on the web, iPhone and Android.** It works with the same Markdown task notes as this plugin. [Open TaskNotes App]({token1}) · [Get it for iPhone]({token2}) · [Get it for Android]({token4}) · [Setup guide]({token3}). To use it with the tasks in this vault, see **Settings → TaskNotes → TaskNotes App**.\n", context: "release announcement Markdown" }), {"token1":"https://app.tasknotes.dev/","token2":"https://apps.apple.com/app/tasknotes/id6797168033","token3":"https://tasknotes.dev/guides/tasknotes-app/","token4":"https://play.google.com/store/apps/details?id=dev.tasknotes.app"});
}
