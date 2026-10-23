import { transformAsync } from "@babel/core";
import { readFile } from "node:fs/promises";

export function linguiMacros() {
  return {
    name: "lingui-core-macros",
    setup(build) {
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
