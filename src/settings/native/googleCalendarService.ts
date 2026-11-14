import { msg } from "@lingui/core/macro";
import type { SettingDefinition, SettingDefinitionItem } from "obsidian";
import { MAX_SELECTED_CALENDARS } from "@tasknotes/calendar-service-client";
import { showConfirmationModal } from "../../modals/ConfirmationModal";
import { TextInputModal } from "../../modals/TextInputModal";
import { formatDateLabel } from "../../utils/dateUtils";
import type { SettingsContext } from "./SettingsContext";

/**
 * Google Calendar through the TaskNotes calendar service: the person signs in
 * with Google and no developer application is needed. The definitions are built
 * for the state at the time, so every action that changes it rebuilds them.
 */
export function calendarServiceItems(
	ctx: SettingsContext,
	unavailable: () => boolean
): SettingDefinitionItem[] {
	const { plugin } = ctx;
	const hosted = plugin.hostedGoogleCalendarService;
	if (!hosted) return [];
	const ownConnected = () => plugin.oauthSecretStore?.getConnection("google") != null;
	const signedIn = hosted.isSignedIn();
	const connected = hosted.isConnected();

	const signIn = async () => {
		if (unavailable())
			throw new Error(
				ctx.t(msg({ message: "Calendar integration is unavailable on this device.", context: "settings.native.calendarIntegrationIsUnavailableOnThisDevice" }))
			);
		const finished = hosted.connect(() =>
			new TextInputModal(plugin.app, {
				title: ctx.t(msg({ message: "Enter the code shown in your browser", context: "settings.calendarService.confirmationCode.title" })),
				confirmText: ctx.t(msg({ message: "Continue", context: "settings.calendarService.confirmationCode.confirm" })),
			}).show()
		);
		// Says what is awaited, and shows the way out, while the person is in their browser.
		ctx.rebuild();
		try {
			await finished;
		} finally {
			ctx.rebuild();
		}
	};

	const status: SettingDefinition = {
		name: ctx.t(msg({ message: "Connection status", context: "settings.native.connectionStatus" })),
		aliases: ["google", "sync", "sign in"],
		render: (setting) => {
			if (unavailable()) {
				setting.setDesc(
					ctx.t(msg({ message: "Calendar integration is unavailable on this device.", context: "settings.native.calendarIntegrationIsUnavailableOnThisDevice" }))
				);
				return;
			}
			if (hosted.isAuthorizing()) {
				setting.setDesc(
					ctx.t(msg({ message: "Waiting for you to finish in your browser", context: "settings.calendarService.waiting.name" }))
				);
				setting.descEl.createDiv({
					text: ctx.t(msg({ message: "Sign in with Google there, then enter the code it shows you here.", context: "settings.calendarService.waiting.description" })),
				});
				return;
			}
			if (!hosted.isSignedIn()) {
				setting.setDesc(
					ownConnected()
						? ctx.t(msg({ message: "Connected with your own Google application", context: "settings.calendarService.status.ownApplication" }))
						: ctx.t(msg({ message: "Not connected", context: "settings.native.notConnected" }))
				);
				return;
			}
			const { connection } = hosted.client.getSnapshot();
			if (connection?.status === "reconnect_required") {
				setting.setDesc("");
				setting.descEl.createDiv({
					text: ctx.t(msg({ message: "Google Calendar needs reconnecting.", context: "settings.calendarService.status.reconnect" })),
					cls: "mod-warning",
				});
				return;
			}
			if (!connection) {
				setting.setDesc(
					ctx.t(msg({ message: "Signed in. Google Calendar isn’t connected yet.", context: "settings.calendarService.status.signedInOnly" }))
				);
				return;
			}
			setting.setDesc(ctx.t(msg({ message: "Signed in with Google", context: "settings.calendarService.status.signedIn" })));
			const sync = hosted.getSyncStatus();
			if (sync.lastSuccess)
				setting.descEl.createDiv({
					text: ctx.t(msg({ message: "Last refreshed: {date}", context: "settings.calendarService.status.lastRefreshed" }), {
						date: formatDateLabel(new Date(sync.lastSuccess), plugin.settings, undefined, true),
					}),
				});
			for (const error of sync.calendarErrors)
				setting.descEl.createDiv({
					text: `${error.calendarId}: ${error.message}`,
					cls: "mod-warning",
				});
		},
	};

	const waiting: SettingDefinition = {
		...ctx.button("calendarService.cancel", {
			// The row's name is what a person clicks.
			name: ctx.t(msg({ message: "Cancel sign-in", context: "settings.calendarService.waiting.cancelName" })),
			buttonText: ctx.t(msg({ message: "Cancel", context: "settings.calendarService.waiting.cancel" })),
			onClick: () => hosted.cancelConnect(),
		}),
		visible: () => hosted.isAuthorizing(),
	};

	if (!signedIn)
		return [
			status,
			{
				...ctx.button(
					"calendarService.signIn",
					{
						name: ctx.t(msg({ message: "Sign in with Google", context: "settings.calendarService.signIn.name" })),
						desc: ctx.t(msg({ message: "Shows your Google Calendar events in TaskNotes and lets you change them. Events come through the TaskNotes calendar service and aren’t saved in your vault.", context: "settings.calendarService.signIn.description" })),
						buttonText: ctx.t(msg({ message: "Sign in", context: "settings.calendarService.signIn.button" })),
						onClick: signIn,
					},
					unavailable
				),
				// One Google source at a time.
				visible: () => !ownConnected() && !hosted.isAuthorizing(),
			},
			waiting,
		];

	const calendars = hosted.getAllCalendars();
	const shown = () => hosted.client.getSnapshot().selected;
	return [
		status,
		{
			...ctx.button("calendarService.connect", {
				name: ctx.t(msg({ message: "Connect Google Calendar", context: "settings.calendarService.connect.name" })),
				desc: ctx.t(msg({ message: "Give TaskNotes access to your Google Calendar again.", context: "settings.calendarService.connect.description" })),
				buttonText: ctx.t(msg({ message: "Connect", context: "settings.native.connect" })),
				onClick: signIn,
			}),
			visible: () => !connected && !hosted.isAuthorizing(),
		},
		waiting,
		...(calendars.length > 0
			? [
					{
						type: "group" as const,
						heading: ctx.t(msg({ message: "Calendars shown", context: "settings.calendarService.calendars.heading" })),
						items: calendars.map((calendar) =>
							ctx.toggle(`calendarService.calendar.${calendar.id}`, {
								name: calendar.name,
								...(calendar.can_write
									? {}
									: { desc: ctx.t(msg({ message: "Read only", context: "settings.calendarService.calendars.readOnly" })) }),
								getValue: () => shown().includes(calendar.id),
								setValue: async (show) => {
									const others = shown().filter((id) => id !== calendar.id);
									if (show && others.length >= MAX_SELECTED_CALENDARS)
										throw new Error(
											ctx.t(msg({ message: "{count, plural, one {You can show # calendar at a time.} other {You can show up to # calendars at a time.}}", context: "settings.calendarService.calendars.limit" }), { count: MAX_SELECTED_CALENDARS })
										);
									await hosted.setShownCalendars(show ? [...others, calendar.id] : others);
								},
							})
						),
					},
				]
			: []),
		{
			...ctx.button("calendarService.refresh", {
				name: ctx.t(msg({ message: "Refresh calendar events", context: "settings.native.refreshCalendarEvents" })),
				buttonText: ctx.t(msg({ message: "Refresh now", context: "settings.integrations.subscriptionsList.actions.refreshNow" })),
				onClick: async () => {
					try {
						await hosted.refresh();
					} finally {
						ctx.rebuild();
					}
				},
			}),
			visible: () => connected,
		},
		ctx.button("calendarService.signOut", {
			name: ctx.t(msg({ message: "Sign out on this device", context: "settings.calendarService.signOut.name" })),
			desc: ctx.t(msg({ message: "Google Calendar events stop showing here. Other devices stay signed in.", context: "settings.calendarService.signOut.description" })),
			buttonText: ctx.t(msg({ message: "Sign out", context: "settings.calendarService.signOut.button" })),
			onClick: async () => {
				await hosted.signOut();
				ctx.rebuild();
			},
		}),
		{
			type: "page",
			name: ctx.t(msg({ message: "Access and account", context: "settings.calendarService.account.name" })),
			desc: ctx.t(msg({ message: "Withdraw Google Calendar access or delete your calendar service account.", context: "settings.calendarService.account.description" })),
			items: [
				ctx.button("calendarService.disconnect", {
					name: ctx.t(msg({ message: "Disconnect Google Calendar", context: "settings.calendarService.disconnect.name" })),
					desc: ctx.t(msg({ message: "Withdraws TaskNotes’ access to Google Calendar on every device.", context: "settings.calendarService.disconnect.description" })),
					buttonText: ctx.t(msg({ message: "Disconnect", context: "settings.native.disconnect" })),
					onClick: async () => {
						if (
							!(await showConfirmationModal(plugin.app, {
								title: ctx.t(msg({ message: "Disconnect Google Calendar?", context: "settings.calendarService.disconnect.confirmTitle" })),
								message: ctx.t(msg({ message: "TaskNotes will stop showing Google Calendar events on every device where you signed in with Google. Your events in Google Calendar are not changed.", context: "settings.calendarService.disconnect.confirmMessage" })),
								confirmText: ctx.t(msg({ message: "Disconnect", context: "settings.native.disconnect" })),
								isDestructive: true,
							}))
						)
							return;
						try {
							await hosted.handleDisconnect();
						} finally {
							ctx.rebuild();
						}
					},
				}),
				ctx.button("calendarService.deleteAccount", {
					name: ctx.t(msg({ message: "Delete calendar service account", context: "settings.calendarService.deleteAccount.name" })),
					desc: ctx.t(msg({ message: "Deletes what the TaskNotes calendar service holds about you, including its access to Google Calendar.", context: "settings.calendarService.deleteAccount.description" })),
					buttonText: ctx.t(msg({ message: "Delete account", context: "settings.calendarService.deleteAccount.button" })),
					onClick: async () => {
						if (
							!(await showConfirmationModal(plugin.app, {
								title: ctx.t(msg({ message: "Delete your calendar service account?", context: "settings.calendarService.deleteAccount.confirmTitle" })),
								message: ctx.t(msg({ message: "Every device is signed out and the service’s access to Google Calendar is withdrawn. Your events in Google Calendar are not changed. This cannot be undone.", context: "settings.calendarService.deleteAccount.confirmMessage" })),
								confirmText: ctx.t(msg({ message: "Delete account", context: "settings.calendarService.deleteAccount.button" })),
								isDestructive: true,
							}))
						)
							return;
						try {
							await hosted.deleteAccount();
						} finally {
							ctx.rebuild();
						}
					},
				}),
			],
		},
	];
}
