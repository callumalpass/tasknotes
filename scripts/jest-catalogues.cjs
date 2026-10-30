// Fresh checkouts have no generated JSON. Only the explicitly named development
// config may compile fallback data; ordinary test/CI gates require authored POs.
const { prepareStrictCatalogues, prepareDevelopmentCatalogues } = require("./lib/catalogue-gates.cjs");
module.exports = async (_global, project) => {
  if (project.globals.tasknotesI18nDevelopmentFallback === true) prepareDevelopmentCatalogues(project.rootDir);
  else prepareStrictCatalogues(project.rootDir);
};
