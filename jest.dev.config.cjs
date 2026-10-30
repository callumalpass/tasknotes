// Explicitly development-only. CI/release validation uses jest.config.js (strict).
module.exports = {
  ...require("./jest.config.js"),
  globals: { tasknotesI18nDevelopmentFallback: true },
};
