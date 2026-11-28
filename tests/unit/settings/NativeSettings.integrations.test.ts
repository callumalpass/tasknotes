import { Notice, Setting, type TextComponent } from "obsidian";
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
import { apiDefinitions, calendarDefinitions } from "../../../src/settings/native/integrations";
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
			hasPassword: () => false,
			isPasswordStorageAvailable: () => true,
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

	test("timeblock export settings persist and keep the default title template when cleared", async () => {
		const { plugin, ctx } = settingsFixture();
		plugin.ownGoogleCalendarService = {
			getAvailableCalendars: () => [{ id: "work", summary: "Work" }],
		} as never;
		calendarDefinitions(ctx);
		const google = plugin.settings.googleCalendarExport;
		expect(ctx.read("googleCalendarExport.syncTimeblocks")).toBe(false);

		await ctx.write("googleCalendarExport.syncTimeblocks", true);
		await ctx.write("googleCalendarExport.timeblockTargetCalendarId", "work");
		await ctx.write("googleCalendarExport.timeblockEventTitleTemplate", "[TB] {{title}}");
		expect(google).toMatchObject({
			syncTimeblocks: true,
			timeblockTargetCalendarId: "work",
			timeblockEventTitleTemplate: "[TB] {{title}}",
		});

		await ctx.write("googleCalendarExport.timeblockEventTitleTemplate", "");
		expect(google.timeblockEventTitleTemplate).toBe("{{title}}");
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

	test("API authentication token row supports revealing, copying while masked, and empty-token state", async () => {
		const { ctx, plugin } = settingsFixture();
		plugin.settings.apiAuthToken = "secret-api-token";
		const writeText = jest.fn().mockResolvedValue(undefined);
		const originalClipboard = navigator.clipboard;
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});
		const noticeMock = Notice as unknown as jest.Mock;
		noticeMock.mockClear();
		try {
			const apiPage = apiDefinitions(ctx);
			const tokenDef = apiPage.items?.find(
				(item) => "render" in item && item.aliases?.[0] === "apiAuthToken"
			);
			if (!tokenDef || !("render" in tokenDef)) throw new Error("Missing apiAuthToken setting");

			const setting = new Setting(document.createElement("div"));
			tokenDef.render(setting, {} as never);

			const input = setting.controlEl.querySelector<HTMLInputElement>("input");
			const revealBtn = setting.controlEl.querySelector<HTMLElement>('[aria-label="Show token"]');
			const copyBtn = setting.controlEl.querySelector<HTMLElement>('[aria-label="Copy token"]');
			expect(input).not.toBeNull();
			expect(revealBtn).not.toBeNull();
			expect(copyBtn).not.toBeNull();

			// Masked by default; copy works even while masked.
			expect(input!.type).toBe("password");
			expect(input!.autocomplete).toBe("off");
			expect(input!.value).toBe("secret-api-token");
			expect(revealBtn!.getAttribute("aria-pressed")).toBe("false");
			expect(copyBtn!.getAttribute("aria-disabled")).toBe("false");

			copyBtn!.click();
			await settle();
			expect(writeText).toHaveBeenCalledWith("secret-api-token");
			expect(noticeMock).toHaveBeenCalledWith("API authentication token copied");

			// Toggle reveal and mask back.
			revealBtn!.click();
			expect(input!.type).toBe("text");
			expect(revealBtn!.getAttribute("aria-label")).toBe("Hide token");
			expect(revealBtn!.getAttribute("aria-pressed")).toBe("true");

			revealBtn!.click();
			expect(input!.type).toBe("password");
			expect(revealBtn!.getAttribute("aria-label")).toBe("Show token");
			expect(revealBtn!.getAttribute("aria-pressed")).toBe("false");

			// Clearing the token disables copy; entering a new token re-enables copy.
			const textComponent = setting.components[0] as TextComponent;
			textComponent.setValue("");
			expect(plugin.settings.apiAuthToken).toBe("");
			expect(copyBtn!.getAttribute("aria-disabled")).toBe("true");
			writeText.mockClear();
			noticeMock.mockClear();
			copyBtn!.click();
			await settle();
			expect(writeText).not.toHaveBeenCalled();
			expect(noticeMock).not.toHaveBeenCalled();

			textComponent.setValue("updated-token");
			expect(plugin.settings.apiAuthToken).toBe("updated-token");
			expect(copyBtn!.getAttribute("aria-disabled")).toBe("false");
			copyBtn!.click();
			await settle();
			expect(writeText).toHaveBeenCalledWith("updated-token");
			expect(noticeMock).toHaveBeenCalledWith("API authentication token copied");

			// Clipboard rejection is handled cleanly without throwing.
			noticeMock.mockClear();
			writeText.mockRejectedValueOnce(new Error("Clipboard denied"));
			copyBtn!.click();
			await settle();
			expect(writeText).toHaveBeenCalledTimes(2);
			expect(noticeMock).toHaveBeenCalledWith("Failed to copy to clipboard");
		} finally {
			Object.defineProperty(navigator, "clipboard", {
				configurable: true,
				value: originalClipboard,
			});
		}
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
