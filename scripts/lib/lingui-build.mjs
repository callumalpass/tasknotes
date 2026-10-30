import { transformAsync } from "@babel/core";
import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";
import { resolve } from "node:path";

export function linguiMacros() {
  return {
    name: "lingui-core-macros",
    setup(build) {
      // One compact, synchronously decoded data module per bundled catalogue.
      // Downloaded pack/manifest JSON remains byte-for-byte untouched.
      if (build.initialOptions.minify && process.env.TASKNOTES_RAW_CATALOGUES !== "1") {
        build.onLoad({ filter: /\/src\/i18n\/locales\/[^/]+\/messages\.json$/ }, async ({ path }) => {
          const catalogue = JSON.parse(await readFile(path, "utf8"));
          const compressed = deflateSync(Buffer.from(JSON.stringify(catalogue.messages)), { level: 9 }).toString("base64");
          return {
            contents: `import { unpackBundledCatalogue } from ${JSON.stringify(resolve("src/i18n/compressedCatalogue.ts"))}; export default unpackBundledCatalogue(${JSON.stringify(compressed)});`,
            loader: "js", resolveDir: resolve("src/i18n"), watchFiles: [path],
          };
        });
      }
      build.onLoad({ filter: /\.ts$/ }, async ({ path }) => {
        if (path.includes("/node_modules/")) return;
        const source = await readFile(path, "utf8");
        if (!source.includes("@lingui/core/macro")) return;
        const result = await transformAsync(source, {
          filename: path, babelrc: false, configFile: false,
          // Preserve TS/decorators for esbuild; transform only the Lingui macros.
          parserOpts: { plugins: ["typescript", "decorators-legacy"] },
          plugins: [["@lingui/babel-plugin-lingui-macro", { descriptorFields: build.initialOptions.minify ? "id-only" : "all" }]],
        });
        return { contents: result.code, loader: "ts" };
      });
    },
  };
}
