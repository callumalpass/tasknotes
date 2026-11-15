import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { strToU8, zlibSync } from "fflate";

export function createMarkdownBuildPlugin({ production = false } = {}) {
	return {
		name: "markdown",
		setup(build) {
			build.onLoad({ filter: /\.md$/ }, (args) => {
				const text = readFileSync(args.path, "utf8");
				const literal = `export default ${JSON.stringify(text)}`;
				let contents = literal;
				if (production) {
					const base64 = Buffer.from(zlibSync(strToU8(text))).toString("base64");
					const compressed = `import { unzlibSync, strFromU8 } from "fflate";
const binary = atob(${JSON.stringify(base64)});
export default strFromU8(unzlibSync(Uint8Array.from(binary, character => character.charCodeAt(0))));`;
					if (compressed.length < literal.length) contents = compressed;
				}
				return {
					contents,
					loader: "js",
					resolveDir: fileURLToPath(new URL("../../", import.meta.url)),
					watchFiles: [args.path],
				};
			});
		},
	};
}
