import { msg } from "@lingui/core/macro";
import { uiDuration } from "../i18n/formatters";
import { uiText } from "../i18n/runtime";

export function calendarResizeFeedback(title: string, start: Date, end: Date): string {
	const duration = uiDuration((end.getTime() - start.getTime()) / 60000);
	return `${title} · ${uiText(msg({ message: "Duration → {duration}", context: "calendar resize feedback" }), { duration })}`;
}
