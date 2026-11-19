import { settingsFixture, control } from "../../helpers/native-settings";
import { observeTranslation } from "../../helpers/real-i18n";
import { subscriptionList } from "../../../src/settings/native/connections";
import type { ICSSubscription } from "../../../src/types";

describe.each(["en", "de", "es", "fr", "it", "ja", "ko", "pt", "ru", "zh"])(
	"ICS title filter settings in %s",
	locale => {
		it("uses translated copy, defaults older settings, and saves edits and clearing", async () => {
			let subscription: ICSSubscription = {
				id: "calendar", name: "My calendar", type: "remote",
				url: "https://example.com/calendar.ics", enabled: true,
				color: "#3788d8", refreshInterval: 60,
			};
			const service = {
				getSubscriptions: () => [subscription],
				getLastFetched: () => undefined,
				getLastError: () => undefined,
				hasPassword: () => false,
				isPasswordStorageAvailable: () => true,
				updateSubscription: jest.fn(async (_id: string, updates: Partial<ICSSubscription>) => {
					subscription = { ...subscription, ...updates };
				}),
			};
			const { plugin, ctx } = settingsFixture();
			plugin.i18n = { ...plugin.i18n, translate: observeTranslation(locale) } as never;
			plugin.icsSubscriptionService = service as never;

			const definitions = [subscriptionList(ctx)];
			const filterKey = "subscription.calendar.filter";
			const filter = control(definitions, filterKey);
			expect(ctx.read(filterKey)).toBe("");
			expect(String(filter.desc).length).toBeGreaterThan(10);
			if (locale !== "en") {
				expect(filter.name).not.toBe("Title contains:");
				expect(filter.desc).not.toBe("Case-insensitive text, not regex; empty shows all events");
			}
			expect(service.updateSubscription).not.toHaveBeenCalled();

			// User-entered syntax is plain data in every interface language.
			await ctx.write(filterKey, "/Meeting/g");
			expect(service.updateSubscription).toHaveBeenLastCalledWith("calendar", { filter: "/Meeting/g" });
			expect(ctx.read(filterKey)).toBe("/Meeting/g");

			await ctx.write(filterKey, "");
			expect(service.updateSubscription).toHaveBeenLastCalledWith("calendar", { filter: "" });
			expect(ctx.read(filterKey)).toBe("");
		});
	}
);

describe("ICS subscription authentication settings", () => {
	function authFixture(overrides: Partial<ICSSubscription> = {}) {
		let subscription: ICSSubscription = {
			id: "calendar", name: "My calendar", type: "remote",
			url: "https://example.com/calendar.ics", enabled: true,
			color: "#3788d8", refreshInterval: 60, ...overrides,
		};
		const service = {
			getSubscriptions: () => [subscription],
			getLastFetched: () => undefined,
			getLastError: () => undefined,
			hasPassword: () => false,
			isPasswordStorageAvailable: () => true,
			setPassword: jest.fn().mockResolvedValue(undefined),
			updateSubscription: jest.fn(async (_id: string, updates: Partial<ICSSubscription>) => {
				subscription = { ...subscription, ...updates };
			}),
		};
		const { plugin, ctx } = settingsFixture();
		plugin.icsSubscriptionService = service as never;
		return { ctx, service, definitions: [subscriptionList(ctx)] };
	}

	it("keeps the credentials hidden until HTTP Basic is chosen", async () => {
		const { ctx, service, definitions } = authFixture();
		const username = control(definitions, "subscription.calendar.username");
		expect(ctx.read("subscription.calendar.authType")).toBe("none");
		expect((username as { visible?: () => boolean }).visible?.()).toBe(false);

		await ctx.write("subscription.calendar.authType", "basic");
		expect(service.updateSubscription).toHaveBeenLastCalledWith("calendar", { authType: "basic" });
		expect((username as { visible?: () => boolean }).visible?.()).toBe(true);

		await ctx.write("subscription.calendar.username", "  alex ");
		expect(service.updateSubscription).toHaveBeenLastCalledWith("calendar", { username: "alex" });
	});

	it("never offers credentials for local calendars", () => {
		const { definitions } = authFixture({ type: "local", authType: "basic" });
		const authType = control(definitions, "subscription.calendar.authType");
		const username = control(definitions, "subscription.calendar.username");
		expect((authType.control as { disabled?: () => boolean }).disabled?.()).toBe(true);
		expect((username as { visible?: () => boolean }).visible?.()).toBe(false);
	});
});
