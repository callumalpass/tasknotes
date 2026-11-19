// Compile real Lingui macros before ts-jest erases ESM imports. No translator mock.
const { transformSync } = require("@babel/core");
const { createTransformer } = require("ts-jest").default;
const transformer = createTransformer({
  tsconfig: { paths: { obsidian: ["node_modules/obsidian-test-mocks/dist/lib/cjs/obsidian/index.cjs"] } },
});
module.exports = {
  process(source, filename, options) {
    if (source.includes("@lingui/core/macro")) source = transformSync(source, {
      filename, configFile: false, babelrc: false,
      parserOpts: { plugins: ["typescript", "decorators-legacy"] },
      plugins: [["@lingui/babel-plugin-lingui-macro", { descriptorFields: "all" }]],
    }).code;
    return transformer.process(source, filename, options);
  },
};
