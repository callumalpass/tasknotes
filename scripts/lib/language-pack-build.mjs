import { resolve } from "node:path";
import { exportLanguagePacks } from "./language-packs.mjs";

export function createLanguagePackBuildPlugin({ baseUrl, root = process.cwd(), outdir } = {}) {
	const url = new URL(baseUrl);
	const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
	if (
		(url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	)
		throw new Error("Language-pack URL must use HTTPS (HTTP is allowed on localhost only)");
	const normalizedBaseUrl = url.href.replace(/\/+$/, "");
	let exported;
	return {
		name: "downloadable-language-packs",
		setup(build) {
			build.onStart(async () => {
				exported = await exportLanguagePacks({ root, ...(outdir ? { outdir } : {}) });
			});
			build.onLoad({ filter: /\/src\/i18n\/bundledResources\.ts$/ }, () => ({
				contents:
					'import { en } from "./resources/en"; export const translationResources = { en };',
				loader: "ts",
				resolveDir: resolve(root, "src/i18n"),
			}));
			build.onLoad({ filter: /\/src\/i18n\/languagePackConfig\.ts$/ }, (args) => ({
				contents: `export const languagePackConfig = ${JSON.stringify({ baseUrl: normalizedBaseUrl, manifest: exported.manifest })};`,
				loader: "ts",
				watchFiles: [
					args.path,
					...Object.keys(exported.manifest.packs).map((locale) =>
						resolve(root, `src/i18n/resources/${locale}.ts`)
					),
				],
			}));
		},
	};
}
