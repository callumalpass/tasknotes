import { test, expect, type Page } from "@playwright/test";
import { launchObsidian, closeObsidian, openTaskNotesSettings, type ObsidianApp } from "../obsidian";

// Issue #1004 / PR #1346: Basic auth fields on ICS subscription cards.
// The card must stay open while focus moves from username to password, and
// the password must land in SecretStorage rather than data.json.

const PASSWORD = "e2e-pässwörd-1004";
let obsidian: ObsidianApp;
let settingsPage: Page;
let subscriptionId = "";

test.beforeAll(async () => {
	obsidian = await launchObsidian();
	subscriptionId = await obsidian.page.evaluate(async () => {
		const plugin = (window as any).app.plugins.plugins.tasknotes;
		const sub = await plugin.icsSubscriptionService.addSubscription({
			name: "E2E private feed",
			url: "https://calendar.invalid/private.ics",
			type: "remote",
			color: "#4285f4",
			enabled: false,
			refreshInterval: 60,
		});
		return sub.id as string;
	});
	settingsPage = await openTaskNotesSettings(obsidian.page);
	await settingsPage.locator("#tab-button-integrations").click();
});

test.afterAll(async () => {
	if (!obsidian) return;
	try {
		await obsidian.page.evaluate(async (id) => {
			const service = (window as any).app.plugins.plugins.tasknotes.icsSubscriptionService;
			if (service.getSubscriptions().some((sub: { id: string }) => sub.id === id)) {
				await service.removeSubscription(id);
			}
		}, subscriptionId);
	} finally {
		await closeObsidian(obsidian);
	}
});

test("credentials can be entered without the card collapsing; password goes to SecretStorage", async () => {
	const card = settingsPage.locator(`[data-card-id="${subscriptionId}"]`);
	await card.locator(".tasknotes-settings__card-header").click();
	await expect(card).not.toHaveClass(/tasknotes-settings__card--collapsed/);

	const username = card.locator('input[type="text"][placeholder="Username"]');
	const password = card.locator('input[type="password"]');
	await expect(username).toBeHidden();

	await card.locator("select").nth(1).selectOption("basic");
	await expect(username).toBeVisible();
	await expect(password).toBeVisible();

	await username.fill("jürgen");
	await username.press("Tab");
	await expect(password).toBeFocused();
	await password.fill(PASSWORD);
	await password.press("Tab");

	await expect(card).not.toHaveClass(/tasknotes-settings__card--collapsed/);
	await expect(password).toHaveValue("");
	await expect(password).toHaveAttribute("placeholder", /Saved/);

	// Auth edits skip the re-render; later edits on the same card must still
	// reach the service's subscription, not a detached copy.
	await card.locator(".checkbox-container").first().click();
	await expect
		.poll(() =>
			obsidian.page.evaluate(
				(id) =>
					(window as any).app.plugins.plugins.tasknotes.icsSubscriptionService
						.getSubscriptions()
						.find((sub: { id: string }) => sub.id === id)?.enabled,
				subscriptionId
			)
		)
		.toBe(true);

	const stored = await obsidian.page.evaluate(async (id) => {
		const app = (window as any).app;
		const plugin = app.plugins.plugins.tasknotes;
		const data = await plugin.loadData();
		const secretId = app.secretStorage
			.listSecrets()
			.find((secret: string) => secret.includes(id.replace(/_/g, "-")));
		return {
			dataJson: JSON.stringify(data),
			secret: secretId ? app.secretStorage.getSecret(secretId) : null,
			secretId,
		};
	}, subscriptionId);
	expect(stored.dataJson).toContain("jürgen");
	expect(stored.dataJson).not.toContain(PASSWORD);
	expect(stored.secret).toBe(PASSWORD);

	await obsidian.page.evaluate(
		(id) => (window as any).app.plugins.plugins.tasknotes.icsSubscriptionService.removeSubscription(id),
		subscriptionId
	);
	const afterDelete = await obsidian.page.evaluate(
		(secretId) => (window as any).app.secretStorage.getSecret(secretId),
		stored.secretId
	);
	expect(afterDelete || null).toBeNull();
});
