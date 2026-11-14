import type { SettingDefinition, SettingDefinitionItem } from "obsidian";
import { flattenSettings, page, settingsFixture, settle } from "../../helpers/native-settings";
import { calendarDefinitions } from "../../../src/settings/native/integrations";

jest.mock("../../../src/modals/ConfirmationModal", () => ({
	showConfirmationModal: jest.fn().mockResolvedValue(true),
}));

const WORK = "11111111-1111-4111-8111-111111111111";

function fixture(state: { signedIn?: boolean; ownConnected?: boolean; calendars?: number } = {}) {
	const { plugin, ctx } = settingsFixture();
	const calendars = Array.from({ length: state.calendars ?? 2 }, (_, index) => ({
		id: index === 0 ? WORK : `calendar-${index}`,
		name: index === 0 ? "Work" : `Calendar ${index}`,
		can_write: index === 0,
		is_primary: index === 0,
	}));
	let signedIn = state.signedIn ?? false;
	let selected = [WORK];
	const hosted = {
		isSignedIn: () => signedIn,
		isConnected: () => signedIn,
		isAuthorizing: () => false,
		getAllCalendars: () => (signedIn ? calendars : []),
		getSyncStatus: () => ({ lastSuccess: null, calendarErrors: [], calendarsChecked: 0 }),
		client: { getSnapshot: () => ({ selected, connection: { status: "active" } }) },
		connect: jest.fn(async () => {
			signedIn = true;
		}),
		cancelConnect: jest.fn(),
		setShownCalendars: jest.fn(async (ids: string[]) => {
			selected = ids;
		}),
		refresh: jest.fn().mockResolvedValue(undefined),
		signOut: jest.fn(async () => {
			signedIn = false;
		}),
		handleDisconnect: jest.fn().mockResolvedValue(undefined),
		deleteAccount: jest.fn().mockResolvedValue(undefined),
	};
	const authenticate = jest.fn().mockResolvedValue(undefined);
	Object.assign(plugin, {
		hostedGoogleCalendarService: hosted,
		ownGoogleCalendarService: { getAvailableCalendars: () => [], initialize: jest.fn() },
		oauthService: { authenticate, getConnection: jest.fn().mockResolvedValue(null), getCredentials: () => undefined },
		oauthSecretStore: {
			getConnection: () => (state.ownConnected ? { connectionId: "own" } : null),
		},
	});
	const definitions = () => {
		ctx.begin();
		return calendarDefinitions(ctx);
	};
	return { plugin, ctx, hosted, authenticate, definitions };
}

function named(items: SettingDefinitionItem[], name: string): SettingDefinition | undefined {
	return flattenSettings(items).find(
		(item): item is SettingDefinition => !("type" in item) && item.name === name
	);
}

const shows = (item: SettingDefinition | undefined) =>
	item !== undefined && (typeof item.visible === "function" ? item.visible() : item.visible !== false);

async function press(item: SettingDefinition | undefined): Promise<void> {
	if (!item?.action) throw new Error("Missing action");
	item.action(document.createElement("div"), 0);
	await settle();
}

describe("Google Calendar sign-in settings", () => {
	test("offers Sign in with Google first, with a person's own application behind it", async () => {
		const { definitions, hosted, ctx } = fixture();
		const google = page(definitions(), "Google Calendar");

		expect(shows(named([google], "Sign in with Google"))).toBe(true);
		expect(named([google], "Sign out on this device")).toBeUndefined();
		// Client ID, secret and the rest stay available, one level down.
		const own = page([google], "Use your own Google application");
		expect(page([own], "Application credentials")).toBeDefined();

		await press(named([google], "Sign in with Google"));
		expect(hosted.connect).toHaveBeenCalledTimes(1);
		expect(ctx.rebuild).toHaveBeenCalled();
	});

	test("does not offer a second Google source beside a person's own application", () => {
		const { definitions } = fixture({ ownConnected: true });
		const google = page(definitions(), "Google Calendar");

		expect(shows(named([google], "Sign in with Google"))).toBe(false);
	});

	test("refuses a person's own application while signed in with Google", async () => {
		const { definitions, authenticate } = fixture({ signedIn: true });
		const own = page(definitions(), "Use your own Google application");

		await press(named([own], "Connect Google Calendar"));

		expect(authenticate).not.toHaveBeenCalled();
	});

	test("lets a signed-in person choose which calendars are shown, up to the limit", async () => {
		const { definitions, hosted, ctx } = fixture({ signedIn: true, calendars: 7 });
		const google = page(definitions(), "Google Calendar");

		expect(named([google], "Sign in with Google")).toBeUndefined();
		expect(ctx.read(`calendarService.calendar.${WORK}`)).toBe(true);
		expect(ctx.read("calendarService.calendar.calendar-1")).toBe(false);

		for (const index of [1, 2, 3, 4])
			await ctx.write(`calendarService.calendar.calendar-${index}`, true);
		expect(hosted.setShownCalendars).toHaveBeenLastCalledWith([
			WORK,
			"calendar-1",
			"calendar-2",
			"calendar-3",
			"calendar-4",
		]);
		await expect(ctx.write("calendarService.calendar.calendar-5", true)).rejects.toThrow(
			"You can show up to 5 calendars at a time."
		);

		await ctx.write(`calendarService.calendar.${WORK}`, false);
		expect(hosted.setShownCalendars).toHaveBeenLastCalledWith([
			"calendar-1",
			"calendar-2",
			"calendar-3",
			"calendar-4",
		]);
	});

	test("signs out, disconnects and deletes the account only when asked", async () => {
		const { definitions, hosted } = fixture({ signedIn: true });
		const google = page(definitions(), "Google Calendar");
		const account = page([google], "Access and account");

		await press(named([account], "Disconnect Google Calendar"));
		expect(hosted.handleDisconnect).toHaveBeenCalledTimes(1);
		await press(named([account], "Delete calendar service account"));
		expect(hosted.deleteAccount).toHaveBeenCalledTimes(1);
		await press(named([google], "Sign out on this device"));
		expect(hosted.signOut).toHaveBeenCalledTimes(1);
	});

	test("says on the export pages that export needs a person's own application", () => {
		const signedOut = fixture();
		const note = "Not available while signed in with Google";
		expect(shows(named([page(signedOut.definitions(), "Export tasks to Google Calendar")], note))).toBe(false);

		const signedIn = fixture({ signedIn: true });
		const definitions = signedIn.definitions();
		expect(shows(named([page(definitions, "Export tasks to Google Calendar")], note))).toBe(true);
		expect(shows(named([page(definitions, "Export timeblocks to Google Calendar")], note))).toBe(true);
	});
});
