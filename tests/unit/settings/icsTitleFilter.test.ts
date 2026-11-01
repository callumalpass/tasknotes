import { App } from "obsidian";
import type TaskNotesPlugin from "../../../src/main";
import type { ICSSubscription } from "../../../src/types";
import { DEFAULT_SETTINGS } from "../../../src/settings/defaults";
import { renderIntegrationsTab } from "../../../src/settings/tabs/integrationsTab";
import { observeTranslation } from "../../helpers/real-i18n";

describe.each(["en", "de", "es", "fr", "it", "ja", "ko", "pt", "ru", "zh"])(
	"ICS title filter settings in %s",
	locale => {
		it("renders translated copy, defaults older settings, and saves edits and clearing", async () => {
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
			const save = jest.fn();
			const translate = observeTranslation(locale);
			const plugin = {
				app: new App(),
				googleCalendarService: {
					on: jest.fn(() => jest.fn()),
					getCalendars: jest.fn().mockResolvedValue([]),
				},
				settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
				i18n: { translate },
				icsSubscriptionService: service,
			} as unknown as TaskNotesPlugin;
			const container = document.createElement("div");
			renderIntegrationsTab(container, plugin, save);
			const input = () => container.querySelector<HTMLInputElement>("input[aria-label]")!;
			expect(input()).not.toBeNull();
			expect(input().value).toBe("");
			expect(input().title).toBe(input().placeholder);
			expect(input().placeholder.length).toBeGreaterThan(10);
			const label = input().getAttribute("aria-label");
			expect(container.textContent).toContain(label);
			if (locale !== "en") {
				expect(label).not.toBe("Title contains:");
				expect(input().placeholder).not.toBe("Case-insensitive text, not regex; empty shows all events");
			}
			expect(service.updateSubscription).not.toHaveBeenCalled();

			// User-entered syntax is plain data in every interface language.
			input().value = "/Meeting/g";
			input().dispatchEvent(new Event("change"));
			await Promise.resolve();
			expect(service.updateSubscription).toHaveBeenLastCalledWith("calendar", { filter: "/Meeting/g" });
			expect(save).toHaveBeenCalledTimes(1);
			expect(input().value).toBe("/Meeting/g");

			input().value = "";
			input().dispatchEvent(new Event("change"));
			await Promise.resolve();
			expect(service.updateSubscription).toHaveBeenLastCalledWith("calendar", { filter: "" });
			expect(save).toHaveBeenCalledTimes(2);
			expect(input().value).toBe("");
		});
	}
);
