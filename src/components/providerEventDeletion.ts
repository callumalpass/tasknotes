import { msg } from "@lingui/core/macro";
import type TaskNotesPlugin from "../main";
import type { ICSEvent } from "../types";
import type { CalendarProvider } from "../services/CalendarProvider";
import type { ConfirmationModalOptions } from "../modals/ConfirmationModal";
import { EventNotFoundError } from "../services/errors";
import { displayError } from "../i18n/runtime";
import { createTaskNotesLogger } from "../utils/tasknotesLogger";

const tasknotesLogger = createTaskNotesLogger({ tag: "Components/ProviderEventDeletion" });

/**
 * Returns the connected calendar provider that may delete this event, or undefined for
 * ICS subscription events and events on calendars the account can only read.
 */
export function getDeletingProvider(
	plugin: TaskNotesPlugin,
	icsEvent: ICSEvent
): CalendarProvider | undefined {
	const provider = plugin.calendarProviderRegistry?.findProviderForEvent(icsEvent);
	return provider?.canDeleteEvent(icsEvent) ? provider : undefined;
}

export interface DeleteProviderEventOptions {
	plugin: TaskNotesPlugin;
	icsEvent: ICSEvent;
	confirm(options: ConfirmationModalOptions): Promise<boolean>;
	notify(message: string): void;
}

/**
 * Asks for confirmation, then deletes the event from its provider calendar. A recurring
 * event shows one occurrence per instance, so only that occurrence is deleted.
 * Returns true when the event is gone.
 */
export async function deleteProviderEvent({
	plugin,
	icsEvent,
	confirm,
	notify,
}: DeleteProviderEventOptions): Promise<boolean> {
	const provider = getDeletingProvider(plugin, icsEvent);
	if (!provider) return false;
	const t = plugin.i18n.translate.bind(plugin.i18n);
	const title =
		icsEvent.title ||
		t(msg({ message: "Untitled event", context: "contextMenus.ics.markdown.titleFallback" }));
	const recurring = Boolean(icsEvent.recurringEventId);

	const confirmed = await confirm({
		title: t(msg({ message: "Delete event", context: "contextMenus.ics.deleteEvent" })),
		message: recurring
			? t(
					msg({
						message:
							"Delete this occurrence of \"{title}\" from {provider}? Other occurrences are kept.",
						context: "contextMenus.ics.deleteEvent.confirmOccurrence",
					}),
					{ title, provider: provider.providerName }
				)
			: t(
					msg({
						message: "Delete \"{title}\" from {provider}?",
						context: "contextMenus.ics.deleteEvent.confirm",
					}),
					{ title, provider: provider.providerName }
				),
		confirmText: t(msg({ message: "Delete", context: "contextMenus.ics.deleteEvent.confirmButton" })),
		isDestructive: true,
	});
	if (!confirmed) return false;

	const { calendarId, eventId } = provider.extractEventIds(icsEvent);
	try {
		await provider.deleteEvent(calendarId, eventId);
	} catch (error) {
		if (!(error instanceof EventNotFoundError)) {
			tasknotesLogger.error("Failed to delete calendar event:", {
				category: "provider",
				operation: "delete-provider-event",
				error,
			});
			notify(
				t(
					msg({
						message: "Failed to delete event: {message}",
						context: "contextMenus.ics.notices.deleteFailure",
					}),
					{ message: displayError(error) }
				)
			);
			return false;
		}
		// Already deleted elsewhere: refresh so the stale copy disappears.
		await provider.refresh().catch(() => undefined);
	}

	notify(
		t(msg({ message: "Event deleted", context: "contextMenus.ics.notices.deleteSuccess" }))
	);
	return true;
}
