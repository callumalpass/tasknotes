import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("documentation shell is accessible and stable", async ({ page }, testInfo) => {
	await page.goto("/");
	await page.evaluate(() => document.fonts.ready);

	await expect(page).toHaveTitle(/TaskNotes/);
	await expect(page.locator("h1")).toHaveText("TaskNotes Documentation");
	await expect(page.locator('a[href="/reference/commands/"]').first()).toBeAttached();

	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(1);

	const accessibility = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
		.analyze();
	expect(accessibility.violations).toEqual([]);

	await page.screenshot({
		path: testInfo.outputPath("homepage.png"),
		fullPage: true,
	});
});

test("search and theme preference work", async ({ page }) => {
	await page.goto("/");
	await page.getByRole("button", { name: "Search" }).click();
	await page.getByRole("searchbox").fill("command reference");
	await expect(page.locator(".search-results a").first()).toContainText("Command");
	await page.keyboard.press("Escape");
	await expect(page.locator("#js-search")).not.toHaveAttribute("open", "");

	const theme = page.getByLabel("Colour theme");
	if (await theme.isVisible()) {
		await theme.selectOption("dark");
		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
		await page.reload();
		await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
	}
});

test("mobile navigation traps and restores focus", async ({ page, isMobile }) => {
	test.skip(!isMobile, "Mobile navigation behavior");
	await page.goto("/reference/commands/");
	const menu = page.getByRole("button", { name: "Open documentation navigation" });
	await menu.focus();
	await menu.click();
	await expect(page.locator("#js-sidebar")).toHaveClass(/is-open/);
	await expect(
		page.getByRole("button", { name: "Close documentation navigation" })
	).toBeFocused();
	await page.keyboard.press("Escape");
	await expect(page.locator("#js-sidebar")).not.toHaveClass(/is-open/);
	await expect(menu).toBeFocused();
});

test("source-generated references identify their provenance", async ({ page }) => {
	await page.goto("/reference/http-routes/");
	await expect(page.locator(".doc-status")).toContainText("Generated from source");
	await expect(page.locator("main")).toContainText("Generated from 40 implemented routes");
});
