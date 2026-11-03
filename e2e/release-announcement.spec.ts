import { test, expect } from "@playwright/test";
import { launchObsidian, closeObsidian, setObsidianViewport, type ObsidianApp } from "./obsidian";

let instance: ObsidianApp;
let original: { width: number; height: number; mobile: boolean; locale: string };
test.beforeAll(async () => {
	instance = await launchObsidian();
	original = await instance.page.evaluate(() => ({
		width: window.innerWidth,
		height: window.innerHeight,
		mobile: document.body.classList.contains("is-mobile"),
		locale: (window as any).app.plugins.plugins.tasknotes.i18n.getCurrentLocale(),
	}));
});
test.afterAll(async () => {
	if (!instance) return;
	try {
		await setObsidianViewport(instance.page, original);
		await instance.page.evaluate(original => {
			document.body.classList.toggle("is-mobile", original.mobile);
			(window as any).app.plugins.plugins.tasknotes.i18n.setLocale(original.locale);
			delete (window as any).__releaseAnnouncementAnchor;
		}, original);
	} finally {
		await closeObsidian(instance);
	}
});

test("the compact announcement leaves release changes visible without recruiting Android testers", async ({}, testInfo) => {
	test.setTimeout(120000);
	const page = instance.page;
	await page.evaluate(async () => {
		const app = (window as any).app;
		await new Promise<void>(resolve => app.workspace.onLayoutReady(resolve));
		// Keep a tab group alive while reopening the release view per locale.
		const anchor = app.workspace.getLeaf("tab");
		await anchor.openFile(app.vault.getMarkdownFiles()[0]);
		(window as any).__releaseAnnouncementAnchor = anchor;
		app.workspace.leftSplit.collapse();
		app.workspace.rightSplit.collapse();
	});
	for (const width of [1400, 430]) {
		await setObsidianViewport(page, { width, height: 1000 });
		await page.evaluate(mobile => document.body.classList.toggle("is-mobile", mobile), width === 430);
		for (const locale of ["en", "de", "es", "fr", "it", "ja", "ko", "pt", "ru", "zh"]) {
			await page.evaluate(async locale => {
				const app = (window as any).app;
				for (const leaf of app.workspace.getLeavesOfType("tasknotes-release-notes")) leaf.detach();
				app.workspace.setActiveLeaf((window as any).__releaseAnnouncementAnchor, { focus: true });
				app.plugins.plugins.tasknotes.i18n.setLocale(locale);
				await app.plugins.plugins.tasknotes.activateReleaseNotesView();
				document.querySelectorAll(".notice").forEach(notice => notice.remove());
			}, locale);
			const announcement = page.locator(".release-notes-announcement:visible");
			await expect(announcement).toHaveCount(1);
			await expect(announcement.locator("p")).toHaveCount(1);
			await expect(announcement.locator("h1, h2, h3, ol, ul")).toHaveCount(0);
			expect(await announcement.locator("a").evaluateAll(links => links.map(link => link.getAttribute("href")))).toEqual([
				"https://github.com/callumalpass/tasknotes/releases/tag/5.0.0-beta.6",
				"https://app.tasknotes.dev/",
				"https://apps.apple.com/app/tasknotes/id6797168033",
			]);
			expect(await announcement.innerText()).not.toMatch(/Android|testers|Google Group|4\.13/);
			const box = await announcement.boundingBox();
			expect(box!.height).toBeLessThan(width === 430 ? 300 : 200);
			const firstVersion = page.locator(".release-notes-version-header:visible").first();
			await expect(firstVersion).toBeVisible();
			const versionBox = (await firstVersion.boundingBox())!;
			expect(versionBox.y + versionBox.height).toBeLessThan(await page.evaluate(() => window.innerHeight));
			await page.screenshot({ path: testInfo.outputPath(`${width}-${locale}.png`) });
		}
	}
});
