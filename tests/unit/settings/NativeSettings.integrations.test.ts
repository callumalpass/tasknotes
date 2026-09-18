import {
	settingsFixture,
	flattenSettings,
	list,
	control,
	settle,
} from "../../helpers/native-settings";
import {
	subscriptionList,
	webhookList,
	normalizeCalendarUrl,
	validateHttpUrl,
} from "../../../src/settings/native/connections";
import { apiDefinitions } from "../../../src/settings/native/integrations";
import type { ICSSubscription } from "../../../src/types";

jest.mock("../../../src/modals/ConfirmationModal", () => ({
	showConfirmationModal: jest.fn().mockResolvedValue(true),
}));

describe("Native integration settings", () => {
	test("normalizes webcal URLs and rejects non-HTTP URLs", () => {
		expect(normalizeCalendarUrl("webcal://example.com/calendar.ics")).toBe(
			"http://example.com/calendar.ics"
		);
		expect(normalizeCalendarUrl(" WEBCALS://example.com/calendar.ics ")).toBe(
			"https://example.com/calendar.ics"
		);
		expect(validateHttpUrl("https://example.com/calendar.ics")).toBeUndefined();
		expect(validateHttpUrl("javascript:alert(1)")).toBeTruthy();
		expect(validateHttpUrl("not a URL")).toBeTruthy();
	});

	test("updates subscriptions through the service, including enabling and refresh intervals", async () => {
		const { plugin, ctx } = settingsFixture();
		let subscription: ICSSubscription = {
			id: "calendar",
			name: "Calendar",
			type: "remote",
			url: "https://example.com/calendar.ics",
			color: "#123456",
			enabled: false,
			refreshInterval: 60,
		};
		const update = jest.fn(async (_id, patch) => {
			subscription = { ...subscription, ...patch };
		});
		plugin.icsSubscriptionService = {
			getSubscriptions: () => [subscription],
			updateSubscription: update,
			getLastError: () => undefined,
			getLastFetched: () => undefined,
		} as never;
		subscriptionList(ctx);
		await ctx.write("subscription.calendar.enabled", true);
		expect(update).toHaveBeenCalledWith("calendar", { enabled: true });
		await ctx.write("subscription.calendar.refreshInterval", 30);
		expect(update).toHaveBeenCalledWith("calendar", { refreshInterval: 30 });
		await ctx.write("subscription.calendar.url", "webcals://example.com/new.ics");
		expect(subscription.url).toBe("https://example.com/new.ics");
		await ctx.write("subscription.calendar.type", "local");
		expect(subscription).toMatchObject({ type: "local", enabled: false });
		await expect(ctx.write("subscription.calendar.enabled", true)).rejects.toThrow();
		await ctx.write("subscription.calendar.filePath", "Calendar.ics");
		await ctx.write("subscription.calendar.enabled", true);
		expect(subscription.enabled).toBe(true);
	});

	test("new webhooks are inactive until URL and events are configured; secret is never indexed", async () => {
		const { plugin, ctx } = settingsFixture();
		plugin.settings.webhooks = [];
		webhookList(ctx).addItem!.action(document.createElement("button"));
		await settle();
		const hook = plugin.settings.webhooks[0];
		expect(hook.active).toBe(false);
		expect(hook.secret).toHaveLength(64);
		ctx.begin();
		const definition = webhookList(ctx);
		expect(JSON.stringify(definition)).not.toContain(hook.secret);
		await expect(ctx.write(`webhook.${hook.id}.active`, true)).rejects.toThrow();
		await ctx.write(`webhook.${hook.id}.url`, "https://example.com/webhook");
		await expect(ctx.write(`webhook.${hook.id}.active`, true)).rejects.toThrow();
		await ctx.write(`webhook.${hook.id}.events.task.created`, true);
		await ctx.write(`webhook.${hook.id}.active`, true);
		expect(hook.active).toBe(true);
		await ctx.write(`webhook.${hook.id}.events.task.created`, false);
		expect(hook.active).toBe(false);
	});

	test("API indexing does not fetch live documentation or read secrets", () => {
		const { ctx, plugin } = settingsFixture();
		plugin.settings.apiAuthToken = "private-token";
		const definitions = [apiDefinitions(ctx)];
		expect(control(definitions, "apiPort").control.type).toBe("number");
		expect(JSON.stringify(definitions)).not.toContain("private-token");
		expect(plugin.saveSettings).not.toHaveBeenCalled();
	});

	test("all generated action controls catch asynchronous errors", async () => {
		const { ctx } = settingsFixture();
		const definition = ctx.button("failing-action", {
			name: "Fail",
			buttonText: "Fail",
			onClick: async () => {
				throw new Error("offline");
			},
		});
		if (!definition.action) throw new Error("Missing action");
		definition.action(document.createElement("div"), 0);
		await settle();
		expect((definition.disabled as () => boolean)()).toBe(false);
	});
});
