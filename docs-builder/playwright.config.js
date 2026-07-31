import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	outputDir: "./test-results/docs-site",
	fullyParallel: true,
	workers: 2,
	retries: process.env.CI ? 1 : 0,
	reporter: "list",
	use: {
		baseURL: "http://127.0.0.1:4377",
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	webServer: {
		command: "python3 -m http.server 4377 --directory dist",
		url: "http://127.0.0.1:4377",
		reuseExistingServer: false,
	},
	projects: [
		{
			name: "desktop",
			use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
		},
		{
			name: "mobile",
			use: { ...devices["Pixel 7"] },
		},
	],
});
